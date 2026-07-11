import { eventBus } from "../event-bus";
import { businessLogger } from "../../logger";
import { settingService } from "../../../modules/settings/setting.service";
import { SETTING_KEYS } from "../../../modules/settings/setting.constants";

/**
 * S1 — répare le trou de couverture identifié dans le guide (inchangé).
 * Seuil désormais lu depuis le module Settings au lieu d'une constante en
 * dur — modifiable à chaud via PATCH /settings sans redéploiement.
 */
export const registerInventoryEventListeners = (): void => {
  eventBus.on("inventory.quantity.changed", async (payload) => {
    const threshold = await settingService.getNumber(
      SETTING_KEYS.INVENTORY_LOW_STOCK_THRESHOLD,
      10,
    );

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
    } else if (payload.quantity <= threshold) {
      businessLogger.log("LOW_STOCK", {
        service: "inventory",
        actor: { userId: null, role: "SYSTEM" },
        target: {
          inventoryId: payload.inventoryId,
          productId: payload.productId,
        },
        metadata: {
          quantity: payload.quantity,
          threshold,
          warehouseId: payload.warehouseId,
          combinationId: payload.combinationId,
        },
      });
    }
  });
};
