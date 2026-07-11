import { redis } from "../config/redis";
import { systemLogger } from "../logger";
import { settingService } from "../../modules/settings/setting.service";
import { SETTING_KEYS } from "../../modules/settings/setting.constants";

export const cache = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err) {
      systemLogger.error("REDIS_ERROR", {
        service: "cache",
        metadata: {
          operation: "get",
          key,
          error: (err as Error).message,
        },
      });
      return null;
    }
  },

  set: async (key: string, value: unknown, ttl?: number): Promise<void> => {
    try {
      const effectiveTtl =
        ttl ??
        (await settingService.getNumber(
          SETTING_KEYS.CACHE_DEFAULT_TTL_SECONDS,
          300,
        ));
      await redis.set(key, JSON.stringify(value), "EX", effectiveTtl);
    } catch (err) {
      systemLogger.error("REDIS_ERROR", {
        service: "cache",
        metadata: {
          operation: "set",
          key,
          error: (err as Error).message,
        },
      });
    }
  },

  del: async (...keys: string[]): Promise<void> => {
    if (keys.length === 0) return;
    try {
      await redis.del(...keys);
    } catch (err) {
      systemLogger.error("REDIS_ERROR", {
        service: "cache",
        metadata: {
          operation: "del",
          keys,
          error: (err as Error).message,
        },
      });
    }
  },

  delByPattern: async (pattern: string): Promise<void> => {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    } catch (err) {
      systemLogger.error("REDIS_ERROR", {
        service: "cache",
        metadata: {
          operation: "delByPattern",
          pattern,
          error: (err as Error).message,
        },
      });
    }
  },
};
