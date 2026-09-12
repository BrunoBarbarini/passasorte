# ADR-007: Next.js for web / backoffice

## Status

ACCEPTED (Phase 5: apps/web scaffolded as TASK-047's Game Operational Dashboard)

## Context

CLAUDE.md #1.7 requires a strong internal backoffice from day one (no
merchant self-service needed for MVP); #13 lists Next.js + React.

## Decision

Build the backoffice (and any public web surface) with Next.js + React.

## Consequences

Shared React/TypeScript skills and API contracts with mobile.
Scaffolded in Phase 5 (see apps/web/README.md) once the APIs it needs
(Identity/Partner/Campaign from Phase 1, Rooms/Operations from Phases
3-5) existed.
