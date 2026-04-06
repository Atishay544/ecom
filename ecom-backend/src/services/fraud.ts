import { supabase } from '../lib/supabase'

const DISPOSABLE_DOMAINS = ['mailinator.com','guerrillamail.com','tempmail.com','10minutemail.com','throwam.com','yopmail.com','trashmail.com']

export type FraudResult = { allowed: boolean; reason?: string }

export async function checkOrderFraud(userId: string, orderTotal: number, email: string, ip: string): Promise<FraudResult> {
  // 1. Velocity: > 3 orders in last hour
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await supabase.from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId).gte('created_at', hourAgo)
  if ((count ?? 0) >= 3) return { allowed: false, reason: 'order_velocity_exceeded' }

  // 2. Micro-transaction (card testing)
  if (orderTotal < 1) return { allowed: false, reason: 'suspicious_low_value' }

  // 3. Disposable email
  const domain = email.split('@')[1]?.toLowerCase()
  if (DISPOSABLE_DOMAINS.includes(domain)) return { allowed: false, reason: 'disposable_email' }

  return { allowed: true }
}

export async function logFraud(userId: string, reason: string, metadata: object, ip: string) {
  await supabase.from('fraud_log').insert({ user_id: userId, reason, metadata, ip })
}
