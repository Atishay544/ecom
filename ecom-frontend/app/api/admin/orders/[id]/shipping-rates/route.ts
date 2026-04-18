import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { getAllCarrierRates } from '@/lib/carriers'
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

interface PageProps { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: PageProps) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const [{ data: order }, { data: partners }] = await Promise.all([
    admin.from('orders').select('shipping_address, total, metadata, order_items(quantity, snapshot)').eq('id', id).single(),
    admin.from('delivery_partners' as any).select('*').eq('is_active', true),
  ])

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const addr       = (order as any).shipping_address as Record<string, string> ?? {}
  const meta       = ((order as any).metadata ?? {}) as Record<string, any>
  const toPin      = addr.pincode ?? addr.zip ?? ''
  const isCOD      = meta.payment_method === 'cod' || meta.payment_method === 'cod_upfront'
  const orderItems = (order as any).order_items ?? []

  const weightGrams = orderItems.reduce((sum: number, item: any) =>
    sum + ((item.snapshot?.weight_grams ?? 500) * (item.quantity ?? 1)), 0)
  const weightKg = Math.max(0.5, weightGrams / 1000)

  const carriers = (partners ?? []) as CarrierConfig[]

  // Get pickup pincode from first carrier with one configured
  const fromPin = carriers.find(c => c.pickup_pincode)?.pickup_pincode ?? ''

  if (!toPin) {
    return NextResponse.json({ rates: [], toPin, weightKg, warning: 'No delivery pincode found in shipping address' })
  }

  if (carriers.length === 0) {
    return NextResponse.json({ rates: [], toPin, weightKg, warning: 'No delivery partners configured. Add one in Settings → Delivery Partners.' })
  }

  const rates = await getAllCarrierRates(carriers, fromPin, toPin, weightGrams, isCOD)

  return NextResponse.json({ rates, toPin, weightKg })
}
