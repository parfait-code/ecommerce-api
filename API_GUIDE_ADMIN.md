````markdown
# API Integration Guide — Admin Dashboard

> Document destiné exclusivement à l'équipe frontend du **dashboard admin**. Ne documente que les routes nécessitant `role === "ADMIN"`, plus le strict nécessaire de contexte (auth, conventions, types partagés). Pour les routes publiques/client, voir `API_GUIDE.md`.

⚠️ **Rappel important** : seul `role === "ADMIN"` passe les contrôles `adminGuard`. Les rôles `MANAGER` et `SUPPORT` existent dans le schéma mais ne sont **pas fonctionnels** sur les routes ci-dessous (403 `Forbidden`) — ne pas construire d'UI différenciée pour ces rôles en attendant une évolution du backend.

## Sommaire

1. Conventions générales
2. Auth (connexion admin)
3. Users (gestion utilisateurs)
4. Products
5. Attributes
6. Combinations (variantes)
7. Tags
8. Categories
9. Orders
10. Payments
11. Warehouses
12. Inventory
13. Shipments & Pickup Requests
14. Shipping Methods
15. Promotions, Discounts & Coupons
16. Popups
17. Loyalty
18. Returns
19. Settings
20. Dashboard
21. Gestion des erreurs — pattern recommandé

---

## 1. Conventions générales

### Base URL & headers

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const headers = (token: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});
```
````

Toutes les routes de ce document exigent un JWT admin valide (`Authorization: Bearer <token>`), sauf mention contraire.

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

Tous les montants sont en **XAF**, sans sous-unité décimale (afficher tel quel).

### Upload de fichiers — pattern commun

L'API reçoit le fichier en `multipart/form-data`, l'uploade elle-même vers Cloudflare R2, et renvoie l'URL publique. Ne jamais demander à l'admin de saisir une URL manuellement.

| Ressource | Route                                  | Champ(s)        |
| --------- | -------------------------------------- | --------------- |
| Produit   | `POST /product/:productId/images`      | `images` (≤5)   |
| Promotion | `POST /promotions/:promotionId/images` | `images` (≤5)   |
| Catégorie | `POST /categories/:categoryId/assets`  | `image`, `icon` |
| Popup     | `POST /popups/:popupId/image`          | `image`         |

Types MIME et taille max pilotés par les settings `uploads.allowed_mime_types` / `uploads.max_file_size_mb` (voir §19).

---

## 2. Auth (connexion admin)

```ts
interface LoginRequest {
  username: string;
  password: string;
}

interface AuthResponse {
  user: PublicUser;
  token: string;
}

interface PublicUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "USER" | "ADMIN" | "MANAGER" | "SUPPORT";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

`POST /login` `LoginRequest` → `AuthResponse`. Le compte admin utilisé doit avoir `role: "ADMIN"` — sinon toutes les routes ci-dessous renverront 403.

⚠️ Pas de refresh token. À l'expiration du JWT (`JWT_EXPIRES_IN`, 3600s par défaut), 401 sur toute route protégée → rediriger vers l'écran de connexion admin.

---

## 3. Users

```ts
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
| Liste                     | `GET /user/all` → `PublicUser[]`                           |
| Détail                    | `GET /user/:userId` → `PublicUser`                         |
| Création                  | `POST /user` `AdminCreateUserRequest` → `PublicUser` (201) |
| Changement de rôle        | `PATCH /user/change-role/:userId` `ChangeRoleRequest`      |
| Suspension / réactivation | `PATCH /user/:userId/status` `ChangeStatusRequest`         |
| Suppression (soft delete) | `DELETE /user/:userId` → `{ numberOfUsersDeleted: 1 }`     |

**Points d'attention** :

- Désactiver le bouton "Supprimer" pour le compte admin actuellement connecté (400 `"You cannot delete your own account"` sinon).
- Suspension (`isActive`) est **indépendante** de la suppression (`deletedAt`) — deux boutons distincts.
- Un compte `isActive: false` peut être suspendu manuellement OU verrouillé automatiquement (5 échecs de connexion en 15 min par défaut) — l'API ne distingue pas les deux dans la donnée.

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
  combinations: ProductCombination[];
  attributeValues: ProductAttributeValue[];
  attributeSelections: ProductAttributeSelection[];
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

| Action                    | Appel                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------- |
| Liste (avec inactifs)     | `GET /product?page&limit&categoryId&search&includeInactive=true` → `Paginated<Product>` |
| Détail (avec inactifs)    | `GET /product/:productId?includeInactive=true` → `Product`                              |
| Création                  | `POST /product` `CreateProductRequest` → `Product` (201, `status:DRAFT`)                |
| Mise à jour               | `PATCH /product/:productId` `UpdateProductRequest` → `Product`                          |
| Suppression (hard delete) | `DELETE /product/:productId` → `{ message }`                                            |
| Upload images             | `POST /product/:productId/images` (multipart `images`, `combinationId?`)                |
| Suppression image         | `DELETE /product/:productId/images` `{ imageId }`                                       |

⚠️ Un produit supprimé l'est **définitivement** (hard delete) — les commandes passées conservent `productName`/`productSku` en snapshot.

**Point d'attention** : `categoryId` ne peut jamais être modifié après création (champ absent de `UpdateProductRequest`). Le passage à `status: ACTIVE` échoue en 400 si des attributs requis de la catégorie manquent — afficher le message d'erreur (il liste les attributs manquants par nom).

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
  isVariant: boolean;
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
| Suppression option                       | `DELETE /attributes/options/:optionId` (**400** si stock actif attaché)      |
| Valeurs produit (attributs non-variante) | `PUT /product/:productId/attributes` `SetProductAttributesRequest`           |

**⚠️ Point critique** : `isVariant` détermine le flux à utiliser :

- `isVariant: false` → formulaire clé-valeur libre → `PUT /product/:productId/attributes`.
- `isVariant: true` → sélection d'options prédéfinies → voir §6 (jamais via cette route, 400 sinon).

---

## 6. Combinations (système de variantes)

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
  optionIds: string[];
}

interface UpdateCombinationRequest {
  sku?: string;
  price?: number;
  isActive?: boolean;
}
```

| Action                                           | Appel                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| Combinaisons d'un produit                        | `GET /product/:productId/combinations` → `ProductCombination[]`             |
| Sélections courantes                             | `GET /product/:productId/combinations/selections`                           |
| Définir les options disponibles pour un attribut | `PUT /product/:productId/combinations/selections/:attributeDefinitionId`    |
| Générer le produit cartésien                     | `POST /product/:productId/combinations/generate`                            |
| Détail d'une combinaison                         | `GET /product/:productId/combinations/:combinationId`                       |
| Mise à jour                                      | `PATCH /product/:productId/combinations/:combinationId`                     |
| Suppression                                      | `DELETE /product/:productId/combinations/:combinationId` (**400** si stock) |

**Workflow recommandé** :

```ts
// 1. Choisir les options disponibles pour ce produit, par attribut variant
await api.put(
  `/product/${productId}/combinations/selections/${attributeDefinitionId}`,
  { optionIds: selectedOptionIds } satisfies SetVariantOptionsRequest,
);

// 2. Générer le produit cartésien
const combinations = await api.post(
  `/product/${productId}/combinations/generate`,
);

// 3. Ajuster individuellement (prix, SKU, désactivation)
await api.patch(`/product/${productId}/combinations/${combinationId}`, {
  isActive: false,
} satisfies UpdateCombinationRequest);
```

⚠️ Relancer `generate()` désactive automatiquement (sans supprimer) les combinaisons obsolètes — prévenir l'admin avant l'action.

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

| Action                | Appel                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| Création              | `POST /tags` `CreateTagRequest`                                        |
| Mise à jour           | `PATCH /tags/:tagId`                                                   |
| Suppression           | `DELETE /tags/:tagId`                                                  |
| Assigner à un produit | `PUT /product/:productId/tags` `SetProductTagsRequest` (remplace tout) |

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
  slug: string;
  description?: string;
  imageUrl?: string; // préférer l'upload dédié
  iconUrl?: string;
  metaTitle?: string; // max 70
  metaDescription?: string; // max 160
  isActive?: boolean; // défaut true
  parentId?: string;
}
```

| Action                 | Appel                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Liste (avec inactives) | `GET /categories?includeInactive=true` → `Category[]`                                |
| Détail                 | `GET /categories/:categoryId` (retourne même si inactive)                            |
| Création               | `POST /categories` `CreateCategoryRequest`                                           |
| Mise à jour            | `PUT /categories/:categoryId`                                                        |
| Suppression            | `DELETE /categories/:categoryId` (**400** si produits ou discounts encore rattachés) |
| Upload image/icône     | `POST /categories/:categoryId/assets` (multipart, `image?`, `icon?`) → `Category`    |
| Suppression image      | `DELETE /categories/:categoryId/image` (**404** si aucune image)                     |
| Suppression icône      | `DELETE /categories/:categoryId/icon` (**404** si aucune icône)                      |

```ts
const formData = new FormData();
if (imageFile) formData.append("image", imageFile);
if (iconFile) formData.append("icon", iconFile);
await api.post(`/categories/${category.id}/assets`, formData);
```

---

## 9. Orders

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
  combinationSnapshot: Record<string, string> | null;
  quantity: number;
  price: number;
  originalPrice: number;
  discountAmount: number;
}

interface OrderStatusHistory {
  id: string;
  fromStatus: Order["status"] | null;
  toStatus: Order["status"];
  changedBy: number | null;
  reason: string | null;
  createdAt: string;
}

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

interface UpdateOrderStatusRequest {
  status: Order["status"];
  reason?: string;
  shippingCarrier?: string;
  trackingNumber?: string;
  estimatedDeliveryDate?: string;
}
```

| Action                                     | Appel                                                               |
| ------------------------------------------ | ------------------------------------------------------------------- |
| Liste globale (toutes commandes)           | `GET /orders?page&limit&status&customer=email` → `Paginated<Order>` |
| Détail                                     | `GET /orders/:orderId` → `Order`                                    |
| Changement de statut                       | `PUT /orders/:orderId/status` `UpdateOrderStatusRequest`            |
| Commandes d'un utilisateur donné           | `GET /user/:userId/orders?page&limit` → `Paginated<Order>`          |
| Forcer l'annulation des `PENDING` périmées | `POST /orders/expire-stale` → `{ expiredCount: number }`            |

**Cycle de vie** :

```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED → REFUNDED
   ↓           ↓            ↓
CANCELLED  CANCELLED   CANCELLED
```

Transitions strictement contrôlées côté serveur (400 si invalide). `PENDING → CONFIRMED` se déclenche automatiquement au paiement COD. `DELIVERED → REFUNDED` uniquement via un retour complété. Un job interne annule automatiquement les `PENDING` non payées après `orders.stale_pending_hours` (24h par défaut, §19) — `POST /orders/expire-stale` sert à un contrôle manuel/tests.

---

## 10. Payments

```ts
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
  method: "CASH_ON_DELIVERY" | "PAYPAL" | "STRIPE" | "CINETPAY";
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" | "CANCELLED";
  amount: number;
  currency: "XAF";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UpdatePaymentStatusRequest {
  status: Payment["status"];
  notes?: string;
}
```

| Action                      | Appel                                                                    |
| --------------------------- | ------------------------------------------------------------------------ |
| Liste                       | `GET /payments?page&limit&status&method&order_id` → `Paginated<Payment>` |
| Changer le statut           | `PUT /payments/:payment_id/status` `UpdatePaymentStatusRequest`          |
| Compléter (déprécié)        | `PUT /payments/:payment_id/complete`                                     |
| Réconciliation COD manuelle | `POST /payments/reconcile-cod` → `{ reconciledCount: number }`           |

⚠️ Les changements manuels de statut admin sont **restreints à `REFUNDED`** — les autres transitions (`COMPLETED`, `FAILED`, `CANCELLED`) sont exclusivement automatiques (cycle de vie commande/retour).

---

## 11. Warehouses

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

| Action                   | Appel                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| Liste                    | `GET /warehouses` → `Warehouse[]`                                        |
| Détail                   | `GET /warehouses/:warehouse_id` → `Warehouse`                            |
| Inventaire d'un entrepôt | `GET /warehouses/:warehouse_id/inventory` → `WarehouseInventoryResponse` |
| Création                 | `POST /warehouses` `CreateWarehouseRequest`                              |
| Mise à jour              | `PUT /warehouses/:warehouse_id`                                          |
| Suppression              | `DELETE /warehouses/:warehouse_id` (**400** si stock actif)              |

---

## 12. Inventory

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
  }[];
}
```

| Action                         | Appel                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| Liste (par ligne)              | `GET /inventory?category&location&warehouse_id&page&limit` → `Paginated<InventoryItem>` |
| Recherche                      | `GET /inventory/search?keyword&page&limit` (⚠️ requis, sinon 500)                       |
| Vue groupée par produit        | `GET /inventory/grouped?category&warehouse_id&low_stock&out_of_stock&page&limit`        |
| Lignes détaillées d'un produit | `GET /inventory/grouped/:productId?page&limit`                                          |
| Détail d'une ligne             | `GET /inventory/:item_id` → `InventoryItem`                                             |
| Création                       | `POST /inventory` `CreateInventoryRequest` (201, ou 409 si doublon)                     |
| Mise à jour                    | `PUT /inventory/:item_id` `{ quantity?, warehouse_id? }`                                |
| Suppression                    | `DELETE /inventory/:item_id`                                                            |
| Transfert                      | `POST /inventory/transfer` `TransferInventoryRequest`                                   |

**Point d'attention** : pas de routes dédiées low-stock/out-of-stock — filtrer via `?low_stock=true` / `?out_of_stock=true` sur `/inventory/grouped`. Seuil piloté par `inventory.low_stock_threshold` (§19).

---

## 13. Shipments & Pickup Requests

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

interface CreateShipmentRequest {
  sender_name: string;
  sender_address: string;
  recipient_name: string;
  recipient_address: string;
  weight: number;
  dimensions?: { length: number; width: number; height: number };
  order_id?: string; // doit référencer une commande PROCESSING
  estimated_delivery_at?: string;
}

interface TrackingEventRequest {
  status: string;
  location?: string;
  shipment_status?: Shipment["status"]; // met AUSSI à jour le statut officiel
}

interface UpdateShipmentStatusRequest {
  status: Shipment["status"];
  reason?: string;
}
```

| Action                        | Appel                                                               |
| ----------------------------- | ------------------------------------------------------------------- |
| Création                      | `POST /shipments` `CreateShipmentRequest` → `Shipment` (201)        |
| Liste                         | `GET /shipments?page&limit&status&order_id` → `Paginated<Shipment>` |
| Ajouter un événement de suivi | `POST /shipments/:shipmentId/track` `TrackingEventRequest`          |
| Changer le statut officiel    | `PUT /shipments/:shipmentId/status` `UpdateShipmentStatusRequest`   |

⚠️ Ne pas confondre `POST .../track` (événement d'historique, texte libre) et `PUT .../status` (transition officielle, enum strict). `order_id` à la création nécessite une commande `PROCESSING`.

### Pickup requests

```ts
interface PickupRequest {
  id: string;
  userId: number;
  returnRequestId: string;
  orderId: string;
  method: "ORIGINAL_ADDRESS" | "WAREHOUSE_DROPOFF" | "CUSTOM_ADDRESS";
  addressId: string | null;
  warehouseId: string | null;
  pickupDate: string | null;
  deadline: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  notes: string | null;
}

interface UpdatePickupLocationRequest {
  method: PickupRequest["method"];
  address_id?: string;
  warehouse_id?: string;
  pickup_date?: string;
  deadline?: string;
}

interface UpdatePickupStatusRequest {
  status: PickupRequest["status"];
  notes?: string;
}
```

| Action                                     | Appel                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| Liste                                      | `GET /pickup-requests?page&limit&status&order_id` → `Paginated<PickupRequest>` |
| Modifier le lieu de collecte               | `PATCH /pickup-requests/:requestId/location` `UpdatePickupLocationRequest`     |
| Changer le statut                          | `PATCH /pickup-requests/:requestId/status` `UpdatePickupStatusRequest`         |
| Forcer l'expiration des demandes en retard | `POST /pickup-requests/expire-overdue` → `{ expiredCount: number }`            |

⚠️ **Aucune route de création manuelle** — une pickup naît automatiquement à l'approbation d'un retour. Annuler la pickup (`CANCELLED`) annule en cascade le `ReturnRequest` lié ; l'inverse n'est pas automatique.

---

## 14. Shipping Methods

```ts
interface ShippingMethod {
  id: string;
  name: string;
  description: string | null;
  estimatedDays: number;
  basePrice: number;
  pricePerKg: number;
  isActive: boolean;
  zones: string[];
}
```

| Action                 | Appel                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| Liste (avec inactives) | `GET /shipping-methods?includeInactive=true` → `ShippingMethod[]` |
| Création               | `POST /shipping-methods`                                          |
| Mise à jour            | `PATCH /shipping-methods/:methodId` (body partiel)                |
| Suppression            | `DELETE /shipping-methods/:methodId`                              |

---

## 15. Promotions, Discounts & Coupons

```ts
interface Promotion {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  images: string[];
  status: "SCHEDULED" | "ACTIVE" | "EXPIRED" | "CANCELLED"; // recalculé à la lecture
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
  isActive: boolean;
  effectiveIsActive?: boolean; // présent sur GET .../coupons — statut réel
}

interface CreatePromotionRequest {
  name: string; // 2-200
  slug: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
  isFeaturedInHero?: boolean;
  heroPosition?: number;
  heroImages?: string[];
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
```

| Action                  | Appel                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Liste                   | `GET /promotions?status&isActive` → `Promotion[]`                                     |
| Détail                  | `GET /promotions/:promotionId` → `Promotion`                                          |
| Produits affectés       | `GET /promotions/:promotionId/products` → `AffectedProductsResponse`                  |
| Création                | `POST /promotions` `CreatePromotionRequest`                                           |
| Mise à jour             | `PUT /promotions/:promotionId`                                                        |
| Bascule `isActive`      | `PATCH /promotions/:promotionId/toggle`                                               |
| Suppression             | `DELETE /promotions/:promotionId`                                                     |
| Upload images           | `POST /promotions/:promotionId/images` (multipart `images`, 1-5)                      |
| Suppression image       | `DELETE /promotions/:promotionId/images` `{ imageUrl }`                               |
| Créer une remise        | `POST /promotions/:promotionId/discounts` `CreateDiscountRequest`                     |
| Supprimer une remise    | `DELETE /promotions/:promotionId/discounts/:discountId`                               |
| Coupons d'une promotion | `GET /promotions/:promotionId/coupons` → `CouponSummary[]` (avec `effectiveIsActive`) |
| Créer un coupon         | `POST /promotions/:promotionId/coupons` `CreateCouponRequest`                         |
| Supprimer un coupon     | `DELETE /promotions/:promotionId/coupons/:couponId`                                   |

**⚠️ `status` est recalculé à chaque lecture** à partir de `isActive` + dates — ne pas mettre en cache local trop longtemps. **Un coupon n'a aucune réduction propre** — la réduction provient exclusivement des `Discount` de la promotion liée ; un coupon sans `Discount` associé ne réduira aucun prix.

---

## 16. Popups

```ts
interface Popup {
  id: string;
  title: string;
  imageUrl: string | null;
  message: string | null;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  targetType: "PROMOTION" | "CATEGORY" | "PRODUCT" | "INFO" | "EXTERNAL_LINK";
  targetId: string | null;
  externalUrl: string | null;
  ctaLabel: string | null;
  displayFrequency: "ONCE_PER_SESSION" | "ONCE_PER_DAY" | "ALWAYS";
  priority: number;
  resolvedUrl: string | null; // calculé côté serveur
}

interface CreatePopupRequest {
  title: string; // 2-200
  imageUrl?: string; // préférer l'upload dédié
  message?: string;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  targetType: Popup["targetType"];
  targetId?: string; // requis pour PROMOTION/CATEGORY/PRODUCT
  externalUrl?: string; // requis pour EXTERNAL_LINK
  ctaLabel?: string; // max 50
  displayFrequency?: Popup["displayFrequency"];
  priority?: number;
}
```

| Action            | Appel                                                    |
| ----------------- | -------------------------------------------------------- |
| Liste             | `GET /popups?isActive&targetType&page&limit` → `Popup[]` |
| Détail            | `GET /popups/:popupId` → `Popup`                         |
| Création          | `POST /popups` `CreatePopupRequest`                      |
| Mise à jour       | `PUT /popups/:popupId` (body partiel)                    |
| Suppression       | `DELETE /popups/:popupId`                                |
| Upload image      | `POST /popups/:popupId/image` (multipart `image`)        |
| Suppression image | `DELETE /popups/:popupId/image`                          |

Règles de validation `targetType` : `PROMOTION`/`CATEGORY`/`PRODUCT` → `targetId` requis ; `EXTERNAL_LINK` → `externalUrl` requis ; `INFO` → rien requis.

---

## 17. Loyalty

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

| Action                      | Appel                                                                |
| --------------------------- | -------------------------------------------------------------------- |
| Solde d'un utilisateur      | `GET /loyalty/:userId/balance` → `LoyaltyBalance`                    |
| Historique d'un utilisateur | `GET /loyalty/:userId/history` → `LoyaltyTransaction[]`              |
| Ajustement manuel           | `POST /loyalty/adjust` `AdjustLoyaltyRequest` → `LoyaltyTransaction` |

Barème configurable via `loyalty.points_per_currency_unit` (§19).

---

## 18. Returns

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
  pickupRequest: PickupRequest | null;
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

interface UpdateReturnStatusRequest {
  status: ReturnRequest["status"];
  notes?: string;
  pickup_deadline?: string; // ISO — requis uniquement pour la transition vers APPROVED
}
```

| Action            | Appel                                                         |
| ----------------- | ------------------------------------------------------------- |
| Liste             | `GET /returns?page&limit&status` → `Paginated<ReturnRequest>` |
| Détail            | `GET /returns/:returnId` → `ReturnRequest`                    |
| Changer le statut | `PUT /returns/:returnId/status` `UpdateReturnStatusRequest`   |

**Points d'attention** :

- La transition vers `APPROVED` requiert `pickup_deadline` — matérialise automatiquement une `PickupRequest` (§13).
- Un passage à `COMPLETED` déclenche en cascade : remboursement des paiements complétés, réintégration du stock, reversal des points fidélité, `Order.status → REFUNDED` (fire-and-forget via event bus, peut prendre quelques instants).
- Faire passer la pickup liée à `COMPLETED` (§13) **ne marque pas** automatiquement le retour comme `COMPLETED` — décision distincte via cette route.

---

## 19. Settings

Module de configuration à chaud — modifie certains comportements de l'API (seuils, listes, méthodes de paiement, etc.) sans redéploiement.

```ts
interface Setting {
  id: string;
  key: string;
  value: string; // toujours une string en base, y compris pour JSON (parser côté client)
  type: "STRING" | "NUMBER" | "BOOLEAN" | "JSON";
  category: string;
  description: string;
  isPublic: boolean;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

interface UpdateSettingRequest {
  value: unknown; // valeur native — le serveur (re)sérialise selon `type`
}

interface UpdateManySettingsRequest {
  settings: { key: string; value: unknown }[]; // min 1
}
```

| Action                            | Appel                                         |
| --------------------------------- | --------------------------------------------- |
| Liste complète (publics + privés) | `GET /settings?category=` → `Setting[]`       |
| Mise à jour groupée               | `PATCH /settings` `UpdateManySettingsRequest` |
| Mise à jour d'un seul setting     | `PATCH /settings/:key` `UpdateSettingRequest` |

**Clés disponibles** :

| Clé                                     | Type   | Catégorie  | Description                                                     |
| --------------------------------------- | ------ | ---------- | --------------------------------------------------------------- |
| `store.currency`                        | STRING | store      | Devise utilisée dans toute l'application                        |
| `store.supported_countries`             | JSON   | store      | Pays supportés pour adresses/zones de livraison                 |
| `payments.enabled_methods`              | JSON   | payments   | Méthodes de paiement actuellement disponibles                   |
| `payments.unavailable_messages`         | JSON   | payments   | Messages affichés pour les méthodes indisponibles               |
| `inventory.low_stock_threshold`         | NUMBER | inventory  | Seuil LOW_STOCK (défaut 10)                                     |
| `loyalty.points_per_currency_unit`      | NUMBER | loyalty    | Points par unité de devise dépensée (défaut 0.01)               |
| `security.login_attempt_limit`          | NUMBER | security   | Échecs avant verrouillage (défaut 5)                            |
| `security.login_attempt_window_seconds` | NUMBER | security   | Fenêtre glissante (défaut 900s)                                 |
| `orders.stale_pending_hours`            | NUMBER | orders     | Délai avant annulation auto d'une commande PENDING (défaut 24h) |
| `uploads.max_file_size_mb`              | NUMBER | uploads    | Taille max par fichier (défaut 5 Mo)                            |
| `uploads.allowed_mime_types`            | JSON   | uploads    | Types MIME autorisés                                            |
| `pagination.default_page_size`          | NUMBER | pagination | Taille de page par défaut (défaut 20)                           |
| `cache.default_ttl_seconds`             | NUMBER | cache      | TTL cache Redis produits/promotions (défaut 300s)               |

Prend effet **immédiatement** pour les accesseurs asynchrones ; certains chemins synchrones internes (pagination, pays, limites d'upload) peuvent mettre quelques minutes à se rafraîchir — sans impact perceptible côté dashboard.

---

## 20. Dashboard

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

| Action                | Appel                                                           |
| --------------------- | --------------------------------------------------------------- |
| Statistiques globales | `GET /dashboard/stats` → `DashboardStats`                       |
| Graphique des ventes  | `GET /dashboard/sales-chart?year&period` → `SalesChartResponse` |

---

## 21. Gestion des erreurs — pattern recommandé

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
  token: string,
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

| Code | Traitement suggéré                                                                       |
| ---- | ---------------------------------------------------------------------------------------- |
| 400  | Afficher le message tel quel (validation Zod ou règle métier)                            |
| 401  | Rediriger vers l'écran de connexion admin, purger le token                               |
| 403  | Message "Accès refusé" — vérifier que le compte connecté a bien `role: "ADMIN"`          |
| 404  | Écran "introuvable" dédié, ou retour à la liste parente                                  |
| 409  | Conflit (doublon slug/SKU/coupon/code) — surligner le champ concerné                     |
| 429  | "Trop de requêtes, réessayez dans quelques minutes" (limite : 100 req / 15 min / IP)     |
| 500  | Message générique + bouton "réessayer"                                                   |
| 503  | Spécifique aux moyens de paiement non branchés — utiliser `message` retourné directement |

```

```
