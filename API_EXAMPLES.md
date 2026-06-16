# Exemples de requêtes API — E-commerce API

Ce fichier regroupe un exemple de requête (`curl`) et de réponse pour chaque endpoint de l'API.

- URL de base utilisée : `http://localhost:3000`
- `$TOKEN` : token JWT d'un utilisateur standard (obtenu via `/login` ou `/signup`)
- `$ADMIN_TOKEN` : token JWT d'un utilisateur ayant le rôle `admin`
- Toutes les requêtes avec un body JSON doivent inclure l'en-tête `Content-Type: application/json`

---

## 1. Authentification

### Inscription — `POST /signup`

```bash
curl -X POST http://localhost:3000/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "age": 28
  }'
```

```json
{
  "status": true,
  "data": {
    "user": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "age": 28,
      "role": "user",
      "createdAt": "2026-06-15T10:00:00.000Z",
      "updatedAt": "2026-06-15T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Connexion — `POST /login`

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "password123"
  }'
```

```json
{
  "status": true,
  "data": {
    "user": {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "age": 28,
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

## 2. Utilisateurs

### Profil courant — `GET /user`

```bash
curl http://localhost:3000/user \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "age": 28,
    "role": "user"
  }
}
```

### Mise à jour du profil — `PATCH /user`

```bash
curl -X PATCH http://localhost:3000/user \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jonathan",
    "age": 29
  }'
```

```json
{
  "status": true,
  "data": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "firstName": "Jonathan",
    "lastName": "Doe",
    "age": 29,
    "role": "user"
  }
}
```

### Liste de tous les utilisateurs (admin) — `GET /user/all`

```bash
curl http://localhost:3000/user/all \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

```json
{
  "status": true,
  "data": [
    {
      "id": 1,
      "username": "johndoe",
      "email": "john@example.com",
      "role": "user"
    },
    {
      "id": 2,
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin"
    }
  ]
}
```

### Changer le rôle d'un utilisateur (admin) — `PATCH /user/change-role/:userId`

```bash
curl -X PATCH http://localhost:3000/user/change-role/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "role": "admin" }'
```

```json
{
  "status": true,
  "data": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "admin"
  }
}
```

### Supprimer un utilisateur (admin) — `DELETE /user/:userId`

```bash
curl -X DELETE http://localhost:3000/user/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

```json
{
  "status": true,
  "data": { "numberOfUsersDeleted": 1 }
}
```

---

## 3. Produits

### Liste paginée — `GET /product`

```bash
curl "http://localhost:3000/product?page=1&limit=20"
```

```json
{
  "status": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "T-shirt en coton",
        "description": "T-shirt 100% coton, coupe regular",
        "price": 9990,
        "category": "Vêtements",
        "stock": 50,
        "images": [],
        "createdAt": "2026-06-15T10:00:00.000Z",
        "updatedAt": "2026-06-15T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### Détail d'un produit — `GET /product/:productId`

```bash
curl http://localhost:3000/product/1
```

```json
{
  "status": true,
  "data": {
    "id": 1,
    "name": "T-shirt en coton",
    "description": "T-shirt 100% coton, coupe regular",
    "price": 9990,
    "category": "Vêtements",
    "stock": 50,
    "images": [],
    "createdAt": "2026-06-15T10:00:00.000Z",
    "updatedAt": "2026-06-15T10:00:00.000Z"
  }
}
```

### Créer un produit (admin) — `POST /product`

```bash
curl -X POST http://localhost:3000/product \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "T-shirt en coton",
    "description": "T-shirt 100% coton, coupe regular",
    "price": 9990,
    "category": "Vêtements",
    "stock": 50
  }'
```

```json
{
  "status": true,
  "data": {
    "id": 1,
    "name": "T-shirt en coton",
    "description": "T-shirt 100% coton, coupe regular",
    "price": 9990,
    "category": "Vêtements",
    "stock": 50,
    "images": [],
    "createdAt": "2026-06-15T10:00:00.000Z",
    "updatedAt": "2026-06-15T10:00:00.000Z"
  }
}
```

### Mettre à jour un produit (admin) — `PATCH /product/:productId`

```bash
curl -X PATCH http://localhost:3000/product/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "price": 8990, "stock": 40 }'
```

```json
{
  "status": true,
  "data": {
    "id": 1,
    "name": "T-shirt en coton",
    "price": 8990,
    "stock": 40,
    "category": "Vêtements",
    "images": []
  }
}
```

### Supprimer un produit (admin) — `DELETE /product/:productId`

```bash
curl -X DELETE http://localhost:3000/product/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

```json
{
  "status": true,
  "data": { "numberOfProductsDeleted": 1 }
}
```

### Uploader des images (admin) — `POST /product/:productId/images`

```bash
curl -X POST http://localhost:3000/product/1/images \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "images=@/chemin/vers/photo1.jpg" \
  -F "images=@/chemin/vers/photo2.png"
```

```json
{
  "status": true,
  "data": {
    "id": 1,
    "name": "T-shirt en coton",
    "images": [
      "https://<account_id>.r2.cloudflarestorage.com/products/products/3f1c...jpg",
      "https://<account_id>.r2.cloudflarestorage.com/products/products/9ab2...png"
    ]
  }
}
```

### Supprimer une image (admin) — `DELETE /product/:productId/images`

```bash
curl -X DELETE http://localhost:3000/product/1/images \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://<account_id>.r2.cloudflarestorage.com/products/products/3f1c...jpg"
  }'
```

```json
{
  "status": true,
  "data": {
    "id": 1,
    "name": "T-shirt en coton",
    "images": [
      "https://<account_id>.r2.cloudflarestorage.com/products/products/9ab2...png"
    ]
  }
}
```

---

## 4. Panier

### Créer un panier — `POST /basket`

```bash
curl -X POST http://localhost:3000/basket \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_basket_123",
    "userId": 1,
    "items": [],
    "createdAt": "2026-06-15T10:00:00.000Z",
    "updatedAt": "2026-06-15T10:00:00.000Z"
  }
}
```

### Récupérer un panier — `GET /basket/:basket_id`

```bash
curl http://localhost:3000/basket/ck_basket_123 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_basket_123",
    "userId": 1,
    "items": [
      {
        "id": "ck_item_1",
        "basketId": "ck_basket_123",
        "productId": 1,
        "quantity": 2,
        "product": {
          "id": 1,
          "name": "T-shirt en coton",
          "price": 9990
        }
      }
    ]
  }
}
```

### Ajouter un produit — `POST /basket/:basket_id/product`

```bash
curl -X POST http://localhost:3000/basket/ck_basket_123/product \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "product_id": 1, "quantity": 2 }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_basket_123",
    "userId": 1,
    "items": [
      {
        "id": "ck_item_1",
        "productId": 1,
        "quantity": 2,
        "product": { "id": 1, "name": "T-shirt en coton", "price": 9990 }
      }
    ]
  }
}
```

### Modifier la quantité — `PUT /basket/:basket_id/product/quantity`

```bash
curl -X PUT http://localhost:3000/basket/ck_basket_123/product/quantity \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "product_id": 1, "quantity": 5 }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_basket_123",
    "items": [
      {
        "id": "ck_item_1",
        "productId": 1,
        "quantity": 5,
        "product": { "id": 1, "name": "T-shirt en coton", "price": 9990 }
      }
    ]
  }
}
```

### Retirer un produit — `DELETE /basket/:basket_id/product`

```bash
curl -X DELETE http://localhost:3000/basket/ck_basket_123/product \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "product_id": 1 }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_basket_123",
    "items": []
  }
}
```

---

## 5. Commandes

### Liste des commandes — `GET /orders`

```bash
curl "http://localhost:3000/orders?status=PENDING&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "items": [
      {
        "id": "ck_order_123",
        "userId": 1,
        "status": "PENDING",
        "totalAmount": 19980,
        "shippingAddress": {
          "street": "12 Rue de la Paix",
          "city": "Yaoundé",
          "country": "CM",
          "postalCode": "00237"
        },
        "items": [
          { "id": "ck_oi_1", "productId": 1, "quantity": 2, "price": 9990 }
        ]
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### Créer une commande — `POST /orders`

```bash
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "id": "1", "quantity": 2 }
    ],
    "shippingAddress": {
      "street": "12 Rue de la Paix",
      "city": "Yaoundé",
      "country": "CM",
      "postalCode": "00237"
    },
    "notes": "Livrer après 18h"
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_order_123",
    "userId": 1,
    "status": "PENDING",
    "totalAmount": 19980,
    "shippingAddress": {
      "street": "12 Rue de la Paix",
      "city": "Yaoundé",
      "country": "CM",
      "postalCode": "00237"
    },
    "notes": "Livrer après 18h",
    "items": [
      { "id": "ck_oi_1", "productId": 1, "quantity": 2, "price": 9990 }
    ]
  }
}
```

### Détail d'une commande — `GET /orders/:orderId`

```bash
curl http://localhost:3000/orders/ck_order_123 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_order_123",
    "userId": 1,
    "status": "PENDING",
    "totalAmount": 19980,
    "items": [
      { "id": "ck_oi_1", "productId": 1, "quantity": 2, "price": 9990 }
    ]
  }
}
```

### Mettre à jour une commande — `PUT /orders/:orderId`

```bash
curl -X PUT http://localhost:3000/orders/ck_order_123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Livrer le matin de préférence"
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_order_123",
    "notes": "Livrer le matin de préférence",
    "status": "PENDING"
  }
}
```

### Supprimer/annuler une commande — `DELETE /orders/:orderId`

```bash
curl -X DELETE http://localhost:3000/orders/ck_order_123 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": { "message": "Order cancelled successfully" }
}
```

### Statut d'une commande — `GET /orders/:orderId/status`

```bash
curl http://localhost:3000/orders/ck_order_123/status \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_order_123",
    "status": "PENDING"
  }
}
```

### Mettre à jour le statut — `PUT /orders/:orderId/status`

```bash
curl -X PUT http://localhost:3000/orders/ck_order_123/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "SHIPPED",
    "shippingCarrier": "DHL",
    "trackingNumber": "DHL123456789",
    "estimatedDeliveryDate": "2026-06-22"
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_order_123",
    "status": "SHIPPED"
  }
}
```

---

## 6. Checkout

### Créer un checkout — `POST /checkout`

```bash
curl -X POST http://localhost:3000/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "basket_id": "ck_basket_123",
    "shipping_address": {
      "street": "12 Rue de la Paix",
      "city": "Yaoundé",
      "country": "CM",
      "postalCode": "00237"
    }
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_checkout_123",
    "userId": 1,
    "basketId": "ck_basket_123",
    "status": "PENDING",
    "total": 19980,
    "items": [
      { "productId": 1, "name": "T-shirt en coton", "price": 9990, "quantity": 2 }
    ],
    "shippingAddress": {
      "street": "12 Rue de la Paix",
      "city": "Yaoundé",
      "country": "CM",
      "postalCode": "00237"
    }
  }
}
```

### Détail d'un checkout — `GET /checkout/:checkout_id`

```bash
curl http://localhost:3000/checkout/ck_checkout_123 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_checkout_123",
    "status": "PENDING",
    "total": 19980,
    "items": [
      { "productId": 1, "name": "T-shirt en coton", "price": 9990, "quantity": 2 }
    ]
  }
}
```

### Finaliser un checkout — `POST /checkout/:checkout_id/complete`

```bash
curl -X POST http://localhost:3000/checkout/ck_checkout_123/complete \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_checkout_123",
    "status": "COMPLETED",
    "orderId": "ck_order_123",
    "total": 19980
  }
}
```

---

## 7. Paiements

### Méthodes disponibles — `GET /payment-methods`

```bash
curl http://localhost:3000/payment-methods
```

```json
{
  "status": true,
  "data": [
    {
      "id": "CASH_ON_DELIVERY",
      "name": "Cash on Delivery",
      "description": "Pay in cash upon delivery of your order.",
      "available": true
    },
    {
      "id": "PAYPAL",
      "name": "PayPal",
      "description": "Pay with PayPal.",
      "available": false,
      "message": "PayPal payment is not available yet. Coming soon."
    },
    {
      "id": "STRIPE",
      "name": "Stripe",
      "description": "Pay with credit or debit card via Stripe.",
      "available": false,
      "message": "Stripe payment is not available yet. Coming soon."
    },
    {
      "id": "CINETPAY",
      "name": "CinetPay",
      "description": "Pay with CinetPay (Mobile Money, Orange Money, etc.).",
      "available": false,
      "message": "CinetPay payment is not available yet. Coming soon."
    }
  ]
}
```

### Créer un paiement — `POST /payments`

```bash
curl -X POST http://localhost:3000/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "ck_order_123",
    "method": "CASH_ON_DELIVERY",
    "notes": "Paiement à la livraison"
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_payment_123",
    "orderId": "ck_order_123",
    "userId": 1,
    "method": "CASH_ON_DELIVERY",
    "status": "PENDING",
    "amount": 19980,
    "currency": "XAF",
    "notes": "Paiement à la livraison"
  }
}
```

> ⚠️ Avec `method: "PAYPAL"`, `"STRIPE"` ou `"CINETPAY"`, l'API renvoie une erreur `503` :
> ```json
> { "status": false, "error": { "message": "Stripe payment is not available yet. Coming soon." } }
> ```

### Détail d'un paiement — `GET /payments/:payment_id`

```bash
curl http://localhost:3000/payments/ck_payment_123 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_payment_123",
    "orderId": "ck_order_123",
    "method": "CASH_ON_DELIVERY",
    "status": "PENDING",
    "amount": 19980,
    "currency": "XAF"
  }
}
```

### Paiements d'une commande — `GET /orders/:orderId/payments`

```bash
curl http://localhost:3000/orders/ck_order_123/payments \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": [
    {
      "id": "ck_payment_123",
      "orderId": "ck_order_123",
      "method": "CASH_ON_DELIVERY",
      "status": "PENDING",
      "amount": 19980,
      "currency": "XAF"
    }
  ]
}
```

---

## 8. Avis produits

### Avis d'un produit — `GET /products/:pid/reviews`

```bash
curl http://localhost:3000/products/1/reviews
```

```json
{
  "status": true,
  "data": {
    "product_id": 1,
    "average_rating": 4.5,
    "total_reviews": 2,
    "reviews": [
      {
        "id": "ck_review_1",
        "productId": 1,
        "userId": 1,
        "rating": 5,
        "comment": "Excellent produit !",
        "user": { "id": 1, "username": "johndoe", "firstName": "John", "lastName": "Doe" }
      },
      {
        "id": "ck_review_2",
        "productId": 1,
        "userId": 2,
        "rating": 4,
        "comment": "Bonne qualité, livraison rapide.",
        "user": { "id": 2, "username": "janedoe", "firstName": "Jane", "lastName": "Doe" }
      }
    ]
  }
}
```

### Détail d'un avis — `GET /reviews/:rid`

```bash
curl http://localhost:3000/reviews/ck_review_1
```

```json
{
  "status": true,
  "data": {
    "id": "ck_review_1",
    "productId": 1,
    "userId": 1,
    "rating": 5,
    "comment": "Excellent produit !",
    "user": { "id": 1, "username": "johndoe", "firstName": "John", "lastName": "Doe" }
  }
}
```

### Créer un avis — `POST /reviews`

```bash
curl -X POST http://localhost:3000/reviews \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "rating": 5,
    "comment": "Excellent produit !"
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_review_1",
    "productId": 1,
    "userId": 1,
    "rating": 5,
    "comment": "Excellent produit !"
  }
}
```

### Modifier un avis — `PUT /reviews/:rid`

```bash
curl -X PUT http://localhost:3000/reviews/ck_review_1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 4,
    "comment": "Très bon produit, un peu cher."
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_review_1",
    "productId": 1,
    "userId": 1,
    "rating": 4,
    "comment": "Très bon produit, un peu cher."
  }
}
```

### Supprimer un avis — `DELETE /reviews/:rid`

```bash
curl -X DELETE http://localhost:3000/reviews/ck_review_1 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": { "id": "ck_review_1" }
}
```

---

## 9. Entrepôts

### Liste des entrepôts — `GET /warehouses`

```bash
curl http://localhost:3000/warehouses \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": [
    {
      "id": "ck_warehouse_1",
      "name": "Entrepôt Yaoundé",
      "location": "Yaoundé, Cameroun",
      "capacity": 1000
    }
  ]
}
```

### Détail d'un entrepôt — `GET /warehouses/:warehouse_id`

```bash
curl http://localhost:3000/warehouses/ck_warehouse_1 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_warehouse_1",
    "name": "Entrepôt Yaoundé",
    "location": "Yaoundé, Cameroun",
    "capacity": 1000
  }
}
```

### Créer un entrepôt (admin) — `POST /warehouses`

```bash
curl -X POST http://localhost:3000/warehouses \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Entrepôt Douala",
    "location": "Douala, Cameroun",
    "capacity": 2000
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_warehouse_2",
    "name": "Entrepôt Douala",
    "location": "Douala, Cameroun",
    "capacity": 2000
  }
}
```

### Mettre à jour un entrepôt (admin) — `PUT /warehouses/:warehouse_id`

```bash
curl -X PUT http://localhost:3000/warehouses/ck_warehouse_2 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "capacity": 2500 }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_warehouse_2",
    "name": "Entrepôt Douala",
    "location": "Douala, Cameroun",
    "capacity": 2500
  }
}
```

### Supprimer un entrepôt (admin) — `DELETE /warehouses/:warehouse_id`

```bash
curl -X DELETE http://localhost:3000/warehouses/ck_warehouse_2 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

```json
{
  "status": true,
  "data": { "message": "Warehouse deleted successfully" }
}
```

---

## 10. Inventaire

### Liste de l'inventaire — `GET /inventory`

```bash
curl "http://localhost:3000/inventory?category=Vêtements&location=Yaoundé" \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": [
    {
      "id": "ck_inv_1",
      "productId": 1,
      "warehouseId": "ck_warehouse_1",
      "quantity": 50,
      "product": { "id": 1, "name": "T-shirt en coton", "category": "Vêtements" },
      "warehouse": { "id": "ck_warehouse_1", "name": "Entrepôt Yaoundé", "location": "Yaoundé, Cameroun" }
    }
  ]
}
```

### Articles à faible stock — `GET /inventory/low-stock`

```bash
curl "http://localhost:3000/inventory/low-stock?threshold=10" \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": [
    {
      "id": "ck_inv_2",
      "productId": 2,
      "warehouseId": "ck_warehouse_1",
      "quantity": 3,
      "product": { "id": 2, "name": "Casquette" },
      "warehouse": { "id": "ck_warehouse_1", "name": "Entrepôt Yaoundé" }
    }
  ]
}
```

### Articles en rupture de stock — `GET /inventory/out-of-stock`

```bash
curl http://localhost:3000/inventory/out-of-stock \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": [
    {
      "id": "ck_inv_3",
      "productId": 3,
      "warehouseId": "ck_warehouse_1",
      "quantity": 0,
      "product": { "id": 3, "name": "Sac à dos" },
      "warehouse": { "id": "ck_warehouse_1", "name": "Entrepôt Yaoundé" }
    }
  ]
}
```

### Recherche par nom de produit — `GET /inventory/search`

```bash
curl "http://localhost:3000/inventory/search?keyword=shirt" \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": [
    {
      "id": "ck_inv_1",
      "productId": 1,
      "warehouseId": "ck_warehouse_1",
      "quantity": 50,
      "product": { "id": 1, "name": "T-shirt en coton" },
      "warehouse": { "id": "ck_warehouse_1", "name": "Entrepôt Yaoundé" }
    }
  ]
}
```

### Détail d'un article de stock — `GET /inventory/:item_id`

```bash
curl http://localhost:3000/inventory/ck_inv_1 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_inv_1",
    "productId": 1,
    "warehouseId": "ck_warehouse_1",
    "quantity": 50,
    "product": { "id": 1, "name": "T-shirt en coton" },
    "warehouse": { "id": "ck_warehouse_1", "name": "Entrepôt Yaoundé" }
  }
}
```

### Créer une entrée de stock (admin) — `POST /inventory`

```bash
curl -X POST http://localhost:3000/inventory \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "warehouse_id": "ck_warehouse_1",
    "quantity": 50
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_inv_1",
    "productId": 1,
    "warehouseId": "ck_warehouse_1",
    "quantity": 50,
    "product": { "id": 1, "name": "T-shirt en coton" },
    "warehouse": { "id": "ck_warehouse_1", "name": "Entrepôt Yaoundé" }
  }
}
```

### Mettre à jour une entrée de stock (admin) — `PUT /inventory/:item_id`

```bash
curl -X PUT http://localhost:3000/inventory/ck_inv_1 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "quantity": 45 }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_inv_1",
    "productId": 1,
    "warehouseId": "ck_warehouse_1",
    "quantity": 45
  }
}
```

### Supprimer une entrée de stock (admin) — `DELETE /inventory/:item_id`

```bash
curl -X DELETE http://localhost:3000/inventory/ck_inv_1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

```json
{
  "status": true,
  "data": { "message": "Inventory item deleted successfully" }
}
```

### Transférer du stock (admin) — `POST /inventory/transfer`

```bash
curl -X POST http://localhost:3000/inventory/transfer \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": "ck_inv_1",
    "from_warehouse": "ck_warehouse_1",
    "to_warehouse": "ck_warehouse_2",
    "quantity": 10
  }'
```

```json
{
  "status": true,
  "data": {
    "item_id": "ck_inv_1",
    "from_warehouse": "ck_warehouse_1",
    "to_warehouse": "ck_warehouse_2",
    "quantity": 10
  }
}
```

---

## 11. Expéditions & enlèvements

### Calculer le coût d'expédition — `POST /shipments/cost`

```bash
curl -X POST http://localhost:3000/shipments/cost \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "Yaoundé",
    "destination": "Douala",
    "weight": 2.5,
    "dimensions": { "length": 30, "width": 20, "height": 10 }
  }'
```

```json
{
  "status": true,
  "data": { "cost": 5.25, "currency": "XAF" }
}
```

### Créer une expédition — `POST /shipments`

```bash
curl -X POST http://localhost:3000/shipments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sender_name": "Boutique ABC",
    "sender_address": "10 Avenue Kennedy, Yaoundé",
    "recipient_name": "John Doe",
    "recipient_address": "12 Rue de la Paix, Yaoundé",
    "weight": 2.5,
    "dimensions": { "length": 30, "width": 20, "height": 10 },
    "order_id": "ck_order_123"
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_shipment_1",
    "orderId": "ck_order_123",
    "senderName": "Boutique ABC",
    "senderAddress": "10 Avenue Kennedy, Yaoundé",
    "recipientName": "John Doe",
    "recipientAddress": "12 Rue de la Paix, Yaoundé",
    "weight": 2.5,
    "dimensions": { "length": 30, "width": 20, "height": 10 },
    "status": "PENDING",
    "trackingNumber": "K3J9XQ2P1A",
    "estimatedDeliveryDate": "2026-06-22",
    "trackingEvents": [],
    "label": null
  }
}
```

### Détail d'une expédition — `GET /shipments/:shipmentId`

```bash
curl http://localhost:3000/shipments/ck_shipment_1 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_shipment_1",
    "status": "PENDING",
    "trackingNumber": "K3J9XQ2P1A",
    "estimatedDeliveryDate": "2026-06-22",
    "trackingEvents": [],
    "label": null
  }
}
```

### Ajouter un événement de suivi — `POST /shipments/:shipmentId/track`

```bash
curl -X POST http://localhost:3000/shipments/ck_shipment_1/track \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_TRANSIT",
    "location": "Centre de tri Douala"
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_shipment_1",
    "status": "IN_TRANSIT",
    "trackingEvents": [
      {
        "id": "ck_te_1",
        "shipmentId": "ck_shipment_1",
        "status": "IN_TRANSIT",
        "location": "Centre de tri Douala",
        "createdAt": "2026-06-16T08:00:00.000Z"
      }
    ]
  }
}
```

### Suivi d'une expédition — `GET /shipments/:shipmentId/track`

```bash
curl http://localhost:3000/shipments/ck_shipment_1/track \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "current_status": "IN_TRANSIT",
    "current_location": "Centre de tri Douala",
    "updates": [
      {
        "id": "ck_te_1",
        "status": "IN_TRANSIT",
        "location": "Centre de tri Douala",
        "createdAt": "2026-06-16T08:00:00.000Z"
      }
    ]
  }
}
```

### Annuler une expédition — `POST /shipments/:shipmentId/cancel`

```bash
curl -X POST http://localhost:3000/shipments/ck_shipment_1/cancel \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_shipment_1",
    "status": "CANCELLED"
  }
}
```

### Récupérer l'étiquette — `GET /labels/:shipmentId`

```bash
curl http://localhost:3000/labels/ck_shipment_1 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "label_id": "ck_label_1",
    "label_url": "https://labels.ecommerce-api.com/ck_shipment_1.pdf"
  }
}
```

### Créer une demande d'enlèvement — `POST /pickup-requests`

```bash
curl -X POST http://localhost:3000/pickup-requests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pickup_date": "2026-06-18",
    "pickup_address": "10 Avenue Kennedy, Yaoundé"
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_pickup_1",
    "userId": 1,
    "pickupDate": "2026-06-18",
    "pickupAddress": "10 Avenue Kennedy, Yaoundé",
    "status": "PENDING"
  }
}
```

### Détail d'une demande d'enlèvement — `GET /pickup-requests/:requestId`

```bash
curl http://localhost:3000/pickup-requests/ck_pickup_1 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_pickup_1",
    "userId": 1,
    "pickupDate": "2026-06-18",
    "pickupAddress": "10 Avenue Kennedy, Yaoundé",
    "status": "PENDING"
  }
}
```

### Annuler une demande d'enlèvement — `POST /pickup-requests/:requestId/cancel`

```bash
curl -X POST http://localhost:3000/pickup-requests/ck_pickup_1/cancel \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_pickup_1",
    "status": "CANCELLED"
  }
}
```

---

## 12. Adresses

### Valider une adresse — `POST /address/validate`

```bash
curl -X POST http://localhost:3000/address/validate \
  -H "Content-Type: application/json" \
  -d '{
    "street": "12 Rue de la Paix",
    "city": "Yaoundé",
    "country": "CM",
    "postal_code": "00237"
  }'
```

```json
{
  "status": true,
  "data": {
    "valid": true,
    "normalized_address": {
      "street": "12 Rue de la Paix",
      "city": "Yaoundé",
      "state": null,
      "country": "CM",
      "postal_code": "00237"
    }
  }
}
```

### Liste des adresses — `GET /addresses`

```bash
curl http://localhost:3000/addresses \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": [
    {
      "id": "ck_address_1",
      "userId": 1,
      "street": "12 Rue de la Paix",
      "city": "Yaoundé",
      "country": "CM",
      "postalCode": "00237",
      "isDefault": true
    }
  ]
}
```

### Détail d'une adresse — `GET /addresses/:addressId`

```bash
curl http://localhost:3000/addresses/ck_address_1 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": {
    "id": "ck_address_1",
    "userId": 1,
    "street": "12 Rue de la Paix",
    "city": "Yaoundé",
    "country": "CM",
    "postalCode": "00237",
    "isDefault": true
  }
}
```

### Créer une adresse — `POST /addresses`

```bash
curl -X POST http://localhost:3000/addresses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "street": "12 Rue de la Paix",
    "city": "Yaoundé",
    "country": "CM",
    "postalCode": "00237",
    "isDefault": true
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_address_1",
    "userId": 1,
    "street": "12 Rue de la Paix",
    "city": "Yaoundé",
    "country": "CM",
    "postalCode": "00237",
    "isDefault": true
  }
}
```

### Mettre à jour une adresse — `PATCH /addresses/:addressId`

```bash
curl -X PATCH http://localhost:3000/addresses/ck_address_1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "street": "15 Avenue Foch",
    "city": "Yaoundé"
  }'
```

```json
{
  "status": true,
  "data": {
    "id": "ck_address_1",
    "userId": 1,
    "street": "15 Avenue Foch",
    "city": "Yaoundé",
    "country": "CM",
    "postalCode": "00237",
    "isDefault": true
  }
}
```

### Supprimer une adresse — `DELETE /addresses/:addressId`

```bash
curl -X DELETE http://localhost:3000/addresses/ck_address_1 \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "status": true,
  "data": { "message": "Address deleted successfully" }
}
```

---

## 13. Exemples de réponses d'erreur

### Validation échouée — `400`

```json
{
  "status": false,
  "error": {
    "message": "Validation failed",
    "details": {
      "fieldErrors": {
        "email": ["Invalid email"]
      }
    }
  }
}
```

### Non authentifié — `401`

```json
{
  "status": false,
  "error": { "message": "Auth headers not provided in the request." }
}
```

### Accès interdit (rôle insuffisant) — `403`

```json
{
  "status": false,
  "error": { "message": "You need to be a admin to access this endpoint." }
}
```

### Ressource introuvable — `404`

```json
{
  "status": false,
  "error": { "message": "Product not found" }
}
```

### Conflit — `409`

```json
{
  "status": false,
  "error": { "message": "Username already taken" }
}
```
