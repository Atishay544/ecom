'use client'
import { useState, useRef, useEffect } from 'react'
import { useCartStore } from '@/lib/store/cart'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatPrice } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import Script from 'next/script'
import { Tag, CreditCard, Truck, Zap, Check } from 'lucide-react'

declare global {
  interface Window { Razorpay: any }
}

interface Address {
  name: string; phone: string; line1: string; line2: string
  city: string; state: string; pincode: string
}

interface Offer {
  id: string; title: string; description: string | null
  type: string; upfront_pct: number | null; discount_pct: number | null
}

type PaymentMethod = 'online' | 'cod' | 'cod_upfront'

const EMPTY_ADDRESS: Address = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' }

export default function CheckoutPage() {
  const { items, total, clearCart } = useCartStore()
  const { user, getToken } = useAuth()
  const router = useRouter()

  const [address, setAddress]           = useState<Address>(EMPTY_ADDRESS)
  const honeypotRef                     = useRef<HTMLInputElement>(null)
  const [coupon, setCoupon]             = useState('')
  const [couponResult, setCouponResult] = useState<{ discount: number; code: string } | null>(null)
  const [couponError, setCouponError]   = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [offers, setOffers]             = useState<Offer[]>([])

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online')
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)

  useEffect(() => {
    fetch('/api/offers').then(r => r.json()).then(j => setOffers(j.data ?? []))
  }, [])

  // Pre-fill address from last order (only if user hasn't typed anything yet)
  useEffect(() => {
    if (!user) return
    getToken().then(token =>
      fetch('/api/account/address', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(j => {
          if (j.address) setAddress(prev => {
            const isEmpty = Object.values(prev).every(v => v === '')
            return isEmpty ? { ...EMPTY_ADDRESS, ...j.address } : prev
          })
        })
        .catch(() => {})
    )
  }, [user])

  const subtotal   = total()
  const discount   = couponResult?.discount ?? 0
  const grandTotal = Math.max(0, subtotal - discount)

  // COD offer calculation
  const codOffers = offers.filter(o => o.type === 'cod_upfront')
  const codBreakdown = paymentMethod === 'cod_upfront' && selectedOffer?.upfront_pct && selectedOffer?.discount_pct
    ? (() => {
        const upfront    = (grandTotal * selectedOffer.upfront_pct!) / 100
        const remaining  = grandTotal - upfront
        const discounted = remaining * (1 - selectedOffer.discount_pct! / 100)
        return { upfront, remaining, discounted, totalPayable: upfront + discounted, savings: grandTotal - (upfront + discounted) }
      })()
    : null

  function selectPaymentMethod(method: PaymentMethod, offer?: Offer) {
    setPaymentMethod(method)
    if (method === 'cod_upfront' && offer) {
      setSelectedOffer(offer)
    } else {
      setSelectedOffer(null)
    }
    setError('')
  }

  async function applyCoupon() {
    if (!coupon.trim()) return
    try {
      const token = await getToken()
      const res = await api.post<{ discount: number }>('/api/checkout/validate-coupon', { code: coupon.trim(), subtotal }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setCouponResult({ discount: res.discount, code: coupon.trim().toUpperCase() })
      setCouponError('')
    } catch (e: any) {
      setCouponError(e.message ?? 'Invalid coupon')
      setCouponResult(null)
    }
  }

  async function handleCheckout() {
    if (!user) { router.push('/login?redirect=/checkout'); return }
    if (honeypotRef.current?.value) { setError('Something went wrong. Please try again.'); return }
    const required: (keyof Address)[] = ['name', 'phone', 'line1', 'city', 'state', 'pincode']
    for (const f of required) {
      if (!address[f].trim()) { setError(`${f} is required`); return }
    }
    setError('')
    setLoading(true)
    try {
      const token = await getToken()
      const res = await api.post<{
        order_id: string
        payment_method: string
        razorpay_order?: { id: string; amount: number; currency: string }
      }>('/api/checkout', {
        items: items.map(i => ({ product_id: i.id, quantity: i.quantity, price: i.price })),
        shipping_address: address,
        coupon_code: couponResult?.code,
        payment_method: paymentMethod,
        offer_id: selectedOffer?.id ?? null,
      }, { headers: { Authorization: `Bearer ${token}` } })

      // ── COD: no Razorpay needed — order already confirmed ────────────────
      if (res.payment_method === 'cod') {
        clearCart()
        router.push(`/account/orders/${res.order_id}?success=1`)
        return
      }

      // ── Online / COD Upfront: open Razorpay ──────────────────────────────
      if (!res.razorpay_order) {
        setError('Payment gateway error. Please try again.')
        return
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: res.razorpay_order.amount,
        currency: res.razorpay_order.currency,
        name: 'Layers Factory',
        description: `Order #${res.order_id}`,
        order_id: res.razorpay_order.id,
        prefill: { name: address.name, contact: address.phone, email: user.email },
        theme: { color: '#000000' },
        handler: async (payment: any) => {
          try {
            await api.post('/api/checkout/verify', {
              order_id: res.order_id,
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
            }, { headers: { Authorization: `Bearer ${token}` } })
            clearCart()
            router.push(`/account/orders/${res.order_id}?success=1`)
          } catch {
            router.push(`/account/orders/${res.order_id}?payment=failed`)
          }
        },
      }
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (e: any) {
      setError(e.message ?? 'Checkout failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <p className="text-xl font-semibold mb-4">Your cart is empty</p>
        <a href="/products" className="text-sm underline text-gray-600">Back to shopping</a>
      </div>
    )
  }

  const payNow = codBreakdown ? codBreakdown.upfront : grandTotal

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-8">Checkout</h1>
        <div className="grid lg:grid-cols-5 gap-8">

          {/* ── Left Column ─────────────────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-6">

            {/* Address */}
            <div className="border rounded-2xl p-6">
              <h2 className="font-semibold text-lg mb-4">Delivery Address</h2>
              <div style={{ display: 'none' }} aria-hidden="true">
                <input ref={honeypotRef} name="lf_confirm_email" tabIndex={-1}
                  autoComplete="new-password" readOnly />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full Name" value={address.name} onChange={v => setAddress(a => ({ ...a, name: v }))} span={2} />
                <Field label="Phone" value={address.phone} onChange={v => setAddress(a => ({ ...a, phone: v }))} />
                <Field label="Pincode" value={address.pincode} onChange={v => setAddress(a => ({ ...a, pincode: v }))} />
                <Field label="Address Line 1" value={address.line1} onChange={v => setAddress(a => ({ ...a, line1: v }))} span={2} />
                <Field label="Address Line 2 (optional)" value={address.line2} onChange={v => setAddress(a => ({ ...a, line2: v }))} span={2} />
                <Field label="City" value={address.city} onChange={v => setAddress(a => ({ ...a, city: v }))} />
                <Field label="State" value={address.state} onChange={v => setAddress(a => ({ ...a, state: v }))} />
              </div>
            </div>

            {/* Payment Method */}
            <div className="border rounded-2xl p-6">
              <h2 className="font-semibold text-lg mb-4">Payment Method</h2>
              <div className="space-y-3">

                {/* Online Payment */}
                <PaymentCard
                  selected={paymentMethod === 'online'}
                  onClick={() => selectPaymentMethod('online')}
                  icon={<CreditCard size={20} className="text-blue-600" />}
                  title="Pay Online"
                  subtitle="UPI, Credit/Debit Card, Net Banking, Wallets"
                  badge={<span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 font-medium">Instant Confirmation</span>}
                />

                {/* Cash on Delivery */}
                <PaymentCard
                  selected={paymentMethod === 'cod'}
                  onClick={() => selectPaymentMethod('cod')}
                  icon={<Truck size={20} className="text-orange-600" />}
                  title="Cash on Delivery"
                  subtitle="Pay when your order arrives at your doorstep"
                  badge={<span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5 font-medium">No advance payment</span>}
                />

                {/* COD Upfront Offers */}
                {codOffers.map(offer => (
                  <PaymentCard
                    key={offer.id}
                    selected={paymentMethod === 'cod_upfront' && selectedOffer?.id === offer.id}
                    onClick={() => selectPaymentMethod('cod_upfront', offer)}
                    icon={<Zap size={20} className="text-green-600" />}
                    title={offer.title}
                    subtitle={offer.description ?? `Pay ${offer.upfront_pct}% now, rest on delivery with ${offer.discount_pct}% off`}
                    badge={<span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 font-medium">Save {offer.discount_pct}% on COD</span>}
                  />
                ))}
              </div>

              {/* COD Offer Breakdown */}
              {codBreakdown && selectedOffer && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-1.5">
                  <p className="font-semibold text-green-900 text-xs uppercase tracking-wide mb-2">Payment Breakdown</p>
                  <div className="flex justify-between text-gray-700">
                    <span>Pay upfront ({selectedOffer.upfront_pct}%)</span>
                    <span className="font-semibold">{formatPrice(codBreakdown.upfront)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Remaining</span>
                    <span>{formatPrice(codBreakdown.remaining)}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>{selectedOffer.discount_pct}% off remaining</span>
                    <span>-{formatPrice(codBreakdown.remaining - codBreakdown.discounted)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700 border-t border-green-300 pt-1.5">
                    <span>Pay on delivery</span>
                    <span className="font-semibold">{formatPrice(codBreakdown.discounted)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-green-900 bg-green-100 rounded-lg px-3 py-2 mt-1">
                    <span>Total payable</span>
                    <span>{formatPrice(codBreakdown.totalPayable)}</span>
                  </div>
                  <p className="text-center text-xs text-green-700 font-medium pt-1">
                    You save {formatPrice(codBreakdown.savings)} on this order!
                  </p>
                </div>
              )}
            </div>

            {/* Coupon */}
            <div className="border rounded-2xl p-6">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Tag size={16} className="text-gray-500" /> Coupon Code
              </h2>
              <div className="flex gap-2">
                <input value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase tracking-wider" />
                <button onClick={applyCoupon}
                  className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition">
                  Apply
                </button>
              </div>
              {couponError && <p className="text-red-500 text-xs mt-2">{couponError}</p>}
              {couponResult && (
                <p className="text-green-600 text-sm mt-2 font-medium">
                  Coupon applied! You save {formatPrice(couponResult.discount)}
                </p>
              )}
            </div>
          </div>

          {/* ── Right Column: Order Summary ──────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="bg-gray-50 rounded-2xl p-6 sticky top-24">
              <h2 className="font-bold text-lg mb-4">Order Summary</h2>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {items.map(i => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-gray-600 truncate flex-1 mr-2">{i.name} × {i.quantity}</span>
                    <span className="font-medium shrink-0">{formatPrice(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Coupon discount</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>{formatPrice(grandTotal)}</span>
                </div>
              </div>

              {/* Payment method indicator */}
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {paymentMethod === 'online' && <><CreditCard size={14} className="text-blue-600" /><span>Pay online via Razorpay</span></>}
                  {paymentMethod === 'cod' && <><Truck size={14} className="text-orange-600" /><span>Cash on Delivery</span></>}
                  {paymentMethod === 'cod_upfront' && <><Zap size={14} className="text-green-600" /><span>Pay {formatPrice(codBreakdown?.upfront ?? 0)} now + {formatPrice(codBreakdown?.discounted ?? 0)} on delivery</span></>}
                </div>
              </div>

              {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

              <button onClick={handleCheckout} disabled={loading}
                className="mt-4 w-full bg-black text-white py-3.5 rounded-xl font-semibold hover:bg-gray-800 transition disabled:opacity-50">
                {loading
                  ? 'Processing…'
                  : paymentMethod === 'cod'
                    ? `Place Order — Pay ${formatPrice(grandTotal)} on Delivery`
                    : paymentMethod === 'cod_upfront' && codBreakdown
                      ? `Pay ${formatPrice(codBreakdown.upfront)} Now`
                      : `Pay ${formatPrice(grandTotal)}`}
              </button>

              <p className="text-center text-xs text-gray-400 mt-3">
                {paymentMethod === 'cod' ? 'Order confirmed instantly' : 'Secured by Razorpay'}
              </p>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

function PaymentCard({
  selected, onClick, icon, title, subtitle, badge,
}: {
  selected: boolean; onClick: () => void
  icon: React.ReactNode; title: string; subtitle: string
  badge?: React.ReactNode
}) {
  return (
    <div
      onClick={onClick}
      className={`border rounded-xl p-4 cursor-pointer transition-all ${
        selected
          ? 'border-black bg-black/3 ring-1 ring-black'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          selected ? 'border-black bg-black' : 'border-gray-300'
        }`}>
          {selected && <Check size={11} className="text-white" strokeWidth={3} />}
        </div>
        <div className="text-gray-700 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            {badge}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, span }: {
  label: string; value: string; onChange: (v: string) => void; span?: number
}) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
    </div>
  )
}
