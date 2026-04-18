import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const STATUS_MAP: Record<string, string> = {
  'In Transit':         'shipped',
  'Dispatched':         'shipped',
  'Out for Delivery':   'shipped',
  'Delivered':          'delivered',
  'RTO Initiated':      'cancelled',
  'RTO Delivered':      'cancelled',
  'Returned to Origin': 'cancelled',
  'Lost':               'cancelled',
}

export async function POST(req: NextRequest) {
  let payload: any
  try { payload = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const shipment = payload?.ShipmentData?.[0]?.Shipment ?? payload
  const waybill  = shipment?.AWB ?? shipment?.waybill
  const dlvStatus = shipment?.Status?.Status ?? shipment?.status

  if (!waybill) return NextResponse.json({ received: true })

  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('id, status, metadata')
    .eq('delivery_awb', waybill)
    .maybeSingle()

  if (!order) return NextResponse.json({ received: true })

  const currentMeta = ((order as any).metadata ?? {}) as Record<string, any>
  const newStatus   = dlvStatus ? STATUS_MAP[dlvStatus] : null
  const scans       = shipment?.Scans ?? []
  const latest      = scans[0]

  const update: Record<string, any> = {
    metadata: {
      ...currentMeta,
      ...(dlvStatus    ? { tracking_status: dlvStatus } : {}),
      ...(latest       ? {
        tracking_location: latest.ScanDetail?.ScannedLocation ?? '',
        tracking_updated:  latest.ScanDateTime ?? new Date().toISOString(),
      } : {}),
    },
    updated_at: new Date().toISOString(),
  }

  if (newStatus && newStatus !== (order as any).status) {
    update.status = newStatus
  }

  await admin.from('orders').update(update).eq('id', (order as any).id)

  return NextResponse.json({ received: true })
}
