import "dotenv/config";
import app from "./app";
import { env } from "./shared/config/env";
import { systemLogger } from "./shared/logger";
import { settingService } from "./modules/settings/setting.service";
import {
  startPickupExpirationJob,
  stopPickupExpirationJob,
} from "./shared/jobs/pickup-expiration.job";
import {
  startOrderExpirationJob,
  stopOrderExpirationJob,
} from "./shared/jobs/order-expiration.job";
import {
  startSettingsRefreshJob,
  stopSettingsRefreshJob,
} from "./shared/jobs/settings-refresh.job";

async function bootstrap() {
  // Charge le snapshot des settings AVANT d'accepter des requêtes — les
  // accesseurs synchrones (pagination.ts, countries.ts, multer.ts) en
  // dépendent dès la première requête reçue.
  await settingService.warmup();

  const server = app.listen(env.PORT, () => {
    systemLogger.log("SERVER_STARTED", {
      service: "server",
      metadata: { port: env.PORT, env: env.NODE_ENV },
    });

    startPickupExpirationJob();
    startOrderExpirationJob();
    startSettingsRefreshJob();
  });

  const shutdown = (signal: string) => {
    systemLogger.log("SERVER_STOPPED", {
      service: "server",
      metadata: { signal },
    });
    stopPickupExpirationJob();
    stopOrderExpirationJob();
    stopSettingsRefreshJob();
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  systemLogger.error("SERVER_STARTED", {
    service: "server",
    metadata: { error: (err as Error).message, reason: "Bootstrap failed" },
  });
  process.exit(1);
});
