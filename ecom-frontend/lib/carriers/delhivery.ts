import type { CarrierConfig, CarrierRate, OrderShipmentInput, BookResult } from './types'

const PROD_BASE = 'https://track.delhivery.com'

function base(cfg: CarrierConfig) {
  return cfg.config?.base_url ?? PROD_BASE
}

function authHeader(cfg: CarrierConfig) {
  return { Authorization: `Token ${cfg.api_key}` }
}

export async function delhiveryGetRates(
  cfg: CarrierConfig,
  fromPin: string,
  toPin: string,
  weightGrams: number,
  isCOD: boolean
): Promise<CarrierRate[]> {
  if (!cfg.api_key || !fromPin || !toPin) {
    // Return mock rates — no credentials or pincode
    return [
      { carrier_id: cfg.id, carrier_name: cfg.display_name, carrier_slug: 'delhivery', service: 'Express', estimated_days: '2-3 days', rate: 85, is_live: false },
      { carrier_id: cfg.id, carrier_name: cfg.display_name, carrier_slug: 'delhivery', service: 'Surface', estimated_days: '5-7 days', rate: 60, is_live: false },
    ]
  }

  try {
    const url = new URL(`${base(cfg)}/api/kinko/v0.2/pickup/pincode_availability/`)
    url.searchParams.set('md', 'S')
    url.searchParams.set('ss', 'Delivered')
    url.searchParams.set('d_pin', toPin)
    url.searchParams.set('o_pin', fromPin)
    url.searchParams.set('cgm', String(Math.max(500, weightGrams)))
    url.searchParams.set('pt', isCOD ? 'COD' : 'Pre-paid')
    url.searchParams.set('cod', isCOD ? '1' : '0')

    const res = await fetch(url.toString(), {
      headers: { ...authHeader(cfg), 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(6000),
    })

    if (!res.ok) return mockRates(cfg)

    const data = await res.json()
    const d = data?.data ?? {}
    const rates: CarrierRate[] = []

    if (d.express_rate) {
      rates.push({ carrier_id: cfg.id, carrier_name: cfg.display_name, carrier_slug: 'delhivery', service: 'Express', estimated_days: '2-3 days', rate: Number(d.express_rate), is_live: true })
    }
    if (d.surface_rate) {
      rates.push({ carrier_id: cfg.id, carrier_name: cfg.display_name, carrier_slug: 'delhivery', service: 'Surface', estimated_days: '5-7 days', rate: Number(d.surface_rate), is_live: true })
    }

    return rates.length > 0 ? rates : mockRates(cfg)
  } catch {
    return mockRates(cfg)
  }
}

function mockRates(cfg: CarrierConfig): CarrierRate[] {
  return [
    { carrier_id: cfg.id, carrier_name: cfg.display_name, carrier_slug: 'delhivery', service: 'Express', estimated_days: '2-3 days', rate: 85, is_live: false },
    { carrier_id: cfg.id, carrier_name: cfg.display_name, carrier_slug: 'delhivery', service: 'Surface', estimated_days: '5-7 days', rate: 60, is_live: false },
  ]
}

export async function delhiveryBookShipment(
  cfg: CarrierConfig,
  input: OrderShipmentInput
): Promise<BookResult> {
  if (!cfg.api_key) {
    return { success: false, waybill: null, error: 'Delhivery API key not configured' }
  }

  const pickupPin  = cfg.pickup_pincode ?? ''
  const storeName  = cfg.config?.store_name ?? cfg.display_name
  const pickupAddr = cfg.config?.pickup_address ?? ''
  const pickupCity = cfg.config?.pickup_city ?? ''
  const pickupState = cfg.config?.pickup_state ?? ''
  const pickupPhone = cfg.config?.pickup_phone ?? ''
  const gst        = cfg.config?.gst_number ?? ''
  const locName    = cfg.pickup_location_name ?? ''

  const shipmentData = {
    shipments: [{
      name:            input.customerName,
      add:             input.address,
      pin:             input.pincode,
      city:            input.city,
      state:           input.state,
      country:         'India',
      phone:           input.customerPhone.replace(/\D/g, '').slice(-10),
      order:           input.orderId,
      payment_mode:    input.paymentMode,
      return_pin:      pickupPin,
      return_city:     pickupCity,
      return_phone:    pickupPhone,
      return_add:      pickupAddr,
      return_name:     storeName,
      return_state:    pickupState,
      return_country:  'India',
      products_desc:   input.productDesc.slice(0, 100),
      hsn_code:        '',
      cod_amount:      input.codAmount,
      order_date:      input.orderDate,
      total_amount:    input.totalAmount,
      seller_add:      pickupAddr,
      seller_name:     storeName,
      seller_inv:      input.orderId,
      quantity:        input.items.reduce((s, i) => s + i.qty, 0),
      waybill:         '',
      shipment_width:  12,
      shipment_height: 12,
      shipment_length: 12,
      weight:          input.weightGrams,
      seller_gst_tin:  gst,
      shipping_mode:   input.shippingMode,
      address_type:    'home',
    }],
    pickup_location: { name: locName },
  }

  const form = new URLSearchParams()
  form.set('format', 'json')
  form.set('data', JSON.stringify(shipmentData))

  const res = await fetch(`${base(cfg)}/api/cmu/create.json`, {
    method: 'POST',
    headers: { Authorization: `Token ${cfg.api_key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    signal: AbortSignal.timeout(10000),
  })

  const json = await res.json()
  const pkg  = json?.packages?.[0]

  if (!pkg) return { success: false, waybill: null, error: 'No package in response' }
  if (pkg.status !== 'Success' && pkg.status !== 'success') {
    return { success: false, waybill: null, error: pkg.error ?? pkg.remarks ?? 'Creation failed' }
  }

  return { success: true, waybill: pkg.waybill ?? null }
}

export async function delhiveryFetchLabel(
  cfg: CarrierConfig,
  waybill: string
): Promise<{ ok: boolean; buffer?: Buffer; contentType?: string; error?: string }> {
  const res = await fetch(`${base(cfg)}/api/p/packing_slip?wbns=${waybill}&pdf=true`, {
    headers: authHeader(cfg),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return { ok: false, error: `Label fetch failed: ${res.status}` }
  return { ok: true, buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? 'application/pdf' }
}

export async function delhiveryCancel(cfg: CarrierConfig, waybill: string) {
  const form = new URLSearchParams()
  form.set('data', JSON.stringify({ waybill, cancellation: true }))
  const res = await fetch(`${base(cfg)}/api/p/edit`, {
    method: 'POST',
    headers: { Authorization: `Token ${cfg.api_key ?? ''}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    signal: AbortSignal.timeout(8000),
  })
  const json = await res.json()
  return json?.cancellation_status === true || json?.[waybill]?.cancellation_status === true
}
