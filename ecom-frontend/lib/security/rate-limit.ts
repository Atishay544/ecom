import { NextRequest, NextResponse } from 'next/server'

/**
 * Frontend rate limiting (pass-through)
 * Backend (Railway) performs actual rate limiting via @upstash/ratelimit
 * This is kept for API route compatibility but doesn't enforce limits
 */
export async function rateLimit(
  _req: NextRequest,
  _limiterKey: string,
  _identifier?: string
): Promise<NextResponse | null> {
  // Pass through — backend enforces rate limits
  return null
}
