'use client'

import { useState } from 'react'

interface Rate {
  partner_id: string
  partner_name: string
  service: string
  estimated_days: string
  rate: number
  is_mock: boolean
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
  orderId,
  toPin,
  totalAmount,
  currentPartner,
  currentAwb,
  currentRate,
  currentService,
}: Props) {
  const [rates, setRates] = useState<Rate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [assigned, setAssigned] = useState<{
    partner: string
    service: string
    rate: number
    awb: string | null
  } | null>(
    currentPartner
      ? { partner: currentPartner, service: currentService ?? '', rate: currentRate ?? 0, awb: currentAwb }
      : null
  )
  const [copied, setCopied] = useState(false)

  async function fetchRates() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipping-rates`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to fetch rates')
      setRates(json.rates ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function assignRate(rate: Rate) {
    setAssigning(rate.partner_id + rate.service)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/delivery`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_partner: rate.partner_name,
          delivery_service: rate.service,
          delivery_rate: rate.rate,
          delivery_awb: null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to assign')
      setAssigned({ partner: rate.partner_name, service: rate.service, rate: rate.rate, awb: null })
      setRates([])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAssigning(null)
    }
  }

  function copyAwb() {
    if (assigned?.awb) {
      navigator.clipboard.writeText(assigned.awb)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Shipping</h2>
        {rates.length === 0 && (
          <button
            onClick={fetchRates}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading...' : 'Get Rates'}
          </button>
        )}
        {rates.length > 0 && (
          <button
            onClick={() => setRates([])}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Close
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {/* Currently assigned */}
        {assigned && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800">Assigned: {assigned.partner}</p>
            <p className="text-xs text-green-700 mt-0.5">{assigned.service} — ₹{Number(assigned.rate).toLocaleString('en-IN')}</p>
            {assigned.awb && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-mono text-green-700">AWB: {assigned.awb}</span>
                <button
                  onClick={copyAwb}
                  className="text-xs px-2 py-0.5 bg-green-100 hover:bg-green-200 rounded text-green-700 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy AWB'}
                </button>
              </div>
            )}
          </div>
        )}

        {!assigned && !loading && rates.length === 0 && (
          <p className="text-sm text-gray-400">Click "Get Rates" to compare shipping rates from available delivery partners.</p>
        )}

        {!toPin && rates.length === 0 && (
          <p className="text-xs text-amber-600 mt-2">Note: No pincode found in shipping address. Rates may not be accurate.</p>
        )}

        {error && (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        )}

        {/* Rate cards */}
        {rates.length > 0 && (
          <div className="space-y-2">
            {rates.map((rate) => (
              <div
                key={rate.partner_id + rate.service}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">{rate.partner_name}</p>
                    {rate.is_mock && (
                      <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded border border-yellow-200">
                        Configure API for live rates
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{rate.service} · {rate.estimated_days}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-900">₹{Number(rate.rate).toLocaleString('en-IN')}</span>
                  <button
                    onClick={() => assignRate(rate)}
                    disabled={assigning === rate.partner_id + rate.service}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {assigning === rate.partner_id + rate.service ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
