import { NextRequest, NextResponse } from 'next/server'
import Redis from 'ioredis'

// Railway Redis singleton — Vercel serverless optimized
let _redis: Redis | null = null
function getRedis(): Redis {
  if (!_redis) {
    // Socket timeout + connection timeout for serverless environment
    _redis = new Redis(process.env.REDIS_URL!, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      commandTimeout: 10000,
      socket: {
        reconnectStrategy: (times) => Math.min(times * 50, 2000),
      },
      enableReadyCheck: false,
      enableOfflineQueue: false,
    })

    _redis.on('error', (err) => console.error('Redis error:', err))
  }
  return _redis
}

// Sliding window via Redis sorted sets
async function slidingWindow(
  key: string, limit: number, windowMs: number
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const now = Date.now()
  const windowStart = now - windowMs

  try {
    const client = getRedis()
    const pipe = client.pipeline()
    pipe.zremrangebyscore(key, 0, windowStart)
    pipe.zadd(key, now, `${now}-${Math.random()}`)
    pipe.zcard(key)
    pipe.pexpire(key, windowMs)
    const res = await pipe.exec()
    const count = (res?.[2]?.[1] as number) ?? 0
    return { success: count <= limit, remaining: Math.max(0, limit - count), reset: now + windowMs }
  } catch (error) {
    // Fail open — don't block users if Redis is down
    console.error('Rate limit check failed:', error)
    return { success: true, remaining: limit, reset: now + windowMs }
  }
}

// [limit, windowMs]
const LIMITS = {
  api: [60, 60_000],
  auth: [5, 900_000],
  checkout: [3, 3_600_000],
  signup: [3, 3_600_000],
  passwordReset: [3, 3_600_000],
} as const

export async function rateLimit(
  req: NextRequest,
  limiterKey: keyof typeof LIMITS,
  identifier?: string
): Promise<NextResponse | null> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  const [limit, windowMs] = LIMITS[limiterKey]
  try {
    const { success, remaining, reset } = await slidingWindow(`rl:${limiterKey}:${identifier ?? ip}`, limit, windowMs)
    if (!success) {
      return NextResponse.json(
        { data: null, error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
            'Retry-After': String(Math.ceil(windowMs / 1000)),
          },
        }
      )
    }
  } catch { /* Redis down — fail open, don't block users */ }
  return null
}
