import { loadConfig } from "@passasorte/config";
import { createLogger } from "@passasorte/observability";
import { prisma } from "./infrastructure/prisma-client.js";
import { PrismaRoomRepository } from "./infrastructure/prisma/repositories/room.repository.js";
import { PrismaParticipationRepository } from "./infrastructure/prisma/repositories/participation.repository.js";
import { PrismaPositionHoldRepository } from "./infrastructure/prisma/repositories/position-hold.repository.js";
import { PrismaGameRunRepository } from "./infrastructure/prisma/repositories/game-run.repository.js";
import { PrismaOutboxRepository } from "./infrastructure/prisma/repositories/outbox.repository.js";
import { PrismaNotificationRepository } from "./infrastructure/prisma/repositories/notification.repository.js";
import { resolveNotificationProviders } from "./infrastructure/notifications/notification-provider-registry.js";
import { runSchedulerTick } from "./scheduler.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({
    serviceName: `${config.serviceName}-worker`,
    environment: config.env,
    level: config.logging.level,
  });

  await prisma.$connect();

  const roomRepository = new PrismaRoomRepository(prisma);
  const participationRepository = new PrismaParticipationRepository(prisma);
  const positionHoldRepository = new PrismaPositionHoldRepository(prisma);
  const gameRunRepository = new PrismaGameRunRepository(prisma);
  const outboxRepository = new PrismaOutboxRepository(prisma);
  const notificationRepository = new PrismaNotificationRepository(prisma);
  const notificationProviders = resolveNotificationProviders();

  logger.info(
    {
      operation: "bootstrap",
      pollIntervalMs: config.worker.pollIntervalMs,
      gameAutoAdvanceEnabled: config.featureFlags.ENABLE_GAME_AUTO_ADVANCE,
    },
    "PassaSorte worker starting",
  );

  let stopping = false;
  const tick = async (): Promise<void> => {
    if (stopping) return;
    try {
      await runSchedulerTick({
        roomRepository,
        participationRepository,
        positionHoldRepository,
        gameRunRepository,
        outbox: outboxRepository,
        outboxReader: outboxRepository,
        notificationRepository,
        notificationProviders,
        logger,
        gameAutoAdvanceEnabled: config.featureFlags.ENABLE_GAME_AUTO_ADVANCE,
        outboxBatchSize: config.worker.outboxBatchSize,
      });
    } catch (error) {
      logger.error({ operation: "scheduler_tick", err: error }, "Scheduler tick failed");
    }
  };

  const interval = setInterval(() => {
    void tick();
  }, config.worker.pollIntervalMs);

  const shutdown = async (): Promise<void> => {
    stopping = true;
    clearInterval(interval);
    logger.info({ operation: "shutdown" }, "PassaSorte worker shutting down");
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  // Run one tick immediately on boot instead of waiting a full interval.
  await tick();
}

main().catch((error: unknown) => {
  console.error("Fatal error during worker bootstrap", error);
  process.exit(1);
});
