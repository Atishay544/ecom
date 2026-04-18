import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { delhiveryCreateWarehouse, delhiveryUpdateWarehouse } from '@/lib/carriers'
import type { CarrierConfig } from '@/lib/carriers'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  if (user.app_metadata?.role === 'admin') return admin
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return admin
}

async function getDelhiveryCarrier(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin
    .from('delivery_partners' as any)
    .select('*')
    .eq('name', 'delhivery')
    .eq('is_active', true)
    .single()
  return data as CarrierConfig | null
}

/** POST — create a new warehouse */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const carrier = await getDelhiveryCarrier(admin)
  if (!carrier) return NextResponse.json({ error: 'Delhivery carrier not configured' }, { status: 404 })
  if (!carrier.api_key) return NextResponse.json({ error: 'Delhivery API key not set' }, { status: 400 })

  const body = await req.json()
  const { warehouse_name, address, pin, city, state, phone, gst_tin, contact_person, email } = body

  if (!warehouse_name || !address || !pin || !city || !state || !phone || !contact_person) {
    return NextResponse.json({ error: 'warehouse_name, address, pin, city, state, phone, contact_person are required' }, { status: 400 })
  }

  const result = await delhiveryCreateWarehouse(carrier, { warehouse_name, address, pin, city, state, phone, gst_tin, contact_person, email })
  return NextResponse.json(result)
}

/** PATCH — update an existing warehouse */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const carrier = await getDelhiveryCarrier(admin)
  if (!carrier) return NextResponse.json({ error: 'Delhivery carrier not configured' }, { status: 404 })
  if (!carrier.api_key) return NextResponse.json({ error: 'Delhivery API key not set' }, { status: 400 })

  const body = await req.json()
  if (!body.warehouse_name) return NextResponse.json({ error: 'warehouse_name is required' }, { status: 400 })

  const result = await delhiveryUpdateWarehouse(carrier, body)
  return NextResponse.json(result)
}
