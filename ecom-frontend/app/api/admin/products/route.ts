import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  // Fast-path: role in JWT app_metadata avoids a DB round-trip
  if (user.app_metadata?.role === 'admin') return admin
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return admin
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { variants, ...productData } = body

  const { data: product, error } = await admin
    .from('products')
    .insert({
      name:          productData.name?.trim(),
      slug:          productData.slug?.trim(),
      description:   productData.description?.trim() || null,
      price:         parseFloat(productData.price),
      compare_price: productData.compare_price ? parseFloat(productData.compare_price) : null,
      stock:         parseInt(productData.stock, 10),
      category_id:   productData.category_id || null,
      is_active:     productData.is_active ?? true,
      images:        productData.images ?? [],
      video_url:     productData.video_url || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Save variants (needs product.id — must be sequential)
  if (variants && variants.length > 0 && product) {
    const rows = variants
      .filter((v: any) => v.name?.trim() && v.options?.length > 0)
      .map((v: any) => ({
        product_id: product.id,
        name:       v.name.trim(),
        options:    v.options,
      }))
    if (rows.length > 0) {
      await admin.from('product_variants').insert(rows)
    }
  }

  return NextResponse.json({ data: product })
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, variants, ...fields } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const payload: Record<string, any> = {}
  if (fields.name          !== undefined) payload.name          = fields.name.trim()
  if (fields.slug          !== undefined) payload.slug          = fields.slug.trim()
  if (fields.description   !== undefined) payload.description   = fields.description?.trim() || null
  if (fields.price         !== undefined) payload.price         = parseFloat(fields.price)
  if (fields.compare_price !== undefined) payload.compare_price = fields.compare_price ? parseFloat(fields.compare_price) : null
  if (fields.stock         !== undefined) payload.stock         = parseInt(fields.stock, 10)
  if (fields.category_id   !== undefined) payload.category_id   = fields.category_id || null
  if (fields.is_active     !== undefined) payload.is_active     = fields.is_active
  if (fields.images        !== undefined) payload.images        = fields.images
  if (fields.video_url     !== undefined) payload.video_url     = fields.video_url || null
  payload.updated_at = new Date().toISOString()

  // Precompute variant rows before parallel execution
  const variantRows = variants !== undefined
    ? (variants as any[])
        .filter(v => v.name?.trim() && v.options?.length > 0)
        .map(v => ({ product_id: id, name: v.name.trim(), options: v.options }))
    : []

  // Parallel: update product fields + delete old variants (independent operations)
  const [{ error }, deleteResult] = await Promise.all([
    admin.from('products').update(payload).eq('id', id),
    variants !== undefined
      ? admin.from('product_variants').delete().eq('product_id', id)
      : Promise.resolve({ error: null }),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (deleteResult?.error) return NextResponse.json({ error: deleteResult.error.message }, { status: 400 })

  // Insert new variants after delete completes
  if (variants !== undefined && variantRows.length > 0) {
    await admin.from('product_variants').insert(variantRows)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const { error } = await admin.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
