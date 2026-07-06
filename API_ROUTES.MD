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
| ------- | --------- | ---- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST    | `/signup` | ❌   | `username(3-50), email, password(min6), firstName(2-50), lastName(2-50), dateOfBirth?, phone?` | Le rôle est toujours forcé à `USER` côté service, quelle que soit la valeur envoyée.                                                                                                                                                                                                               |
| POST    | `/login`  | ❌   | `username, password`                                                                            | 400 si identifiants invalides ou compte inexistant, 403 si compte désactivé (`isActive:false`, manuellement ou automatiquement verrouillé — voir §22).                                                                                                                                             |

Réponse `/signup` et `/login` : `{ user (sans password), token }`.

⚠️ **Protection brute-force (§22)** : après 5 échecs de mot de passe consécutifs sur une fenêtre de 15 minutes pour un même `username`, le compte est automatiquement désactivé (`isActive: false`). Le message d'erreur reste identique à celui d'une désactivation manuelle par un admin (`403 "This account has been deactivated."`) — aucune distinction n'est faite côté client pour ne pas révéler l'état exact du compte à un attaquant. Réactivation possible uniquement par un admin via `PATCH /user/:userId/status`.

---

## 2. Utilisateurs (`/user`)

| Méthode | Route                       | Auth     | Body                                                                                       |
| ------- | ---------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| GET     | `/user`                     | ✅       | —                                                                                            |
| PATCH   | `/user`                     | ✅       | `email?, firstName?, lastName?, dateOfBirth?, phone?`                                       |
| GET     | `/user/all`                 | 🔒 ADMIN | —                                                                                            |
| GET     | `/user/:userId`             | 🔒 ADMIN | —                                                                                            |
| POST    | `/user`                     | 🔒 ADMIN | `username, email, password, firstName, lastName, dateOfBirth?, phone?, role?(défaut USER)` |
| PATCH   | `/user/change-role/:userId` | 🔒 ADMIN | `role`                                                                                       |
| PATCH   | `/user/:userId/status`      | 🔒 ADMIN | `{ isActive: boolean }` — suspend, réactive, ou débloque un compte verrouillé (voir §22)     |
| DELETE  | `/user/:userId`             | 🔒 ADMIN | — → `{ numberOfUsersDeleted: 1 }` (soft delete)                                             |

⚠️ Les routes statiques (`/user/all`, `/user` POST, `/user/:userId/status`) sont déclarées **avant** `/user/:userId` dans le router — ordre obligatoire en Express.

⚠️ **Restriction d'auto-suppression** : `DELETE /user/:userId` renvoie **400** `"You cannot delete your own account"` si `userId` correspond au compte de l'appelant (comparé au JWT), même pour un admin.

⚠️ **`PATCH /user/:userId/status`** : bascule uniquement `isActive`, complètement indépendant de `deletedAt`. Ne fonctionne pas sur un compte déjà soft-supprimé (404, car `findById` filtre `deletedAt: null`). C'est la seule route pour lever un verrouillage automatique du brute-force (§22).

---

## 3. Produits (`/product`)

| Méthode | Route                        | Auth     | Notes                                                                                                     |
| ------- | ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| GET     | `/product`                   | ❌       | Query : `page?, limit?, categoryId?, search?` — `search` filtre sur `name` OU `sku`. Réponse enrichie d'un objet `pricing` par produit (voir §18). |
| GET     | `/product/:productId`        | ❌       | 404 si introuvable ou soft-deleted. Inclut `combinations` (actives uniquement) et `attributeSelections`. |
| POST    | `/product`                   | 🔒 ADMIN | `sku, name, description?, price, categoryId, status?(toujours forcé à DRAFT), weight`                    |
| PATCH   | `/product/:productId`        | 🔒 ADMIN | body partiel. Passage à `ACTIVE` bloqué si attributs produit requis manquants (voir §4).                 |
| DELETE  | `/product/:productId`        | 🔒 ADMIN | soft delete → `{ numberOfProductsDeleted: 1 }`                                                            |
| POST    | `/product/:productId/images` | 🔒 ADMIN | `multipart/form-data`, champ `images` (1-5, jpeg/png/webp/gif, 5MB max), `combinationId?` optionnel      |
| DELETE  | `/product/:productId/images` | 🔒 ADMIN | body `{ imageId }`                                                                                        |

⚠️ **CORRECTION** : `categoryId` est immuable après création (`updateProductSchema` l'omet) — pas de route pour changer la catégorie d'un produit existant.

---

## 4. Attributs (`/categories/:categoryId/attributes`, `/attributes`, `/product/:productId/attributes`)

Un attribut est soit un **attribut produit** (`isVariant: false`, valeur texte libre par produit) soit un **attribut de variante** (`isVariant: true`, régi par le système de combinaisons — voir §5).

| Méthode | Route                                | Auth     | Body                                                                                                                |
| ------- | ------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| GET     | `/categories/:categoryId/attributes` | ❌       | —                                                                                                                    |
| POST    | `/categories/:categoryId/attributes` | 🔒 ADMIN | `name, slug, type(TEXT\|NUMBER\|COLOR\|BOOLEAN\|SELECT), unit?, isVariant?, isFilterable?, isRequired?, position?`  |
| GET     | `/attributes/:definitionId`          | ✅       | —                                                                                                                    |
| PATCH   | `/attributes/:definitionId`          | 🔒 ADMIN | body partiel                                                                                                         |
| DELETE  | `/attributes/:definitionId`          | 🔒 ADMIN | —                                                                                                                    |
| POST    | `/attributes/:definitionId/options`  | 🔒 ADMIN | `value, colorHex?(#RRGGBB), position?` — les options d'un attribut de variante alimentent les sélections (§5)       |
| PATCH   | `/attributes/options/:optionId`      | 🔒 ADMIN | body partiel                                                                                                         |
| DELETE  | `/attributes/options/:optionId`      | 🔒 ADMIN | —                                                                                                                    |
| PUT     | `/product/:productId/attributes`     | 🔒 ADMIN | `attributes: [{attributeDefinitionId, value}]` — **uniquement pour les attributs produit** (`isVariant:false`), remplace toutes les valeurs. Rejette (400) si un attribut ciblé est `isVariant:true`. |

⚠️ **CORRECTIF (bug catalogue public)** : `GET /categories/:categoryId/attributes` est désormais public (❌) — un visiteur non connecté doit pouvoir consulter les attributs disponibles pour filtrer/afficher un produit sans être authentifié. Seul `GET /attributes/:definitionId` reste protégé (`✅`) pour le moment.

**Garde-fou d'activation produit** : un produit ne peut passer `ACTIVE` que si tous les attributs produit `isRequired: true` de sa catégorie sont renseignés. Les attributs de variante ne sont jamais concernés par ce contrôle (voir §5, avertissement `PRODUCT_ACTIVATED_WITHOUT_COMBINATIONS`).

---

## 5. Combinaisons produit (`/product/:productId/combinations`)

Remplace l'ancien système de "variantes" — `combinationId` remplace `variantId` partout dans l'API (panier, commande, wishlist, inventaire).

| Méthode | Route                                                              | Auth     | Body                                          |
| ------- | ------------------------------------------------------------------- | -------- | ------------------------------------------------ |
| GET     | `/product/:productId/combinations`                                  | ❌       | → `ProductCombination[]` actives uniquement      |
| GET     | `/product/:productId/combinations/selections`                       | ❌       | Liste les sélections d'options courantes, par attribut |
| PUT     | `/product/:productId/combinations/selections/:attributeDefinitionId` | 🔒 ADMIN | `{ optionIds: string[] }` — définit les options disponibles pour CE produit sur un attribut de variante |
| POST    | `/product/:productId/combinations/generate`                         | 🔒 ADMIN | — → génère le produit cartésien des sélections (crée/réactive les combinaisons correspondantes, désactive les autres — jamais de suppression automatique) |
| GET     | `/product/:productId/combinations/:combinationId`                   | ✅       | —                                                 |
| PATCH   | `/product/:productId/combinations/:combinationId`                   | 🔒 ADMIN | `{ sku?, price?, isActive? }`                    |
| DELETE  | `/product/:productId/combinations/:combinationId`                   | 🔒 ADMIN | **400** si de l'inventaire existe encore dessus  |

⚠️ **CORRECTIF (bug catalogue public)** : `GET .../combinations` et `GET .../combinations/selections` sont désormais publics (❌) — indispensables pour afficher le sélecteur de variante (taille, couleur...) sur une fiche produit sans être connecté. `GET .../:combinationId` (détail d'une combinaison précise par id) reste protégé pour le moment.

⚠️ Désactiver une combinaison (manuellement ou via `generate()`) **n'est pas bloqué** même si elle a du stock actif — un événement `COMBINATION_DEACTIVATED_WITH_STOCK` est loggé (non bloquant), seule la **suppression** est bloquée par du stock existant.

**Format `ProductCombination`** :

```json
{
  "id": "cmb_xxx",
  "optionsKey": "opt1:opt2",
  "sku": "TSH-M-ORANGE",
  "price": 4500,
  "isActive": true,
  "values": [
    { "attributeDefinition": { "name": "Taille" }, "attributeOption": { "value": "M" } }
  ],
  "inventory": [{ "quantity": 10, "warehouseId": "wh_xxx" }]
}
```

---

## 6. Tags (`/tags`, `/product/:productId/tags`)

| Méthode | Route                      | Auth     | Body                                                    |
| ------- | -------------------------- | -------- | -------------------------------------------------------- |
| GET     | `/tags`                    | ❌       | —                                                       |
| GET     | `/tags/:tagId`             | ❌       | — (avec `products`)                                     |
| POST    | `/tags`                    | 🔒 ADMIN | `name(2-50), slug(2-50, kebab-case)`                    |
| PATCH   | `/tags/:tagId`             | 🔒 ADMIN | body partiel                                            |
| DELETE  | `/tags/:tagId`             | 🔒 ADMIN | —                                                       |
| PUT     | `/product/:productId/tags` | 🔒 ADMIN | `{ tagIds: string[] }` (min 1) — remplace tous les tags |
| GET     | `/product/:productId/tags` | ✅       | —                                                       |

---

## 7. Catégories (`/categories`)

| Méthode | Route                             | Auth     | Body                                                                                                                          |
| ------- | ---------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/categories`                     | ❌       | Query `includeInactive?(bool)` — **effectif uniquement si l'appelant est ADMIN**, ignoré sinon. Sans ce paramètre : uniquement les catégories `isActive:true` (mis en cache séparément de la vue admin). |
| GET     | `/categories/:categoryId`         | ✅       | Consultation admin — retourne la catégorie même si `isActive:false`                                                             |
| GET     | `/categories/slug/:slug`          | ❌       | **404 si la catégorie est `isActive:false`** — route publique                                                                   |
| GET     | `/categories/slug/:slug/products` | ❌       | **404 si la catégorie est `isActive:false`** — idem, route publique                                                             |
| POST    | `/categories`                     | 🔒 ADMIN | `name(2-100), slug(2-100, kebab-case), description?, imageUrl?, iconUrl?, metaTitle?, metaDescription?, isActive?, parentId?` |
| PUT     | `/categories/:categoryId`         | 🔒 ADMIN | body partiel                                                                                                                     |
| DELETE  | `/categories/:categoryId`         | 🔒 ADMIN | **400** si des produits sont encore rattachés                                                                                    |
| POST    | `/categories/:categoryId/assets`  | 🔒 ADMIN | `multipart/form-data`, champs `image?` et/ou `icon?` (1 fichier chacun, jpeg/png/webp/gif, 5MB max) — **l'API uploade elle-même le fichier vers R2 et renvoie l'URL**, aligné sur le comportement produit/promotion |
| DELETE  | `/categories/:categoryId/image`   | 🔒 ADMIN | — supprime le fichier sur R2 et vide `imageUrl`                                                                                  |
| DELETE  | `/categories/:categoryId/icon`    | 🔒 ADMIN | — supprime le fichier sur R2 et vide `iconUrl`                                                                                   |

⚠️ **CORRECTIF (bug catalogue public)** : `GET /categories` est désormais public (❌) — la navigation par catégories doit fonctionner pour un visiteur non connecté.

⚠️ **Nouveau — upload d'assets** : `imageUrl`/`iconUrl` acceptent toujours une URL directe dans le body `POST`/`PUT` classique (`z.string().url()`), mais le flux recommandé est de créer la catégorie sans ces champs, puis d'appeler `POST /categories/:categoryId/assets` avec les fichiers sélectionnés localement — exactement comme pour les images produit. `deleteImage`/`deleteIcon` retournent **404** si l'asset ciblé n'est pas défini sur la catégorie.

⚠️ **`isActive` désormais effectif** (précédemment un champ purement déclaratif) : une catégorie désactivée disparaît de `GET /categories` (sauf admin avec `includeInactive=true`) et devient inaccessible via les deux routes publiques par slug (404). Aucune cascade sur les sous-catégories ou produits — seule la catégorie elle-même est filtrée.

---

## 8. Panier (`/basket`, `/user/basket`)

| Méthode | Route                                  | Auth | Body                                                                                              |
| ------- | ---------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| GET     | `/user/basket`                          | ✅   | Get-or-create : retourne le panier unique de l'utilisateur, le crée s'il n'existe pas encore        |
| POST    | `/basket`                                | ✅   | — → `201` panier vide (aucune contrainte d'unicité `userId` sur cette route historique)              |
| GET     | `/basket/:basket_id`                     | ✅   | —                                                                                                    |
| POST    | `/basket/:basket_id/product`             | ✅   | `product_id, combination_id?, quantity` — incrémente si déjà présent (même couple produit/combinaison) |
| PUT     | `/basket/:basket_id/product/quantity`    | ✅   | `product_id, combination_id?, quantity`                                                              |
| DELETE  | `/basket/:basket_id/product`             | ✅   | `product_id, combination_id?`                                                                        |

⚠️ **CORRECTION** : `combination_id` remplace `variant_id` (ancien système). Une combinaison inactive (`isActive:false`) est rejetée à l'ajout (400).

---

## 9. Wishlist (`/wishlist`)

| Méthode | Route             | Auth | Body                             |
| ------- | ----------------- | ---- | --------------------------------- |
| GET     | `/wishlist`       | ✅   | — (créée automatiquement si absente) |
| POST    | `/wishlist/items` | ✅   | `product_id, combination_id?`     |
| DELETE  | `/wishlist/items` | ✅   | `product_id, combination_id?`     |

Wishlist unique par utilisateur (`@unique userId`).

---

## 10. Commandes (`/orders`)

| Méthode | Route                     | Auth     | Notes                                                                                                                                |
| ------- | ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/orders`                 | ✅       | Query `page?, limit?, status?, customer?` — `customer` (admin uniquement) filtre `user.email` en `contains` insensible à la casse       |
| POST    | `/orders`                 | ✅       | Voir body ci-dessous                                                                                                                     |
| GET     | `/orders/:orderId`        | ✅       | 403 si la commande n'appartient pas à l'appelant (sauf admin)                                                                            |
| PUT     | `/orders/:orderId`        | ✅       | body partiel (adresses, méthode de livraison, notes)                                                                                     |
| DELETE  | `/orders/:orderId`        | ✅       | annule la commande → restitue le stock réservé (`OrderItemReservation`), annule les collectes `PENDING` liées, émet `order.status.changed` |
| PUT     | `/orders/:orderId/status` | 🔒 ADMIN | `status, reason?, shippingCarrier?, trackingNumber?, estimatedDeliveryDate?`                                                             |
| GET     | `/user/:userId/orders`    | 🔒 ADMIN | Query `page?, limit?`                                                                                                                    |

**Body `POST /orders`** :

```ts
{
  items?: { id: string; combinationId?: string; quantity: number }[]; // OU basketId
  basketId?: string;
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

`items[].id` est le `productId` en string. `combinationId` remplace l'ancien `variantId`.

**Logique de stock** (voir `STATUS_MANAGEMENT.md` §9) :
- Vérification à la commande : somme du stock sur **tous les entrepôts** pour `(productId, combinationId)` ≥ quantité demandée.
- Réservation FIFO : décrément par entrepôt le plus anciennement approvisionné, tracé dans `OrderItemReservation`.
- **400** si stock total insuffisant ; **409** si le stock a été pris entre vérification et réservation (rollback automatique complet).
- Annulation : restitution exacte, entrepôt par entrepôt.

**Effets en cascade automatiques (event bus) au changement de statut** :
- `→ DELIVERED` : crédite les points fidélité ; complète automatiquement tout paiement COD encore `PENDING` sur la commande.
- `→ CANCELLED` : restitue le stock réservé ; annule les collectes (`PickupRequest`) `PENDING` liées à cette commande.
- `→ SHIPPED`/`DELIVERED` peuvent aussi être déclenchés automatiquement par un changement de statut d'expédition liée (best-effort, voir §15).

---

## 11. Paiements (`/payment-methods`, `/payments`)

| Méthode | Route                            | Auth     | Notes                                                                                                                                                                        |
| ------- | --------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/payment-methods`                | ❌       | Seul `CASH_ON_DELIVERY` a `available: true`                                                                                                                                  |
| POST    | `/payments`                       | ✅       | `order_id, method, currency?(XAF défaut), notes?` — **503** si méthode indisponible, **403** si commande d'un autre utilisateur. Passe la commande en `CONFIRMED`.          |
| GET     | `/payments/:payment_id`           | ✅       | —                                                                                                                                                                            |
| GET     | `/orders/:orderId/payments`       | ✅       | → `Payment[]`                                                                                                                                                                |
| GET     | `/payments`                       | 🔒 ADMIN | Query `page?, limit?, status?, method?, order_id?`                                                                                                                          |
| PUT     | `/payments/:payment_id/status`    | 🔒 ADMIN | `status(PENDING\|COMPLETED\|FAILED\|REFUNDED\|CANCELLED), notes?` — transitions validées via state machine                                                                |
| PUT     | `/payments/:payment_id/complete`  | 🔒 ADMIN | ⚠️ Déprécié — alias de `PUT .../status { status: "COMPLETED" }`                                                                                                             |

**Effets en cascade automatiques** :
- Une commande livrée (`DELIVERED`) avec un paiement COD encore `PENDING` → paiement auto-complété.
- Un retour complété (`ReturnRequest.status = COMPLETED`) → tout paiement `COMPLETED` de la commande est automatiquement remboursé (`REFUNDED`).

---

## 12. Avis (`/products/:pid/reviews`, `/reviews`)

| Méthode | Route                    | Auth       | Body                                                           |
| ------- | ------------------------ | ---------- | ---------------------------------------------------------------- |
| GET     | `/products/:pid/reviews` | ❌         | → `{ product_id, average_rating, total_reviews, reviews[] }` |
| GET     | `/reviews/:rid`          | ❌         | —                                                              |
| POST    | `/reviews`               | ✅         | `order_item_id, product_id, rating(1-5), comment?`             |
| PUT     | `/reviews/:rid`          | ✅ (owner) | `rating?, comment?`                                            |
| DELETE  | `/reviews/:rid`          | ✅ (owner) | —                                                              |

---

## 13. Entrepôts (`/warehouses`)

| Méthode | Route                                 | Auth     | Body                                          |
| ------- | -------------------------------------- | -------- | ------------------------------------------------ |
| GET     | `/warehouses`                         | ✅       | — (cache)                                       |
| GET     | `/warehouses/:warehouse_id`           | ✅       | — (cache)                                       |
| GET     | `/warehouses/:warehouse_id/inventory` | ✅       | → `{ warehouse: {...totalUnits}, items[] }`    |
| POST    | `/warehouses`                         | 🔒 ADMIN | `name(2-100), location, capacity?`              |
| PUT     | `/warehouses/:warehouse_id`           | 🔒 ADMIN | body partiel                                    |
| DELETE  | `/warehouses/:warehouse_id`           | 🔒 ADMIN | **400** si du stock (`quantity > 0`) existe encore dans cet entrepôt — supprimer/transférer le stock d'abord |

---

## 14. Inventaire (`/inventory`)

| Méthode | Route                     | Auth     | Notes                                                                                                         |
| ------- | ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| GET     | `/inventory`              | ✅       | Query `page?, limit?, category?, location?` → objet paginé                                                    |
| GET     | `/inventory/low-stock`    | ✅       | Query `threshold?(défaut 10)` → `0 < quantity <= threshold`                                                   |
| GET     | `/inventory/out-of-stock` | ✅       | `quantity === 0`                                                                                              |
| GET     | `/inventory/search`       | ✅       | Query `keyword` **requis**, sinon erreur 500 (non gérée en `AppError`)                                        |
| GET     | `/inventory/:item_id`     | ✅       | —                                                                                                             |
| POST    | `/inventory`              | 🔒 ADMIN | `product_id, warehouse_id, combination_id?, quantity?(défaut 0)` — 409 si doublon `(product, warehouse, combination)` |
| PUT     | `/inventory/:item_id`     | 🔒 ADMIN | `quantity?, warehouse_id?`                                                                                    |
| DELETE  | `/inventory/:item_id`     | 🔒 ADMIN | —                                                                                                             |
| POST    | `/inventory/transfer`     | 🔒 ADMIN | `item_id, from_warehouse, to_warehouse, quantity` — 400 si stock source insuffisant                           |

Toute mutation de quantité (ajustement manuel, transfert, réservation de commande, restitution) déclenche désormais les alertes `LOW_STOCK`/`OUT_OF_STOCK` de façon centralisée (event bus), et non plus seulement via `PUT /inventory/:item_id` comme auparavant.

---

## 15. Expéditions (`/shipments`, `/pickup-requests`, `/labels`)

| Méthode | Route                                | Auth       | Notes                                                                                                                                                |
| ------- | ------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST    | `/shipments/cost`                    | ❌         | `origin, destination, weight, dimensions?` → `cost = 5 + weight*0.1` XAF                                                                            |
| POST    | `/shipments`                         | 🔒 ADMIN   | —                                                                                                                                                    |
| GET     | `/shipments/:shipmentId`             | ✅         | —                                                                                                                                                    |
| GET     | `/shipments`                         | 🔒 ADMIN   | Query `page?, limit?, status?, order_id?`                                                                                                            |
| POST    | `/shipments/:shipmentId/track`       | ✅         | `{ status, location?, shipment_status? }` — `status` est un texte libre pour l'historique ; `shipment_status` (optionnel) met aussi à jour le statut officiel |
| GET     | `/shipments/:shipmentId/track`       | ✅         | —                                                                                                                                                    |
| PUT     | `/shipments/:shipmentId/status`      | 🔒 ADMIN   | `{ status, reason? }` — bloque les transitions depuis un statut terminal (`CANCELLED`, `DELIVERED`)                                                  |
| POST    | `/shipments/:shipmentId/cancel`      | ✅         | 400 si déjà annulée                                                                                                                                   |
| GET     | `/labels/:shipmentId`                | ✅         | Crée l'étiquette si absente                                                                                                                          |
| POST    | `/pickup-requests`                   | ✅         | `pickup_date(ISO), pickup_address, order_id?, shipment_id?`                                                                                          |
| GET     | `/pickup-requests`                   | 🔒 ADMIN   | Query `page?, limit?, status?`                                                                                                                       |
| GET     | `/pickup-requests/:requestId`        | ✅         | —                                                                                                                                                    |
| POST    | `/pickup-requests/:requestId/cancel` | ✅ (owner) | 403 si pas propriétaire, 400 si déjà annulée                                                                                                         |
| GET     | `/orders/:orderId/shipment`          | ✅ (owner ou admin) | Expédition la plus récente liée à la commande, ou `null`                                                                                    |

**Synchronisation `Shipment → Order`** (best-effort) : `IN_TRANSIT → Order.SHIPPED`, `DELIVERED → Order.DELIVERED`. Toute annulation d'expédition (`CANCELLED`) annule aussi les collectes `PENDING` liées.

---

## 16. Méthodes de livraison (`/shipping-methods`)

| Méthode | Route                         | Auth     | Body                                                                                            |
| ------- | ----------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| GET     | `/shipping-methods`           | ❌       | Query `active?(bool)`                                                                           |
| GET     | `/shipping-methods/:methodId` | ❌       | —                                                                                                |
| POST    | `/shipping-methods`           | 🔒 ADMIN | `name, description?, estimatedDays, basePrice, pricePerKg?, isActive?, zones: string[2-letter]` |
| PATCH   | `/shipping-methods/:methodId` | 🔒 ADMIN | body partiel                                                                                    |
| DELETE  | `/shipping-methods/:methodId` | 🔒 ADMIN | —                                                                                                |
| POST    | `/shipping-methods/calculate` | ❌       | `shippingMethodId, weight` → `cost = basePrice + pricePerKg*weight`                             |

---

## 17. Adresses (`/address`, `/addresses`)

| Méthode | Route                   | Auth       | Body                                                                                                                                  |
| ------- | ----------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| POST    | `/address/validate`     | ❌         | `street, city, state?, country, postal_code` → `{ valid, normalized_address }`                                                          |
| GET     | `/addresses`            | ✅         | —                                                                                                                                        |
| GET     | `/addresses/:addressId` | ✅ (owner) | 403 sinon                                                                                                                                |
| POST    | `/addresses`            | ✅         | `street, city, state?, country, postalCode, isDefault?` — désactive les autres si `isDefault: true`                                     |
| PATCH   | `/addresses/:addressId` | ✅ (owner) | body partiel                                                                                                                             |
| DELETE  | `/addresses/:addressId` | ✅ (owner) | —                                                                                                                                        |

---

## 18. Promotions, remises & coupons

| Méthode | Route                                            | Auth     | Body                                                                                             |
| ------- | ------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| GET     | `/promotions/slug/:slug`                         | ❌       | Page publique promo (avec `discounts`, `coupons`)                                                |
| GET     | `/promotions/slug/:slug/products`                | ❌       | **Nouveau** — produits affectés par la promotion (fusion produits ciblés directs + produits des catégories ciblées, dédoublonnés, `ACTIVE` uniquement). Voir note ci-dessous. |
| GET     | `/promotions/active`                             | ❌       | Promotions actuellement `ACTIVE` (statut calculé), triées par `endDate` croissante              |
| POST    | `/coupons/validate`                              | ✅       | `code, basketId?, items?` — vérifie activité, dates, plafond global et par-utilisateur. Si `items` fourni, renvoie un `preview` du total estimé. |
| GET     | `/promotions`                                    | 🔒 ADMIN | Query `status?, isActive?` — `status` filtre sur le **statut calculé** (voir ci-dessous)          |
| GET     | `/promotions/:promotionId`                       | 🔒 ADMIN | —                                                                                                  |
| GET     | `/promotions/:promotionId/products`              | 🔒 ADMIN | **Nouveau** — équivalent admin de la route publique par slug ci-dessus                            |
| POST    | `/promotions`                                    | 🔒 ADMIN | `name, slug, description?, startDate(ISO), endDate(ISO > startDate), isActive?`                  |
| PUT     | `/promotions/:promotionId`                       | 🔒 ADMIN | body partiel                                                                                       |
| PATCH   | `/promotions/:promotionId/toggle`                | 🔒 ADMIN | bascule `isActive`                                                                                 |
| DELETE  | `/promotions/:promotionId`                       | 🔒 ADMIN | —                                                                                                  |
| POST    | `/promotions/:promotionId/images`                | 🔒 ADMIN | multipart, champ `images` (1-5) — **l'API uploade elle-même vers R2**, `Promotion.images` est un tableau d'URLs (une promotion peut avoir plusieurs visuels) |
| DELETE  | `/promotions/:promotionId/images`                | 🔒 ADMIN | body `{ imageUrl }`                                                                                |
| POST    | `/promotions/:promotionId/discounts`             | 🔒 ADMIN | `type(PERCENTAGE\|FIXED_AMOUNT), value, categoryId?, productIds?` — au moins un ciblage requis   |
| DELETE  | `/promotions/:promotionId/discounts/:discountId` | 🔒 ADMIN | —                                                                                                  |
| GET     | `/promotions/:promotionId/coupons`               | 🔒 ADMIN | → chaque coupon inclut `effectiveIsActive` (calculé, voir ci-dessous)                             |
| POST    | `/promotions/:promotionId/coupons`               | 🔒 ADMIN | `code(3-50, auto-uppercase), maxUses?, perUserLimit?(défaut 1), startDate?, endDate?, isActive?` |
| DELETE  | `/promotions/:promotionId/coupons/:couponId`     | 🔒 ADMIN | —                                                                                                  |

⚠️ **Nouveau — `Promotion.status` calculé à la lecture** (auparavant figé à la création, jamais réévalué) : `status` retourné par l'API (`SCHEDULED`/`ACTIVE`/`EXPIRED`/`CANCELLED`) est désormais dérivé dynamiquement de `isActive` + `startDate`/`endDate` à chaque requête, pas du champ stocké en base. Un `status: "CANCELLED"` posé manuellement reste respecté ; sinon, `SCHEDULED` avant `startDate`, `EXPIRED` après `endDate`, `ACTIVE` entre les deux. Le filtre `?status=` dans `GET /promotions` s'applique sur ce statut calculé.

⚠️ **Nouveau — `effectiveIsActive` sur les coupons** (`GET /promotions/:promotionId/coupons`) : champ calculé (`isActive` stocké + dates + `usedCount >= maxUses`) reflétant si le coupon est réellement utilisable maintenant, sans jamais modifier `isActive` en base.

⚠️ **Nouveau — produits affectés par une promotion (`GET .../products`)** : réponse `{ promotionId, promotionName, count, products[] }`, chaque `product` incluant `pricing` (identique à `GET /product`). Cas particuliers :
- `count === 0` → **la promotion n'a aucun `Discount` ciblant un produit ou une catégorie** (typiquement une promotion portée uniquement par un coupon, sans remise sur article — voir note ci-dessous). Il n'y a alors rien à afficher/rediriger côté storefront.
- `count === 1` → redirection directe possible vers la fiche produit.
- `count > 1` → page listing.

⚠️ **Important — un coupon sans `Discount` associé n'a aucun effet monétaire** : la réduction appliquée à une commande provient exclusivement des `Discount` de la promotion (via `getBestPricing`, calculé par article du panier/de la commande) — **jamais** d'une valeur portée par le `CouponCode` lui-même (qui n'a ni `value` ni `type` de remise dans le schéma actuel, uniquement des règles d'usage : `maxUses`, `perUserLimit`, `minOrderAmount`, dates). Un coupon appliqué à une commande sans aucun `Discount` sur sa promotion sera bien enregistré (`Order.appliedCoupon`), mais `discountedAmount` restera nul — aucun prix d'article n'est réduit. Le scénario "coupon = réduction fixe/pourcentage sur le total, indépendamment des produits" n'est **pas implémenté** dans l'état actuel du code.

Le prix affiché sur `GET /product` / `GET /product/:id` inclut un objet `pricing` (`{ originalPrice, finalPrice, discountAmount, discountPercentage, hasDiscount, promotionId, discountId }`) calculé à partir des remises actives.

---

## 19. Programme fidélité (`/loyalty`)

| Méthode | Route                      | Auth     | Notes                                                                                                                                                                                                                                               |
| ------- | -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/loyalty/:userId/balance` | ✅       | ⚠️ Aucun contrôle d'appartenance : tout utilisateur authentifié peut consulter le solde de n'importe quel `userId`                                                                                                                                  |
| GET     | `/loyalty/:userId/history` | ✅       | Même remarque                                                                                                                                                                                                                                        |
| POST    | `/loyalty/adjust`          | 🔒 ADMIN | `userId, points(≠0), type(EARNED\|REDEEMED\|EXPIRED\|ADJUSTED), orderId?` — rejette un `REDEEMED` si le solde résultant serait négatif                                                                                                             |

1 point crédité automatiquement par tranche de 100 XAF lorsqu'une commande passe à `DELIVERED`. Un retour complété (`COMPLETED`) reverse automatiquement les points gagnés sur la commande concernée (transaction `ADJUSTED` négative, idempotente).

---

## 20. Retours (`/returns`)

| Méthode | Route                       | Auth                | Body                                                                                                                                                                                                  |
| ------- | --------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/returns`                  | 🔒 ADMIN            | Query `page?, limit?, status?`                                                                                                                                                                        |
| GET     | `/returns/:returnId`        | ✅ (owner ou admin) | —                                                                                                                                                                                                     |
| POST    | `/returns`                  | ✅                  | `order_id, reason(min2), notes?, items: [{order_item_id, quantity, condition?}] (min1)` — requiert `Order.status = DELIVERED`                                                                        |
| PUT     | `/returns/:returnId/status` | 🔒 ADMIN            | `status(PENDING\|APPROVED\|REJECTED\|COMPLETED), notes?` — 400 si déjà `COMPLETED`                                                                                                                    |
| GET     | `/orders/:orderId/returns`  | ✅ (owner ou admin) | —                                                                                                                                                                                                     |

Un passage à `COMPLETED` déclenche automatiquement : `Order.status → REFUNDED`, remboursement des paiements `COMPLETED` liés, réintégration du stock (via `OrderItemReservation`), reversal des points fidélité gagnés sur la commande.

---

## 21. Dashboard (`/dashboard`) 🔒 ADMIN

| Méthode | Route                    | Query                     |
| ------- | ------------------------ | -------------------------- |
| GET     | `/dashboard/stats`       | —                          |
| GET     | `/dashboard/sales-chart` | `year?, period?(monthly)` |

---

## 22. Sécurité des comptes — verrouillage automatique

Non exposé via une route dédiée, mais affecte directement `POST /login` et `PATCH /user/:userId/status` :

- **5 échecs de mot de passe consécutifs** pour un même `username`, sur une **fenêtre glissante de 15 minutes**, déclenchent la désactivation automatique du compte (`isActive: false`).
- Le compteur d'échecs (Redis, clé `login_attempts:{username}`) est réinitialisé **explicitement après un login réussi**, et sinon **expire naturellement** après 15 minutes d'inactivité.
- Un compte ainsi verrouillé reçoit le même message d'erreur (`403 "This account has been deactivated."`) qu'une désactivation manuelle par un admin — aucune distinction n'est exposée côté client.
- Seule route de déverrouillage : `PATCH /user/:userId/status { isActive: true }` (admin).

---

## Codes d'erreur HTTP

| Code | Signification                                                                           |
| ---- | ---------------------------------------------------------------------------------------- |
| 400  | Validation échouée / requête invalide / auto-suppression tentée                        |
| 401  | Token manquant ou invalide                                                                |
| 403  | Rôle insuffisant, ressource d'un autre utilisateur, ou compte désactivé/verrouillé        |
| 404  | Ressource introuvable (inclut les catégories/produits filtrés par `isActive`)             |
| 409  | Conflit (doublon)                                                                         |
| 429  | Rate limit dépassé (100 req / 15 min)                                                    |
| 500  | Erreur interne serveur                                                                    |
| 503  | Fonctionnalité temporairement indisponible (moyens de paiement non branchés)              |