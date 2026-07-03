 Avant les diagrammes, une précision importante sur le code actuel : **`Order.status` et `Shipment.status` ne sont pas synchronisés automatiquement**. Ce sont deux machines à états indépendantes que l'admin fait évoluer manuellement chacune de son côté — je le note explicitement dans le 3ᵉ diagramme parce que ça change la lecture de "leur relation".

---

## 1. Cycle de vie de `Order.status`

Basé sur `order.state-machine.ts` (`TRANSITIONS`) et les appelants réels (`payment.service.ts`, `order.controller.ts`, `return.service.ts`).

```mermaid
stateDiagram-v2
    [*] --> PENDING: POST /orders (création)

    PENDING --> CONFIRMED: POST /payments réussi\n(quelle que soit la méthode,\nmême CASH_ON_DELIVERY)\nOU PUT /orders/:id/status (admin)
    PENDING --> CANCELLED: DELETE /orders/:id (owner ou admin)\nOU PUT /orders/:id/status (admin)

    CONFIRMED --> PROCESSING: PUT /orders/:id/status (admin uniquement)
    CONFIRMED --> CANCELLED: DELETE /orders/:id\nOU PUT /orders/:id/status (admin)

    PROCESSING --> SHIPPED: PUT /orders/:id/status (admin uniquement)
    PROCESSING --> CANCELLED: DELETE /orders/:id\nOU PUT /orders/:id/status (admin)

    SHIPPED --> DELIVERED: PUT /orders/:id/status (admin uniquement)\n→ déclenche loyaltyService.earnFromOrder()\n(1 point / 100 XAF dépensés)

    DELIVERED --> REFUNDED: return.service.updateStatus()\nquand un ReturnRequest lié passe à COMPLETED

    CANCELLED --> [*]: état terminal — aucune transition possible
    REFUNDED --> [*]: état terminal — aucune transition possible

    note right of CANCELLED
        Toute transition vers CANCELLED
        déclenche releaseReservedStock() :
        le stock réservé (OrderItemReservation)
        est restitué entrepôt par entrepôt.
    end note

    note right of SHIPPED
        SHIPPED ne peut PAS revenir en arrière.
        Une transition invalide (ex: DELIVERED
        → PROCESSING) lève une AppError 400
        via assertValidTransition().
    end note
```

**Résumé des conditions par transition :**

| De → Vers | Déclencheur | Garde-fou dans le code |
|---|---|---|
| `PENDING → CONFIRMED` | Paiement créé (`POST /payments`) ou admin | Aucune — toute méthode de paiement valide confirme, même COD non encaissé |
| `PENDING/CONFIRMED/PROCESSING → CANCELLED` | `DELETE /orders/:id` (owner ou admin) | `assertValidTransition` vérifie que l'état courant autorise `CANCELLED` |
| `CONFIRMED → PROCESSING`, `PROCESSING → SHIPPED`, `SHIPPED → DELIVERED` | `PUT /orders/:id/status` | Réservé à `adminGuard` |
| `SHIPPED → DELIVERED` | idem | Crédite les points fidélité une seule fois (vérifie `oldStatus !== DELIVERED`) |
| `DELIVERED → REFUNDED` | Retour complété | Piloté par `returnService`, pas directement par l'admin sur `/orders` |
| Toute transition non listée | — | `assertValidTransition` lève `400 Invalid order status transition: X -> Y` |

---

## 2. Cycle de vie de `Shipment.status`

Basé sur l'enum `ShipmentStatus` et les gardes dans `shipment.service.ts` (`updateStatus`, `cancel`, `addTrackingEvent`).

```mermaid
stateDiagram-v2
    [*] --> PENDING: POST /shipments (admin)\nestimatedDeliveryDate = +7 jours par défaut

    PENDING --> IN_TRANSIT: PUT /shipments/:id/status\nOU POST /shipments/:id/track\navec shipment_status fourni
    PENDING --> DELIVERED: PUT /shipments/:id/status\n(saut direct autorisé, pas de contrôle\nde passage obligé par IN_TRANSIT)
    PENDING --> CANCELLED: POST /shipments/:id/cancel

    IN_TRANSIT --> IN_TRANSIT: POST /shipments/:id/track\n(ajoute un événement de suivi\nsans changer le statut officiel)
    IN_TRANSIT --> DELIVERED: PUT /shipments/:id/status\nOU track avec shipment_status=DELIVERED
    IN_TRANSIT --> CANCELLED: POST /shipments/:id/cancel

    DELIVERED --> DELIVERED: seule transition autorisée\n(idempotence — pas de retour arrière)

    CANCELLED --> [*]: état terminal — aucune transition possible
    DELIVERED --> [*]: état terminal — aucune transition possible

    note right of CANCELLED
        POST /shipments/:id/cancel :
        400 si déjà CANCELLED
    end note

    note right of DELIVERED
        shipment.service.updateStatus() :
        si status actuel === DELIVERED et
        nouveau statut !== DELIVERED → 400
        "Cannot change status of a delivered shipment"
    end note

    note right of CANCELLED
        shipment.service.updateStatus() :
        si status actuel === CANCELLED →
        400 "Cannot change status of a
        cancelled shipment" (toute tentative)
    end note
```

**Résumé des conditions par transition :**

| De → Vers | Déclencheur | Garde-fou dans le code |
|---|---|---|
| `PENDING → IN_TRANSIT/DELIVERED` | `PUT /shipments/:id/status` (admin) ou `POST /shipments/:id/track` avec `shipment_status` | Aucune restriction de saut (PENDING peut aller directement à DELIVERED) |
| `IN_TRANSIT → IN_TRANSIT` | `POST /shipments/:id/track` sans `shipment_status` | Ajoute juste une ligne `TrackingEvent`, ne touche pas au statut officiel |
| `* → CANCELLED` | `POST /shipments/:id/cancel` | 400 si déjà `CANCELLED` |
| `DELIVERED → *` (autre que DELIVERED) | — | Bloqué : 400 explicite |
| `CANCELLED → *` | — | Bloqué : 400 explicite |

---

## 3. Relation Order ↔ Shipment — ce qui existe réellement

```mermaid
sequenceDiagram
    participant U as Client
    participant O as Order
    participant P as Payment
    participant A as Admin
    participant S as Shipment

    U->>O: POST /orders
    Note over O: status = PENDING
    O->>O: Réservation FIFO du stock\n(OrderItemReservation créées)

    U->>P: POST /payments
    P->>O: updateStatus(CONFIRMED)
    Note over O: status = CONFIRMED

    A->>O: PUT /orders/:id/status {PROCESSING}
    Note over O: status = PROCESSING

    A->>S: POST /shipments {order_id: order.id}
    Note over S: status = PENDING\n(Shipment.orderId lie les deux,\nmais Order.status n'est PAS\nmis à jour automatiquement ici)

    A->>S: PUT /shipments/:id/status {IN_TRANSIT}
    Note over S: status = IN_TRANSIT
    Note over O: Order.status reste PROCESSING\n(aucune synchronisation automatique)

    A->>O: PUT /orders/:id/status {SHIPPED}
    Note over O: status = SHIPPED\n(mise à jour manuelle, indépendante\nde l'état réel du Shipment)

    A->>S: PUT /shipments/:id/status {DELIVERED}
    Note over S: status = DELIVERED

    A->>O: PUT /orders/:id/status {DELIVERED}
    Note over O: status = DELIVERED\n→ crédite les points fidélité
    Note over O,S: Les deux statuts finissent alignés,\nmais uniquement parce que l'admin\na fait les deux mises à jour manuellement.
```

### ⚠️ Point d'attention (pas une demande de correction, juste un constat factuel)

La seule vraie relation en base est `Shipment.orderId` (FK optionnelle). Il n'existe **aucun code qui propage automatiquement** un changement de `Shipment.status` vers `Order.status` ou inversement :

- Passer un `Shipment` à `DELIVERED` ne fait rien sur l'`Order` correspondant.
- Passer un `Order` à `SHIPPED`/`DELIVERED` ne vérifie pas que le `Shipment` associé existe ni qu'il est dans un état cohérent.
- Un admin pourrait donc marquer une commande `DELIVERED` alors que son expédition est encore `PENDING`, sans qu'aucune erreur ne soit levée.

Si vous voulez que je corrige ça (ex: `Shipment.status = DELIVERED` déclenche automatiquement `Order.status = DELIVERED` via `orderId`, ou qu'on bloque la transition `Order → SHIPPED` tant qu'aucun `Shipment` actif n'existe), dites-le-moi et je l'implémente comme les points précédents — mais je voulais d'abord que le diagramme reflète fidèlement ce qui existe, pas ce qui serait idéal.