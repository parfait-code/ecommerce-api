import { redis } from '../config/redis'
import { systemLogger } from '../logger'

const DEFAULT_TTL = 60 * 5 // 5 minutes

export const cache = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const data = await redis.get(key)
      if (!data) return null
      return JSON.parse(data) as T
    } catch (err) {
      systemLogger.error('REDIS_ERROR', {
        service: 'cache',
        metadata: {
          operation: 'get',
          key,
          error: (err as Error).message,
        },
      })
      // Dégradation gracieuse — on laisse la requête continuer sans cache
      return null
    }
  },

  set: async (key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> => {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttl)
    } catch (err) {
      systemLogger.error('REDIS_ERROR', {
        service: 'cache',
        metadata: {
          operation: 'set',
          key,
          error: (err as Error).message,
        },
      })
    }
  },

  del: async (...keys: string[]): Promise<void> => {
    if (keys.length === 0) return
    try {
      await redis.del(...keys)
    } catch (err) {
      systemLogger.error('REDIS_ERROR', {
        service: 'cache',
        metadata: {
          operation: 'del',
          keys,
          error: (err as Error).message,
        },
      })
    }
  },

  delByPattern: async (pattern: string): Promise<void> => {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) await redis.del(...keys)
    } catch (err) {
      systemLogger.error('REDIS_ERROR', {
        service: 'cache',
        metadata: {
          operation: 'delByPattern',
          pattern,
          error: (err as Error).message,
        },
      })
    }
  },
}