# Guide d'intégration API — ecommerce-api

> Destiné à l'équipe frontend. Décrit l'authentification, le format des réponses, tous les endpoints disponibles et les flux métier à connaître avant intégration.

---

## 1. Environnements

| Environnement | Base URL (exemple) | Notes |
|---|---|---|
| Développement | `http://localhost:3000` | Port configurable via `PORT` |
| Production | `https://<votre-domaine>` | Derrière Nginx |

Toutes les routes ci-dessous sont **relatives à la base URL** (pas de préfixe `/api` — les routes sont montées à la racine).

---

## 2. Authentification

### 2.1 Inscription / Connexion

| Méthode | Route | Body |
|---|---|---|
| POST | `/signup` | `{ username, email, password, firstName, lastName, dateOfBirth?, phone? }` |
| POST | `/login` | `{ username, password }` |

Les deux retournent :
```json
{
  "status": true,
  "data": {
    "user": { "id": 1, "username": "...", "email": "...", "role": "USER", ... },
    "token": "eyJhbGciOi..."
  }
}
```

### 2.2 Utilisation du token

Toutes les routes protégées attendent :
```
Authorization: Bearer <token>
```

- Le token expire après `JWT_EXPIRES_IN` secondes (config serveur, 3600s par défaut).
- Il n'y a **pas de refresh token** actuellement — à l'expiration, l'utilisateur doit se reconnecter (401 `Invalid or expired token.`).

### 2.3 Rôles

`USER` (client), `ADMIN`, `MANAGER`, `SUPPORT`.

⚠️ **Important** : les routes marquées « Admin » dans ce document exigent strictement `role === "ADMIN"`. Les rôles `MANAGER` et `SUPPORT` existent dans le schéma mais **ne passent pas** ces contrôles actuellement (403 `Forbidden`) — ne pas construire d'UI différenciée pour ces rôles en attendant une évolution du backend.

### 2.4 Verrouillage de compte

Après 5 échecs de connexion consécutifs sur 15 minutes, le compte est automatiquement désactivé (`isActive: false`). Le message d'erreur reste générique (`Provided username and password did not match.`) — le frontend ne peut pas distinguer un mauvais mot de passe d'un compte verrouillé avant la tentative suivante, qui renverra alors `This account has been deactivated.` (403).

---

## 3. Format des réponses

### Succès
```json
{ "status": true, "data": { ... } }
```
Code HTTP 200 (ou 201 pour une création).

### Erreur
```json
{ "status": false, "error": { "message": "...", "details"?: { ... } } }
```
`details` n'est présent que pour les erreurs de validation (400, via Zod) et contient la sortie `flatten()` de Zod (`fieldErrors`, `formErrors`).

### Codes HTTP utilisés
- `200` / `201` : succès
- `400` : validation ou règle métier invalide
- `401` : non authentifié / token invalide ou expiré
- `403` : authentifié mais accès refusé (rôle, propriétaire de ressource)
- `404` : ressource introuvable
- `409` : conflit (doublon — email, username, slug, code coupon...)
- `429` : rate limit dépassé (100 requêtes / 15 min / IP)
- `503` : méthode de paiement non disponible
- `500` : erreur serveur

---

## 4. Pagination

Les endpoints de listing acceptent `?page=1&limit=20` (défauts : page 1, limit 20) et renvoient :
```json
{
  "status": true,
  "data": {
    "items": [...],
    "total": 143,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

## 5. Conventions générales

- **Devise** : XAF partout (montants en nombres, pas de sous-unités).
- **Dates** : ISO 8601 (`z.string().datetime()` côté validation des inputs).
- **IDs** : `Product` utilise un ID numérique auto-incrémenté (`Int`). Toutes les autres entités utilisent des `cuid()` (string).
- **Soft delete** : uniquement sur `User` (`deletedAt`). Les produits sont supprimés définitivement (hard delete) — un produit supprimé disparaît des commandes historiques (le nom/SKU restent en snapshot sur `OrderItem.productName` / `productSku`).

---

## 6. Modules & endpoints

### 6.1 Utilisateurs (`/user`)

| Méthode | Route | Auth | Body |
|---|---|---|---|
| GET | `/user` | User | — (profil courant) |
| PATCH | `/user` | User | `{ email?, firstName?, lastName?, dateOfBirth?, phone? }` |
| GET | `/user/all` | Admin | — |
| GET | `/user/:userId` | Admin | — |
| PATCH | `/user/change-role/:userId` | Admin | `{ role }` |
| POST | `/user` | Admin | `{ username, email, password, firstName, lastName, role, ... }` (création admin) |
| PATCH | `/user/:userId/status` | Admin | `{ isActive }` (suspension / réactivation) |
| DELETE | `/user/:userId` | Admin | — (soft delete, un admin ne peut pas se supprimer lui-même) |

### 6.2 Produits (`/product`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/product` | Public (auth optionnelle) | `?page&limit&categoryId&search`. En admin, ajouter `?includeInactive=true` pour voir DRAFT/ARCHIVED |
| GET | `/product/:productId` | Public | Détail produit (avec `pricing` calculé, voir §7.3) |
| POST | `/product` | Admin | `{ sku, name, description?, price, categoryId, weight, status? }` — naît toujours en `DRAFT` |
| PATCH | `/product/:productId` | Admin | Champs partiels |
| DELETE | `/product/:productId` | Admin | Hard delete |
| POST | `/product/:productId/images` | Admin | multipart, champ `images` (jusqu'à 5), body `combinationId?` |
| DELETE | `/product/:productId/images` | Admin | body `{ imageId }` |

⚠️ Passer un produit en `ACTIVE` échoue (400) si des attributs `isRequired: true` de sa catégorie ne sont pas renseignés.

### 6.3 Combinaisons / variantes (`/product/:productId/combinations`)

Un produit peut avoir des **attributs de variante** (ex : couleur, taille) qui génèrent des **combinaisons** achetables individuellement (chacune avec son propre stock, prix optionnel, images).

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | User | Liste des combinaisons du produit |
| GET | `/selections` | User | Sélections d'options faites pour chaque attribut de variante |
| PUT | `/selections/:attributeDefinitionId` | Admin | `{ optionIds: string[] }` — définit les options disponibles pour cet attribut |
| POST | `/generate` | Admin | Génère le produit cartésien des sélections en combinaisons (idempotent, désactive celles obsolètes) |
| GET | `/:combinationId` | User | Détail |
| PATCH | `/:combinationId` | Admin | `{ sku?, price?, isActive? }` |
| DELETE | `/:combinationId` | Admin | Refusée si stock > 0 |

⚠️ **Si `product.combinations.length > 0`**, le frontend **doit** faire sélectionner une combinaison au client avant tout ajout au panier ou commande (`combination_id` requis) — sinon 400.

### 6.4 Attributs (`/categories/:categoryId/attributes`, `/attributes`, `/product/:productId/attributes`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/categories/:categoryId/attributes` | User | Définitions d'attributs de la catégorie |
| POST | `/categories/:categoryId/attributes` | Admin | `{ name, slug, type, unit?, isVariant, isFilterable, isRequired, position }` |
| GET | `/attributes/:definitionId` | User | — |
| PATCH | `/attributes/:definitionId` | Admin | — |
| DELETE | `/attributes/:definitionId` | Admin | — |
| POST | `/attributes/:definitionId/options` | Admin | `{ value, colorHex?, position }` |
| PATCH | `/attributes/options/:optionId` | Admin | — |
| DELETE | `/attributes/options/:optionId` | Admin | — |
| PUT | `/product/:productId/attributes` | Admin | `{ attributes: [{attributeDefinitionId, value}] }` — **uniquement pour attributs non-variante** (`isVariant: false`) |

`type` : `TEXT | NUMBER | COLOR | BOOLEAN | SELECT`.

### 6.5 Catégories (`/categories`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/categories` | Public | `?includeInactive=true` réservé admin |
| GET | `/categories/:categoryId` | Public | — |
| GET | `/categories/slug/:slug` | Public | — |
| GET | `/categories/slug/:slug/products` | Public | Produits de la catégorie + descendantes, paginé |
| POST | `/categories` | Admin | `{ name, slug, description?, imageUrl?, iconUrl?, metaTitle?, metaDescription?, isActive?, parentId? }` |
| PUT | `/categories/:categoryId` | Admin | — |
| DELETE | `/categories/:categoryId` | Admin | Refusée si produits ou discounts encore rattachés |
| POST | `/categories/:categoryId/assets` | Admin | multipart, champs `image`, `icon` (upload direct, l'API gère R2) |
| DELETE | `/categories/:categoryId/image` | Admin | — |
| DELETE | `/categories/:categoryId/icon` | Admin | — |

### 6.6 Tags (`/tags`, `/product/:productId/tags`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/tags` | Public | — |
| GET | `/tags/:tagId` | Public | — |
| POST | `/tags` | Admin | `{ name, slug }` |
| PATCH | `/tags/:tagId` | Admin | — |
| DELETE | `/tags/:tagId` | Admin | — |
| PUT | `/product/:productId/tags` | Admin | `{ tagIds: string[] }` (remplace la liste complète) |
| GET | `/product/:productId/tags` | User | — |

### 6.7 Panier (`/basket`, `/user/basket`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/user/basket` | User | Récupère (ou crée) le panier unique de l'utilisateur — **route recommandée** |
| POST | `/basket` | User | Équivalent get-or-create, conservée pour compat |
| GET | `/basket/:basket_id` | User | — |
| POST | `/basket/:basket_id/product` | User | `{ product_id, combination_id?, quantity }` |
| PUT | `/basket/:basket_id/product/quantity` | User | `{ product_id, combination_id?, quantity }` |
| DELETE | `/basket/:basket_id/product` | User | `{ product_id, combination_id? }` |

Le stock n'est **jamais réservé au niveau du panier** — seulement vérifié (disponibilité). La réservation réelle se fait à la création de la commande.

### 6.8 Liste de souhaits (`/wishlist`)

| Méthode | Route | Auth | Body |
|---|---|---|---|
| GET | `/wishlist` | User | — |
| POST | `/wishlist/items` | User | `{ product_id, combination_id? }` |
| DELETE | `/wishlist/items` | User | `{ product_id, combination_id? }` |

### 6.9 Adresses (`/addresses`, `/address/validate`)

| Méthode | Route | Auth | Body |
|---|---|---|---|
| POST | `/address/validate` | Public | `{ street, city, state?, country, postal_code }` — validation formelle uniquement, ne persiste rien |
| GET | `/addresses` | User | — |
| GET | `/addresses/:addressId` | User | — |
| POST | `/addresses` | User | `{ street, city, state?, country, postalCode, isDefault? }` |
| PATCH | `/addresses/:addressId` | User | Champs partiels |
| DELETE | `/addresses/:addressId` | User | — |

### 6.10 Commandes (`/orders`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/orders` | User | Ses propres commandes (admin voit tout via `?customer=email`) |
| POST | `/orders` | User | Voir §7.1 |
| GET | `/orders/:orderId` | User | Doit être propriétaire (sauf admin) |
| PUT | `/orders/:orderId` | User | Modifie adresse/notes/méthode de livraison **avant expédition** |
| DELETE | `/orders/:orderId` | User | Annule la commande (transition `CANCELLED`, libère le stock) |
| PUT | `/orders/:orderId/status` | Admin | `{ status, reason?, shippingCarrier?, trackingNumber?, estimatedDeliveryDate? }` |
| GET | `/user/:userId/orders` | Admin | Commandes d'un utilisateur donné |

**Body `POST /orders`** :
```json
{
  "items": [{ "id": "productId", "combinationId": "...", "quantity": 2 }],
  "basketId": "...",
  "shippingAddressId": "...",
  "shippingAddress": { "street": "...", "city": "...", "country": "...", "postalCode": "..." },
  "billingAddressId": "...",
  "billingAddress": { ... },
  "shippingMethodId": "...",
  "paymentMethodId": "...",
  "notes": "...",
  "couponCode": "PROMO10"
}
```
`items` OU `basketId` requis (pas les deux nécessairement, mais au moins un). `shippingAddress` est toujours requis (snapshot conservé même si `shippingAddressId` fourni).

### 6.11 Paiements (`/payments`, `/payment-methods`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/payment-methods` | Public | Liste des méthodes et leur disponibilité |
| POST | `/payments` | User | `{ order_id, method, currency?, notes? }` |
| GET | `/payments/:payment_id` | User | — |
| PUT | `/payments/:payment_id/status` | Admin | `{ status, notes? }` — **restreint à `REFUNDED`** manuellement, le reste est automatique (voir §7.2) |
| PUT | `/payments/:payment_id/complete` | Admin | Déprécié, alias de `status: COMPLETED` |
| GET | `/orders/:orderId/payments` | User | — |
| GET | `/payments` | Admin | `?page&limit&status&method&order_id` |

Seule `CASH_ON_DELIVERY` est actuellement disponible (`PAYPAL`, `STRIPE`, `CINETPAY` renvoient 503 « Coming soon »).

### 6.12 Avis (`/reviews`, `/products/:pid/reviews`)

| Méthode | Route | Auth | Body |
|---|---|---|---|
| GET | `/products/:pid/reviews` | Public | Retourne aussi `average_rating`, `total_reviews` |
| GET | `/reviews/:rid` | Public | — |
| POST | `/reviews` | User | `{ order_item_id, product_id, rating (1-5), comment? }` — un seul avis par (orderItem, user) |
| PUT | `/reviews/:rid` | User | Doit être l'auteur |
| DELETE | `/reviews/:rid` | User | Doit être l'auteur |

### 6.13 Entrepôts (`/warehouses`)

| Méthode | Route | Auth | Body |
|---|---|---|---|
| GET | `/warehouses` | User | — |
| GET | `/warehouses/:warehouse_id` | User | — |
| GET | `/warehouses/:warehouse_id/inventory` | User | — |
| POST | `/warehouses` | Admin | `{ name, location, capacity? }` |
| PUT | `/warehouses/:warehouse_id` | Admin | — |
| DELETE | `/warehouses/:warehouse_id` | Admin | Refusée si stock encore présent |

### 6.14 Inventaire / Stock (`/inventory`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/inventory` | Admin | `?category&location&warehouse_id&page&limit` |
| GET | `/inventory/search` | Admin | `?keyword=` (requis) |
| GET | `/inventory/grouped` | Admin | Vue groupée par produit — `?low_stock=true` / `?out_of_stock=true` |
| GET | `/inventory/grouped/:productId` | Admin | Détail par combinaison × entrepôt |
| GET | `/inventory/:item_id` | Admin | — |
| POST | `/inventory` | Admin | `{ product_id, warehouse_id, combination_id?, quantity }` |
| PUT | `/inventory/:item_id` | Admin | `{ quantity?, warehouse_id? }` |
| DELETE | `/inventory/:item_id` | Admin | — |
| POST | `/inventory/transfer` | Admin | `{ item_id, from_warehouse, to_warehouse, quantity }` |

Seuil stock faible : 10 unités.

### 6.15 Expéditions & retraits (`/shipments`, `/pickup-requests`, `/labels`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/shipments/cost` | Public | `{ origin, destination, weight, dimensions? }` |
| POST | `/shipments` | Admin | Commande doit être `PROCESSING` |
| GET | `/shipments/:shipmentId` | User | — |
| GET | `/shipments` | Admin | `?page&limit&status&order_id` |
| POST | `/shipments/:shipmentId/track` | User | `{ status, location?, shipment_status? }` — `status` est un texte libre, `shipment_status` (optionnel) met à jour le statut officiel |
| GET | `/shipments/:shipmentId/track` | User | Historique de suivi |
| PUT | `/shipments/:shipmentId/status` | Admin | `{ status, reason? }` |
| POST | `/shipments/:shipmentId/cancel` | User | — |
| GET | `/labels/:shipmentId` | User | Génère/récupère l'étiquette |
| POST | `/pickup-requests` | User | `{ pickup_date, pickup_address, order_id?, shipment_id? }` |
| GET | `/pickup-requests` | Admin | — |
| GET | `/pickup-requests/:requestId` | User | — |
| POST | `/pickup-requests/:requestId/cancel` | User | Doit être le demandeur |
| GET | `/orders/:orderId/shipment` | User | — |

Passer `shipment.status` à `IN_TRANSIT` ou `DELIVERED` synchronise automatiquement `Order.status` (`SHIPPED` / `DELIVERED`).

### 6.16 Méthodes de livraison (`/shipping-methods`)

| Méthode | Route | Auth | Body |
|---|---|---|---|
| GET | `/shipping-methods` | Public | `?active=true` |
| GET | `/shipping-methods/:methodId` | Public | — |
| POST | `/shipping-methods` | Admin | `{ name, description?, estimatedDays, basePrice, pricePerKg, isActive, zones: string[2] }` |
| PATCH | `/shipping-methods/:methodId` | Admin | — |
| DELETE | `/shipping-methods/:methodId` | Admin | — |
| POST | `/shipping-methods/calculate` | Public | `{ shippingMethodId, weight }` |

### 6.17 Promotions, remises & coupons (`/promotions`, `/coupons`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/promotions` | Admin | `?status&isActive&page&limit` |
| GET | `/promotions/active` | Public | Promotions actuellement actives, triées par date de fin |
| GET | `/promotions/slug/:slug` | Public | — |
| GET | `/promotions/slug/:slug/products` | Public | Produits affectés + `pricing` calculé |
| GET | `/promotions/:promotionId` | Admin | — |
| GET | `/promotions/:promotionId/products` | Admin | — |
| POST | `/promotions` | Admin | `{ name, slug, description?, startDate, endDate, isActive }` |
| PUT | `/promotions/:promotionId` | Admin | — |
| PATCH | `/promotions/:promotionId/toggle` | Admin | Bascule `isActive` |
| DELETE | `/promotions/:promotionId` | Admin | — |
| POST | `/promotions/:promotionId/images` | Admin | multipart `images` (5 max) |
| DELETE | `/promotions/:promotionId/images` | Admin | body `{ imageUrl }` |
| POST | `/promotions/:promotionId/discounts` | Admin | `{ type: PERCENTAGE|FIXED_AMOUNT, value, categoryId?, productIds? }` (au moins un ciblage requis) |
| DELETE | `/promotions/:promotionId/discounts/:discountId` | Admin | — |
| GET | `/promotions/:promotionId/coupons` | Admin | — |
| POST | `/promotions/:promotionId/coupons` | Admin | `{ code, maxUses?, perUserLimit, startDate?, endDate?, isActive }` |
| DELETE | `/promotions/:promotionId/coupons/:couponId` | Admin | — |
| POST | `/coupons/validate` | User | `{ code, basketId?, items? }` — retourne un `preview` du montant si `items` fourni |

Le `status` d'une promotion (`SCHEDULED / ACTIVE / EXPIRED / CANCELLED`) est **recalculé dynamiquement** à chaque lecture à partir des dates — ne pas se fier à un statut mis en cache côté frontend au-delà de quelques minutes.

⚠️ **Point d'attention connu** : après expiration d'une promotion (`endDate` dépassée), le prix remisé peut rester visible sur `/product` jusqu'à 5 minutes (TTL du cache Redis des produits). `/promotions/active` reflète en revanche l'état réel immédiatement. Ne pas construire de logique de countdown critique sur le prix produit.

### 6.18 Fidélité (`/loyalty`)

| Méthode | Route | Auth | Body |
|---|---|---|---|
| GET | `/loyalty/:userId/balance` | User | — |
| GET | `/loyalty/:userId/history` | User | — |
| POST | `/loyalty/adjust` | Admin | `{ userId, points, type: EARNED|REDEEMED|EXPIRED|ADJUSTED, orderId? }` |

Barème : 1 point par 100 XAF dépensés, crédité automatiquement à `Order.status → DELIVERED`. Reversal automatique si un retour lié à la commande est complété.

### 6.19 Retours (`/returns`)

| Méthode | Route | Auth | Body |
|---|---|---|---|
| GET | `/returns` | Admin | `?status&page&limit` |
| GET | `/returns/:returnId` | User | Doit être propriétaire (sauf admin) |
| POST | `/returns` | User | `{ order_id, reason, notes?, items: [{ order_item_id, quantity, condition? }] }` — commande doit être `DELIVERED` |
| PUT | `/returns/:returnId/status` | Admin | `{ status: APPROVED|REJECTED|COMPLETED, notes? }` |
| GET | `/orders/:orderId/returns` | User | — |

Quand un retour passe à `COMPLETED` : `Order.status → REFUNDED`, remboursement automatique des paiements complétés, réintégration du stock, reversal des points de fidélité gagnés sur cette commande.

### 6.20 Tableau de bord (`/dashboard`)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/dashboard/stats` | Admin | KPIs globaux (produits, commandes, paiements, stock faible, expéditions, promotions) |
| GET | `/dashboard/sales-chart` | Admin | `?year&period` — série mensuelle de CA/commandes |

---

## 7. Flux métier à connaître

### 7.1 Cycle de vie d'une commande

```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED → REFUNDED
   ↓           ↓            ↓
CANCELLED  CANCELLED   CANCELLED
```
- Transitions strictement contrôlées côté serveur (400 si invalide).
- `PENDING → CONFIRMED` se déclenche automatiquement à l'enregistrement d'un paiement COD.
- `DELIVERED → REFUNDED` uniquement via un retour complété.
- Une commande `CANCELLED` ou `REFUNDED` est un état terminal.

### 7.2 Cycle de vie d'un paiement

```
PENDING → COMPLETED → REFUNDED
   ↓
FAILED / CANCELLED
```
Les transitions manuelles côté admin sont **restreintes à `REFUNDED`** — les autres (`COMPLETED`, `FAILED`, `CANCELLED`) sont exclusivement déclenchées automatiquement par le cycle de vie de la commande (ex : COD complété à la livraison).

### 7.3 Calcul du prix (`pricing`)

Chaque produit renvoyé par `/product`, `/product/:id` et `/promotions/*/products` inclut un objet `pricing` :
```json
{
  "pricing": {
    "originalPrice": 10000,
    "finalPrice": 8000,
    "discountAmount": 2000,
    "discountPercentage": 20,
    "hasDiscount": true,
    "promotionId": "...",
    "discountId": "..."
  }
}
```
Si plusieurs promotions s'appliquent à un même produit, **la meilleure remise (prix le plus bas) est retenue** — les remises ne se cumulent jamais.

### 7.4 Attributs vs combinaisons — bien distinguer

- **Attribut non-variante** (`isVariant: false`) : simple caractéristique informative (ex : matière, poids) → `PUT /product/:productId/attributes`.
- **Attribut de variante** (`isVariant: true`) : génère des combinaisons achetables (ex : couleur, taille) → flux `combinations` (§6.3). Ne jamais utiliser `/product/:productId/attributes` pour un attribut de variante (400).

### 7.5 Panier → Commande

Le stock est seulement **vérifié** à l'ajout au panier, jamais réservé. Il est réservé (FIFO, entrepôt par entrepôt) uniquement à la création de la commande (`POST /orders`). Un produit disponible dans le panier peut donc échouer à la commande si le stock a été pris entretemps (409).

---

## 8. Uploads de fichiers

Champs multipart acceptés : `image/jpeg`, `image/png`, `image/webp`, `image/gif`, 5 Mo max par fichier.

| Endpoint | Champ(s) |
|---|---|
| `POST /product/:productId/images` | `images` (jusqu'à 5) |
| `POST /categories/:categoryId/assets` | `image`, `icon` (1 chacun) |
| `POST /promotions/:promotionId/images` | `images` (jusqu'à 5) |

Le frontend n'a jamais besoin de connaître l'endpoint de stockage (R2/MinIO) : l'API upload elle-même et renvoie l'URL publique finale dans la réponse.

---

## 9. Limites & comportements à anticiper côté frontend

- **Rate limiting** : 100 requêtes / 15 min / IP, tous endpoints confondus. Gérer le `429` avec un message utilisateur générique.
- **Cache produits/promotions** : TTL 5 minutes par défaut — un changement de prix ou de stock peut mettre jusqu'à 5 min à apparaître sur les listings (`/product`), même si l'état réel a changé immédiatement en base.
- **Suppression de produit** : les commandes passées conservent `productName`/`productSku` même après suppression du produit — prévoir un affichage de repli (`item.product ?? { name: item.productName, sku: item.productSku }`).
- **Rôles `MANAGER`/`SUPPORT`** : non fonctionnels sur les routes admin actuelles (voir §2.3).
- **Pas de refresh token** : prévoir une redirection propre vers `/login` sur tout 401.

---

## 10. Enums utiles côté frontend

| Enum | Valeurs |
|---|---|
| `UserRole` | `USER, ADMIN, MANAGER, SUPPORT` |
| `ProductStatus` | `DRAFT, ACTIVE, ARCHIVED` |
| `AttributeType` | `TEXT, NUMBER, COLOR, BOOLEAN, SELECT` |
| `OrderStatus` | `PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED` |
| `PaymentMethod` | `CASH_ON_DELIVERY, PAYPAL, STRIPE, CINETPAY` |
| `PaymentStatus` | `PENDING, COMPLETED, FAILED, REFUNDED, CANCELLED` |
| `ShipmentStatus` | `PENDING, IN_TRANSIT, DELIVERED, CANCELLED` |
| `PickupStatus` | `PENDING, CONFIRMED, CANCELLED` |
| `PromotionStatus` | `SCHEDULED, ACTIVE, EXPIRED, CANCELLED` |
| `DiscountType` | `PERCENTAGE, FIXED_AMOUNT` |
| `ReturnStatus` | `PENDING, APPROVED, REJECTED, COMPLETED` |
| `LoyaltyEventType` | `EARNED, REDEEMED, EXPIRED, ADJUSTED` |

---

*Document généré à partir de l'état actuel du code source. À maintenir à jour à chaque évolution des routers/schémas.*
