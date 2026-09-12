import type { NotificationChannel } from "@passasorte/domain";
import type { OutboxEventRecord, OutboxReaderPort } from "../../ports/outbox.port.js";
import type { NotificationRepository } from "../../ports/notification-repository.port.js";
import type { NotificationProvider } from "../../ports/notification-provider.port.js";
import {
  NOOP_ANALYTICS_PORT,
  redactSensitiveProperties,
  type AnalyticsEventName,
  type AnalyticsPort,
} from "../../ports/analytics.port.js";

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
 * TASK-046 Core Funnel Events. Maps the outbox event types this codebase
 * already publishes (each one a real, already-implemented backend
 * mutation - see hold-positions/create-participation/confirm-
 * participation/submit-movement-command/submit-final-movement-command/
 * grant-benefit/redeem-benefit use cases) onto CLAUDE.md #20's canonical
 * analytics event catalog. An outbox event type with no entry here is
 * simply not tracked as an analytics event yet (e.g. "room.completed",
 * "benefit.expired") - never assumed to map to something.
 */
const OUTBOX_EVENT_TYPE_TO_ANALYTICS_EVENT: Partial<Record<string, AnalyticsEventName>> = {
  "position.hold_created": "position_hold_created",
  "position.hold_failed": "position_hold_failed",
  "participation.started": "participation_started",
  "participation.confirmed": "participation_confirmed",
  "movement.accepted": "movement_accepted",
  "movement.rejected": "movement_rejected",
  "participation.final_plan_submitted": "final_plan_submitted",
  "participation.won": "prize_won",
  "benefit.granted": "benefit_granted",
  "benefit.redeemed": "benefit_redeemed",
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
    private readonly analytics: AnalyticsPort = NOOP_ANALYTICS_PORT,
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
    // CLAUDE.md #29's pipeline extended one step: "Domain Event ->
    // Transactional Outbox -> Queue -> Notification/Analytics Worker ->
    // Provider". Runs for every claimed event, independent of whether it
    // also becomes a notification below - a "rejected"/"failed" event
    // (e.g. movement.rejected) has no notification copy but is still a
    // real product KPI (CLAUDE.md #20 "movement usage").
    await this.trackAnalytics(event);

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

  private async trackAnalytics(event: OutboxEventRecord): Promise<void> {
    const analyticsEvent = OUTBOX_EVENT_TYPE_TO_ANALYTICS_EVENT[event.eventType];
    if (!analyticsEvent) return;

    const userId = event.payload.userId;
    const distinctId = typeof userId === "string" ? userId : event.aggregateId;

    await this.analytics.track({
      event: analyticsEvent,
      distinctId,
      properties: redactSensitiveProperties(event.payload),
    });
  }
}
