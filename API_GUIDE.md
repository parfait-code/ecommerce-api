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

### Upload de fichiers — pattern commun (produits, promotions, catégories)

Trois ressources gèrent l'upload de fichiers, avec le **même pattern** : l'API reçoit le fichier en `multipart/form-data`, l'uploade elle-même vers Cloudflare R2, et renvoie l'URL publique générée. Le frontend n'a **jamais** à connaître ou saisir une URL manuellement pour ces flux :

| Ressource | Route                                  | Champ(s)        | Cardinalité                                                 |
| --------- | -------------------------------------- | --------------- | ----------------------------------------------------------- |
| Produit   | `POST /product/:productId/images`      | `images`        | 1 à 5 fichiers                                              |
| Promotion | `POST /promotions/:promotionId/images` | `images`        | 1 à 5 fichiers                                              |
| Catégorie | `POST /categories/:categoryId/assets`  | `image`, `icon` | 1 fichier chacun, indépendants (l'un, l'autre, ou les deux) |

Contraintes communes : types MIME et taille max définis dynamiquement par les settings `uploads.allowed_mime_types` / `uploads.max_file_size_mb` (récupérables via `GET /settings/public`), validés côté middleware `multer` avant l'upload R2.

**Recommandation d'implémentation** : créer d'abord la ressource (champs texte uniquement), récupérer son `id`, puis appeler la route d'upload dédiée avec un `FormData` contenant le(s) fichier(s) sélectionné(s) localement.

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

**Point d'attention front** : `POST /login` peut renvoyer `403` si le compte est désactivé — **soit manuellement par un admin, soit automatiquement après 5 échecs de mot de passe en 15 min** (seuils configurables via `security.login_attempt_limit` / `security.login_attempt_window_seconds`). Le message est identique dans les deux cas (`"This account has been deactivated."`) : ne pas tenter de distinguer ces deux cas côté UI.

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
- Un compte listé dans `GET /user/all` avec `isActive: false` peut soit être suspendu manuellement, soit avoir été verrouillé automatiquement (brute-force) — l'API ne distingue pas les deux dans la donnée elle-même.

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
| Suppression (hard delete) | `DELETE /product/:productId` → `{ message: "Product deleted successfully" }`    |
| Upload images             | `POST /product/:productId/images` (multipart, champ `images`, `combinationId?`) |
| Suppression image         | `DELETE /product/:productId/images` `{ imageId }`                               |

⚠️ Contrairement à `User` (soft delete via `deletedAt`), un produit supprimé l'est **définitivement** — les commandes passées conservent `productName`/`productSku` en snapshot sur `OrderItem`, mais le produit lui-même disparaît.

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
| Attributs d'une catégorie **(public)**   | `GET /categories/:categoryId/attributes` → `AttributeDefinition[]`           |
| Création                                 | `POST /categories/:categoryId/attributes` `CreateAttributeDefinitionRequest` |
| Détail **(public)**                      | `GET /attributes/:definitionId` → `AttributeDefinition`                      |
| Mise à jour                              | `PATCH /attributes/:definitionId` (body partiel)                             |
| Suppression                              | `DELETE /attributes/:definitionId`                                           |
| Ajout d'option                           | `POST /attributes/:definitionId/options` `{ value, colorHex?, position? }`   |
| Mise à jour option                       | `PATCH /attributes/options/:optionId`                                        |
| Suppression option                       | `DELETE /attributes/options/:optionId`                                       |
| Valeurs produit (attributs non-variante) | `PUT /product/:productId/attributes` `SetProductAttributesRequest`           |

⚠️ **Correctif catalogue public** : `GET /categories/:categoryId/attributes` **et** `GET /attributes/:definitionId` ne nécessitent plus de token (authentification optionnelle) — les deux routes de lecture de ce module sont désormais publiques.

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

| Action                                                   | Appel                                                                             |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Combinaisons d'un produit **(public)**                   | `GET /product/:productId/combinations` → `ProductCombination[]`                   |
| Sélections courantes d'options par attribut **(public)** | `GET /product/:productId/combinations/selections` → `ProductAttributeSelection[]` |
| Définir les options disponibles pour un attribut (admin) | `PUT /product/:productId/combinations/selections/:attributeDefinitionId`          |
| Générer le produit cartésien (admin)                     | `POST /product/:productId/combinations/generate`                                  |
| Détail d'une combinaison **(public)**                    | `GET /product/:productId/combinations/:combinationId`                             |
| Mise à jour (admin)                                      | `PATCH /product/:productId/combinations/:combinationId`                           |
| Suppression (admin)                                      | `DELETE /product/:productId/combinations/:combinationId`                          |

⚠️ **Correctif catalogue public** : les trois routes de lecture (`GET .../combinations`, `GET .../combinations/selections`, `GET .../combinations/:combinationId`) ne nécessitent **aucune** d'entre elles de token — indispensable pour que la fiche produit publique (sélecteur de variante taille/couleur) fonctionne pour un visiteur non connecté.

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

**Workflow côté fiche produit publique (storefront, sans authentification)** :

```ts
const [combinations, selections] = await Promise.all([
  api.get(`/product/${productId}/combinations`), // public
  api.get(`/product/${productId}/combinations/selections`), // public
]);
```

**Points d'attention** :

- Relancer `generate()` après une modification de sélection **désactive automatiquement** (sans les supprimer) les combinaisons qui ne correspondent plus — prévenir l'admin.
- `DELETE .../combinations/:combinationId` échoue avec 400 si de l'inventaire existe encore.
- Côté panier/commande/wishlist, `combinationId` (optionnel) remplace l'ancien `variantId`.

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
  imageUrl?: string; // optionnel — préférer l'upload dédié, voir ci-dessous
  iconUrl?: string; // optionnel — préférer l'upload dédié, voir ci-dessous
  metaTitle?: string; // max 70
  metaDescription?: string; // max 160
  isActive?: boolean; // défaut true
  parentId?: string;
}
```

| Action                         | Appel                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Liste publique **(public)**    | `GET /categories` → `Category[]` (uniquement `isActive:true`)                                                   |
| Liste admin (avec inactives)   | `GET /categories?includeInactive=true` (nécessite un JWT ADMIN — sinon ignoré)                                  |
| Détail admin                   | `GET /categories/:categoryId` (retourne même si inactive)                                                       |
| Détail public par slug         | `GET /categories/slug/:slug` (**404 si inactive**)                                                              |
| Produits par slug              | `GET /categories/slug/:slug/products?page&limit` (**404 si inactive**)                                          |
| Création (admin)               | `POST /categories` `CreateCategoryRequest`                                                                      |
| Mise à jour (admin)            | `PUT /categories/:categoryId`                                                                                   |
| Suppression (admin)            | `DELETE /categories/:categoryId` (**400** si `_count.products > 0` ou discounts encore rattachés)               |
| **Upload image/icône (admin)** | `POST /categories/:categoryId/assets` (multipart, champs `image?` et/ou `icon?`, 1 fichier chacun) → `Category` |
| **Suppression image (admin)**  | `DELETE /categories/:categoryId/image` (**404** si aucune image définie)                                        |
| **Suppression icône (admin)**  | `DELETE /categories/:categoryId/icon` (**404** si aucune icône définie)                                         |

⚠️ **Correctif catalogue public** : `GET /categories` ne nécessite plus de token.

⚠️ **Upload aligné sur le comportement produit/promotion** : l'API **uploade elle-même** l'image/icône vers Cloudflare R2 — ne pas demander à l'utilisateur de saisir une URL manuellement :

```ts
const category = await api.post("/categories", {
  name: "Hauts",
  slug: "hauts",
  description: "T-shirts, chemises, pulls et vestes",
} satisfies CreateCategoryRequest);

const formData = new FormData();
if (imageFile) formData.append("image", imageFile);
if (iconFile) formData.append("icon", iconFile);

const updatedCategory = await api.post(
  `/categories/${category.id}/assets`,
  formData,
);
```

`imageUrl`/`iconUrl` restent acceptés comme chaînes d'URL directes dans `POST`/`PUT` classiques si besoin — mais ce n'est plus le flux recommandé.

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

**Recommandation front** : privilégier `GET /user/basket` pour le panier principal, et réserver `POST /basket` aux cas nécessitant plusieurs paniers simultanés (rare).

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
  shippingAddressSnapshot: OrderAddress;
  billingAddressSnapshot: OrderAddress | null;
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

// Même forme que UserAddress (§18) — champs partagés via addressFieldsSchema,
// avec recipientName requis et postalCode optionnel.
interface OrderAddress {
  recipientName: string;
  phone?: string;
  street: string;
  addressLine2?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
}

interface CreateOrderRequest {
  items?: { id: string; combinationId?: string; quantity: number }[]; // productId en string
  basketId?: string; // alternative à items
  shippingAddressId?: string;
  shippingAddress: OrderAddress;
  billingAddressId?: string;
  billingAddress?: OrderAddress;
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

| Action                                                     | Appel                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| Liste                                                      | `GET /orders?page&limit&status&customer` → `Paginated<Order>`             |
| Création                                                   | `POST /orders` `CreateOrderRequest` → `Order` (201)                       |
| Détail                                                     | `GET /orders/:orderId` → `Order`                                          |
| Mise à jour (adresses/notes)                               | `PUT /orders/:orderId` (body partiel)                                     |
| Annulation                                                 | `DELETE /orders/:orderId` → `{ message: "Order cancelled successfully" }` |
| Changement de statut (admin)                               | `PUT /orders/:orderId/status` `UpdateOrderStatusRequest`                  |
| Commandes d'un utilisateur (admin)                         | `GET /user/:userId/orders?page&limit` → `Paginated<Order>`                |
| Forcer l'annulation des commandes PENDING périmées (admin) | `POST /orders/expire-stale` → `{ expiredCount: number }`                  |

**Points d'attention front** :

- Toujours envoyer `items[].id` comme **string** représentant le `productId` (pas un `basketItemId`).
- `recipientName` (min 2) est requis dans `shippingAddress`/`billingAddress` — c'est le même schéma partagé que le module Addresses (§18), `postalCode` y est optionnel.
- `combinationSnapshot` sur chaque `OrderItem` est la source fiable pour afficher les caractéristiques achetées — préférer `combinationSnapshot` à `combination.values` pour l'historique de commande.
- `couponCode` est validé et appliqué à la commande, mais **ne réduit le total que si la promotion liée a au moins un `Discount`** ciblant les articles du panier — voir §19.
- Un échec de stock retourne soit `400` (stock global insuffisant), soit `409` (rare — stock pris entre vérification et réservation, la commande n'est pas créée).
- `statusHistory` est limité aux 10 dernières entrées côté API.
- `POST /orders/expire-stale` (admin) déclenche manuellement le même job qui tourne automatiquement toutes les heures (annulation des `PENDING` non payées au-delà de `orders.stale_pending_hours`, 24h par défaut) — utile pour un contrôle manuel/tests, pas nécessaire en usage normal.

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

| Action                    | Appel                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Méthodes disponibles      | `GET /payment-methods` → `PaymentMethodInfo[]`                                                                     |
| Créer un paiement         | `POST /payments` `CreatePaymentRequest` → `Payment` (201, ou 503 si indisponible)                                  |
| Détail                    | `GET /payments/:payment_id` → `Payment`                                                                            |
| Paiements d'une commande  | `GET /orders/:orderId/payments` → `Payment[]`                                                                      |
| Liste (admin)             | `GET /payments?page&limit&status&method&order_id` → `Paginated<Payment>`                                           |
| Changer le statut (admin) | `PUT /payments/:payment_id/status` `UpdatePaymentStatusRequest`                                                    |
| Compléter (déprécié)      | `PUT /payments/:payment_id/complete` — équivalent à `PUT .../status { status: "COMPLETED" }`, conservé pour compat |

**Points d'attention front** :

- Les méthodes disponibles sont pilotées par le setting `payments.enabled_methods` (`CASH_ON_DELIVERY` uniquement par défaut) — utiliser le champ `available` retourné par `GET /payment-methods` plutôt qu'une liste codée en dur, ces valeurs pouvant changer sans redéploiement.
- Les changements manuels de statut par un admin sont **restreints à `REFUNDED`** — les autres transitions (`COMPLETED`, `FAILED`, `CANCELLED`) sont exclusivement déclenchées automatiquement par le cycle de vie de la commande (COD complété à la livraison) ou d'un retour (remboursement automatique).

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
  page: number;
  limit: number;
  totalPages: number;
}

interface CreateReviewRequest {
  order_item_id: string;
  product_id: number;
  rating: number; // 1-5
  comment?: string;
}
```

| Action      | Appel                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Par produit | `GET /products/:pid/reviews?page&limit` → `ProductReviewsResponse` (paginé) |
| Détail      | `GET /reviews/:rid` → `Review`                                              |
| Création    | `POST /reviews` `CreateReviewRequest` → `Review` (201)                      |
| Mise à jour | `PUT /reviews/:rid` `{ rating?, comment? }` (owner uniquement)              |
| Suppression | `DELETE /reviews/:rid` (owner uniquement)                                   |

Un avis est lié à un `orderItemId` précis (achat vérifié) — un produit acheté plusieurs fois peut recevoir plusieurs avis du même utilisateur.

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

// Vue groupée par produit — un item par produit (pas par ligne d'inventaire)
interface InventoryGroupedItem {
  product: {
    id: number;
    name: string;
    sku: string;
    status: Product["status"];
  } | null;
  hasVariants: boolean;
  totalQuantity: number;
  warehouseCount: number;
  combinationsWithStockCount: number;
  lowStockLineCount: number;
  outOfStockLineCount: number;
  lines?: {
    id: string;
    warehouseId: string;
    warehouse: { id: string; name: string };
    quantity: number;
  }[]; // uniquement si hasVariants === false
}
```

| Action                                                   | Appel                                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Liste (par ligne d'inventaire)                           | `GET /inventory?category&location&warehouse_id&page&limit` → `Paginated<InventoryItem>`                                                                |
| Recherche                                                | `GET /inventory/search?keyword&page&limit` (⚠️ `keyword` requis, sinon 500) → `Paginated<InventoryItem>`                                               |
| Vue groupée par produit (avec filtres stock)             | `GET /inventory/grouped?category&warehouse_id&low_stock&out_of_stock&page&limit` → `{ items: InventoryGroupedItem[]; total; page; limit; totalPages }` |
| Lignes détaillées d'un produit (par variante × entrepôt) | `GET /inventory/grouped/:productId?page&limit` → `Paginated<InventoryItem>`                                                                            |
| Détail d'une ligne                                       | `GET /inventory/:item_id` → `InventoryItem`                                                                                                            |
| Création (admin)                                         | `POST /inventory` `CreateInventoryRequest` (201, ou 409 si doublon)                                                                                    |
| Mise à jour (admin)                                      | `PUT /inventory/:item_id` `{ quantity?, warehouse_id? }`                                                                                               |
| Suppression (admin)                                      | `DELETE /inventory/:item_id`                                                                                                                           |
| Transfert (admin)                                        | `POST /inventory/transfer` `TransferInventoryRequest`                                                                                                  |

**Point d'attention front** : il n'existe **pas** de routes dédiées `/inventory/low-stock` ou `/inventory/out-of-stock` — le filtrage stock faible/rupture se fait via les query params `?low_stock=true` / `?out_of_stock=true` sur `GET /inventory/grouped`. Le seuil de stock faible est piloté par le setting `inventory.low_stock_threshold` (10 par défaut) — ne pas le coder en dur côté client. Toujours envoyer un `keyword` non vide sur `/inventory/search`, sinon l'API renvoie une 500 non structurée.

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

interface ShippingCostRequest {
  origin: string;
  destination: string;
  weight: number;
  dimensions?: { length: number; width: number; height: number };
}

interface ShippingCostResponse {
  cost: number;
  currency: "XAF";
}

// Voir aussi UserAddress (§18) pour la forme de `address` ci-dessous.
interface PickupRequest {
  id: string;
  userId: number;
  returnRequestId: string;
  orderId: string;
  method: "ORIGINAL_ADDRESS" | "WAREHOUSE_DROPOFF" | "CUSTOM_ADDRESS";
  addressId: string | null;
  address: UserAddress | null;
  warehouseId: string | null;
  warehouse: { id: string; name: string; location: string } | null;
  pickupDate: string | null;
  deadline: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UpdatePickupLocationRequest {
  method: "ORIGINAL_ADDRESS" | "WAREHOUSE_DROPOFF" | "CUSTOM_ADDRESS";
  address_id?: string; // requis si method = CUSTOM_ADDRESS
  warehouse_id?: string; // requis si method = WAREHOUSE_DROPOFF
  pickup_date?: string;
  deadline?: string;
}

interface UpdatePickupStatusRequest {
  status: PickupRequest["status"];
  notes?: string;
}
```

| Action                                | Appel                                                                 |
| ------------------------------------- | --------------------------------------------------------------------- |
| Calculer un coût                      | `POST /shipments/cost` `ShippingCostRequest` → `ShippingCostResponse` |
| Création (admin)                      | `POST /shipments` `CreateShipmentRequest` → `Shipment` (201)          |
| Détail                                | `GET /shipments/:shipmentId` → `Shipment`                             |
| Liste (admin)                         | `GET /shipments?page&limit&status&order_id` → `Paginated<Shipment>`   |
| Ajouter un événement de suivi (admin) | `POST /shipments/:shipmentId/track` `TrackingEventRequest`            |
| Consulter le suivi                    | `GET /shipments/:shipmentId/track` → `TrackingResponse`               |
| Changer le statut officiel (admin)    | `PUT /shipments/:shipmentId/status` `UpdateShipmentStatusRequest`     |
| Annuler                               | `POST /shipments/:shipmentId/cancel`                                  |
| Étiquette                             | `GET /labels/:shipmentId` → `{ label_id, label_url }`                 |
| Expédition d'une commande             | `GET /orders/:orderId/shipment` → `Shipment \| null`                  |

⚠️ Le calcul de coût est actuellement un **tarif forfaitaire** (`5 + 0.1 × weight`, en XAF) — `origin`, `destination` et `dimensions` sont acceptés par la validation mais n'influencent pas encore le résultat. Ne pas construire d'UI suggérant un calcul basé sur la distance ou les dimensions.

⚠️ Si `order_id` est fourni à la création d'une expédition, la commande liée doit être au statut `PROCESSING` (sinon 400).

**⚠️ Distinction importante côté UI** : ne pas confondre `POST /shipments/:shipmentId/track` (ajout d'un événement d'historique, `status` en texte libre) avec `PUT /shipments/:shipmentId/status` (transition officielle du statut, enum strict).

### Demandes de retrait (pickup requests)

| Action                                             | Appel                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Liste (admin)                                      | `GET /pickup-requests?page&limit&status&order_id` → `Paginated<PickupRequest>` |
| Détail                                             | `GET /pickup-requests/:requestId` → `PickupRequest` (owner ou admin)           |
| Modifier le lieu de collecte (admin)               | `PATCH /pickup-requests/:requestId/location` `UpdatePickupLocationRequest`     |
| Changer le statut (admin)                          | `PATCH /pickup-requests/:requestId/status` `UpdatePickupStatusRequest`         |
| Forcer l'expiration des demandes en retard (admin) | `POST /pickup-requests/expire-overdue` → `{ expiredCount: number }`            |

**⚠️ Aucune route de création manuelle** : une `PickupRequest` naît automatiquement quand un retour passe à `APPROVED` (voir §21) — il n'existe **aucune** route `POST /pickup-requests`. **Aucune route d'annulation côté client** non plus — seul un admin peut faire évoluer son statut via `PATCH .../status` ; annuler la pickup (`CANCELLED`) annule automatiquement en cascade le `ReturnRequest` lié, et l'inverse n'est pas automatique (`COMPLETED` sur la pickup ne marque pas le retour comme `COMPLETED`).

Chaque `ReturnRequest` (§21) inclut un champ `pickupRequest` nullable — c'est le point d'entrée recommandé pour la page "mes demandes d'enlèvement", pas besoin de connaître l'id de la pickup request à l'avance.

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
  country: string; // code ISO — 400 si le pays n'est pas couvert par les zones de la méthode
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
| Liste               | `GET /shipping-methods?includeInactive=true` (admin uniquement) → `ShippingMethod[]`        |
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
  recipientName: string;
  phone: string | null;
  street: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  country: string;
  postalCode: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ValidateAddressRequest {
  recipientName: string; // min 2, max 100
  phone?: string;
  street: string; // min 2
  addressLine2?: string;
  city: string; // min 2
  state?: string;
  country: string; // min 2
  postalCode?: string; // optionnel — certains pays (dont le Cameroun) n'ont pas de code postal résidentiel généralisé
}

interface ValidateAddressResponse {
  valid: boolean;
  normalized_address: {
    recipientName: string;
    phone: string | null;
    street: string;
    addressLine2: string | null;
    city: string;
    state: string | null;
    country: string; // normalisé en code ISO
    postalCode: string | null;
  } | null;
}

interface CreateAddressRequest {
  recipientName: string;
  phone?: string;
  street: string;
  addressLine2?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
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

**Points d'attention front** :

- `recipientName` est **requis** (min 2 caractères). `postalCode` est **optionnel**. Tous les champs, y compris dans `normalized_address`, sont en **camelCase** (seule la clé racine `normalized_address` reste en snake_case).
- `POST /address/validate` utilise le même schéma partagé (`addressFieldsSchema`) que `shippingAddress`/`billingAddress` du module Orders (§11) — utile pour un formulaire de saisie guidée réutilisable entre les deux flux, mais ne pas présenter le résultat comme une validation postale réelle (liste de pays codée en dur côté serveur, pas de service de géocodage externe).

---

## 19. Promotions, Discounts & Coupons

```ts
interface Promotion {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  images: string[]; // tableau — une promotion peut avoir plusieurs visuels
  status: "SCHEDULED" | "ACTIVE" | "EXPIRED" | "CANCELLED"; // calculé à la lecture, voir note
  isActive: boolean;
  startDate: string;
  endDate: string;
  isFeaturedInHero: boolean;
  heroPosition: number | null;
  heroImages: string[];
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
  isFeaturedInHero?: boolean; // défaut false — mise en avant carrousel homepage
  heroPosition?: number; // ordre d'affichage si isFeaturedInHero
  heroImages?: string[]; // URLs, défaut []
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
  items?: { id: string; combinationId?: string; quantity: number }[]; // preview optionnel
}

interface ValidateCouponResponse {
  valid: true;
  couponId: string;
  code: string;
  promotion: { id: string; name: string; slug: string };
  discounts: Discount[];
  preview?: {
    totalAmount: number;
    meetsMinimum: boolean;
    minOrderAmount: number | null;
  };
}

interface AffectedProductsResponse {
  promotionId: string;
  promotionName: string;
  count: number;
  products: (Product & { pricing: PricingInfo })[];
}
```

| Action                          | Appel                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page publique par slug          | `GET /promotions/slug/:slug` → `Promotion`                                                                                                                    |
| **Produits affectés (public)**  | `GET /promotions/slug/:slug/products` → `AffectedProductsResponse`                                                                                            |
| **Produits affectés (admin)**   | `GET /promotions/:promotionId/products` → `AffectedProductsResponse`                                                                                          |
| Promotions actives (public)     | `GET /promotions/active?page&limit&slot=hero` → `Paginated<Promotion>` (triées par `endDate` croissante, ou par `heroPosition` puis `endDate` si `slot=hero`) |
| Valider un coupon               | `POST /coupons/validate` `ValidateCouponRequest` → `ValidateCouponResponse`                                                                                   |
| Liste (admin)                   | `GET /promotions?status&isActive` → `Promotion[]`                                                                                                             |
| Détail (admin)                  | `GET /promotions/:promotionId` → `Promotion`                                                                                                                  |
| Création (admin)                | `POST /promotions` `CreatePromotionRequest`                                                                                                                   |
| Mise à jour (admin)             | `PUT /promotions/:promotionId`                                                                                                                                |
| Bascule isActive (admin)        | `PATCH /promotions/:promotionId/toggle`                                                                                                                       |
| Suppression (admin)             | `DELETE /promotions/:promotionId`                                                                                                                             |
| Upload images (admin)           | `POST /promotions/:promotionId/images` (multipart, champ `images`, 1-5 fichiers)                                                                              |
| Suppression image (admin)       | `DELETE /promotions/:promotionId/images` `{ imageUrl }`                                                                                                       |
| Créer une remise (admin)        | `POST /promotions/:promotionId/discounts` `CreateDiscountRequest`                                                                                             |
| Supprimer une remise (admin)    | `DELETE /promotions/:promotionId/discounts/:discountId`                                                                                                       |
| Coupons d'une promotion (admin) | `GET /promotions/:promotionId/coupons` → `CouponSummary[]` (avec `effectiveIsActive`)                                                                         |
| Créer un coupon (admin)         | `POST /promotions/:promotionId/coupons` `CreateCouponRequest`                                                                                                 |
| Supprimer un coupon (admin)     | `DELETE /promotions/:promotionId/coupons/:couponId`                                                                                                           |

**⚠️ Note importante sur `status`** : ce champ est **recalculé à chaque lecture** à partir de `isActive` + dates. Ne pas mettre ce champ en cache local trop longtemps côté dashboard.

**Point d'attention pour `slot=hero`** : filtre sur les promotions marquées `isFeaturedInHero: true`, triées par `heroPosition` — utile pour un carrousel homepage distinct de la simple liste `active`.

**Point d'attention pour les coupons** : afficher `effectiveIsActive` (pas seulement `isActive`).

**🆕 Flux recommandé pour la homepage (bannière promo cliquable)** :

```ts
const { count, products } = (await api.get(
  `/promotions/slug/${promotion.slug}/products`,
)) as AffectedProductsResponse;

if (count === 0) {
  // Promotion "coupon pur" — aucun Discount ciblant un produit/catégorie.
} else if (count === 1) {
  router.push(`/products/${products[0].id}`);
} else {
  router.push(`/promotions/${promotion.slug}`);
}
```

**🆕 Important — coupon sans effet sur le prix** : un `CouponCode` n'a **aucune valeur de réduction propre** — la réduction provient exclusivement des `Discount` de la promotion liée. Une promotion avec un coupon mais sans `Discount` associé validera le coupon mais ne réduira aucun prix (`discountedAmount` restera `null`).

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

Le barème (points crédités par unité de devise dépensée, 0.01 par défaut soit 1 point / 100 XAF) est configurable via le setting `loyalty.points_per_currency_unit`, crédité automatiquement à la livraison (`DELIVERED`) ; reversal automatique si un retour lié à la commande est complété.

---

## 21. Returns

```ts
interface ReturnRequest {
  id: string;
  orderId: string;
  order: { id: string; userId: number; status: Order["status"] };
  userId: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";
  reason: string;
  notes: string | null;
  collectionMethod: "ORIGINAL_ADDRESS" | "WAREHOUSE_DROPOFF" | "CUSTOM_ADDRESS";
  collectionAddressId: string | null;
  collectionWarehouseId: string | null;
  pickupRequest: PickupRequest | null; // voir §16 — non-null uniquement une fois APPROVED
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
  // Pas de `quantity` — un retour porte toujours la quantité complète de
  // l'orderItem visé (pas de retour partiel d'un même article).
  items: { order_item_id: string; condition?: string }[]; // min 1
  collection?: {
    method?: "ORIGINAL_ADDRESS" | "WAREHOUSE_DROPOFF" | "CUSTOM_ADDRESS"; // défaut ORIGINAL_ADDRESS
    address_id?: string; // requis si CUSTOM_ADDRESS
    warehouse_id?: string; // requis si WAREHOUSE_DROPOFF
  };
}

interface UpdateReturnStatusRequest {
  status: ReturnRequest["status"];
  notes?: string;
  pickup_deadline?: string; // ISO — requis uniquement pour la transition vers APPROVED
}
```

| Action                    | Appel                                                               |
| ------------------------- | ------------------------------------------------------------------- |
| Liste (admin)             | `GET /returns?page&limit&status` → `Paginated<ReturnRequest>`       |
| Détail                    | `GET /returns/:returnId` → `ReturnRequest` (owner ou admin)         |
| Création                  | `POST /returns` `CreateReturnRequest` → `ReturnRequest` (201)       |
| Changer le statut (admin) | `PUT /returns/:returnId/status` `UpdateReturnStatusRequest`         |
| Retours d'une commande    | `GET /orders/:orderId/returns` → `ReturnRequest[]` (owner ou admin) |

**Points d'attention** :

- `POST /returns` requiert que la commande soit `DELIVERED`, et qu'aucun retour `PENDING`/`APPROVED` ne soit déjà actif sur cette commande (409 sinon).
- La transition vers `APPROVED` requiert `pickup_deadline` dans le body — c'est à ce moment qu'une `PickupRequest` est automatiquement matérialisée (voir §16), avec la méthode de collecte choisie à la création du retour (`collection.method`).
- Un passage à `COMPLETED` déclenche en cascade : remboursement des paiements complétés, réintégration du stock, reversal des points fidélité, et passage de `Order.status → REFUNDED` (fire-and-forget via event bus, peut prendre quelques instants).

---

## 22. Dashboard

```ts
interface DashboardStats {
  products: {
    total: number;
    byStatus: Record<"DRAFT" | "ACTIVE" | "ARCHIVED", number>;
    addedThisMonth: number;
  };
  orders: {
    total: number;
    byStatus: Record<Order["status"], number>;
    thisMonth: number;
    trend: number; // %
  };
  users: {
    total: number;
    active: number;
    newThisMonth: number;
    byRole: Record<"USER" | "ADMIN" | "MANAGER" | "SUPPORT", number>;
  };
  payments: {
    totalAmountThisMonth: number;
    totalAmountAllTime: number;
    currency: "XAF";
    trend: number;
    pendingCodCount: number;
  };
  inventory: {
    lowStockCount: number;
    outOfStockCount: number;
  };
  shipments: {
    inProgress: number;
    trend: number;
    pendingPickupRequests: number;
  };
  promotions: {
    active: number;
    couponUsageThisMonth: number;
    revenueFromCouponsThisMonth: number;
    currency: "XAF";
  };
  returns: {
    pending: number;
    thisMonth: number;
  };
  reviews: {
    total: number;
    averageRating: number;
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
