# API Integration Guide — Site Public (Storefront)

> Document destiné à l'équipe frontend du **site public** (catalogue, panier, compte client). Couvre uniquement les routes accessibles à un visiteur non connecté et/ou à un utilisateur avec `role: "USER"`. Aucune route Admin n'est documentée ici — voir `API_GUIDE_ADMIN.md` pour le dashboard back-office.

## Sommaire

1. Conventions générales
2. Authentification & compte
3. Catalogue (Produits, Catégories, Tags, Attributs, Variantes)
4. Panier
5. Wishlist
6. Adresses
7. Commandes
8. Paiements
9. Avis (Reviews)
10. Retours
11. Fidélité
12. Méthodes de livraison
13. Promotions & Coupons
14. Popups
15. Paramètres publics (Settings)
16. Gestion des erreurs

---

## 1. Conventions générales

### Base URL & headers

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const headers = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token && { Authorization: `Bearer ${token}` }),
});
```

Les routes marquées **Public** ne nécessitent aucun token. Les routes marquées **User** nécessitent `Authorization: Bearer <token>` (obtenu via `/login` ou `/signup`).

⚠️ **Pas de refresh token** — à l'expiration du JWT (`401 Invalid or expired token.`), rediriger vers l'écran de connexion.

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

### Devise, dates, IDs

- **Devise** : XAF partout, nombres bruts (pas de division par 100), aussi exposée via `GET /settings/public` (`store.currency`).
- **Dates** : ISO 8601.
- **IDs** : `Product` = `Int`, toutes les autres entités = `cuid()` (string).

---

## 2. Authentification & compte

```ts
interface SignupRequest {
  username: string; // 3-50
  email: string;
  password: string; // min 6
  firstName: string; // 2-50
  lastName: string; // 2-50
  dateOfBirth?: string;
  phone?: string;
}

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
  dateOfBirth: string | null;
  phone: string | null;
  role: "USER";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UpdateProfileRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phone?: string;
}
```

| Action             | Appel                                               | Auth   |
| ------------------ | --------------------------------------------------- | ------ |
| Inscription        | `POST /signup` `SignupRequest` → `AuthResponse`     | Public |
| Connexion          | `POST /login` `LoginRequest` → `AuthResponse`       | Public |
| Profil courant     | `GET /user` → `PublicUser`                          | User   |
| Mise à jour profil | `PATCH /user` `UpdateProfileRequest` → `PublicUser` | User   |

⚠️ `POST /login` peut renvoyer `403` si le compte est désactivé — soit suspendu manuellement, soit verrouillé automatiquement après 5 échecs de mot de passe en 15 min. Le message (`"This account has been deactivated."`) est identique dans les deux cas.

---

## 3. Catalogue

### 3.1 Produits

```ts
interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  categoryId: string;
  category: { id: string; name: string; slug: string };
  status: "ACTIVE"; // seul statut visible côté public
  weight: number;
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
```

| Action | Appel                                                                                          | Auth   |
| ------ | ---------------------------------------------------------------------------------------------- | ------ |
| Liste  | `GET /product?page&limit&categoryId&search&minPrice&maxPrice&tags&sort` → `Paginated<Product>` | Public |
| Détail | `GET /product/:productId` → `Product`                                                          | Public |

**Filtres `sort`** : `newest` (défaut), `oldest`, `price_asc`, `price_desc`, `name_asc`, `name_desc`.

### 3.2 Catégories

```ts
interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
  isActive: true;
  parentId: string | null;
  parent: { id: string; name: string; slug: string } | null;
  children: { id: string; name: string; slug: string }[];
  _count: { products: number };
}
```

| Action                   | Appel                                                                                                     | Auth   |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ------ |
| Liste                    | `GET /categories` → `Category[]` (uniquement actives)                                                     | Public |
| Détail                   | `GET /categories/:categoryId` ou `GET /categories/slug/:slug`                                             | Public |
| Produits d'une catégorie | `GET /categories/slug/:slug/products?page&limit&search&minPrice&maxPrice&tags&sort` → produits + `images` | Public |

### 3.3 Tags

| Action            | Appel                          | Auth   |
| ----------------- | ------------------------------ | ------ |
| Liste             | `GET /tags` → `Tag[]`          | Public |
| Détail            | `GET /tags/:tagId`             | Public |
| Tags d'un produit | `GET /product/:productId/tags` | Public |

### 3.4 Attributs & Variantes

```ts
interface AttributeDefinition {
  id: string;
  name: string;
  slug: string;
  type: "TEXT" | "NUMBER" | "COLOR" | "BOOLEAN" | "SELECT";
  unit: string | null;
  isVariant: boolean; // false = fiche technique, true = sélecteur variante
  isFilterable: boolean;
  options: {
    id: string;
    value: string;
    colorHex: string | null;
    position: number;
  }[];
}

interface ProductCombination {
  id: string;
  sku: string | null;
  price: number | null; // null → hérite du prix produit
  isActive: boolean;
  values: {
    attributeDefinition: { id: string; name: string; slug: string };
    attributeOption: { id: string; value: string; colorHex: string | null };
  }[];
  inventory: { quantity: number; warehouseId: string }[];
  images: ProductImage[];
}
```

| Action                                        | Appel                                                 | Auth   |
| --------------------------------------------- | ----------------------------------------------------- | ------ |
| Attributs d'une catégorie                     | `GET /categories/:categoryId/attributes`              | Public |
| Détail d'un attribut                          | `GET /attributes/:definitionId`                       | Public |
| Combinaisons d'un produit                     | `GET /product/:productId/combinations`                | Public |
| Sélections d'options par attribut de variante | `GET /product/:productId/combinations/selections`     | Public |
| Détail d'une combinaison                      | `GET /product/:productId/combinations/:combinationId` | Public |

⚠️ **Si `product.combinations.length > 0`**, la fiche produit doit forcer la sélection d'une combinaison (`combination_id`) avant tout ajout au panier — sinon `400`.

---

## 4. Panier

```ts
interface Basket {
  id: string;
  userId: number;
  items: BasketItem[];
}

interface BasketItem {
  id: string;
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
```

| Action                 | Appel                                                                                 | Auth |
| ---------------------- | ------------------------------------------------------------------------------------- | ---- |
| Panier (get-or-create) | `GET /user/basket` → `Basket`                                                         | User |
| Ajouter un produit     | `POST /basket/:basket_id/product` `AddProductRequest`                                 | User |
| Modifier la quantité   | `PUT /basket/:basket_id/product/quantity` `{ product_id, combination_id?, quantity }` | User |
| Retirer un produit     | `DELETE /basket/:basket_id/product` `{ product_id, combination_id? }`                 | User |

Le stock est **vérifié** à l'ajout, jamais réservé — un article disponible au panier peut échouer à la commande (`409`) si le stock a été pris entretemps.

---

## 5. Wishlist

| Action    | Appel                                                      | Auth |
| --------- | ---------------------------------------------------------- | ---- |
| Consulter | `GET /wishlist` → `Wishlist` (créée auto si absente)       | User |
| Ajouter   | `POST /wishlist/items` `{ product_id, combination_id? }`   | User |
| Retirer   | `DELETE /wishlist/items` `{ product_id, combination_id? }` | User |

---

## 6. Adresses

```ts
interface UserAddress {
  id: string;
  recipientName: string;
  phone: string | null;
  street: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  country: string;
  postalCode: string | null;
  isDefault: boolean;
}

interface CreateAddressRequest {
  recipientName: string; // min 2
  phone?: string;
  street: string;
  addressLine2?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string; // optionnel
  isDefault?: boolean;
}
```

| Action              | Appel                                                                             | Auth   |
| ------------------- | --------------------------------------------------------------------------------- | ------ |
| Validation formelle | `POST /address/validate` `CreateAddressRequest` → `{ valid, normalized_address }` | Public |
| Liste               | `GET /addresses`                                                                  | User   |
| Détail              | `GET /addresses/:addressId`                                                       | User   |
| Création            | `POST /addresses` `CreateAddressRequest`                                          | User   |
| Mise à jour         | `PATCH /addresses/:addressId`                                                     | User   |
| Suppression         | `DELETE /addresses/:addressId`                                                    | User   |

`country` est normalisé côté serveur (liste des pays supportés via `GET /settings/public` → `store.supported_countries`) ; toute valeur non reconnue → `400`.

---

## 7. Commandes

```ts
interface Order {
  id: string;
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
  shippingCost: number;
  notes: string | null;
  appliedCoupon: {
    id: string;
    code: string;
    promotion: { id: string; name: string; slug: string };
  } | null;
  totalAmount: number; // SEUL montant à utiliser pour payer
  discountedAmount: number | null; // informatif uniquement
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
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
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
  }[];
}

interface CreateOrderRequest {
  items?: { id: string; combinationId?: string; quantity: number }[];
  basketId?: string;
  shippingAddressId?: string;
  shippingAddress: OrderAddress; // toujours requis (snapshot)
  billingAddressId?: string;
  billingAddress?: OrderAddress;
  shippingMethodId?: string;
  paymentMethodId?: string;
  notes?: string;
  couponCode?: string;
}
```

| Action                      | Appel                                                     | Auth |
| --------------------------- | --------------------------------------------------------- | ---- |
| Mes commandes               | `GET /orders?page&limit&status` → `Paginated<Order>`      | User |
| Créer une commande          | `POST /orders` `CreateOrderRequest` → `Order` (201)       | User |
| Détail                      | `GET /orders/:orderId` → `Order`                          | User |
| Modifier (avant expédition) | `PUT /orders/:orderId` (adresses/notes/méthode livraison) | User |
| Annuler                     | `DELETE /orders/:orderId`                                 | User |

⚠️ **Aucun montant n'est envoyé par le client** — `totalAmount` est entièrement calculé côté serveur (prix produit remisé + coût de livraison réel selon poids × tarif méthode). `discountedAmount` est purement informatif, jamais un montant à payer. `items[].id` = `productId` en string.

Une commande `PENDING` non payée est **automatiquement annulée** après un délai (24h par défaut) et son stock libéré — prévoir un message adapté si `GET /orders/:orderId` renvoie `CANCELLED` de manière inattendue.

---

## 8. Paiements

```ts
interface PaymentMethodInfo {
  id: "CASH_ON_DELIVERY" | "PAYPAL" | "STRIPE" | "CINETPAY";
  name: string;
  description: string;
  available: boolean;
  message?: string;
}

interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethodInfo["id"];
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" | "CANCELLED";
  amount: number;
  currency: "XAF";
  createdAt: string;
}

interface CreatePaymentRequest {
  order_id: string;
  method: PaymentMethodInfo["id"];
  currency?: string;
  notes?: string;
}
```

| Action                   | Appel                                                | Auth   |
| ------------------------ | ---------------------------------------------------- | ------ |
| Méthodes disponibles     | `GET /payment-methods` → `PaymentMethodInfo[]`       | Public |
| Créer un paiement        | `POST /payments` `CreatePaymentRequest` (201 ou 503) | User   |
| Détail                   | `GET /payments/:payment_id`                          | User   |
| Paiements d'une commande | `GET /orders/:orderId/payments`                      | User   |

Seule `CASH_ON_DELIVERY` est disponible actuellement (les autres renvoient `503`).

---

## 9. Avis (Reviews)

```ts
interface Review {
  id: string;
  productId: number;
  userId: number;
  user: { id: number; username: string; firstName: string; lastName: string };
  rating: number; // 1-5
  comment: string | null;
  createdAt: string;
}

interface CreateReviewRequest {
  order_item_id: string;
  product_id: number;
  rating: number;
  comment?: string;
}
```

| Action      | Appel                                                                 | Auth   |
| ----------- | --------------------------------------------------------------------- | ------ |
| Par produit | `GET /products/:pid/reviews?page&limit` → items + `average_rating`    | Public |
| Détail      | `GET /reviews/:rid`                                                   | Public |
| Création    | `POST /reviews` `CreateReviewRequest` (201)                           | User   |
| Mise à jour | `PUT /reviews/:rid` `{ rating?, comment? }` (propriétaire uniquement) | User   |
| Suppression | `DELETE /reviews/:rid` (propriétaire uniquement)                      | User   |

Un avis est lié à un `order_item_id` précis (achat vérifié, commande `DELIVERED`), un seul avis par achat.

---

## 10. Retours

```ts
interface ReturnRequest {
  id: string;
  orderId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";
  reason: string;
  notes: string | null;
  collectionMethod: "ORIGINAL_ADDRESS" | "WAREHOUSE_DROPOFF" | "CUSTOM_ADDRESS";
  pickupRequest: PickupRequest | null;
  items: {
    id: string;
    orderItemId: string;
    quantity: number;
    condition: string | null;
  }[];
  createdAt: string;
}

interface PickupRequest {
  id: string;
  method: "ORIGINAL_ADDRESS" | "WAREHOUSE_DROPOFF" | "CUSTOM_ADDRESS";
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  pickupDate: string | null;
  deadline: string;
  address: UserAddress | null;
  warehouse: { id: string; name: string; location: string } | null;
}

interface CreateReturnRequest {
  order_id: string;
  reason: string;
  notes?: string;
  items: { order_item_id: string; condition?: string }[]; // min 1
  collection?: {
    method?: "ORIGINAL_ADDRESS" | "WAREHOUSE_DROPOFF" | "CUSTOM_ADDRESS";
    address_id?: string;
    warehouse_id?: string;
  };
}
```

| Action                 | Appel                                       | Auth |
| ---------------------- | ------------------------------------------- | ---- |
| Créer un retour        | `POST /returns` `CreateReturnRequest` (201) | User |
| Détail                 | `GET /returns/:returnId`                    | User |
| Retours d'une commande | `GET /orders/:orderId/returns`              | User |

⚠️ Commande doit être `DELIVERED`. Pas de retour partiel — chaque `order_item_id` retourne sa quantité complète. Une commande ne peut avoir qu'un retour actif (`PENDING`/`APPROVED`) à la fois. L'approbation par un admin crée automatiquement une `PickupRequest`, consultable via le champ `pickupRequest` de la réponse — pas besoin d'appeler une route dédiée.

---

## 11. Fidélité

```ts
interface LoyaltyBalance {
  userId: number;
  balance: number;
}

interface LoyaltyTransaction {
  id: string;
  points: number;
  type: "EARNED" | "REDEEMED" | "EXPIRED" | "ADJUSTED";
  orderId: string | null;
  createdAt: string;
}
```

| Action     | Appel                          | Auth            |
| ---------- | ------------------------------ | --------------- |
| Solde      | `GET /loyalty/:userId/balance` | User (soi-même) |
| Historique | `GET /loyalty/:userId/history` | User (soi-même) |

Barème par défaut : 1 point / 100 XAF, crédité à `DELIVERED`, reversal automatique si retour complété.

---

## 12. Méthodes de livraison

```ts
interface ShippingMethod {
  id: string;
  name: string;
  description: string | null;
  estimatedDays: number;
  basePrice: number;
  pricePerKg: number;
  zones: string[];
}
```

| Action          | Appel                                                                      | Auth   |
| --------------- | -------------------------------------------------------------------------- | ------ |
| Liste (actives) | `GET /shipping-methods` → `ShippingMethod[]`                               | Public |
| Détail          | `GET /shipping-methods/:methodId`                                          | Public |
| Simuler un coût | `POST /shipping-methods/calculate` `{ shippingMethodId, weight, country }` | Public |

400 si le pays n'est pas dans les `zones` de la méthode.

---

## 13. Promotions & Coupons

```ts
interface Promotion {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  images: string[];
  status: "SCHEDULED" | "ACTIVE" | "EXPIRED"; // recalculé à chaque lecture
  startDate: string;
  endDate: string;
  isFeaturedInHero: boolean;
  heroImages: string[];
  discounts: Discount[];
}

interface Discount {
  id: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  categoryId: string | null;
}

interface ValidateCouponRequest {
  code: string;
  basketId?: string;
  items?: { id: string; combinationId?: string; quantity: number }[];
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
```

| Action                       | Appel                                                                       | Auth   |
| ---------------------------- | --------------------------------------------------------------------------- | ------ |
| Page promotion par slug      | `GET /promotions/slug/:slug` → `Promotion`                                  | Public |
| Produits affectés (par slug) | `GET /promotions/slug/:slug/products`                                       | Public |
| Promotions actives           | `GET /promotions/active?page&limit&slot=hero`                               | Public |
| Valider un coupon            | `POST /coupons/validate` `ValidateCouponRequest` → `ValidateCouponResponse` | User   |

⚠️ Un coupon **n'a aucune réduction propre** — la remise vient exclusivement des `discounts` de la promotion liée. `status` est recalculé à chaque lecture, ne pas le mettre en cache localement trop longtemps.

⚠️ Après expiration d'une promotion, le prix remisé peut rester visible sur `/product` jusqu'à 5 min (TTL du cache Redis) — `/promotions/active` reflète l'état réel immédiatement.

---

## 14. Popups

```ts
interface Popup {
  id: string;
  title: string;
  imageUrl: string | null;
  message: string | null;
  ctaLabel: string | null;
  displayFrequency: "ONCE_PER_SESSION" | "ONCE_PER_DAY" | "ALWAYS";
  priority: number;
  resolvedUrl: string | null; // déjà résolu côté serveur, prêt à consommer
}
```

| Action        | Appel                            | Auth   |
| ------------- | -------------------------------- | ------ |
| Popups actifs | `GET /popups/active` → `Popup[]` | Public |

Ne jamais reconstruire `resolvedUrl` côté client — c'est déjà calculé.

---

## 15. Paramètres publics

```ts
interface PublicSetting {
  key: string;
  value: string; // parser en JSON si type JSON, cf. clé
  isPublic: true;
}
```

`GET /settings/public` → clés utiles : `store.currency`, `store.supported_countries`, `payments.enabled_methods`, `payments.unavailable_messages`, `uploads.max_file_size_mb`, `uploads.allowed_mime_types`. Point d'entrée recommandé pour initialiser la home page (devise, pays, moyens de paiement disponibles).

---

## 16. Gestion des erreurs

| Code | Traitement suggéré                                                          |
| ---- | --------------------------------------------------------------------------- |
| 400  | Afficher le message tel quel (validation ou règle métier)                   |
| 401  | Rediriger vers `/login`, purger le token                                    |
| 403  | Message générique ("Accès refusé" / "Compte désactivé")                     |
| 404  | Écran "introuvable" ou retour à la liste parente                            |
| 409  | Conflit (doublon email/username, avis déjà posté, retour déjà actif...)     |
| 429  | "Trop de requêtes, réessayez dans quelques minutes" (100 req / 15 min / IP) |
| 500  | Message générique + bouton "réessayer"                                      |
| 503  | Moyen de paiement indisponible — utiliser `message` retourné directement    |

---

_Document scindé à partir de `API_GUIDE.md` — ne couvre que les routes accessibles au visiteur non connecté ou à un client (`role: "USER"`). Pour le dashboard admin, voir `API_GUIDE_ADMIN.md`._
