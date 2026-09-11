# ADR-012: Cryptographically committed, reproducible randomness

## Status

PROPOSED

## Context

CLAUDE.md #2.5/BR-030/BR-031 require that any randomness in a game result
be committed before use, reproducible for audit, and immune to
administrator manipulation - fairness must be demonstrable, not just
asserted.

## Decision

Commit a randomness seed (hash) before it is used, store the commitment as
its own auditable record (`randomness_commitments`), and reveal/consume it
only through the versioned GameEngine so results can be replayed
deterministically from the stored commitment.

## Consequences

Strong fairness guarantees and dispute resolution ability; the exact
commit-reveal scheme and KMS integration are implementation detail to be
finalized in Phase 2 (CLAUDE.md #53), not invented ad hoc per CLAUDE.md #58.
