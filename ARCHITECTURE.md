# ARCHITECTURE — Architecture de déploiement (VPS unique)

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
│   │   ├── auth/                # Inscription / connexion
│   │   ├── users/                # Profil & gestion des utilisateurs (admin)
│   │   ├── categories/            # Catégories (hiérarchie, assets image/icône)
│   │   ├── attributes/            # Attributs produit & variante (par catégorie)
│   │   ├── products/             # Catalogue produits + images
│   │   ├── combinations/          # Combinaisons produit (variantes — remplace l'ancien ProductVariant)
│   │   ├── tags/                  # Tags produit
│   │   ├── basket/               # Panier
│   │   ├── orders/               # Commandes (inclut la création directe depuis panier — pas de module "checkout" séparé)
│   │   ├── payments/             # Paiements
│   │   ├── reviews/              # Avis produits
│   │   ├── warehouses/            # Entrepôts
│   │   ├── inventory/             # Stocks (multi-entrepôt, réservation FIFO)
│   │   ├── shipments/             # Expéditions, suivi, étiquettes, demandes d'enlèvement (pickup)
│   │   ├── shipping-methods/       # Méthodes de livraison & calcul de coût
│   │   ├── address/              # Adresses utilisateurs + validation
│   │   ├── promotions/            # Promotions, remises (discounts) & coupons
│   │   ├── loyalty/                # Programme de fidélité (points)
│   │   ├── wishlist/               # Liste de souhaits
│   │   ├── returns/                # Demandes de retour
│   │   └── dashboard/              # Statistiques admin
│   ├── shared/
│   │   ├── config/               # database (Prisma+Neon), env (Zod), redis (ioredis), storage (S3/R2)
│   │   ├── middlewares/          # auth-guard, admin-guard, validate, multer, error-handler,
│   │   │                         #   morgan, request-id, request-context, audit
│   │   ├── utils/                 # AppError, cache (Redis), pagination, response, upload (R2)
│   │   ├── logger/                 # access/business/audit/security/error/system loggers (Winston)
│   │   └── events/                 # Event bus interne (EventEmitter) + listeners par domaine
│   │       └── listeners/          # payment, return, shipment, inventory, combination, product, pickup
│   ├── app.ts                     # Configuration Express (middlewares, routers, event listeners)
│   └── server.ts                  # Point d'entrée (démarrage du serveur, graceful shutdown)
├── scripts/
│   └── create-admin.ts            # Script CLI de création d'un compte admin (npm run seed:admin)
├── logs/                          # Sorties Winston (access/business/audit/security/error/system/archive)
├── prisma/
│   ├── schema.prisma              # Schéma de la base de données
│   └── migrations/                 # Historique des migrations SQL
├── tests/
│   ├── unit/                       # Tests unitaires des services (mock des repositories)
│   ├── integration/                 # Tests d'intégration (Supertest sur l'app réelle)
│   │   └── setup/                    # Helpers partagés : app (supertest), auth (JWT de test), db (seed/cleanup)
│   ├── mocks/
│   │   └── factories.ts             # Factories de données de test (makeUser, makeProduct, etc.)
│   └── setup.ts                     # Chargement de `.env.test`, config Jest globale
├── prisma.config.ts               # Config Prisma 7 (chemin schéma/migrations, datasource migrations)
├── .env                            # dev local (gitignore)
├── .env.example                    # template commité
├── .env.test                       # base de test sur Neon (gitignore)
└── package.json
```

Chaque module suit la même architecture en couches :

```
*.router.ts       → définit les routes Express et applique les middlewares
*.controller.ts   → reçoit la requête HTTP, appelle le service, formate la réponse
*.service.ts      → logique métier (règles, cache, event bus, erreurs)
*.repository.ts   → accès aux données via Prisma
*.schema.ts        → schémas de validation Zod + types DTO
*.state-machine.ts → (optionnel) transitions de statut valides — voir order/payment
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

# URL utilisée spécifiquement par Prisma pour exécuter les migrations
# (voir prisma.config.ts) — peut être identique à DATABASE_URL, ou une
# connexion directe (non poolée) si DATABASE_URL passe par un pooler.
MIGRATE_DATABASE_URL=

# Redis — Upstash
# Format : rediss://:token@xxx.upstash.io:6379
REDIS_URL=

# Stockage — Cloudflare R2 (compatible S3)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_PRODUCTS=products
R2_BUCKET_INVOICES=invoices
R2_ENDPOINT=
# URL PUBLIQUE de lecture du bucket produits — distincte de l'endpoint S3 privé
# ci-dessus (qui sert à signer les requêtes PUT/DELETE). Utilisée pour construire
# les URLs retournées par uploadImage() (produits, promotions, catégories) et
# pour retrouver la clé d'objet à supprimer dans deleteImage().
# Dev  : https://pub-xxxxxxxx.r2.dev
# Prod : https://cdn.votredomaine.com (Nginx → MinIO, ou domaine custom R2)
R2_PUBLIC_URL=

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

# ── Providers externes (non consommés par le code actuel) ────────
STRIPE_SECRET_KEY=
PAYDUNYA_API_KEY=
AFRICASTALKING_API_KEY=
RESEND_API_KEY=
```

Variables validées via Zod dans `src/shared/config/env.ts` :

| Variable | Obligatoire | Défaut | Notes |
|---|---|---|---|
| `NODE_ENV` | oui | — | `development` \| `test` \| `production` |
| `PORT` | non | `3000` | coercé en nombre |
| `DATABASE_URL` | oui | — | chaîne de connexion PostgreSQL |
| `MIGRATE_DATABASE_URL` | non | — | utilisée uniquement par `prisma.config.ts` |
| `REDIS_URL` | oui | — | — |
| `JWT_SECRET` | oui | — | minimum 32 caractères |
| `JWT_EXPIRES_IN` | non | `3600` | coercé en nombre (secondes) |
| `R2_ACCOUNT_ID` | non | — | requis en pratique si upload utilisé |
| `R2_ACCESS_KEY_ID` | non | — | idem |
| `R2_SECRET_ACCESS_KEY` | non | — | idem |
| `R2_BUCKET_PRODUCTS` | non | `products` | — |
| `R2_BUCKET_INVOICES` | non | `invoices` | non consommé par le code actuel |
| `R2_ENDPOINT` | non | — | non consommé directement — `storage.ts` construit l'endpoint depuis `R2_ACCOUNT_ID` |
| `R2_PUBLIC_URL` | non | — | doit être une URL valide (`.url()`) — **requise en pratique** pour tout upload d'image (produit/promotion/catégorie), sinon `uploadImage()` lève une `AppError 500` |

⚠️ **Note de cohérence** : `src/shared/config/storage.ts` construit systématiquement le client S3 à partir de `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` (Cloudflare R2), quel que soit `NODE_ENV` — il n'existe actuellement **aucune bascule conditionnelle vers MinIO** dans le code, malgré ce que suggèrent les sections Docker Compose/Nginx de ce document plus bas. Si une bascule R2 ↔ MinIO en production est requise, elle doit encore être implémentée dans `storage.ts`.

## Configuration dev local (sans Docker)

```bash
# Installation
npm install

# Migrations Prisma sur Neon
npx prisma migrate dev

# Lancer l'API en local
npm run dev   # ts-node-dev --respawn --transpile-only src/server.ts
```

```json
// package.json scripts
{
  "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js",
  "seed:admin": "tsx scripts/create-admin.ts",
  "test": "dotenv -e .env.test jest --runInBand",
  "test:unit": "dotenv -e .env.test jest --runInBand tests/unit",
  "test:integration": "dotenv -e .env.test jest --runInBand tests/integration",
  "test:watch": "dotenv -e .env.test jest --watch"
}
```

## Configuration du client S3 (compatible Neon R2 et MinIO)

```ts
// src/shared/config/storage.ts
import { S3Client } from '@aws-sdk/client-s3'

// Implémentation actuelle — toujours Cloudflare R2, quel que soit NODE_ENV.
export const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
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
```