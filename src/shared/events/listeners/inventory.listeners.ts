import { eventBus } from "../event-bus";
import { businessLogger } from "../../logger";

// Identique au seuil déjà utilisé dans inventory.service.ts — dupliqué ici car
// c'est désormais le point centralisé qui couvre TOUS les appelants (transfert,
// réservation de commande, restitution), pas seulement l'ajustement manuel admin.
const LOW_STOCK_THRESHOLD = 10;

/**
 * S1 — répare le trou de couverture identifié dans le guide : les alertes de
 * stock ne se déclenchaient auparavant que via inventoryService.update()
 * (ajustement manuel admin). inventoryService.transfer() et la réservation
 * FIFO d'order.service.ts appellent inventoryRepository.decrementQuantity()/
 * incrementQuantity() directement, en contournant ce chemin.
 *
 * L'émission a été déplacée dans inventory.repository.ts (voir plus bas),
 * qui est le SEUL point de passage commun aux trois appelants. Ce listener
 * applique la même logique d'alerte que l'ancien code de
 * inventoryService.update(), désormais valable partout.
 */
export const registerInventoryEventListeners = (): void => {
  eventBus.on("inventory.quantity.changed", async (payload) => {
    if (payload.quantity === 0) {
      businessLogger.log("OUT_OF_STOCK", {
        service: "inventory",
        actor: { userId: null, role: "SYSTEM" },
        target: {
          inventoryId: payload.inventoryId,
          productId: payload.productId,
        },
        metadata: {
          warehouseId: payload.warehouseId,
          combinationId: payload.combinationId,
        },
      });
    } else if (payload.quantity <= LOW_STOCK_THRESHOLD) {
      businessLogger.log("LOW_STOCK", {
        service: "inventory",
        actor: { userId: null, role: "SYSTEM" },
        target: {
          inventoryId: payload.inventoryId,
          productId: payload.productId,
        },
        metadata: {
          quantity: payload.quantity,
          threshold: LOW_STOCK_THRESHOLD,
          warehouseId: payload.warehouseId,
          combinationId: payload.combinationId,
        },
      });
    }
  });
};
