import { Request, Response, NextFunction } from 'express'
import { getRedis } from '../lib/redis'

async function slidingWindow(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const client = getRedis()
  const pipe = client.pipeline()
  pipe.zremrangebyscore(key, 0, now - windowMs)
  pipe.zadd(key, now, `${now}-${Math.random()}`)
  pipe.zcard(key)
  pipe.pexpire(key, windowMs)
  const res = await pipe.exec()
  const count = (res?.[2]?.[1] as number) ?? 0
  return { allowed: count <= limit, count, reset: now + windowMs }
}

const LIMITS: Record<string, [number, number]> = {
  api:           [60,  60_000],
  auth:          [5,   900_000],
  checkout:      [3,   3_600_000],
  signup:        [3,   3_600_000],
  passwordReset: [3,   3_600_000],
}

export function rateLimit(type: keyof typeof LIMITS = 'api') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown'
    const [limit, windowMs] = LIMITS[type]
    try {
      const { allowed, reset } = await slidingWindow(`rl:${type}:${ip}`, limit, windowMs)
      if (!allowed) {
        return res.status(429).json({ data: null, error: 'Too many requests. Please try again later.' })
      }
    } catch { /* Redis down — fail open */ }
    next()
  }
}
