import { Router } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// GET /api/search?q=keyword
router.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim()
  if (!q) return res.json({ data: { products: [], categories: [] }, error: null })

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products').select('id, name, slug, price, images')
      .ilike('name', `%${q}%`).eq('is_active', true).limit(10),
    supabase.from('categories').select('id, name, slug')
      .ilike('name', `%${q}%`).limit(5),
  ])

  res.json({ data: { products, categories }, error: null })
})

export default router
