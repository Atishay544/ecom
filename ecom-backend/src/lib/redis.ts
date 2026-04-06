import Redis from 'ioredis'

let _redis: Redis | null = null

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL!, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
    })
    _redis.on('error', (err) => console.error('[Redis]', err.message))
  }
  return _redis
}
