import cron from "node-cron";
import { pickupRequestService } from "../../modules/pickup-requests/pickup-request.service";
import { systemLogger } from "../logger";

/**
 * Vérifie toutes les 15 minutes les PickupRequest dont la deadline est
 * dépassée et les fait expirer automatiquement (voir
 * pickup-request.service.ts::expireOverdue — même logique que la vérification
 * paresseuse déclenchée par GET /pickup-requests, mais sans dépendre d'une
 * consultation admin pour se déclencher).
 *
 * Fréquence choisie par défaut : 15 min. Un retour raté de 15 min sur une
 * deadline de plusieurs jours est négligeable pour ce cas d'usage — pas
 * besoin d'une fréquence plus agressive.
 */
const SCHEDULE = "*/15 * * * *";

let task: cron.ScheduledTask | null = null;

export const startPickupExpirationJob = (): void => {
  if (task) return; // évite le double-enregistrement si appelé deux fois

  task = cron.schedule(SCHEDULE, async () => {
    try {
      const expiredCount = await pickupRequestService.expireOverdue();
      if (expiredCount > 0) {
        systemLogger.log("PICKUP_EXPIRATION_JOB_RAN", {
          service: "pickup-expiration-job",
          metadata: { expiredCount },
        });
      }
    } catch (err) {
      systemLogger.error("PICKUP_EXPIRATION_JOB_FAILED", {
        service: "pickup-expiration-job",
        metadata: { error: (err as Error).message },
      });
    }
  });

  systemLogger.log("PICKUP_EXPIRATION_JOB_STARTED", {
    service: "pickup-expiration-job",
    metadata: { schedule: SCHEDULE },
  });
};

export const stopPickupExpirationJob = (): void => {
  task?.stop();
  task = null;
};
