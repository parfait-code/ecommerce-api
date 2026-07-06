# API_SPEC — Spécification condensée des endpoints

> Vue d'ensemble par ressource. Pour le détail exhaustif de chaque route (query params, codes d'erreur précis), voir `API_ROUTES.MD`. Pour les interfaces TypeScript et exemples d'intégration frontend, voir `API_INTEGRATION_GUIDE.md`. Pour le cycle de vie des statuts et les synchronisations automatiques entre entités, voir `STATUS_MANAGEMENT.md`.

## Conventions globales

### Base URL

```
https://api.ton-domaine.com
```

### Authentification

Toutes les routes protégées nécessitent :

```
Authorization: Bearer <accessToken>
```

Obtenu via `POST /signup` ou `POST /login`.

### Format de réponse standard

```json
// Succès
{ "status": true, "data": { ... } }

// Erreur
{ "status": false, "error": { "message": "..." } }
```

### Codes HTTP utilisés

| Code | Usage                                                                               |
| ---- | ----------------------------------------------------------------------------------- |
| 200  | Succès général                                                                      |
| 201  | Ressource créée                                                                     |
| 400  | Requête invalide / validation échouée / règle métier violée                         |
| 401  | Non authentifié                                                                     |
| 403  | Non autorisé (rôle insuffisant, ressource d'un autre utilisateur, compte désactivé) |
| 404  | Ressource introuvable                                                               |
| 409  | Conflit (doublon)                                                                   |
| 429  | Rate limit dépassé (100 req / 15 min)                                               |
| 500  | Erreur serveur                                                                      |
| 503  | Fonctionnalité temporairement indisponible                                          |

### Pagination

Toutes les routes de liste paginées suivent :

```
GET /resource?page=1&limit=20
```

Réponse :

```json
{ "items": [...], "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
```

### Devise

Tous les montants sont en **XAF** (franc CFA), sans sous-unité décimale significative.

---

## 1. Auth

#### POST /signup

Crée un compte. Le rôle est toujours forcé à `USER` côté serveur.

```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "firstName": "string",
  "lastName": "string",
  "dateOfBirth": "ISO?",
  "phone": "string?"
}
```

→ `{ user, token }`

#### POST /login

```json
{ "username": "string", "password": "string" }
```

→ `{ user, token }` — `400` si identifiants invalides, `403` si compte désactivé (manuellement ou par verrouillage automatique brute-force, voir §22 de `API_ROUTES.MD`).

---

## 2. Users

| Route                             | Auth     | Description                                               |
| --------------------------------- | -------- | --------------------------------------------------------- |
| `GET /user`                       | ✅       | Profil courant                                            |
| `PATCH /user`                     | ✅       | Mise à jour partielle du profil                           |
| `GET /user/all`                   | 🔒 ADMIN | Liste tous les utilisateurs                               |
| `GET /user/:userId`               | 🔒 ADMIN | Détail                                                    |
| `POST /user`                      | 🔒 ADMIN | Création admin d'un utilisateur                           |
| `PATCH /user/change-role/:userId` | 🔒 ADMIN | Change le rôle                                            |
| `PATCH /user/:userId/status`      | 🔒 ADMIN | Suspend/réactive (`isActive`), indépendant de `deletedAt` |
| `DELETE /user/:userId`            | 🔒 ADMIN | Soft delete — `400` en cas d'auto-suppression             |

---

## 3. Catalogue — Categories

| Route                                  | Auth     | Description                                                                     |
| -------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| `GET /categories`                      | ❌       | Liste (actives uniquement, sauf admin avec `?includeInactive=true`)             |
| `GET /categories/:categoryId`          | ✅       | Détail admin (même inactive)                                                    |
| `GET /categories/slug/:slug`           | ❌       | Détail public — 404 si inactive                                                 |
| `GET /categories/slug/:slug/products`  | ❌       | Produits d'une catégorie — 404 si inactive                                      |
| `POST /categories`                     | 🔒 ADMIN | Création                                                                        |
| `PUT /categories/:categoryId`          | 🔒 ADMIN | Mise à jour partielle                                                           |
| `DELETE /categories/:categoryId`       | 🔒 ADMIN | 400 si des produits sont rattachés                                              |
| `POST /categories/:categoryId/assets`  | 🔒 ADMIN | Upload image/icône (`multipart`, champs `image?`/`icon?`) — upload réel vers R2 |
| `DELETE /categories/:categoryId/image` | 🔒 ADMIN | Supprime l'image                                                                |
| `DELETE /categories/:categoryId/icon`  | 🔒 ADMIN | Supprime l'icône                                                                |

---

## 4. Catalogue — Attributes

Un attribut est **produit** (`isVariant:false`, valeur libre) ou **variante** (`isVariant:true`, régi par les combinaisons — voir §6).

| Route                                     | Auth     | Description                                                                             |
| ----------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `GET /categories/:categoryId/attributes`  | ❌       | Attributs d'une catégorie                                                               |
| `POST /categories/:categoryId/attributes` | 🔒 ADMIN | Création                                                                                |
| `GET /attributes/:definitionId`           | ✅       | Détail                                                                                  |
| `PATCH /attributes/:definitionId`         | 🔒 ADMIN | Mise à jour partielle                                                                   |
| `DELETE /attributes/:definitionId`        | 🔒 ADMIN | Suppression                                                                             |
| `POST /attributes/:definitionId/options`  | 🔒 ADMIN | Ajout d'option (variante)                                                               |
| `PATCH /attributes/options/:optionId`     | 🔒 ADMIN | Mise à jour d'option                                                                    |
| `DELETE /attributes/options/:optionId`    | 🔒 ADMIN | Suppression d'option                                                                    |
| `PUT /product/:productId/attributes`      | 🔒 ADMIN | Valeurs des attributs produit — rejette (400) si un attribut ciblé est de type variante |

Garde-fou : un produit ne peut passer `ACTIVE` que si tous les attributs produit `isRequired:true` de sa catégorie sont renseignés.

---

## 5. Catalogue — Products

| Route                               | Auth     | Description                                                          |
| ----------------------------------- | -------- | -------------------------------------------------------------------- |
| `GET /product`                      | ❌       | Liste paginée, `?categoryId&search`, enrichie d'un `pricing` calculé |
| `GET /product/:productId`           | ❌       | Détail — 404 si soft-deleted                                         |
| `POST /product`                     | 🔒 ADMIN | Création — toujours `status:DRAFT`                                   |
| `PATCH /product/:productId`         | 🔒 ADMIN | Mise à jour partielle — `categoryId` immuable                        |
| `DELETE /product/:productId`        | 🔒 ADMIN | Soft delete                                                          |
| `POST /product/:productId/images`   | 🔒 ADMIN | Upload (`multipart`, champ `images`, 1-5)                            |
| `DELETE /product/:productId/images` | 🔒 ADMIN | `{ imageId }`                                                        |

---

## 6. Catalogue — Combinations (variantes)

Remplace l'ancien système `ProductVariant` — `combinationId` partout dans l'API (panier, commande, wishlist, inventaire).

| Route                                                                    | Auth     | Description                     |
| ------------------------------------------------------------------------ | -------- | ------------------------------- |
| `GET /product/:productId/combinations`                                   | ❌       | Combinaisons actives            |
| `GET /product/:productId/combinations/selections`                        | ❌       | Sélections d'options courantes  |
| `PUT /product/:productId/combinations/selections/:attributeDefinitionId` | 🔒 ADMIN | Définit les options disponibles |
| `POST /product/:productId/combinations/generate`                         | 🔒 ADMIN | Génère le produit cartésien     |
| `GET /product/:productId/combinations/:combinationId`                    | ✅       | Détail                          |
| `PATCH /product/:productId/combinations/:combinationId`                  | 🔒 ADMIN | `{ sku?, price?, isActive? }`   |
| `DELETE /product/:productId/combinations/:combinationId`                 | 🔒 ADMIN | 400 si inventaire non vide      |

---

## 7. Catalogue — Tags

| Route                          | Auth     | Description            |
| ------------------------------ | -------- | ---------------------- |
| `GET /tags`                    | ❌       | Liste                  |
| `GET /tags/:tagId`             | ❌       | Détail (avec produits) |
| `POST /tags`                   | 🔒 ADMIN | Création               |
| `PATCH /tags/:tagId`           | 🔒 ADMIN | Mise à jour            |
| `DELETE /tags/:tagId`          | 🔒 ADMIN | Suppression            |
| `PUT /product/:productId/tags` | 🔒 ADMIN | Remplace tous les tags |
| `GET /product/:productId/tags` | ✅       | Tags d'un produit      |

---

## 8. Basket (panier)

> Terme utilisé dans tout le code : **basket**, pas "cart".

| Route                                     | Auth | Description                                      |
| ----------------------------------------- | ---- | ------------------------------------------------ |
| `GET /user/basket`                        | ✅   | Panier unique de l'utilisateur (get-or-create)   |
| `POST /basket`                            | ✅   | Nouveau panier (historique, pas d'unicité) → 201 |
| `GET /basket/:basket_id`                  | ✅   | Détail                                           |
| `POST /basket/:basket_id/product`         | ✅   | `{ product_id, combination_id?, quantity }`      |
| `PUT /basket/:basket_id/product/quantity` | ✅   | Idem                                             |
| `DELETE /basket/:basket_id/product`       | ✅   | `{ product_id, combination_id? }`                |

---

## 9. Wishlist

| Route                    | Auth | Description                       |
| ------------------------ | ---- | --------------------------------- |
| `GET /wishlist`          | ✅   | Créée automatiquement si absente  |
| `POST /wishlist/items`   | ✅   | `{ product_id, combination_id? }` |
| `DELETE /wishlist/items` | ✅   | Idem                              |

---

## 10. Orders

> Il n'existe **pas** de module "checkout" séparé — la commande est créée directement à partir d'un panier ou d'une liste d'articles via `POST /orders`.

| Route                         | Auth     | Description                                                |
| ----------------------------- | -------- | ---------------------------------------------------------- |
| `GET /orders`                 | ✅       | `?status&customer(admin)&page&limit`                       |
| `POST /orders`                | ✅       | Voir body ci-dessous                                       |
| `GET /orders/:orderId`        | ✅       | 403 si pas propriétaire (sauf admin)                       |
| `PUT /orders/:orderId`        | ✅       | Adresses/méthode livraison/notes                           |
| `DELETE /orders/:orderId`     | ✅       | Annulation — restitue le stock, annule les collectes liées |
| `PUT /orders/:orderId/status` | 🔒 ADMIN | Transition validée par state machine                       |
| `GET /user/:userId/orders`    | 🔒 ADMIN | —                                                          |

```json
// Body POST /orders
{
  "items": [{ "id": "productId", "combinationId": "string?", "quantity": 1 }],
  // OU "basketId": "string"
  "shippingAddress": {
    "street": "...",
    "city": "...",
    "country": "...",
    "postalCode": "..."
  },
  "billingAddress": { "...": "..." },
  "shippingMethodId": "string?",
  "paymentMethodId": "string?",
  "notes": "string?",
  "couponCode": "string?"
}
```

Statuts (state machine) : `PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED → REFUNDED`, avec `CANCELLED` accessible depuis `PENDING`/`CONFIRMED`/`PROCESSING`. Toute transition non listée → `400`.

---

## 11. Payments

| Route                                | Auth     | Description                                                                    |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------ |
| `GET /payment-methods`               | ❌       | Seul `CASH_ON_DELIVERY` est `available:true`                                   |
| `POST /payments`                     | ✅       | `{ order_id, method, currency?, notes? }` — `503` si méthode indisponible      |
| `GET /payments/:payment_id`          | ✅       | —                                                                              |
| `GET /orders/:orderId/payments`      | ✅       | —                                                                              |
| `GET /payments`                      | 🔒 ADMIN | `?status&method&order_id`                                                      |
| `PUT /payments/:payment_id/status`   | 🔒 ADMIN | State machine : `PENDING → COMPLETED/FAILED/CANCELLED`, `COMPLETED → REFUNDED` |
| `PUT /payments/:payment_id/complete` | 🔒 ADMIN | Déprécié — alias de `status:COMPLETED`                                         |

---

## 12. Reviews

| Route                        | Auth       | Description                                                                             |
| ---------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `GET /products/:pid/reviews` | ❌         | → `{ average_rating, total_reviews, reviews[] }`                                        |
| `GET /reviews/:rid`          | ❌         | —                                                                                       |
| `POST /reviews`              | ✅         | `{ order_item_id, product_id, rating(1-5), comment? }` — un seul avis par achat vérifié |
| `PUT /reviews/:rid`          | ✅ (owner) | —                                                                                       |
| `DELETE /reviews/:rid`       | ✅ (owner) | —                                                                                       |

---

## 13. Warehouses & Inventory

| Route                                     | Auth     | Description                                        |
| ----------------------------------------- | -------- | -------------------------------------------------- |
| `GET /warehouses`                         | ✅       | Liste (cache)                                      |
| `GET /warehouses/:warehouse_id`           | ✅       | Détail (cache)                                     |
| `GET /warehouses/:warehouse_id/inventory` | ✅       | —                                                  |
| `POST /warehouses`                        | 🔒 ADMIN | —                                                  |
| `PUT /warehouses/:warehouse_id`           | 🔒 ADMIN | —                                                  |
| `DELETE /warehouses/:warehouse_id`        | 🔒 ADMIN | 400 si stock actif présent                         |
| `GET /inventory`                          | ✅       | `?category&location&page&limit`                    |
| `GET /inventory/low-stock`                | ✅       | `?threshold(défaut 10)`                            |
| `GET /inventory/out-of-stock`             | ✅       | —                                                  |
| `GET /inventory/search`                   | ✅       | `?keyword` requis                                  |
| `GET /inventory/:item_id`                 | ✅       | —                                                  |
| `POST /inventory`                         | 🔒 ADMIN | 409 si doublon `(product, warehouse, combination)` |
| `PUT /inventory/:item_id`                 | 🔒 ADMIN | —                                                  |
| `DELETE /inventory/:item_id`              | 🔒 ADMIN | —                                                  |
| `POST /inventory/transfer`                | 🔒 ADMIN | 400 si stock source insuffisant                    |

Toute mutation de quantité déclenche les alertes `LOW_STOCK`/`OUT_OF_STOCK` (event bus, seuil 10).

---

## 14. Shipments, Tracking & Pickup Requests

| Route                                     | Auth             | Description                                                |
| ----------------------------------------- | ---------------- | ---------------------------------------------------------- |
| `POST /shipments/cost`                    | ❌               | `cost = 5 + weight*0.1` XAF                                |
| `POST /shipments`                         | 🔒 ADMIN         | —                                                          |
| `GET /shipments/:shipmentId`              | ✅               | —                                                          |
| `GET /shipments`                          | 🔒 ADMIN         | `?status&order_id`                                         |
| `POST /shipments/:shipmentId/track`       | ✅               | `{ status, location?, shipment_status? }`                  |
| `GET /shipments/:shipmentId/track`        | ✅               | —                                                          |
| `PUT /shipments/:shipmentId/status`       | 🔒 ADMIN         | Bloqué depuis un statut terminal                           |
| `POST /shipments/:shipmentId/cancel`      | ✅               | —                                                          |
| `GET /labels/:shipmentId`                 | ✅               | Crée l'étiquette si absente                                |
| `POST /pickup-requests`                   | ✅               | `{ pickup_date, pickup_address, order_id?, shipment_id? }` |
| `GET /pickup-requests`                    | 🔒 ADMIN         | —                                                          |
| `GET /pickup-requests/:requestId`         | ✅               | —                                                          |
| `POST /pickup-requests/:requestId/cancel` | ✅ (owner)       | —                                                          |
| `GET /orders/:orderId/shipment`           | ✅ (owner/admin) | —                                                          |

Synchronisation automatique (best-effort) `Shipment → Order` : `IN_TRANSIT → SHIPPED`, `DELIVERED → DELIVERED`.

---

## 15. Shipping Methods

| Route                                | Auth     | Description                            |
| ------------------------------------ | -------- | -------------------------------------- |
| `GET /shipping-methods`              | ❌       | `?active`                              |
| `GET /shipping-methods/:methodId`    | ❌       | —                                      |
| `POST /shipping-methods`             | 🔒 ADMIN | —                                      |
| `PATCH /shipping-methods/:methodId`  | 🔒 ADMIN | —                                      |
| `DELETE /shipping-methods/:methodId` | 🔒 ADMIN | —                                      |
| `POST /shipping-methods/calculate`   | ❌       | `cost = basePrice + pricePerKg*weight` |

---

## 16. Address Validation & Addresses

| Route                          | Auth       | Description                                                   |
| ------------------------------ | ---------- | ------------------------------------------------------------- |
| `POST /address/validate`       | ❌         | Liste de pays codée en dur — pas un service de géocodage réel |
| `GET /addresses`               | ✅         | —                                                             |
| `GET /addresses/:addressId`    | ✅ (owner) | 403 sinon                                                     |
| `POST /addresses`              | ✅         | `isDefault:true` retire le défaut des autres                  |
| `PATCH /addresses/:addressId`  | ✅ (owner) | —                                                             |
| `DELETE /addresses/:addressId` | ✅ (owner) | —                                                             |

---

## 17. Promotions, Discounts & Coupons

| Route                                                   | Auth     | Description                                                                                     |
| ------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `GET /promotions/slug/:slug`                            | ❌       | Page publique                                                                                   |
| `GET /promotions/slug/:slug/products`                   | ❌       | Produits affectés (ciblage direct + par catégorie, fusionnés/dédoublonnés, `ACTIVE` uniquement) |
| `GET /promotions/active`                                | ❌       | Promotions `ACTIVE` (statut calculé), triées par `endDate`                                      |
| `POST /coupons/validate`                                | ✅       | `{ code, basketId?, items? }` — `items` déclenche un `preview` du total                         |
| `GET /promotions`                                       | 🔒 ADMIN | `?status&isActive` — filtre sur statut calculé                                                  |
| `GET /promotions/:promotionId`                          | 🔒 ADMIN | —                                                                                               |
| `GET /promotions/:promotionId/products`                 | 🔒 ADMIN | Équivalent admin                                                                                |
| `POST /promotions`                                      | 🔒 ADMIN | —                                                                                               |
| `PUT /promotions/:promotionId`                          | 🔒 ADMIN | —                                                                                               |
| `PATCH /promotions/:promotionId/toggle`                 | 🔒 ADMIN | Bascule `isActive`                                                                              |
| `DELETE /promotions/:promotionId`                       | 🔒 ADMIN | —                                                                                               |
| `POST /promotions/:promotionId/images`                  | 🔒 ADMIN | `multipart`, champ `images`, 1-5                                                                |
| `DELETE /promotions/:promotionId/images`                | 🔒 ADMIN | `{ imageUrl }`                                                                                  |
| `POST /promotions/:promotionId/discounts`               | 🔒 ADMIN | `type, value, categoryId?, productIds?` — ciblage requis                                        |
| `DELETE /promotions/:promotionId/discounts/:discountId` | 🔒 ADMIN | —                                                                                               |
| `GET /promotions/:promotionId/coupons`                  | 🔒 ADMIN | Avec `effectiveIsActive` calculé                                                                |
| `POST /promotions/:promotionId/coupons`                 | 🔒 ADMIN | —                                                                                               |
| `DELETE /promotions/:promotionId/coupons/:couponId`     | 🔒 ADMIN | —                                                                                               |

⚠️ Un `CouponCode` n'a pas de valeur de réduction propre — seuls les `Discount` d'une promotion réduisent réellement les prix. Un coupon sans `Discount` associé s'applique à la commande sans effet monétaire.

---

## 18. Loyalty

| Route                          | Auth     | Description                              |
| ------------------------------ | -------- | ---------------------------------------- |
| `GET /loyalty/:userId/balance` | ✅       | Aucun contrôle de propriété              |
| `GET /loyalty/:userId/history` | ✅       | Idem                                     |
| `POST /loyalty/adjust`         | 🔒 ADMIN | `{ userId, points(≠0), type, orderId? }` |

1 point / 100 XAF à la livraison. Reversal automatique au retour complété.

---

## 19. Returns

| Route                           | Auth             | Description                         |
| ------------------------------- | ---------------- | ----------------------------------- |
| `GET /returns`                  | 🔒 ADMIN         | `?status&page&limit`                |
| `GET /returns/:returnId`        | ✅ (owner/admin) | —                                   |
| `POST /returns`                 | ✅               | Requiert `Order.status = DELIVERED` |
| `PUT /returns/:returnId/status` | 🔒 ADMIN         | 400 si déjà `COMPLETED`             |
| `GET /orders/:orderId/returns`  | ✅ (owner/admin) | —                                   |

Un passage à `COMPLETED` déclenche : remboursement, réintégration de stock, reversal fidélité.

---

## 20. Dashboard

| Route                        | Auth     | Description                          |
| ---------------------------- | -------- | ------------------------------------ |
| `GET /dashboard/stats`       | 🔒 ADMIN | Chiffres clés + tendances mensuelles |
| `GET /dashboard/sales-chart` | 🔒 ADMIN | `?year&period`                       |

---

## Notes d'implémentation

- Modules **non implémentés** malgré une éventuelle attente initiale : refunds, invoices, webhooks, transactions génériques, gestion multiple des `payment-methods` utilisateur (seule une liste fixe de méthodes globales existe). Ne pas s'y référer.
- Le panier s'appelle **basket** dans tout le code et toutes les routes — jamais "cart".
- `combinationId` a totalement remplacé l'ancien `variantId` (panier, commande, wishlist, inventaire, images).
- Toute mutation de statut significative (commande, paiement, expédition, retour) passe par un event bus interne (`src/shared/events`) qui déclenche des effets en cascade documentés dans `STATUS_MANAGEMENT.md` — s'y référer avant d'implémenter une logique de synchronisation manuelle côté frontend.

```

```
