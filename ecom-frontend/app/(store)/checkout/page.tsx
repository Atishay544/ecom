'use client'
import { useState, useRef } from 'react'
import { useCartStore } from '@/lib/store/cart'
import { useAuth } from '@/lib/hooks/useAuth'
import { formatPrice } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import Script from 'next/script'

declare global {
  interface Window {
    Razorpay: any
  }
}

interface Address {
  name: string; phone: string; line1: string; line2: string
  city: string; state: string; pincode: string
}

const EMPTY_ADDRESS: Address = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' }

export default function CheckoutPage() {
  const { items, total, clearCart } = useCartStore()
  const { user, getToken } = useAuth()
  const router = useRouter()

  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS)
  const honeypotRef = useRef<HTMLInputElement>(null)
  const [coupon, setCoupon] = useState('')
  const [couponResult, setCouponResult] = useState<{ discount: number; code: string } | null>(null)
  const [couponError, setCouponError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const subtotal = total()
  const discount = couponResult?.discount ?? 0
  const grandTotal = Math.max(0, subtotal - discount)

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
    // Honeypot check — bots fill hidden fields; real users do not
    if (honeypotRef.current?.value) {
      setError('Something went wrong. Please try again.')
      return
    }
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
        razorpay_order: { id: string; amount: number; currency: string }
      }>('/api/checkout', {
        items: items.map(i => ({ product_id: i.id, quantity: i.quantity, price: i.price })),
        shipping_address: address,
        coupon_code: couponResult?.code,
      }, { headers: { Authorization: `Bearer ${token}` } })

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: res.razorpay_order.amount,
        currency: res.razorpay_order.currency,
        name: 'My Store',
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

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-8">Checkout</h1>
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left: Address */}
          <div className="lg:col-span-3 space-y-6">
            <div className="border rounded-2xl p-6">
              <h2 className="font-semibold text-lg mb-4">Delivery Address</h2>
              {/* Honeypot — hidden from real users, filled only by bots */}
              <input
                ref={honeypotRef}
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute opacity-0 pointer-events-none h-0 w-0"
              />
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

            {/* Coupon */}
            <div className="border rounded-2xl p-6">
              <h2 className="font-semibold text-lg mb-4">Coupon Code</h2>
              <div className="flex gap-2">
                <input
                  value={coupon}
                  onChange={e => setCoupon(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase tracking-wider"
                />
                <button onClick={applyCoupon}
                  className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition">
                  Apply
                </button>
              </div>
              {couponError && <p className="text-red-500 text-xs mt-2">{couponError}</p>}
              {couponResult && (
                <p className="text-green-600 text-sm mt-2 font-medium">
                  Coupon applied! You save {formatPrice(couponResult.discount, 'USD')}
                </p>
              )}
            </div>
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-2">
            <div className="bg-gray-50 rounded-2xl p-6 sticky top-24">
              <h2 className="font-bold text-lg mb-4">Order Summary</h2>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {items.map(i => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-gray-600 truncate flex-1 mr-2">{i.name} × {i.quantity}</span>
                    <span className="font-medium shrink-0">{formatPrice(i.price * i.quantity, 'USD')}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{formatPrice(subtotal, 'USD')}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Coupon discount</span>
                    <span>-{formatPrice(discount, 'USD')}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>{formatPrice(grandTotal, 'USD')}</span>
                </div>
              </div>
              {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="mt-4 w-full bg-black text-white py-3.5 rounded-xl font-semibold hover:bg-gray-800 transition disabled:opacity-50">
                {loading ? 'Processing…' : `Pay ${formatPrice(grandTotal, 'USD')}`}
              </button>
              <p className="text-center text-xs text-gray-400 mt-3">Secured by Razorpay</p>
            </div>
          </div>
        </div>
      </div>
    </>
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
