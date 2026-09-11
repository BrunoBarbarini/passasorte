# ADR-017: Exclusive board positions in MVP

## Status

PROPOSED

## Context

CLAUDE.md BR-009 marks exclusive positions as an ASSUMPTION for MVP
simplicity (only one participant may hold a given position at a time).

## Decision

MVP board positions are exclusive; a confirmed position cannot be held by
more than one participant. Position holds are atomic (BR-010/FR-024) and
concurrency-tested (CLAUDE.md #39) to guarantee this.

## Consequences

Simpler game model and UI (no "shared square" concept to explain); revisit
only via an explicit product decision, not silently.
