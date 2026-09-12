import { Injectable } from "@nestjs/common";
import type {
  OutboxEventRecord,
  OutboxPort,
  OutboxReaderPort,
  PublishOutboxEventInput,
} from "@passasorte/application";
import { PrismaService } from "../prisma.service.js";
import type { Prisma } from "@prisma/client";

interface RawOutboxRow {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  attempts: number;
  createdAt: Date;
}

@Injectable()
export class PrismaOutboxRepository implements OutboxPort, OutboxReaderPort {
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

  /**
   * TASK-033 Outbox Worker. `FOR UPDATE SKIP LOCKED` inside the UPDATE's
   * own subquery is what lets more than one worker process run this
   * concurrently without ever claiming the same row twice — the same
   * "atomic claim" shape as BR-010's position-hold acquisition, just via
   * a single UPDATE...RETURNING statement instead of an explicit
   * transaction. Incrementing `attempts` here (rather than only on
   * failure) is deliberate: it is the claim marker itself, since this
   * table has no separate "claimed_at"/"locked_by" column.
   */
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

  /**
   * `attempts` was already incremented by claimBatch — a failed event
   * simply stays unprocessed and is picked up again by a later
   * claimBatch call (at-least-once, per OutboxReaderPort's contract).
   * No separate write is needed here today; the method exists so a
   * future backoff/dead-letter policy has a single seam to extend.
   */
  async markFailed(_id: string): Promise<void> {
    return Promise.resolve();
  }

  async countUnprocessed(): Promise<number> {
    return this.prisma.outboxEvent.count({ where: { processedAt: null } });
  }
}
