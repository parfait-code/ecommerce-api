import cron, { ScheduledTask } from "node-cron";
import { paymentService } from "../../modules/payments/payment.service";
import { systemLogger } from "../logger";

/**
 * Filet de sécurité pour la confirmation automatique des commandes COD.
 * payment.service.ts::create tente de confirmer la commande immédiatement
 * après création du paiement COD ; si cette synchro échoue (erreur DB
 * transitoire, etc.), la commande reste PENDING indéfiniment sans ce job.
 * Toutes les 15 min — même fréquence que pickup-expiration.job.ts, largement
 * suffisant pour ce cas qui devrait rester rare.
 */
const SCHEDULE = "*/15 * * * *";

let task: ScheduledTask | null = null;

export const startPaymentOrderSyncJob = (): void => {
  if (task) return;

  task = cron.schedule(SCHEDULE, async () => {
    try {
      const reconciledCount =
        await paymentService.reconcileCodOrderConfirmation();
      if (reconciledCount > 0) {
        systemLogger.log("PAYMENT_ORDER_SYNC_JOB_RAN", {
          service: "payment-order-sync-job",
          metadata: { reconciledCount },
        });
      }
    } catch (err) {
      systemLogger.error("PAYMENT_ORDER_SYNC_JOB_FAILED", {
        service: "payment-order-sync-job",
        metadata: { error: (err as Error).message },
      });
    }
  });

  systemLogger.log("PAYMENT_ORDER_SYNC_JOB_STARTED", {
    service: "payment-order-sync-job",
    metadata: { schedule: SCHEDULE },
  });
};

export const stopPaymentOrderSyncJob = (): void => {
  task?.stop();
  task = null;
};
