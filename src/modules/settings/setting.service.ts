import { settingRepository } from "./setting.repository";
import { AppError } from "../../shared/utils/app-error";
import { auditLogger } from "../../shared/logger";

const ASYNC_TTL_MS = 60_000; // délai avant qu'un accesseur async ne redemande la DB

let memoryCache: Map<string, string> = new Map();
let lastLoadedAt = 0;

const refresh = async (): Promise<void> => {
  const rows = await settingRepository.findAll();
  const next = new Map<string, string>();
  for (const row of rows) next.set(row.key, row.value);
  memoryCache = next;
  lastLoadedAt = Date.now();
};

const ensureFreshAsync = async (): Promise<void> => {
  if (Date.now() - lastLoadedAt > ASYNC_TTL_MS) {
    await refresh();
  }
};

export const settingService = {
  // ── Warmup / refresh — voir server.ts et settings-refresh.job.ts ────────
  warmup: refresh,
  refresh,

  // ── Lecture brute (admin) ────────────────────────────────────────────────
  getAll: (category?: string) => settingRepository.findAll(category),
  getPublic: () => settingRepository.findPublic(),

  // ── Accesseurs asynchrones — à privilégier dans les services métier ─────
  // Toujours à jour à ~60s près (TTL), indépendants du warmup au démarrage.
  getString: async (key: string, fallback?: string): Promise<string> => {
    await ensureFreshAsync();
    const value = memoryCache.get(key);
    if (value !== undefined) return value;
    if (fallback !== undefined) return fallback;
    throw new AppError(`Setting "${key}" not found`, 500);
  },

  getNumber: async (key: string, fallback?: number): Promise<number> => {
    await ensureFreshAsync();
    const raw = memoryCache.get(key);
    if (raw !== undefined) {
      const num = Number(raw);
      if (!Number.isNaN(num)) return num;
    }
    if (fallback !== undefined) return fallback;
    throw new AppError(`Setting "${key}" not found or invalid`, 500);
  },

  getBoolean: async (key: string, fallback?: boolean): Promise<boolean> => {
    await ensureFreshAsync();
    const value = memoryCache.get(key);
    if (value !== undefined) return value === "true";
    if (fallback !== undefined) return fallback;
    throw new AppError(`Setting "${key}" not found`, 500);
  },

  getJSON: async <T>(key: string, fallback?: T): Promise<T> => {
    await ensureFreshAsync();
    const raw = memoryCache.get(key);
    if (raw !== undefined) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        /* tombe sur le fallback ci-dessous */
      }
    }
    if (fallback !== undefined) return fallback;
    throw new AppError(`Setting "${key}" not found or invalid`, 500);
  },

  // ── Accesseurs synchrones — pour les points d'entrée non-async ──────────
  // (pagination.ts, countries.ts, multer.ts). Lisent le snapshot mémoire TEL
  // QUEL, sans vérifier sa fraîcheur — nécessitent que warmup() ait tourné
  // au démarrage (server.ts) et s'appuient sur le cron de rafraîchissement
  // (settings-refresh.job.ts) pour rester à jour ensuite. Toujours fournir
  // un `fallback` : avant le premier warmup (tests, scripts) le cache est
  // vide et ces accesseurs doivent quand même renvoyer une valeur exploitable.
  getStringSync: (key: string, fallback: string): string =>
    memoryCache.get(key) ?? fallback,

  getNumberSync: (key: string, fallback: number): number => {
    const raw = memoryCache.get(key);
    if (raw === undefined) return fallback;
    const num = Number(raw);
    return Number.isNaN(num) ? fallback : num;
  },

  getBooleanSync: (key: string, fallback: boolean): boolean => {
    const raw = memoryCache.get(key);
    return raw === undefined ? fallback : raw === "true";
  },

  getJSONSync: <T>(key: string, fallback: T): T => {
    const raw = memoryCache.get(key);
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  // ── Écriture (admin) ──────────────────────────────────────────────────
  update: async (key: string, value: unknown, adminUserId: number) => {
    const existing = await settingRepository.findByKey(key);
    if (!existing) throw new AppError(`Setting "${key}" not found`, 404);

    const stringValue =
      existing.type === "JSON" ? JSON.stringify(value) : String(value);

    const updated = await settingRepository.upsert(
      key,
      stringValue,
      adminUserId,
    );
    await refresh(); // propage immédiatement, sans attendre le TTL/cron

    auditLogger.log("SETTINGS_UPDATED", {
      service: "settings",
      actor: { userId: adminUserId, role: "ADMIN" },
      target: { settingKey: key },
      metadata: { oldValue: existing.value, newValue: stringValue },
    });

    return updated;
  },

  updateMany: async (
    entries: { key: string; value: unknown }[],
    adminUserId: number,
  ) => {
    const existingRows = await settingRepository.findAll();
    const existingMap = new Map(existingRows.map((r) => [r.key, r]));

    const prepared = entries.map((e) => {
      const existing = existingMap.get(e.key);
      if (!existing) throw new AppError(`Setting "${e.key}" not found`, 404);
      return {
        key: e.key,
        value:
          existing.type === "JSON" ? JSON.stringify(e.value) : String(e.value),
      };
    });

    const updated = await settingRepository.upsertMany(prepared, adminUserId);
    await refresh();

    auditLogger.log("SETTINGS_UPDATED", {
      service: "settings",
      actor: { userId: adminUserId, role: "ADMIN" },
      metadata: { keys: prepared.map((p) => p.key) },
    });

    return updated;
  },
};
