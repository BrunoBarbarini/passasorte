# ADR-020: Paid participation production model

## Status

TBD

## Context

CLAUDE.md #1.8/#1.9/BR-034 mark the full financial arrangement (take rate,
merchant settlement, benefit funding, refund/chargeback economics) and the
legal characterization of paid participation as an unresolved LEGAL GATE.

## Decision

Not yet decided; requires formal legal/compliance approval (CLAUDE.md
"LEGAL GATE — CRITICAL") before activation. `ENABLE_PAID_PARTICIPATION`
and `ENABLE_PAYMENT_CAPTURE` (packages/config) default to `false` and must
stay false in production until this ADR is updated to ACCEPTED with an
explicit decision recorded.

## Consequences

Payment integration (ADR-014) can be built and tested end-to-end behind
the flag without implying the business model is legally cleared; going
live requires both a compliance sign-off and flipping this ADR's status.
