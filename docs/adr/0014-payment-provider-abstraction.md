# ADR-014: PaymentGateway port abstraction

## Status

PROPOSED

## Context

CLAUDE.md #32/FR-048..FR-053/TASK-051 require payments to sit behind a
port; the concrete provider is explicitly TBD (CLAUDE.md #56 Technical -
HIGH) and section 1.9/BR-034 make paid participation a LEGAL GATE.

## Decision

Define a `PaymentGateway` port (create order/intent, capture, refund,
verify webhook) in `@passasorte/application`, with the concrete provider
adapter selected later (TASK-052) and wired only in `apps/api`/`apps/worker`.
All payment-capture code paths stay behind the `ENABLE_PAYMENT_CAPTURE`
flag (default false, see packages/config) until the legal gate clears.

## Consequences

Provider choice can be deferred/changed without touching domain or
application code; nothing about paid participation can go live by
accident because the flag defaults off.
