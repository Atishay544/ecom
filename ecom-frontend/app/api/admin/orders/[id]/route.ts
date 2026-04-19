import { adminGuard } from '@/lib/security/admin-guard'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { revalidateTag } from 'next/cache'

const ALLOWED_STATUSES = new Set([
  'pending', 'confirmed', 'cod_upfront_paid', 'processing',
  'shipped', 'delivered', 'cancelled', 'refunded',
])


interface PageProps { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: PageProps) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  const payload: Record<string, any> = { updated_at: new Date().toISOString() }

  if (body.status !== undefined) {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    payload.status = body.status
  }
  if ('tracking_number' in body) {
    payload.tracking_number = body.tracking_number?.trim() || null
  }

  const { error } = await admin.from('orders').update(payload).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  revalidateTag('orders')
  return NextResponse.json({ ok: true })
}
