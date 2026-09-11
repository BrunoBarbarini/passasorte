# ADR-001: TypeScript as the primary language

## Status

PROPOSED

## Context

PassaSorte's core value depends on strict correctness (fairness, money,
authoritative game state - CLAUDE.md priority order: correctness > clarity

> simplicity > security > ...). CLAUDE.md #46 requires strict typing,
> explicit domain naming and no `any`.

## Decision

Use TypeScript (strict mode) across backend, web and mobile (CLAUDE.md #13).

## Consequences

One language across the stack; shared types between API and clients via
`@passasorte/api-contract`; requires discipline to keep `any` out (enforced
by `@typescript-eslint/no-explicit-any` in the root ESLint config).
