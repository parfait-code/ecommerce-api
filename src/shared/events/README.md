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
event-bus.ts → le bus lui-même (eventBus.on / eventBus.emit)
event-types.ts → catalogue des événements et leurs payloads (AppEventMap)
index.ts → registerEventListeners() — appelé une fois au démarrage
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
import { registerInventoryEventListeners } from "./listeners/inventory.listeners";

export const registerEventListeners = (): void => {
  registerPaymentEventListeners();
  registerReturnEventListeners();
  registerShipmentEventListeners();
  registerInventoryEventListeners(); // ← ajouté
};
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

| Événement                    | Émis par                                                         | Écouté par                 | Règle(s)            |
| ---------------------------- | ---------------------------------------------------------------- | -------------------------- | ------------------- |
| `order.status.changed`       | `order.service.ts` (updateStatus, delete)                        | `payment.listeners.ts`     | R1                  |
| `shipment.status.changed`    | `shipment.service.ts` (addTrackingEvent, updateStatus)           | `shipment.listeners.ts`    | sync Shipment→Order |
| `return.status.changed`      | `return.service.ts` (updateStatus, COMPLETED)                    | `return.listeners.ts`      | R2, R3, R4          |
| `inventory.quantity.changed` | `inventory.repository.ts` (decrementQuantity, incrementQuantity) | `inventory.listeners.ts`   | S1                  |
| `combination.deactivated`    | `combination.service.ts` (generate, update)                      | `combination.listeners.ts` | S3                  |
| `product.activated`          | `product.service.ts` (update, transition → ACTIVE)               | `product.listeners.ts`     | S4                  |

**S2 n'a pas de listener dédié** : c'est exactement la réintégration de stock
via `OrderItemReservation` déjà implémentée dans `return.listeners.ts` pour
R3 (`status_management_guide.md`). Les deux guides pointaient vers le même
besoin — une seule implémentation y répond.

## Décisions prises sur les points laissés ouverts par les guides

- **S1** : l'émission est faite au niveau du repository (`inventory.repository.ts`)
  plutôt que dans chaque service appelant, car c'est le seul point de passage
  commun à `inventoryService.transfer()`, à la réservation FIFO d'`order.service.ts`,
  et à la restitution de stock (annulation, retour). `inventoryService.update()`
  garde sa propre logique de log existante — non touchée pour ne pas casser les
  tests existants, et parce que ce chemin n'avait pas le problème identifié par S1.
- **S3** : désactivation NON bloquée, seulement tracée (`COMBINATION_DEACTIVATED_WITH_STOCK`).
  Couvre les deux chemins de désactivation (`generate()` automatique et `PATCH` manuel).
- **S4** : avertissement NON bloquant (`PRODUCT_ACTIVATED_WITHOUT_COMBINATIONS`), pas de 400.
  Cohérent avec la nature asynchrone/fire-and-forget de l'event bus — un contrôle
  bloquant devrait être fait de façon synchrone dans le service, pas via un événement.

## Extension future

Toute nouvelle règle de propagation (nouveaux domaines, nouveaux guides) suit le
même schéma : ajouter le payload à `event-types.ts`, émettre depuis le point de
mutation pertinent, écrire un listener dans `listeners/`, l'enregistrer dans
`index.ts`. Le bus lui-même (`event-bus.ts`) n'a plus besoin d'être modifié.
