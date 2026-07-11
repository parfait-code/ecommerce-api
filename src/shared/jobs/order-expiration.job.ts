import cron, { ScheduledTask } from "node-cron";
import { orderService } from "../../modules/orders/order.service";
import { systemLogger } from "../logger";

/**
 * Annule automatiquement les commandes PENDING jamais payées après un délai
 * fixe (24h par défaut, voir STALE_PENDING_ORDER_HOURS dans order.service.ts).
 * Sans ce job, le stock réservé à la création (FIFO) reste bloqué
 * indéfiniment pour un panier abandonné avant paiement.
 *
 * Fréquence horaire — un retard d'1h sur une fenêtre de 24h est négligeable.
 */
const SCHEDULE = "0 * * * *";

let task: ScheduledTask | null = null;

export const startOrderExpirationJob = (): void => {
  if (task) return;

  task = cron.schedule(SCHEDULE, async () => {
    try {
      const expiredCount = await orderService.expireStalePending();
      if (expiredCount > 0) {
        systemLogger.log("ORDER_EXPIRATION_JOB_RAN", {
          service: "order-expiration-job",
          metadata: { expiredCount },
        });
      }
    } catch (err) {
      systemLogger.error("ORDER_EXPIRATION_JOB_FAILED", {
        service: "order-expiration-job",
        metadata: { error: (err as Error).message },
      });
    }
  });

  systemLogger.log("ORDER_EXPIRATION_JOB_STARTED", {
    service: "order-expiration-job",
    metadata: { schedule: SCHEDULE },
  });
};

export const stopOrderExpirationJob = (): void => {
  task?.stop();
  task = null;
};
