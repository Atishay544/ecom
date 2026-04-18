import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import DeliveryDashboard from './DeliveryChart'
import type { DayPoint, PartnerStat, OutForDeliveryOrder, DeliveryOrder } from './DeliveryChart'

export const metadata = { title: 'Delivery Analytics' }

export default async function DeliveryPage() {
  await requireAdmin()
  const supabase = createAdminClient()

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all orders with delivery info from last 90 days
  const { data: rawOrders } = await (supabase as any)
    .from('orders')
    .select('id, status, total, metadata, shipping_address, delivery_partner, delivery_awb, delivery_rate, delivery_service, created_at, user_id')
    .gte('created_at', ninetyDaysAgo)
    .not('delivery_partner', 'is', null)
    .order('created_at', { ascending: false })

  // Fetch active delivery partners
  const { data: rawPartners } = await (supabase as any)
    .from('delivery_partners')
    .select('id, display_name')
    .eq('is_active', true)
    .order('display_name', { ascending: true })

  // Fetch customer profiles for orders
  const orders = (rawOrders ?? []) as any[]
  const userIds = [...new Set(orders.map((o: any) => o.user_id).filter(Boolean))]
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, phone').in('id', userIds as string[])
    : { data: [] }
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

  const partners: string[] = (rawPartners ?? []).map((p: any) => p.display_name)

  // ── Build structured orders ─────────────────────────────────────────────────
  const deliveryOrders: DeliveryOrder[] = orders.map((o: any) => {
    const addr    = (o.shipping_address ?? {}) as Record<string, string>
    const meta    = (o.metadata ?? {}) as Record<string, any>
    const profile = profileMap.get(o.user_id)
    const name    = profile?.full_name ?? addr.name ?? 'Customer'
    const phone   = profile?.phone ?? addr.phone ?? ''
    return {
      id:             o.id,
      orderId:        o.id,
      awb:            o.delivery_awb ?? null,
      partner:        o.delivery_partner ?? null,
      service:        o.delivery_service ?? null,
      status:         o.status,
      customerName:   name,
      customerPhone:  phone,
      total:          Number(o.total ?? 0),
      deliveryCost:   Number(o.delivery_rate ?? 0),
      date:           (o.created_at as string).slice(0, 10),
      trackingStatus: meta.tracking_status ?? null,
    }
  })

  // ── Stat aggregation ────────────────────────────────────────────────────────
  const shippedOrders = deliveryOrders.filter(o => o.awb)
  const inTransit     = shippedOrders.filter(o => o.status === 'shipped')
  const delivered     = shippedOrders.filter(o => o.status === 'delivered')
  const returned      = shippedOrders.filter(o => o.status === 'cancelled' || o.status === 'refunded')
  const outOfd        = shippedOrders.filter(o =>
    o.trackingStatus?.toLowerCase().includes('out') ||
    o.trackingStatus?.toLowerCase().includes('ofd')
  )

  const totalCost    = shippedOrders.reduce((s, o) => s + o.deliveryCost, 0)
  const totalRevenue = delivered.reduce((s, o) => s + o.total, 0)
  const successRate  = shippedOrders.length > 0
    ? Math.round((delivered.length / (delivered.length + returned.length || 1)) * 100)
    : 0

  const totalStats = {
    totalShipped:    shippedOrders.length,
    inTransit:       inTransit.length,
    outForDelivery:  outOfd.length,
    delivered:       delivered.length,
    returned:        returned.length,
    totalCost,
    totalRevenue,
    successRate,
    avgCost:         shippedOrders.length > 0 ? totalCost / shippedOrders.length : 0,
  }

  // ── Out for delivery with phone ─────────────────────────────────────────────
  const outForDelivery: OutForDeliveryOrder[] = outOfd.map(o => ({
    id:            o.id,
    orderId:       o.orderId,
    awb:           o.awb ?? '',
    partner:       o.partner ?? '',
    customerName:  o.customerName,
    customerPhone: o.customerPhone,
    total:         o.total,
    deliveryCost:  o.deliveryCost,
  }))

  // ── Per-partner stats ───────────────────────────────────────────────────────
  const partnerMap = new Map<string, { shipped: number; delivered: number; inTransit: number; returned: number; totalCost: number }>()
  for (const o of shippedOrders) {
    const key = o.partner ?? 'Unknown'
    if (!partnerMap.has(key)) partnerMap.set(key, { shipped: 0, delivered: 0, inTransit: 0, returned: 0, totalCost: 0 })
    const ps = partnerMap.get(key)!
    ps.shipped++
    ps.totalCost += o.deliveryCost
    if (o.status === 'delivered') ps.delivered++
    else if (o.status === 'shipped') ps.inTransit++
    else if (o.status === 'cancelled' || o.status === 'refunded') ps.returned++
  }

  const partnerStats: PartnerStat[] = [...partnerMap.entries()].map(([name, ps]) => ({
    name,
    shipped:     ps.shipped,
    delivered:   ps.delivered,
    inTransit:   ps.inTransit,
    returned:    ps.returned,
    totalCost:   ps.totalCost,
    successRate: ps.shipped > 0 ? Math.round((ps.delivered / (ps.delivered + ps.returned || 1)) * 100) : 0,
  })).sort((a, b) => b.shipped - a.shipped)

  // ── Time series — last 90 days ──────────────────────────────────────────────
  const dayMap = new Map<string, DayPoint>()
  const today  = new Date()
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10)
    dayMap.set(d, { date: d, revenue: 0, deliveryCost: 0, returns: 0, shipped: 0 })
  }

  for (const o of shippedOrders) {
    const dp = dayMap.get(o.date)
    if (!dp) continue
    dp.shipped++
    dp.deliveryCost += o.deliveryCost
    if (o.status === 'delivered') dp.revenue += o.total
    if (o.status === 'cancelled' || o.status === 'refunded') dp.returns += o.total
  }

  const timeSeries = [...dayMap.values()]

  return (
    <DeliveryDashboard
      partners={partners}
      timeSeries={timeSeries}
      partnerStats={partnerStats}
      outForDelivery={outForDelivery}
      orders={deliveryOrders}
      totalStats={totalStats}
    />
  )
}
