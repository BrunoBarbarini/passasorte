# ADR-011: Versioned, pure GameEngine

## Status

ACCEPTED STRATEGY

## Context

CLAUDE.md #2.5/#2.6/#5 (FR-031..FR-044) require the game engine to be
authoritative, versioned, immutable per active room, and replayable for
audit. CLAUDE.md #46/NFR-017 require it to run without cloud/database
dependencies.

## Decision

The game engine (Sorte, temperature, movement resolution, result) lives in
`@passasorte/domain` as pure functions/classes taking an explicit,
frozen `gameConfigSnapshot` and `engineVersion`, with no I/O. Application
code persists steps/results; the engine itself never touches Prisma, HTTP
or any SDK.

## Consequences

Enables deterministic replay/audit (CLAUDE.md FR-044) and fast unit/
property-based testing (CLAUDE.md #39) without spinning up infrastructure;
requires every rule change to consider `engineVersion` and active-room
compatibility (CLAUDE.md #60).
