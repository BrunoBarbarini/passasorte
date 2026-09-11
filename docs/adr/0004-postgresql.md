# ADR-004: PostgreSQL as the system of record

## Status

PROPOSED

## Context

CLAUDE.md #15 states PostgreSQL is source of truth; CLAUDE.md #10 shows
Redis as cache/transient state only.

## Decision

PostgreSQL (managed, e.g. Cloud SQL) is the single source of truth for all
durable state, accessed via Prisma with selective raw SQL for advanced
locking/index cases (CLAUDE.md #13).

## Consequences

Strong consistency and transactional guarantees for positions, money and
game results; scaling reads beyond Stage 1 relies on read replicas/
partitioning (CLAUDE.md #12 Stage 2-3), not a second source of truth.
