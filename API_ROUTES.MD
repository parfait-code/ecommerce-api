# API Reference — E-Commerce API

> **Base URL** : `http://localhost:3000`
> **Content-Type** : `application/json` (sauf upload → `multipart/form-data`)
> **Authentication** : `Authorization: Bearer <token>` (JWT)
> **Devise** : XAF pour tous les montants

## Conventions

### Réponse succès

```json
{ "status": true, "data": { ... } }
```

### Réponse erreur

```json
{ "status": false, "error": { "message": "..." } }
```

### Réponse paginée

```json
{ "items": [...], "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
```

Paramètres `page` (défaut 1) et `limit` (défaut 20) sur toutes les routes paginées.

### Rôles

`USER` · `ADMIN` · `MANAGER` · `SUPPORT` (seul `ADMIN` est vérifié par `adminGuard` actuellement — `MANAGER`/`SUPPORT` n'ont aucun privilège différencié dans le code actuel).

---

## 1. Auth

| Méthode | Route     | Auth | Body                                                                                           | Notes                                                                                                                                                                                                                                                                                                |
| ------- | --------- | ---- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST    | `/signup` | ❌   | `username(3-50), email, password(min6), firstName(2-50), lastName(2-50), dateOfBirth?, phone?` | ⚠️ **CORRECTION** : le schema Zod de `/signup` n'accepte **pas** de champ `role` — toute valeur envoyée est silencieusement ignorée et le rôle est toujours forcé à `USER` côté service (`auth.service.ts`). Le risque d'auto-promotion admin mentionné dans les anciens warnings n'existe donc pas. |
| POST    | `/login`  | ❌   | `username, password`                                                                           | 400 si identifiants invalides ou compte inexistant, 403 si compte désactivé (`isActive:false`)                                                                                                                                                                                                       |

Réponse `/signup` et `/login` : `{ user (sans password), token }`.

---

## 2. Utilisateurs (`/user`)

| Méthode | Route                       | Auth     | Body                                                                                       |
| ------- | --------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| GET     | `/user`                     | ✅       | —                                                                                          |
| PATCH   | `/user`                     | ✅       | `email?, firstName?, lastName?, dateOfBirth?, phone?`                                      |
| GET     | `/user/all`                 | 🔒 ADMIN | —                                                                                          |
| GET     | `/user/:userId`             | 🔒 ADMIN | —                                                                                          |
| POST    | `/user`                     | 🔒 ADMIN | `username, email, password, firstName, lastName, dateOfBirth?, phone?, role?(défaut USER)` |
| PATCH   | `/user/change-role/:userId` | 🔒 ADMIN | `role`                                                                                     |
| DELETE  | `/user/:userId`             | 🔒 ADMIN | — → `{ numberOfUsersDeleted: 1 }` (soft delete)                                            |

⚠️ Les routes statiques (`/user/all`, `/user` POST) sont déclarées **avant** `/user/:userId` dans le router — ordre obligatoire en Express.

---

## 3. Produits (`/product`)

| Méthode | Route                        | Auth     | Notes                                                                                                                                                                                                                      |
| ------- | ---------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/product`                   | ❌       | Query : `page?, limit?, categoryId?, search?` — `search` filtre sur `name` OU `sku` (insensible à la casse). ⚠️ **CORRECTION** : contrairement à l'ancienne doc, la recherche texte **est** supportée nativement côté API. |
| GET     | `/product/:productId`        | ❌       | 404 si introuvable ou soft-deleted                                                                                                                                                                                         |
| POST    | `/product`                   | 🔒 ADMIN | `sku, name, description?, price, categoryId, status?(DRAFT défaut), weight?`                                                                                                                                               |
| PATCH   | `/product/:productId`        | 🔒 ADMIN | body partiel                                                                                                                                                                                                               |
| DELETE  | `/product/:productId`        | 🔒 ADMIN | soft delete → `{ numberOfProductsDeleted: 1 }`                                                                                                                                                                             |
| POST    | `/product/:productId/images` | 🔒 ADMIN | `multipart/form-data`, champ `images` (1-5, jpeg/png/webp/gif, 5MB max), `variantId?` optionnel                                                                                                                            |
| DELETE  | `/product/:productId/images` | 🔒 ADMIN | body `{ imageId }`                                                                                                                                                                                                         |

---

## 4. Variantes (`/product/:productId/variants`)

| Méthode | Route         | Auth     | Body                                                                                        |
| ------- | ------------- | -------- | ------------------------------------------------------------------------------------------- |
| GET     | `/`           | ✅       | — → `Variant[]`                                                                             |
| GET     | `/:variantId` | ✅       | —                                                                                           |
| POST    | `/`           | 🔒 ADMIN | `sku, price?, isActive?(défaut true), attributes: [{attributeDefinitionId, value}] (min 1)` |
| PATCH   | `/:variantId` | 🔒 ADMIN | body partiel                                                                                |
| DELETE  | `/:variantId` | 🔒 ADMIN | —                                                                                           |

Contraintes métier (`variant.service.ts`) : le `sku` doit être unique globalement ; chaque `attributeDefinitionId` doit appartenir à la catégorie du produit **et** avoir `isVariant: true`.

---

## 5. Catégories (`/categories`)

| Méthode | Route                             | Auth     | Body                                                                                                                          |
| ------- | --------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/categories`                     | ✅       | — → `Category[]` (mis en cache)                                                                                               |
| GET     | `/categories/:categoryId`         | ✅       | —                                                                                                                             |
| GET     | `/categories/slug/:slug`          | ❌       | —                                                                                                                             |
| GET     | `/categories/slug/:slug/products` | ❌       | Query `page?, limit?` → `{ category, items, total, page, limit, totalPages }`                                                 |
| POST    | `/categories`                     | 🔒 ADMIN | `name(2-100), slug(2-100, kebab-case), description?, imageUrl?, iconUrl?, metaTitle?, metaDescription?, isActive?, parentId?` |
| PUT     | `/categories/:categoryId`         | 🔒 ADMIN | body partiel                                                                                                                  |
| DELETE  | `/categories/:categoryId`         | 🔒 ADMIN | **400** si des produits sont encore rattachés — aucune réassignation en masse disponible                                      |

---

## 6. Attributs (`/categories/:categoryId/attributes`, `/attributes`)

| Méthode | Route                                | Auth     | Body                                                                                                                                                                                                  |
| ------- | ------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/categories/:categoryId/attributes` | ✅       | —                                                                                                                                                                                                     |
| POST    | `/categories/:categoryId/attributes` | 🔒 ADMIN | `name, slug, type(TEXT\|NUMBER\|COLOR\|BOOLEAN\|SELECT), unit?, isVariant?, isFilterable?, isRequired?, position?`                                                                                    |
| GET     | `/attributes/:definitionId`          | ✅       | —                                                                                                                                                                                                     |
| PATCH   | `/attributes/:definitionId`          | 🔒 ADMIN | body partiel                                                                                                                                                                                          |
| DELETE  | `/attributes/:definitionId`          | 🔒 ADMIN | —                                                                                                                                                                                                     |
| POST    | `/attributes/:definitionId/options`  | 🔒 ADMIN | `value, colorHex?(#RRGGBB), position?`                                                                                                                                                                |
| PATCH   | `/attributes/options/:optionId`      | 🔒 ADMIN | body partiel — ⚠️ **CORRECTION** : contrairement aux anciens warnings, une route d'édition d'option **existe** (`attribute.router.ts`), il n'est donc pas nécessaire de supprimer/recréer une option. |
| DELETE  | `/attributes/options/:optionId`      | 🔒 ADMIN | —                                                                                                                                                                                                     |
| PUT     | `/product/:productId/attributes`     | 🔒 ADMIN | `attributes: [{attributeDefinitionId, value}]` — remplace toutes les valeurs                                                                                                                          |

---

## 7. Tags (`/tags`, `/product/:productId/tags`)

| Méthode | Route                      | Auth     | Body                                                    |
| ------- | -------------------------- | -------- | ------------------------------------------------------- |
| GET     | `/tags`                    | ❌       | —                                                       |
| GET     | `/tags/:tagId`             | ❌       | — (avec `products`)                                     |
| POST    | `/tags`                    | 🔒 ADMIN | `name(2-50), slug(2-50, kebab-case)`                    |
| PATCH   | `/tags/:tagId`             | 🔒 ADMIN | body partiel                                            |
| DELETE  | `/tags/:tagId`             | 🔒 ADMIN | —                                                       |
| PUT     | `/product/:productId/tags` | 🔒 ADMIN | `{ tagIds: string[] }` (min 1) — remplace tous les tags |
| GET     | `/product/:productId/tags` | ✅       | —                                                       |

---

## 8. Panier (`/basket`)

| Méthode | Route                                 | Auth | Body                                                                                           |
| ------- | ------------------------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| POST    | `/basket`                             | ✅   | — → `201` panier vide                                                                          |
| GET     | `/basket/:basket_id`                  | ✅   | —                                                                                              |
| POST    | `/basket/:basket_id/product`          | ✅   | `product_id, variant_id?, quantity` — incrémente si déjà présent (même couple produit/variant) |
| PUT     | `/basket/:basket_id/product/quantity` | ✅   | `product_id, variant_id?, quantity`                                                            |
| DELETE  | `/basket/:basket_id/product`          | ✅   | `product_id, variant_id?`                                                                      |

Un utilisateur peut avoir plusieurs paniers actifs simultanément (aucune contrainte d'unicité `userId`).

---

## 9. Wishlist (`/wishlist`)

| Méthode | Route             | Auth | Body                                 |
| ------- | ----------------- | ---- | ------------------------------------ |
| GET     | `/wishlist`       | ✅   | — (créée automatiquement si absente) |
| POST    | `/wishlist/items` | ✅   | `product_id, variant_id?`            |
| DELETE  | `/wishlist/items` | ✅   | `product_id, variant_id?`            |

Contrairement au panier, la wishlist est **unique par utilisateur** (`@unique userId` en base).

---

## 10. Commandes (`/orders`)

| Méthode | Route                     | Auth     | Notes                                                                                                                               |
| ------- | ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/orders`                 | ✅       | Query `page?, limit?, status?, customer?` — `customer` filtre `user.email` en `contains` insensible à la casse (match partiel)      |
| POST    | `/orders`                 | ✅       | Voir body ci-dessous                                                                                                                |
| GET     | `/orders/:orderId`        | ✅       | 403 si la commande n'appartient pas à l'appelant (sauf admin)                                                                       |
| PUT     | `/orders/:orderId`        | ✅       | body partiel (adresses, méthode de livraison, notes)                                                                                |
| DELETE  | `/orders/:orderId`        | ✅       | annule la commande → `{ message: "Order cancelled successfully" }`                                                                  |
| PUT     | `/orders/:orderId/status` | 🔒 ADMIN | `status, reason?, shippingCarrier?, trackingNumber?, estimatedDeliveryDate?` — crédite les points fidélité au passage à `DELIVERED` |
| GET     | `/user/:userId/orders`    | 🔒 ADMIN | Query `page?, limit?`                                                                                                               |

**Body `POST /orders`** :

```ts
{
  items: { id: string; quantity: number }[]; // min 1
  shippingAddressId?: string;
  shippingAddress: { street, city, state?, country, postalCode };
  billingAddressId?: string;
  billingAddress?: { street, city, state?, country, postalCode };
  shippingMethodId?: string;
  paymentMethodId?: string;
  notes?: string;
  couponCode?: string;
}
```

⚠️ **CORRECTION** : `items[].id` est le **`productId` converti en string** (`order.service.ts` fait `Number(item.id)` pour résoudre le produit), **pas** un `basketItemId` comme indiqué dans les anciennes docs. Le panier n'est jamais consulté lors de la création de commande — les deux flux (panier et commande) sont indépendants.

La priorité `shippingAddressId` vs `shippingAddress` n'est **pas** un choix exclusif : le repository écrit toujours le snapshot (`shippingAddressSnapshot`) à partir de `shippingAddress`, et enregistre `shippingAddressId` séparément s'il est fourni. Les deux peuvent donc coexister sans conflit — `shippingAddress` est obligatoire dans tous les cas.

Un `couponCode` invalide, expiré, inactif ou déjà utilisé au-delà de `perUserLimit` fait échouer toute la création de commande (404/400), aucun item n'est créé.

---

## 11. Paiements (`/payment-methods`, `/payments`)

| Méthode | Route                       | Auth     | Notes                                                                                                                                                                                                          |
| ------- | --------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/payment-methods`          | ❌       | Seul `CASH_ON_DELIVERY` a `available: true`                                                                                                                                                                    |
| POST    | `/payments`                 | ✅       | `order_id, method(CASH_ON_DELIVERY\|PAYPAL\|STRIPE\|CINETPAY), currency?(XAF défaut), notes?` — **503** si méthode indisponible, **403** si commande d'un autre utilisateur. Passe la commande en `CONFIRMED`. |
| GET     | `/payments/:payment_id`     | ✅       | —                                                                                                                                                                                                              |
| GET     | `/orders/:orderId/payments` | ✅       | — → `Payment[]`                                                                                                                                                                                                |
| GET     | `/payments`                 | 🔒 ADMIN | Query `page?, limit?, status?, method?, order_id?`                                                                                                                                                             |

---

## 12. Avis (`/products/:pid/reviews`, `/reviews`)

| Méthode | Route                    | Auth       | Body                                                           |
| ------- | ------------------------ | ---------- | -------------------------------------------------------------- |
| GET     | `/products/:pid/reviews` | ❌         | — → `{ product_id, average_rating, total_reviews, reviews[] }` |
| GET     | `/reviews/:rid`          | ❌         | —                                                              |
| POST    | `/reviews`               | ✅         | `order_item_id, product_id, rating(1-5), comment?`             |
| PUT     | `/reviews/:rid`          | ✅ (owner) | `rating?, comment?`                                            |
| DELETE  | `/reviews/:rid`          | ✅ (owner) | —                                                              |

Un avis est lié à un **`orderItemId`** précis (achat vérifié), avec contrainte d'unicité `(orderItemId, userId)` — un même produit acheté plusieurs fois (commandes différentes) peut donc recevoir plusieurs avis du même utilisateur.

---

## 13. Entrepôts (`/warehouses`)

| Méthode | Route                                 | Auth     | Body                                          |
| ------- | ------------------------------------- | -------- | --------------------------------------------- |
| GET     | `/warehouses`                         | ✅       | — (cache)                                     |
| GET     | `/warehouses/:warehouse_id`           | ✅       | — (cache)                                     |
| GET     | `/warehouses/:warehouse_id/inventory` | ✅       | — → `{ warehouse: {...totalUnits}, items[] }` |
| POST    | `/warehouses`                         | 🔒 ADMIN | `name(2-100), location, capacity?`            |
| PUT     | `/warehouses/:warehouse_id`           | 🔒 ADMIN | body partiel                                  |
| DELETE  | `/warehouses/:warehouse_id`           | 🔒 ADMIN | —                                             |

---

## 14. Inventaire (`/inventory`)

| Méthode | Route                     | Auth     | Notes                                                                                                         |
| ------- | ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| GET     | `/inventory`              | ✅       | Query `page?, limit?, category?, location?` → objet paginé                                                    |
| GET     | `/inventory/low-stock`    | ✅       | Query `threshold?(défaut 10)` → `0 < quantity <= threshold`                                                   |
| GET     | `/inventory/out-of-stock` | ✅       | `quantity === 0`                                                                                              |
| GET     | `/inventory/search`       | ✅       | Query `keyword` **requis**, sinon erreur 500 (non gérée en `AppError`)                                        |
| GET     | `/inventory/:item_id`     | ✅       | —                                                                                                             |
| POST    | `/inventory`              | 🔒 ADMIN | `product_id, warehouse_id, variant_id?, quantity?(défaut 0)` — 409 si doublon `(product, warehouse, variant)` |
| PUT     | `/inventory/:item_id`     | 🔒 ADMIN | `quantity?, warehouse_id?`                                                                                    |
| DELETE  | `/inventory/:item_id`     | 🔒 ADMIN | —                                                                                                             |
| POST    | `/inventory/transfer`     | 🔒 ADMIN | `item_id, from_warehouse, to_warehouse, quantity` — 400 si stock source insuffisant                           |

⚠️ `GET /inventory/search` sans `keyword` renvoie une erreur non typée (`throw new Error(...)`), donc **500** et non 400 — à corriger côté code si un comportement 400 est souhaité (non fait à ce jour).

---

## 15. Expéditions (`/shipments`, `/pickup-requests`, `/labels`)

| Méthode | Route                                | Auth       | Notes                                                                                                                                                                                                                                           |
| ------- | ------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST    | `/shipments/cost`                    | ❌         | `origin, destination, weight, dimensions?` → `cost = 5 + weight*0.1` XAF                                                                                                                                                                        |
| POST    | `/shipments`                         | 🔒 ADMIN   | ⚠️ **CORRECTION** : cette route est **admin-only** dans le code actuel (`authGuard, adminGuard`), contrairement aux anciens warnings qui la disaient ouverte à tout utilisateur connecté.                                                       |
| GET     | `/shipments/:shipmentId`             | ✅         | —                                                                                                                                                                                                                                               |
| GET     | `/shipments`                         | 🔒 ADMIN   | Query `page?, limit?, status?`                                                                                                                                                                                                                  |
| POST    | `/shipments/:shipmentId/track`       | ✅         | ⚠️ **CORRECTION** : cette route n'est **pas** protégée par `adminGuard` — tout utilisateur authentifié peut ajouter un événement de tracking sur n'importe quelle expédition. À restreindre si ce n'est pas voulu. Body `{ status, location? }` |
| GET     | `/shipments/:shipmentId/track`       | ✅         | —                                                                                                                                                                                                                                               |
| POST    | `/shipments/:shipmentId/cancel`      | ✅         | 400 si déjà annulée                                                                                                                                                                                                                             |
| GET     | `/labels/:shipmentId`                | ✅         | Crée l'étiquette si absente                                                                                                                                                                                                                     |
| POST    | `/pickup-requests`                   | ✅         | `pickup_date(ISO), pickup_address`                                                                                                                                                                                                              |
| GET     | `/pickup-requests`                   | 🔒 ADMIN   | Query `page?, limit?, status?` — ⚠️ **CORRECTION** : cette route existe déjà, contrairement aux anciens warnings qui la disaient absente.                                                                                                       |
| GET     | `/pickup-requests/:requestId`        | ✅         | —                                                                                                                                                                                                                                               |
| POST    | `/pickup-requests/:requestId/cancel` | ✅ (owner) | 403 si pas propriétaire, 400 si déjà annulée                                                                                                                                                                                                    |

---

## 16. Méthodes de livraison (`/shipping-methods`)

| Méthode | Route                         | Auth     | Body                                                                                            |
| ------- | ----------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| GET     | `/shipping-methods`           | ❌       | Query `active?(bool)`                                                                           |
| GET     | `/shipping-methods/:methodId` | ❌       | —                                                                                               |
| POST    | `/shipping-methods`           | 🔒 ADMIN | `name, description?, estimatedDays, basePrice, pricePerKg?, isActive?, zones: string[2-letter]` |
| PATCH   | `/shipping-methods/:methodId` | 🔒 ADMIN | body partiel                                                                                    |
| DELETE  | `/shipping-methods/:methodId` | 🔒 ADMIN | —                                                                                               |
| POST    | `/shipping-methods/calculate` | ❌       | `shippingMethodId, weight` → `cost = basePrice + pricePerKg*weight`                             |

---

## 17. Adresses (`/address`, `/addresses`)

| Méthode | Route                   | Auth       | Body                                                                                                                                  |
| ------- | ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| POST    | `/address/validate`     | ❌         | `street, city, state?, country, postal_code` → `{ valid, normalized_address }` — validation contre une liste de pays supportés en dur |
| GET     | `/addresses`            | ✅         | —                                                                                                                                     |
| GET     | `/addresses/:addressId` | ✅ (owner) | 403 sinon                                                                                                                             |
| POST    | `/addresses`            | ✅         | `street, city, state?, country, postalCode, isDefault?` — désactive les autres si `isDefault: true`                                   |
| PATCH   | `/addresses/:addressId` | ✅ (owner) | body partiel                                                                                                                          |
| DELETE  | `/addresses/:addressId` | ✅ (owner) | —                                                                                                                                     |

---

## 18. Promotions, remises & coupons

| Méthode | Route                                            | Auth     | Body                                                                                             |
| ------- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------ |
| GET     | `/promotions/slug/:slug`                         | ❌       | Page publique promo (avec `discounts`, `coupons`)                                                |
| POST    | `/coupons/validate`                              | ✅       | `code, basketId` — vérifie activité, dates, plafond global et par-utilisateur                    |
| GET     | `/promotions`                                    | 🔒 ADMIN | Query `status?, isActive?`                                                                       |
| GET     | `/promotions/:promotionId`                       | 🔒 ADMIN | —                                                                                                |
| POST    | `/promotions`                                    | 🔒 ADMIN | `name, slug, description?, startDate(ISO), endDate(ISO > startDate), isActive?`                  |
| PUT     | `/promotions/:promotionId`                       | 🔒 ADMIN | body partiel                                                                                     |
| PATCH   | `/promotions/:promotionId/toggle`                | 🔒 ADMIN | bascule `isActive`                                                                               |
| DELETE  | `/promotions/:promotionId`                       | 🔒 ADMIN | —                                                                                                |
| POST    | `/promotions/:promotionId/images`                | 🔒 ADMIN | multipart, champ `images` (1-5)                                                                  |
| DELETE  | `/promotions/:promotionId/images`                | 🔒 ADMIN | body `{ imageUrl }`                                                                              |
| POST    | `/promotions/:promotionId/discounts`             | 🔒 ADMIN | `type(PERCENTAGE\|FIXED_AMOUNT), value, categoryId?, productIds?` — au moins un ciblage requis   |
| DELETE  | `/promotions/:promotionId/discounts/:discountId` | 🔒 ADMIN | —                                                                                                |
| GET     | `/promotions/:promotionId/coupons`               | 🔒 ADMIN | —                                                                                                |
| POST    | `/promotions/:promotionId/coupons`               | 🔒 ADMIN | `code(3-50, auto-uppercase), maxUses?, perUserLimit?(défaut 1), startDate?, endDate?, isActive?` |
| DELETE  | `/promotions/:promotionId/coupons/:couponId`     | 🔒 ADMIN | —                                                                                                |

Le prix affiché sur `GET /product` / `GET /product/:id` inclut désormais un objet `pricing` (`{ originalPrice, finalPrice, discountAmount, discountPercentage, hasDiscount, promotionId, discountId }`) calculé à partir des remises actives — non documenté auparavant.

---

## 19. Programme fidélité (`/loyalty`)

| Méthode | Route                      | Auth     | Notes                                                                                                                                                                                                                                               |
| ------- | -------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/loyalty/:userId/balance` | ✅       | ⚠️ **Aucun contrôle d'appartenance** : tout utilisateur authentifié peut consulter le solde de **n'importe quel** `userId` (le service ne vérifie que l'existence de l'utilisateur, pas `req.user.userId === userId`). À restreindre si non désiré. |
| GET     | `/loyalty/:userId/history` | ✅       | Même remarque que ci-dessus                                                                                                                                                                                                                         |
| POST    | `/loyalty/adjust`          | 🔒 ADMIN | `userId, points(≠0, négatif pour un débit), type(EARNED\|REDEEMED\|EXPIRED\|ADJUSTED), orderId?` — rejette un `REDEEMED` si le solde résultant serait négatif                                                                                       |

1 point crédité automatiquement par tranche de 100 XAF (`POINTS_PER_XAF = 0.01`) lorsqu'une commande passe à `DELIVERED`.

---

## 20. Retours (`/returns`)

| Méthode | Route                       | Auth                | Body                                                                                                                                                                                                  |
| ------- | --------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/returns`                  | 🔒 ADMIN            | Query `page?, limit?, status?`                                                                                                                                                                        |
| GET     | `/returns/:returnId`        | ✅ (owner ou admin) | —                                                                                                                                                                                                     |
| POST    | `/returns`                  | ✅                  | `order_id, reason(min2), notes?, items: [{order_item_id, quantity, condition?}] (min1)` — vérifie que chaque item appartient bien à la commande et que la quantité ne dépasse pas la quantité achetée |
| PUT     | `/returns/:returnId/status` | 🔒 ADMIN            | `status(PENDING\|APPROVED\|REJECTED\|COMPLETED), notes?` — 400 si déjà `COMPLETED`                                                                                                                    |
| GET     | `/orders/:orderId/returns`  | ✅ (owner ou admin) | —                                                                                                                                                                                                     |

---

## 21. Dashboard (`/dashboard`) 🔒 ADMIN

| Méthode | Route                    | Query                     |
| ------- | ------------------------ | ------------------------- |
| GET     | `/dashboard/stats`       | —                         |
| GET     | `/dashboard/sales-chart` | `year?, period?(monthly)` |

---

## Codes d'erreur HTTP

| Code | Signification                                                                           |
| ---- | --------------------------------------------------------------------------------------- |
| 400  | Validation échouée / requête invalide                                                   |
| 401  | Token manquant ou invalide                                                              |
| 403  | Rôle insuffisant ou ressource d'un autre utilisateur                                    |
| 404  | Ressource introuvable                                                                   |
| 409  | Conflit (doublon)                                                                       |
| 429  | Rate limit dépassé (100 req / 15 min, header `x-request-id` renvoyé sur chaque réponse) |
| 500  | Erreur interne serveur                                                                  |
| 503  | Fonctionnalité temporairement indisponible (moyens de paiement non branchés)            |
