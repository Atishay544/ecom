import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { requireAdmin } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { z } from 'zod'

const router = Router()

// ── CUSTOMERS ─────────────────────────────────────────────

router.get('/customers', requireAdmin, async (req, res) => {
  const { q, page = '1', limit = '20' } = req.query
  let query = supabase.from('profiles')
    .select('*, orders(count)', { count: 'exact' })
    .order('created_at', { ascending: false })
  if (q) query = query.ilike('full_name', `%${q}%`)
  const pageNum = Number(page), limitNum = Number(limit)
  query = query.range((pageNum-1)*limitNum, pageNum*limitNum-1)
  const { data, error, count } = await query
  if (error) return res.status(500).json({ data: null, error: error.message })
  res.json({ data, meta: { total: count, page: pageNum, limit: limitNum }, error: null })
})

router.get('/customers/:id', requireAdmin, async (req, res) => {
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', req.params.id).single()
  const { data: orders }  = await supabase.from('orders').select('*, order_items(count)').eq('user_id', req.params.id).order('created_at', { ascending: false })
  res.json({ data: { ...profile, orders }, error: null })
})

router.patch('/customers/:id/block', requireAdmin, async (req, res) => {
  await supabase.auth.admin.updateUserById(req.params.id, { ban_duration: '876600h' }) // ~100 years
  res.json({ data: { blocked: true }, error: null })
})

router.patch('/customers/:id/unblock', requireAdmin, async (req, res) => {
  await supabase.auth.admin.updateUserById(req.params.id, { ban_duration: 'none' })
  res.json({ data: { unblocked: true }, error: null })
})

// ── COUPONS ───────────────────────────────────────────────

router.get('/coupons', requireAdmin, async (_req, res) => {
  const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
  res.json({ data, error: error?.message ?? null })
})

router.post('/coupons', requireAdmin, validate(z.object({
  code:       z.string().min(3).max(20).toUpperCase(),
  type:       z.enum(['percentage', 'flat']),
  value:      z.number().min(1),
  min_order:  z.number().min(0).default(0),
  max_uses:   z.number().int().optional(),
  expires_at: z.string().datetime().optional(),
  is_active:  z.boolean().default(true),
})), async (req, res) => {
  const { data, error } = await supabase.from('coupons').insert(req.body).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.status(201).json({ data, error: null })
})

router.patch('/coupons/:id', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('coupons').update(req.body).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.json({ data, error: null })
})

router.delete('/coupons/:id', requireAdmin, async (req, res) => {
  await supabase.from('coupons').delete().eq('id', req.params.id)
  res.json({ data: { deleted: true }, error: null })
})

// ── ANNOUNCEMENTS ─────────────────────────────────────────

router.get('/announcements', requireAdmin, async (_req, res) => {
  const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
  res.json({ data, error: null })
})

router.post('/announcements', requireAdmin, validate(z.object({
  message:    z.string().min(1),
  link_url:   z.string().url().optional(),
  link_text:  z.string().optional(),
  bg_color:   z.string().default('#000000'),
  text_color: z.string().default('#ffffff'),
  is_active:  z.boolean().default(false),
  starts_at:  z.string().datetime().optional(),
  ends_at:    z.string().datetime().optional(),
})), async (req, res) => {
  const { data, error } = await supabase.from('announcements').insert(req.body).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.status(201).json({ data, error: null })
})

router.patch('/announcements/:id', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('announcements').update(req.body).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.json({ data, error: null })
})

router.delete('/announcements/:id', requireAdmin, async (req, res) => {
  await supabase.from('announcements').delete().eq('id', req.params.id)
  res.json({ data: { deleted: true }, error: null })
})

// ── REVIEWS ───────────────────────────────────────────────

router.get('/reviews', requireAdmin, async (req, res) => {
  const { status = 'pending' } = req.query
  const { data } = await supabase.from('reviews')
    .select('*, products(name, slug), profiles(full_name)')
    .eq('status', status).order('created_at')
  res.json({ data, error: null })
})

router.patch('/reviews/:id', requireAdmin, validate(z.object({
  status: z.enum(['approved', 'rejected']),
})), async (req, res) => {
  const { data, error } = await supabase.from('reviews').update(req.body).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.json({ data, error: null })
})

// ── REPORTS ───────────────────────────────────────────────

router.get('/reports/sales', requireAdmin, async (req, res) => {
  const { from, to } = req.query
  const { data } = await supabase.from('orders')
    .select('created_at, total, status')
    .neq('status', 'cancelled')
    .gte('created_at', from ?? new Date(Date.now() - 30*86400000).toISOString())
    .lte('created_at', to ?? new Date().toISOString())
    .order('created_at')
  const revenue = data?.reduce((s, o) => s + Number(o.total), 0) ?? 0
  res.json({ data, meta: { total_revenue: revenue, order_count: data?.length }, error: null })
})

router.get('/reports/top-products', requireAdmin, async (_req, res) => {
  const { data } = await supabase.from('order_items')
    .select('product_id, quantity, snapshot')
    .limit(200)
  // Aggregate in-memory
  const totals: Record<string, { name: string; qty: number; revenue: number }> = {}
  data?.forEach((i: any) => {
    if (!totals[i.product_id]) totals[i.product_id] = { name: i.snapshot?.name, qty: 0, revenue: 0 }
    totals[i.product_id].qty += i.quantity
    totals[i.product_id].revenue += Number(i.unit_price ?? 0) * i.quantity
  })
  const sorted = Object.entries(totals).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10)
    .map(([id, v]) => ({ product_id: id, ...v }))
  res.json({ data: sorted, error: null })
})

router.get('/reports/customers', requireAdmin, async (_req, res) => {
  const { data } = await supabase.from('profiles')
    .select('created_at').order('created_at')
  res.json({ data, error: null })
})

export default router
