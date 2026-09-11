# ADR-010: Transactional outbox for domain events

## Status

PROPOSED

## Context

CLAUDE.md #11 requires that any critical DB mutation + async side effect
(notifications, webhooks, game progression, ...) use a transactional
outbox, so the side effect is never lost or double-fired relative to the
DB write that triggered it.

## Decision

Critical state transitions write an `outbox_events` row in the same DB
transaction as the mutation; a worker (`process_outbox_event`, CLAUDE.md
#28) reads and dispatches them to the queue.

## Consequences

Guarantees at-least-once delivery consistent with the DB state; consumers
(workers, webhook handlers) must be idempotent (CLAUDE.md #27, NFR-004,
NFR-021).
