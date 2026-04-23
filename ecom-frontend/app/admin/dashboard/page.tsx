import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import DashboardChart, {
  type DashboardProps,
  type DayPoint,
  type RecentOrder,
  type LowStockProduct,
} from './DashboardChart'

export const metadata = { title: 'Dashboard' }

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

type OrderRow = {
  id: string; total: number | string; status: string
  created_at: string; shipping_address: unknown
}

function sumRev(rows: OrderRow[], from: Date, to: Date) {
  return rows
    .filter(r => { const d = new Date(r.created_at); return d >= from && d < to })
    .reduce((s, r) => s + (Number(r.total) || 0), 0)
}

function countIn(rows: OrderRow[], from: Date, to: Date) {
  return rows.filter(r => { const d = new Date(r.created_at); return d >= from && d < to }).length
}

export default async function DashboardPage() {
  await requireAdmin()
  const db = createAdminClient()

  const now      = new Date()
  const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 86400000)
  const d1       = daysAgo(1)
  const d7       = daysAgo(7)
  const d14      = daysAgo(14)
  const d30      = daysAgo(30)
  const d60      = daysAgo(60)

  const [
    ordersRes,
    recentRes,
    allStatusRes,
    profilesTotalRes,
    profilesNewRes,
    partnersRes,
    visitorsRes,
    visitorsTodayRes,
    lowStockRes,
  ] = await Promise.all([
    db.from('orders')
      .select('id, total, status, created_at, shipping_address')
      .gte('created_at', d60.toISOString())
      .order('created_at', { ascending: true }),

    db.from('orders')
      .select('id, total, status, created_at, shipping_address')
      .order('created_at', { ascending: false })
      .limit(8),

    db.from('orders').select('status'),

    db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),

    db.from('profiles').select('id', { count: 'exact', head: true })
      .eq('role', 'customer')
      .gte('created_at', d30.toISOString()),

    (db as any).from('delivery_partners').select('id', { count: 'exact', head: true }).eq('is_active', true),

    (db as any).from('page_views').select('id', { count: 'exact', head: true })
      .gte('created_at', d30.toISOString()),

    (db as any).from('page_views').select('id', { count: 'exact', head: true })
      .gte('created_at', today.toISOString()),

    db.from('products')
      .select('id, name, stock')
      .lte('stock', 5)
      .eq('is_active', true)
      .order('stock', { ascending: true })
      .limit(6),
  ])

  const orders60 = (ordersRes.data ?? []) as OrderRow[]

  // KPIs
  const revenueToday     = sumRev(orders60, today, tomorrow)
  const revenueYesterday = sumRev(orders60, d1,    today)
  const revenue7d        = sumRev(orders60, d7,    now)
  const revenuePrev7d    = sumRev(orders60, d14,   d7)
  const revenue30d       = sumRev(orders60, d30,   now)
  const revenuePrev30d   = sumRev(orders60, d60,   d30)

  const ordersToday      = countIn(orders60, today, tomorrow)
  const ordersYesterday  = countIn(orders60, d1,    today)
  const orders7d         = countIn(orders60, d7,    now)
  const ordersPrev7d     = countIn(orders60, d14,   d7)
  const orders30d        = countIn(orders60, d30,   now)
  const ordersPrev30d    = countIn(orders60, d60,   d30)

  const aov30d     = orders30d     > 0 ? revenue30d     / orders30d     : 0
  const aovPrev30d = ordersPrev30d > 0 ? revenuePrev30d / ordersPrev30d : 0

  // Daily series (30 days)
  const seriesMap = new Map<string, DayPoint>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    seriesMap.set(key, { date: key, revenue: 0, orders: 0 })
  }
  for (const o of orders60) {
    const key = o.created_at.slice(0, 10)
    const pt  = seriesMap.get(key)
    if (pt) { pt.revenue += Number(o.total) || 0; pt.orders++ }
  }
  const dailySeries: DayPoint[] = Array.from(seriesMap.values())

  // Status breakdown
  const ordersByStatus: Record<string, number> = {}
  for (const r of (allStatusRes.data ?? []) as { status: string }[]) {
    ordersByStatus[r.status] = (ordersByStatus[r.status] ?? 0) + 1
  }
  const pendingAction =
    (ordersByStatus['confirmed']        ?? 0) +
    (ordersByStatus['cod_upfront_paid'] ?? 0)

  // Recent orders
  const recentOrders: RecentOrder[] = ((recentRes.data ?? []) as OrderRow[]).map(o => ({
    id:           o.id,
    total:        Number(o.total) || 0,
    status:       o.status,
    customerName: (o.shipping_address as Record<string, string> | null)?.name ?? null,
    created_at:   o.created_at,
  }))

  // Low stock
  const lowStock: LowStockProduct[] = ((lowStockRes.data ?? []) as { id: string; name: string; stock: number }[]).map(p => ({
    id:    p.id,
    name:  p.name,
    stock: p.stock,
  }))

  const props: DashboardProps = {
    revenueToday,    revenueYesterday,
    revenue7d,       revenuePrev7d,
    revenue30d,      revenuePrev30d,
    ordersToday,     ordersYesterday,
    orders7d,        ordersPrev7d,
    orders30d,       ordersPrev30d,
    aov30d,          aovPrev30d,
    newCustomers30d: profilesNewRes.count   ?? 0,
    totalCustomers:  profilesTotalRes.count ?? 0,
    visitorsToday:   visitorsTodayRes.count ?? 0,
    visitors30d:     visitorsRes.count      ?? 0,
    ordersByStatus,
    dailySeries,
    recentOrders,
    lowStock,
    activePartners: (partnersRes as any).count ?? 0,
    pendingAction,
  }

  return (
    <div className="max-w-7xl mx-auto">
      <DashboardChart {...props} />
    </div>
  )
}
