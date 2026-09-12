# @passasorte/worker

Async worker process for PassaSorte (CLAUDE.md #10, #28): TASK-033
Outbox Worker + TASK-034 Scheduler.

## What it does

Every `WORKER_POLL_INTERVAL_MS` (default 5000ms — infra pacing, not a
business rule):

1. Expires stale ACTIVE position holds past their TTL (BR-010) —
   always runs.
2. Claims and dispatches a batch of unprocessed outbox events
   (ADR-010) into in-app notifications (FR-059) via
   `DispatchOutboxEventsUseCase` — always runs.
3. When `ENABLE_GAME_AUTO_ADVANCE` is `true` (CLAUDE.md #22 kill
   switch, **default OFF**): advances every room currently RUNNING or
   FINAL_LOCK via `AdvanceRoomOperationsUseCase` — RUNNING -> FINAL_LOCK
   on BR-026/BR-027's sequence threshold, FINAL_LOCK -> RESOLVING ->
   COMPLETED once every participant's final plan is locked or the
   room's own `operationsConfig.finalLockGracePeriodMs` elapses.

While the flag is off, an OPERATOR/ADMIN can still run the exact same
use cases on demand via apps/api's `OperationsController`
(`POST /operations/rooms/:id/advance`, `/expire-holds`,
`/dispatch-outbox`) — the worker and that controller share the same
`@passasorte/application` use cases, never a second implementation of
the same logic.

## A known, deliberate duplication

`src/infrastructure/**` here mirrors the equivalent files under
`apps/api/src/infrastructure/**` almost verbatim (same Prisma adapters
implementing the same `@passasorte/application` ports, same empty
eligibility/notification-provider registries) — this process only
needs a _subset_ of what those adapters do (e.g.
`PrismaParticipationRepository.create` is never called here), but the
port interfaces require a full implementation either way.

This is a scoped, documented tradeoff rather than an oversight: the
alternative (a shared `packages/persistence`) is a reasonable follow-up
refactor once a third consumer of these adapters exists, but wasn't
worth doing preemptively for two. If you change one copy, check the
other.

## Local development

```
pnpm --filter @passasorte/worker dev
```

Requires the same `DATABASE_URL` as `@passasorte/api` (same schema,
`prisma/schema.prisma` at the repo root).
