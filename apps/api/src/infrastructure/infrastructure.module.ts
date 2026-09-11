import { Module, type Provider } from "@nestjs/common";
import { loadConfig } from "@passasorte/config";
import type { AuthPort } from "@passasorte/application";
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
import { SupabaseAuthAdapter } from "./auth/supabase-auth.adapter.js";
import {
  AUDIT_LOG_PORT,
  AUTH_PORT,
  CAMPAIGN_REPOSITORY,
  EXPERIENCE_REPOSITORY,
  IDEMPOTENCY_PORT,
  MERCHANT_REPOSITORY,
  OUTBOX_PORT,
  PARTICIPATION_REPOSITORY,
  POSITION_HOLD_REPOSITORY,
  ROOM_REPOSITORY,
  USER_REPOSITORY,
} from "../common/tokens.js";

const authPortProvider: Provider = {
  provide: AUTH_PORT,
  useFactory: (): AuthPort => new SupabaseAuthAdapter(loadConfig().supabase.url),
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
    { provide: ROOM_REPOSITORY, useClass: PrismaRoomRepository },
    { provide: POSITION_HOLD_REPOSITORY, useClass: PrismaPositionHoldRepository },
    { provide: PARTICIPATION_REPOSITORY, useClass: PrismaParticipationRepository },
    { provide: IDEMPOTENCY_PORT, useClass: PrismaIdempotencyRepository },
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
    ROOM_REPOSITORY,
    POSITION_HOLD_REPOSITORY,
    PARTICIPATION_REPOSITORY,
    IDEMPOTENCY_PORT,
  ],
})
export class InfrastructureModule {}
