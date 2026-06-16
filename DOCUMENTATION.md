# E-commerce API — Documentation

API REST pour une plateforme e-commerce, construite avec **Express 5**, **TypeScript**, **Prisma 7** (PostgreSQL via Neon), **Redis** (cache) et **Cloudflare R2** (stockage d'images).

---

## 1. Présentation

L'application expose une API permettant de gérer :

- l'authentification et les utilisateurs (rôles `user` / `admin`)
- le catalogue de produits (avec upload d'images)
- le panier d'achat
- les commandes et le checkout
- les paiements
- les avis clients (reviews)
- la gestion des adresses
- la logistique : entrepôts, inventaire, expéditions et demandes d'enlèvement (pickup)

Toutes les réponses suivent un format JSON homogène et la devise utilisée pour les montants est le **XAF** (franc CFA).

---

## 2. Stack technique

| Domaine | Technologie |
|---|---|
| Framework HTTP | Express 5 |
| Langage | TypeScript |
| ORM / Base de données | Prisma 7 + adapter Neon (PostgreSQL serverless) |
| Cache | Redis (via `ioredis`) |
| Authentification | JWT (`jsonwebtoken`) + `bcryptjs` |
| Validation | Zod |
| Upload de fichiers | Multer (stockage mémoire) |
| Stockage objets | Cloudflare R2 (via `@aws-sdk/client-s3`) |
| Sécurité HTTP | Helmet, CORS, express-rate-limit |
| Logs | Winston |
| Tests | Jest + Supertest |

---

## 3. Structure du projet

```
src/
├── app.ts                  # Configuration Express (middlewares, routers)
├── server.ts                # Point d'entrée (démarrage du serveur)
├── modules/
│   ├── auth/                # Inscription / connexion
│   ├── users/                # Profil & gestion des utilisateurs
│   ├── products/             # Catalogue produits + images
│   ├── basket/               # Panier
│   ├── orders/               # Commandes
│   ├── checkout/             # Tunnel de commande
│   ├── payments/             # Paiements
│   ├── reviews/              # Avis produits
│   ├── warehouses/            # Entrepôts
│   ├── inventory/             # Stocks
│   ├── shipments/             # Expéditions, suivi, pickup
│   └── address/              # Adresses utilisateurs
└── shared/
    ├── config/               # database, env, redis, storage (R2)
    ├── middlewares/          # auth-guard, admin-guard, validate, multer, error-handler
    └── utils/                # AppError, cache, pagination, response, upload

prisma/
├── schema.prisma            # Schéma de la base de données
└── migrations/               # Historique des migrations SQL

tests/
├── unit/                     # Tests unitaires des services (mock des repositories)
├── integration/              # Tests d'intégration (via Supertest sur l'app)
└── setup.ts                  # Chargement de `.env.test`
```

Chaque module suit la même architecture en couches :

```
*.router.ts       → définit les routes Express et applique les middlewares
*.controller.ts   → reçoit la requête HTTP, appelle le service, formate la réponse
*.service.ts      → logique métier (règles, cache, erreurs)
*.repository.ts   → accès aux données via Prisma
*.schema.ts        → schémas de validation Zod + types DTO
```

---

## 4. Installation & démarrage

### Prérequis

- Node.js 20+
- Une base PostgreSQL (ex : Neon)
- Une instance Redis (ex : Upstash)
- (Optionnel) Un bucket Cloudflare R2 pour les images produits

### Étapes

```bash
# 1. Installer les dépendances
npm install

# 2. Copier le fichier d'environnement et le compléter
cp .env.example .env

# 3. Appliquer les migrations Prisma
npx prisma migrate deploy

# 4. Générer le client Prisma
npx prisma generate

# 5. Lancer le serveur en mode développement
npm run dev
```

### Scripts disponibles

| Script | Commande | Description |
|---|---|---|
| `npm run dev` | `ts-node-dev --respawn --transpile-only src/server.ts` | Démarre le serveur avec rechargement automatique |
| `npm run build` | `tsc` | Compile le projet TypeScript dans `dist/` |
| `npm start` | `node dist/server.js` | Démarre le serveur compilé |
| `npm test` | `dotenv -e .env.test jest --runInBand` | Exécute les tests avec les variables de `.env.test` |
| `npm run test:watch` | `dotenv -e .env.test jest --watch` | Exécute les tests en mode watch |

---

## 5. Variables d'environnement

Définies et validées dans `src/shared/config/env.ts` (via Zod).

| Variable | Obligatoire | Défaut | Description |
|---|---|---|---|
| `NODE_ENV` | oui | — | `development` \| `test` \| `production` |
| `PORT` | non | `3000` | Port d'écoute du serveur |
| `DATABASE_URL` | oui | — | Chaîne de connexion PostgreSQL (Neon) |
| `MIGRATE_DATABASE_URL` | non | — | URL utilisée par Prisma pour les migrations |
| `REDIS_URL` | oui | — | Chaîne de connexion Redis (Upstash) |
| `JWT_SECRET` | oui | — | Secret JWT (minimum 32 caractères) |
| `JWT_EXPIRES_IN` | non | `3600` | Durée de validité du token (en secondes) |
| `R2_ACCOUNT_ID` | non | — | Identifiant de compte Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | non | — | Clé d'accès R2 |
| `R2_SECRET_ACCESS_KEY` | non | — | Clé secrète R2 |
| `R2_BUCKET_PRODUCTS` | non | `products` | Bucket pour les images produits |
| `R2_BUCKET_INVOICES` | non | `invoices` | Bucket pour les factures |
| `R2_ENDPOINT` | non | — | Endpoint personnalisé R2 |

D'autres clés sont prévues dans `.env.example` pour de futurs fournisseurs externes (`STRIPE_SECRET_KEY`, `PAYDUNYA_API_KEY`, `AFRICASTALKING_API_KEY`, `RESEND_API_KEY`) mais ne sont pas encore consommées par le code.

---

## 6. Modèle de données

Principales entités définies dans `prisma/schema.prisma` :

| Modèle | Description | Champs clés |
|---|---|---|
| `User` | Compte utilisateur | `username`, `email`, `password` (hashé), `role` (`user`/`admin`) |
| `Product` | Produit du catalogue | `name`, `price`, `category`, `stock`, `images[]` |
| `Basket` / `BasketItem` | Panier d'un utilisateur et ses lignes | `userId`, `productId`, `quantity` |
| `Order` / `OrderItem` | Commande et ses lignes | `status`, `shippingAddress`, `billingAddress`, `totalAmount` |
| `Checkout` | Étape intermédiaire entre panier et commande | `status` (`PENDING`/`COMPLETED`), `items`, `orderId` |
| `Payment` | Paiement lié à une commande | `method` (enum `PaymentMethod`), `status` (enum `PaymentStatus`), `amount`, `currency` |
| `Review` | Avis sur un produit | `productId`, `userId`, `rating`, `comment` (unique par produit/utilisateur) |
| `Warehouse` | Entrepôt | `name`, `location`, `capacity` |
| `Inventory` | Stock d'un produit dans un entrepôt | `productId`, `warehouseId`, `quantity` (unique par couple produit/entrepôt) |
| `Shipment` | Expédition | `status` (enum `ShipmentStatus`), `trackingNumber`, `estimatedDeliveryDate` |
| `TrackingEvent` | Événement de suivi d'une expédition | `shipmentId`, `status`, `location` |
| `ShippingLabel` | Étiquette d'expédition générée | `shipmentId`, `labelUrl` |
| `PickupRequest` | Demande d'enlèvement | `userId`, `pickupDate`, `pickupAddress`, `status` (enum `PickupStatus`) |
| `Address` | Adresse d'un utilisateur | `street`, `city`, `country`, `postalCode`, `isDefault` |

---

## 7. Authentification & autorisation

L'authentification repose sur des **JWT** signés avec `JWT_SECRET`.

- `authGuard` (`src/shared/middlewares/auth-guard.ts`) : exige un header `Authorization: Bearer <token>`. Le token est vérifié et décodé en `req.user` (`{ userId, username, role }`). Retourne `401` si absent ou invalide.
- `adminGuard` (`src/shared/middlewares/admin-guard.ts`) : exige `req.user.role === 'admin'`. Retourne `403` sinon. Doit toujours être utilisé après `authGuard`.

Le token est obtenu via `POST /signup` ou `POST /login` et doit être transmis dans toutes les routes protégées.

---

## 8. Format des réponses & gestion des erreurs

### Réponse en cas de succès

```json
{
  "status": true,
  "data": { /* ... */ }
}
```

### Réponse en cas d'erreur

```json
{
  "status": false,
  "error": { "message": "Description de l'erreur" }
}
```

Les erreurs métier sont levées via la classe `AppError(message, statusCode)` (`src/shared/utils/app-error.ts`) et interceptées par `errorHandler` (`src/shared/middlewares/error-handler.ts`), qui renvoie le code HTTP approprié. Toute erreur non gérée renvoie `500 Internal server error`.

Les erreurs de validation des entrées (via le middleware `validate` + Zod) renvoient `400` avec le détail des champs invalides :

```json
{
  "status": false,
  "error": { "message": "Validation failed", "details": { /* erreurs Zod */ } }
}
```

---

## 9. Cache Redis

Le module `src/shared/utils/cache.ts` fournit un cache générique (`get`, `set`, `del`, `delByPattern`) avec une **TTL par défaut de 5 minutes**.

Il est utilisé pour réduire la charge sur la base de données dans :

- `productService` (listes paginées et produits individuels — invalidé sur création/mise à jour/suppression/upload d'image)
- `warehouseService` (liste et entrepôt individuel — invalidé sur création/mise à jour/suppression)
- `orderService` (liste filtrée et commande individuelle — invalidé sur création/mise à jour/changement de statut/suppression)

---

## 10. Stockage des fichiers (Cloudflare R2)

Le module `src/shared/utils/upload.ts` gère l'upload et la suppression d'images produits sur un bucket **Cloudflare R2** (compatible S3) :

- `uploadImage(file, folder)` : génère un nom de fichier unique (`crypto.randomUUID()`), envoie le fichier sur R2 et retourne son URL publique.
- `deleteImage(url)` : extrait la clé de l'objet à partir de l'URL et le supprime du bucket.

Le middleware `multer` (`src/shared/middlewares/multer.ts`) limite les uploads à **5 Mo** et n'accepte que les types `image/jpeg`, `image/png`, `image/webp`, `image/gif`.

---

## 11. Documentation des endpoints

### 11.1 Authentification (`auth`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/signup` | — | Crée un compte (`username`, `email`, `password`, `firstName`, `lastName`, `age`, `role?`). Retourne `{ user, token }`. Erreurs `409` si username/email déjà pris. |
| POST | `/login` | — | Connexion (`username`, `password`). Retourne `{ user, token }`. Erreur `400` si identifiants invalides. |

### 11.2 Utilisateurs (`users`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/user` | Utilisateur | Profil de l'utilisateur connecté (sans mot de passe) |
| PATCH | `/user` | Utilisateur | Met à jour le profil (`email?`, `firstName?`, `lastName?`, `age?`) |
| GET | `/user/all` | Admin | Liste tous les utilisateurs |
| PATCH | `/user/change-role/:userId` | Admin | Change le rôle d'un utilisateur (`role`: `user`\|`admin`) |
| DELETE | `/user/:userId` | Admin | Supprime un utilisateur |

### 11.3 Produits (`products`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/product` | — | Liste paginée des produits (`page`, `limit`) |
| GET | `/product/:productId` | — | Détail d'un produit |
| POST | `/product` | Admin | Crée un produit (`name`, `description?`, `price`, `category`, `stock`, `images[]`) |
| PATCH | `/product/:productId` | Admin | Mise à jour partielle d'un produit |
| DELETE | `/product/:productId` | Admin | Supprime un produit |
| POST | `/product/:productId/images` | Admin | Upload jusqu'à 5 images (champ `images`, multipart/form-data) |
| DELETE | `/product/:productId/images` | Admin | Supprime une image (`imageUrl` dans le body) |

### 11.4 Panier (`basket`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/basket` | Utilisateur | Crée un nouveau panier |
| GET | `/basket/:basket_id` | Utilisateur | Récupère un panier avec ses lignes |
| POST | `/basket/:basket_id/product` | Utilisateur | Ajoute un produit (`product_id`, `quantity`) — incrémente si déjà présent |
| PUT | `/basket/:basket_id/product/quantity` | Utilisateur | Modifie la quantité d'un produit (`product_id`, `quantity`) |
| DELETE | `/basket/:basket_id/product` | Utilisateur | Retire un produit du panier (`product_id`) |

### 11.5 Commandes (`orders`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/orders` | Utilisateur | Liste paginée et filtrable (`status?`, `customer?`, `page?`, `limit?`) |
| POST | `/orders` | Utilisateur | Crée une commande (`items[]`, `shippingAddress`, `billingAddress?`, `paymentMethodId?`, `notes?`, `couponCode?`) — calcule le total à partir des prix produits |
| GET | `/orders/:orderId` | Utilisateur | Détail d'une commande |
| PUT | `/orders/:orderId` | Utilisateur | Met à jour adresse(s) / notes |
| DELETE | `/orders/:orderId` | Utilisateur | Supprime/annule une commande |
| GET | `/orders/:orderId/status` | Utilisateur | Détail de la commande (alias de getById) |
| PUT | `/orders/:orderId/status` | Utilisateur | Met à jour le statut (`PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`) et les infos de transport |

### 11.6 Checkout (`checkout`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/checkout` | Utilisateur | Crée un checkout à partir d'un panier (`basket_id`, `shipping_address`, `billing_address?`, `payment_method_id?`). Erreur `400` si panier vide. |
| GET | `/checkout/:checkout_id` | Utilisateur | Détail d'un checkout |
| POST | `/checkout/:checkout_id/complete` | Utilisateur | Finalise le checkout : crée la commande correspondante et marque le checkout `COMPLETED`. Erreurs `403` si non propriétaire, `400` si déjà complété. |

### 11.7 Paiements (`payments`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/payment-methods` | — | Liste les moyens de paiement disponibles. Seul `CASH_ON_DELIVERY` est actif ; `PAYPAL`, `STRIPE`, `CINETPAY` sont marqués `available: false`. |
| POST | `/payments` | Utilisateur | Crée un paiement (`order_id`, `method`, `currency?`, `notes?`). Renvoie `503` si la méthode n'est pas disponible. Met la commande au statut `CONFIRMED`. |
| GET | `/payments/:payment_id` | Utilisateur | Détail d'un paiement |
| GET | `/orders/:orderId/payments` | Utilisateur | Liste les paiements liés à une commande |

### 11.8 Avis produits (`reviews`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/products/:pid/reviews` | — | Liste les avis d'un produit + note moyenne (`average_rating`, `total_reviews`) |
| GET | `/reviews/:rid` | — | Détail d'un avis |
| POST | `/reviews` | Utilisateur | Crée un avis (`product_id`, `rating` 1–5, `comment?`). Un seul avis par utilisateur/produit (`409` sinon). |
| PUT | `/reviews/:rid` | Utilisateur | Modifie son propre avis (`403` si pas propriétaire) |
| DELETE | `/reviews/:rid` | Utilisateur | Supprime son propre avis (`403` si pas propriétaire) |

### 11.9 Entrepôts (`warehouses`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/warehouses` | Utilisateur | Liste tous les entrepôts (mis en cache) |
| GET | `/warehouses/:warehouse_id` | Utilisateur | Détail d'un entrepôt (mis en cache) |
| POST | `/warehouses` | Admin | Crée un entrepôt (`name`, `location`, `capacity?`) |
| PUT | `/warehouses/:warehouse_id` | Admin | Mise à jour partielle |
| DELETE | `/warehouses/:warehouse_id` | Admin | Supprime un entrepôt |

### 11.10 Inventaire (`inventory`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/inventory` | Utilisateur | Liste filtrable (`category?`, `location?`) |
| GET | `/inventory/low-stock` | Utilisateur | Articles à faible stock (`quantity <= threshold`, par défaut 10, et `> 0`) |
| GET | `/inventory/out-of-stock` | Utilisateur | Articles en rupture de stock (`quantity == 0`) |
| GET | `/inventory/search` | Utilisateur | Recherche par nom de produit (`keyword`, requis) |
| GET | `/inventory/:item_id` | Utilisateur | Détail d'un article de stock |
| POST | `/inventory` | Admin | Crée une entrée de stock (`product_id`, `warehouse_id`, `quantity?`). `409` si l'entrée existe déjà. |
| PUT | `/inventory/:item_id` | Admin | Met à jour la quantité et/ou l'entrepôt |
| DELETE | `/inventory/:item_id` | Admin | Supprime une entrée de stock |
| POST | `/inventory/transfer` | Admin | Transfère une quantité d'un entrepôt à un autre (`item_id`, `from_warehouse`, `to_warehouse`, `quantity`). `400` si stock source insuffisant. |

### 11.11 Expéditions & enlèvements (`shipments`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/shipments/cost` | — | Calcule le coût d'expédition (`origin`, `destination`, `weight`, `dimensions?`). Formule : `5 + poids * 0.1` (XAF). |
| POST | `/shipments` | Utilisateur | Crée une expédition (`sender_name`, `sender_address`, `recipient_name`, `recipient_address`, `weight`, `dimensions?`, `order_id?`). Génère un numéro de suivi et une date de livraison estimée (+7 jours). |
| GET | `/shipments/:shipmentId` | Utilisateur | Détail d'une expédition (avec événements de suivi et étiquette) |
| POST | `/shipments/:shipmentId/track` | Utilisateur | Ajoute un événement de suivi (`status`, `location?`) et met à jour le statut de l'expédition |
| GET | `/shipments/:shipmentId/track` | Utilisateur | Retourne le statut courant, la dernière localisation et l'historique des événements |
| POST | `/shipments/:shipmentId/cancel` | Utilisateur | Annule l'expédition (`400` si déjà annulée) |
| GET | `/labels/:shipmentId` | Utilisateur | Récupère (ou génère si absente) l'étiquette d'expédition |
| POST | `/pickup-requests` | Utilisateur | Crée une demande d'enlèvement (`pickup_date`, `pickup_address`) |
| GET | `/pickup-requests/:requestId` | Utilisateur | Détail d'une demande d'enlèvement |
| POST | `/pickup-requests/:requestId/cancel` | Utilisateur | Annule sa propre demande (`403` si pas propriétaire, `400` si déjà annulée) |

### 11.12 Adresses (`address`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/address/validate` | — | Valide une adresse (`street`, `city`, `state?`, `country`, `postal_code`) selon une liste de pays supportés. Retourne `{ valid, normalized_address }`. |
| GET | `/addresses` | Utilisateur | Liste les adresses de l'utilisateur connecté |
| GET | `/addresses/:addressId` | Utilisateur | Détail d'une adresse (`403` si pas propriétaire) |
| POST | `/addresses` | Utilisateur | Crée une adresse (`street`, `city`, `state?`, `country`, `postalCode`, `isDefault?`). Si `isDefault: true`, retire le statut par défaut des autres adresses. |
| PATCH | `/addresses/:addressId` | Utilisateur | Mise à jour partielle (`403` si pas propriétaire) |
| DELETE | `/addresses/:addressId` | Utilisateur | Supprime une adresse (`403` si pas propriétaire) |

---

## 12. Tests

Les tests utilisent **Jest** + **ts-jest**, avec un environnement Node et un timeout de 30s. Les variables d'environnement sont chargées depuis `.env.test` (`tests/setup.ts`).

- `tests/unit/` : tests unitaires des services, avec les repositories mockés via `jest.mock(...)`.
- `tests/integration/` : tests de bout en bout via `supertest` sur l'application Express, avec connexion réelle à la base de données et à Redis (nettoyage des données de test dans `afterAll`).

```bash
npm test          # exécute toute la suite (séquentiel, --runInBand)
npm run test:watch # mode watch
```

La couverture de code est collectée sur `src/modules/**/*.service.ts` (configuration dans `jest.config.Js`).
