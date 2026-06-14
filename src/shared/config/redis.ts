import Redis from 'ioredis'

let redisInstance: Redis | null = null

export const getRedis = (): Redis => {
  if (!redisInstance) {
    redisInstance = new Redis(process.env.REDIS_URL!)
    redisInstance.on('error', (err) => console.error('Redis error:', err))
  }
  return redisInstance
}

export const redis = new Proxy({} as Redis, {
  get: (_target, prop) => {
    const instance = getRedis()
    const value = instance[prop as keyof Redis]
    return typeof value === 'function' ? value.bind(instance) : value
  },
})