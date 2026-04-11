import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('offers')
    .select('id, title, description, type, upfront_pct, discount_pct, sort_order')
    .eq('is_active', true)
    .order('sort_order')
  return NextResponse.json({ data: data ?? [] })
}
