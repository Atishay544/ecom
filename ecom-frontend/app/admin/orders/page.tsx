import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

export const metadata = { title: 'Orders' }

const PAGE_SIZE = 25

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  confirmed:  'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped:    'bg-indigo-100 text-indigo-800',
  delivered:  'bg-green-100 text-green-800',
  cancelled:  'bg-red-100 text-red-800',
  refunded:   'bg-gray-100 text-gray-700',
}

const ALL_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const supabase = createAdminClient()

  await requireAdmin()

  const params = await searchParams
  const statusFilter = params.status ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('orders')
    .select('id, total, status, created_at, user_id', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (statusFilter) query = query.eq('status', statusFilter)

  const { data: orders, count } = await query

  const userIds = [...new Set(orders?.map(o => o.user_id).filter(Boolean) ?? [])]
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])

  const profileMap = new Map(profilesData?.map(p => [p.id, p.full_name]) ?? [])
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Orders</h1>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href="/admin/orders"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!statusFilter ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          All
        </Link>
        {ALL_STATUSES.map(s => (
          <Link
            key={s}
            href={`/orders?status=${s}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Order ID</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Customer</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Total</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Date</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders?.map(order => (
                <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/orders/${order.id}`} className="font-mono text-blue-600 hover:underline text-xs font-medium">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">
                    {profileMap.get(order.user_id) ?? <span className="text-gray-400 italic">Unknown</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    ${Number(order.total).toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(order.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {(!orders || orders.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">No orders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {from + 1}–{Math.min(to + 1, count ?? 0)} of {count} orders
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/orders?status=${statusFilter}&page=${page - 1}`} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Previous</Link>
              )}
              {page < totalPages && (
                <Link href={`/orders?status=${statusFilter}&page=${page + 1}`} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Next</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
