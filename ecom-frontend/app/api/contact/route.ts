import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Simple in-memory rate limit: 3 requests per IP per hour
const rateMap = new Map<string, { count: number; reset: number }>()

function checkRate(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now > entry.reset) {
    rateMap.set(ip, { count: 1, reset: now + 3600_000 })
    return true
  }
  if (entry.count >= 3) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const { name, email, subject, message, order_id } = body

  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (message.trim().length > 1000) {
    return NextResponse.json({ error: 'Message too long (max 1000 characters)' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Create chat session as support ticket
  const sessionBody: Record<string, any> = {
    guest_name: name.trim(),
    guest_email: email.trim(),
    subject: subject.trim(),
    source: 'contact_form',
    status: 'open',
  }

  const { data: session, error: sessionErr } = await supabase
    .from('chat_sessions')
    .insert(sessionBody)
    .select('id')
    .single()

  if (sessionErr) {
    console.error('contact: session insert error', sessionErr)
    return NextResponse.json({ error: 'Failed to create support ticket' }, { status: 500 })
  }

  // First message with full details
  const fullMessage = [
    `Subject: ${subject.trim()}`,
    order_id ? `Order ID: ${order_id.trim()}` : null,
    '',
    message.trim(),
  ].filter(Boolean).join('\n')

  const { error: msgErr } = await supabase.from('chat_messages').insert({
    session_id: session.id,
    sender_role: 'customer',
    body: fullMessage,
  })

  if (msgErr) {
    console.error('contact: message insert error', msgErr)
    // Session was created — don't fail the whole request
  }

  return NextResponse.json({ success: true, session_id: session.id })
}
