import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
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

  const { data, error } = await admin.from('announcements').insert({
    message:    body.message?.trim(),
    bg_color:   body.bg_color   ?? '#000000',
    text_color: body.text_color ?? '#ffffff',
    link_url:   body.link_url?.trim()  || null,
    link_text:  body.link_text?.trim() || null,
    is_active:  body.is_active ?? true,
    starts_at:  body.starts_at || null,
    ends_at:    body.ends_at   || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidateTag('announcements')
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, ...fields } = body

  const { error } = await admin.from('announcements').update(fields).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidateTag('announcements')
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const { error } = await admin.from('announcements').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidateTag('announcements')
  return NextResponse.json({ success: true })
}
