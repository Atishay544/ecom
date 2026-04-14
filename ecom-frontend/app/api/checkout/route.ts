import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

type PaymentMethod = 'online' | 'cod' | 'cod_upfront'

// Lazily instantiated — avoids build-time crash when env vars are absent
function getRazorpay() {
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  })
}

export async function POST(req: NextRequest) {
  // ── 1. Authenticate ───────────────────────────────────────────────────────
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  const body = await req.json()
  const {
    items,
    shipping_address,
    coupon_code,
    payment_method = 'online' as PaymentMethod,
    offer_id,
  } = body

  if (!Array.isArray(items) || items.length === 0)
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })

  const requiredAddr = ['name', 'phone', 'line1', 'city', 'state', 'pincode'] as const
  for (const f of requiredAddr) {
    if (!shipping_address?.[f]?.trim())
      return NextResponse.json({ error: `Missing address field: ${f}` }, { status: 400 })
  }

  const validPaymentMethods: PaymentMethod[] = ['online', 'cod', 'cod_upfront']
  if (!validPaymentMethods.includes(payment_method))
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })

  // ── 3. Validate products + compute subtotal ───────────────────────────────
  const admin = createAdminClient()
  const productIds: string[] = items.map((i: any) => i.product_id)

  const { data: products, error: prodErr } = await admin
    .from('products')
    .select('id, name, price, stock, images, slug')
    .in('id', productIds)
    .eq('is_active', true)

  if (prodErr || !products || products.length !== productIds.length)
    return NextResponse.json({ error: 'One or more products are unavailable' }, { status: 400 })

  const productMap = new Map(products.map(p => [p.id, p]))
  let subtotal = 0
  const lineItems: { product_id: string; quantity: number; unit_price: number; total: number; snapshot: object }[] = []

  for (const item of items) {
    const product = productMap.get(item.product_id)
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 400 })
    if (product.stock !== null && product.stock < item.quantity)
      return NextResponse.json({ error: `Insufficient stock for: ${product.name}` }, { status: 400 })
    const lineTotal = product.price * item.quantity
    subtotal += lineTotal
    lineItems.push({
      product_id: item.product_id,
      quantity:   item.quantity,
      unit_price: product.price,
      total:      lineTotal,
      snapshot:   { name: product.name, price: product.price, image: product.images?.[0] ?? null, slug: product.slug },
    })
  }

  // ── 4. Apply coupon ───────────────────────────────────────────────────────
  let discount = 0
  let validatedCouponCode: string | null = null

  if (coupon_code) {
    const { data: coupon } = await admin
      .from('coupons')
      .select('id, code, type, value, min_order, max_uses, uses_count, expires_at')
      .eq('code', coupon_code.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle()

    if (
      coupon &&
      (!coupon.expires_at || new Date(coupon.expires_at) > new Date()) &&
      (coupon.max_uses === null || coupon.uses_count < coupon.max_uses) &&
      subtotal >= Number(coupon.min_order ?? 0)
    ) {
      discount = coupon.type === 'percentage'
        ? Math.round(subtotal * Number(coupon.value)) / 100
        : Math.min(Number(coupon.value), subtotal)
      validatedCouponCode = coupon.code
    }
  }

  const total = Math.max(0, subtotal - discount)

  // ── 4b. Resolve COD upfront offer (only for cod_upfront method) ───────────
  let offerUpfrontPct: number | null = null
  let offerDiscountPct: number | null = null
  let validatedOfferId: string | null = null

  if (payment_method === 'cod_upfront' && offer_id) {
    const { data: offer } = await admin
      .from('offers')
      .select('id, type, upfront_pct, discount_pct, is_active')
      .eq('id', offer_id)
      .eq('is_active', true)
      .maybeSingle()

    if (offer && offer.type === 'cod_upfront' && offer.upfront_pct) {
      offerUpfrontPct  = Number(offer.upfront_pct)
      offerDiscountPct = Number(offer.discount_pct ?? 0)
      validatedOfferId = offer.id
    }
  }

  const amountToCharge = (payment_method === 'cod_upfront' && offerUpfrontPct !== null)
    ? Math.round(total * offerUpfrontPct) / 100
    : total

  // ── 5. Build order metadata ───────────────────────────────────────────────
  const orderMetadata: Record<string, any> = { payment_method }

  if (payment_method === 'cod_upfront' && validatedOfferId) {
    orderMetadata.offer_id           = validatedOfferId
    orderMetadata.offer_upfront_pct  = offerUpfrontPct
    orderMetadata.offer_discount_pct = offerDiscountPct
    orderMetadata.amount_charged     = amountToCharge
    orderMetadata.amount_on_delivery = total - amountToCharge
  }
  if (payment_method === 'cod') {
    orderMetadata.amount_on_delivery = total
  }

  // ── 6. Create order in Supabase ───────────────────────────────────────────
  // COD orders are confirmed immediately (no payment pending)
  const initialStatus = payment_method === 'cod' ? 'confirmed' : 'pending'

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      user_id:          user.id,
      status:           initialStatus,
      subtotal,
      subtotal_amount:  subtotal,
      discount_amount:  discount,
      shipping_amount:  0,
      tax:              0,
      shipping:         0,
      total,
      total_amount:     total,
      shipping_address: {
        name:    shipping_address.name,
        phone:   shipping_address.phone,
        line1:   shipping_address.line1,
        line2:   shipping_address.line2 ?? '',
        city:    shipping_address.city,
        state:   shipping_address.state,
        pincode: shipping_address.pincode,
      },
      coupon_code: validatedCouponCode,
      metadata:    orderMetadata,
    })
    .select('id')
    .single()

  if (orderErr || !order) {
    console.error('Order insert error:', orderErr)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }

  // ── 7. Insert order line items ────────────────────────────────────────────
  const { error: itemsErr } = await admin
    .from('order_items')
    .insert(lineItems.map(li => ({ ...li, order_id: order.id })))

  if (itemsErr) {
    await admin.from('orders').delete().eq('id', order.id)
    console.error('Order items insert error:', itemsErr)
    return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 })
  }

  // ── 7b. Save shipping address to user profile for future pre-fill ────────
  admin.from('profiles')
    .update({ saved_address: {
      name:    shipping_address.name,
      phone:   shipping_address.phone,
      line1:   shipping_address.line1,
      line2:   shipping_address.line2 ?? '',
      city:    shipping_address.city,
      state:   shipping_address.state,
      pincode: shipping_address.pincode,
    }})
    .eq('id', user.id)
    .then(() => {})  // fire-and-forget

  // ── 8. COD → done, no Razorpay needed ────────────────────────────────────
  if (payment_method === 'cod') {
    // Reserve stock immediately for COD orders
    await Promise.allSettled(
      lineItems.map(li =>
        admin.rpc('reserve_stock', { p_product_id: li.product_id, p_quantity: li.quantity })
      )
    )
    if (validatedCouponCode) {
      await admin.rpc('increment_coupon_uses', { p_code: validatedCouponCode }).catch(() => {})
    }
    return NextResponse.json({ order_id: order.id, payment_method: 'cod' })
  }

  // ── 9. Online / COD-upfront → create Razorpay order ──────────────────────
  let razorpayOrder: { id: string; amount: number; currency: string }
  try {
    razorpayOrder = await getRazorpay().orders.create({
      amount:   Math.round(amountToCharge * 100),
      currency: 'INR',
      receipt:  order.id.slice(0, 40),
      notes: {
        order_id:        order.id,
        user_id:         user.id,
        payment_method,
        ...(payment_method === 'cod_upfront' && offerUpfrontPct !== null && {
          offer_upfront_pct:  String(offerUpfrontPct),
          amount_on_delivery: String(total - amountToCharge),
        }),
      },
    })
  } catch (rzpErr: any) {
    await admin.from('orders').delete().eq('id', order.id)
    console.error('Razorpay order creation failed:', rzpErr)
    const msg = rzpErr?.error?.description ?? rzpErr?.message ?? 'Payment gateway error. Please try again.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  await admin
    .from('orders')
    .update({ razorpay_order_id: razorpayOrder.id })
    .eq('id', order.id)

  return NextResponse.json({
    order_id:       order.id,
    payment_method,
    razorpay_order: {
      id:       razorpayOrder.id,
      amount:   razorpayOrder.amount,
      currency: razorpayOrder.currency,
    },
  })
}
