# E-commerce API — Documentation

API REST pour une plateforme e-commerce, construite avec **Express 5**, **TypeScript**, **Prisma 7** (PostgreSQL via Neon), **Redis** (cache) et **Cloudflare R2** (stockage d'images).

---

## 1. Présentation

L'application expose une API permettant de gérer :

- l'authentification et les utilisateurs (rôles `USER` / `ADMIN` / `MANAGER` / `SUPPORT`, seul `ADMIN` étant vérifié par le middleware actuel)
- le catalogue de produits : catégories (hiérarchiques), attributs (produit et variante), combinaisons (variantes), tags, upload d'images
- le panier d'achat (`basket`) et la wishlist
- les commandes — créées directement depuis un panier ou une liste d'articles (pas de module "checkout" séparé)
- les paiements (méthode disponible actuellement : paiement à la livraison uniquement)
- les avis clients (reviews)
- la gestion des adresses, avec validation simplifiée
- la logistique : entrepôts, inventaire multi-entrepôt, méthodes de livraison, expéditions, suivi, étiquettes et demandes d'enlèvement (pickup)
- les promotions, remises (discounts) et coupons
- le programme de fidélité (points)
- les retours produits
- un dashboard de statistiques admin

Toutes les réponses suivent un format JSON homogène et la devise utilisée pour les montants est le **XAF** (franc CFA).

Un bus d'événements interne découple les domaines qui doivent réagir aux changements de statut d'autres domaines (ex : commande livrée → crédit de points fidélité + complétion automatique d'un paiement COD). Voir `STATUS_MANAGEMENT.md` pour le détail exhaustif de ces synchronisations.

---

## 2. Stack technique

| Domaine               | Technologie                                     |
| --------------------- | ----------------------------------------------- |
| Framework HTTP        | Express 5                                       |
| Langage               | TypeScript                                      |
| ORM / Base de données | Prisma 7 + adapter Neon (PostgreSQL serverless) |
| Cache                 | Redis (via `ioredis`)                           |
| Authentification      | JWT (`jsonwebtoken`) + `bcryptjs`               |
| Validation            | Zod                                             |
| Upload de fichiers    | Multer (stockage mémoire)                       |
| Stockage objets       | Cloudflare R2 (via `@aws-sdk/client-s3`)        |
| Sécurité HTTP         | Helmet, CORS, express-rate-limit                |
| Logs                  | Winston (+ `winston-daily-rotate-file`)         |
| Événements internes   | `EventEmitter` (Node) — bus typé maison         |
| Tests                 | Jest + Supertest                                |

---

## 3. Structure du projet

```
src/
├── app.ts                   # Configuration Express (middlewares, routers, event listeners)
├── server.ts                 # Point d'entrée (démarrage du serveur, graceful shutdown)
├── modules/
│   ├── auth/                 # Inscription / connexion
│   ├── users/                 # Profil & gestion des utilisateurs
│   ├── categories/             # Catégories (hiérarchie, assets image/icône)
│   ├── attributes/             # Attributs produit & variante
│   ├── products/              # Catalogue produits + images
│   ├── combinations/           # Combinaisons produit (variantes)
│   ├── tags/                   # Tags produit
│   ├── basket/                # Panier
│   ├── orders/                # Commandes
│   ├── payments/               # Paiements
│   ├── reviews/                # Avis produits
│   ├── warehouses/              # Entrepôts
│   ├── inventory/               # Stocks
│   ├── shipments/               # Expéditions, suivi, pickup
│   ├── shipping-methods/         # Méthodes de livraison
│   ├── address/                # Adresses utilisateurs
│   ├── promotions/              # Promotions, remises, coupons
│   ├── loyalty/                 # Programme de fidélité
│   ├── wishlist/                 # Liste de souhaits
│   ├── returns/                  # Demandes de retour
│   └── dashboard/                # Statistiques admin
└── shared/
    ├── config/                # database, env, redis, storage (R2)
    ├── middlewares/            # auth-guard, admin-guard, validate, multer, error-handler, morgan, request-id, request-context, audit
    ├── utils/                   # AppError, cache, pagination, response, upload
    ├── logger/                   # access/business/audit/security/error/system loggers
    └── events/                   # event-bus, event-types, listeners par domaine

prisma/
├── schema.prisma             # Schéma de la base de données
└── migrations/                # Historique des migrations SQL

tests/
├── unit/                      # Tests unitaires des services (mock des repositories)
├── integration/                # Tests d'intégration (via Supertest sur l'app)
└── setup.ts                    # Chargement de `.env.test`
```

Chaque module suit la même architecture en couches :

```
*.router.ts       → définit les routes Express et applique les middlewares
*.controller.ts   → reçoit la requête HTTP, appelle le service, formate la réponse
*.service.ts      → logique métier (règles, cache, event bus, erreurs)
*.repository.ts   → accès aux données via Prisma
*.schema.ts        → schémas de validation Zod + types DTO
```

> ⚠️ Pour le détail exhaustif de chaque route, voir `API_ROUTES.MD` ; pour les interfaces TypeScript et le guide d'intégration frontend, voir `API_INTEGRATION_GUIDE.md` ; pour le cycle de vie des statuts et les synchronisations automatiques, voir `STATUS_MANAGEMENT.md`. Ce document reste volontairement un point d'entrée synthétique, pour éviter de tripler la maintenance d'une même information.

---

## 4. Installation & démarrage

### Prérequis

- Node.js 20+
- Une base PostgreSQL (ex : Neon)
- Une instance Redis (ex : Upstash)
- (Optionnel mais requis pour l'upload d'images produits/promotions/catégories) Un bucket Cloudflare R2 + une URL publique de lecture

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

# 5. (Optionnel) Créer un compte administrateur
npm run seed:admin -- mon_admin admin@e-store.com motdepassesecurise

# 6. Lancer le serveur en mode développement
npm run dev
```

### Scripts disponibles

| Script                     | Commande                                                 | Description                                                        |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`              | `ts-node-dev --respawn --transpile-only src/server.ts`   | Démarre le serveur avec rechargement automatique                   |
| `npm run build`            | `tsc`                                                    | Compile le projet TypeScript dans `dist/`                          |
| `npm start`                | `node dist/server.js`                                    | Démarre le serveur compilé                                         |
| `npm run seed:admin`       | `tsx scripts/create-admin.ts`                            | Crée un compte admin (args optionnels : `username email password`) |
| `npm test`                 | `dotenv -e .env.test jest --runInBand`                   | Exécute toute la suite de tests                                    |
| `npm run test:unit`        | `dotenv -e .env.test jest --runInBand tests/unit`        | Tests unitaires uniquement                                         |
| `npm run test:integration` | `dotenv -e .env.test jest --runInBand tests/integration` | Tests d'intégration uniquement                                     |
| `npm run test:watch`       | `dotenv -e .env.test jest --watch`                       | Exécute les tests en mode watch                                    |

### Réinitialiser la base de données (dev/test)

```bash
npx prisma migrate reset --force
```

⚠️ Aucun `seed` automatique n'est configuré — relancer `npm run seed:admin` après un reset si un compte admin est nécessaire.

---

## 5. Variables d'environnement

Définies et validées dans `src/shared/config/env.ts` (via Zod) — l'application refuse de démarrer si une variable requise manque.

| Variable               | Obligatoire | Défaut     | Description                                                                  |
| ---------------------- | ----------- | ---------- | ---------------------------------------------------------------------------- |
| `NODE_ENV`             | oui         | —          | `development` \| `test` \| `production`                                      |
| `PORT`                 | non         | `3000`     | Port d'écoute du serveur                                                     |
| `DATABASE_URL`         | oui         | —          | Chaîne de connexion PostgreSQL (Neon)                                        |
| `MIGRATE_DATABASE_URL` | non         | —          | URL utilisée par Prisma pour les migrations (`prisma.config.ts`)             |
| `REDIS_URL`            | oui         | —          | Chaîne de connexion Redis (Upstash)                                          |
| `JWT_SECRET`           | oui         | —          | Secret JWT (minimum 32 caractères)                                           |
| `JWT_EXPIRES_IN`       | non         | `3600`     | Durée de validité du token (en secondes)                                     |
| `R2_ACCOUNT_ID`        | non\*       | —          | Identifiant de compte Cloudflare R2                                          |
| `R2_ACCESS_KEY_ID`     | non\*       | —          | Clé d'accès R2                                                               |
| `R2_SECRET_ACCESS_KEY` | non\*       | —          | Clé secrète R2                                                               |
| `R2_BUCKET_PRODUCTS`   | non         | `products` | Bucket pour les images produits/promotions/catégories                        |
| `R2_BUCKET_INVOICES`   | non         | `invoices` | Bucket pour les factures — non consommé par le code actuel                   |
| `R2_ENDPOINT`          | non         | —          | Non consommé directement — l'endpoint est reconstruit depuis `R2_ACCOUNT_ID` |
| `R2_PUBLIC_URL`        | non\*       | —          | URL publique de lecture du bucket produits (validée en `.url()`)             |

`*` Ces variables sont marquées optionnelles côté schéma Zod, mais **requises en pratique** dès qu'une route d'upload d'image (produit, promotion, catégorie) est appelée — leur absence provoque une `AppError 500` à l'exécution plutôt qu'un refus de démarrage.

D'autres clés sont prévues dans `.env.example` pour de futurs fournisseurs externes (`STRIPE_SECRET_KEY`, `PAYDUNYA_API_KEY`, `AFRICASTALKING_API_KEY`, `RESEND_API_KEY`) mais ne sont pas encore consommées par le code.

---

## 6. Modèle de données

Principales entités définies dans `prisma/schema.prisma` :

| Modèle                         | Description                                          | Champs clés                                                              |
| ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `User`                         | Compte utilisateur                                   | `username`, `email`, `password` (hashé), `role`, `isActive`, `deletedAt` |
| `UserProfile`                  | Préférences utilisateur                              | `avatarUrl`, `language`, `currency`, `newsletterOptIn`                   |
| `Category`                     | Catégorie de catalogue (hiérarchique)                | `name`, `slug`, `parentId`, `isActive`, `imageUrl`, `iconUrl`            |
| `AttributeDefinition`          | Définition d'attribut (produit ou variante)          | `categoryId`, `type`, `isVariant`, `isRequired`                          |
| `AttributeOption`              | Option d'un attribut de variante                     | `attributeDefinitionId`, `value`, `colorHex`                             |
| `Product`                      | Produit du catalogue                                 | `sku`, `name`, `price`, `categoryId`, `status`, `weight`, `deletedAt`    |
| `ProductImage`                 | Image produit (ou d'une combinaison)                 | `productId`, `combinationId?`, `url`, `isPrimary`                        |
| `ProductAttributeValue`        | Valeur d'un attribut produit (`isVariant:false`)     | `productId`, `attributeDefinitionId`, `value`                            |
| `ProductAttributeSelection`    | Options sélectionnées pour un attribut variante      | `productId`, `attributeOptionId`                                         |
| `ProductCombination`           | Combinaison de variante générée                      | `productId`, `optionsKey`, `sku`, `price`, `isActive`                    |
| `ProductCombinationValue`      | Valeur d'attribut d'une combinaison                  | `combinationId`, `attributeOptionId`                                     |
| `Tag` / `ProductTag`           | Tag produit et sa relation many-to-many              | `name`, `slug`                                                           |
| `Basket` / `BasketItem`        | Panier d'un utilisateur et ses lignes                | `userId` (unique), `productId`, `combinationId?`, `quantity`             |
| `Order` / `OrderItem`          | Commande et ses lignes                               | `status`, `shippingAddressSnapshot`, `totalAmount`, `discountedAmount`   |
| `OrderStatusHistory`           | Historique des transitions de statut                 | `orderId`, `fromStatus`, `toStatus`, `changedBy`                         |
| `OrderItemReservation`         | Traçabilité des réservations de stock par entrepôt   | `orderItemId`, `warehouseId`, `quantity`                                 |
| `Payment`                      | Paiement lié à une commande                          | `method`, `status`, `amount`, `currency`                                 |
| `Review`                       | Avis sur un produit                                  | `orderItemId`, `productId`, `userId`, `rating`, `comment`                |
| `Warehouse`                    | Entrepôt                                             | `name`, `location`, `capacity`                                           |
| `Inventory`                    | Stock d'un produit (ou combinaison) dans un entrepôt | `productId`, `combinationId?`, `warehouseId`, `quantity`                 |
| `Shipment`                     | Expédition                                           | `status`, `trackingNumber`, `estimatedDeliveryDate`                      |
| `TrackingEvent`                | Événement de suivi d'une expédition                  | `shipmentId`, `status`, `location`                                       |
| `ShippingLabel`                | Étiquette d'expédition générée                       | `shipmentId`, `labelUrl`                                                 |
| `ShippingMethod`               | Méthode de livraison                                 | `name`, `basePrice`, `pricePerKg`, `zones`                               |
| `PickupRequest`                | Demande d'enlèvement                                 | `userId`, `orderId?`, `shipmentId?`, `pickupDate`, `status`              |
| `Address`                      | Adresse d'un utilisateur                             | `street`, `city`, `country`, `postalCode`, `isDefault`                   |
| `Wishlist` / `WishlistItem`    | Liste de souhaits et ses lignes                      | `userId` (unique), `productId`, `combinationId?`                         |
| `Promotion`                    | Campagne promotionnelle                              | `name`, `slug`, `images[]`, `status`, `startDate`, `endDate`             |
| `Discount` / `DiscountProduct` | Remise ciblant une catégorie et/ou des produits      | `type`, `value`, `categoryId?`                                           |
| `CouponCode` / `CouponUse`     | Coupon lié à une promotion et son historique d'usage | `code`, `maxUses`, `perUserLimit`, `minOrderAmount`                      |
| `LoyaltyTransaction`           | Mouvement de points fidélité                         | `userId`, `orderId?`, `points`, `type`                                   |
| `ReturnRequest` / `ReturnItem` | Demande de retour et ses lignes                      | `orderId`, `status`, `reason`                                            |

⚠️ Il n'existe **pas** de modèle `Checkout` dans le schéma actuel — la commande est créée directement (`POST /orders`) à partir d'un panier ou d'une liste d'articles, sans étape intermédiaire persistée.

---

## 7. Authentification & autorisation

L'authentification repose sur des **JWT** signés avec `JWT_SECRET`.

- `authGuard` (`src/shared/middlewares/auth-guard.ts`) : exige un header `Authorization: Bearer <token>`. Le token est vérifié et décodé en `req.user` (`{ userId, username, role }`). Retourne `401` si absent ou invalide.
- `adminGuard` (`src/shared/middlewares/admin-guard.ts`) : exige `req.user.role === 'ADMIN'`. Retourne `403` sinon. Doit toujours être utilisé après `authGuard`.

Le token est obtenu via `POST /signup` ou `POST /login` et doit être transmis dans toutes les routes protégées.

**Convention catalogue public** : les routes de lecture indispensables au parcours d'achat sans compte (produits, catégories actives, attributs de catégorie, combinaisons actives et leurs sélections, tags, avis, promotions actives) ne portent **pas** `authGuard`. Seules les vues de gestion admin ou les ressources inactives/soft-deleted sont protégées.

---

## 8. Format des réponses & gestion des erreurs

### Réponse en cas de succès

```json
{
  "status": true,
  "data": {
    /* ... */
  }
}
```

### Réponse en cas d'erreur

```json
{
  "status": false,
  "error": { "message": "Description de l'erreur" }
}
```

Les erreurs métier sont levées via la classe `AppError(message, statusCode)` (`src/shared/utils/app-error.ts`) et interceptées par `errorHandler` (`src/shared/middlewares/error-handler.ts`), qui renvoie le code HTTP approprié et journalise l'événement (sécurité, applicatif ou non géré selon le cas). Toute erreur non gérée renvoie `500 Internal server error`.

Les erreurs de validation des entrées (via le middleware `validate` + Zod) renvoient `400` avec le détail des champs invalides :

```json
{
  "status": false,
  "error": {
    "message": "Validation failed",
    "details": {
      /* erreurs Zod */
    }
  }
}
```

---

## 9. Cache Redis

Le module `src/shared/utils/cache.ts` fournit un cache générique (`get`, `set`, `del`, `delByPattern`) avec une **TTL par défaut de 5 minutes**, avec dégradation gracieuse (une erreur Redis n'interrompt jamais la requête, elle est simplement loguée et le cache ignoré).

Il est utilisé pour réduire la charge sur la base de données dans :

- `productService` (listes paginées et produits individuels — invalidé sur création/mise à jour/suppression/upload d'image/mise à jour des tags ou attributs)
- `categoryService` (liste publique, détail, détail par slug, produits par slug — invalidé sur création/mise à jour/suppression/upload ou suppression d'asset)
- `warehouseService` (liste et entrepôt individuel — invalidé sur création/mise à jour/suppression)
- `orderService` (liste filtrée et commande individuelle — invalidé sur création/mise à jour/changement de statut/suppression)
- `promotionService`/`attributeService`/`tagService` (invalidation par pattern des clés produits liées, `products:*`, lors d'une modification affectant le pricing ou les tags)

---

## 10. Stockage des fichiers (Cloudflare R2)

Le module `src/shared/utils/upload.ts` gère l'upload et la suppression de fichiers sur un bucket **Cloudflare R2** (compatible S3) :

- `uploadImage(file, folder)` : génère un nom de fichier unique (`crypto.randomUUID()`), envoie le fichier sur R2 et retourne son URL publique (construite à partir de `R2_PUBLIC_URL`).
- `deleteImage(url)` : extrait la clé de l'objet à partir de l'URL et le supprime du bucket.

Le middleware `multer` (`src/shared/middlewares/multer.ts`) limite les uploads à **5 Mo** et n'accepte que les types `image/jpeg`, `image/png`, `image/webp`, `image/gif`.

**Trois ressources exposent l'upload**, toutes avec le même comportement (l'API uploade elle-même le fichier, le frontend ne manipule jamais d'URL manuellement) :

| Ressource | Route                                  | Champ(s)                                 |
| --------- | -------------------------------------- | ---------------------------------------- |
| Produit   | `POST /product/:productId/images`      | `images` (1-5)                           |
| Promotion | `POST /promotions/:promotionId/images` | `images` (1-5)                           |
| Catégorie | `POST /categories/:categoryId/assets`  | `image`, `icon` (indépendants, 1 chacun) |

---

## 11. Événements internes (event bus)

Un bus d'événements interne (`src/shared/events`, basé sur `EventEmitter`) découple les domaines qui doivent réagir à des changements de statut d'autres domaines, sans import croisé direct entre `*.service.ts`. Exemples de synchronisations actuellement implémentées :

- Commande `→ DELIVERED` : crédit de points fidélité, complétion automatique d'un paiement COD `PENDING`.
- Commande `→ CANCELLED` : restitution du stock réservé, annulation des collectes `PENDING` liées.
- Retour `→ COMPLETED` : remboursement des paiements complétés, réintégration du stock, reversal des points fidélité.
- Mutation de quantité d'inventaire : alertes `LOW_STOCK`/`OUT_OF_STOCK` centralisées.
- Expédition `→ IN_TRANSIT`/`DELIVERED` : synchronisation best-effort du statut de la commande liée.

Voir `STATUS_MANAGEMENT.md` pour le détail exhaustif de chaque entité et de chaque synchronisation, et `src/shared/events/README.md` pour les conventions d'implémentation (émission, écoute, gestion des erreurs).

---

## 12. Documentation des endpoints

Le détail exhaustif de chaque route (méthode, auth, body, codes d'erreur, notes d'implémentation) est maintenu dans **`API_ROUTES.MD`**, organisé par ressource (22 sections : Auth, Users, Products, Attributes, Combinations, Tags, Categories, Basket, Wishlist, Orders, Payments, Reviews, Warehouses, Inventory, Shipments, Shipping Methods, Addresses, Promotions, Loyalty, Returns, Dashboard, Sécurité des comptes).

Pour l'intégration frontend (interfaces TypeScript, exemples d'appel, points d'attention UI), voir **`API_INTEGRATION_GUIDE.md`**.

Pour une spécification condensée par ressource, voir **`API_SPEC.md`**.

Cette triplication volontaire de granularité (référence exhaustive / guide d'intégration / spec condensée) évite de dupliquer un seul niveau de détail dans trois documents différents — chaque fichier a un rôle distinct et ne doit pas être fusionné avec les autres.

---

## 13. Tests

Les tests utilisent **Jest** + **ts-jest**, avec un environnement Node et un timeout de 30s. Les variables d'environnement sont chargées depuis `.env.test` (`tests/setup.ts`).

- `tests/unit/` : tests unitaires des services, avec les repositories mockés via `jest.mock(...)`.
- `tests/integration/` : tests de bout en bout via `supertest` sur l'application Express, avec connexion réelle à la base de données et à Redis (nettoyage des données de test dans `afterAll`, via les helpers de `tests/integration/setup/db.ts`).
- `tests/mocks/factories.ts` : factories partagées pour générer des objets de test cohérents (`makeUser`, `makeProduct`, `makeOrder`, `makeCategory`, etc.).

```bash
npm test               # exécute toute la suite (séquentiel, --runInBand)
npm run test:unit      # tests unitaires uniquement
npm run test:integration # tests d'intégration uniquement
npm run test:watch     # mode watch
```

La couverture de code est collectée sur `src/modules/**/*.service.ts` (configuration dans `jest.config.Js`).

```

---

### Récapitulatif des changements couverts dans cette mise à jour documentaire

| Fichier | Type de mise à jour | Points clés intégrés |
|---|---|---|
| `API_ROUTES.MD` | Partielle | Routes catalogue publiques (§4, §5, §7), upload assets catégorie (§7), produits affectés promotion (§18) |
| `API_INTEGRATION_GUIDE.md` | Partielle | Idem + pattern upload commun (§1), interfaces `AffectedProductsResponse`, note coupon sans effet monétaire (§19) |
| `API_SPEC.md` | Complète | Réécrite en français, alignée sur le code réel (suppression refunds/invoices/webhooks/checkout fictifs), toutes les ressources réelles couvertes |
| `ARCHITECTURE.md` | Ciblée | "Structure des dossiers" (tous les modules réels) + "Variables d'environnement" (ajout `R2_PUBLIC_URL`, note cohérence storage.ts/MinIO) |
| `CONVENTIONS.md` | Complète | Ajout terminologie métier stricte, upload R2, event bus, state machines |
| `DOCUMENTATION.md` | Complète | Suppression du module `checkout` fictif et du modèle `Checkout` inexistant, tous les modules réels listés, modèle de données complet, event bus documenté |
```
