import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { requireAdmin } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { z } from 'zod'

const router = Router()

const ProductSchema = z.object({
  name:          z.string().min(1).max(255),
  slug:          z.string().min(1).regex(/^[a-z0-9-]+$/),
  description:   z.string().max(10000).optional(),
  price:         z.number().min(0),
  compare_price: z.number().min(0).optional(),
  stock:         z.number().int().min(0),
  category_id:   z.string().uuid().optional(),
  images:        z.array(z.string()).optional(),
  is_active:     z.boolean().default(true),
  metadata:      z.record(z.unknown()).optional(),
})

// GET /api/products
router.get('/', async (req, res) => {
  const { category, min_price, max_price, sort = 'created_at', order = 'desc', page = '1', limit = '20', q } = req.query

  let query = supabase.from('products').select(`*, categories(id, name, slug)`, { count: 'exact' })
    .eq('is_active', true)

  if (category) query = query.eq('category_id', category)
  if (min_price) query = query.gte('price', Number(min_price))
  if (max_price) query = query.lte('price', Number(max_price))
  if (q) query = query.ilike('name', `%${q}%`)

  const pageNum = Math.max(1, Number(page))
  const limitNum = Math.min(100, Math.max(1, Number(limit)))
  query = query.order(sort as string, { ascending: order === 'asc' })
    .range((pageNum - 1) * limitNum, pageNum * limitNum - 1)

  const { data, error, count } = await query
  if (error) return res.status(500).json({ data: null, error: error.message })
  res.json({ data, meta: { total: count, page: pageNum, limit: limitNum, pages: Math.ceil((count ?? 0) / limitNum) }, error: null })
})

// GET /api/products/:slug
router.get('/:slug', async (req, res) => {
  const { data, error } = await supabase.from('products')
    .select(`*, categories(id, name, slug), product_variants(*), reviews(*, profiles(full_name, avatar_url))`)
    .eq('slug', req.params.slug).eq('is_active', true).single()
  if (error) return res.status(404).json({ data: null, error: 'Product not found' })
  res.json({ data, error: null })
})

// POST /api/products (admin)
router.post('/', requireAdmin, validate(ProductSchema), async (req, res) => {
  const { data, error } = await supabase.from('products').insert(req.body).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.status(201).json({ data, error: null })
})

// PUT /api/products/:id (admin)
router.put('/:id', requireAdmin, validate(ProductSchema.partial()), async (req, res) => {
  const { data, error } = await supabase.from('products')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.json({ data, error: null })
})

// DELETE /api/products/:id (admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('products').delete().eq('id', req.params.id)
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.json({ data: { deleted: true }, error: null })
})

// GET /api/products/:id/image-upload-url (admin)
router.get('/:id/image-upload-url', requireAdmin, async (req, res) => {
  const { ext = 'jpg' } = req.query
  const path = `${req.params.id}/${Date.now()}.${ext}`
  const { data, error } = await supabase.storage.from('products').createSignedUploadUrl(path)
  if (error) return res.status(500).json({ data: null, error: error.message })
  res.json({ data, error: null })
})

export default router
