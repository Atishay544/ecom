'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Rate {
  carrier_id: string
  carrier_name: string
  carrier_slug: string
  service: string
  estimated_days: string
  rate: number
  is_live: boolean
}

interface Props {
  orderId: string
  toPin: string
  totalAmount: number
  currentPartner: string | null
  currentAwb: string | null
  currentRate: number | null
  currentService: string | null
}

export default function DeliveryPanel({
  orderId, toPin, totalAmount,
  currentPartner, currentAwb, currentRate, currentService,
}: Props) {
  const router = useRouter()
  const [rates, setRates]         = useState<Rate[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [warning, setWarning]     = useState<string | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [booking, setBooking]     = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied]       = useState(false)

  const [selected, setSelected] = useState<Rate | null>(null)
  const [booked, setBooked]     = useState<{ partner: string; service: string; rate: number; awb: string | null } | null>(
    currentPartner
      ? { partner: currentPartner, service: currentService ?? '', rate: currentRate ?? 0, awb: currentAwb }
      : null
  )

  async function fetchRates() {
    setLoading(true); setError(null); setWarning(null)
    try {
      const res  = await fetch(`/api/admin/orders/${orderId}/shipping-rates`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to fetch rates')
      if (json.warning) setWarning(json.warning)
      setRates(json.rates ?? [])
    } catch (e: any) { setError(e.message) }
    finally          { setLoading(false) }
  }

  async function selectRate(rate: Rate) {
    // Just save the choice to DB (no AWB yet)
    setAssigning(rate.carrier_id + rate.service); setError(null)
    try {
      const res  = await fetch(`/api/admin/orders/${orderId}/delivery`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_partner: rate.carrier_name,
          delivery_service: rate.service,
          delivery_rate:    rate.rate,
          delivery_awb:     null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to select rate')
      setSelected(rate)
      setBooked({ partner: rate.carrier_name, service: rate.service, rate: rate.rate, awb: null })
      setRates([])
    } catch (e: any) { setError(e.message) }
    finally          { setAssigning(null) }
  }

  async function bookShipment() {
    if (!selected && !booked) return
    const rate = selected ?? { carrier_id: '', service: booked!.service }
    setBooking(true); setError(null)
    try {
      const res  = await fetch(`/api/admin/orders/${orderId}/book-shipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier_id: rate.carrier_id || undefined, service: rate.service }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Booking failed')
      setBooked(prev => prev ? { ...prev, awb: json.waybill } : prev)
      setSelected(null)
      router.refresh()
    } catch (e: any) { setError(e.message) }
    finally          { setBooking(false) }
  }

  async function downloadLabel() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/label`)
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Failed') }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `label-${booked?.awb ?? orderId}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { setError(e.message) }
    finally          { setDownloading(false) }
  }

  function copyAwb() {
    if (!booked?.awb) return
    navigator.clipboard.writeText(booked.awb)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const cheapest = rates[0]?.rate

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Shipping</h2>
        <button
          onClick={fetchRates}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Loading…' : booked ? 'Compare Rates' : 'Get Rates'}
        </button>
      </div>

      <div className="px-5 py-4 space-y-3">

        {/* Booked state */}
        {booked && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-800">{booked.partner} · {booked.service}</p>
                <p className="text-xs text-green-700">₹{Number(booked.rate).toLocaleString('en-IN')} · {booked.service === 'Express' ? '2-3 days' : '5-7 days'}</p>
              </div>
              {!booked.awb && (
                <button
                  onClick={bookShipment}
                  disabled={booking}
                  className="px-3 py-1.5 text-xs bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 font-medium transition-colors"
                >
                  {booking ? 'Booking…' : '📦 Book Shipment'}
                </button>
              )}
            </div>
            {booked.awb && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono bg-white border border-green-200 px-2 py-1 rounded text-green-800">AWB: {booked.awb}</span>
                <button onClick={copyAwb} className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 rounded text-green-700 transition-colors">
                  {copied ? '✓ Copied' : 'Copy AWB'}
                </button>
                <button onClick={downloadLabel} disabled={downloading}
                  className="text-xs px-2 py-1 bg-white border border-green-300 hover:bg-green-50 rounded text-green-700 transition-colors disabled:opacity-50">
                  {downloading ? 'Downloading…' : '⬇ Label PDF'}
                </button>
              </div>
            )}
          </div>
        )}

        {!booked && !loading && rates.length === 0 && (
          <p className="text-sm text-gray-400">Click "Get Rates" to compare live rates from all configured carriers.</p>
        )}

        {warning && <p className="text-xs text-amber-600">{warning}</p>}
        {!toPin  && <p className="text-xs text-amber-600">⚠ No pincode found in shipping address.</p>}
        {error   && <p className="text-sm text-red-600">{error}</p>}

        {/* Rate comparison list */}
        {rates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">Sorted by price — cheapest first</p>
            {rates.map(rate => {
              const isCheapest = rate.rate === cheapest
              return (
                <div key={rate.carrier_id + rate.service}
                  className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                    isCheapest ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-blue-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800">{rate.carrier_name}</p>
                      {isCheapest && <span className="text-xs px-1.5 py-0.5 bg-green-200 text-green-800 rounded font-medium">Cheapest</span>}
                      {!rate.is_live && <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded border border-yellow-200">estimated</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{rate.service} · {rate.estimated_days}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900">₹{Number(rate.rate).toLocaleString('en-IN')}</span>
                    <button
                      onClick={() => selectRate(rate)}
                      disabled={assigning === rate.carrier_id + rate.service}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {assigning === rate.carrier_id + rate.service ? 'Selecting…' : 'Select'}
                    </button>
                  </div>
                </div>
              )
            })}
            <button onClick={() => setRates([])} className="text-xs text-gray-400 hover:text-gray-600 w-full text-center pt-1">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
