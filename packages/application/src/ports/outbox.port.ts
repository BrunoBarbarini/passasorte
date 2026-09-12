/**
 * ADR-010 transactional outbox: written in the same DB transaction as the
 * mutation that causes it, so an async side effect (e.g. a notification)
 * is never lost or fired inconsistently with committed state.
 */
export interface PublishOutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface OutboxPort {
  publish(input: PublishOutboxEventInput): Promise<void>;
}

/**
 * Safe default for use cases that accept an optional OutboxPort (Phase 8
 * added outbox publishing to several existing use cases without forcing
 * every existing call site/test to start passing one - CLAUDE.md #47
 * "smallest correct change").
 */
export const NOOP_OUTBOX_PORT: OutboxPort = {
  async publish() {
    /* no-op */
  },
};

/** TASK-033 Outbox Worker: the write-side of an already-published event. */
export interface OutboxEventRecord {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly attempts: number;
  readonly createdAt: Date;
}

/**
 * TASK-033 Outbox Worker: the read/dispatch side of ADR-010's outbox.
 * `claimBatch` must guarantee that two concurrent worker instances never
 * both claim the same row (e.g. `FOR UPDATE SKIP LOCKED`), so running
 * more than one worker process is safe (at-least-once delivery, never
 * exactly-once — callers/downstream handlers must already be idempotent,
 * consistent with FR-038's idempotency pattern elsewhere in this codebase).
 */
export interface OutboxReaderPort {
  claimBatch(limit: number): Promise<readonly OutboxEventRecord[]>;
  markProcessed(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
  /** TASK-047 Game Operational Dashboard: how many events are still waiting to be dispatched. */
  countUnprocessed(): Promise<number>;
}
