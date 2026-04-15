import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  if (user.app_metadata?.role === 'admin') return admin
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return admin
}

interface MockRate {
  partner_id: string
  partner_name: string
  service: string
  estimated_days: string
  rate: number
  is_mock: boolean
}

const MOCK_RATES: Record<string, MockRate[]> = {
  delhivery: [
    { partner_id: 'delhivery', partner_name: 'Delhivery', service: 'Express', estimated_days: '2-3 days', rate: 85, is_mock: true },
    { partner_id: 'delhivery', partner_name: 'Delhivery', service: 'Surface', estimated_days: '5-7 days', rate: 60, is_mock: true },
  ],
  dtdc: [
    { partner_id: 'dtdc', partner_name: 'DTDC', service: 'Express', estimated_days: '2-3 days', rate: 90, is_mock: true },
    { partner_id: 'dtdc', partner_name: 'DTDC', service: 'Economy', estimated_days: '4-6 days', rate: 65, is_mock: true },
  ],
}

interface PageProps {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: PageProps) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Fetch order shipping address
  const { data: order } = await admin
    .from('orders')
    .select('shipping_address, total')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const address = order.shipping_address as any
  const toPin = address?.pincode ?? address?.zip ?? ''

  // Fetch all active delivery partners
  const { data: partners } = await admin
    .from('delivery_partners' as any)
    .select('*')
    .eq('is_active', true)

  const allRates: MockRate[] = []

  if (!partners || partners.length === 0) {
    // No partners configured — return all mock rates
    for (const rates of Object.values(MOCK_RATES)) {
      allRates.push(...rates)
    }
    return NextResponse.json({ rates: allRates, toPin })
  }

  for (const partner of partners as any[]) {
    const slug = partner.name?.toLowerCase()
    const hasCredentials = partner.api_key && partner.api_key.length > 5

    if (!hasCredentials) {
      // Return mock rates for this partner
      const mocks = MOCK_RATES[slug]
      if (mocks) {
        allRates.push(...mocks.map(r => ({ ...r, partner_id: partner.id, partner_name: partner.display_name })))
      } else {
        allRates.push({
          partner_id: partner.id,
          partner_name: partner.display_name,
          service: 'Standard',
          estimated_days: '3-5 days',
          rate: 75,
          is_mock: true,
        })
      }
      continue
    }

    // Real API calls (with credentials)
    try {
      if (slug === 'delhivery') {
        // Delhivery rate fetch (simplified — their actual rate API requires pickup pincode)
        const pickupPin = partner.pickup_pincode ?? '400001'
        const rateRes = await fetch(
          `https://track.delhivery.com/api/kinko/v0.2/pickup/pincode_availability/?md=S&ss=Delivered&d_pin=${toPin}&o_pin=${pickupPin}&cgm=500&pt=Pre-paid&cod=0`,
          {
            headers: { Authorization: `Token ${partner.api_key}`, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(5000),
          }
        )
        if (rateRes.ok) {
          const rateData = await rateRes.json()
          const surfaceRate = rateData?.data?.surface_rate ?? null
          const expressRate = rateData?.data?.express_rate ?? null
          if (expressRate) {
            allRates.push({ partner_id: partner.id, partner_name: partner.display_name, service: 'Express', estimated_days: '2-3 days', rate: expressRate, is_mock: false })
          }
          if (surfaceRate) {
            allRates.push({ partner_id: partner.id, partner_name: partner.display_name, service: 'Surface', estimated_days: '5-7 days', rate: surfaceRate, is_mock: false })
          }
          if (!expressRate && !surfaceRate) {
            allRates.push(...MOCK_RATES.delhivery!.map(r => ({ ...r, partner_id: partner.id, partner_name: partner.display_name })))
          }
        } else {
          allRates.push(...MOCK_RATES.delhivery!.map(r => ({ ...r, partner_id: partner.id, partner_name: partner.display_name })))
        }
      } else if (slug === 'dtdc') {
        // DTDC rate API
        const dtdcRes = await fetch(
          `https://blktapi.dtdc.com/rateCal/api/v1/rate-calculator?origin=${partner.pickup_pincode ?? '400001'}&destination=${toPin}&paymentMode=P&productType=NDX&weight=0.5`,
          {
            headers: { 'Client-Id': partner.account_code ?? '', 'Authorization': `Bearer ${partner.api_key}`, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(5000),
          }
        )
        if (dtdcRes.ok) {
          const dtdcData = await dtdcRes.json()
          const charges = dtdcData?.responseBody?.charges ?? []
          charges.forEach((c: any) => {
            allRates.push({ partner_id: partner.id, partner_name: partner.display_name, service: c.product ?? 'Standard', estimated_days: '3-5 days', rate: c.totalCharge ?? 75, is_mock: false })
          })
          if (charges.length === 0) {
            allRates.push(...MOCK_RATES.dtdc!.map(r => ({ ...r, partner_id: partner.id, partner_name: partner.display_name })))
          }
        } else {
          allRates.push(...MOCK_RATES.dtdc!.map(r => ({ ...r, partner_id: partner.id, partner_name: partner.display_name })))
        }
      } else {
        allRates.push({
          partner_id: partner.id,
          partner_name: partner.display_name,
          service: 'Standard',
          estimated_days: '3-5 days',
          rate: 75,
          is_mock: true,
        })
      }
    } catch {
      // API call failed — fall back to mock rates
      const mocks = MOCK_RATES[slug]
      if (mocks) {
        allRates.push(...mocks.map(r => ({ ...r, partner_id: partner.id, partner_name: partner.display_name })))
      }
    }
  }

  return NextResponse.json({ rates: allRates, toPin })
}
