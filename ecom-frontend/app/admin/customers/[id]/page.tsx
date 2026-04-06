import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

export const metadata = { title: 'Customer Detail' }

interface PageProps {
  params: Promise<{ id: string }>
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  confirmed:  'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped:    'bg-indigo-100 text-indigo-800',
  delivered:  'bg-green-100 text-green-800',
  cancelled:  'bg-red-100 text-red-800',
  refunded:   'bg-gray-100 text-gray-700',
}

export default async function CustomerDetailPage({ params }: PageProps) {
  await requireAdmin()
  const supabase = createAdminClient()

  const { id } = await params

  const { data: customer } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, created_at, updated_at')
    .eq('id', id)
    .single()

  if (!customer) notFound()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, total, status, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const totalSpent = orders
    ?.filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + Number(o.total), 0) ?? 0

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/admin/customers" className="text-sm text-gray-500 hover:text-gray-700">Customers</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">{customer.full_name || 'Unknown'}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Profile</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Name</dt>
                <dd className="text-gray-700 font-medium">{customer.full_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Phone</dt>
                <dd className="text-gray-700">{customer.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Role</dt>
                <dd className="capitalize text-gray-700">{customer.role}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs uppercase tracking-wide mb-0.5">Joined</dt>
                <dd className="text-gray-700">{new Date(customer.created_at).toLocaleDateString('en-US', { dateStyle: 'long' })}</dd>
              </div>
            </dl>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{orders?.length ?? 0}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-1">Total Spent</p>
              <p className="text-lg font-bold text-gray-900">${totalSpent.toLocaleString('en-US')}</p>
            </div>
          </div>
        </div>

        {/* Orders list */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Order History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Order ID</th>
                  <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Total</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Status</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders?.map(order => (
                  <tr key={order.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link href={`/orders/${order.id}`} className="font-mono text-blue-600 hover:underline text-xs">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-medium">${Number(order.total).toLocaleString('en-US')}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status] ?? 'bg-gray-100'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(order.created_at).toLocaleDateString('en-US')}
                    </td>
                  </tr>
                ))}
                {(!orders || orders.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">No orders yet.</td>
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
