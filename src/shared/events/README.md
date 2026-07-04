# Event Bus in-process

Bus d'événements typé (basé sur `EventEmitter` de Node), utilisé pour
découpler les domaines métier qui doivent réagir aux changements d'état
d'autres domaines, sans dépendances d'import croisées.

## Pourquoi

Sans event bus, chaque nouvelle règle de synchronisation (ex: "quand une
commande passe à DELIVERED, compléter le paiement COD") oblige à modifier le
service source (`order.service.ts`) pour qu'il appelle directement le service
cible (`payment.service.ts`). Plus on ajoute de règles, plus les imports
croisés entre `orders`, `payments`, `shipments`, `returns`, `inventory`
deviennent difficiles à suivre et risquent de créer des cycles d'import.

Avec l'event bus : le service source **émet un fait** ("le statut est passé
de A à B") sans savoir qui réagit. La logique de réaction vit dans des
listeners dédiés, un fichier par domaine réactif.

## Structure

src/shared/events/
event-bus.ts       → le bus lui-même (eventBus.on / eventBus.emit)
event-types.ts     → catalogue des événements et leurs payloads (AppEventMap)
index.ts           → registerEventListeners() — appelé une fois au démarrage
listeners/
payment.listeners.ts
return.listeners.ts
shipment.listeners.ts

## Règle d'or anti-cycle

**Les services métier (order.service.ts, payment.service.ts, ...) importent
UNIQUEMENT `event-bus.ts` et `event-types.ts` directement :**

```ts
import { eventBus } from "../../shared/events/event-bus";
```

**Ils n'importent JAMAIS `src/shared/events/index.ts`**, car ce fichier
importe les listeners, qui importent eux-mêmes les services métier — un
import de `index.ts` depuis un service créerait un cycle.

`index.ts` n'est importé que depuis le point d'entrée applicatif
(`src/app.ts`), une seule fois, pour enregistrer tous les listeners.

## Utilisation — émettre un événement

```ts
import { eventBus } from "../../shared/events/event-bus";

eventBus.emit("order.status.changed", {
  orderId: order.id,
  userId: order.userId,
  fromStatus: oldStatus,
  toStatus: newStatus,
  totalAmount: order.totalAmount,
});
```

## Utilisation — écouter un événement

Créer (ou compléter) un fichier dans `src/shared/events/listeners/`,
exposant une fonction `registerXxxEventListeners()` :

```ts
// src/shared/events/listeners/inventory.listeners.ts
import { eventBus } from "../event-bus";
import { systemLogger } from "../../logger";

export const registerInventoryEventListeners = (): void => {
  eventBus.on("order.status.changed", async (payload) => {
    // ... logique de réaction
  });
};
```

Puis l'enregistrer dans `src/shared/events/index.ts` :

```ts
import { registerInventoryEventListeners } from './listeners/inventory.listeners'

export const registerEventListeners = (): void => {
  registerPaymentEventListeners()
  registerReturnEventListeners()
  registerShipmentEventListeners()
  registerInventoryEventListeners() // ← ajouté
}
```

## Ajouter un nouvel événement

1. Ajouter l'interface de payload dans `event-types.ts`.
2. L'ajouter à `AppEventMap`.
3. Émettre depuis le service concerné (`eventBus.emit(...)`).
4. Écrire le(s) listener(s) qui réagissent.

## Convention de nommage

`domain.entity.changed` (ex: `order.status.changed`, `payment.status.changed`,
`inventory.quantity.changed`). Toujours au passé/constat, jamais à
l'impératif (`inventory.quantity.changed`, pas `inventory.check-threshold`) —
un événement décrit un fait, pas une commande.

## Gestion des erreurs (R5 du guide de gestion des statuts)

**Aucune erreur de listener n'est jamais avalée silencieusement.**
`event-bus.ts` capture systématiquement les erreurs (synchrones ou dans une
Promise rejetée) et les logue via `systemLogger.error('EVENT_LISTENER_FAILED', ...)`.

En plus de ce filet de sécurité générique, chaque listener applicatif est
encouragé à faire son propre `try/catch` avec un contexte métier précis
(voir `payment.listeners.ts`, `return.listeners.ts`, `shipment.listeners.ts`,
qui loguent `ORDER_SYNC_FAILED` avec `orderId`, `returnRequestId`, etc.) —
plus utile pour investiguer qu'un message générique.

**Extension possible non implémentée** : un endpoint admin qui liste les
derniers `ORDER_SYNC_FAILED`/`EVENT_LISTENER_FAILED` depuis les logs, pour
transformer ces échecs déjà loggés en alertes réellement consultées.

## Événements actuellement implémentés

| Événement                 | Émis par                                    | Écouté par                                      | Règle(s)     |
| -------------------------- | -------------------------------------------- | ------------------------------------------------ | ------------ |
| `order.status.changed`    | `order.service.ts` (updateStatus, delete)   | `payment.listeners.ts`                          | R1           |
| `shipment.status.changed` | `shipment.service.ts` (addTrackingEvent, updateStatus) | `shipment.listeners.ts` (→ appelle orderService) | sync Shipment→Order |
| `return.status.changed`   | `return.service.ts` (updateStatus, COMPLETED) | `return.listeners.ts`                           | R2, R3, R4   |

## Prochaine utilisation prévue

Le guide `Guide de gestion des statuts — Product, Attributs, Combinaisons,
Stock (Inventory).md` recommande (§8, Option B) de réutiliser ce même bus
pour :

- **S1** — émettre `inventory.quantity.changed` après chaque
  `decrementQuantity`/`incrementQuantity` (transfert, réservation de
  commande), avec un listener qui applique la même logique d'alerte
  `LOW_STOCK`/`OUT_OF_STOCK` que `inventoryService.update()` — actuellement
  dupliquée nulle part ailleurs.
- **S3** — émettre `combination.deactivated` quand `generate()` désactive
  une combinaison ayant du stock actif.
- **S4** — émettre `product.activation.requested` avant de valider le
  passage à `ACTIVE`, pour vérifier qu'au moins une combinaison active
  existe si le produit a des attributs de variante.

Il suffira d'ajouter ces payloads à `AppEventMap`, d'émettre depuis les
services concernés, et d'écrire les listeners correspondants — sans toucher
au bus lui-même.