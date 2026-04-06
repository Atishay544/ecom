import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import OrderDetailActions from './OrderDetailActions'
import InvoiceButton from './InvoiceButton'

export const metadata = { title: 'Order Detail' }

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

export default async function OrderDetailPage({ params }: PageProps) {
  await requireAdmin()
  const supabase = createAdminClient()

  const { id } = await params

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, status, subtotal, tax, shipping, total, tracking_number,
      shipping_address, created_at, updated_at, user_id,
      order_items(id, quantity, unit_price, total, snapshot)
    `)
    .eq('id', id)
    .single()

  if (!order) notFound()

  const { data: customer } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', order.user_id)
    .single()

  // Fetch email via admin client (service role bypasses RLS)
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const adminSupabase = createAdminClient()
  const { data: authUser } = await adminSupabase.auth.admin.getUserById(order.user_id)
  const customerEmail = authUser?.user?.email ?? null

  const address = order.shipping_address as any

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Link href="/admin/orders" className="text-sm text-gray-500 hover:text-gray-700">Orders</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">#{id.slice(0, 8).toUpperCase()}</h1>
          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
            {order.status}
          </span>
        </div>
        <InvoiceButton order={{
          ...order,
          customer: { full_name: customer?.full_name ?? undefined, email: customerEmail ?? undefined, phone: customer?.phone ?? undefined },
        }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">Items</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Product</th>
                  <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Qty</th>
                  <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Unit</th>
                  <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.order_items as any[]).map((item: any) => (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-5 py-3 text-gray-700">{item.snapshot?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{item.quantity}</td>
                    <td className="px-5 py-3 text-right text-gray-600">${Number(item.unit_price).toLocaleString('en-US')}</td>
                    <td className="px-5 py-3 text-right font-medium">${Number(item.total).toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-4 border-t border-gray-100 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span><span>${Number(order.subtotal).toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax</span><span>${Number(order.tax).toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Shipping</span><span>${Number(order.shipping).toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-100">
                <span>Total</span><span>${Number(order.total).toLocaleString('en-US')}</span>
              </div>
            </div>
          </div>

          {/* Status + Tracking actions */}
          <OrderDetailActions
            orderId={order.id}
            currentStatus={order.status}
            currentTracking={order.tracking_number ?? ''}
          />
        </div>

        {/* Sidebar: Customer + Address */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Customer</h2>
            <p className="text-sm text-gray-700 font-medium">{customer?.full_name ?? '—'}</p>
            {customer?.phone && <p className="text-sm text-gray-500 mt-1">{customer.phone}</p>}
            <p className="text-xs text-gray-400 mt-2">
              Ordered {new Date(order.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Shipping Address</h2>
            <div className="text-sm text-gray-600 space-y-0.5">
              {address?.full_name && <p className="font-medium text-gray-700">{address.full_name}</p>}
              {address?.line1 && <p>{address.line1}</p>}
              {address?.line2 && <p>{address.line2}</p>}
              {address?.city && <p>{address.city}{address.state ? `, ${address.state}` : ''}</p>}
              {address?.zip && <p>{address.zip}</p>}
              {address?.country && <p>{address.country}</p>}
              {address?.phone && <p className="mt-1 text-gray-500">{address.phone}</p>}
            </div>
          </div>

          {order.tracking_number && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-2">Tracking Number</h2>
              <p className="font-mono text-sm text-gray-700">{order.tracking_number}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
