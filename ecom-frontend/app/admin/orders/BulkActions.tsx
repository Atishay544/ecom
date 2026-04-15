'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const ALL_STATUSES = [
  'pending',
  'confirmed',
  'cod_upfront_paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]

interface Order {
  id: string
  total: number
  status: string
  created_at: string
  user_id: string
  customerName: string | null
}

interface Props {
  initialOrders: Order[]
  statusFilter: string
  searchQuery: string
}

const STATUS_COLORS: Record<string, string> = {
  pending:          'bg-yellow-100 text-yellow-800',
  confirmed:        'bg-blue-100 text-blue-800',
  cod_upfront_paid: 'bg-teal-100 text-teal-800',
  processing:       'bg-purple-100 text-purple-800',
  shipped:          'bg-indigo-100 text-indigo-800',
  delivered:        'bg-green-100 text-green-800',
  cancelled:        'bg-red-100 text-red-800',
  refunded:         'bg-gray-100 text-gray-700',
}

export default function BulkActions({ initialOrders, statusFilter, searchQuery }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep in sync with server-rendered list when props change
  useEffect(() => {
    setOrders(initialOrders)
    setSelected(new Set())
  }, [initialOrders])

  // Client-side search filter
  const displayed = searchQuery
    ? orders.filter(o =>
        o.id.toLowerCase().startsWith(searchQuery.toLowerCase()) ||
        (o.customerName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : orders

  function toggleAll() {
    if (selected.size === displayed.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(displayed.map(o => o.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function applyBulk() {
    if (!bulkStatus || selected.size === 0) return
    setApplying(true)
    setError(null)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const ids = Array.from(selected)
      const { error } = await supabase
        .from('orders')
        .update({ status: bulkStatus, updated_at: new Date().toISOString() })
        .in('id', ids)
      if (error) throw error

      // Update local state
      setOrders(prev =>
        prev.map(o => selected.has(o.id) ? { ...o, status: bulkStatus } : o)
      )
      setSelected(new Set())
      setBulkStatus('')
    } catch (e: any) {
      setError(e.message ?? 'Bulk update failed')
    } finally {
      setApplying(false)
    }
  }

  const allChecked = displayed.length > 0 && selected.size === displayed.length
  const someChecked = selected.size > 0 && selected.size < displayed.length

  return (
    <>
      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={el => { if (el) el.indeterminate = someChecked }}
                    onChange={toggleAll}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Order ID</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Customer</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Total</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Date</th>
                <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(order => (
                <tr key={order.id} className={`border-b border-gray-100 hover:bg-gray-50 ${selected.has(order.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(order.id)}
                      onChange={() => toggleOne(order.id)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/admin/orders/${order.id}`} className="font-mono text-blue-600 hover:underline text-xs font-medium">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">
                    {order.customerName ?? <span className="text-gray-400 italic">Unknown</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    ₹{Number(order.total).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(order.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/admin/orders/${order.id}`} className="text-xs text-blue-600 hover:underline">
                      View
                    </a>
                  </td>
                </tr>
              ))}
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">No orders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating bulk actions bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-xl shadow-xl px-5 py-3 flex items-center gap-4 z-50">
          <span className="text-sm font-medium">{selected.size} order{selected.size !== 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Update Status:</span>
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value)}
              className="text-sm bg-gray-800 border border-gray-600 text-white rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select…</option>
              {ALL_STATUSES.map(s => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
            <button
              onClick={applyBulk}
              disabled={!bulkStatus || applying}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {applying ? 'Applying…' : 'Apply'}
            </button>
          </div>
          <button
            onClick={() => setSelected(new Set())}
            className="text-gray-400 hover:text-white text-lg leading-none"
          >
            ×
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </>
  )
}
