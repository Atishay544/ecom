import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { sendOrderConfirmation, sendNewOrderAlert } from '@/lib/email'

export async function POST(req: NextRequest) {
  // ── 1. Authenticate user ──────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()

  if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
  }

  // ── 3. Verify Razorpay signature (HMAC SHA256) ────────────────────────────
  // Razorpay signs: razorpay_order_id + "|" + razorpay_payment_id
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (expectedSignature !== razorpay_signature) {
    console.error('Razorpay signature mismatch for order:', order_id)
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
  }

  // ── 4. Fetch order — must belong to this user, must be pending ────────────
  const admin = createAdminClient()
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, status, coupon_code, razorpay_order_id, user_id, total, discount_amount, subtotal, metadata, shipping_address, order_items(unit_price, quantity, snapshot)')
    .eq('id', order_id)
    .eq('user_id', user.id)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Double-check the razorpay_order_id matches what we stored
  if (order.razorpay_order_id !== razorpay_order_id) {
    return NextResponse.json({ error: 'Order ID mismatch' }, { status: 400 })
  }

  // Idempotency: if already confirmed (e.g. duplicate webhook), return success
  if (order.status !== 'pending') {
    return NextResponse.json({ success: true })
  }

  // ── 5. Confirm order + store payment ID ───────────────────────────────────
  // cod_upfront gets its own status so admin knows upfront is paid, COD balance due on delivery
  const meta          = ((order as any).metadata ?? {}) as Record<string, any>
  const confirmedStatus = meta.payment_method === 'cod_upfront' ? 'cod_upfront_paid' : 'confirmed'

  const { error: updateErr } = await admin
    .from('orders')
    .update({
      status:               confirmedStatus,
      razorpay_payment_id:  razorpay_payment_id,
      updated_at:           new Date().toISOString(),
    })
    .eq('id', order_id)

  if (updateErr) {
    console.error('Order confirm error:', updateErr)
    return NextResponse.json({ error: 'Failed to confirm order' }, { status: 500 })
  }

  // ── 6. Increment coupon uses_count ────────────────────────────────────────
  if (order.coupon_code) {
    await admin.rpc('increment_coupon_uses', { p_code: order.coupon_code })
      .then(() => {})
      .catch(() => {}) // Non-fatal — coupon tracking is best-effort
  }

  // ── 7. Reserve stock for each item (atomic, prevents overselling) ─────────
  const { data: orderItems } = await admin
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', order_id)

  if (orderItems) {
    await Promise.allSettled(
      orderItems.map(item =>
        admin.rpc('reserve_stock', {
          p_product_id: item.product_id,
          p_quantity:   item.quantity,
        })
      )
    )
  }

  // ── 8. Send confirmation emails (fire-and-forget) ────────────────────────
  try {
    const meta = (order.metadata ?? {}) as Record<string, any>
    const pm   = meta.payment_method as string ?? 'online'
    const addr = order.shipping_address as Record<string, string> ?? {}
    const emailItems = ((order as any).order_items ?? []).map((i: any) => ({
      name:       i.snapshot?.name ?? '—',
      quantity:   i.quantity,
      unit_price: Number(i.unit_price),
    }))
    const authData = await admin.auth.admin.getUserById(user.id)
    const email    = authData.data.user?.email ?? ''

    sendOrderConfirmation({
      to:               email,
      orderId:          order.id,
      items:            emailItems,
      subtotal:         Number((order as any).subtotal ?? 0),
      discount:         Number((order as any).discount_amount ?? 0),
      total:            Number((order as any).total ?? 0),
      paymentMethod:    pm as any,
      amountCharged:    meta.amount_charged ? Number(meta.amount_charged) : undefined,
      amountOnDelivery: meta.amount_on_delivery ? Number(meta.amount_on_delivery) : undefined,
      shippingAddress:  addr,
    }).catch(() => {})

    sendNewOrderAlert({
      orderId:        order.id,
      customerEmail:  email,
      items:          emailItems,
      total:          Number((order as any).total ?? 0),
      paymentMethod:  pm === 'cod_upfront' ? 'COD Upfront' : 'Paid Online',
      shippingAddress: addr,
    }).catch(() => {})
  } catch { /* email is non-fatal */ }

  return NextResponse.json({ success: true })
}
