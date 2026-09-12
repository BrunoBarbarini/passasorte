# ADR-021: Product analytics events are dispatched from the existing transactional outbox

## Status

ACCEPTED (2026-09-12, Phase 8 / TASK-045/046)

## Context

CLAUDE.md #20 requires product analytics from day one and #15 requires a
ports/adapters seam for it (like payment, identity and notifications).
CLAUDE.md #13 still lists the analytics provider (PostHog) as an
ASSUMPTION, not a confirmed decision the way Supabase Auth is (ADR-008).

Two shapes were considered for how a use case gets an event to the
provider: (a) inject an `AnalyticsPort` directly into every use case that
should emit one and call it synchronously in the request path, or (b)
publish the same domain event every use case already writes to
ADR-010's transactional outbox, and let the existing outbox dispatcher
(`DispatchOutboxEventsUseCase`, TASK-033) fan it out to `AnalyticsPort` as
well as to notifications.

## Decision

Chose (b). Use cases that already have (or gained, this phase) an
`OutboxPort` dependency (`HoldPositionsUseCase`, `CreateParticipationUseCase`,
`ConfirmParticipationUseCase`, `SubmitMovementCommandUseCase`,
`SubmitFinalMovementCommandUseCase`, plus the pre-existing
`GrantBenefitUseCase`/`RedeemBenefitUseCase`) publish one outbox event per
core funnel action (CLAUDE.md #20/#21). `DispatchOutboxEventsUseCase` maps
a known subset of outbox event types onto CLAUDE.md #20's canonical event
catalog and forwards them to `AnalyticsPort`, in addition to its existing
notification fan-out - see `OUTBOX_EVENT_TYPE_TO_ANALYTICS_EVENT` in
`dispatch-outbox-events.use-case.ts`.

`AnalyticsPort` itself (`packages/application/src/ports/analytics.port.ts`)
still exists as its own port, with a real PostHog adapter in
`packages/analytics` - a future use case that needs to emit an event with
no natural outbox-publishing moment can still inject `AnalyticsPort`
directly; this ADR only decided how the _first_ set of events reaches it.

Screen/view-only events (`app_opened`, `campaign_viewed`,
`live_game_viewed`, ...) and every payment event are explicitly out of
scope here - the former needs a client-side analytics SDK decision this
ADR does not make, the latter has no use case to emit from until Phase 6.

## Consequences

- Analytics delivery inherits the outbox's at-least-once, non-blocking
  characteristics (CLAUDE.md #11): a slow/unavailable PostHog never adds
  latency to a participant-facing request, and a dropped event is
  retried by the worker like any other outbox event.
- No analytics event is emitted for anything that isn't already a real,
  persisted domain event - callers cannot accidentally invent analytics
  data uncorrelated with actual state changes.
- The tradeoff: an event reaches PostHog on the worker's next
  `dispatch_outbox` tick, not instantaneously - acceptable for product
  analytics, would not be for something needing real-time delivery.
