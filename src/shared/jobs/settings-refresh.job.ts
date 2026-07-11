import cron, { ScheduledTask } from "node-cron";
import { settingService } from "../../modules/settings/setting.service";
import { systemLogger } from "../logger";

/**
 * Garde le snapshot synchrone des settings (utilisé par pagination.ts,
 * countries.ts, multer.ts) à jour même sans requête HTTP déclenchant un
 * accesseur asynchrone. Toutes les 5 minutes suffit — settingService.update()
 * rafraîchit déjà le cache immédiatement après une modification admin,
 * ceci n'est qu'un filet de sécurité.
 */
const SCHEDULE = "*/5 * * * *";

let task: ScheduledTask | null = null;

export const startSettingsRefreshJob = (): void => {
  if (task) return;

  task = cron.schedule(SCHEDULE, async () => {
    try {
      await settingService.refresh();
    } catch (err) {
      systemLogger.error("SETTINGS_REFRESH_JOB_FAILED", {
        service: "settings-refresh-job",
        metadata: { error: (err as Error).message },
      });
    }
  });

  systemLogger.log("SETTINGS_REFRESH_JOB_STARTED", {
    service: "settings-refresh-job",
    metadata: { schedule: SCHEDULE },
  });
};

export const stopSettingsRefreshJob = (): void => {
  task?.stop();
  task = null;
};
