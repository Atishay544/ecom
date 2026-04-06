import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { z } from 'zod'

const router = Router()

// ── NOTIFICATIONS ────────────────────────────────────────

router.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  const { data } = await supabase.from('notifications')
    .select('*').eq('user_id', req.user!.id).order('created_at', { ascending: false }).limit(50)
  res.json({ data, error: null })
})

router.patch('/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', req.user!.id)
  res.json({ data: { updated: true }, error: null })
})

router.patch('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  await supabase.from('notifications').update({ is_read: true })
    .eq('id', req.params.id).eq('user_id', req.user!.id)
  res.json({ data: { updated: true }, error: null })
})

// ── WISHLIST ─────────────────────────────────────────────

router.get('/wishlist', requireAuth, async (req: AuthRequest, res) => {
  const { data } = await supabase.from('wishlist_items')
    .select('*, products(id, name, slug, price, images, stock)')
    .eq('user_id', req.user!.id)
  res.json({ data, error: null })
})

router.post('/wishlist', requireAuth, validate(z.object({
  product_id: z.string().uuid(),
})), async (req: AuthRequest, res) => {
  const { data, error } = await supabase.from('wishlist_items')
    .upsert({ user_id: req.user!.id, product_id: req.body.product_id }, { onConflict: 'user_id,product_id' })
    .select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.status(201).json({ data, error: null })
})

router.delete('/wishlist/:product_id', requireAuth, async (req: AuthRequest, res) => {
  await supabase.from('wishlist_items').delete()
    .eq('user_id', req.user!.id).eq('product_id', req.params.product_id)
  res.json({ data: { deleted: true }, error: null })
})

// ── ADDRESSES ─────────────────────────────────────────────

const AddressSchema = z.object({
  label:       z.string().optional(),
  full_name:   z.string().min(2),
  line1:       z.string().min(3),
  line2:       z.string().optional(),
  city:        z.string().min(2),
  state:       z.string().min(2),
  postal_code: z.string().min(3),
  country:     z.string().default('IN'),
  phone:       z.string().optional(),
  is_default:  z.boolean().default(false),
})

router.get('/addresses', requireAuth, async (req: AuthRequest, res) => {
  const { data } = await supabase.from('addresses').select('*')
    .eq('user_id', req.user!.id).order('is_default', { ascending: false })
  res.json({ data, error: null })
})

router.post('/addresses', requireAuth, validate(AddressSchema), async (req: AuthRequest, res) => {
  if (req.body.is_default) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', req.user!.id)
  }
  const { data, error } = await supabase.from('addresses')
    .insert({ ...req.body, user_id: req.user!.id }).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.status(201).json({ data, error: null })
})

router.put('/addresses/:id', requireAuth, validate(AddressSchema.partial()), async (req: AuthRequest, res) => {
  if (req.body.is_default) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', req.user!.id)
  }
  const { data, error } = await supabase.from('addresses').update(req.body)
    .eq('id', req.params.id).eq('user_id', req.user!.id).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.json({ data, error: null })
})

router.delete('/addresses/:id', requireAuth, async (req: AuthRequest, res) => {
  await supabase.from('addresses').delete().eq('id', req.params.id).eq('user_id', req.user!.id)
  res.json({ data: { deleted: true }, error: null })
})

// ── REVIEWS ───────────────────────────────────────────────

router.get('/reviews', requireAuth, async (req: AuthRequest, res) => {
  const { data } = await supabase.from('reviews')
    .select('*, products(name, slug)').eq('user_id', req.user!.id)
  res.json({ data, error: null })
})

router.post('/reviews', requireAuth, validate(z.object({
  product_id: z.string().uuid(),
  rating:     z.number().int().min(1).max(5),
  title:      z.string().max(100).optional(),
  body:       z.string().max(2000).optional(),
})), async (req: AuthRequest, res) => {
  const { data, error } = await supabase.from('reviews')
    .upsert({ ...req.body, user_id: req.user!.id, status: 'pending' }, { onConflict: 'product_id,user_id' })
    .select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.status(201).json({ data, error: null })
})

// ── ANNOUNCEMENTS (public) ────────────────────────────────

router.get('/announcements', async (_req, res) => {
  const { data } = await supabase.from('announcements').select('*')
    .eq('is_active', true)
    .or('starts_at.is.null,starts_at.lte.' + new Date().toISOString())
    .or('ends_at.is.null,ends_at.gte.' + new Date().toISOString())
    .order('created_at', { ascending: false }).limit(1)
  res.json({ data, error: null })
})

// ── CHAT ─────────────────────────────────────────────────

router.post('/chat/sessions', async (req, res) => {
  const { user_id, guest_name, guest_email } = req.body
  const { data, error } = await supabase.from('chat_sessions')
    .insert({ user_id, guest_name, guest_email }).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.status(201).json({ data, error: null })
})

router.post('/chat/messages', async (req, res) => {
  const { session_id, sender_id, sender_role, body } = req.body
  const { data, error } = await supabase.from('chat_messages')
    .insert({ session_id, sender_id, sender_role, body }).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.status(201).json({ data, error: null })
})

router.get('/chat/sessions/admin', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ data: null, error: 'Forbidden' })
  const { status = 'open' } = req.query
  const { data } = await supabase.from('chat_sessions')
    .select('*, chat_messages(count)').eq('status', status).order('created_at', { ascending: false })
  res.json({ data, error: null })
})

router.patch('/chat/sessions/:id', requireAuth, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ data: null, error: 'Forbidden' })
  const { data, error } = await supabase.from('chat_sessions')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.json({ data, error: null })
})

export default router
