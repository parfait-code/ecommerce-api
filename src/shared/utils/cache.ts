import { redis } from '../config/redis'

const DEFAULT_TTL = 60 * 5 // 5 minutes

export const cache = {
  get: async <T>(key: string): Promise<T | null> => {
    const data = await redis.get(key)
    if (!data) return null
    return JSON.parse(data) as T
  },

  set: async (key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> => {
    await redis.set(key, JSON.stringify(value), 'EX', ttl)
  },

  del: async (...keys: string[]): Promise<void> => {
    if (keys.length > 0) await redis.del(...keys)
  },

  delByPattern: async (pattern: string): Promise<void> => {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) await redis.del(...keys)
  },
}