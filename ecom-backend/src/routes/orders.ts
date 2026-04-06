import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { razorpay } from '../lib/razorpay'
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth'
import { sendOrderShipped, sendOrderDelivered, sendRefundProcessed } from '../services/emails'
import { z } from 'zod'
import { validate } from '../middleware/validate'

const router = Router()

// GET /api/orders — user's own orders
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const { data, error } = await supabase.from('orders')
    .select('*, order_items(*, snapshot)')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ data: null, error: error.message })
  res.json({ data, error: null })
})

// GET /api/orders/:id — user's own order detail
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const { data, error } = await supabase.from('orders')
    .select('*, order_items(*, snapshot)')
    .eq('id', req.params.id).eq('user_id', req.user!.id).single()
  if (error) return res.status(404).json({ data: null, error: 'Order not found' })
  res.json({ data, error: null })
})

// ── ADMIN ROUTES ──────────────────────────────────────────

// GET /api/orders/admin/all
router.get('/admin/all', requireAdmin, async (req, res) => {
  const { status, q, page = '1', limit = '20' } = req.query
  let query = supabase.from('orders')
    .select('*, profiles(full_name, phone), order_items(count)', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (q) query = query.or(`id.ilike.%${q}%`)

  const pageNum = Math.max(1, Number(page))
  const limitNum = Math.min(100, Number(limit))
  query = query.range((pageNum - 1) * limitNum, pageNum * limitNum - 1)

  const { data, error, count } = await query
  if (error) return res.status(500).json({ data: null, error: error.message })
  res.json({ data, meta: { total: count, page: pageNum, limit: limitNum }, error: null })
})

// PATCH /api/orders/admin/:id — update status + tracking
router.patch('/admin/:id', requireAdmin, validate(z.object({
  status:          z.enum(['confirmed','processing','shipped','delivered','cancelled']).optional(),
  tracking_number: z.string().optional(),
  tracking_url:    z.string().url().optional(),
})), async (req: AuthRequest, res) => {
  const { data: order, error } = await supabase.from('orders')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })

  // Trigger email + notification on status change
  const { data: { user } } = await supabase.auth.admin.getUserById(order.user_id)
  const email = user?.email
  if (req.body.status === 'shipped' && email) {
    await sendOrderShipped(email, order)
    await supabase.from('notifications').insert({
      user_id: order.user_id, type: 'order_update',
      title: 'Order Shipped', body: `Your order #${order.id.slice(0,8).toUpperCase()} has been shipped!`,
      link: `/account/orders/${order.id}`,
    })
  }
  if (req.body.status === 'delivered' && email) {
    await sendOrderDelivered(email, order)
    await supabase.from('notifications').insert({
      user_id: order.user_id, type: 'order_update',
      title: 'Order Delivered', body: `Your order #${order.id.slice(0,8).toUpperCase()} has been delivered!`,
      link: `/account/orders/${order.id}`,
    })
  }

  res.json({ data: order, error: null })
})

// POST /api/orders/admin/:id/refund
router.post('/admin/:id/refund', requireAdmin, async (req, res) => {
  const { data: order } = await supabase.from('orders')
    .select('*').eq('id', req.params.id).single()
  if (!order?.razorpay_payment_id) return res.status(400).json({ data: null, error: 'No payment to refund' })

  try {
    const refund = await razorpay.payments.refund(order.razorpay_payment_id, {
      amount: Math.round(Number(order.total) * 100),
    })
    await supabase.from('orders')
      .update({ status: 'refunded', updated_at: new Date().toISOString() })
      .eq('id', order.id)

    const { data: { user } } = await supabase.auth.admin.getUserById(order.user_id)
    if (user?.email) await sendRefundProcessed(user.email, order, Number(order.total))

    res.json({ data: refund, error: null })
  } catch (err: any) {
    res.status(500).json({ data: null, error: err.message })
  }
})

export default router
