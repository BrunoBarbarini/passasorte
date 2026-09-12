import { Inject, Injectable } from "@nestjs/common";
import type { AuditLogPort, RecordAuditLogInput } from "@passasorte/application";
import { PrismaService } from "../prisma.service.js";
import type { Prisma } from "@prisma/client";

@Injectable()
export class PrismaAuditLogRepository implements AuditLogPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }
}
