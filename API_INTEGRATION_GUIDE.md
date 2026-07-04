# API Integration Guide — E-Commerce API

> Document destiné au développement frontend (dashboard admin + section client). Décrit chaque module avec ses interfaces TypeScript, ses conventions d'appel, et les points d'attention pour l'intégration. Complète `API_ROUTES.MD` (référence exhaustive des routes) sans le dupliquer.

## Sommaire

1. Conventions générales
2. Auth
3. Users
4. Products
5. Attributes
6. Combinations (variantes)
7. Tags
8. Categories
9. Basket
10. Wishlist
11. Orders
12. Payments
13. Reviews
14. Warehouses
15. Inventory
16. Shipments & Pickup Requests
17. Shipping Methods
18. Addresses
19. Promotions, Discounts & Coupons
20. Loyalty
21. Returns
22. Dashboard
23. Gestion des erreurs — pattern recommandé côté frontend

---

## 1. Conventions générales

### Base URL & headers

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL; // exposé via Cloudflare Tunnel en dev

const headers = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token && { Authorization: `Bearer ${token}` }),
});
```

### Enveloppe de réponse

```ts
interface ApiSuccess<T> {
  status: true;
  data: T;
}

interface ApiError {
  status: false;
  error: { message: string; details?: unknown };
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

### Pagination

Toutes les listes paginées suivent la même forme :

```ts
interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### Devise

Tous les montants numériques (`price`, `amount`, `totalAmount`, etc.) sont en **XAF**, sans sous-unité décimale significative côté UI (afficher tel quel, pas de division par 100).

### Dates

Toutes les dates sont des chaînes ISO 8601 (`Date.toISOString()`), sauf mention contraire.

---

## 2. Auth

```ts
interface SignupRequest {
  username: string; // 3-50
  email: string;
  password: string; // min 6
  firstName: string; // 2-50
  lastName: string; // 2-50
  dateOfBirth?: string; // ISO
  phone?: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

interface AuthResponse {
  user: PublicUser; // jamais de champ password
  token: string; // JWT — à stocker (localStorage / cookie httpOnly selon stratégie front)
}

interface PublicUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  phone: string | null;
  role: "USER" | "ADMIN" | "MANAGER" | "SUPPORT";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

`POST /signup`, `POST /login` → `AuthResponse`.

**Point d'attention front** : `POST /login` peut renvoyer `403` si le compte est désactivé — **soit manuellement par un admin, soit automatiquement après 5 échecs de mot de passe en 15 min**. Le message est identique dans les deux cas (`"This account has been deactivated."`) : ne pas tenter de distinguer ces deux cas côté UI, afficher un message générique invitant à contacter le support.

---

## 3. Users

```ts
interface UpdateProfileRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phone?: string;
}

interface ChangeRoleRequest {
  role: "USER" | "ADMIN" | "MANAGER" | "SUPPORT";
}

interface AdminCreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phone?: string;
  role?: PublicUser["role"]; // défaut USER
}

interface ChangeStatusRequest {
  isActive: boolean;
}
```

| Action                    | Appel                                                      |
| ------------------------- | ---------------------------------------------------------- |
| Profil courant            | `GET /user` → `PublicUser`                                 |
| Mise à jour profil        | `PATCH /user` `UpdateProfileRequest` → `PublicUser`        |
| Liste admin               | `GET /user/all` → `PublicUser[]`                           |
| Détail admin              | `GET /user/:userId` → `PublicUser`                         |
| Création admin            | `POST /user` `AdminCreateUserRequest` → `PublicUser` (201) |
| Changement de rôle        | `PATCH /user/change-role/:userId` `ChangeRoleRequest`      |
| Suspension/réactivation   | `PATCH /user/:userId/status` `ChangeStatusRequest`         |
| Suppression (soft delete) | `DELETE /user/:userId` → `{ numberOfUsersDeleted: 1 }`     |

**Point d'attention front (dashboard admin)** :

- Sur l'écran de gestion des utilisateurs, **désactiver le bouton "Supprimer" pour le compte de l'admin actuellement connecté** — l'API renvoie `400` sinon (`"You cannot delete your own account"`).
- Un bouton "Suspendre" / "Réactiver" (toggle sur `isActive`) doit appeler `PATCH /user/:userId/status`, distinct du bouton "Supprimer" (`DELETE`, qui pose aussi `deletedAt` — irréversible via l'API).
- Un compte listé dans `GET /user/all` avec `isActive: false` peut soit être suspendu manuellement, soit avoir été verrouillé automatiquement (brute-force) — l'API ne distingue pas les deux dans la donnée elle-même ; envisager un log d'audit séparé si cette distinction est nécessaire côté UI.

---

## 4. Products

```ts
interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  categoryId: string;
  category: { id: string; name: string; slug: string };
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  weight: number;
  brand: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  images: ProductImage[];
  combinations: ProductCombination[]; // actives uniquement
  attributeValues: ProductAttributeValue[]; // attributs produit (isVariant:false)
  attributeSelections: ProductAttributeSelection[]; // sélections d'options pour variantes
  pricing: PricingInfo;
  createdAt: string;
  updatedAt: string;
}

interface PricingInfo {
  originalPrice: number;
  finalPrice: number;
  discountAmount: number;
  discountPercentage: number | null;
  hasDiscount: boolean;
  promotionId: string | null;
  discountId: string | null;
}

interface ProductImage {
  id: string;
  productId: number;
  combinationId: string | null;
  url: string;
  altText: string | null;
  position: number;
  isPrimary: boolean;
}

interface CreateProductRequest {
  sku: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED"; // toujours forcé à DRAFT côté serveur
  weight: number;
}

type UpdateProductRequest = Partial<Omit<CreateProductRequest, "categoryId">>;
```

| Action                    | Appel                                                                           |
| ------------------------- | ------------------------------------------------------------------------------- |
| Liste (avec pricing)      | `GET /product?page&limit&categoryId&search` → `Paginated<Product>`              |
| Détail                    | `GET /product/:productId` → `Product`                                           |
| Création                  | `POST /product` `CreateProductRequest` → `Product` (201, `status:DRAFT`)        |
| Mise à jour               | `PATCH /product/:productId` `UpdateProductRequest` → `Product`                  |
| Suppression (soft delete) | `DELETE /product/:productId` → `{ numberOfProductsDeleted: 1 }`                 |
| Upload images             | `POST /product/:productId/images` (multipart, champ `images`, `combinationId?`) |
| Suppression image         | `DELETE /product/:productId/images` `{ imageId }`                               |

**Point d'attention front** : `categoryId` ne peut jamais être modifié après création — le champ doit être en lecture seule sur l'écran d'édition. Le passage à `status: ACTIVE` peut échouer avec 400 si des attributs produit requis manquent — afficher le message d'erreur retourné (il liste les attributs manquants par nom).

---

## 5. Attributes

```ts
interface AttributeDefinition {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  type: "TEXT" | "NUMBER" | "COLOR" | "BOOLEAN" | "SELECT";
  unit: string | null;
  isVariant: boolean; // détermine le chemin d'intégration — voir §6
  isFilterable: boolean;
  isRequired: boolean;
  position: number;
  options: AttributeOption[];
}

interface AttributeOption {
  id: string;
  attributeDefinitionId: string;
  value: string;
  colorHex: string | null;
  position: number;
}

interface CreateAttributeDefinitionRequest {
  name: string;
  slug: string;
  type: AttributeDefinition["type"];
  unit?: string;
  isVariant?: boolean;
  isFilterable?: boolean;
  isRequired?: boolean;
  position?: number;
}

interface SetProductAttributesRequest {
  attributes: { attributeDefinitionId: string; value: string }[];
}
```

| Action                                   | Appel                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| Attributs d'une catégorie                | `GET /categories/:categoryId/attributes` → `AttributeDefinition[]`           |
| Création                                 | `POST /categories/:categoryId/attributes` `CreateAttributeDefinitionRequest` |
| Détail                                   | `GET /attributes/:definitionId` → `AttributeDefinition`                      |
| Mise à jour                              | `PATCH /attributes/:definitionId` (body partiel)                             |
| Suppression                              | `DELETE /attributes/:definitionId`                                           |
| Ajout d'option                           | `POST /attributes/:definitionId/options` `{ value, colorHex?, position? }`   |
| Mise à jour option                       | `PATCH /attributes/options/:optionId`                                        |
| Suppression option                       | `DELETE /attributes/options/:optionId`                                       |
| Valeurs produit (attributs non-variante) | `PUT /product/:productId/attributes` `SetProductAttributesRequest`           |

**⚠️ Point critique frontend** : le champ `isVariant` détermine **totalement** quel flux utiliser pour un attribut donné :

- `isVariant: false` → interface "Attributs produit" (formulaire clé-valeur libre) → `PUT /product/:productId/attributes`.
- `isVariant: true` → interface "Variantes" (sélection d'options prédéfinies) → voir §6, jamais via cette route (elle rejette avec 400 si on essaie).

Le formulaire d'édition produit doit donc séparer visuellement ces deux catégories d'attributs dès le chargement de `AttributeDefinition[]`.

---

## 6. Combinations (système de variantes)

Modèle en 3 étapes : **sélection d'options par attribut** → **génération du produit cartésien** → **combinaisons individuelles éditables**.

```ts
interface ProductAttributeSelection {
  id: string;
  productId: number;
  attributeDefinitionId: string;
  attributeDefinition: { id: string; name: string; slug: string };
  attributeOptionId: string;
  attributeOption: { id: string; value: string; colorHex: string | null };
}

interface ProductCombination {
  id: string;
  productId: number;
  optionsKey: string; // clé interne, non affichée
  sku: string | null;
  price: number | null; // null → hérite du prix du produit parent
  isActive: boolean;
  values: {
    attributeDefinition: { id: string; name: string; slug: string };
    attributeOption: { id: string; value: string; colorHex: string | null };
  }[];
  inventory: { quantity: number; warehouseId: string }[];
  images: ProductImage[];
}

interface SetVariantOptionsRequest {
  optionIds: string[]; // options DISPONIBLES pour cet attribut sur ce produit
}

interface UpdateCombinationRequest {
  sku?: string;
  price?: number;
  isActive?: boolean;
}
```

**Workflow d'intégration recommandé (écran admin "Variantes produit")** :

```ts
// 1. Pour chaque attribut isVariant:true de la catégorie du produit,
//    l'admin choisit les options disponibles POUR CE PRODUIT.
await api.put(
  `/product/${productId}/combinations/selections/${attributeDefinitionId}`,
  { optionIds: selectedOptionIds } satisfies SetVariantOptionsRequest,
);

// 2. Une fois toutes les sélections faites, générer le produit cartésien.
const combinations = await api.post(
  `/product/${productId}/combinations/generate`,
); // → ProductCombination[] (actives ET inactives)

// 3. Ajuster individuellement chaque combinaison (prix, SKU, désactivation).
await api.patch(`/product/${productId}/combinations/${combinationId}`, {
  isActive: false,
} satisfies UpdateCombinationRequest);
```

**Points d'attention** :

- Relancer `generate()` après une modification de sélection **désactive automatiquement** (sans les supprimer) les combinaisons qui ne correspondent plus — prévenir l'admin que c'est non destructif mais que les combinaisons disparaîtront du catalogue public.
- `DELETE .../combinations/:combinationId` échoue avec 400 si de l'inventaire existe encore — rediriger l'admin vers l'écran de gestion de stock avant de permettre la suppression définitive.
- Côté panier/commande/wishlist, `combinationId` (optionnel) remplace l'ancien `variantId` — voir §9-11.

---

## 7. Tags

```ts
interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface CreateTagRequest {
  name: string; // 2-50
  slug: string; // 2-50, kebab-case
}

interface SetProductTagsRequest {
  tagIds: string[]; // min 1
}
```

| Action                 | Appel                                                                           |
| ---------------------- | ------------------------------------------------------------------------------- |
| Liste                  | `GET /tags` → `Tag[]`                                                           |
| Détail (avec produits) | `GET /tags/:tagId`                                                              |
| Création (admin)       | `POST /tags` `CreateTagRequest`                                                 |
| Mise à jour (admin)    | `PATCH /tags/:tagId`                                                            |
| Suppression (admin)    | `DELETE /tags/:tagId`                                                           |
| Assigner à un produit  | `PUT /product/:productId/tags` `SetProductTagsRequest` (remplace tous les tags) |
| Tags d'un produit      | `GET /product/:productId/tags`                                                  |

---

## 8. Categories

```ts
interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isActive: boolean;
  parentId: string | null;
  parent: { id: string; name: string; slug: string } | null;
  children: { id: string; name: string; slug: string }[];
  _count: { products: number };
}

interface CreateCategoryRequest {
  name: string; // 2-100
  slug: string; // kebab-case
  description?: string;
  imageUrl?: string;
  iconUrl?: string;
  metaTitle?: string; // max 70
  metaDescription?: string; // max 160
  isActive?: boolean; // défaut true
  parentId?: string;
}
```

| Action                       | Appel                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Liste publique               | `GET /categories` → `Category[]` (uniquement `isActive:true`)                  |
| Liste admin (avec inactives) | `GET /categories?includeInactive=true` (nécessite un JWT ADMIN — sinon ignoré) |
| Détail admin                 | `GET /categories/:categoryId` (retourne même si inactive)                      |
| Détail public par slug       | `GET /categories/slug/:slug` (**404 si inactive**)                             |
| Produits par slug            | `GET /categories/slug/:slug/products?page&limit` (**404 si inactive**)         |
| Création (admin)             | `POST /categories` `CreateCategoryRequest`                                     |
| Mise à jour (admin)          | `PUT /categories/:categoryId`                                                  |
| Suppression (admin)          | `DELETE /categories/:categoryId` (**400** si `_count.products > 0`)            |

**Point d'attention front** : sur le site public (section client), utiliser systématiquement les routes par slug — elles renvoient nativement 404 pour une catégorie désactivée, pas besoin de filtrer `isActive` côté client. Sur le dashboard admin, `GET /categories?includeInactive=true` permet de voir/gérer les catégories désactivées, avec un indicateur visuel (`isActive: false`) sur chaque ligne.

---

## 9. Basket

```ts
interface Basket {
  id: string;
  userId: number;
  items: BasketItem[];
  createdAt: string;
  updatedAt: string;
}

interface BasketItem {
  id: string;
  basketId: string;
  productId: number;
  product: Product;
  combinationId: string | null;
  combination: ProductCombination | null;
  quantity: number;
}

interface AddProductRequest {
  product_id: number;
  combination_id?: string;
  quantity: number;
}

interface UpdateQuantityRequest {
  product_id: number;
  combination_id?: string;
  quantity: number;
}

interface RemoveProductRequest {
  product_id: number;
  combination_id?: string;
}
```

| Action                        | Appel                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Panier unique (get-or-create) | `GET /user/basket` → `Basket`                                                |
| Nouveau panier (historique)   | `POST /basket` → `Basket` (201)                                              |
| Détail                        | `GET /basket/:basket_id` → `Basket`                                          |
| Ajouter un produit            | `POST /basket/:basket_id/product` `AddProductRequest` → `Basket`             |
| Modifier la quantité          | `PUT /basket/:basket_id/product/quantity` `UpdateQuantityRequest` → `Basket` |
| Retirer un produit            | `DELETE /basket/:basket_id/product` `RemoveProductRequest` → `Basket`        |

**Recommandation front** : privilégier `GET /user/basket` (get-or-create implicite) pour le panier principal de la section client, et réserver `POST /basket` aux cas nécessitant plusieurs paniers simultanés (rare).

---

## 10. Wishlist

```ts
interface Wishlist {
  id: string;
  userId: number;
  items: WishlistItem[];
}

interface WishlistItem {
  id: string;
  productId: number;
  product: {
    id: number;
    name: string;
    price: number;
    images: { url: string }[];
  };
  combinationId: string | null;
  combination: { id: string; sku: string | null; price: number | null } | null;
  addedAt: string;
}

interface AddWishlistItemRequest {
  product_id: number;
  combination_id?: string;
}
```

| Action    | Appel                                                           |
| --------- | --------------------------------------------------------------- |
| Consulter | `GET /wishlist` → `Wishlist` (créée automatiquement si absente) |
| Ajouter   | `POST /wishlist/items` `AddWishlistItemRequest`                 |
| Retirer   | `DELETE /wishlist/items` `{ product_id, combination_id? }`      |

---

## 11. Orders

```ts
interface Order {
  id: string;
  userId: number;
  status:
    | "PENDING"
    | "CONFIRMED"
    | "PROCESSING"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED"
    | "REFUNDED";
  shippingAddressSnapshot: Address;
  billingAddressSnapshot: Address | null;
  shippingMethod: { id: string; name: string; estimatedDays: number } | null;
  notes: string | null;
  appliedCoupon: {
    id: string;
    code: string;
    promotion: { id: string; name: string; slug: string };
  } | null;
  totalAmount: number;
  discountedAmount: number | null;
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

interface OrderItem {
  id: string;
  productId: number;
  product: { id: number; name: string; sku: string };
  combinationId: string | null;
  combinationSnapshot: Record<string, string> | null; // ex: { "Taille": "M", "Couleur": "Orange" }
  combination: ProductCombination | null;
  quantity: number;
  price: number; // prix final unitaire (après remise)
  originalPrice: number;
  discountAmount: number;
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
  }[];
}

interface OrderStatusHistory {
  id: string;
  fromStatus: Order["status"] | null;
  toStatus: Order["status"];
  changedBy: number | null;
  reason: string | null;
  createdAt: string;
}

interface Address {
  street: string;
  city: string;
  state?: string;
  country: string;
  postalCode: string;
}

interface CreateOrderRequest {
  items?: { id: string; combinationId?: string; quantity: number }[]; // productId en string
  basketId?: string; // alternative à items
  shippingAddressId?: string;
  shippingAddress: Address;
  billingAddressId?: string;
  billingAddress?: Address;
  shippingMethodId?: string;
  paymentMethodId?: string;
  notes?: string;
  couponCode?: string;
}

interface UpdateOrderStatusRequest {
  status: Order["status"];
  reason?: string;
  shippingCarrier?: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: string;
}
```

| Action                             | Appel                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------- |
| Liste                              | `GET /orders?page&limit&status&customer` → `Paginated<Order>`             |
| Création                           | `POST /orders` `CreateOrderRequest` → `Order` (201)                       |
| Détail                             | `GET /orders/:orderId` → `Order`                                          |
| Mise à jour (adresses/notes)       | `PUT /orders/:orderId` (body partiel)                                     |
| Annulation                         | `DELETE /orders/:orderId` → `{ message: "Order cancelled successfully" }` |
| Changement de statut (admin)       | `PUT /orders/:orderId/status` `UpdateOrderStatusRequest`                  |
| Commandes d'un utilisateur (admin) | `GET /user/:userId/orders?page&limit` → `Paginated<Order>`                |

**Points d'attention front** :

- Toujours envoyer `items[].id` comme **string** représentant le `productId` (pas un `basketItemId`).
- `combinationSnapshot` sur chaque `OrderItem` est la source fiable pour afficher les caractéristiques achetées (taille, couleur...) dans l'historique — reste correct même si l'attribut/option source a été renommé ou supprimé depuis. Préférer `combinationSnapshot` à `combination.values` pour l'affichage de l'historique de commande.
- Un échec de stock retourne soit `400` (stock global insuffisant, message explicite avec quantité disponible/demandée), soit `409` (rare — stock pris entre vérification et réservation, la commande n'est pas créée).
- `statusHistory` est limité aux 10 dernières entrées côté API.

---

## 12. Payments

```ts
interface PaymentMethodInfo {
  id: "CASH_ON_DELIVERY" | "PAYPAL" | "STRIPE" | "CINETPAY";
  name: string;
  description: string;
  available: boolean;
  message?: string; // présent si available:false
}

interface Payment {
  id: string;
  orderId: string;
  order: Order;
  userId: number;
  user: {
    id: number;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  method: PaymentMethodInfo["id"];
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" | "CANCELLED";
  amount: number;
  currency: "XAF";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreatePaymentRequest {
  order_id: string;
  method: PaymentMethodInfo["id"];
  currency?: string; // défaut XAF
  notes?: string;
}

interface UpdatePaymentStatusRequest {
  status: Payment["status"];
  notes?: string;
}
```

| Action                    | Appel                                                                             |
| ------------------------- | --------------------------------------------------------------------------------- |
| Méthodes disponibles      | `GET /payment-methods` → `PaymentMethodInfo[]`                                    |
| Créer un paiement         | `POST /payments` `CreatePaymentRequest` → `Payment` (201, ou 503 si indisponible) |
| Détail                    | `GET /payments/:payment_id` → `Payment`                                           |
| Paiements d'une commande  | `GET /orders/:orderId/payments` → `Payment[]`                                     |
| Liste (admin)             | `GET /payments?page&limit&status&method&order_id` → `Paginated<Payment>`          |
| Changer le statut (admin) | `PUT /payments/:payment_id/status` `UpdatePaymentStatusRequest`                   |

**Point d'attention front** : seul `CASH_ON_DELIVERY` a `available: true` actuellement — griser les autres options de paiement dans le formulaire de checkout en utilisant directement le champ `available` retourné par `GET /payment-methods` plutôt qu'une liste codée en dur côté client, pour rester synchronisé si de nouveaux moyens de paiement sont activés côté API sans redéploiement frontend.

---

## 13. Reviews

```ts
interface Review {
  id: string;
  orderItemId: string;
  productId: number;
  userId: number;
  user: { id: number; username: string; firstName: string; lastName: string };
  rating: number; // 1-5
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProductReviewsResponse {
  product_id: number;
  average_rating: number;
  total_reviews: number;
  reviews: Review[];
}

interface CreateReviewRequest {
  order_item_id: string;
  product_id: number;
  rating: number; // 1-5
  comment?: string;
}
```

| Action      | Appel                                                          |
| ----------- | -------------------------------------------------------------- |
| Par produit | `GET /products/:pid/reviews` → `ProductReviewsResponse`        |
| Détail      | `GET /reviews/:rid` → `Review`                                 |
| Création    | `POST /reviews` `CreateReviewRequest` → `Review` (201)         |
| Mise à jour | `PUT /reviews/:rid` `{ rating?, comment? }` (owner uniquement) |
| Suppression | `DELETE /reviews/:rid` (owner uniquement)                      |

Un avis est lié à un `orderItemId` précis (achat vérifié) — un produit acheté plusieurs fois (commandes distinctes) peut recevoir plusieurs avis du même utilisateur.

---

## 14. Warehouses

```ts
interface Warehouse {
  id: string;
  name: string;
  location: string;
  capacity: number | null;
  createdAt: string;
  updatedAt: string;
}

interface WarehouseInventoryResponse {
  warehouse: Warehouse & { totalUnits: number };
  items: InventoryItem[];
}

interface CreateWarehouseRequest {
  name: string; // 2-100
  location: string;
  capacity?: number;
}
```

| Action                   | Appel                                                                        |
| ------------------------ | ---------------------------------------------------------------------------- |
| Liste                    | `GET /warehouses` → `Warehouse[]`                                            |
| Détail                   | `GET /warehouses/:warehouse_id` → `Warehouse`                                |
| Inventaire d'un entrepôt | `GET /warehouses/:warehouse_id/inventory` → `WarehouseInventoryResponse`     |
| Création (admin)         | `POST /warehouses` `CreateWarehouseRequest`                                  |
| Mise à jour (admin)      | `PUT /warehouses/:warehouse_id` (body partiel)                               |
| Suppression (admin)      | `DELETE /warehouses/:warehouse_id` (**400** si du stock actif existe encore) |

**Point d'attention front** : gérer explicitement le cas `400` sur la suppression — le message précise le nombre d'articles en stock restants, à afficher tel quel plutôt qu'un message générique.

---

## 15. Inventory

```ts
interface InventoryItem {
  id: string;
  productId: number;
  product: Product;
  combinationId: string | null;
  combination: ProductCombination | null;
  warehouseId: string;
  warehouse: Warehouse;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateInventoryRequest {
  product_id: number;
  warehouse_id: string;
  combination_id?: string;
  quantity?: number; // défaut 0
}

interface TransferInventoryRequest {
  item_id: string;
  from_warehouse: string;
  to_warehouse: string;
  quantity: number;
}
```

| Action              | Appel                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| Liste               | `GET /inventory?page&limit&category&location` → `Paginated<InventoryItem>` |
| Stock faible        | `GET /inventory/low-stock?threshold` → `InventoryItem[]`                   |
| Rupture de stock    | `GET /inventory/out-of-stock` → `InventoryItem[]`                          |
| Recherche           | `GET /inventory/search?keyword` (⚠️ `keyword` requis, sinon 500)           |
| Détail              | `GET /inventory/:item_id` → `InventoryItem`                                |
| Création (admin)    | `POST /inventory` `CreateInventoryRequest` (201, ou 409 si doublon)        |
| Mise à jour (admin) | `PUT /inventory/:item_id` `{ quantity?, warehouse_id? }`                   |
| Suppression (admin) | `DELETE /inventory/:item_id`                                               |
| Transfert (admin)   | `POST /inventory/transfer` `TransferInventoryRequest`                      |

**Point d'attention front** : toujours envoyer un `keyword` non vide sur `/inventory/search`, sinon l'API renvoie une 500 non structurée (pas un message JSON exploitable de la même forme que les autres erreurs) — valider côté client avant l'appel.

---

## 16. Shipments & Pickup Requests

```ts
interface Shipment {
  id: string;
  orderId: string | null;
  senderName: string;
  senderAddress: string;
  recipientName: string;
  recipientAddress: string;
  weight: number;
  dimensions: { length: number; width: number; height: number } | null;
  status: "PENDING" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
  trackingNumber: string | null;
  estimatedDeliveryDate: string | null;
  trackingEvents: TrackingEvent[];
  label: { id: string; labelUrl: string } | null;
}

interface TrackingEvent {
  id: string;
  status: string; // texte libre
  location: string | null;
  createdAt: string;
}

interface TrackingResponse {
  current_status: Shipment["status"];
  current_location: string | null;
  updates: TrackingEvent[];
}

interface CreateShipmentRequest {
  sender_name: string;
  sender_address: string;
  recipient_name: string;
  recipient_address: string;
  weight: number;
  dimensions?: { length: number; width: number; height: number };
  order_id?: string;
  estimated_delivery_at?: string;
}

interface TrackingEventRequest {
  status: string; // texte libre affiché dans l'historique
  location?: string;
  shipment_status?: Shipment["status"]; // optionnel — met AUSSI à jour le statut officiel
}

interface UpdateShipmentStatusRequest {
  status: Shipment["status"];
  reason?: string;
}

interface PickupRequest {
  id: string;
  userId: number;
  orderId: string | null;
  shipmentId: string | null;
  pickupDate: string;
  pickupAddress: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  createdAt: string;
}

interface CreatePickupRequestRequest {
  pickup_date: string; // ISO
  pickup_address: string;
  order_id?: string;
  shipment_id?: string;
}
```

| Action                             | Appel                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------- |
| Calculer un coût                   | `POST /shipments/cost` `{ origin, destination, weight, dimensions? }`  |
| Création (admin)                   | `POST /shipments` `CreateShipmentRequest` → `Shipment` (201)           |
| Détail                             | `GET /shipments/:shipmentId` → `Shipment`                              |
| Liste (admin)                      | `GET /shipments?page&limit&status&order_id` → `Paginated<Shipment>`    |
| Ajouter un événement de suivi      | `POST /shipments/:shipmentId/track` `TrackingEventRequest`             |
| Consulter le suivi                 | `GET /shipments/:shipmentId/track` → `TrackingResponse`                |
| Changer le statut officiel (admin) | `PUT /shipments/:shipmentId/status` `UpdateShipmentStatusRequest`      |
| Annuler                            | `POST /shipments/:shipmentId/cancel`                                   |
| Étiquette                          | `GET /labels/:shipmentId` → `{ label_id, label_url }`                  |
| Créer une demande de collecte      | `POST /pickup-requests` `CreatePickupRequestRequest` → `PickupRequest` |
| Liste des collectes (admin)        | `GET /pickup-requests?page&limit&status`                               |
| Détail collecte                    | `GET /pickup-requests/:requestId`                                      |
| Annuler une collecte               | `POST /pickup-requests/:requestId/cancel` (owner uniquement)           |
| Expédition d'une commande          | `GET /orders/:orderId/shipment` → `Shipment \| null`                   |

**⚠️ Distinction importante côté UI** : ne pas confondre `POST /shipments/:shipmentId/track` (ajout d'un événement d'historique, `status` en texte libre) avec `PUT /shipments/:shipmentId/status` (transition officielle du statut, enum strict). Le premier peut optionnellement déclencher le second via `shipment_status`, mais ce sont deux actions différentes dans l'UI — typiquement deux boutons distincts ("Ajouter une mise à jour" vs "Changer le statut").

**Point d'attention** : une annulation de commande ou d'expédition annule automatiquement les collectes `PENDING` liées — rafraîchir l'écran de collecte après une annulation de commande/expédition plutôt que de se fier à un état local potentiellement obsolète.

---

## 17. Shipping Methods

```ts
interface ShippingMethod {
  id: string;
  name: string;
  description: string | null;
  estimatedDays: number;
  basePrice: number;
  pricePerKg: number;
  isActive: boolean;
  zones: string[]; // codes pays 2 lettres
}

interface CalculateShippingRequest {
  shippingMethodId: string;
  weight: number;
}

interface CalculateShippingResponse {
  shippingMethodId: string;
  name: string;
  estimatedDays: number;
  cost: number;
  currency: "XAF";
}
```

| Action              | Appel                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Liste               | `GET /shipping-methods?active` → `ShippingMethod[]`                                         |
| Détail              | `GET /shipping-methods/:methodId` → `ShippingMethod`                                        |
| Création (admin)    | `POST /shipping-methods` (body : tous les champs sauf `id`)                                 |
| Mise à jour (admin) | `PATCH /shipping-methods/:methodId` (body partiel)                                          |
| Suppression (admin) | `DELETE /shipping-methods/:methodId`                                                        |
| Calcul de coût      | `POST /shipping-methods/calculate` `CalculateShippingRequest` → `CalculateShippingResponse` |

---

## 18. Addresses

```ts
interface UserAddress {
  id: string;
  userId: number;
  street: string;
  city: string;
  state: string | null;
  country: string;
  postalCode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ValidateAddressRequest {
  street: string;
  city: string;
  state?: string;
  country: string;
  postal_code: string;
}

interface ValidateAddressResponse {
  valid: boolean;
  normalized_address: {
    street: string;
    city: string;
    state: string | null;
    country: string;
    postal_code: string;
  } | null;
}

interface CreateAddressRequest {
  street: string;
  city: string;
  state?: string;
  country: string;
  postalCode: string;
  isDefault?: boolean; // défaut false
}
```

| Action              | Appel                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| Validation (public) | `POST /address/validate` `ValidateAddressRequest` → `ValidateAddressResponse` |
| Liste               | `GET /addresses` → `UserAddress[]`                                            |
| Détail              | `GET /addresses/:addressId` → `UserAddress` (owner uniquement)                |
| Création            | `POST /addresses` `CreateAddressRequest` → `UserAddress` (201)                |
| Mise à jour         | `PATCH /addresses/:addressId` (body partiel, owner uniquement)                |
| Suppression         | `DELETE /addresses/:addressId` (owner uniquement)                             |

**Point d'attention front** : `POST /address/validate` utilise une liste de pays supportés codée en dur côté serveur (pas un service de géocodage externe) — utile pour un formulaire de saisie guidée, mais ne pas présenter le résultat comme une validation postale réelle à l'utilisateur.

---

## 19. Promotions, Discounts & Coupons

```ts
interface Promotion {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  images: string[];
  status: "SCHEDULED" | "ACTIVE" | "EXPIRED" | "CANCELLED"; // calculé à la lecture, voir note
  isActive: boolean;
  startDate: string;
  endDate: string;
  discounts: Discount[];
  coupons: CouponSummary[];
  _count: { coupons: number; discounts: number };
}

interface Discount {
  id: string;
  promotionId: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
  products: {
    product: { id: number; name: string; images: string[]; price: number };
  }[];
}

interface CouponSummary {
  id: string;
  code: string;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean; // intention admin stockée
  effectiveIsActive?: boolean; // présent uniquement sur GET .../coupons — statut réel calculé
}

interface CreatePromotionRequest {
  name: string; // 2-200
  slug: string; // kebab-case
  description?: string;
  startDate: string; // ISO
  endDate: string; // ISO, > startDate
  isActive?: boolean;
}

interface CreateDiscountRequest {
  type: Discount["type"];
  value: number;
  categoryId?: string;
  productIds?: number[]; // categoryId OU productIds requis
}

interface CreateCouponRequest {
  code: string; // 3-50, auto-uppercase
  maxUses?: number;
  perUserLimit?: number; // défaut 1
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

interface ValidateCouponRequest {
  code: string;
  basketId?: string;
}

interface ValidateCouponResponse {
  valid: true;
  couponId: string;
  code: string;
  promotion: { id: string; name: string; slug: string };
  discounts: Discount[];
}
```

| Action                          | Appel                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Page publique par slug          | `GET /promotions/slug/:slug` → `Promotion`                                            |
| Valider un coupon               | `POST /coupons/validate` `ValidateCouponRequest` → `ValidateCouponResponse`           |
| Liste (admin)                   | `GET /promotions?status&isActive` → `Promotion[]`                                     |
| Détail (admin)                  | `GET /promotions/:promotionId` → `Promotion`                                          |
| Création (admin)                | `POST /promotions` `CreatePromotionRequest`                                           |
| Mise à jour (admin)             | `PUT /promotions/:promotionId`                                                        |
| Bascule isActive (admin)        | `PATCH /promotions/:promotionId/toggle`                                               |
| Suppression (admin)             | `DELETE /promotions/:promotionId`                                                     |
| Upload images (admin)           | `POST /promotions/:promotionId/images` (multipart)                                    |
| Suppression image (admin)       | `DELETE /promotions/:promotionId/images` `{ imageUrl }`                               |
| Créer une remise (admin)        | `POST /promotions/:promotionId/discounts` `CreateDiscountRequest`                     |
| Supprimer une remise (admin)    | `DELETE /promotions/:promotionId/discounts/:discountId`                               |
| Coupons d'une promotion (admin) | `GET /promotions/:promotionId/coupons` → `CouponSummary[]` (avec `effectiveIsActive`) |
| Créer un coupon (admin)         | `POST /promotions/:promotionId/coupons` `CreateCouponRequest`                         |
| Supprimer un coupon (admin)     | `DELETE /promotions/:promotionId/coupons/:couponId`                                   |

**⚠️ Note importante sur `status`** : ce champ est **recalculé à chaque lecture** à partir de `isActive` + dates (`SCHEDULED` avant `startDate`, `ACTIVE` entre les deux, `EXPIRED` après `endDate` — sauf si `status: CANCELLED` a été posé manuellement, auquel cas il reste figé). Ne pas mettre ce champ en cache local trop longtemps côté dashboard — recharger la promotion après une action qui pourrait faire évoluer son statut effectif (typiquement, simplement le fait qu'une date limite soit franchie entre deux visites de l'écran).

**Point d'attention pour les coupons** : afficher `effectiveIsActive` (pas seulement `isActive`) dans le tableau de gestion des coupons — un coupon avec `isActive: true` mais `effectiveIsActive: false` (épuisé ou expiré) doit être visuellement distingué, même si la seule action possible reste la suppression (pas de route de désactivation dédiée pour un coupon).

---

## 20. Loyalty

```ts
interface LoyaltyBalance {
  userId: number;
  balance: number;
}

interface LoyaltyTransaction {
  id: string;
  userId: number;
  orderId: string | null;
  points: number; // négatif pour un débit
  type: "EARNED" | "REDEEMED" | "EXPIRED" | "ADJUSTED";
  createdAt: string;
}

interface AdjustLoyaltyRequest {
  userId: number;
  points: number; // ≠ 0
  type: LoyaltyTransaction["type"];
  orderId?: string;
}
```

| Action             | Appel                                                                |
| ------------------ | -------------------------------------------------------------------- |
| Solde              | `GET /loyalty/:userId/balance` → `LoyaltyBalance`                    |
| Historique         | `GET /loyalty/:userId/history` → `LoyaltyTransaction[]`              |
| Ajustement (admin) | `POST /loyalty/adjust` `AdjustLoyaltyRequest` → `LoyaltyTransaction` |

1 point crédité automatiquement par tranche de 100 XAF à la livraison (`DELIVERED`) ; reversal automatique si un retour complété annule la commande. Aucune expiration automatique n'est implémentée malgré le type `EXPIRED` existant — un `type: EXPIRED` posé via `/loyalty/adjust` équivaut à un débit manuel.

---

## 21. Returns

```ts
interface ReturnRequest {
  id: string;
  orderId: string;
  order: { id: string; userId: number; status: Order["status"] };
  userId: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
  reason: string;
  notes: string | null;
  items: ReturnItem[];
  createdAt: string;
  updatedAt: string;
}

interface ReturnItem {
  id: string;
  orderItemId: string;
  orderItem: { id: string; productId: number; quantity: number; price: number };
  quantity: number;
  condition: string | null;
}

interface CreateReturnRequest {
  order_id: string;
  reason: string; // min 2
  notes?: string;
  items: { order_item_id: string; quantity: number; condition?: string }[]; // min 1
}

interface UpdateReturnStatusRequest {
  status: ReturnRequest["status"];
  notes?: string;
}
```

| Action                    | Appel                                                               |
| ------------------------- | ------------------------------------------------------------------- |
| Liste (admin)             | `GET /returns?page&limit&status` → `Paginated<ReturnRequest>`       |
| Détail                    | `GET /returns/:returnId` → `ReturnRequest` (owner ou admin)         |
| Création                  | `POST /returns` `CreateReturnRequest` → `ReturnRequest` (201)       |
| Changer le statut (admin) | `PUT /returns/:returnId/status` `UpdateReturnStatusRequest`         |
| Retours d'une commande    | `GET /orders/:orderId/returns` → `ReturnRequest[]` (owner ou admin) |

**Point d'attention** : `POST /returns` requiert que la commande soit `DELIVERED` — afficher le bouton "Demander un retour" uniquement pour les commandes dans cet état côté client. Un passage à `COMPLETED` déclenche en cascade : remboursement, réintégration de stock, reversal des points fidélité — informer l'utilisateur que ces effets sont automatiques et peuvent prendre quelques instants à se refléter (event bus asynchrone, fire-and-forget).

---

## 22. Dashboard

```ts
interface DashboardStats {
  products: { total: number; addedThisMonth: number };
  orders: { total: number; thisMonth: number; trend: number }; // trend en %
  users: { total: number; active: number };
  payments: { totalAmountThisMonth: number; currency: "XAF"; trend: number };
  inventory: { lowStockCount: number };
  shipments: { inProgress: number; trend: number };
  promotions: {
    active: number;
    couponUsageThisMonth: number;
    revenueFromCouponsThisMonth: number;
    currency: "XAF";
  };
}

interface SalesChartResponse {
  period: string;
  year: number;
  points: { label: string; amount: number; orderCount: number }[];
  currency: "XAF";
}
```

| Action               | Appel                                                           |
| -------------------- | --------------------------------------------------------------- |
| Statistiques         | `GET /dashboard/stats` → `DashboardStats`                       |
| Graphique des ventes | `GET /dashboard/sales-chart?year&period` → `SalesChartResponse` |

---

## 23. Gestion des erreurs — pattern recommandé côté frontend

```ts
class ApiRequestError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(token), ...options.headers },
  });

  const body: ApiResponse<T> = await res.json();

  if (!body.status) {
    throw new ApiRequestError(
      res.status,
      body.error.message,
      body.error.details,
    );
  }

  return body.data;
}
```

**Correspondance status code → traitement UI recommandé** :

| Code | Traitement suggéré                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------ |
| 400  | Afficher le message tel quel (validation Zod ou règle métier) — souvent suffisamment explicite                           |
| 401  | Rediriger vers `/login`, purger le token stocké                                                                          |
| 403  | Message générique ("Accès refusé" ou "Compte désactivé" selon contexte) — ne pas exposer le détail exact du rôle attendu |
| 404  | Écran "introuvable" dédié, ou retour à la liste parente                                                                  |
| 409  | Conflit — souvent un doublon (slug, SKU, coupon) : surligner le champ concerné si identifiable                           |
| 429  | Message "trop de requêtes, réessayez dans quelques minutes"                                                              |
| 500  | Message générique + bouton "réessayer" — ne jamais afficher le détail technique à l'utilisateur final                    |
| 503  | Spécifique aux moyens de paiement non branchés — utiliser `message` retourné par l'API directement                       |
