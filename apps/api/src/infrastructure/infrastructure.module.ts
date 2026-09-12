import { Module, type Provider } from "@nestjs/common";
import { loadConfig } from "@passasorte/config";
import type { AuthPort, NotificationProvider } from "@passasorte/application";
import { PrismaService } from "./prisma/prisma.service.js";
import { PrismaUserRepository } from "./prisma/repositories/user.repository.js";
import { PrismaMerchantRepository } from "./prisma/repositories/merchant.repository.js";
import { PrismaExperienceRepository } from "./prisma/repositories/experience.repository.js";
import { PrismaCampaignRepository } from "./prisma/repositories/campaign.repository.js";
import { PrismaAuditLogRepository } from "./prisma/repositories/audit-log.repository.js";
import { PrismaOutboxRepository } from "./prisma/repositories/outbox.repository.js";
import { PrismaRoomRepository } from "./prisma/repositories/room.repository.js";
import { PrismaPositionHoldRepository } from "./prisma/repositories/position-hold.repository.js";
import { PrismaParticipationRepository } from "./prisma/repositories/participation.repository.js";
import { PrismaIdempotencyRepository } from "./prisma/repositories/idempotency.repository.js";
import { PrismaGameRunRepository } from "./prisma/repositories/game-run.repository.js";
import { PrismaNotificationRepository } from "./prisma/repositories/notification.repository.js";
import {
  PrismaBenefitAccountRepository,
  PrismaBenefitLedgerRepository,
  PrismaBenefitRedemptionRepository,
} from "./prisma/repositories/benefit.repository.js";
import type { AppConfig, FeatureFlags } from "@passasorte/config";
import { createAnalyticsAdapter } from "@passasorte/analytics";
import type { AnalyticsPort } from "@passasorte/application";
import { SupabaseAuthAdapter } from "./auth/supabase-auth.adapter.js";
import { resolveNotificationProviders } from "./notifications/notification-provider-registry.js";
import {
  ANALYTICS_PORT,
  AUDIT_LOG_PORT,
  AUTH_PORT,
  BENEFIT_ACCOUNT_REPOSITORY,
  BENEFIT_LEDGER_REPOSITORY,
  BENEFIT_REDEMPTION_REPOSITORY,
  CAMPAIGN_REPOSITORY,
  EXPERIENCE_REPOSITORY,
  FEATURE_FLAGS,
  GAME_RUN_REPOSITORY,
  IDEMPOTENCY_PORT,
  MERCHANT_REPOSITORY,
  NOTIFICATION_PROVIDERS,
  NOTIFICATION_REPOSITORY,
  OUTBOX_PORT,
  OUTBOX_READER_PORT,
  PARTICIPATION_REPOSITORY,
  POSITION_HOLD_REPOSITORY,
  ROOM_REPOSITORY,
  SECURITY_CONFIG,
  USER_REPOSITORY,
} from "../common/tokens.js";

const authPortProvider: Provider = {
  provide: AUTH_PORT,
  useFactory: (): AuthPort => new SupabaseAuthAdapter(loadConfig().supabase.url),
};

const notificationProvidersProvider: Provider = {
  provide: NOTIFICATION_PROVIDERS,
  useFactory: (): readonly NotificationProvider[] => resolveNotificationProviders(),
};

const featureFlagsProvider: Provider = {
  provide: FEATURE_FLAGS,
  useFactory: (): FeatureFlags => loadConfig().featureFlags,
};

const securityConfigProvider: Provider = {
  provide: SECURITY_CONFIG,
  useFactory: (): AppConfig["security"] => loadConfig().security,
};

const analyticsPortProvider: Provider = {
  provide: ANALYTICS_PORT,
  useFactory: (): AnalyticsPort => {
    const config = loadConfig();
    return createAnalyticsAdapter({
      apiKey: config.analytics.posthogApiKey,
      host: config.analytics.posthogHost,
    });
  },
};

/**
 * Binds every @passasorte/application port to its concrete Prisma/
 * Supabase adapter (CLAUDE.md #11 Ports/Adapters). Feature modules import
 * this instead of reaching for PrismaService or SupabaseAuthAdapter
 * directly, so application/domain code never sees infrastructure types.
 */
@Module({
  providers: [
    PrismaService,
    authPortProvider,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: MERCHANT_REPOSITORY, useClass: PrismaMerchantRepository },
    { provide: EXPERIENCE_REPOSITORY, useClass: PrismaExperienceRepository },
    { provide: CAMPAIGN_REPOSITORY, useClass: PrismaCampaignRepository },
    { provide: AUDIT_LOG_PORT, useClass: PrismaAuditLogRepository },
    { provide: OUTBOX_PORT, useClass: PrismaOutboxRepository },
    { provide: OUTBOX_READER_PORT, useExisting: OUTBOX_PORT },
    { provide: ROOM_REPOSITORY, useClass: PrismaRoomRepository },
    { provide: POSITION_HOLD_REPOSITORY, useClass: PrismaPositionHoldRepository },
    { provide: PARTICIPATION_REPOSITORY, useClass: PrismaParticipationRepository },
    { provide: IDEMPOTENCY_PORT, useClass: PrismaIdempotencyRepository },
    { provide: GAME_RUN_REPOSITORY, useClass: PrismaGameRunRepository },
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
    notificationProvidersProvider,
    { provide: BENEFIT_ACCOUNT_REPOSITORY, useClass: PrismaBenefitAccountRepository },
    { provide: BENEFIT_LEDGER_REPOSITORY, useClass: PrismaBenefitLedgerRepository },
    { provide: BENEFIT_REDEMPTION_REPOSITORY, useClass: PrismaBenefitRedemptionRepository },
    featureFlagsProvider,
    securityConfigProvider,
    analyticsPortProvider,
  ],
  exports: [
    PrismaService,
    AUTH_PORT,
    USER_REPOSITORY,
    MERCHANT_REPOSITORY,
    EXPERIENCE_REPOSITORY,
    CAMPAIGN_REPOSITORY,
    AUDIT_LOG_PORT,
    OUTBOX_PORT,
    OUTBOX_READER_PORT,
    ROOM_REPOSITORY,
    POSITION_HOLD_REPOSITORY,
    PARTICIPATION_REPOSITORY,
    IDEMPOTENCY_PORT,
    GAME_RUN_REPOSITORY,
    NOTIFICATION_REPOSITORY,
    NOTIFICATION_PROVIDERS,
    BENEFIT_ACCOUNT_REPOSITORY,
    BENEFIT_LEDGER_REPOSITORY,
    BENEFIT_REDEMPTION_REPOSITORY,
    FEATURE_FLAGS,
    SECURITY_CONFIG,
    ANALYTICS_PORT,
  ],
})
export class InfrastructureModule {}
