# ADR-013: Redis is cache/transient state only

## Status

ACCEPTED STRATEGY

## Context

CLAUDE.md #10/#35 are explicit: Redis is cache/rate-limit/transient state
only, and must never be the sole source of truth for positions, movements,
payments, benefit balance, winner or compliance data.

## Decision

Redis is used only for caching read models, rate limiting and short-lived
state (e.g. position hold locks with a TTL that mirrors, but does not
replace, the authoritative Postgres `position_holds` row). Every value in
Redis must be reconstructable from Postgres.

## Consequences

A Redis flush/outage degrades performance, never correctness; slightly
more write volume to Postgres than a Redis-as-primary design would need.
