import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import BulkActions from './BulkActions'
import OrderSearch from './OrderSearch'

export const metadata = { title: 'Orders' }

const PAGE_SIZE = 25

const STATUS_COLORS: Record<string, string> = {
  pending:           'bg-yellow-100 text-yellow-800',
  confirmed:         'bg-blue-100 text-blue-800',
  cod_upfront_paid:  'bg-teal-100 text-teal-800',
  processing:        'bg-purple-100 text-purple-800',
  shipped:           'bg-indigo-100 text-indigo-800',
  delivered:         'bg-green-100 text-green-800',
  cancelled:         'bg-red-100 text-red-800',
  refunded:          'bg-gray-100 text-gray-700',
}

const ALL_STATUSES = ['pending', 'confirmed', 'cod_upfront_paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const supabase = createAdminClient()

  await requireAdmin()

  const params = await searchParams
  const statusFilter = params.status ?? ''
  const searchQuery = params.q ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('orders')
    .select('id, total, status, payment_status, created_at, user_id', { count: 'exact' })
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

  const ordersWithNames = (orders ?? []).map(o => ({
    ...o,
    customerName: profileMap.get(o.user_id) ?? null,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href="/admin/orders"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!statusFilter ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          All
        </Link>
        {ALL_STATUSES.map(s => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Search bar */}
      <OrderSearch />

      {/* Table + Bulk Actions */}
      <BulkActions
        initialOrders={ordersWithNames}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
      />

      {totalPages > 1 && (
        <div className="mt-4 px-4 py-3 border border-gray-200 bg-white rounded-xl flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {from + 1}–{Math.min(to + 1, count ?? 0)} of {count} orders
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/orders?status=${statusFilter}&page=${page - 1}`} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Previous</Link>
            )}
            {page < totalPages && (
              <Link href={`/admin/orders?status=${statusFilter}&page=${page + 1}`} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Next</Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
