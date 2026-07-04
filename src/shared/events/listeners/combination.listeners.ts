import { eventBus } from "../event-bus";
import { systemLogger } from "../../logger";

/**
 * S3 — avant cet événement, désactiver une combinaison qui avait encore du
 * stock actif se faisait silencieusement (seule la SUPPRESSION est bloquée
 * par du stock, pas la désactivation). On ne bloque pas ici — le guide laisse
 * le choix ouvert et une désactivation reste une action admin volontaire —
 * on se contente de tracer le fait pour qu'il soit visible et investigable.
 */
export const registerCombinationEventListeners = (): void => {
  eventBus.on("combination.deactivated", async (payload) => {
    systemLogger.log("COMBINATION_DEACTIVATED_WITH_STOCK", {
      service: "combination-listeners",
      metadata: {
        productId: payload.productId,
        combinationId: payload.combinationId,
        optionsKey: payload.optionsKey,
        totalQuantity: payload.totalQuantity,
      },
    });
  });
};
