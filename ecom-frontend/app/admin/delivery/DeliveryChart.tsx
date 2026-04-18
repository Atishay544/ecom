'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

export interface DayPoint {
  date: string       // YYYY-MM-DD
  revenue: number
  deliveryCost: number
  returns: number
  shipped: number
}

export interface OutForDeliveryOrder {
  id: string
  orderId: string
  awb: string
  partner: string
  customerName: string
  customerPhone: string
  total: number
  deliveryCost: number
}

export interface PartnerStat {
  name: string
  shipped: number
  delivered: number
  inTransit: number
  returned: number
  totalCost: number
  successRate: number
}

export interface DeliveryOrder {
  id: string
  orderId: string
  awb: string | null
  partner: string | null
  service: string | null
  status: string
  customerName: string
  customerPhone: string
  total: number
  deliveryCost: number
  date: string
  trackingStatus: string | null
}

interface Props {
  partners: string[]
  timeSeries: DayPoint[]
  partnerStats: PartnerStat[]
  outForDelivery: OutForDeliveryOrder[]
  orders: DeliveryOrder[]
  totalStats: {
    totalShipped: number
    inTransit: number
    outForDelivery: number
    delivered: number
    returned: number
    totalCost: number
    totalRevenue: number
    successRate: number
    avgCost: number
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function SvgChart({ data, width = 700, height = 220 }: { data: DayPoint[]; width?: number; height?: number }) {
  const pad = { t: 16, r: 16, b: 32, l: 60 }
  const W = width - pad.l - pad.r
  const H = height - pad.t - pad.b

  if (!data.length) return <div className="h-56 flex items-center justify-center text-sm text-gray-400">No data</div>

  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.deliveryCost, d.returns]), 1)
  const yTicks = 4
  const xStep = W / Math.max(data.length - 1, 1)

  const line = (key: keyof DayPoint) =>
    data.map((d, i) => `${pad.l + i * xStep},${pad.t + H - (Number(d[key]) / maxVal) * H}`).join(' ')

  const labelStep = Math.max(1, Math.floor(data.length / 6))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56" preserveAspectRatio="none">
      {/* Y gridlines */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const y = pad.t + (i / yTicks) * H
        const val = maxVal * (1 - i / yTicks)
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={pad.l + W} y2={y} stroke="#f0f0f0" />
            <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
              {val >= 1000 ? `₹${Math.round(val / 1000)}k` : `₹${Math.round(val)}`}
            </text>
          </g>
        )
      })}

      {/* X labels */}
      {data.map((d, i) => i % labelStep === 0 && (
        <text key={i} x={pad.l + i * xStep} y={height - 4} textAnchor="middle" fontSize={9} fill="#9ca3af">
          {d.date.slice(5)}
        </text>
      ))}

      {/* Revenue line */}
      <polyline fill="none" stroke="#22c55e" strokeWidth={2} points={line('revenue')} />
      {/* Delivery cost line */}
      <polyline fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 2" points={line('deliveryCost')} />
      {/* Returns line */}
      <polyline fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="2 2" points={line('returns')} />
    </svg>
  )
}

const STATUS_COLORS: Record<string, string> = {
  shipped:   'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  processing: 'bg-purple-100 text-purple-800',
}

export default function DeliveryDashboard({
  partners, timeSeries, partnerStats, outForDelivery, orders, totalStats,
}: Props) {
  const [selectedPartner, setSelectedPartner] = useState<string>('All')
  const [days, setDays] = useState<number>(30)

  const filteredOrders = useMemo(() => {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    return orders.filter(o => {
      if (selectedPartner !== 'All' && o.partner !== selectedPartner) return false
      return o.date >= cutoff
    })
  }, [orders, selectedPartner, days])

  const filteredSeries = useMemo(() => {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    return timeSeries.filter(d => d.date >= cutoff)
  }, [timeSeries, days])

  const filteredStats = useMemo(() => {
    if (selectedPartner === 'All') return totalStats
    const ps = partnerStats.find(p => p.name === selectedPartner)
    if (!ps) return totalStats
    return {
      totalShipped:    ps.shipped,
      inTransit:       ps.inTransit,
      outForDelivery:  0,
      delivered:       ps.delivered,
      returned:        ps.returned,
      totalCost:       ps.totalCost,
      totalRevenue:    0,
      successRate:     ps.successRate,
      avgCost:         ps.shipped > 0 ? ps.totalCost / ps.shipped : 0,
    }
  }, [selectedPartner, partnerStats, totalStats])

  const displayOfd = selectedPartner === 'All' ? outForDelivery : outForDelivery.filter(o => o.partner === selectedPartner)

  return (
    <div className="space-y-6">

      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Carrier performance, costs &amp; fulfilment tracking</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                days === d ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Partner filter tabs */}
      <div className="flex flex-wrap gap-2">
        {['All', ...partners].map(p => (
          <button
            key={p}
            onClick={() => setSelectedPartner(p)}
            className={`px-4 py-2 text-sm rounded-lg font-medium border transition-colors ${
              selectedPartner === p
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {p}
            {p !== 'All' && (
              <span className="ml-2 text-xs opacity-70">
                {partnerStats.find(s => s.name === p)?.shipped ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Shipped" value={filteredStats.totalShipped.toString()} sub="orders with AWB" color="blue" />
        <StatCard label="In Transit" value={filteredStats.inTransit.toString()} sub="awaiting delivery" color="indigo" />
        <StatCard label="Delivered" value={filteredStats.delivered.toString()} sub={`${filteredStats.successRate}% success rate`} color="green" />
        <StatCard label="Returned / RTO" value={filteredStats.returned.toString()} sub="cancelled with AWB" color="red" />
        <StatCard label="Total Delivery Cost" value={fmt(filteredStats.totalCost)} sub="carrier charges" color="blue" />
        <StatCard label="Avg Cost / Order" value={fmt(filteredStats.avgCost)} sub="per shipped order" color="gray" />
        {selectedPartner === 'All' && (
          <>
            <StatCard label="Shipped Revenue" value={fmt(filteredStats.totalRevenue)} sub="from shipped orders" color="green" />
            <StatCard label="Out for Delivery" value={filteredStats.outForDelivery.toString()} sub="→ call customer now" color="amber" alert={filteredStats.outForDelivery > 0} />
          </>
        )}
      </div>

      {/* Out for delivery alert — call now */}
      {displayOfd.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-amber-600 font-semibold text-sm">📞 Out for Delivery — Call customers now</span>
            <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{displayOfd.length}</span>
          </div>
          <div className="space-y-2">
            {displayOfd.slice(0, 10).map(o => (
              <div key={o.id} className="flex items-center justify-between bg-white border border-amber-100 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">{o.customerName}</p>
                  <p className="text-xs text-gray-500">{o.awb} · {o.partner} · {fmt(o.total)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/admin/orders/${o.id}`} className="text-xs text-blue-600 hover:underline">View</Link>
                  {o.customerPhone && (
                    <a href={`tel:${o.customerPhone}`}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 font-medium">
                      📞 Call
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Line chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800">Revenue vs Delivery Cost vs Returns</h2>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-green-500 inline-block" /> Revenue</span>
            <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-blue-500 inline-block border-dashed" style={{borderTop:'2px dashed #3b82f6', height:0}} /> Delivery Cost</span>
            <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-red-500 inline-block" /> Returns</span>
          </div>
        </div>
        <SvgChart data={filteredSeries} />
      </div>

      {/* Per-partner performance table */}
      {partnerStats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Carrier Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Carrier', 'Shipped', 'Delivered', 'In Transit', 'Returned', 'Success Rate', 'Total Cost', 'Avg Cost'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {partnerStats.map(ps => (
                  <tr key={ps.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{ps.name}</td>
                    <td className="px-4 py-3 text-gray-700">{ps.shipped}</td>
                    <td className="px-4 py-3 text-green-700 font-medium">{ps.delivered}</td>
                    <td className="px-4 py-3 text-indigo-700">{ps.inTransit}</td>
                    <td className="px-4 py-3 text-red-700">{ps.returned}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-20">
                          <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${ps.successRate}%` }} />
                        </div>
                        <span className="text-xs text-gray-600">{ps.successRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{fmt(ps.totalCost)}</td>
                    <td className="px-4 py-3 text-gray-700">{ps.shipped > 0 ? fmt(ps.totalCost / ps.shipped) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">
            Shipped Orders
            <span className="ml-2 text-xs text-gray-400 font-normal">({filteredOrders.length})</span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Order', 'Customer', 'Carrier', 'AWB', 'Status', 'Order Value', 'Delivery Cost', 'Date', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">No orders in this period</td>
                </tr>
              ) : filteredOrders.slice(0, 100).map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    <Link href={`/admin/orders/${o.id}`} className="hover:text-blue-600">
                      #{o.orderId.slice(-8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900 font-medium text-xs">{o.customerName}</p>
                    {o.customerPhone && (
                      <a href={`tel:${o.customerPhone}`} className="text-xs text-gray-400 hover:text-green-600">{o.customerPhone}</a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{o.partner ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.awb ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {o.status}
                    </span>
                    {o.trackingStatus && (
                      <p className="text-xs text-amber-600 mt-0.5">{o.trackingStatus}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{fmt(o.total)}</td>
                  <td className="px-4 py-3 text-gray-500">{o.deliveryCost > 0 ? fmt(o.deliveryCost) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{o.date}</td>
                  <td className="px-4 py-3">
                    {o.trackingStatus?.toLowerCase().includes('out') && o.customerPhone ? (
                      <a href={`tel:${o.customerPhone}`} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-lg border border-green-200 hover:bg-green-100 whitespace-nowrap">
                        📞 Call
                      </a>
                    ) : (
                      <Link href={`/admin/orders/${o.id}`} className="text-xs text-blue-500 hover:underline">View</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color, alert }: { label: string; value: string; sub: string; color: string; alert?: boolean }) {
  const palette: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    green:  'bg-green-50 text-green-700',
    red:    'bg-red-50 text-red-700',
    amber:  'bg-amber-50 text-amber-700',
    gray:   'bg-gray-50 text-gray-700',
  }
  return (
    <div className={`rounded-xl p-4 ${palette[color] ?? palette.gray} ${alert ? 'ring-2 ring-amber-400' : ''}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-60 mt-1">{sub}</p>
    </div>
  )
}
