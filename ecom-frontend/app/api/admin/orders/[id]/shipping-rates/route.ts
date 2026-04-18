import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { getDelhiveryRates } from '@/lib/delhivery'

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

interface PageProps { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: PageProps) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  const { data: order } = await admin
    .from('orders')
    .select('shipping_address, total, metadata, order_items(quantity, snapshot)')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const addr      = (order as any).shipping_address as Record<string, string> ?? {}
  const meta      = ((order as any).metadata ?? {}) as Record<string, any>
  const toPin     = addr.pincode ?? addr.zip ?? ''
  const fromPin   = process.env.DELHIVERY_PICKUP_PINCODE ?? ''
  const isCOD     = meta.payment_method === 'cod' || meta.payment_method === 'cod_upfront'

  const orderItems = (order as any).order_items ?? []
  const weightGrams = orderItems.reduce((sum: number, item: any) => {
    return sum + ((item.snapshot?.weight_grams ?? 500) * (item.quantity ?? 1))
  }, 0)
  const weightKg = Math.max(0.5, weightGrams / 1000)

  const hasToken = !!process.env.DELHIVERY_API_TOKEN

  type RateRow = {
    partner_id: string; partner_name: string; service: string
    estimated_days: string; rate: number; is_mock: boolean
  }

  const rates: RateRow[] = []

  if (hasToken && toPin && fromPin) {
    const result = await getDelhiveryRates(fromPin, toPin, weightGrams, isCOD)

    if (result.serviceable) {
      if (result.express !== null) {
        rates.push({ partner_id: 'delhivery', partner_name: 'Delhivery', service: 'Express', estimated_days: '2-3 days', rate: result.express, is_mock: false })
      }
      if (result.surface !== null) {
        rates.push({ partner_id: 'delhivery', partner_name: 'Delhivery', service: 'Surface', estimated_days: '5-7 days', rate: result.surface, is_mock: false })
      }
    } else {
      // Pincode not serviceable
      return NextResponse.json({ rates: [], toPin, weightKg, error: `Pincode ${toPin} not serviceable by Delhivery` })
    }
  } else {
    // No token or pincode — return mock rates
    rates.push(
      { partner_id: 'delhivery', partner_name: 'Delhivery', service: 'Express', estimated_days: '2-3 days', rate: 85, is_mock: true },
      { partner_id: 'delhivery', partner_name: 'Delhivery', service: 'Surface', estimated_days: '5-7 days', rate: 60, is_mock: true },
    )
  }

  return NextResponse.json({ rates, toPin, weightKg })
}
