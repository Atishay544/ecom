import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import CouponActions from './CouponActions'
import CouponForm from './CouponForm'

export const metadata = { title: 'Coupons' }

export default async function CouponsPage() {
  const supabase = createAdminClient()

  await requireAdmin()

  const { data: coupons } = await supabase
    .from('coupons')
    .select('id, code, type, value, min_order, uses_count, max_uses, expires_at, is_active')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>

      {/* Create form — top */}
      <CouponForm />

      {/* List — below */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Existing Coupons ({coupons?.length ?? 0})
        </h2>

        {(!coupons || coupons.length === 0) ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 py-12 text-center text-gray-400 text-sm">
            No coupons yet. Create one above.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Code</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Type / Value</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Uses</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Expires</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Status</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map(coupon => (
                    <tr key={coupon.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-semibold text-gray-900">{coupon.code}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {coupon.type === 'percentage'
                          ? `${coupon.value}%`
                          : `₹${Number(coupon.value).toLocaleString('en-IN')}`}
                        {coupon.min_order
                          ? <span className="text-xs text-gray-400 ml-1">(min ₹{Number(coupon.min_order).toLocaleString('en-IN')})</span>
                          : null}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {coupon.uses_count}{coupon.max_uses ? ` / ${coupon.max_uses}` : ''}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {coupon.expires_at
                          ? new Date(coupon.expires_at).toLocaleDateString('en-US')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          coupon.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {coupon.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <CouponActions couponId={coupon.id} isActive={coupon.is_active} code={coupon.code} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
