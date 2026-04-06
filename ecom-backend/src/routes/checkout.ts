import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { razorpay, verifyPaymentSignature } from '../lib/razorpay'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { rateLimit } from '../middleware/rateLimit'
import { validate } from '../middleware/validate'
import { checkOrderFraud, logFraud } from '../services/fraud'
import { z } from 'zod'

const router = Router()

const CheckoutSchema = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity:   z.number().int().min(1),
  })).min(1),
  shipping_address: z.object({
    full_name:   z.string().min(2),
    line1:       z.string().min(3),
    line2:       z.string().optional(),
    city:        z.string().min(2),
    state:       z.string().min(2),
    postal_code: z.string().min(3),
    country:     z.string().default('IN'),
    phone:       z.string().optional(),
  }),
  coupon_code: z.string().optional(),
})

// POST /api/checkout
router.post('/', requireAuth, rateLimit('checkout'), validate(CheckoutSchema), async (req: AuthRequest, res) => {
  const { items, shipping_address, coupon_code } = req.body
  const userId = req.user!.id
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? ''

  // 1. Fetch products
  const productIds = items.map((i: any) => i.product_id)
  const { data: products, error: pErr } = await supabase.from('products')
    .select('id, name, price, stock, images').in('id', productIds).eq('is_active', true)
  if (pErr || !products?.length) return res.status(400).json({ data: null, error: 'Invalid products' })

  // 2. Validate stock & build line items
  const lineItems = []
  for (const item of items) {
    const product = products.find((p: any) => p.id === item.product_id)
    if (!product) return res.status(400).json({ data: null, error: `Product not found: ${item.product_id}` })
    if (product.stock < item.quantity) return res.status(400).json({ data: null, error: `Insufficient stock: ${product.name}` })
    lineItems.push({ product, quantity: item.quantity, unit_price: product.price, total: product.price * item.quantity })
  }

  // 3. Calculate totals
  let subtotal = lineItems.reduce((s, i) => s + Number(i.total), 0)
  let discount = 0

  // 4. Apply coupon
  if (coupon_code) {
    const { data: coupon } = await supabase.from('coupons').select('*')
      .eq('code', coupon_code.toUpperCase()).eq('is_active', true).single()
    if (coupon) {
      if (!coupon.expires_at || new Date(coupon.expires_at) > new Date()) {
        if (!coupon.max_uses || coupon.uses_count < coupon.max_uses) {
          if (subtotal >= Number(coupon.min_order)) {
            discount = coupon.type === 'percentage' ? subtotal * (coupon.value / 100) : coupon.value
          }
        }
      }
    }
  }

  const tax = 0 // Add GST logic here if needed
  const shipping = subtotal - discount >= 999 ? 0 : 99
  const total = Math.max(0, subtotal - discount + tax + shipping)

  // 5. Fraud check
  const { data: { user } } = await supabase.auth.admin.getUserById(userId)
  const fraud = await checkOrderFraud(userId, total, user?.email ?? '', ip)
  if (!fraud.allowed) {
    await logFraud(userId, fraud.reason!, { total, items }, ip)
    return res.status(422).json({ data: null, error: 'We could not process your order. Please contact support.' })
  }

  // 6. Reserve stock atomically
  for (const item of items) {
    const { data: reserved } = await supabase.rpc('reserve_stock', { p_product_id: item.product_id, p_quantity: item.quantity })
    if (!reserved) return res.status(400).json({ data: null, error: `${products.find((p:any) => p.id === item.product_id)?.name} just went out of stock.` })
  }

  // 7. Create Razorpay order
  const rpOrder = await razorpay.orders.create({
    amount: Math.round(total * 100), // paise
    currency: 'INR',
    receipt: `receipt_${Date.now()}`,
  })

  // 8. Create order in DB
  const { data: order, error: oErr } = await supabase.from('orders').insert({
    user_id: userId,
    status: 'pending',
    subtotal,
    tax,
    shipping,
    total,
    razorpay_order_id: rpOrder.id,
    shipping_address,
  }).select().single()
  if (oErr) return res.status(500).json({ data: null, error: oErr.message })

  // 9. Insert order items
  await supabase.from('order_items').insert(lineItems.map(i => ({
    order_id:   order.id,
    product_id: i.product.id,
    quantity:   i.quantity,
    unit_price: i.unit_price,
    total:      i.total,
    snapshot:   { name: i.product.name, price: i.unit_price, images: i.product.images },
  })))

  // 10. Clear cart
  await supabase.from('cart_items').delete().eq('user_id', userId)

  // 11. Increment coupon usage
  if (coupon_code) {
    const { data: couponForUpdate } = await supabase.from('coupons').select('id, uses_count')
      .eq('code', coupon_code.toUpperCase()).single()
    if (couponForUpdate) {
      await supabase.from('coupons').update({ uses_count: couponForUpdate.uses_count + 1 }).eq('id', couponForUpdate.id)
    }
  }

  res.json({
    data: {
      order_id: order.id,
      razorpay_order: {
        id:       rpOrder.id,
        amount:   rpOrder.amount,
        currency: 'INR',
      },
      razorpay_key: process.env.RAZORPAY_KEY_ID,
    },
    error: null,
  })
})

// POST /api/checkout/validate-coupon
const ValidateCouponSchema = z.object({
  code:     z.string().min(1),
  subtotal: z.number().positive(),
})

router.post('/validate-coupon', requireAuth, validate(ValidateCouponSchema), async (req: AuthRequest, res) => {
  const { code, subtotal } = req.body

  const { data: coupon, error } = await supabase.from('coupons').select('*')
    .ilike('code', code).eq('is_active', true).single()

  if (error || !coupon) {
    return res.status(400).json({ data: null, error: 'Invalid or inactive coupon code' })
  }

  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
    return res.status(400).json({ data: null, error: 'Coupon has expired' })
  }

  if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
    return res.status(400).json({ data: null, error: 'Coupon usage limit reached' })
  }

  const discount = coupon.type === 'percentage'
    ? subtotal * (coupon.value / 100)
    : coupon.value

  return res.json({
    data: { discount, type: coupon.type as 'percentage' | 'fixed', code: coupon.code },
    error: null,
  })
})

// POST /api/checkout/verify
const VerifySchema = z.object({
  order_id:             z.string().uuid(),
  razorpay_order_id:    z.string().min(1),
  razorpay_payment_id:  z.string().min(1),
  razorpay_signature:   z.string().min(1),
})

router.post('/verify', requireAuth, validate(VerifySchema), async (req: AuthRequest, res) => {
  const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
  const userId = req.user!.id

  const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
  if (!isValid) {
    return res.status(400).json({ data: null, error: 'Payment verification failed' })
  }

  const { error } = await supabase.from('orders')
    .update({ status: 'confirmed', razorpay_payment_id })
    .eq('id', order_id)
    .eq('user_id', userId)

  if (error) {
    return res.status(500).json({ data: null, error: error.message })
  }

  return res.json({ data: { success: true }, error: null })
})

export default router
