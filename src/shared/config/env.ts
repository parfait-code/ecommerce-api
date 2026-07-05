import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  MIGRATE_DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.coerce.number().default(3600),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_PRODUCTS: z.string().default("products"),
  R2_BUCKET_INVOICES: z.string().default("invoices"),
  R2_ENDPOINT: z.string().optional(),
  // URL publique servant les objets du bucket produits (pub-xxxx.r2.dev en dev,
  // domaine/reverse-proxy Nginx → MinIO en prod). Distincte de l'endpoint S3
  // privé (R2_ACCOUNT_ID / R2_ENDPOINT) utilisé pour signer les requêtes PUT/DELETE.
  R2_PUBLIC_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
