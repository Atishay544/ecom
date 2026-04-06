import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

export const metadata = { title: 'Customers' }

const PAGE_SIZE = 25

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function CustomersPage({ searchParams }: PageProps) {
  const supabase = createAdminClient()

  await requireAdmin()

  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, role, created_at', { count: 'exact' })
    .eq('role', 'customer')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) query = query.ilike('full_name', `%${q}%`)

  const { data: customers, count } = await query

  // Get order counts per customer
  const customerIds = customers?.map(c => c.id) ?? []
  const orderCountMap = new Map<string, number>()
  if (customerIds.length > 0) {
    const { data: orderCounts } = await supabase
      .from('orders')
      .select('user_id')
      .in('user_id', customerIds)

    orderCounts?.forEach(o => {
      orderCountMap.set(o.user_id, (orderCountMap.get(o.user_id) ?? 0) + 1)
    })
  }

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Customers</h1>

      {/* Search */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <button
          type="submit"
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Search
        </button>
        {q && (
          <Link href="/admin/customers" className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Phone</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Orders</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Joined</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers?.map(customer => (
                <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${customer.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                      {customer.full_name || <span className="text-gray-400 italic">No name</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{customer.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">
                    {orderCountMap.get(customer.id) ?? 0}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(customer.created_at).toLocaleDateString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/customers/${customer.id}`} className="text-xs text-blue-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {(!customers || customers.length === 0) && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">No customers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">Showing {from + 1}–{Math.min(to + 1, count ?? 0)} of {count}</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/customers?q=${q}&page=${page - 1}`} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Previous</Link>
              )}
              {page < totalPages && (
                <Link href={`/customers?q=${q}&page=${page + 1}`} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Next</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
