# ADR-007: Next.js for web / backoffice

## Status

PROPOSED

## Context

CLAUDE.md #1.7 requires a strong internal backoffice from day one (no
merchant self-service needed for MVP); #13 lists Next.js + React.

## Decision

Build the backoffice (and any public web surface) with Next.js + React.

## Consequences

Shared React/TypeScript skills and API contracts with mobile; not yet
scaffolded (see apps/web/README.md) since it depends on Phase 1 APIs.
