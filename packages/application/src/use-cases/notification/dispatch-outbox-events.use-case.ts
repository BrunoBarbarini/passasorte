import type { NotificationChannel } from "@passasorte/domain";
import type { OutboxEventRecord, OutboxReaderPort } from "../../ports/outbox.port.js";
import type { NotificationRepository } from "../../ports/notification-repository.port.js";
import type { NotificationProvider } from "../../ports/notification-provider.port.js";

export interface DispatchOutboxEventsCommand {
  batchSize?: number;
}

interface NotificationCopy {
  readonly title: string;
  readonly body: string;
}

type CopyResolver = (payload: Record<string, unknown>) => NotificationCopy;

/**
 * Only events with both a defined copy AND a single-user `userId` in
 * their payload become a notification — this codebase does not invent
 * fan-out-to-everyone-in-the-room semantics or marketing copy CLAUDE.md
 * never specified. Extending this map is how a future event type opts
 * into having a notification.
 */
function roomIdOf(payload: Record<string, unknown>): string {
  return typeof payload.roomId === "string" ? payload.roomId : "";
}

const NOTIFICATION_COPY_BY_EVENT_TYPE: Record<string, CopyResolver> = {
  "participation.won": (payload) => ({
    title: "Você ganhou!",
    body: `Sua participação na sala ${roomIdOf(payload)} foi sorteada.`,
  }),
  "participation.not_won": (payload) => ({
    title: "Resultado disponível",
    body: `O resultado da sala ${roomIdOf(payload)} já está disponível.`,
  }),
};

/**
 * TASK-033 Outbox Worker + TASK-035 Notification Infrastructure. CLAUDE.md
 * #29: "Domain Event -> Transactional Outbox -> Queue -> Notification
 * Worker -> Provider" — this use case IS that worker step. It claims
 * unprocessed outbox rows (ADR-010, at-least-once) and, for events this
 * codebase already knows how to turn into a notification, writes an
 * IN_APP Notification (always real, CLAUDE.md #29) and offers it to
 * every registered NotificationProvider for PUSH/EMAIL — today an empty
 * list, since CLAUDE.md #3.12 leaves the concrete provider undecided
 * (see apps/api's notification-provider-registry.ts, the same
 * empty-pluggable-registry pattern already used for eligibility rules).
 * A claimed event that fails is marked failed (attempts++) rather than
 * silently dropped, so it can be retried or inspected.
 */
export class DispatchOutboxEventsUseCase {
  constructor(
    private readonly outboxReader: OutboxReaderPort,
    private readonly notifications: NotificationRepository,
    private readonly providers: readonly NotificationProvider[] = [],
  ) {}

  async execute(command: DispatchOutboxEventsCommand = {}): Promise<number> {
    const batch = await this.outboxReader.claimBatch(command.batchSize ?? 50);
    let dispatched = 0;

    for (const event of batch) {
      try {
        await this.dispatchOne(event);
        await this.outboxReader.markProcessed(event.id);
        dispatched++;
      } catch {
        await this.outboxReader.markFailed(event.id);
      }
    }

    return dispatched;
  }

  private async dispatchOne(event: OutboxEventRecord): Promise<void> {
    const resolveCopy = NOTIFICATION_COPY_BY_EVENT_TYPE[event.eventType];
    const userId = event.payload.userId;
    if (!resolveCopy || typeof userId !== "string") {
      return;
    }

    const copy = resolveCopy(event.payload);

    const inAppPreference = await this.notifications.getPreference(userId, "IN_APP");
    if (inAppPreference?.enabled !== false) {
      await this.notifications.create({
        userId,
        type: event.eventType,
        title: copy.title,
        body: copy.body,
        data: event.payload,
      });
    }

    for (const provider of this.providers) {
      const channel: NotificationChannel = provider.channel;
      const preference = await this.notifications.getPreference(userId, channel);
      if (preference?.enabled === false) continue;
      await provider.send({ userId, title: copy.title, body: copy.body, data: event.payload });
    }
  }
}
