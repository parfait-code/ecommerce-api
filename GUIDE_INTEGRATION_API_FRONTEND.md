````markdown
# Guide d'intégration API — ecommerce-api

> Destiné à l'équipe frontend. Décrit l'authentification, le format des réponses, tous les endpoints disponibles et les flux métier à connaître avant intégration.

---

## 1. Environnements

| Environnement | Base URL (exemple)        | Notes                        |
| ------------- | ------------------------- | ---------------------------- |
| Développement | `http://localhost:3000`   | Port configurable via `PORT` |
| Production    | `https://<votre-domaine>` | Derrière Nginx               |

Toutes les routes ci-dessous sont **relatives à la base URL** (pas de préfixe `/api` — les routes sont montées à la racine).

---

## 2. Authentification

### 2.1 Inscription / Connexion

| Méthode | Route     | Body                                                                       |
| ------- | --------- | -------------------------------------------------------------------------- |
| POST    | `/signup` | `{ username, email, password, firstName, lastName, dateOfBirth?, phone? }` |
| POST    | `/login`  | `{ username, password }`                                                   |

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
````

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

Après un nombre configurable d'échecs de connexion consécutifs (5 par défaut, sur une fenêtre de 15 minutes — voir §6.21 pour les rendre configurables), le compte est automatiquement désactivé (`isActive: false`). Le message d'erreur reste générique (`Provided username and password did not match.`) — le frontend ne peut pas distinguer un mauvais mot de passe d'un compte verrouillé avant la tentative suivante, qui renverra alors `This account has been deactivated.` (403).

La suspension (`isActive`) est désormais **indépendante** de la suppression de compte (`deletedAt`) : un admin peut suspendre/réactiver un utilisateur via `PATCH /user/:userId/status` sans que cela affecte son statut de suppression, et inversement.

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

Les endpoints de listing acceptent `?page=1&limit=20` (page par défaut : 1 ; `limit` par défaut piloté par le setting `pagination.default_page_size`, 20 sauf modification admin — voir §6.21) et renvoient :

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

- **Devise** : XAF partout (montants en nombres, pas de sous-unités) — également exposé via le setting public `store.currency` (§6.21).
- **Dates** : ISO 8601 (`z.string().datetime()` côté validation des inputs).
- **IDs** : `Product` utilise un ID numérique auto-incrémenté (`Int`). Toutes les autres entités utilisent des `cuid()` (string).
- **Soft delete** : uniquement sur `User` (`deletedAt`, indépendant de `isActive` — voir §2.4). Les produits sont supprimés définitivement (hard delete) — un produit supprimé disparaît des commandes historiques (le nom/SKU restent en snapshot sur `OrderItem.productName` / `productSku`).

---

## 6. Modules & endpoints

### 6.1 Utilisateurs (`/user`)

| Méthode | Route                       | Auth  | Body                                                                                                                         |
| ------- | --------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/user`                     | User  | — (profil courant)                                                                                                           |
| PATCH   | `/user`                     | User  | `{ email?, firstName?, lastName?, dateOfBirth?, phone? }`                                                                    |
| GET     | `/user/all`                 | Admin | —                                                                                                                            |
| GET     | `/user/:userId`             | Admin | —                                                                                                                            |
| PATCH   | `/user/change-role/:userId` | Admin | `{ role }`                                                                                                                   |
| POST    | `/user`                     | Admin | `{ username, email, password, firstName, lastName, dateOfBirth?, phone?, role? }` — création admin, `role` par défaut `USER` |
| PATCH   | `/user/:userId/status`      | Admin | `{ isActive }` — suspension / réactivation, **indépendante** de la suppression                                               |
| DELETE  | `/user/:userId`             | Admin | — (soft delete, un admin ne peut pas se supprimer lui-même)                                                                  |

### 6.2 Produits (`/product`)

| Méthode | Route                        | Auth                      | Description                                                                                                                |
| ------- | ---------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/product`                   | Public (auth optionnelle) | `?page&limit&categoryId&search`. En admin, ajouter `?includeInactive=true` pour voir DRAFT/ARCHIVED                        |
| GET     | `/product/:productId`        | Public                    | Détail produit (avec `pricing` calculé, voir §7.3)                                                                         |
| POST    | `/product`                   | Admin                     | `{ sku, name, description?, price, categoryId, weight, status? }` — naît toujours en `DRAFT` quel que soit `status` envoyé |
| PATCH   | `/product/:productId`        | Admin                     | Champs partiels (sans `categoryId`, voir §6.2 note ci-dessous)                                                             |
| DELETE  | `/product/:productId`        | Admin                     | Hard delete                                                                                                                |
| POST    | `/product/:productId/images` | Admin                     | multipart, champ `images` (jusqu'à 5), body `combinationId?`                                                               |
| DELETE  | `/product/:productId/images` | Admin                     | body `{ imageId }`                                                                                                         |

⚠️ Passer un produit en `ACTIVE` échoue (400) si des attributs `isRequired: true` de sa catégorie ne sont pas renseignés.

⚠️ Si la catégorie d'un produit change, ses `ProductAttributeValue` sont purgées, ses combinaisons sont désactivées (l'historique de commande est préservé) et le produit repasse automatiquement en `DRAFT`.

⚠️ `PATCH /product/:productId` ne permet pas de changer `categoryId` — la modification de catégorie n'est pas exposée via cet endpoint.

### 6.3 Combinaisons / variantes (`/product/:productId/combinations`)

Un produit peut avoir des **attributs de variante** (ex : couleur, taille) qui génèrent des **combinaisons** achetables individuellement (chacune avec son propre stock, prix optionnel, images).

| Méthode | Route                                | Auth   | Description                                                                                         |
| ------- | ------------------------------------ | ------ | --------------------------------------------------------------------------------------------------- |
| GET     | `/`                                  | Public | Liste des combinaisons du produit                                                                   |
| GET     | `/selections`                        | Public | Sélections d'options faites pour chaque attribut de variante                                        |
| PUT     | `/selections/:attributeDefinitionId` | Admin  | `{ optionIds: string[] }` — définit les options disponibles pour cet attribut                       |
| POST    | `/generate`                          | Admin  | Génère le produit cartésien des sélections en combinaisons (idempotent, désactive celles obsolètes) |
| GET     | `/:combinationId`                    | Public | Détail                                                                                              |
| PATCH   | `/:combinationId`                    | Admin  | `{ sku?, price?, isActive? }`                                                                       |
| DELETE  | `/:combinationId`                    | Admin  | Refusée si stock > 0                                                                                |

⚠️ **Si `product.combinations.length > 0`**, le frontend **doit** faire sélectionner une combinaison au client avant tout ajout au panier ou commande (`combination_id` requis) — sinon 400.

⚠️ **Invariant stock direct / stock par combinaison** : un produit est **soit** un produit simple (stock attaché directement au produit), **soit** un produit à variantes (stock attaché à chaque combinaison) — **jamais les deux à la fois**. Deux garde-fous appliquent cette règle des deux côtés :

- `POST /inventory` refuse (400) d'ajouter du stock directement sur un produit qui a des combinaisons actives.
- `POST /product/:productId/combinations/generate` refuse désormais (400) de générer des combinaisons tant qu'il reste du stock attaché directement au produit (`combinationId: null`) — l'admin doit d'abord transférer ce stock vers la bonne combinaison (`POST /inventory/transfer`) ou le retirer.

Le frontend ne doit donc jamais permettre à un admin de créer une variante sur un produit qui a déjà du stock "produit simple" sans d'abord vider/transférer ce stock — l'API le bloquera de toute façon, mais afficher le message d'erreur explicitement évite une manipulation confuse (l'erreur indique la quantité de stock direct restant).

### 6.4 Attributs (`/categories/:categoryId/attributes`, `/attributes`, `/product/:productId/attributes`)

| Méthode | Route                                | Auth  | Description                                                                                                                                                                                             |
| ------- | ------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/categories/:categoryId/attributes` | User  | Définitions d'attributs de la catégorie                                                                                                                                                                 |
| POST    | `/categories/:categoryId/attributes` | Admin | `{ name, slug, type, unit?, isVariant?, isFilterable?, isRequired?, position? }` — `isVariant` (défaut `false`), `isFilterable` (défaut `true`), `isRequired` (défaut `false`), `position` (défaut `0`) |
| GET     | `/attributes/:definitionId`          | User  | —                                                                                                                                                                                                       |
| PATCH   | `/attributes/:definitionId`          | Admin | —                                                                                                                                                                                                       |
| DELETE  | `/attributes/:definitionId`          | Admin | —                                                                                                                                                                                                       |
| POST    | `/attributes/:definitionId/options`  | Admin | `{ value, colorHex?, position? }`                                                                                                                                                                       |
| PATCH   | `/attributes/options/:optionId`      | Admin | —                                                                                                                                                                                                       |
| DELETE  | `/attributes/options/:optionId`      | Admin | Refusée si l'option est utilisée par une combinaison ayant encore du stock                                                                                                                              |
| PUT     | `/product/:productId/attributes`     | Admin | `{ attributes: [{attributeDefinitionId, value}] }` — **uniquement pour attributs non-variante** (`isVariant: false`)                                                                                    |

`type` : `TEXT | NUMBER | COLOR | BOOLEAN | SELECT`.

### 6.5 Catégories (`/categories`)

| Méthode | Route                             | Auth   | Description                                                                                              |
| ------- | --------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| GET     | `/categories`                     | Public | `?includeInactive=true` réservé admin — par défaut seules les catégories `isActive: true` sont renvoyées |
| GET     | `/categories/:categoryId`         | Public | idem                                                                                                     |
| GET     | `/categories/slug/:slug`          | Public | idem                                                                                                     |
| GET     | `/categories/slug/:slug/products` | Public | Produits de la catégorie + descendantes, paginé (idem filtrage `isActive`)                               |
| POST    | `/categories`                     | Admin  | `{ name, slug, description?, imageUrl?, iconUrl?, metaTitle?, metaDescription?, isActive?, parentId? }`  |
| PUT     | `/categories/:categoryId`         | Admin  | —                                                                                                        |
| DELETE  | `/categories/:categoryId`         | Admin  | Refusée si produits ou discounts encore rattachés                                                        |
| POST    | `/categories/:categoryId/assets`  | Admin  | multipart, champs `image`, `icon` (upload direct, l'API gère R2)                                         |
| DELETE  | `/categories/:categoryId/image`   | Admin  | —                                                                                                        |
| DELETE  | `/categories/:categoryId/icon`    | Admin  | —                                                                                                        |

### 6.6 Tags (`/tags`, `/product/:productId/tags`)

| Méthode | Route                      | Auth   | Description                                         |
| ------- | -------------------------- | ------ | --------------------------------------------------- |
| GET     | `/tags`                    | Public | —                                                   |
| GET     | `/tags/:tagId`             | Public | —                                                   |
| POST    | `/tags`                    | Admin  | `{ name, slug }`                                    |
| PATCH   | `/tags/:tagId`             | Admin  | —                                                   |
| DELETE  | `/tags/:tagId`             | Admin  | —                                                   |
| PUT     | `/product/:productId/tags` | Admin  | `{ tagIds: string[] }` (remplace la liste complète) |
| GET     | `/product/:productId/tags` | Public | —                                                   |

### 6.7 Panier (`/basket`, `/user/basket`)

| Méthode | Route                                 | Auth | Description                                                                  |
| ------- | ------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| GET     | `/user/basket`                        | User | Récupère (ou crée) le panier unique de l'utilisateur — **route recommandée** |
| POST    | `/basket`                             | User | Équivalent get-or-create, conservée pour compat                              |
| GET     | `/basket/:basket_id`                  | User | —                                                                            |
| POST    | `/basket/:basket_id/product`          | User | `{ product_id, combination_id?, quantity }`                                  |
| PUT     | `/basket/:basket_id/product/quantity` | User | `{ product_id, combination_id?, quantity }`                                  |
| DELETE  | `/basket/:basket_id/product`          | User | `{ product_id, combination_id? }`                                            |

Le stock n'est **jamais réservé au niveau du panier** — seulement vérifié (disponibilité). La réservation réelle se fait à la création de la commande.

### 6.8 Liste de souhaits (`/wishlist`)

| Méthode | Route             | Auth | Body                              |
| ------- | ----------------- | ---- | --------------------------------- |
| GET     | `/wishlist`       | User | —                                 |
| POST    | `/wishlist/items` | User | `{ product_id, combination_id? }` |
| DELETE  | `/wishlist/items` | User | `{ product_id, combination_id? }` |

### 6.9 Adresses (`/addresses`, `/address/validate`)

| Méthode | Route                   | Auth   | Body                                                                                                                                      |
| ------- | ----------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| POST    | `/address/validate`     | Public | `{ recipientName, phone?, street, addressLine2?, city, state?, country, postalCode? }` — validation formelle uniquement, ne persiste rien |
| GET     | `/addresses`            | User   | —                                                                                                                                         |
| GET     | `/addresses/:addressId` | User   | —                                                                                                                                         |
| POST    | `/addresses`            | User   | `{ recipientName, phone?, street, addressLine2?, city, state?, country, postalCode?, isDefault? }`                                        |
| PATCH   | `/addresses/:addressId` | User   | Champs partiels                                                                                                                           |
| DELETE  | `/addresses/:addressId` | User   | —                                                                                                                                         |

⚠️ `recipientName` (min 2 caractères) est **requis**. `postalCode` est **optionnel** (certains pays, dont le Cameroun, n'ont pas de code postal résidentiel généralisé). `country` est normalisé côté serveur — voir §9 pour la liste des pays supportés ; toute valeur non reconnue renvoie 400.

### 6.10 Commandes (`/orders`)

| Méthode | Route                     | Auth  | Description                                                                                                                                                  |
| ------- | ------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET     | `/orders`                 | User  | Ses propres commandes (admin voit tout via `?customer=email`)                                                                                                |
| POST    | `/orders`                 | User  | Voir §7.1                                                                                                                                                    |
| GET     | `/orders/:orderId`        | User  | Doit être propriétaire (sauf admin)                                                                                                                          |
| PUT     | `/orders/:orderId`        | User  | Modifie adresse/notes/méthode de livraison **avant expédition** — voir note ci-dessous sur le recalcul automatique du coût de port                           |
| DELETE  | `/orders/:orderId`        | User  | Annule la commande (transition `CANCELLED`, libère le stock)                                                                                                 |
| PUT     | `/orders/:orderId/status` | Admin | `{ status, reason?, shippingCarrier?, trackingNumber?, estimatedDeliveryDate? }`                                                                             |
| GET     | `/user/:userId/orders`    | Admin | Commandes d'un utilisateur donné                                                                                                                             |
| POST    | `/orders/expire-stale`    | Admin | Force l'annulation des commandes `PENDING` non payées dépassant le délai configuré (voir §7.1 et §6.21) — cible pour un cron externe / vérification manuelle |

**Body `POST /orders`** :

```json
{
  "items": [{ "id": "productId", "combinationId": "...", "quantity": 2 }],
  "basketId": "...",
  "shippingAddressId": "...",
  "shippingAddress": {
    "recipientName": "...",
    "phone": "...",
    "street": "...",
    "addressLine2": "...",
    "city": "...",
    "state": "...",
    "country": "...",
    "postalCode": "..."
  },
  "billingAddressId": "...",
  "billingAddress": { "...": "même forme que shippingAddress" },
  "shippingMethodId": "...",
  "paymentMethodId": "...",
  "notes": "...",
  "couponCode": "PROMO10"
}
```

`items` OU `basketId` requis (pas les deux nécessairement, mais au moins un). `shippingAddress` est toujours requis (snapshot conservé même si `shippingAddressId` fourni). Si `shippingMethodId` est fourni, le pays de livraison doit être couvert par les `zones` de cette méthode (sinon 400).

⚠️ **Le frontend n'envoie et ne calcule aucun montant.** Le client ne transmet que des identifiants (produits, combinaisons, quantités, coupon, méthode de livraison) — le serveur calcule intégralement `totalAmount` à partir des données réelles en base au moment de la création, sans jamais faire confiance à un montant fourni par le client. Concrètement, `totalAmount` (le montant réellement à payer) inclut désormais :

1. Le sous-total produit, remise appliquée (la **meilleure** promotion active par produit, jamais cumulée).
2. Le coût de livraison, calculé côté serveur à partir du poids réel des articles commandés et des tarifs (`basePrice` + `pricePerKg × poids`) de la `shippingMethodId` fournie — **jamais fourni ni influençable par le client**.
3. La validation puis l'application du coupon, le cas échéant.

`discountedAmount` reste l'économie totale réalisée sur le sous-total produit (informatif) — ce n'est **pas** un montant à payer, `totalAmount` est le seul champ à utiliser pour initier un paiement.

**Champs exposés sur `Order` liés au pricing** (nouveaux ou clarifiés) :

| Champ                    | Description                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `totalAmount`            | Montant réellement à payer = sous-total produit remisé + `shippingCost`. **C'est le seul montant à utiliser pour initier un paiement.**                                                    |
| `discountedAmount`       | Économie totale réalisée sur le sous-total produit (informatif, jamais un montant à payer)                                                                                                 |
| `shippingCost`           | Coût de livraison figé au moment de la commande                                                                                                                                            |
| `shippingMethodSnapshot` | Copie figée de la méthode de livraison au moment de la commande (nom, tarifs, zones, poids utilisé pour le calcul) — reste exploitable même si la méthode est modifiée/supprimée depuis    |
| `couponSnapshot`         | Copie figée du coupon et de la promotion liée au moment de l'application (code, promotion, discounts) — reste exploitable même si le coupon/la promotion est modifié(e)/supprimé(e) depuis |

Chaque `OrderItem` expose désormais aussi `discountSnapshot` (nullable) : copie figée de la promotion/remise qui a déterminé son prix (`promotionId`, `promotionName`, `discountId`, `type`, `value`, `percentage`). Ensemble, `Order` + `OrderItem[]` permettent de reconstituer et auditer intégralement le montant d'une commande, même des années plus tard, indépendamment de toute modification ou suppression ultérieure des produits, promotions, coupons ou méthodes de livraison concernés.

⚠️ **Modifier la méthode de livraison via `PUT /orders/:orderId`** recalcule automatiquement `shippingCost`, `shippingMethodSnapshot` et `totalAmount` côté serveur (à partir du poids déjà figé des articles de la commande) — le frontend ne doit jamais tenter de recalculer ou d'envoyer ces valeurs lui-même.

### 6.11 Paiements (`/payments`, `/payment-methods`)

| Méthode | Route                            | Auth   | Description                                                                                             |
| ------- | -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| GET     | `/payment-methods`               | Public | Liste des méthodes et leur disponibilité (piloté par le setting `payments.enabled_methods`, voir §6.21) |
| POST    | `/payments`                      | User   | `{ order_id, method, currency?, notes? }`                                                               |
| GET     | `/payments/:payment_id`          | User   | —                                                                                                       |
| PUT     | `/payments/:payment_id/status`   | Admin  | `{ status, notes? }` — **restreint à `REFUNDED`** manuellement, le reste est automatique (voir §7.2)    |
| PUT     | `/payments/:payment_id/complete` | Admin  | Déprécié, alias de `status: COMPLETED`                                                                  |
| GET     | `/orders/:orderId/payments`      | User   | —                                                                                                       |
| GET     | `/payments`                      | Admin  | `?page&limit&status&method&order_id`                                                                    |

Seule `CASH_ON_DELIVERY` est actuellement disponible (`PAYPAL`, `STRIPE`, `CINETPAY` renvoient 503 « Coming soon »).

### 6.12 Avis (`/reviews`, `/products/:pid/reviews`)

| Méthode | Route                    | Auth   | Body                                                                                                                         |
| ------- | ------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/products/:pid/reviews` | Public | Retourne aussi `average_rating`, `total_reviews`                                                                             |
| GET     | `/reviews/:rid`          | Public | —                                                                                                                            |
| POST    | `/reviews`               | User   | `{ order_item_id, product_id, rating (1-5), comment? }` — un seul avis par (orderItem, user), commande doit être `DELIVERED` |
| PUT     | `/reviews/:rid`          | User   | Doit être l'auteur (ou admin)                                                                                                |
| DELETE  | `/reviews/:rid`          | User   | Doit être l'auteur (ou admin)                                                                                                |

### 6.13 Entrepôts (`/warehouses`)

| Méthode | Route                                 | Auth  | Body                                                                    |
| ------- | ------------------------------------- | ----- | ----------------------------------------------------------------------- |
| GET     | `/warehouses`                         | Admin | —                                                                       |
| GET     | `/warehouses/:warehouse_id`           | Admin | —                                                                       |
| GET     | `/warehouses/:warehouse_id/inventory` | Admin | —                                                                       |
| POST    | `/warehouses`                         | Admin | `{ name, location, capacity? }`                                         |
| PUT     | `/warehouses/:warehouse_id`           | Admin | —                                                                       |
| DELETE  | `/warehouses/:warehouse_id`           | Admin | Refusée si stock encore présent (`quantity > 0` sur au moins une ligne) |

### 6.14 Inventaire / Stock (`/inventory`)

| Méthode | Route                           | Auth  | Description                                                                            |
| ------- | ------------------------------- | ----- | -------------------------------------------------------------------------------------- |
| GET     | `/inventory`                    | Admin | `?category&location&warehouse_id&page&limit`                                           |
| GET     | `/inventory/search`             | Admin | `?keyword=` (requis)                                                                   |
| GET     | `/inventory/grouped`            | Admin | Vue groupée par produit — `?low_stock=true` / `?out_of_stock=true`                     |
| GET     | `/inventory/grouped/:productId` | Admin | Détail par combinaison × entrepôt, paginé                                              |
| GET     | `/inventory/:item_id`           | Admin | —                                                                                      |
| POST    | `/inventory`                    | Admin | `{ product_id, warehouse_id, combination_id?, quantity? }` — `quantity` par défaut `0` |
| PUT     | `/inventory/:item_id`           | Admin | `{ quantity?, warehouse_id? }`                                                         |
| DELETE  | `/inventory/:item_id`           | Admin | —                                                                                      |
| POST    | `/inventory/transfer`           | Admin | `{ item_id, from_warehouse, to_warehouse, quantity }`                                  |

Seuil stock faible : configurable via le setting `inventory.low_stock_threshold` (10 unités par défaut — voir §6.21). Ne pas coder ce seuil en dur côté frontend s'il doit refléter une valeur affichée ailleurs (badges "stock faible").
⚠️ **Cohérence stock produit vs. stock combinaison** : voir §6.3 — un produit ne doit jamais porter du stock à la fois directement et via ses combinaisons. Si le dashboard admin affiche une vue "stock groupé par produit" (`GET /inventory/grouped`) et détecte `hasVariants: true` avec un total qui semble incohérent avec les lignes de combinaisons visibles, cela indique généralement une incohérence historique (créée avant l'ajout du garde-fou) — utiliser `POST /inventory/transfer` pour régulariser plutôt que d'ignorer l'écart.

### 6.15 Expéditions & retraits (`/shipments`, `/pickup-requests`, `/labels`)

| Méthode | Route                           | Auth   | Description                                                                                                                                                                             |
| ------- | ------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST    | `/shipments/cost`               | Public | `{ origin, destination, weight, dimensions? }`                                                                                                                                          |
| POST    | `/shipments`                    | Admin  | `{ sender_name, sender_address, recipient_name, recipient_address, weight, dimensions?, order_id?, estimated_delivery_at? }` — si `order_id` fourni, la commande doit être `PROCESSING` |
| GET     | `/shipments/:shipmentId`        | User   | —                                                                                                                                                                                       |
| GET     | `/shipments`                    | Admin  | `?page&limit&status&order_id`                                                                                                                                                           |
| POST    | `/shipments/:shipmentId/track`  | Admin  | `{ status, location?, shipment_status? }` — `status` est un texte libre, `shipment_status` (optionnel) met à jour le statut officiel                                                    |
| GET     | `/shipments/:shipmentId/track`  | User   | Historique de suivi                                                                                                                                                                     |
| PUT     | `/shipments/:shipmentId/status` | Admin  | `{ status, reason? }` — refusée sur une expédition `CANCELLED`, ou `DELIVERED` sauf pour rester `DELIVERED`                                                                             |
| POST    | `/shipments/:shipmentId/cancel` | User   | Propriétaire de la commande liée (ou admin)                                                                                                                                             |
| GET     | `/labels/:shipmentId`           | User   | Génère/récupère l'étiquette                                                                                                                                                             |
| GET     | `/orders/:orderId/shipment`     | User   | —                                                                                                                                                                                       |

Passer `shipment.status` (ou `shipment_status` via `/track`) à `IN_TRANSIT` ou `DELIVERED` synchronise automatiquement `Order.status` (`SHIPPED` / `DELIVERED`).

#### Demandes de retrait (pickup requests)

| Méthode | Route                                  | Auth  | Description                                                                                                                                                                            |
| ------- | -------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/pickup-requests`                     | Admin | `?page&limit&status&order_id`                                                                                                                                                          |
| GET     | `/pickup-requests/:requestId`          | User  | Doit être le demandeur (sauf admin)                                                                                                                                                    |
| PATCH   | `/pickup-requests/:requestId/location` | Admin | `{ method, address_id?, warehouse_id?, pickup_date?, deadline? }` — `method` ∈ `ORIGINAL_ADDRESS \| WAREHOUSE_DROPOFF \| CUSTOM_ADDRESS`                                               |
| PATCH   | `/pickup-requests/:requestId/status`   | Admin | `{ status, notes? }`                                                                                                                                                                   |
| POST    | `/pickup-requests/expire-overdue`      | Admin | Force la détection/expiration des demandes dont le délai est dépassé — un cron interne tourne déjà toutes les 15 min (voir §7.6), cet endpoint sert surtout à la vérification manuelle |

⚠️ **Aucune route de création manuelle** : une pickup request naît automatiquement quand un retour passe à `APPROVED` (voir §6.19). **Aucune route d'annulation côté client** non plus — seul un admin peut faire évoluer son statut ; annuler la pickup annule en cascade le retour lié.

⚠️ **Visibilité pickup request** — chaque `ReturnRequest` renvoyé par `GET /returns/:returnId`
et `GET /orders/:orderId/returns` inclut désormais un champ `pickupRequest` (nullable, `null`
tant que le retour n'est pas passé à `APPROVED`) :

```json
{
  "id": "ret_1",
  "orderId": "order_abc",
  "status": "APPROVED",
  "pickupRequest": {
    "id": "pr_1",
    "method": "ORIGINAL_ADDRESS",
    "status": "PENDING",
    "pickupDate": null,
    "deadline": "2026-07-25T00:00:00.000Z",
    "warehouse": null,
    "address": { "id": "addr_1", "street": "...", "city": "...", "...": "..." }
  }
}
```

C'est le point d'entrée recommandé pour la page "mes demandes d'enlèvement" — pas besoin de connaître l'ID de la pickup request à l'avance, ni de route dédiée supplémentaire.

### 6.16 Méthodes de livraison (`/shipping-methods`)

| Méthode | Route                         | Auth   | Body                                                                                                                                                                                     |
| ------- | ----------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/shipping-methods`           | Public | `?includeInactive=true` réservé admin — par défaut seules les méthodes `isActive: true` sont renvoyées                                                                                   |
| GET     | `/shipping-methods/:methodId` | Public | idem                                                                                                                                                                                     |
| POST    | `/shipping-methods`           | Admin  | `{ name, description?, estimatedDays, basePrice, pricePerKg?, isActive?, zones: string[] }` — `zones` : au moins un code ISO 3166-1 alpha-2 (ou libellé reconnu, normalisé côté serveur) |
| PATCH   | `/shipping-methods/:methodId` | Admin  | —                                                                                                                                                                                        |
| DELETE  | `/shipping-methods/:methodId` | Admin  | —                                                                                                                                                                                        |
| POST    | `/shipping-methods/calculate` | Public | `{ shippingMethodId, weight, country }` — 400 si le pays n'est pas couvert par les `zones` de la méthode                                                                                 |

### 6.17 Promotions, remises & coupons (`/promotions`, `/coupons`)

| Méthode | Route                                            | Auth   | Description                                                                                                                                    |
| ------- | ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/promotions`                                    | Admin  | `?status&isActive&page&limit`                                                                                                                  |
| GET     | `/promotions/active`                             | Public | `?slot=hero&page&limit` — promotions actuellement actives, triées par date de fin ; `slot=hero` renvoie les promos mises en avant pour le hero |
| GET     | `/promotions/slug/:slug`                         | Public | —                                                                                                                                              |
| GET     | `/promotions/slug/:slug/products`                | Public | Produits affectés + `pricing` calculé                                                                                                          |
| GET     | `/promotions/:promotionId`                       | Admin  | —                                                                                                                                              |
| GET     | `/promotions/:promotionId/products`              | Admin  | —                                                                                                                                              |
| POST    | `/promotions`                                    | Admin  | `{ name, slug, description?, startDate, endDate, isActive? }`                                                                                  |
| PUT     | `/promotions/:promotionId`                       | Admin  | —                                                                                                                                              |
| PATCH   | `/promotions/:promotionId/toggle`                | Admin  | Bascule `isActive`                                                                                                                             |
| DELETE  | `/promotions/:promotionId`                       | Admin  | —                                                                                                                                              |
| POST    | `/promotions/:promotionId/images`                | Admin  | multipart `images` (5 max)                                                                                                                     |
| DELETE  | `/promotions/:promotionId/images`                | Admin  | body `{ imageUrl }`                                                                                                                            |
| POST    | `/promotions/:promotionId/discounts`             | Admin  | `{ type: PERCENTAGE\|FIXED_AMOUNT, value, categoryId?, productIds? }` (au moins un ciblage requis)                                             |
| DELETE  | `/promotions/:promotionId/discounts/:discountId` | Admin  | —                                                                                                                                              |
| GET     | `/promotions/:promotionId/coupons`               | Admin  | Chaque coupon inclut `effectiveIsActive` (calculé — voir §7.3)                                                                                 |
| POST    | `/promotions/:promotionId/coupons`               | Admin  | `{ code, maxUses?, perUserLimit?, startDate?, endDate?, isActive? }`                                                                           |
| DELETE  | `/promotions/:promotionId/coupons/:couponId`     | Admin  | —                                                                                                                                              |
| POST    | `/coupons/validate`                              | User   | `{ code, basketId?, items? }` — retourne un `preview` du montant si `items` fourni                                                             |

Le `status` d'une promotion (`SCHEDULED / ACTIVE / EXPIRED / CANCELLED`) est **recalculé dynamiquement** à chaque lecture à partir des dates — ne pas se fier à un statut mis en cache côté frontend au-delà de quelques minutes. De même, `effectiveIsActive` sur un coupon reflète l'état opérationnel réel (dates, plafond d'utilisation) indépendamment du champ `isActive` stocké.

⚠️ **Point d'attention connu** : après expiration d'une promotion (`endDate` dépassée), le prix remisé peut rester visible sur `/product` jusqu'à expiration du cache Redis des produits (TTL piloté par `cache.default_ttl_seconds`, 5 minutes par défaut — voir §6.21). `/promotions/active` reflète en revanche l'état réel immédiatement. Ne pas construire de logique de countdown critique sur le prix produit.

### Popups (`/popups`)

| Méthode | Route              | Auth   | Description                                                                                                                                     |
| ------- | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/popups/active`   | Public | Retourne les popups actuellement actifs ; chaque item expose aussi `resolvedUrl` calculé côté serveur                                           |
| GET     | `/popups`          | Admin  | `?isActive&targetType&page&limit`                                                                                                               |
| GET     | `/popups/:popupId` | Admin  | —                                                                                                                                               |
| POST    | `/popups`          | Admin  | `{ title, imageUrl?, message?, isActive?, startDate?, endDate?, targetType, targetId?, externalUrl?, ctaLabel?, displayFrequency?, priority? }` |
| PUT     | `/popups/:popupId` | Admin  | Champs partiels, validation Zod                                                                                                                 |
| DELETE  | `/popups/:popupId` | Admin  | —                                                                                                                                               |

Règles métier côté frontend à connaître :

- `targetType` ∈ `PROMOTION | CATEGORY | PRODUCT | INFO | EXTERNAL_LINK`
- pour `PROMOTION`, `CATEGORY` et `PRODUCT`, `targetId` est requis
- pour `EXTERNAL_LINK`, `externalUrl` est requis
- pour `INFO`, aucun lien n'est requis
- `GET /popups/active` renvoie déjà `resolvedUrl` prêt à être consommé par le frontend, sans devoir reconstruire l’URL de destination

### 6.18 Fidélité (`/loyalty`)

| Méthode | Route                      | Auth  | Body                                                                      |
| ------- | -------------------------- | ----- | ------------------------------------------------------------------------- |
| GET     | `/loyalty/:userId/balance` | User  | Propriétaire ou admin                                                     |
| GET     | `/loyalty/:userId/history` | User  | Propriétaire ou admin                                                     |
| POST    | `/loyalty/adjust`          | Admin | `{ userId, points, type: EARNED\|REDEEMED\|EXPIRED\|ADJUSTED, orderId? }` |

Barème : configurable via le setting `loyalty.points_per_currency_unit` (0.01 par défaut, soit 1 point par 100 XAF dépensés), crédité automatiquement à `Order.status → DELIVERED`. Reversal automatique si un retour lié à la commande est complété.

### 6.19 Retours (`/returns`)

| Méthode | Route                       | Auth  | Body                                             |
| ------- | --------------------------- | ----- | ------------------------------------------------ |
| GET     | `/returns`                  | Admin | `?status&page&limit`                             |
| GET     | `/returns/:returnId`        | User  | Doit être propriétaire (sauf admin)              |
| POST    | `/returns`                  | User  | Voir ci-dessous — commande doit être `DELIVERED` |
| PUT     | `/returns/:returnId/status` | Admin | Voir ci-dessous                                  |
| GET     | `/orders/:orderId/returns`  | User  | —                                                |

**Body `POST /returns`** :

```json
{
  "order_id": "...",
  "reason": "...",
  "notes": "...",
  "items": [{ "order_item_id": "...", "condition": "..." }],
  "collection": {
    "method": "ORIGINAL_ADDRESS",
    "address_id": "...",
    "warehouse_id": "..."
  }
}
```

⚠️ **Pas de retour partiel** : chaque `orderItemId` listé retourne systématiquement sa quantité complète (pas de champ `quantity` dans l'input). Pour retourner toute la commande, inclure tous les `order_item_id` de la commande. `collection.method` ∈ `ORIGINAL_ADDRESS | WAREHOUSE_DROPOFF | CUSTOM_ADDRESS` (défaut `ORIGINAL_ADDRESS`) ; `address_id` requis si `CUSTOM_ADDRESS`, `warehouse_id` requis si `WAREHOUSE_DROPOFF`. Une commande ne peut avoir qu'une seule demande de retour active (`PENDING`/`APPROVED`) à la fois.

**Body `PUT /returns/:returnId/status`** :

```json
{
  "status": "APPROVED",
  "notes": "...",
  "pickup_deadline": "2026-08-01T00:00:00.000Z"
}
```

`status` ∈ `APPROVED | REJECTED | CANCELLED | COMPLETED`. `pickup_deadline` est **requis uniquement** pour la transition vers `APPROVED` — c'est à ce moment qu'une `PickupRequest` est automatiquement créée (voir §6.15).

Quand un retour passe à `COMPLETED` : `Order.status → REFUNDED`, remboursement automatique des paiements complétés, réintégration du stock, reversal des points de fidélité gagnés sur cette commande.

### 6.20 Tableau de bord (`/dashboard`)

| Méthode | Route                    | Auth  | Description                                                                                                                                                |
| ------- | ------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/dashboard/stats`       | Admin | Retourne les KPIs agrégés globaux du back-office : `products`, `orders`, `users`, `payments`, `inventory`, `shipments`, `promotions`, `returns`, `reviews` |
| GET     | `/dashboard/sales-chart` | Admin | `?year&period` — série mensuelle de CA et nombre de commandes pour l'année demandée ; le calcul actuel renvoie un point par mois                           |

Exemple de payload renvoyé par `GET /dashboard/stats` :

```json
{
  "status": true,
  "data": {
    "products": {
      "total": 123,
      "byStatus": { "DRAFT": 10, "ACTIVE": 100, "ARCHIVED": 13 },
      "addedThisMonth": 5
    },
    "orders": {
      "total": 87,
      "byStatus": {
        "PENDING": 2,
        "CONFIRMED": 3,
        "PROCESSING": 4,
        "SHIPPED": 10,
        "DELIVERED": 58,
        "CANCELLED": 5,
        "REFUNDED": 5
      },
      "thisMonth": 14,
      "trend": 12
    },
    "users": {
      "total": 540,
      "active": 420,
      "newThisMonth": 18,
      "byRole": { "USER": 500, "ADMIN": 10, "MANAGER": 5, "SUPPORT": 25 }
    },
    "payments": {
      "totalAmountThisMonth": 1250000,
      "totalAmountAllTime": 9800000,
      "currency": "XAF",
      "trend": 8,
      "pendingCodCount": 3
    },
    "inventory": {
      "lowStockCount": 7,
      "outOfStockCount": 2
    },
    "shipments": {
      "inProgress": 12,
      "trend": -3,
      "pendingPickupRequests": 4
    },
    "promotions": {
      "active": 5,
      "couponUsageThisMonth": 23,
      "revenueFromCouponsThisMonth": 65000,
      "currency": "XAF"
    },
    "returns": {
      "pending": 4,
      "thisMonth": 8
    },
    "reviews": {
      "total": 44,
      "averageRating": 4.6
    }
  }
}
```

Exemple de payload renvoyé par `GET /dashboard/sales-chart` :

```json
{
  "status": true,
  "data": {
    "period": "monthly",
    "year": 2026,
    "currency": "XAF",
    "points": [
      { "label": "Jan", "amount": 120000, "orderCount": 12 },
      { "label": "Fév", "amount": 98000, "orderCount": 9 }
    ]
  }
}
```

> Remarque côté frontend : les agrégats du dashboard sont destinés à l'admin. Les valeurs `trend` sont des pourcentages calculés côté serveur et la devise est actuellement `XAF`.

### 6.21 Paramètres (`/settings`)

Module de configuration à chaud — les administrateurs peuvent modifier certains comportements de l'API (seuils, listes, méthodes de paiement actives, etc.) sans redéploiement.

| Méthode | Route              | Auth   | Description                                                                                                                                                                               |
| ------- | ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET     | `/settings/public` | Public | Retourne uniquement les settings marqués `isPublic: true` — c'est le point d'entrée recommandé pour la home page (devise, pays supportés, méthodes de paiement actives, limites d'upload) |
| GET     | `/settings`        | Admin  | `?category=` — tous les settings, publics et privés                                                                                                                                       |
| PATCH   | `/settings`        | Admin  | `{ settings: [{ key, value }] }` — mise à jour groupée (au moins 1 entrée)                                                                                                                |
| PATCH   | `/settings/:key`   | Admin  | `{ value }` — mise à jour d'un seul setting                                                                                                                                               |

**Forme d'un objet Setting** :

```json
{
  "id": "...",
  "key": "inventory.low_stock_threshold",
  "value": "10",
  "type": "NUMBER",
  "category": "inventory",
  "description": "Seuil déclenchant l'alerte LOW_STOCK",
  "isPublic": false,
  "updatedBy": 1,
  "createdAt": "...",
  "updatedAt": "..."
}
```

⚠️ **`value` est toujours une string en base**, y compris pour les settings de type `JSON` — dans ce cas, `value` contient une chaîne JSON qu'il faut parser côté frontend (`JSON.parse(setting.value)`). Pour un `PATCH`, envoyer directement la valeur native (objet, tableau, nombre, booléen) dans le body `{ value }` : le serveur se charge de la (re)sérialisation selon le `type` déclaré du setting — ne pas stringifier manuellement côté client.

**Clés disponibles** (`key` / `type` / `category` / `isPublic`) :

| Clé                                     | Type   | Catégorie  | Public | Description                                                                                    |
| --------------------------------------- | ------ | ---------- | ------ | ---------------------------------------------------------------------------------------------- |
| `store.currency`                        | STRING | store      | ✅     | Devise utilisée dans toute l'application                                                       |
| `store.supported_countries`             | JSON   | store      | ✅     | Pays supportés pour les adresses et zones de livraison — voir §9                               |
| `payments.enabled_methods`              | JSON   | payments   | ✅     | Méthodes de paiement actuellement disponibles                                                  |
| `payments.unavailable_messages`         | JSON   | payments   | ✅     | Messages affichés pour les méthodes de paiement indisponibles                                  |
| `inventory.low_stock_threshold`         | NUMBER | inventory  | ❌     | Seuil déclenchant l'alerte LOW_STOCK (défaut 10)                                               |
| `loyalty.points_per_currency_unit`      | NUMBER | loyalty    | ❌     | Points de fidélité gagnés par unité de devise dépensée (défaut 0.01)                           |
| `security.login_attempt_limit`          | NUMBER | security   | ❌     | Échecs de connexion avant verrouillage automatique (défaut 5)                                  |
| `security.login_attempt_window_seconds` | NUMBER | security   | ❌     | Fenêtre glissante du comptage d'échecs (défaut 900s)                                           |
| `orders.stale_pending_hours`            | NUMBER | orders     | ❌     | Délai avant annulation automatique d'une commande `PENDING` non payée (défaut 24h) — voir §7.1 |
| `uploads.max_file_size_mb`              | NUMBER | uploads    | ✅     | Taille maximale par fichier uploadé (défaut 5 Mo)                                              |
| `uploads.allowed_mime_types`            | JSON   | uploads    | ✅     | Types MIME autorisés pour les uploads d'images                                                 |
| `pagination.default_page_size`          | NUMBER | pagination | ❌     | Taille de page par défaut pour les listings (défaut 20)                                        |
| `cache.default_ttl_seconds`             | NUMBER | cache      | ❌     | Durée de vie par défaut du cache Redis produits/promotions (défaut 300s)                       |

Une modification via `PATCH` prend effet **immédiatement** pour les accesseurs asynchrones du serveur ; certains chemins synchrones internes (pagination par défaut, liste de pays, limites d'upload) peuvent mettre jusqu'à quelques minutes à se rafraîchir en interne — sans impact perceptible côté frontend au-delà de ce délai.

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
- ⚠️ **Annulation automatique** : une commande restée `PENDING` (jamais payée) au-delà du délai configuré (`orders.stale_pending_hours`, 24h par défaut — §6.21) est automatiquement annulée par un job interne (toutes les heures) et son stock réservé libéré. Le frontend ne doit pas supposer qu'une commande `PENDING` reste disponible indéfiniment pour paiement — prévoir un message adapté si `GET /orders/:orderId` renvoie `CANCELLED` de manière inattendue.
  ⚠️ **Calcul du montant** : `totalAmount` est entièrement calculé et figé côté serveur à la création de la commande (sous-total produit remisé + coût de livraison), puis recalculé automatiquement si la méthode de livraison change via `PUT /orders/:orderId`. Le frontend n'a jamais à calculer, transmettre, ou faire confiance à un montant venant du client pour initier un paiement — voir §6.10 pour le détail des champs de traçabilité (`shippingMethodSnapshot`, `couponSnapshot`, `OrderItem.discountSnapshot`).

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

### 7.6 Retour → Retrait → Remboursement

```
ReturnRequest: PENDING → APPROVED → COMPLETED
                  ↓          ↓
              REJECTED   CANCELLED
```

L'approbation (`APPROVED`) matérialise automatiquement une `PickupRequest` (voir §6.15) avec la méthode de collecte choisie par le client à la création. L'admin garde un contrôle total sur cette pickup (lieu, statut) indépendamment du retour — faire passer la pickup à `COMPLETED` ne marque **pas** automatiquement le retour comme `COMPLETED` : c'est une décision distincte de l'admin via `PUT /returns/:id/status`, qui seule déclenche remboursement + réintégration stock + reversal fidélité.

⚠️ Un job interne vérifie toutes les 15 minutes les pickup requests dont la `deadline` est dépassée : elles passent automatiquement à `EXPIRED` et le retour associé est automatiquement annulé (`CANCELLED`). Prévoir un rafraîchissement périodique côté client sur la page de suivi plutôt qu'un état figé.

---

## 8. Uploads de fichiers

Champs multipart acceptés : types MIME définis par `uploads.allowed_mime_types` (défaut `image/jpeg`, `image/png`, `image/webp`, `image/gif`), taille max par fichier définie par `uploads.max_file_size_mb` (défaut 5 Mo) — les deux sont configurables à chaud (§6.21) et récupérables via `GET /settings/public`.

| Endpoint                               | Champ(s)                   |
| -------------------------------------- | -------------------------- |
| `POST /product/:productId/images`      | `images` (jusqu'à 5)       |
| `POST /categories/:categoryId/assets`  | `image`, `icon` (1 chacun) |
| `POST /promotions/:promotionId/images` | `images` (jusqu'à 5)       |

Le frontend n'a jamais besoin de connaître l'endpoint de stockage (R2/MinIO) : l'API upload elle-même et renvoie l'URL publique finale dans la réponse.

---

## 9. Limites & comportements à anticiper côté frontend

- **Rate limiting** : 100 requêtes / 15 min / IP, tous endpoints confondus. Gérer le `429` avec un message utilisateur générique.
- **Cache produits/promotions** : TTL configurable (`cache.default_ttl_seconds`, 5 minutes par défaut) — un changement de prix ou de stock peut mettre jusqu'à ce délai à apparaître sur les listings (`/product`), même si l'état réel a changé immédiatement en base.
- **Suppression de produit** : les commandes passées conservent `productName`/`productSku` même après suppression du produit — prévoir un affichage de repli (`item.product ?? { name: item.productName, sku: item.productSku }`).
- **Rôles `MANAGER`/`SUPPORT`** : non fonctionnels sur les routes admin actuelles (voir §2.3).
- **Pas de refresh token** : prévoir une redirection propre vers `/login` sur tout 401.
- **Pays supportés** : toute normalisation d'adresse ou de zone de livraison (`country` sur une adresse, `zones` d'une méthode de livraison, `country` dans le calcul de frais) n'accepte qu'un ensemble restreint de pays, désormais piloté par le setting `store.supported_countries` (§6.21) — récupérable via `GET /settings/public` plutôt qu'à coder en dur. Valeurs actuelles : Cameroun (`CM`), France (`FR`), États-Unis (`US`), Royaume-Uni (`GB`), Sénégal (`SN`), Côte d'Ivoire (`CI`), Nigeria (`NG`), Ghana (`GH`). Toute autre valeur renvoie 400. Utiliser `POST /address/validate` pour vérifier avant soumission.
- **Processus automatiques en arrière-plan** : deux jobs internes peuvent faire évoluer un état sans action de l'utilisateur — annulation des commandes `PENDING` abandonnées (§7.1) et expiration des pickup requests en retard (§7.6). Éviter de mettre en cache un statut de commande/retrait côté client au-delà de quelques minutes sans revalidation.

---

## 10. Enums utiles côté frontend

| Enum                     | Valeurs                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| `UserRole`               | `USER, ADMIN, MANAGER, SUPPORT`                                           |
| `ProductStatus`          | `DRAFT, ACTIVE, ARCHIVED`                                                 |
| `AttributeType`          | `TEXT, NUMBER, COLOR, BOOLEAN, SELECT`                                    |
| `OrderStatus`            | `PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED` |
| `PaymentMethod`          | `CASH_ON_DELIVERY, PAYPAL, STRIPE, CINETPAY`                              |
| `PaymentStatus`          | `PENDING, COMPLETED, FAILED, REFUNDED, CANCELLED`                         |
| `ShipmentStatus`         | `PENDING, IN_TRANSIT, DELIVERED, CANCELLED`                               |
| `PickupCollectionMethod` | `ORIGINAL_ADDRESS, WAREHOUSE_DROPOFF, CUSTOM_ADDRESS`                     |
| `PickupStatus`           | `PENDING, CONFIRMED, COMPLETED, CANCELLED, EXPIRED`                       |
| `PromotionStatus`        | `SCHEDULED, ACTIVE, EXPIRED, CANCELLED`                                   |
| `DiscountType`           | `PERCENTAGE, FIXED_AMOUNT`                                                |
| `ReturnStatus`           | `PENDING, APPROVED, REJECTED, CANCELLED, COMPLETED`                       |
| `LoyaltyEventType`       | `EARNED, REDEEMED, EXPIRED, ADJUSTED`                                     |
| `SettingType`            | `STRING, NUMBER, BOOLEAN, JSON`                                           |

---

_Document généré à partir de l'état actuel du code source. À maintenir à jour à chaque évolution des routers/schémas._

```

```
