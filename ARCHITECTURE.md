# ARCHITECTURE.md — Architecture de déploiement (VPS unique)

## Environnements

```
┌─────────────────────────────────────────────────────┐
│  DÉVELOPPEMENT (machine locale)                     │
│                                                     │
│  API Node.js (ts-node-dev, port 3000)               │
│    │                                                │
│    ├──► Neon.tech        (PostgreSQL, cloud gratuit)│
│    ├──► Upstash          (Redis, cloud gratuit)     │
│    └──► Cloudflare R2    (Stockage, cloud gratuit)  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  PRODUCTION (VPS)                                   │
│                                                     │
│  Cloudflare (SSL, DDoS, cache)                      │
│    └──► Nginx (reverse proxy)                       │
│           └──► API Node.js (Docker, port 3000)      │
│                  ├──► PostgreSQL (Docker)           │
│                  ├──► Redis     (Docker)            │
│                  └──► MinIO     (Docker)            │
└─────────────────────────────────────────────────────┘
```

## Structure des dossiers du projet

```
ecommerce-api/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── warehouses/
│   │   ├── inventory/
│   │   ├── products/
│   │   ├── reviews/
│   │   ├── basket/
│   │   ├── orders/
│   │   ├── checkout/
│   │   ├── payments/
│   │   ├── shipments/
│   │   └── notifications/
│   ├── shared/
│   │   ├── middlewares/     # auth, errorHandler, rateLimiter, validate
│   │   ├── utils/           # response, logger, pagination
│   │   ├── config/          # env, database, redis, storage
│   │   └── types/           # types globaux TypeScript
│   └── app.ts               # setup Express + routes
├── logs/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
│   ├── unit/
│   └── integration/
├── .env                     # dev local (gitignore)
├── .env.example             # template commité
├── .env.test                # base de test sur Neon (gitignore)
└── package.json
```

## Structure interne d'un module

```
src/modules/products/
├── product.router.ts       # définition des routes Express
├── product.controller.ts   # handlers HTTP (req/res)
├── product.service.ts      # logique métier
├── product.repository.ts   # accès Prisma (requêtes DB)
├── product.schema.ts       # schémas Zod (validation)
└── product.types.ts        # types locaux
```

## Variables d'environnement

```bash
# .env.example

NODE_ENV=development
PORT=3000

# ── Développement : services cloud gratuits ──────────────────────

# PostgreSQL — Neon.tech
# Format : postgresql://user:pass@ep-xxx.region.aws.neon.tech/ecommerce?sslmode=require
DATABASE_URL=

# Redis — Upstash
# Format : rediss://:token@xxx.upstash.io:6379
REDIS_URL=

# Stockage — Cloudflare R2 (compatible S3)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_PRODUCTS=products
R2_BUCKET_INVOICES=invoices
# Endpoint : https://<ACCOUNT_ID>.r2.cloudflarestorage.com

# ── Production : services Docker internes ────────────────────────
# (Ces variables remplacent les précédentes en prod)
# DATABASE_URL=postgresql://user:pass@postgres:5432/ecommerce
# REDIS_URL=redis://:pass@redis:6379
# MINIO_ENDPOINT=minio
# MINIO_PORT=9000
# MINIO_USER=minioadmin
# MINIO_PASSWORD=changeme

# ── Auth ──────────────────────────────────────────────────────────
JWT_SECRET=change_this_to_a_random_32char_string
JWT_EXPIRES_IN=3600

# ── Providers externes ────────────────────────────────────────────
STRIPE_SECRET_KEY=
PAYDUNYA_API_KEY=
AFRICASTALKING_API_KEY=
RESEND_API_KEY=
```

## Configuration dev local (sans Docker)

```bash
# Installation
npm install

# Migrations Prisma sur Neon
npx prisma migrate dev

# Lancer l'API en local
npm run dev   # ts-node-dev --respawn src/app.ts
```

```json
// package.json scripts
{
  "dev": "ts-node-dev --respawn --transpile-only src/app.ts",
  "build": "tsc",
  "start": "node dist/app.js",
  "test": "dotenv -e .env.test jest --runInBand",
  "test:watch": "dotenv -e .env.test jest --watch"
}
```

## Configuration du client S3 (compatible Neon R2 et MinIO)

```ts
// src/shared/config/storage.ts
import { S3Client } from '@aws-sdk/client-s3'
import { env } from './env'

// En dev : Cloudflare R2
// En prod : MinIO local via Docker
export const s3 = new S3Client({
  region: 'auto',
  endpoint: env.NODE_ENV === 'production'
    ? `http://minio:9000`
    : `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.NODE_ENV === 'production' ? env.MINIO_USER : env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.NODE_ENV === 'production' ? env.MINIO_PASSWORD : env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: env.NODE_ENV === 'production', // requis pour MinIO
})
```

## Tests

```bash
# .env.test
NODE_ENV=test
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/ecommerce_test?sslmode=require
REDIS_URL=rediss://:token@xxx.upstash.io:6379
JWT_SECRET=test_secret_key_32_characters_ok
```

Deux bases sur Neon : `ecommerce` (dev) et `ecommerce_test` (tests).
Avant chaque suite d'intégration : `prisma migrate reset --force --skip-seed`.

## Docker Compose — production (VPS uniquement)

```yaml
# docker-compose.prod.yml
version: '3.9'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api

  api:
    image: ${DOCKER_IMAGE}
    restart: unless-stopped
    env_file: .env.prod
    depends_on:
      - postgres
      - redis
      - minio

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ecommerce
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}

  minio:
    image: minio/minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

volumes:
  pg_data:
  minio_data:
```

## Configuration Nginx (production)

```nginx
upstream api { server api:3000; }

server {
    listen 80;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.ton-domaine.com;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
    limit_req zone=api burst=10 nodelay;

    location / {
        proxy_pass         http://api;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    location /storage/ {
        proxy_pass http://minio:9000/;
    }
}
```

## Flux de déploiement (production)

```
git push → GitHub Actions
   └─► npm test              (contre Neon test DB)
   └─► docker build + push → Docker Hub
   └─► ssh VPS
         └─► docker-compose -f docker-compose.prod.yml pull
         └─► docker-compose -f docker-compose.prod.yml up -d
         └─► npx prisma migrate deploy
```
