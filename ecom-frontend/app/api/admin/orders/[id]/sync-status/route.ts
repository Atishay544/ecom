import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { trackCarrierShipment } from '@/lib/carriers'
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

// Delhivery status strings that indicate the shipment is gone / terminal
const CANCELLED_KEYWORDS = ['cancel', 'rto', 'return', 'lost', 'not found', 'no such', 'undelivered']
const DELIVERED_KEYWORDS = ['delivered', 'dl']

function classifyStatus(raw: string): 'cancelled' | 'delivered' | 'shipped' | null {
  const s = raw.toLowerCase()
  if (CANCELLED_KEYWORDS.some(k => s.includes(k))) return 'cancelled'
  if (DELIVERED_KEYWORDS.some(k => s.includes(k)))  return 'delivered'
  if (s.includes('transit') || s.includes('pickup') || s.includes('inscan') || s.includes('manifested')) return 'shipped'
  return null
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: orderId } = await params

  const { data: order } = await admin
    .from('orders')
    .select('status, metadata, delivery_partner, delivery_awb')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (!(order as any).delivery_awb) return NextResponse.json({ error: 'No AWB on this order' }, { status: 400 })

  const { data: carrier } = await admin
    .from('delivery_partners' as any)
    .select('*')
    .ilike('display_name', (order as any).delivery_partner ?? '')
    .eq('is_active', true)
    .single()

  if (!carrier) return NextResponse.json({ error: 'Carrier config not found' }, { status: 404 })

  // Fetch live tracking from Delhivery
  const tracking = await trackCarrierShipment(carrier as CarrierConfig, (order as any).delivery_awb)
  const liveStatus = tracking.status ?? ''
  const classified = classifyStatus(liveStatus)

  const update: Record<string, any> = {
    updated_at: new Date().toISOString(),
    metadata: {
      ...((order.metadata as Record<string, any>) ?? {}),
      tracking_status:     liveStatus,
      tracking_updated_at: new Date().toISOString(),
    },
  }

  const terminalStatuses = new Set(['delivered', 'refunded'])
  if (classified && !terminalStatuses.has(order.status)) {
    update.status = classified
  }

  // Shipment is cancelled on Delhivery — clear all delivery fields
  if (classified === 'cancelled') {
    update.delivery_awb     = null
    update.delivery_partner = null
    update.delivery_service = null
    update.delivery_rate    = null
  }

  await admin.from('orders').update(update).eq('id', orderId)

  return NextResponse.json({
    ok:          true,
    liveStatus,
    classified,
    cleared:     classified === 'cancelled',
  })
}
