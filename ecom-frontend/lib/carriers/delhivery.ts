/**
 * Delhivery ONE B2C API Client
 * Docs: https://one.delhivery.com/developer-portal/documents/b2c/
 * Auth: Authorization: Token <api_key>
 * Prod: https://track.delhivery.com
 * Test: https://staging-express.delhivery.com
 */

import type { CarrierConfig, CarrierRate, OrderShipmentInput, BookResult } from './types'

function base(cfg: CarrierConfig) {
  return (cfg.config?.base_url ?? 'https://track.delhivery.com').replace(/\/$/, '')
}

function auth(cfg: CarrierConfig) {
  return { Authorization: `Token ${cfg.api_key}` }
}

// ── 1. PINCODE SERVICEABILITY ─────────────────────────────────────────────

export interface PincodeResult {
  serviceable: boolean
  prepaid: boolean
  cod: boolean
  pincode: string
}

export async function delhiveryCheckPincode(
  cfg: CarrierConfig,
  pincode: string
): Promise<PincodeResult> {
  try {
    const res = await fetch(`${base(cfg)}/c/api/pin-codes/json/?filter_codes=${pincode}`, {
      headers: auth(cfg),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { serviceable: false, prepaid: false, cod: false, pincode }
    const data = await res.json()
    const codes = data?.delivery_codes ?? []
    if (!codes.length) return { serviceable: false, prepaid: false, cod: false, pincode }
    const p = codes[0]?.postal_code ?? {}
    return {
      serviceable: p.nz !== 'Y' && (p.pre_paid === 'Y' || p.cash === 'Y'),
      prepaid:     p.pre_paid === 'Y',
      cod:         p.cash === 'Y',
      pincode,
    }
  } catch {
    return { serviceable: false, prepaid: false, cod: false, pincode }
  }
}

// ── 2. CALCULATE SHIPPING COST ────────────────────────────────────────────

export async function delhiveryGetRates(
  cfg: CarrierConfig,
  fromPin: string,
  toPin: string,
  weightGrams: number,
  isCOD: boolean,
  dims?: import('./types').PackageDimensions
): Promise<CarrierRate[]> {
  if (!cfg.api_key || !fromPin || !toPin) return mockRates(cfg)

  // Volumetric weight: L × W × H (cm) / 5 = grams (Delhivery divisor 5000 cm³/kg → 5 cm³/g)
  const volGrams = dims ? Math.round((dims.length * dims.width * dims.height) / 5) : 0
  const chargedGrams = Math.max(500, weightGrams, volGrams)

  try {
    const makeUrl = (md: string) => {
      const u = new URL(`${base(cfg)}/api/v1/invoices/calculate`)
      u.searchParams.set('md', md)
      u.searchParams.set('cgm', String(chargedGrams))
      u.searchParams.set('o_pin', fromPin)
      u.searchParams.set('d_pin', toPin)
      u.searchParams.set('ss', 'Delivered')
      if (isCOD) u.searchParams.set('pt', 'COD')
      return u.toString()
    }

    const [expRes, surRes] = await Promise.all([
      fetch(makeUrl('E'), { headers: auth(cfg), signal: AbortSignal.timeout(6000) }),
      fetch(makeUrl('S'), { headers: auth(cfg), signal: AbortSignal.timeout(6000) }),
    ])

    const rates: CarrierRate[] = []

    if (expRes.ok) {
      const d = await expRes.json()
      const amount = d?.total_amount ?? d?.gross_amount
      if (amount) rates.push({
        carrier_id: cfg.id, carrier_name: cfg.display_name, carrier_slug: 'delhivery',
        service: 'Express', estimated_days: '2-3 days', rate: Number(amount),
        is_live: true, chargedGrams,
      })
    }
    if (surRes.ok) {
      const d = await surRes.json()
      const amount = d?.total_amount ?? d?.gross_amount
      if (amount) rates.push({
        carrier_id: cfg.id, carrier_name: cfg.display_name, carrier_slug: 'delhivery',
        service: 'Surface', estimated_days: '5-7 days', rate: Number(amount),
        is_live: true, chargedGrams,
      })
    }

    if (rates.length > 0) return rates

    // Log the raw responses for debugging
    console.warn('[delhivery-rates] No amount in response. fromPin:', fromPin, 'toPin:', toPin, 'chargedGrams:', chargedGrams)
    return mockRates(cfg)
  } catch (e: any) {
    console.warn('[delhivery-rates] fetch error:', e?.message)
    return mockRates(cfg)
  }
}

function mockRates(cfg: CarrierConfig): CarrierRate[] {
  return [
    { carrier_id: cfg.id, carrier_name: cfg.display_name, carrier_slug: 'delhivery', service: 'Express', estimated_days: '2-3 days', rate: 85, is_live: false, chargedGrams: 500 },
    { carrier_id: cfg.id, carrier_name: cfg.display_name, carrier_slug: 'delhivery', service: 'Surface', estimated_days: '5-7 days', rate: 60, is_live: false, chargedGrams: 500 },
  ]
}

// ── 3. CREATE SHIPMENT (Manifestation) ────────────────────────────────────

export async function delhiveryBookShipment(
  cfg: CarrierConfig,
  input: OrderShipmentInput
): Promise<BookResult> {
  if (!cfg.api_key) return { success: false, waybill: null, error: 'API key not configured' }
  if (!cfg.pickup_location_name?.trim()) {
    return { success: false, waybill: null, error: 'Pickup location not configured. Go to Admin → Carriers → Edit Delhivery → "Load My Warehouses" to select your registered pickup location.' }
  }

  const phone = input.customerPhone.replace(/\D/g, '').slice(-10)
  if (phone.length < 10) return { success: false, waybill: null, error: 'Customer phone number is missing or invalid (need 10 digits)' }

  const weightKg   = Math.max(0.5, input.weightGrams / 1000)    // Delhivery expects kg, min 0.5
  const orderDate  = input.orderDate.slice(0, 10)                // YYYY-MM-DD only
  const shortOrder = input.orderId.replace(/-/g, '').slice(0, 30) // Delhivery has length limits

  const shipmentData = {
    shipments: [{
      name:            input.customerName || 'Customer',
      add:             input.address || cfg.config?.pickup_address || '',
      pin:             input.pincode,
      city:            input.city,
      state:           input.state,
      country:         'India',
      phone,
      order:           shortOrder,
      payment_mode:    input.paymentMode,
      return_pin:      cfg.pickup_pincode ?? '',
      return_city:     cfg.config?.pickup_city ?? '',
      return_phone:    cfg.config?.pickup_phone ?? '',
      return_add:      cfg.config?.pickup_address ?? '',
      return_name:     cfg.config?.store_name ?? cfg.display_name,
      return_state:    cfg.config?.pickup_state ?? '',
      return_country:  'India',
      products_desc:   (input.productDesc || 'Products').slice(0, 100),
      hsn_code:        '',
      cod_amount:      input.paymentMode === 'COD' ? input.codAmount : 0,
      order_date:      orderDate,
      total_amount:    input.totalAmount,
      seller_add:      cfg.config?.pickup_address ?? '',
      seller_name:     cfg.config?.store_name ?? cfg.display_name,
      seller_inv:      shortOrder,
      seller_gst_tin:  cfg.config?.gst_number ?? '',
      quantity:        Math.max(1, input.items.reduce((s, i) => s + i.qty, 0)),
      waybill:         '',
      shipment_width:  12,
      shipment_height: 12,
      shipment_length: 12,
      weight:          weightKg,
      shipping_mode:   input.shippingMode === 'Express' ? 'Express' : 'Surface',
      address_type:    'home',
    }],
    pickup_location: { name: cfg.pickup_location_name ?? '' },
  }

  const form = new URLSearchParams()
  form.set('format', 'json')
  form.set('data', JSON.stringify(shipmentData))

  let json: any
  try {
    const res = await fetch(`${base(cfg)}/api/cmu/create.json`, {
      method: 'POST',
      headers: { ...auth(cfg), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(12000),
    })
    const text = await res.text()
    try { json = JSON.parse(text) } catch { return { success: false, waybill: null, error: `Delhivery non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}` } }
    if (!res.ok) {
      const msg = json?.error ?? json?.message ?? json?.rmk ?? `HTTP ${res.status}`
      return { success: false, waybill: null, error: `Delhivery error: ${msg}` }
    }
  } catch (e: any) {
    return { success: false, waybill: null, error: `Network error: ${e.message}` }
  }

  // Top-level remark (e.g. pickup location not found)
  if (json?.rmk && !json?.packages?.length) {
    return { success: false, waybill: null, error: `Delhivery: ${json.rmk}` }
  }

  const pkg = json?.packages?.[0]
  if (!pkg) return { success: false, waybill: null, error: `Unexpected response: ${JSON.stringify(json).slice(0, 300)}` }

  if (pkg.status !== 'Success' && pkg.status !== 'success') {
    const msg = pkg.error ?? pkg.remarks ?? pkg.status ?? 'Creation failed'
    return { success: false, waybill: null, error: `Delhivery: ${msg}` }
  }

  return { success: true, waybill: pkg.waybill ?? null }
}

// ── 4. UPDATE SHIPMENT ────────────────────────────────────────────────────

export interface ShipmentUpdateInput {
  waybill: string
  name?: string
  add?: string
  phone?: string
  cod?: number
  weight?: number
  length?: number
  width?: number
  height?: number
  product_details?: string
}

export async function delhiveryUpdateShipment(
  cfg: CarrierConfig,
  input: ShipmentUpdateInput
): Promise<{ success: boolean; error?: string }> {
  const form = new URLSearchParams()
  form.set('data', JSON.stringify(input))

  const res = await fetch(`${base(cfg)}/api/p/edit`, {
    method: 'POST',
    headers: { ...auth(cfg), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    signal: AbortSignal.timeout(8000),
  })
  const json = await res.json()
  return { success: json?.success === true || res.ok, error: json?.error }
}

// ── 5. CANCEL SHIPMENT ────────────────────────────────────────────────────

export async function delhiveryCancel(
  cfg: CarrierConfig,
  waybill: string
): Promise<boolean> {
  const form = new URLSearchParams()
  form.set('data', JSON.stringify({ waybill, cancellation: true }))

  const res = await fetch(`${base(cfg)}/api/p/edit`, {
    method: 'POST',
    headers: { ...auth(cfg), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    signal: AbortSignal.timeout(8000),
  })
  const json = await res.json()
  return json?.cancellation_status === true || json?.[waybill]?.cancellation_status === true
}

// ── 6. TRACK SHIPMENT ─────────────────────────────────────────────────────

export interface TrackScan {
  date: string
  status: string
  location: string
  instructions: string
}

export interface TrackResult {
  status: string
  edd: string | null
  scans: TrackScan[]
}

export async function delhiveryTrack(
  cfg: CarrierConfig,
  waybill: string
): Promise<TrackResult> {
  try {
    const res = await fetch(`${base(cfg)}/api/v1/packages/json/?waybill=${waybill}&verbose=1`, {
      headers: auth(cfg),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { status: 'Unknown', edd: null, scans: [] }
    const data  = await res.json()
    const ship  = data?.ShipmentData?.[0]?.Shipment
    const scans = (ship?.Scans ?? []).map((s: any) => ({
      date:         s.ScanDateTime ?? '',
      status:       s.ScanDetail?.Scan ?? '',
      location:     s.ScanDetail?.ScannedLocation ?? '',
      instructions: s.ScanDetail?.Instructions ?? '',
    }))
    return {
      status: ship?.Status?.Status ?? 'Unknown',
      edd:    ship?.EDD ?? null,
      scans,
    }
  } catch {
    return { status: 'Unknown', edd: null, scans: [] }
  }
}

// ── 7. NDR ACTIONS ────────────────────────────────────────────────────────

export type NDRAction = 'RE-ATTEMPT' | 'DEFER_DLV' | 'EDIT_DETAILS' | 'RTO'

export interface NDRInput {
  waybill: string
  action: NDRAction
  deferred_date?: string   // YYYY-MM-DD, required for DEFER_DLV
  name?: string            // for EDIT_DETAILS
  phone?: string
  add?: string
}

export async function delhiveryNDRAction(
  cfg: CarrierConfig,
  input: NDRInput
): Promise<{ success: boolean; error?: string }> {
  const payload: Record<string, any> = {
    waybill: input.waybill,
    act:     input.action,
  }
  if (input.deferred_date) payload.deferred_date = input.deferred_date
  if (input.name)          payload.name          = input.name
  if (input.phone)         payload.phone         = input.phone
  if (input.add)           payload.add           = input.add

  const res = await fetch(`${base(cfg)}/api/p/update`, {
    method: 'POST',
    headers: { ...auth(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  })
  const json = await res.json()
  return { success: json?.success === true || res.ok, error: json?.error ?? json?.message }
}

// ── 8. GENERATE SHIPPING LABEL ────────────────────────────────────────────

export async function delhiveryFetchLabel(
  cfg: CarrierConfig,
  waybill: string
): Promise<{ ok: boolean; buffer?: Buffer; contentType?: string; error?: string }> {
  try {
    const res = await fetch(`${base(cfg)}/api/p/packing_slip?wbns=${waybill}&pdf=true`, {
      headers: auth(cfg),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { ok: false, error: `Label fetch failed: ${res.status}` }
    return {
      ok:          true,
      buffer:      Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? 'application/pdf',
    }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

// ── 9. PICKUP REQUEST CREATION ────────────────────────────────────────────

export interface PickupRequest {
  warehouse_name: string
  pickup_date: string    // YYYY-MM-DD
  pickup_time: string    // HH:MM
  quantity: number
}

export async function delhiveryCreatePickup(
  cfg: CarrierConfig,
  req: PickupRequest
): Promise<{ success: boolean; pickup_id?: string; error?: string }> {
  const res = await fetch(`${base(cfg)}/fm/request/new/`, {
    method: 'POST',
    headers: { ...auth(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(10000),
  })
  const json = await res.json()
  if (!res.ok) return { success: false, error: json?.error ?? `HTTP ${res.status}` }
  return { success: true, pickup_id: json?.pickup_id ?? json?.id }
}

// ── 10, 11 & 12. WAREHOUSE MANAGEMENT ────────────────────────────────────

export interface WarehouseRecord {
  name: string        // the exact pickup_location name to use when booking
  address: string
  pin: string
  city: string
  state: string
  phone: string
}

export async function delhiveryListWarehouses(
  cfg: Pick<CarrierConfig, 'api_key' | 'config'>
): Promise<{ success: boolean; warehouses: WarehouseRecord[]; error?: string }> {
  try {
    const baseUrl = (cfg.config?.base_url ?? 'https://track.delhivery.com').replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/api/backend/clientwarehouse/`, {
      headers: { Authorization: `Token ${cfg.api_key}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { success: false, warehouses: [], error: `HTTP ${res.status}` }
    const json = await res.json()

    // Delhivery returns { data: [...] } or flat array
    const raw: any[] = json?.data ?? json?.warehouses ?? (Array.isArray(json) ? json : [])
    const warehouses: WarehouseRecord[] = raw.map((w: any) => ({
      name:    w.registered_name ?? w.name ?? w.warehouse_name ?? '',
      address: w.address ?? '',
      pin:     String(w.pin ?? w.pincode ?? ''),
      city:    w.city ?? '',
      state:   w.state ?? '',
      phone:   w.phone ?? w.contact_phone ?? '',
    })).filter(w => w.name)

    return { success: true, warehouses }
  } catch (e: any) {
    return { success: false, warehouses: [], error: e.message }
  }
}

export interface WarehouseInput {
  warehouse_name: string
  address: string
  pin: string
  city: string
  state: string
  phone: string
  gst_tin?: string
  contact_person: string
  email?: string
}

export async function delhiveryCreateWarehouse(
  cfg: CarrierConfig,
  input: WarehouseInput
): Promise<{ success: boolean; warehouse_id?: string; error?: string }> {
  const res = await fetch(`${base(cfg)}/api/backend/clientwarehouse/create/`, {
    method: 'POST',
    headers: { ...auth(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(10000),
  })
  const json = await res.json()
  if (!res.ok) return { success: false, error: json?.error ?? json?.message ?? `HTTP ${res.status}` }
  return { success: json?.success !== false, warehouse_id: json?.warehouse_id }
}

export async function delhiveryUpdateWarehouse(
  cfg: CarrierConfig,
  input: Partial<WarehouseInput> & { warehouse_name: string }
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${base(cfg)}/api/backend/clientwarehouse/edit/`, {
    method: 'POST',
    headers: { ...auth(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(10000),
  })
  const json = await res.json()
  return { success: json?.success !== false || res.ok, error: json?.error }
}

// ── TEST CONNECTION ───────────────────────────────────────────────────────

export async function delhiveryTestConnection(
  cfg: CarrierConfig
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${base(cfg)}/c/api/pin-codes/json/?filter_codes=110001`, {
      headers: auth(cfg),
      signal: AbortSignal.timeout(5000),
    })
    if (res.status === 401) return { ok: false, error: 'Invalid API token (401)' }
    if (!res.ok)            return { ok: false, error: `API returned ${res.status}` }
    const json = await res.json()
    if (!json?.delivery_codes) return { ok: false, error: 'Unexpected response format' }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
