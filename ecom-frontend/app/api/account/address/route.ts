import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ address: null })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ address: null })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('saved_address')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ address: (profile as any)?.saved_address ?? null })
}
