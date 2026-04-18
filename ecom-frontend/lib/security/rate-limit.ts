import { NextRequest, NextResponse } from 'next/server'

interface Window {
  count: number
  resetAt: number
}

// In-memory store — works on a single instance (adequate for Vercel serverless edge cache)
// For multi-region deployments, replace store with Upstash Redis
const store = new Map<string, Window>()

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  checkout:     { max: 10,  windowMs: 60_000 },   // 10 checkouts/min
  login:        { max: 5,   windowMs: 60_000 },   // 5 login attempts/min
  otp:          { max: 3,   windowMs: 300_000 },  // 3 OTPs per 5 min
  contact:      { max: 3,   windowMs: 60_000 },   // 3 contact submissions/min
  default:      { max: 30,  windowMs: 60_000 },   // 30 req/min fallback
}

// Prune expired entries every 5 minutes to prevent memory leak
let lastPrune = Date.now()
function pruneIfNeeded() {
  const now = Date.now()
  if (now - lastPrune < 300_000) return
  lastPrune = now
  for (const [k, v] of store) {
    if (v.resetAt < now) store.delete(k)
  }
}

export async function rateLimit(
  req: NextRequest,
  limiterKey: string,
  identifier?: string
): Promise<NextResponse | null> {
  pruneIfNeeded()

  const cfg = LIMITS[limiterKey] ?? LIMITS.default
  const ip  = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
         ?? req.headers.get('x-real-ip')
         ?? 'unknown'
  const key = `${limiterKey}:${identifier ?? ip}`
  const now = Date.now()

  let w = store.get(key)
  if (!w || w.resetAt < now) {
    w = { count: 0, resetAt: now + cfg.windowMs }
    store.set(key, w)
  }

  w.count++

  if (w.count > cfg.max) {
    const retryAfter = Math.ceil((w.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(cfg.max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(w.resetAt),
        },
      }
    )
  }

  return null
}
