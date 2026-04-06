import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { requireAdmin } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { z } from 'zod'

const router = Router()

const CategorySchema = z.object({
  name:       z.string().min(1).max(100),
  slug:       z.string().min(1).regex(/^[a-z0-9-]+$/),
  parent_id:  z.string().uuid().optional().nullable(),
  image_url:  z.string().url().optional().nullable(),
  sort_order: z.number().int().default(0),
})

// GET /api/categories — returns nested tree
router.get('/', async (_req, res) => {
  const { data, error } = await supabase.from('categories')
    .select('*').order('sort_order')
  if (error) return res.status(500).json({ data: null, error: error.message })

  // Build nested tree
  const map = new Map<string, any>()
  const roots: any[] = []
  data.forEach(c => map.set(c.id, { ...c, children: [] }))
  data.forEach(c => {
    if (c.parent_id) map.get(c.parent_id)?.children.push(map.get(c.id))
    else roots.push(map.get(c.id))
  })
  res.json({ data: roots, error: null })
})

// POST /api/categories (admin)
router.post('/', requireAdmin, validate(CategorySchema), async (req, res) => {
  const { data, error } = await supabase.from('categories').insert(req.body).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.status(201).json({ data, error: null })
})

// PUT /api/categories/:id (admin)
router.put('/:id', requireAdmin, validate(CategorySchema.partial()), async (req, res) => {
  const { data, error } = await supabase.from('categories').update(req.body).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.json({ data, error: null })
})

// DELETE /api/categories/:id (admin)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('categories').delete().eq('id', req.params.id)
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.json({ data: { deleted: true }, error: null })
})

export default router
