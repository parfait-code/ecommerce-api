# Gestion des statuts — Référence complète

> Document de référence décrivant le cycle de vie de chaque entité à statut dans l'API, les garde-fous appliqués, et les mécanismes de synchronisation croisée (event bus). Remplace les documents d'audit précédents — toutes les recommandations qu'ils contenaient ont été implémentées ; ce document décrit l'état actuel du système, pas un historique d'audit.

## Sommaire

1. Order
2. Shipment
3. Payment
4. ReturnRequest
5. Product
6. Attributs (produit vs variante)
7. ProductCombination
8. Inventory
9. Promotion
10. CouponCode
11. LoyaltyTransaction
12. PickupRequest
13. Category
14. User (isActive / deletedAt / lockout)
15. Event bus — vue d'ensemble des synchronisations croisées

---

## 1. Order

`OrderStatus` : `PENDING` · `CONFIRMED` · `PROCESSING` · `SHIPPED` · `DELIVERED` · `CANCELLED` · `REFUNDED`.

Transitions valides (`order.state-machine.ts`) :


PENDING     → CONFIRMED, CANCELLED
CONFIRMED   → PROCESSING, CANCELLED
PROCESSING  → SHIPPED, CANCELLED
SHIPPED     → DELIVERED
DELIVERED   → REFUNDED
CANCELLED   → (terminal)
REFUNDED    → (terminal)


Toute transition non listée lève `400 Invalid order status transition`.

**Déclencheurs** :

| Transition                | Déclencheur                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `PENDING → CONFIRMED`     | `POST /payments` (toute méthode, y compris COD) ou `PUT /orders/:id/status` (admin)   |
| `* → CANCELLED`           | `DELETE /orders/:id` (owner ou admin) ou `PUT /orders/:id/status` (admin)             |
| `CONFIRMED → PROCESSING`, `PROCESSING → SHIPPED`, `SHIPPED → DELIVERED` | `PUT /orders/:id/status` (admin), ou auto-sync depuis `Shipment.status` (best-effort, voir §2) |
| `DELIVERED → REFUNDED`    | Un `ReturnRequest` lié passe à `COMPLETED`                                            |

**Effets automatiques (event bus, `order.status.changed`)** :

- `→ CANCELLED` : restitution exacte du stock réservé, entrepôt par entrepôt, via `OrderItemReservation` ; annulation des `PickupRequest` `PENDING` liés (`orderId`).
- `→ DELIVERED` : crédit de points fidélité (`loyaltyService.earnFromOrder`, 1 point / 100 XAF, une seule fois) ; complétion automatique de tout paiement COD encore `PENDING` sur la commande.

**Remarque** : `PENDING → CONFIRMED` ne vérifie jamais d'encaissement réel — même un COD non payé confirme la commande. C'est un choix assumé du modèle (confirmation = prise en charge, pas paiement).

---

## 2. Shipment

`ShipmentStatus` : `PENDING` · `IN_TRANSIT` · `DELIVERED` · `CANCELLED`.

Garde-fous (`shipment.service.ts`, pas de state machine dédiée) :

- Toute transition depuis `CANCELLED` est bloquée (400).
- Toute transition depuis `DELIVERED` autre que vers `DELIVERED` est bloquée (400) — idempotence acceptée.
- Aucune autre restriction : `PENDING → DELIVERED` directement est autorisé.

**Deux façons de faire évoluer le statut, à ne pas confondre côté intégration** :

- `POST /shipments/:id/track` : ajoute un événement d'historique (`TrackingEvent.status`, texte libre). Peut *optionnellement* déclencher un changement de statut officiel via le champ `shipment_status`.
- `PUT /shipments/:id/status` : change directement le statut officiel (enum strict), indépendamment de l'historique.

**Effets automatiques (event bus, `shipment.status.changed`)** :

- `IN_TRANSIT → Order.SHIPPED`, `DELIVERED → Order.DELIVERED` (best-effort — voir remarque ci-dessous).
- `CANCELLED` → annulation des `PickupRequest` `PENDING` liés (`shipmentId`).

**Remarque (limite connue, assumée)** : la synchronisation `Shipment → Order` est *best-effort* : si l'`Order` liée n'est pas dans un état permettant la transition demandée (ex. commande encore `CONFIRMED`, pas `PROCESSING`, et l'expédition passe à `IN_TRANSIT`), la tentative échoue silencieusement du point de vue de l'appelant HTTP — mais **jamais silencieusement du point de vue des logs** : un événement `ORDER_SYNC_FAILED` est systématiquement loggé avec le contexte complet (voir §15). Il n'y a pas de retry automatique ; c'est un filet d'information, pas de correction automatique.

---

## 3. Payment

`PaymentStatus` : `PENDING` · `COMPLETED` · `FAILED` · `REFUNDED` · `CANCELLED`.

Transitions valides (`payment.state-machine.ts`) :


PENDING   → COMPLETED, FAILED, CANCELLED
COMPLETED → REFUNDED
FAILED    → (terminal)
CANCELLED → (terminal)
REFUNDED  → (terminal)


**Déclencheurs** :

| Transition                                | Déclencheur                                                      |
| ------------------------------------------ | ------------------------------------------------------------------ |
| création → `PENDING`                       | `POST /payments` — 503 si méthode indisponible (PayPal/Stripe/CinetPay), 404/403 sur commande invalide |
| `PENDING → COMPLETED/FAILED/CANCELLED`     | `PUT /payments/:id/status` (admin)                               |
| `COMPLETED → REFUNDED`                     | `PUT /payments/:id/status` (admin), ou automatique via retour complété (voir §4) |

**Effets automatiques** :

- `POST /payments` déclenche toujours `Order.status → CONFIRMED` (peu importe la méthode).
- `→ COMPLETED` : si `Order.status` était encore `PENDING`, il est réaligné sur `CONFIRMED`.
- `Order.status → DELIVERED` avec un paiement COD encore `PENDING` : auto-complété en `COMPLETED` (event bus, voir §1 et §15).
- Retour complété (`ReturnRequest → COMPLETED`) : tout paiement `COMPLETED` de la commande est automatiquement remboursé (`REFUNDED`, voir §4 et §15).

`PUT /payments/:id/complete` est conservé comme alias déprécié de `PUT .../status { status: "COMPLETED" }`.

---

## 4. ReturnRequest

`ReturnStatus` : `PENDING` · `APPROVED` · `REJECTED` · `COMPLETED`.

**Pas de state machine dédiée** (contrairement à `Order`/`Payment`) — seul garde-fou : un retour déjà `COMPLETED` ne peut plus changer de statut (400). Toute autre transition est libre (y compris `REJECTED → APPROVED`, ou `PENDING → COMPLETED` directement).

**Déclencheurs** :

- Création (`PENDING`) : `POST /returns` — requiert `Order.status = DELIVERED` ; chaque `order_item_id` doit appartenir à la commande ; quantité demandée ≤ quantité achetée.
- `PUT /returns/:id/status` (admin) : toute transition sauf depuis `COMPLETED`.

**Effets automatiques d'un passage à `COMPLETED` (event bus, `return.status.changed`)** :

1. `Order.status → REFUNDED` (transition validée par la state machine Order, `DELIVERED → REFUNDED`).
2. Remboursement (`Payment.status → REFUNDED`) de tout paiement `COMPLETED` lié à la commande.
3. Réintégration du stock, entrepôt par entrepôt, via les `OrderItemReservation` existantes pour les `orderItem` concernés.
4. Reversal des points de fidélité gagnés sur la commande (transaction `LoyaltyTransaction` de type `ADJUSTED` négative, idempotente — ne rejoue pas si déjà fait).

**Remarque** : la réintégration de stock (point 3) simplifie le cas de retours partiels multiples sur un même `orderItem` — elle redistribue la quantité retournée sur les réservations existantes dans leur ordre d'attribution, sans tracer précisément ce qui a déjà été rendu par un retour antérieur partiel sur le même item. À affiner si ce cas devient réel en pratique.

---

## 5. Product

`ProductStatus` : `DRAFT` · `ACTIVE` · `ARCHIVED`.

**Aucune restriction de transition** entre les trois valeurs (contrairement à `Order`/`Payment`) — tous les sens sont autorisés. Le seul garde-fou porte sur la cible `ACTIVE` :

**Garde-fou d'activation** (`product.service.ts::assertReadyForActivation`) :
- Récupère les `AttributeDefinition` de la catégorie du produit où `isVariant: false` et `isRequired: true`.
- Compare avec les `ProductAttributeValue` déjà renseignées.
- Manque au moins un attribut requis → `400 Cannot activate product: missing required attributes (...)`.
- Les attributs de variante (`isVariant: true`) ne sont **jamais** concernés par ce contrôle.

**Autres points** :

- `POST /product` force toujours `status: DRAFT`, quelle que soit la valeur envoyée.
- `categoryId` est immuable après création.
- Suppression = soft delete (`deletedAt`), filtré systématiquement par `findAll`/`findById`. Aucune vérification de stock ou commandes en cours avant suppression.

**Effet automatique (event bus, `product.activated`)** : une véritable transition vers `ACTIVE` (pas si déjà `ACTIVE`) émet un événement. Si la catégorie a des attributs de variante (`isVariant: true`) et qu'aucune `ProductCombination` active n'existe encore pour ce produit, un avertissement non bloquant `PRODUCT_ACTIVATED_WITHOUT_COMBINATIONS` est loggé — le produit reste activable même sans combinaison vendable, par choix (éviter de bloquer un workflow où l'admin active puis génère les combinaisons dans la foulée).

---

## 6. Attributs — deux chemins distincts

Un `AttributeDefinition` (rattaché à une `Category`) a un flag `isVariant` qui détermine **totalement** quel service et quelle route utiliser — aucun code partagé entre les deux chemins.

### 6.1 Attribut produit (`isVariant: false`)

- Route : `PUT /product/:productId/attributes`
- Stocké dans `ProductAttributeValue` (valeur texte libre par attribut).
- Remplace **toutes** les valeurs à chaque appel (delete + recreate en transaction).
- Rejette si l'attribut ciblé est `isVariant: true` (oriente vers `/combinations/selections/...`).
- Seule source vérifiée par le garde-fou d'activation (§5).

### 6.2 Attribut de variante (`isVariant: true`)

- Route : `PUT /product/:productId/combinations/selections/:attributeDefinitionId`
- Ne stocke pas une valeur mais une **sélection d'options** (`ProductAttributeSelection`).
- Vérifie que chaque `optionId` fourni appartient bien à la définition d'attribut ciblée et à la catégorie du produit.
- Rejette si l'attribut n'a pas `isVariant: true`.
- **N'est jamais vérifié** par le garde-fou d'activation.

---

## 7. ProductCombination

Remplace l'ancien système de "variantes" (`ProductVariant`) — `combinationId` est utilisé partout (panier, commande, wishlist, inventaire).

**Génération (`POST /product/:productId/combinations/generate`)** :

1. Regroupe les `ProductAttributeSelection` du produit par attribut.
2. Calcule le produit cartésien de toutes les options sélectionnées.
3. Pour chaque combinaison générée (clé canonique triée `optionsKey`) :
   - Existe et inactive → réactivée.
   - Existe et active → ignorée (idempotent).
   - N'existe pas → créée.
4. Toute combinaison non présente dans le lot généré est **désactivée** (jamais supprimée automatiquement).
5. Invalide le cache produit.

**Cycle de vie individuel** :


généré → actif   (correspond à la sélection courante)
actif  → inactif (PATCH manuel, ou generate() qui l'exclut du lot courant)
inactif → actif  (generate() la fait redevenir valide)
actif/inactif → supprimé (DELETE — 400 si Inventory non vide)


**Effet automatique (event bus, `combination.deactivated`)** : avant toute désactivation (manuelle via `PATCH {isActive:false}`, ou automatique via `generate()`), si la combinaison a encore du stock actif (`quantity > 0` sur au moins une ligne `Inventory`), un avertissement `COMBINATION_DEACTIVATED_WITH_STOCK` est loggé. La désactivation **n'est pas bloquée** par ce constat — seule la **suppression** l'est.

---

## 8. Inventory

Clé composite : `(productId, warehouseId, combinationId)`, `combinationId` nullable pour un produit sans variante.

**Opérations** :

| Opération          | Route                        | Garde-fou                                                              |
| ------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| Création             | `POST /inventory`             | 404 si produit/entrepôt introuvable, 409 si doublon `(product, warehouse, combination)` |
| Ajustement manuel     | `PUT /inventory/:item_id`     | —                                                                          |
| Suppression           | `DELETE /inventory/:item_id`  | Aucune vérification de commandes en cours                                 |
| Transfert             | `POST /inventory/transfer`    | 400 si stock source insuffisant                                           |

**Alertes de stock (`LOW_STOCK`/`OUT_OF_STOCK`)** — centralisées au niveau du repository (event bus, `inventory.quantity.changed`), et non plus seulement sur l'ajustement manuel admin comme dans une version antérieure. Émises après **chaque** `decrementQuantity`/`incrementQuantity`, quel que soit l'appelant :
- Ajustement manuel (`PUT /inventory/:item_id`)
- Transfert (`POST /inventory/transfer`)
- Réservation FIFO à la commande (§9)
- Restitution (annulation de commande, retour complété)

Seuil `LOW_STOCK_THRESHOLD = 10` (hardcodé, indépendant du paramètre `?threshold=` ajustable de `GET /inventory/low-stock`).

---

## 9. Interaction Order ↔ Stock (réservation FIFO)

À la création d'une commande (`order.service.ts::create`) :

1. **Vérification globale** : somme du stock sur **tous les entrepôts** pour `(productId, combinationId)` ≥ quantité demandée. Pas de vérification entrepôt par entrepôt — un produit disponible en petites quantités dispersées passe la vérification.
2. **Réservation FIFO** : entrepôt le plus anciennement approvisionné (`createdAt` ASC) épuisé en premier, jusqu'à couvrir la quantité totale. Chaque prélèvement est tracé dans `OrderItemReservation` (orderItemId, warehouseId, quantity).
3. Si le stock a été pris entre la vérification et la réservation (race condition rare) : rollback complet (stock restitué, commande supprimée), réponse `409`.
4. Si le stock est insuffisant dès la vérification : `400`, commande non créée.

**Annulation** : pour chaque `OrderItemReservation` de la commande, restitution exacte à l'entrepôt d'origine (recrée la ligne `Inventory` si elle a été supprimée entre-temps), puis suppression des réservations.

C'est cette table `OrderItemReservation` qui permet à la fois la restitution exacte à l'annulation et la réintégration de stock au retour complété (§4).

---

## 10. Promotion

`PromotionStatus` : `SCHEDULED` · `ACTIVE` · `EXPIRED` · `CANCELLED`.

**`status` est calculé à la lecture**, jamais figé en base après création (`promotion.pricing.ts::computeDisplayStatus`) :

ts
if (promotion.status === "CANCELLED") return "CANCELLED"; // posé manuellement, respecté
if (!promotion.isActive) return promotion.status;          // toggle manuel, indépendant des dates
const now = new Date();
if (now < promotion.startDate) return "SCHEDULED";
if (now > promotion.endDate)   return "EXPIRED";
return "ACTIVE";


`GET /promotions`, `GET /promotions/:id`, `GET /promotions/slug/:slug` appliquent systématiquement ce calcul avant de retourner la promotion. Le filtre `?status=` dans `GET /promotions` s'applique sur ce statut calculé, pas sur le champ stocké.

**Le pricing produit (`getBestPricing`, via `isPromotionActiveNow`) utilise le même calcul par dates** — une promotion `SCHEDULED` dont `startDate` est atteinte applique donc correctement sa remise, sans attendre une réévaluation manuelle du champ `status` en base.

**Actions disponibles** : `PATCH /promotions/:id/toggle` (bascule `isActive`, indépendant des dates), `PUT /promotions/:id` (dates/contenu), `DELETE` (suppression réelle — pas de transition vers `CANCELLED` par cette voie).

---

## 11. CouponCode

Pas d'enum de statut — un booléen `isActive`, plus `usedCount`/`maxUses`/dates évalués **dynamiquement** à chaque usage.

**`effectiveIsActive` calculé** (`computeCouponEffectiveStatus`), exposé uniquement sur `GET /promotions/:id/coupons` :

ts
if (!coupon.isActive) return false;
if (coupon.startDate && now < coupon.startDate) return false;
if (coupon.endDate && now > coupon.endDate) return false;
if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return false;
return true;


`isActive` stocké reste l'intention admin ; `effectiveIsActive` reflète la réalité opérationnelle sans jamais modifier `isActive` en base.

**Validation réelle** (`POST /coupons/validate`, application à la commande) : vérifie `isActive`, activité de la promotion liée, dates, plafond global (`usedCount >= maxUses`), plafond par utilisateur (`perUserLimit`). Aucune route de désactivation dédiée pour un coupon — seule la suppression (`DELETE`) existe.

---

## 12. LoyaltyTransaction

`LoyaltyEventType` : `EARNED` · `REDEEMED` · `EXPIRED` · `ADJUSTED`.

| Type       | Déclencheur                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------- |
| `EARNED`   | `Order.status → DELIVERED` (une fois par commande), 1 point / 100 XAF                          |
| `REDEEMED` | `POST /loyalty/adjust` (admin), points négatifs, bloqué si le solde résultant serait négatif    |
| `ADJUSTED` | `POST /loyalty/adjust` (admin, libre) ; également utilisé pour le reversal automatique au retour |
| `EXPIRED`  | Uniquement via `POST /loyalty/adjust` manuel — aucune expiration automatique programmée         |

`getBalance()` fait un `SUM(points)` simple sur toutes les transactions, sans distinction de type ni de date — pas de notion de durée de vie des points.

**Reversal automatique** (`loyaltyService.reverseForOrder`, appelé au retour complété — §4) : calcule les points `EARNED` sur la commande moins ce qui a déjà été reversé (`ADJUSTED` négatif), et crée une transaction `ADJUSTED` négative pour combler la différence. Idempotent — ne rejoue pas si déjà entièrement reversé.

---

## 13. PickupRequest

`PickupStatus` : `PENDING` · `CONFIRMED` · `CANCELLED`.

**Transitions** :


PENDING → CANCELLED  (POST /pickup-requests/:id/cancel, owner uniquement, 403 sinon, 400 si déjà annulée)
PENDING → CANCELLED  (automatique — voir ci-dessous)


`CONFIRMED` est défini dans l'enum mais **aucune route ne le déclenche** — état actuellement inatteignable par le code.

**Effet automatique (event bus)** : quand une `Order` ou un `Shipment` lié (via `orderId`/`shipmentId`) passe à `CANCELLED`, les `PickupRequest` `PENDING` correspondants sont automatiquement annulés (`shared/events/listeners/pickup.listeners.ts`, écoute `order.status.changed` et `shipment.status.changed`). Tout échec de cette synchronisation est loggé en `ORDER_SYNC_FAILED` (jamais avalé silencieusement).

---

## 14. Category

Champ `isActive`, booléen, `@default(true)`.

**Effectif sur les routes publiques** :

- `GET /categories/slug/:slug` et `GET /categories/slug/:slug/products` renvoient **404** si la catégorie ciblée est `isActive: false`.
- `GET /categories` ne retourne que les catégories actives par défaut. Un appelant `ADMIN` peut passer `?includeInactive=true` pour voir aussi les catégories désactivées (paramètre ignoré pour un non-admin).
- `GET /categories/:categoryId` (consultation directe par id) retourne la catégorie même si `isActive: false` — route de gestion admin, pas de filtrage.

**Remarque** : aucune cascade automatique — désactiver une catégorie n'affecte ni ses sous-catégories, ni les produits qui lui sont rattachés (ils restent normalement listables/achetables via leurs propres routes). Seule la catégorie elle-même est filtrée des vues publiques.

---

## 15. User — `isActive` / `deletedAt` / lockout

Deux mécanismes désormais bien distincts (contrairement à une version antérieure où ils étaient couplés) :

### 15.1 `deletedAt` (suppression)

- `DELETE /user/:userId` (admin) pose `deletedAt: now()` **et** `isActive: false`, en une seule opération, irréversible via l'API. Choix assumé : le soft-delete garde l'historique tout en désactivant définitivement l'accès — il n'existe pas de route de restauration.
- `userRepository.findById`/`findAll` filtrent systématiquement `deletedAt: null` — un compte soft-supprimé est invisible dans toutes les listes et recherches, y compris pour un admin (404 sur consultation directe).
- **Un admin ne peut pas se supprimer lui-même** : `DELETE /user/:userId` renvoie `400 "You cannot delete your own account"` si `userId` correspond au compte de l'appelant (comparé au JWT).

### 15.2 `isActive` (suspension réversible, indépendante de `deletedAt`)

- Route dédiée : `PATCH /user/:userId/status { isActive: boolean }` (admin) — bascule uniquement `isActive`, sans jamais toucher `deletedAt`.
- Ne fonctionne pas sur un compte déjà soft-supprimé (404, car `findById` filtre déjà `deletedAt: null` — cohérent avec le reste de l'API, pas de vérification supplémentaire nécessaire).
- Log `ACCOUNT_UNLOCKED` si `isActive → true`, `ACCOUNT_LOCKED` si `isActive → false` ; pas de log si la valeur ne change pas (no-op silencieux, retourne l'utilisateur tel quel).
- C'est aussi la seule route pour lever un verrouillage automatique déclenché par le brute-force (§15.3).

### 15.3 Lockout automatique (brute-force)

- Compteur Redis, clé `login_attempts:{username}`, incrémenté à chaque échec de mot de passe sur `POST /login`.
- Fenêtre glissante de **15 minutes** (TTL posé au premier échec).
- Au **5ᵉ échec** dans la fenêtre : `isActive → false` (via `userRepository.setActive`), compteur supprimé, événements `BRUTE_FORCE_DETECTED` (sécurité) et `ACCOUNT_LOCKED` (métier) loggés.
- Entre le 2ᵉ et le 4ᵉ échec : `MULTIPLE_FAILED_LOGINS` loggé (signal d'alerte progressif).
- Un login réussi réinitialise explicitement le compteur (`redis.del`).
- Le message d'erreur renvoyé au client est **identique** que le compte soit verrouillé automatiquement ou désactivé manuellement par un admin (`403 "This account has been deactivated."`) — aucune distinction n'est exposée côté client, pour ne pas donner d'information supplémentaire à un attaquant sur l'état exact du compte.

---

## 16. Event bus — vue d'ensemble des synchronisations croisées

Bus d'événements in-process (`EventEmitter`, `src/shared/events/event-bus.ts`), utilisé pour découpler les domaines qui réagissent à des changements d'état d'autres domaines sans imports croisés directs. Chaque service source **émet un fait** ; les listeners dédiés (`src/shared/events/listeners/*`) contiennent la logique de réaction.

**Principe de fiabilité** : aucune erreur de listener n'est jamais avalée silencieusement. Le bus capture systématiquement les erreurs (synchrones ou Promise rejetée) et les logue via `EVENT_LISTENER_FAILED`. Les listeners applicatifs ajoutent en plus leur propre contexte métier via `ORDER_SYNC_FAILED` (orderId, returnRequestId, etc. selon le cas).

**Événements et effets** :

| Événement                      | Émis par                                                    | Écouté par                    | Effet                                                                 |
| -------------------------------- | -------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `order.status.changed`         | `order.service.ts` (updateStatus, delete)                     | `payment.listeners.ts`         | Auto-complète les paiements COD `PENDING` si `→ DELIVERED`               |
|                                 |                                                                  | `pickup.listeners.ts`          | Annule les `PickupRequest` `PENDING` liés si `→ CANCELLED`               |
| `shipment.status.changed`      | `shipment.service.ts` (addTrackingEvent, updateStatus)         | `shipment.listeners.ts`        | Synchronise `Order.status` (best-effort) selon le mapping `IN_TRANSIT→SHIPPED`, `DELIVERED→DELIVERED` |
|                                 |                                                                  | `pickup.listeners.ts`          | Annule les `PickupRequest` `PENDING` liés si `→ CANCELLED`               |
| `return.status.changed`        | `return.service.ts` (updateStatus, `→ COMPLETED`)              | `return.listeners.ts`          | Remboursement paiement, réintégration stock, reversal fidélité (voir §4) |
| `inventory.quantity.changed`   | `inventory.repository.ts` (decrementQuantity, incrementQuantity) | `inventory.listeners.ts`     | Alertes `LOW_STOCK`/`OUT_OF_STOCK` centralisées (voir §8)                |
| `combination.deactivated`      | `combination.service.ts` (generate, update)                    | `combination.listeners.ts`     | Log `COMBINATION_DEACTIVATED_WITH_STOCK` (non bloquant, voir §7)         |
| `product.activated`            | `product.service.ts` (update, transition `→ ACTIVE`)           | `product.listeners.ts`         | Log `PRODUCT_ACTIVATED_WITHOUT_COMBINATIONS` si applicable (voir §5)     |

**Règle anti-cycle** : les services métier importent uniquement `event-bus.ts` et `event-types.ts` directement, jamais `src/shared/events/index.ts` (qui importe les listeners, qui importent les services métier — importer `index.ts` depuis un service créerait un cycle). `index.ts` n'est importé qu'une fois, depuis `src/app.ts`, pour enregistrer tous les listeners au démarrage.

**Ajouter un nouvel événement** : ajouter le payload à `event-types.ts` → l'ajouter à `AppEventMap` → émettre depuis le point de mutation pertinent → écrire le listener dans `listeners/` → l'enregistrer dans `index.ts`.