import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

export const metadata = { title: 'Dashboard' }

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    processing: 'bg-purple-100 text-purple-800',
    shipped: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}

export default async function DashboardPage() {
  await requireAdmin()
  const supabase = createAdminClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // All queries in parallel — single round trip each
  const [
    { data: allOrders },
    { count: newCustomers },
    { data: lowStock },
    { data: recentOrders },
  ] = await Promise.all([
    supabase.from('orders').select('id, status, total'),
    supabase.from('profiles').select('id', { count: 'exact', head: true })
      .eq('role', 'customer').gte('created_at', thirtyDaysAgo),
    supabase.from('products').select('id, name, stock')
      .lt('stock', 10).order('stock', { ascending: true }).limit(5),
    supabase.from('orders')
      .select('id, total, status, created_at, user_id, profiles(full_name)')
      .order('created_at', { ascending: false }).limit(10),
  ])

  // Aggregate in JS — no extra round trips
  const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const
  const orderCountsByStatus: Record<string, number> = Object.fromEntries(statuses.map(s => [s, 0]))
  let totalRevenue = 0
  for (const o of (allOrders ?? []) as { status: string; total: unknown }[]) {
    if (o.status in orderCountsByStatus) orderCountsByStatus[o.status]++
    if (o.status === 'delivered') totalRevenue += Number(o.total)
  }
  const totalOrders = Object.values(orderCountsByStatus).reduce((a, b) => a + b, 0)

  const profileMap = new Map(
    (recentOrders ?? []).map(o => {
      const p = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles
      return [o.user_id as string, (p as { full_name?: string } | null)?.full_name ?? null] as const
    })
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrice(totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">Delivered orders only</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalOrders}</p>
          <p className="text-xs text-gray-400 mt-1">All statuses</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">New Customers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{newCustomers ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Last 30 days</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Delivered Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{orderCountsByStatus['delivered'] ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Successfully fulfilled</p>
        </div>
      </div>

      {/* Orders by Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Orders by Status</h2>
        <div className="flex flex-wrap gap-3">
          {statuses.map(s => (
            <div key={s} className="flex flex-col items-center bg-gray-50 rounded-lg px-4 py-3 min-w-[90px]">
              <span className="text-xl font-bold text-gray-900">{orderCountsByStatus[s] ?? 0}</span>
              <StatusBadge status={s} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold text-gray-800">Low Stock Alert</h2>
            <Link href="/admin/products" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {lowStock && lowStock.length > 0 ? (
            <ul className="space-y-2">
              {lowStock.map(p => (
                <li key={p.id} className="flex justify-between items-center text-sm">
                  <Link href={`/products/${p.id}`} className="text-gray-700 hover:text-blue-600 truncate max-w-[160px]">
                    {p.name}
                  </Link>
                  <span className={`font-semibold ${p.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {p.stock} left
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">All products well-stocked.</p>
          )}
        </div>

        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold text-gray-800">Recent Orders</h2>
            <Link href="/admin/orders" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-2 text-xs text-gray-500 font-medium">Order ID</th>
                  <th className="text-left pb-2 text-xs text-gray-500 font-medium">Customer</th>
                  <th className="text-left pb-2 text-xs text-gray-500 font-medium">Total</th>
                  <th className="text-left pb-2 text-xs text-gray-500 font-medium">Status</th>
                  <th className="text-left pb-2 text-xs text-gray-500 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders?.map(order => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5">
                      <Link href={`/orders/${order.id}`} className="font-mono text-blue-600 hover:underline text-xs">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="py-2.5 text-gray-600 max-w-[140px] truncate">
                      {profileMap.get(order.user_id) ?? '—'}
                    </td>
                    <td className="py-2.5 text-gray-900 font-medium">{formatPrice(Number(order.total))}</td>
                    <td className="py-2.5"><StatusBadge status={order.status} /></td>
                    <td className="py-2.5 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(order.created_at).toLocaleDateString('en-US')}
                    </td>
                  </tr>
                ))}
                {(!recentOrders || recentOrders.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400 text-sm">No orders yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
