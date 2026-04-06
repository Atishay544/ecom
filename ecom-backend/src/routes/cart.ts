import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { z } from 'zod'

const router = Router()

// GET /api/cart
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const { data, error } = await supabase.from('cart_items')
    .select('*, products(id, name, slug, price, compare_price, images, stock)')
    .eq('user_id', req.user!.id)
  if (error) return res.status(500).json({ data: null, error: error.message })
  res.json({ data, error: null })
})

// POST /api/cart
router.post('/', requireAuth, validate(z.object({
  product_id: z.string().uuid(),
  quantity:   z.number().int().min(1).max(100),
})), async (req: AuthRequest, res) => {
  const { product_id, quantity } = req.body

  // Check stock
  const { data: product } = await supabase.from('products').select('stock').eq('id', product_id).single()
  if (!product || product.stock < quantity) {
    return res.status(400).json({ data: null, error: 'Insufficient stock' })
  }

  const { data, error } = await supabase.from('cart_items')
    .upsert({ user_id: req.user!.id, product_id, quantity }, { onConflict: 'user_id,product_id' })
    .select('*, products(id, name, price, images)').single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.status(201).json({ data, error: null })
})

// PATCH /api/cart/:product_id
router.patch('/:product_id', requireAuth, validate(z.object({
  quantity: z.number().int().min(1).max(100),
})), async (req: AuthRequest, res) => {
  const { data, error } = await supabase.from('cart_items')
    .update({ quantity: req.body.quantity })
    .eq('user_id', req.user!.id).eq('product_id', req.params.product_id)
    .select().single()
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.json({ data, error: null })
})

// DELETE /api/cart/:product_id
router.delete('/:product_id', requireAuth, async (req: AuthRequest, res) => {
  const { error } = await supabase.from('cart_items')
    .delete().eq('user_id', req.user!.id).eq('product_id', req.params.product_id)
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.json({ data: { deleted: true }, error: null })
})

// DELETE /api/cart (clear all)
router.delete('/', requireAuth, async (req: AuthRequest, res) => {
  const { error } = await supabase.from('cart_items').delete().eq('user_id', req.user!.id)
  if (error) return res.status(400).json({ data: null, error: error.message })
  res.json({ data: { cleared: true }, error: null })
})

export default router
