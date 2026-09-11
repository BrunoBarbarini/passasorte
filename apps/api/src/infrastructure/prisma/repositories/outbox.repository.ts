import { Injectable } from "@nestjs/common";
import type { OutboxPort, PublishOutboxEventInput } from "@passasorte/application";
import { PrismaService } from "../prisma.service.js";
import type { Prisma } from "@prisma/client";

@Injectable()
export class PrismaOutboxRepository implements OutboxPort {
  constructor(private readonly prisma: PrismaService) {}

  async publish(input: PublishOutboxEventInput): Promise<void> {
    await this.prisma.outboxEvent.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
  }
}
