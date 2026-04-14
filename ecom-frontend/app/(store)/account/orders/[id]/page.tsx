import { requireUser } from '@/lib/user-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { CheckCircle2, XCircle, CreditCard, Truck, Zap } from 'lucide-react'
import InvoiceDownload from './InvoiceDownload'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ success?: string; payment?: string }>
}

const STEPS = ['pending','confirmed','processing','shipped','delivered']

export default async function OrderDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { success, payment } = await searchParams

  const { user } = await requireUser('/login')

  const admin = createAdminClient()
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select(`
      *,
      order_items(
        id,quantity,unit_price,
        products(name,slug,images)
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (orderErr) console.error('Order detail error:', orderErr)

  if (!order) notFound()

  const meta       = (order.metadata ?? {}) as Record<string, any>
  const pmMethod   = meta.payment_method as string | undefined
  // cod_upfront_paid maps to the same position as 'confirmed' in the progress bar
  const displayStatus = order.status === 'cod_upfront_paid' ? 'confirmed' : order.status
  const currentStep   = STEPS.indexOf(displayStatus)

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Success banner */}
      {success === '1' && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-4 mb-6">
          <CheckCircle2 size={24} className="text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Order placed successfully!</p>
            <p className="text-sm text-green-600">You'll receive a confirmation email shortly.</p>
          </div>
        </div>
      )}
      {payment === 'failed' && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 mb-6">
          <XCircle size={24} className="text-red-600 shrink-0" />
          <div>
            <p className="font-semibold text-red-800">Payment failed</p>
            <p className="text-sm text-red-600">Your order was placed but payment wasn't confirmed. Please contact support.</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
          {pmMethod === 'cod' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              <Truck size={11} /> Cash on Delivery
            </span>
          )}
          {pmMethod === 'online' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <CreditCard size={11} /> Paid Online
            </span>
          )}
          {pmMethod === 'cod_upfront' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <Zap size={11} /> COD Upfront Offer
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <InvoiceDownload order={{ ...order, customer: null }} />
          <Link href="/account/orders" className="text-sm text-gray-500 hover:underline">← All Orders</Link>
        </div>
      </div>

      {/* Progress tracker */}
      {!['cancelled','refunded'].includes(order.status) && (
        <div className="flex items-center mb-8 overflow-x-auto pb-2">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${i <= currentStep ? 'bg-black text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span className="text-xs mt-1 capitalize whitespace-nowrap text-gray-500">{step}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-12 mx-1 ${i < currentStep ? 'bg-black' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Items */}
      <div className="border rounded-2xl overflow-hidden mb-6">
        <div className="bg-gray-50 px-5 py-3 border-b">
          <h2 className="font-semibold">Items</h2>
        </div>
        <div className="divide-y">
          {order.order_items?.map((item: any) => (
            <div key={item.id} className="flex gap-4 p-4">
              <div className="w-16 h-16 relative rounded-lg overflow-hidden bg-gray-100 shrink-0">
                {item.products?.images?.[0]
                  ? <Image src={item.products.images[0]} alt={item.products.name} fill className="object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/products/${item.products?.slug}`} className="font-medium text-sm hover:underline">
                  {item.products?.name}
                </Link>
                <p className="text-xs text-gray-500 mt-0.5">Qty: {item.quantity}</p>
              </div>
              <p className="font-bold text-sm shrink-0">{formatPrice(item.unit_price * item.quantity)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Summary + Tracking */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border rounded-2xl p-5">
          <h2 className="font-semibold mb-3">Payment Summary</h2>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatPrice(order.subtotal_amount)}</span></div>
            {order.discount_amount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatPrice(order.discount_amount)}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>{formatPrice(order.shipping_amount ?? 0)}</span></div>
            <div className="flex justify-between font-bold border-t pt-2 mt-2">
              <span>Total</span><span>{formatPrice(order.total_amount)}</span>
            </div>
            {pmMethod === 'cod_upfront' && meta.amount_charged && (
              <>
                <div className="flex justify-between text-blue-700 border-t pt-2 mt-2">
                  <span>Paid upfront ({meta.offer_upfront_pct}%)</span>
                  <span className="font-semibold">{formatPrice(Number(meta.amount_charged))}</span>
                </div>
                <div className="flex justify-between text-orange-700">
                  <span>Due on delivery</span>
                  <span className="font-semibold">{formatPrice(Number(meta.amount_on_delivery))}</span>
                </div>
              </>
            )}
            {pmMethod === 'cod' && (
              <div className="flex justify-between text-orange-700 border-t pt-2 mt-2">
                <span>Pay on delivery</span>
                <span className="font-semibold">{formatPrice(order.total_amount)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="border rounded-2xl p-5">
          <h2 className="font-semibold mb-3">Shipping Address</h2>
          {order.shipping_address && (
            <address className="text-sm text-gray-600 not-italic leading-relaxed">
              <p className="font-medium text-black">{order.shipping_address.name}</p>
              <p>{order.shipping_address.line1}</p>
              {order.shipping_address.line2 && <p>{order.shipping_address.line2}</p>}
              <p>{order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.pincode}</p>
              <p>{order.shipping_address.phone}</p>
            </address>
          )}
          {order.tracking_number && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-500">Tracking</p>
              <p className="text-sm font-mono font-medium">{order.tracking_number}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
