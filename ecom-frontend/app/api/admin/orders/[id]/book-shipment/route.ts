import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { createDelhiveryShipment } from '@/lib/delhivery'

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

export async function POST(req: NextRequest, { params }: PageProps) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!process.env.DELHIVERY_API_TOKEN) {
    return NextResponse.json({ error: 'DELHIVERY_API_TOKEN not configured' }, { status: 503 })
  }

  const { id } = await params
  const body = await req.json()
  const shippingMode: 'Surface' | 'Express' = body.shipping_mode === 'Express' ? 'Express' : 'Surface'

  // Fetch full order details
  const { data: order } = await admin
    .from('orders')
    .select('id, total, status, metadata, shipping_address, order_items(quantity, unit_price, snapshot), created_at')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const addr    = (order as any).shipping_address as Record<string, string> ?? {}
  const meta    = ((order as any).metadata ?? {}) as Record<string, any>
  const items   = ((order as any).order_items ?? []) as any[]
  const pm      = meta.payment_method ?? 'online'
  const isCOD   = pm === 'cod' || pm === 'cod_upfront'

  // COD amount = amount to collect on delivery
  const codAmount = isCOD ? (meta.amount_on_delivery ?? (order as any).total ?? 0) : 0

  // Total weight from snapshots (fallback 500g per item)
  const weightGrams = items.reduce((sum: number, item: any) => {
    return sum + ((item.snapshot?.weight_grams ?? 500) * (item.quantity ?? 1))
  }, 0)

  const productDesc = items
    .map((i: any) => `${i.snapshot?.name ?? 'Product'} x${i.quantity}`)
    .join(', ')
    .slice(0, 100)

  // Fetch customer name from auth
  let customerName = addr.name ?? 'Customer'
  let customerPhone = addr.phone ?? ''
  try {
    const userRes = await admin.auth.admin.getUserById((order as any).user_id ?? '')
    const profile = await admin.from('profiles').select('full_name, phone').eq('id', (order as any).user_id ?? '').maybeSingle()
    customerName  = (profile.data as any)?.full_name ?? userRes.data.user?.user_metadata?.full_name ?? addr.name ?? 'Customer'
    customerPhone = (profile.data as any)?.phone ?? addr.phone ?? ''
  } catch { /* use address fallback */ }

  const result = await createDelhiveryShipment({
    orderId:       id,
    orderDate:     new Date((order as any).created_at).toISOString(),
    customerName,
    customerPhone,
    address:       [addr.line1, addr.line2].filter(Boolean).join(', '),
    city:          addr.city ?? '',
    state:         addr.state ?? '',
    pincode:       addr.pincode ?? addr.zip ?? '',
    paymentMode:   isCOD ? 'COD' : 'Prepaid',
    codAmount:     Number(codAmount),
    totalAmount:   Number((order as any).total ?? 0),
    productDesc,
    weightGrams:   Math.max(500, weightGrams),
    shippingMode,
    items:         items.map((i: any) => ({ name: i.snapshot?.name ?? 'Product', qty: i.quantity ?? 1 })),
  })

  if (!result.success || !result.waybill) {
    console.error('Delhivery shipment creation failed:', result.error, result.raw)
    return NextResponse.json({ error: result.error ?? 'Shipment creation failed' }, { status: 400 })
  }

  // Save AWB + partner details to order
  await admin.from('orders').update({
    delivery_awb:     result.waybill,
    delivery_partner: 'Delhivery',
    delivery_service: shippingMode,
    updated_at:       new Date().toISOString(),
  }).eq('id', id)

  return NextResponse.json({ waybill: result.waybill })
}
