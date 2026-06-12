# API_SPEC.md — Spécification des endpoints

## Conventions globales

### Base URL
```
https://api.ton-domaine.com
```

### Authentification
Toutes les routes (sauf `/signup` et `/login`) nécessitent :
```
Authorization: Bearer <accessToken>
```

### Format de réponse standard
```json
// Succès
{ "status": true, "data": { ... } }

// Erreur
{ "status": false, "error": { "message": "..." } }
```

### Codes HTTP utilisés
| Code | Usage |
|---|---|
| 200 | Succès général |
| 201 | Ressource créée |
| 400 | Requête invalide / validation échouée |
| 401 | Non authentifié |
| 403 | Non autorisé (rôle insuffisant) |
| 404 | Ressource introuvable |
| 409 | Conflit (ex. username déjà pris) |
| 500 | Erreur serveur |

---

## 1. User Management

### Authentication

#### POST /signup
Créer un compte utilisateur.
```json
// Body
{
  "username": "string",
  "email": "string",
  "password": "string",
  "firstName": "string",
  "lastName": "string",
  "age": "number",
  "role": "user | admin"   // optionnel, défaut: "user"
}
// Response 200 → { user, token }
```
> Script test : stocke automatiquement `token` dans `accessToken`.

#### POST /login
```json
// Body
{ "username": "string", "password": "string" }
// Response 200 → { user, token }
// Response 400 → username introuvable ou mot de passe incorrect
```

### User Profile

#### GET /user
Récupérer le profil de l'utilisateur connecté.
```json
// Response 200 → { id, username, email, age, role, firstName, lastName, createdAt, updatedAt }
```

#### PATCH /user
Mettre à jour son profil (champs partiels autorisés).
```json
// Body (partiel)
{ "age": 33, "firstName": "Harry" }
// Response 200 → profil mis à jour
```

### Admin

#### GET /user/all
`[ADMIN]` Récupérer tous les utilisateurs.

#### PATCH /user/change-role/:userId
`[ADMIN]` Changer le rôle d'un utilisateur.
```json
// Body
{ "role": "admin | user" }
```

#### DELETE /user/:userId
`[ADMIN]` Supprimer un utilisateur.

---

## 2. Warehouses

#### GET /warehouses — Liste des entrepôts
#### GET /warehouses/:warehouse_id — Détail d'un entrepôt
#### POST /warehouses — Créer un entrepôt
#### PUT /warehouses/:warehouse_id — Mettre à jour un entrepôt
#### DELETE /warehouses/:warehouse_id — Supprimer un entrepôt

```json
// Modèle Warehouse
{
  "warehouse_id": "string",
  "name": "string",
  "location": "string",
  "capacity": "number"
}
```

---

## 3. Inventory

#### GET /inventory?category=&location= — Liste du stock (filtrable)
#### GET /inventory/:item_id — Détail d'un article
#### POST /inventory — Ajouter un article au stock
#### PUT /inventory/:item_id — Mettre à jour un article
#### DELETE /inventory/:item_id — Supprimer un article
#### GET /inventory/low-stock?threshold=10 — Articles sous le seuil
#### GET /inventory/out-of-stock — Articles en rupture
#### GET /inventory/search?keyword=Shirt — Recherche
#### POST /inventory/transfer — Transfert entre entrepôts
```json
// Body transfer
{
  "item_id": "string",
  "from_warehouse": "string",
  "to_warehouse": "string",
  "quantity": "number"
}
```

---

## 4. Product Catalog

### Catalog management `[ADMIN]`

#### POST /product — Créer un produit
#### PATCH /product/:productId — Modifier un produit (partiel)
#### DELETE /product/:productId — Supprimer un produit

### Viewing products (public)

#### GET /product — Liste des produits
#### GET /product/:productId — Détail d'un produit

```json
// Modèle Product (réponse)
{
  "id": "number",
  "name": "string",
  "description": "string",
  "price": "number",
  "category": "string",
  "stock": "number",
  "images": ["string"]
}
```

---

## 5. Reviews & Ratings

#### GET /products/:pid/reviews — Avis d'un produit
#### GET /reviews/:rid — Détail d'un avis
#### POST /reviews — Soumettre un avis
```json
// Body
{
  "product_id": "number",
  "rating": "number (1-5)",
  "comment": "string"
}
```
#### PUT /reviews/:rid — Modifier un avis
#### DELETE /reviews/:rid — Supprimer un avis

---

## 6. Basket (Panier)

#### POST /basket — Créer un panier
```json
// Response 201 → { basket_id }
```

#### GET /basket/:basket_id — Récupérer un panier
#### POST /basket/:basket_id/product — Ajouter un produit
```json
// Body
{ "product_id": "number", "quantity": "number" }
```
#### PUT /basket/:basket_id/product/quantity — Modifier la quantité
#### DELETE /basket/:basket_id/product — Retirer un produit

---

## 7. Orders

#### POST /orders — Créer une commande
#### GET /orders/:orderId — Détail d'une commande
#### PUT /orders/:orderId — Mettre à jour une commande
#### DELETE /orders/:orderId — Annuler une commande
#### GET /orders?status=shipped&customer=john@example.com — Liste filtrée

### Gestion du statut

#### GET /orders/:orderId/status — Statut actuel
#### PUT /orders/:orderId/status — Mettre à jour le statut
```json
// Statuts possibles : PENDING | CONFIRMED | PROCESSING | SHIPPED | DELIVERED | CANCELLED
```

---

## 8. Checkout

#### POST /checkout — Initialiser un checkout
```json
// Body
{ "basket_id": "string", "shipping_address": "object", "payment_method_id": "string" }
// Response 201 → { checkout_id, total, items }
```

#### GET /checkout/:checkout_id — Récupérer un checkout
#### POST /checkout/:checkout_id/complete — Finaliser le checkout
> Déclenche la création de la commande et du paiement.

---

## 9. Payment Processing

### Payment Methods

#### GET /payment-methods — Méthodes de paiement de l'utilisateur
#### POST /payment-methods — Ajouter une méthode
#### PUT /payment-methods/:payment_method_id — Modifier
#### DELETE /payment-methods/:payment_method_id — Supprimer

### Transactions

#### GET /transactions?start_date=&end_date=&order_id= — Liste filtrée
#### GET /transactions/:transactionId — Détail
#### POST /transactions — Créer une transaction
#### PUT /transactions/:transactionId — Mettre à jour
#### DELETE /transactions/:transactionId — Supprimer

### Payments

#### POST /payments — Initier un paiement
#### GET /payments/:payment_id — Détail d'un paiement
#### PUT /payments/:payment_id — Mettre à jour
#### DELETE /payments/:payment_id — Annuler

### Refunds

#### POST /refunds — Créer un remboursement
#### GET /refunds/:refund_id — Détail
#### PUT /refunds/:refund_id — Mettre à jour
#### DELETE /refunds/:refund_id — Annuler

### Invoices

#### POST /invoices — Créer une facture
#### GET /invoices/:invoiceId — Détail
#### GET /invoices?status=pending&start_date=&end_date= — Liste filtrée
#### PUT /invoices/:invoiceId — Mettre à jour
#### POST /invoices/:invoiceId/cancel — Annuler
#### POST /invoices/:invoiceId/mark-as-paid — Marquer comme payée

### Webhooks

#### POST /webhooks — Créer un webhook
#### GET /webhooks/:webhook_id — Détail
#### PUT /webhooks/:webhook_id — Mettre à jour
#### DELETE /webhooks/:webhook_id — Supprimer
#### POST /webhooks/:webhook_id/verify?event=payment.created — Vérifier un événement

```json
// Événements webhook supportés
"payment.created" | "payment.succeeded" | "payment.failed"
"order.placed" | "order.shipped" | "order.delivered"
"refund.created" | "refund.processed"
```

---

## 10. Address Validation

#### POST /address/validate
```json
// Body
{
  "street": "string",
  "city": "string",
  "postal_code": "string",
  "country": "string"
}
// Response 200 → { valid: boolean, normalized_address: object }
```

---

## 11. Shipments

#### POST /shipments/cost — Calculer le coût d'expédition
```json
// Body
{ "origin": "string", "destination": "string", "weight": "number", "dimensions": "object" }
```

#### POST /shipments — Créer une expédition
#### GET /shipments/:shipmentId — Détail d'une expédition
#### POST /shipments/:shipmentId/track — Mettre à jour le tracking
#### GET /shipments/:shipmentId/track — Récupérer le tracking
#### POST /shipments/:shipmentId/cancel — Annuler une expédition

### Shipping Labels

#### GET /labels/:shipmentId — Récupérer l'étiquette (PDF/URL)

---

## 12. Pickup Requests

#### POST /pickup-requests — Créer une demande de collecte
```json
// Body
{ "pickup_date": "YYYY-MM-DD", "pickup_address": "string" }
// Response 201 → { request_id, pickup_date, pickup_address, status: "PENDING" }
```

#### GET /pickup-requests/:requestId — Détail d'une demande
#### POST /pickup-requests/:requestId/cancel — Annuler
> Utilise POST (pas DELETE) car la demande reste en historique avec status: "CANCELLED".

---

## Notes d'implémentation

- Le token JWT est stocké en variable de collection Postman (`accessToken`) via script `test` sur `/signup` et `/login`
- `POST /invoices/:invoiceId/mark-as-paid` apparaît deux fois dans la collection originale — à garder comme route unique
- Pas de pagination documentée dans la collection — à implémenter avec `?page=&limit=` sur toutes les routes de liste
- Le panier utilise `basket` (pas `cart`) — à garder cohérent dans tout le codebase
