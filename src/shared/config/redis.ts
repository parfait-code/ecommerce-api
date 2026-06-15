import Redis from 'ioredis'
import { logger } from './logger'

let redisInstance: Redis | null = null

export const getRedis = (): Redis => {
  if (!redisInstance) {
    redisInstance = new Redis(process.env.REDIS_URL!)
    redisInstance.on('error', (err) =>
      logger.error('Redis connection error', { error: err.message }),
    )
    redisInstance.on('connect', () => logger.info('Redis connected'))
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