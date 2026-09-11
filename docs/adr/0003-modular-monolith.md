# ADR-003: Modular monolith over microservices

## Status

ACCEPTED STRATEGY

## Context

CLAUDE.md #10/#11 mandate a single deployable API organized into bounded
contexts (Identity, Partner, Catalog, Campaign, Game, Participation,
Commerce, Benefits, Fulfillment, Notifications, Support, Compliance,
Audit, Analytics) via Ports/Adapters, not a services mesh. CLAUDE.md #47
explicitly forbids introducing microservices without an ADR, and #52/#57
flag premature microservices/realtime overengineering as a risk.

## Decision

One deployable API + one worker tier for the MVP and Stage 1-2 scale
(CLAUDE.md #12). Domain modules must not import infrastructure from other
modules (NFR-023), keeping the internal seams where a future service
extraction (e.g. the Game Engine, per Stage 4 in #12) could happen without
a rewrite.

## Consequences

Simpler ops, deploys and transactions (a DB transaction can span modules
when truly needed) at the cost of requiring discipline to keep module
boundaries clean without the enforcement a network boundary would give.
