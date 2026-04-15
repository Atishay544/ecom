'use client'

import { useState, useEffect } from 'react'

interface Partner {
  id: string
  name: string
  display_name: string
  api_key: string | null
  api_secret: string | null
  account_code: string | null
  pickup_location_name: string | null
  pickup_pincode: string | null
  is_active: boolean
  created_at: string
}

const PARTNER_OPTIONS = [
  { value: 'delhivery', label: 'Delhivery' },
  { value: 'dtdc',      label: 'DTDC' },
  { value: 'bluedart',  label: 'BlueDart' },
  { value: 'other',     label: 'Other' },
]

const PARTNER_EMOJIS: Record<string, string> = {
  delhivery: '🚚',
  dtdc:      '📦',
  bluedart:  '✈️',
  other:     '🏷️',
}

function maskKey(key: string | null) {
  if (!key) return '—'
  if (key.length <= 8) return '••••••••'
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}

const EMPTY_FORM = {
  name: '',
  display_name: '',
  api_key: '',
  api_secret: '',
  account_code: '',
  pickup_location_name: '',
  pickup_pincode: '',
  is_active: true,
}

export default function DeliveryPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    loadPartners()
  }, [])

  async function loadPartners() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/delivery-partners')
      const json = await res.json()
      setPartners(json.data ?? [])
    } catch {
      setError('Failed to load delivery partners')
    } finally {
      setLoading(false)
    }
  }

  function openAddForm() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setError(null)
    setShowForm(true)
  }

  function openEditForm(p: Partner) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      display_name: p.display_name,
      api_key: p.api_key ?? '',
      api_secret: p.api_secret ?? '',
      account_code: p.account_code ?? '',
      pickup_location_name: p.pickup_location_name ?? '',
      pickup_pincode: p.pickup_pincode ?? '',
      is_active: p.is_active,
    })
    setError(null)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const url = '/api/admin/delivery-partners'
      const method = editingId ? 'PATCH' : 'POST'
      const body = editingId ? { id: editingId, ...form } : form
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      await loadPartners()
      cancelForm()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(p: Partner) {
    try {
      await fetch('/api/admin/delivery-partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, is_active: !p.is_active }),
      })
      await loadPartners()
    } catch {
      setError('Failed to update partner status')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Delivery Partners</h1>
        <button
          onClick={openAddForm}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Add Partner
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {editingId ? 'Edit Partner' : 'Add Delivery Partner'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partner</label>
              <select
                value={form.name}
                onChange={e => {
                  const opt = PARTNER_OPTIONS.find(o => o.value === e.target.value)
                  setForm(f => ({ ...f, name: e.target.value, display_name: opt?.label ?? f.display_name }))
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select partner…</option>
                {PARTNER_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="e.g. Delhivery Express"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="text"
                value={form.api_key}
                onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                placeholder="API key from partner dashboard"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Secret</label>
              <input
                type="password"
                value={form.api_secret}
                onChange={e => setForm(f => ({ ...f, api_secret: e.target.value }))}
                placeholder="API secret / password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Code</label>
              <input
                type="text"
                value={form.account_code}
                onChange={e => setForm(f => ({ ...f, account_code: e.target.value }))}
                placeholder="DTDC client ID / Delhivery account"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location Name</label>
              <input
                type="text"
                value={form.pickup_location_name}
                onChange={e => setForm(f => ({ ...f, pickup_location_name: e.target.value }))}
                placeholder="Warehouse / store name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Pincode</label>
              <input
                type="text"
                value={form.pickup_pincode}
                onChange={e => setForm(f => ({ ...f, pickup_pincode: e.target.value }))}
                placeholder="e.g. 400001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
            </div>

            {error && (
              <div className="sm:col-span-2 text-sm text-red-600">{error}</div>
            )}

            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save Partner'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Partner Cards */}
      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
      ) : partners.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-yellow-800">No delivery partners configured yet.</p>
          <p className="text-xs text-yellow-700 mt-1">Click "Add Partner" to configure Delhivery, DTDC, or BlueDart.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {partners.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{PARTNER_EMOJIS[p.name] ?? '🏷️'}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{p.display_name}</p>
                    <p className="text-xs text-gray-400 capitalize">{p.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(p)}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                    p.is_active
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {p.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
              <div className="space-y-1.5 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">API Key</span>
                  <span className="font-mono">{maskKey(p.api_key)}</span>
                </div>
                {p.pickup_pincode && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Pickup PIN</span>
                    <span>{p.pickup_pincode}</span>
                  </div>
                )}
                {p.pickup_location_name && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Location</span>
                    <span className="truncate max-w-[120px]">{p.pickup_location_name}</span>
                  </div>
                )}
                {!p.api_key && (
                  <p className="text-yellow-600 text-xs mt-2">No API key — mock rates will be used</p>
                )}
              </div>
              <div className="mt-4">
                <button
                  onClick={() => openEditForm(p)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Setup Guide */}
      <div className="mt-8 bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowGuide(g => !g)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
        >
          <span>Setup Guide — How to get API keys</span>
          <span className="text-gray-400">{showGuide ? '▲' : '▼'}</span>
        </button>

        {showGuide && (
          <div className="px-5 pb-6 space-y-6 border-t border-gray-100">
            <div className="pt-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">🚚 Delhivery</h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Visit <span className="font-mono text-xs bg-gray-100 px-1 rounded">app.delhivery.com</span> and create a business account</li>
                <li>Go to Settings → API → Generate API Token</li>
                <li>Note your API Token and Pickup Location name from Settings → Pickup Locations</li>
                <li>Paste the token as "API Key" and your warehouse pincode as "Pickup Pincode"</li>
              </ol>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">📦 DTDC</h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Register at <span className="font-mono text-xs bg-gray-100 px-1 rounded">dtdc.com/register</span></li>
                <li>After approval, log in to the DTDC partner portal</li>
                <li>Navigate to API Access → Generate Credentials</li>
                <li>Copy your Client ID (Account Code) and API Bearer token (API Key)</li>
              </ol>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">✈️ BlueDart</h3>
              <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                <li>Visit <span className="font-mono text-xs bg-gray-100 px-1 rounded">bluedart.com</span> and contact sales for API access</li>
                <li>Once onboarded, access the BlueDart API portal</li>
                <li>Generate a License Key (API Key) and note your customer code</li>
              </ol>
            </div>

            <p className="text-xs text-gray-400">
              Until API keys are configured, the system uses mock rates for rate comparison. Orders can still be assigned to a partner manually.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
