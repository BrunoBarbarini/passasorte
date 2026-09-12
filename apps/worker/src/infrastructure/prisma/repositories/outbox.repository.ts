/**
 * Mirrors apps/api/src/infrastructure/prisma/repositories/outbox.repository.ts.
 */
import type {
  OutboxEventRecord,
  OutboxPort,
  OutboxReaderPort,
  PublishOutboxEventInput,
} from "@passasorte/application";
import type { Prisma, PrismaClient } from "@prisma/client";

interface RawOutboxRow {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  attempts: number;
  createdAt: Date;
}

export class PrismaOutboxRepository implements OutboxPort, OutboxReaderPort {
  constructor(private readonly prisma: PrismaClient) {}

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

  async claimBatch(limit: number): Promise<readonly OutboxEventRecord[]> {
    const rows = await this.prisma.$queryRaw<RawOutboxRow[]>`
      UPDATE outbox_events
      SET attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM outbox_events
        WHERE processed_at IS NULL
        ORDER BY created_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id,
        aggregate_type AS "aggregateType",
        aggregate_id AS "aggregateId",
        event_type AS "eventType",
        payload,
        attempts,
        created_at AS "createdAt"
    `;
    return rows.map((row) => ({
      id: row.id,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      eventType: row.eventType,
      payload: row.payload as Record<string, unknown>,
      attempts: row.attempts,
      createdAt: row.createdAt,
    }));
  }

  async markProcessed(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({ where: { id }, data: { processedAt: new Date() } });
  }

  async markFailed(_id: string): Promise<void> {
    return Promise.resolve();
  }

  async countUnprocessed(): Promise<number> {
    return this.prisma.outboxEvent.count({ where: { processedAt: null } });
  }
}
