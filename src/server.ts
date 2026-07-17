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
import {
  startPaymentOrderSyncJob,
  stopPaymentOrderSyncJob,
} from "./shared/jobs/payment-order-sync.job";

async function bootstrap() {
  await settingService.warmup();

  const server = app.listen(env.PORT, () => {
    systemLogger.log("SERVER_STARTED", {
      service: "server",
      metadata: { port: env.PORT, env: env.NODE_ENV },
    });

    startPickupExpirationJob();
    startOrderExpirationJob();
    startSettingsRefreshJob();
    startPaymentOrderSyncJob();
  });

  const shutdown = (signal: string) => {
    systemLogger.log("SERVER_STOPPED", {
      service: "server",
      metadata: { signal },
    });
    stopPickupExpirationJob();
    stopOrderExpirationJob();
    stopSettingsRefreshJob();
    stopPaymentOrderSyncJob();
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
