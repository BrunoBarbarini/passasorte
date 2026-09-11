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
