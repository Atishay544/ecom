import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

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
    .select('id, status, coupon_code, razorpay_order_id, user_id')
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
  const { error: updateErr } = await admin
    .from('orders')
    .update({
      status:               'confirmed',
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

  return NextResponse.json({ success: true })
}
