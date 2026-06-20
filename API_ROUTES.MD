# API Reference — E-Commerce API

> **Base URL** : `http://localhost:3000`  
> **Content-Type** : `application/json`  
> **Authentication** : `Authorization: Bearer <token>` (JWT)

---

## Conventions

### Réponse succès
```json
{ "status": true, "data": { ... } }
```

### Réponse erreur
```json
{ "status": false, "error": { "message": "..." } }
```

### Pagination (paramètres query communs)
| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `page` | number | 1 | Numéro de page |
| `limit` | number | 20 | Nombre d'éléments par page |

### Réponse paginée
```json
{
  "status": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Rôles
| Rôle | Description |
|------|-------------|
| `USER` | Utilisateur standard |
| `ADMIN` | Administrateur |
| `MANAGER` | Manager |
| `SUPPORT` | Support |

---

## Auth

### `POST /signup`
Créer un compte utilisateur.  
**Auth** : ❌

**Body**
```json
{
  "username": "string (3-50)",
  "email": "string (email)",
  "password": "string (min 6)",
  "firstName": "string (2-50)",
  "lastName": "string (2-50)",
  "dateOfBirth": "string (ISO datetime, optionnel)",
  "phone": "string (optionnel)",
  "role": "USER | ADMIN | MANAGER | SUPPORT (défaut: USER)"
}
```

**Réponse 200**
```json
{
  "user": { "id": 1, "username": "...", "email": "...", "role": "USER", ... },
  "token": "eyJ..."
}
```

---

### `POST /login`
Se connecter.  
**Auth** : ❌

**Body**
```json
{
  "username": "string",
  "password": "string"
}
```

**Réponse 200**
```json
{
  "user": { "id": 1, "username": "...", "email": "...", "role": "USER", ... },
  "token": "eyJ..."
}
```

---

## Utilisateurs

### `GET /user`
Récupérer son propre profil.  
**Auth** : ✅ (tous rôles)

**Réponse 200**
```json
{
  "id": 1,
  "username": "string",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "dateOfBirth": "datetime | null",
  "phone": "string | null",
  "role": "USER",
  "isActive": true,
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### `PATCH /user`
Mettre à jour son propre profil.  
**Auth** : ✅ (tous rôles)

**Body** (tous les champs optionnels)
```json
{
  "email": "string (email)",
  "firstName": "string (2-50)",
  "lastName": "string (2-50)",
  "dateOfBirth": "string (ISO datetime)",
  "phone": "string"
}
```

---

### `GET /user/all` 🔒 ADMIN
Lister tous les utilisateurs.  
**Auth** : ✅ ADMIN

**Réponse 200** : tableau d'utilisateurs (sans `password`)

---

### `GET /user/:userId` 🔒 ADMIN
Récupérer un utilisateur par ID.  
**Auth** : ✅ ADMIN

---

### `POST /user` 🔒 ADMIN
Créer un utilisateur (côté admin).  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "username": "string (3-50)",
  "email": "string (email)",
  "password": "string (min 6)",
  "firstName": "string (2-50)",
  "lastName": "string (2-50)",
  "dateOfBirth": "string (ISO datetime, optionnel)",
  "phone": "string (optionnel)",
  "role": "USER | ADMIN | MANAGER | SUPPORT (défaut: USER)"
}
```

---

### `PATCH /user/change-role/:userId` 🔒 ADMIN
Changer le rôle d'un utilisateur.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "role": "USER | ADMIN | MANAGER | SUPPORT"
}
```

---

### `DELETE /user/:userId` 🔒 ADMIN
Supprimer (soft delete) un utilisateur.  
**Auth** : ✅ ADMIN

**Réponse 200**
```json
{ "numberOfUsersDeleted": 1 }
```

---

## Produits

### `GET /product`
Lister les produits.  
**Auth** : ❌

**Query**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `page` | number | Page |
| `limit` | number | Limite |
| `categoryId` | string | Filtrer par catégorie |

**Réponse 200** : réponse paginée avec `items` = tableau de produits

---

### `GET /product/:productId`
Récupérer un produit par ID.  
**Auth** : ❌

**Réponse 200**
```json
{
  "id": 1,
  "sku": "string",
  "name": "string",
  "description": "string | null",
  "price": 9999,
  "status": "DRAFT | ACTIVE | ARCHIVED",
  "weight": 1.5,
  "brand": "string | null",
  "category": { "id": "string", "name": "string", "slug": "string" },
  "images": [{ "id": "string", "url": "string", "isPrimary": true, "position": 0 }],
  "variants": [...],
  "attributeValues": [...],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### `POST /product` 🔒 ADMIN
Créer un produit.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "sku": "string (1-100)",
  "name": "string (2-200)",
  "description": "string (optionnel)",
  "price": 9999,
  "categoryId": "string",
  "status": "DRAFT | ACTIVE | ARCHIVED (défaut: DRAFT)",
  "weight": 1.5
}
```

**Réponse 201** : produit créé

---

### `PATCH /product/:productId` 🔒 ADMIN
Mettre à jour un produit.  
**Auth** : ✅ ADMIN

**Body** (tous les champs optionnels, mêmes champs que POST)

---

### `DELETE /product/:productId` 🔒 ADMIN
Supprimer un produit (soft delete).  
**Auth** : ✅ ADMIN

**Réponse 200**
```json
{ "numberOfProductsDeleted": 1 }
```

---

### `POST /product/:productId/images` 🔒 ADMIN
Upload d'images pour un produit.  
**Auth** : ✅ ADMIN  
**Content-Type** : `multipart/form-data`

**Body (form-data)**
| Champ | Type | Description |
|-------|------|-------------|
| `images` | File[] | 1 à 5 fichiers (JPEG, PNG, WEBP, GIF, max 5MB chacun) |
| `variantId` | string | ID du variant (optionnel) |

---

### `DELETE /product/:productId/images` 🔒 ADMIN
Supprimer une image d'un produit.  
**Auth** : ✅ ADMIN

**Body**
```json
{ "imageId": "string" }
```

---

## Variants Produit

> **Préfixe** : `/product/:productId/variants`

### `GET /product/:productId/variants`
Lister les variants d'un produit.  
**Auth** : ✅ (tous rôles)

---

### `GET /product/:productId/variants/:variantId`
Récupérer un variant.  
**Auth** : ✅ (tous rôles)

---

### `POST /product/:productId/variants` 🔒 ADMIN
Créer un variant.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "sku": "string (1-100)",
  "price": 9999,
  "isActive": true,
  "attributes": [
    { "attributeDefinitionId": "string", "value": "string" }
  ]
}
```

**Réponse 201** : variant créé

---

### `PATCH /product/:productId/variants/:variantId` 🔒 ADMIN
Mettre à jour un variant.  
**Auth** : ✅ ADMIN

**Body** (tous les champs optionnels)
```json
{
  "sku": "string",
  "price": 9999,
  "isActive": true,
  "attributes": [
    { "attributeDefinitionId": "string", "value": "string" }
  ]
}
```

---

### `DELETE /product/:productId/variants/:variantId` 🔒 ADMIN
Supprimer un variant.  
**Auth** : ✅ ADMIN

---

## Catégories

### `GET /categories`
Lister toutes les catégories.  
**Auth** : ✅ (tous rôles)

**Réponse 200**
```json
[
  {
    "id": "string",
    "name": "string",
    "slug": "string",
    "description": "string | null",
    "imageUrl": "string | null",
    "iconUrl": "string | null",
    "isActive": true,
    "parentId": "string | null",
    "parent": { "id": "string", "name": "string", "slug": "string" },
    "children": [...],
    "_count": { "products": 12 }
  }
]
```

---

### `GET /categories/:categoryId`
Récupérer une catégorie par ID.  
**Auth** : ✅ (tous rôles)

---

### `GET /categories/slug/:slug`
Récupérer une catégorie par slug.  
**Auth** : ❌

---

### `GET /categories/slug/:slug/products`
Lister les produits d'une catégorie.  
**Auth** : ❌

**Query** : `page`, `limit`

**Réponse 200**
```json
{
  "category": { "id": "string", "name": "string", "slug": "string" },
  "items": [...],
  "total": 50,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

---

### `POST /categories` 🔒 ADMIN
Créer une catégorie.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "name": "string (2-100)",
  "slug": "string (2-100, lowercase-hyphenated)",
  "description": "string (optionnel)",
  "imageUrl": "string (url, optionnel)",
  "iconUrl": "string (url, optionnel)",
  "metaTitle": "string (max 70, optionnel)",
  "metaDescription": "string (max 160, optionnel)",
  "isActive": true,
  "parentId": "string (optionnel)"
}
```

**Réponse 201** : catégorie créée

---

### `PUT /categories/:categoryId` 🔒 ADMIN
Mettre à jour une catégorie.  
**Auth** : ✅ ADMIN

**Body** (tous les champs optionnels, mêmes champs que POST)

---

### `DELETE /categories/:categoryId` 🔒 ADMIN
Supprimer une catégorie.  
**Auth** : ✅ ADMIN  
⚠️ Échoue si des produits sont encore rattachés à cette catégorie.

**Réponse 200**
```json
{ "message": "Category deleted successfully" }
```

---

## Attributs

### `GET /categories/:categoryId/attributes`
Lister les définitions d'attributs d'une catégorie.  
**Auth** : ✅ (tous rôles)

---

### `POST /categories/:categoryId/attributes` 🔒 ADMIN
Créer une définition d'attribut.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "name": "string (2-100)",
  "slug": "string (2-100, lowercase-hyphenated)",
  "type": "TEXT | NUMBER | COLOR | BOOLEAN | SELECT",
  "unit": "string (optionnel)",
  "isVariant": false,
  "isFilterable": true,
  "isRequired": false,
  "position": 0
}
```

**Réponse 201** : définition créée

---

### `GET /attributes/:definitionId`
Récupérer une définition d'attribut.  
**Auth** : ✅ (tous rôles)

---

### `PATCH /attributes/:definitionId` 🔒 ADMIN
Mettre à jour une définition d'attribut.  
**Auth** : ✅ ADMIN

**Body** (tous les champs optionnels, mêmes champs que POST)

---

### `DELETE /attributes/:definitionId` 🔒 ADMIN
Supprimer une définition d'attribut.  
**Auth** : ✅ ADMIN

---

### `POST /attributes/:definitionId/options` 🔒 ADMIN
Ajouter une option à un attribut SELECT/COLOR.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "value": "string",
  "colorHex": "#FF0000 (optionnel)",
  "position": 0
}
```

---

### `DELETE /attributes/options/:optionId` 🔒 ADMIN
Supprimer une option d'attribut.  
**Auth** : ✅ ADMIN

---

### `PUT /product/:productId/attributes` 🔒 ADMIN
Définir les valeurs d'attributs d'un produit (remplace tout).  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "attributes": [
    { "attributeDefinitionId": "string", "value": "string" }
  ]
}
```

---

## Tags

### `GET /tags`
Lister tous les tags.  
**Auth** : ❌

---

### `GET /tags/:tagId`
Récupérer un tag.  
**Auth** : ❌

---

### `POST /tags` 🔒 ADMIN
Créer un tag.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "name": "string (2-50)",
  "slug": "string (2-50, lowercase-hyphenated)"
}
```

**Réponse 201** : tag créé

---

### `PATCH /tags/:tagId` 🔒 ADMIN
Mettre à jour un tag.  
**Auth** : ✅ ADMIN

**Body** (tous les champs optionnels)

---

### `DELETE /tags/:tagId` 🔒 ADMIN
Supprimer un tag.  
**Auth** : ✅ ADMIN

---

### `PUT /product/:productId/tags` 🔒 ADMIN
Définir les tags d'un produit (remplace tout).  
**Auth** : ✅ ADMIN

**Body**
```json
{ "tagIds": ["string", "string"] }
```

---

### `GET /product/:productId/tags`
Lister les tags d'un produit.  
**Auth** : ✅ (tous rôles)

---

## Panier (Basket)

### `POST /basket`
Créer un panier.  
**Auth** : ✅ (tous rôles)

**Réponse 201**
```json
{
  "id": "string",
  "userId": 1,
  "items": [],
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

### `GET /basket/:basket_id`
Récupérer un panier.  
**Auth** : ✅ (tous rôles)

**Réponse 200**
```json
{
  "id": "string",
  "userId": 1,
  "items": [
    {
      "id": "string",
      "productId": 1,
      "variantId": "string | null",
      "quantity": 2,
      "product": { ... },
      "variant": { ... }
    }
  ]
}
```

---

### `POST /basket/:basket_id/product`
Ajouter un produit au panier.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "product_id": 1,
  "variant_id": "string (optionnel)",
  "quantity": 2
}
```

**Réponse 200** : panier mis à jour

---

### `PUT /basket/:basket_id/product/quantity`
Mettre à jour la quantité d'un article.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "product_id": 1,
  "variant_id": "string (optionnel)",
  "quantity": 3
}
```

**Réponse 200** : panier mis à jour

---

### `DELETE /basket/:basket_id/product`
Retirer un produit du panier.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "product_id": 1,
  "variant_id": "string (optionnel)"
}
```

**Réponse 200** : panier mis à jour

---

## Wishlist

### `GET /wishlist`
Récupérer la wishlist de l'utilisateur connecté.  
**Auth** : ✅ (tous rôles)

**Réponse 200**
```json
{
  "id": "string",
  "userId": 1,
  "items": [
    {
      "id": "string",
      "productId": 1,
      "variantId": "string | null",
      "product": { "id": 1, "name": "string", "price": 9999, "images": [...] },
      "variant": { "id": "string", "sku": "string", "price": 9999 }
    }
  ]
}
```

---

### `POST /wishlist/items`
Ajouter un article à la wishlist.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "product_id": 1,
  "variant_id": "string (optionnel)"
}
```

**Réponse 201** : wishlist mise à jour

---

### `DELETE /wishlist/items`
Retirer un article de la wishlist.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "product_id": 1,
  "variant_id": "string (optionnel)"
}
```

---

## Commandes (Orders)

### `GET /orders`
Lister toutes les commandes.  
**Auth** : ✅ (tous rôles)

**Query**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `page` | number | Page |
| `limit` | number | Limite |
| `status` | string | Filtrer par statut |
| `customer` | string | Filtrer par email client |

**Réponse 200** : réponse paginée

---

### `POST /orders`
Créer une commande.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "items": [
    { "id": "string (basketItemId)", "quantity": 2 }
  ],
  "shippingAddress": {
    "street": "string",
    "city": "string",
    "state": "string (optionnel)",
    "country": "string",
    "postalCode": "string"
  },
  "shippingAddressId": "string (optionnel)",
  "billingAddress": { "...même structure que shippingAddress (optionnel)" },
  "billingAddressId": "string (optionnel)",
  "shippingMethodId": "string (optionnel)",
  "paymentMethodId": "string (optionnel)",
  "notes": "string (optionnel)"
}
```

**Réponse 201** : commande créée

---

### `GET /orders/:orderId`
Récupérer une commande.  
**Auth** : ✅ (tous rôles)

**Réponse 200**
```json
{
  "id": "string",
  "userId": 1,
  "status": "PENDING | CONFIRMED | PROCESSING | SHIPPED | DELIVERED | CANCELLED | REFUNDED",
  "totalAmount": 9999,
  "discountedAmount": null,
  "shippingAddressSnapshot": { ... },
  "items": [...],
  "payments": [...],
  "appliedCoupon": { "id": "string", "code": "string", "promotion": { ... } },
  "shippingMethod": { "id": "string", "name": "string", "estimatedDays": 3 },
  "statusHistory": [...],
  "createdAt": "datetime"
}
```

---

### `PUT /orders/:orderId`
Mettre à jour une commande (adresse, méthode de livraison, notes).  
**Auth** : ✅ (tous rôles)

**Body** (tous les champs optionnels)
```json
{
  "shippingAddressId": "string",
  "shippingAddress": { "street": "...", "city": "...", "country": "...", "postalCode": "..." },
  "billingAddressId": "string",
  "billingAddress": { "...même structure" },
  "shippingMethodId": "string",
  "notes": "string"
}
```

---

### `DELETE /orders/:orderId`
Annuler une commande.  
**Auth** : ✅ (tous rôles)

**Réponse 200**
```json
{ "message": "Order cancelled successfully" }
```

---

### `PUT /orders/:orderId/status` 🔒 ADMIN
Changer le statut d'une commande.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "status": "PENDING | CONFIRMED | PROCESSING | SHIPPED | DELIVERED | CANCELLED | REFUNDED",
  "reason": "string (optionnel)",
  "shippingCarrier": "string (optionnel)",
  "trackingNumber": "string (optionnel)",
  "estimatedDeliveryDate": "string ISO (optionnel)"
}
```

---

### `GET /user/:userId/orders` 🔒 ADMIN
Lister les commandes d'un utilisateur spécifique.  
**Auth** : ✅ ADMIN

**Query** : `page`, `limit`

---

## Paiements (Payments)

### `GET /payment-methods`
Lister les méthodes de paiement disponibles.  
**Auth** : ❌

**Réponse 200**
```json
[
  { "id": "CASH_ON_DELIVERY", "name": "Cash on Delivery", "available": true },
  { "id": "STRIPE", "name": "Stripe", "available": false, "message": "..." },
  { "id": "PAYPAL", "name": "PayPal", "available": false, "message": "..." },
  { "id": "CINETPAY", "name": "CinetPay", "available": false, "message": "..." }
]
```

---

### `POST /payments`
Créer un paiement pour une commande.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "order_id": "string",
  "method": "CASH_ON_DELIVERY | PAYPAL | STRIPE | CINETPAY",
  "currency": "XAF (défaut)",
  "notes": "string (optionnel)"
}
```

**Réponse 201** : paiement créé, commande passée en `CONFIRMED`

---

### `GET /payments/:payment_id`
Récupérer un paiement.  
**Auth** : ✅ (tous rôles)

---

### `GET /orders/:orderId/payments`
Lister les paiements d'une commande.  
**Auth** : ✅ (tous rôles)

---

### `GET /payments` 🔒 ADMIN
Lister tous les paiements.  
**Auth** : ✅ ADMIN

**Query**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `page` | number | Page |
| `limit` | number | Limite |
| `status` | string | `PENDING \| COMPLETED \| FAILED \| REFUNDED \| CANCELLED` |
| `method` | string | Méthode de paiement |
| `order_id` | string | ID de la commande |

---

## Adresses

### `POST /address/validate`
Valider une adresse sans l'enregistrer.  
**Auth** : ❌

**Body**
```json
{
  "street": "string (min 2)",
  "city": "string (min 2)",
  "state": "string (optionnel)",
  "country": "string (min 2)",
  "postal_code": "string (min 2)"
}
```

**Réponse 200**
```json
{
  "valid": true,
  "normalized_address": {
    "street": "string",
    "city": "string",
    "state": "string | null",
    "country": "string",
    "postal_code": "string"
  }
}
```

---

### `GET /addresses`
Lister ses adresses.  
**Auth** : ✅ (tous rôles)

---

### `GET /addresses/:addressId`
Récupérer une adresse.  
**Auth** : ✅ (tous rôles)

---

### `POST /addresses`
Créer une adresse.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "street": "string (min 2)",
  "city": "string (min 2)",
  "state": "string (optionnel)",
  "country": "string (min 2)",
  "postalCode": "string (min 2)",
  "isDefault": false
}
```

**Réponse 201** : adresse créée  
⚠️ Si `isDefault: true`, toutes les autres adresses de l'utilisateur sont désactivées.

---

### `PATCH /addresses/:addressId`
Mettre à jour une adresse.  
**Auth** : ✅ (tous rôles)

**Body** (tous les champs optionnels, mêmes champs que POST)

---

### `DELETE /addresses/:addressId`
Supprimer une adresse.  
**Auth** : ✅ (tous rôles)

**Réponse 200**
```json
{ "message": "Address deleted successfully" }
```

---

## Avis (Reviews)

### `GET /products/:pid/reviews`
Lister les avis d'un produit.  
**Auth** : ❌

**Réponse 200**
```json
{
  "product_id": 1,
  "average_rating": 4.3,
  "total_reviews": 12,
  "reviews": [
    {
      "id": "string",
      "rating": 5,
      "comment": "string | null",
      "user": { "id": 1, "username": "string", "firstName": "string", "lastName": "string" },
      "createdAt": "datetime"
    }
  ]
}
```

---

### `GET /reviews/:rid`
Récupérer un avis.  
**Auth** : ❌

---

### `POST /reviews`
Créer un avis.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "order_item_id": "string",
  "product_id": 1,
  "rating": 5,
  "comment": "string (optionnel)"
}
```

**Réponse 201** : avis créé  
⚠️ L'utilisateur doit avoir acheté le produit (via `order_item_id`). Un seul avis par achat.

---

### `PUT /reviews/:rid`
Mettre à jour son avis.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "rating": 4,
  "comment": "string (optionnel)"
}
```

---

### `DELETE /reviews/:rid`
Supprimer son avis.  
**Auth** : ✅ (tous rôles)

---

## Promotions

### `GET /promotions/slug/:slug`
Récupérer une promotion par slug (page publique).  
**Auth** : ❌

**Réponse 200**
```json
{
  "id": "string",
  "name": "string",
  "slug": "string",
  "description": "string | null",
  "images": ["url", "url"],
  "status": "SCHEDULED | ACTIVE | EXPIRED | CANCELLED",
  "isActive": true,
  "startDate": "datetime",
  "endDate": "datetime",
  "discounts": [
    {
      "id": "string",
      "type": "PERCENTAGE | FIXED_AMOUNT",
      "value": 20,
      "category": { "id": "string", "name": "string", "slug": "string" },
      "products": [
        { "product": { "id": 1, "name": "string", "price": 9999 } }
      ]
    }
  ],
  "coupons": [...]
}
```

---

### `POST /coupons/validate`
Valider un coupon avant de passer commande.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "code": "string",
  "basketId": "string"
}
```

**Réponse 200**
```json
{
  "valid": true,
  "couponId": "string",
  "code": "string",
  "promotion": { "id": "string", "name": "string", "slug": "string" },
  "discounts": [...]
}
```

---

### `GET /promotions` 🔒 ADMIN
Lister toutes les promotions.  
**Auth** : ✅ ADMIN

**Query**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `status` | string | `SCHEDULED \| ACTIVE \| EXPIRED \| CANCELLED` |
| `isActive` | boolean | `true \| false` |

---

### `GET /promotions/:promotionId` 🔒 ADMIN
Récupérer une promotion par ID.  
**Auth** : ✅ ADMIN

---

### `POST /promotions` 🔒 ADMIN
Créer une promotion.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "name": "string (2-200)",
  "slug": "string (2-200, lowercase-hyphenated)",
  "description": "string (optionnel)",
  "startDate": "string (ISO datetime)",
  "endDate": "string (ISO datetime)",
  "isActive": true
}
```

**Réponse 201** : promotion créée

---

### `PUT /promotions/:promotionId` 🔒 ADMIN
Mettre à jour une promotion.  
**Auth** : ✅ ADMIN

**Body** (tous les champs optionnels, mêmes champs que POST)

---

### `PATCH /promotions/:promotionId/toggle` 🔒 ADMIN
Activer / désactiver une promotion.  
**Auth** : ✅ ADMIN

---

### `DELETE /promotions/:promotionId` 🔒 ADMIN
Supprimer une promotion.  
**Auth** : ✅ ADMIN

---

### `POST /promotions/:promotionId/images` 🔒 ADMIN
Upload d'images pour une promotion.  
**Auth** : ✅ ADMIN  
**Content-Type** : `multipart/form-data`

**Body (form-data)**
| Champ | Type | Description |
|-------|------|-------------|
| `images` | File[] | 1 à 5 fichiers (JPEG, PNG, WEBP, GIF, max 5MB) |

---

### `DELETE /promotions/:promotionId/images` 🔒 ADMIN
Supprimer une image de promotion.  
**Auth** : ✅ ADMIN

**Body**
```json
{ "imageUrl": "string" }
```

---

### `POST /promotions/:promotionId/discounts` 🔒 ADMIN
Ajouter une remise à une promotion.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "type": "PERCENTAGE | FIXED_AMOUNT",
  "value": 20,
  "categoryId": "string (optionnel)",
  "productIds": [1, 2, 3]
}
```

⚠️ Au moins `categoryId` ou `productIds` est requis.

**Réponse 201** : remise créée

---

### `DELETE /promotions/:promotionId/discounts/:discountId` 🔒 ADMIN
Supprimer une remise.  
**Auth** : ✅ ADMIN

---

### `GET /promotions/:promotionId/coupons` 🔒 ADMIN
Lister les coupons d'une promotion.  
**Auth** : ✅ ADMIN

---

### `POST /promotions/:promotionId/coupons` 🔒 ADMIN
Créer un coupon pour une promotion.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "code": "string (3-50, converti en majuscules)",
  "maxUses": 100,
  "perUserLimit": 1,
  "startDate": "string (ISO datetime, optionnel)",
  "endDate": "string (ISO datetime, optionnel)",
  "isActive": true
}
```

**Réponse 201** : coupon créé

---

### `DELETE /promotions/:promotionId/coupons/:couponId` 🔒 ADMIN
Supprimer un coupon.  
**Auth** : ✅ ADMIN

---

## Expéditions (Shipments)

### `POST /shipments/cost`
Calculer le coût d'une expédition.  
**Auth** : ❌

**Body**
```json
{
  "origin": "string",
  "destination": "string",
  "weight": 2.5,
  "dimensions": {
    "length": 10,
    "width": 10,
    "height": 10
  }
}
```

**Réponse 200**
```json
{ "cost": 5.25, "currency": "XAF" }
```

---

### `POST /shipments`
Créer une expédition.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "sender_name": "string",
  "sender_address": "string",
  "recipient_name": "string",
  "recipient_address": "string",
  "weight": 2.5,
  "dimensions": { "length": 10, "width": 10, "height": 10 },
  "order_id": "string (optionnel)",
  "estimated_delivery_at": "string ISO (optionnel)"
}
```

**Réponse 201** : expédition créée avec `trackingNumber` généré

---

### `GET /shipments/:shipmentId`
Récupérer une expédition.  
**Auth** : ✅ (tous rôles)

---

### `GET /shipments/:shipmentId/track`
Suivre une expédition.  
**Auth** : ✅ (tous rôles)

**Réponse 200**
```json
{
  "current_status": "PENDING | IN_TRANSIT | DELIVERED | CANCELLED",
  "current_location": "string | null",
  "updates": [
    { "id": "string", "status": "string", "location": "string", "createdAt": "datetime" }
  ]
}
```

---

### `POST /shipments/:shipmentId/cancel`
Annuler une expédition.  
**Auth** : ✅ (tous rôles)

---

### `GET /labels/:shipmentId`
Récupérer le label d'expédition.  
**Auth** : ✅ (tous rôles)

**Réponse 200**
```json
{ "label_id": "string", "label_url": "string" }
```

---

### `POST /pickup-requests`
Créer une demande de collecte.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "pickup_date": "string (ISO datetime)",
  "pickup_address": "string"
}
```

**Réponse 201** : demande créée

---

### `GET /pickup-requests/:requestId`
Récupérer une demande de collecte.  
**Auth** : ✅ (tous rôles)

---

### `POST /pickup-requests/:requestId/cancel`
Annuler une demande de collecte.  
**Auth** : ✅ (tous rôles)

---

### `GET /shipments` 🔒 ADMIN
Lister toutes les expéditions.  
**Auth** : ✅ ADMIN

**Query** : `page`, `limit`, `status`

---

### `POST /shipments/:shipmentId/track` 🔒 ADMIN
Ajouter un événement de tracking.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "status": "string",
  "location": "string (optionnel)"
}
```

---

## Méthodes de livraison (Shipping Methods)

### `GET /shipping-methods`
Lister les méthodes de livraison.  
**Auth** : ❌

**Query**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `active` | boolean | `true` pour n'afficher que les actives |

---

### `GET /shipping-methods/:methodId`
Récupérer une méthode de livraison.  
**Auth** : ❌

---

### `POST /shipping-methods/calculate`
Calculer le coût pour une méthode et un poids.  
**Auth** : ❌

**Body**
```json
{
  "shippingMethodId": "string",
  "weight": 2.5
}
```

**Réponse 200**
```json
{
  "shippingMethodId": "string",
  "name": "string",
  "estimatedDays": 3,
  "cost": 12.50,
  "currency": "XAF"
}
```

---

### `POST /shipping-methods` 🔒 ADMIN
Créer une méthode de livraison.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "name": "string (2-100)",
  "description": "string (optionnel)",
  "estimatedDays": 3,
  "basePrice": 1000,
  "pricePerKg": 100,
  "isActive": true,
  "zones": ["CM", "FR"]
}
```

**Réponse 201** : méthode créée

---

### `PATCH /shipping-methods/:methodId` 🔒 ADMIN
Mettre à jour une méthode de livraison.  
**Auth** : ✅ ADMIN

**Body** (tous les champs optionnels, mêmes champs que POST)

---

### `DELETE /shipping-methods/:methodId` 🔒 ADMIN
Supprimer une méthode de livraison.  
**Auth** : ✅ ADMIN

---

## Inventaire

### `GET /inventory`
Lister l'inventaire.  
**Auth** : ✅ (tous rôles)

**Query**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `page` | number | Page |
| `limit` | number | Limite |
| `category` | string | Filtrer par nom de catégorie |
| `location` | string | Filtrer par localisation entrepôt |

**Réponse 200** : réponse paginée  
⚠️ **Breaking change** : retourne un objet paginé, pas un tableau plat.

---

### `GET /inventory/low-stock`
Lister les articles en stock faible.  
**Auth** : ✅ (tous rôles)

**Query**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `threshold` | number | Seuil (défaut: 10) |

---

### `GET /inventory/out-of-stock`
Lister les articles en rupture de stock.  
**Auth** : ✅ (tous rôles)

---

### `GET /inventory/search`
Rechercher dans l'inventaire.  
**Auth** : ✅ (tous rôles)

**Query**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `keyword` | string | Mot-clé (requis) |

---

### `GET /inventory/:item_id`
Récupérer un article d'inventaire.  
**Auth** : ✅ (tous rôles)

**Réponse 200**
```json
{
  "id": "string",
  "productId": 1,
  "variantId": "string | null",
  "warehouseId": "string",
  "quantity": 50,
  "product": { ... },
  "warehouse": { ... },
  "variant": { ... }
}
```

---

### `POST /inventory` 🔒 ADMIN
Créer un article d'inventaire.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "product_id": 1,
  "warehouse_id": "string",
  "variant_id": "string (optionnel)",
  "quantity": 100
}
```

**Réponse 201** : article créé

---

### `PUT /inventory/:item_id` 🔒 ADMIN
Mettre à jour un article d'inventaire.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "quantity": 80,
  "warehouse_id": "string (optionnel)"
}
```

---

### `DELETE /inventory/:item_id` 🔒 ADMIN
Supprimer un article d'inventaire.  
**Auth** : ✅ ADMIN

---

### `POST /inventory/transfer` 🔒 ADMIN
Transférer du stock entre entrepôts.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "item_id": "string",
  "from_warehouse": "string",
  "to_warehouse": "string",
  "quantity": 10
}
```

**Réponse 200**
```json
{
  "item_id": "string",
  "from_warehouse": "string",
  "to_warehouse": "string",
  "quantity": 10
}
```

---

## Entrepôts (Warehouses)

### `GET /warehouses`
Lister les entrepôts.  
**Auth** : ✅ (tous rôles)

---

### `GET /warehouses/:warehouse_id`
Récupérer un entrepôt.  
**Auth** : ✅ (tous rôles)

---

### `GET /warehouses/:warehouse_id/inventory`
Lister l'inventaire d'un entrepôt.  
**Auth** : ✅ (tous rôles)

**Réponse 200**
```json
{
  "warehouse": { "id": "string", "name": "string", "location": "string", "totalUnits": 500 },
  "items": [...]
}
```

---

### `POST /warehouses` 🔒 ADMIN
Créer un entrepôt.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "name": "string (2-100)",
  "location": "string",
  "capacity": 1000
}
```

**Réponse 201** : entrepôt créé

---

### `PUT /warehouses/:warehouse_id` 🔒 ADMIN
Mettre à jour un entrepôt.  
**Auth** : ✅ ADMIN

**Body** (tous les champs optionnels, mêmes champs que POST)

---

### `DELETE /warehouses/:warehouse_id` 🔒 ADMIN
Supprimer un entrepôt.  
**Auth** : ✅ ADMIN

---

## Retours (Returns)

### `GET /returns/:returnId`
Récupérer une demande de retour.  
**Auth** : ✅ (tous rôles)  
⚠️ Un utilisateur ne peut voir que ses propres retours. Un admin voit tout.

---

### `POST /returns`
Créer une demande de retour.  
**Auth** : ✅ (tous rôles)

**Body**
```json
{
  "order_id": "string",
  "reason": "string (min 2)",
  "notes": "string (optionnel)",
  "items": [
    {
      "order_item_id": "string",
      "quantity": 1,
      "condition": "string (optionnel)"
    }
  ]
}
```

**Réponse 201** : demande de retour créée

---

### `GET /orders/:orderId/returns`
Lister les retours d'une commande.  
**Auth** : ✅ (tous rôles)

---

### `GET /returns` 🔒 ADMIN
Lister toutes les demandes de retour.  
**Auth** : ✅ ADMIN

**Query** : `page`, `limit`, `status`

---

### `PUT /returns/:returnId/status` 🔒 ADMIN
Mettre à jour le statut d'un retour.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "status": "PENDING | APPROVED | REJECTED | COMPLETED",
  "notes": "string (optionnel)"
}
```

---

## Programme de fidélité (Loyalty)

### `GET /loyalty/:userId/balance`
Récupérer le solde de points d'un utilisateur.  
**Auth** : ✅ (tous rôles)

**Réponse 200**
```json
{ "userId": 1, "balance": 350 }
```

---

### `GET /loyalty/:userId/history`
Historique des transactions de points.  
**Auth** : ✅ (tous rôles)

**Réponse 200**
```json
[
  {
    "id": "string",
    "points": 100,
    "type": "EARNED | REDEEMED | EXPIRED | ADJUSTED",
    "orderId": "string | null",
    "createdAt": "datetime"
  }
]
```

---

### `POST /loyalty/adjust` 🔒 ADMIN
Ajuster manuellement les points d'un utilisateur.  
**Auth** : ✅ ADMIN

**Body**
```json
{
  "userId": 1,
  "points": 100,
  "type": "EARNED | REDEEMED | EXPIRED | ADJUSTED",
  "orderId": "string (optionnel)"
}
```

⚠️ `points` ne peut pas être `0`. Pour un débit, utiliser un nombre négatif avec `type: "REDEEMED"`.

**Réponse 201** : transaction créée

---

## Dashboard 🔒 ADMIN

### `GET /dashboard/stats` 🔒 ADMIN
Récupérer les statistiques globales.  
**Auth** : ✅ ADMIN

**Réponse 200**
```json
{
  "products": { "total": 120, "addedThisMonth": 5 },
  "orders": { "total": 450, "thisMonth": 32, "trend": 12 },
  "users": { "total": 200, "active": 200 },
  "payments": { "totalAmountThisMonth": 1500000, "currency": "XAF", "trend": 8 },
  "inventory": { "lowStockCount": 3 },
  "shipments": { "inProgress": 12, "trend": -5 },
  "promotions": {
    "active": 2,
    "couponUsageThisMonth": 45,
    "revenueFromCouponsThisMonth": 250000,
    "currency": "XAF"
  }
}
```

> `trend` = variation en % par rapport au mois précédent

---

### `GET /dashboard/sales-chart` 🔒 ADMIN
Données du graphique de ventes.  
**Auth** : ✅ ADMIN

**Query**
| Paramètre | Type | Description |
|-----------|------|-------------|
| `year` | number | Année (défaut: année courante) |
| `period` | string | `monthly` (défaut) |

**Réponse 200**
```json
{
  "period": "monthly",
  "year": 2026,
  "currency": "XAF",
  "points": [
    { "label": "Jan", "amount": 500000, "orderCount": 12 },
    { "label": "Fév", "amount": 750000, "orderCount": 18 },
    ...
  ]
}
```

---

## Codes d'erreur HTTP

| Code | Signification |
|------|--------------|
| `400` | Données invalides / validation échouée |
| `401` | Token manquant ou invalide |
| `403` | Accès refusé (rôle insuffisant) |
| `404` | Ressource introuvable |
| `409` | Conflit (doublon) |
| `429` | Trop de requêtes (rate limit : 100 req / 15 min) |
| `500` | Erreur interne serveur |
| `503` | Service temporairement indisponible |