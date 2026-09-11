# ADR-019: Winner-selection semantics

## Status

TBD

## Context

CLAUDE.md BR-033 and #56 (Product - CRITICAL) leave open: what exactly
determines a winner, multi-winner behavior, and what happens when the
Sorte zone lands on no occupied position.

## Decision

Not yet decided. `GameResult`/`Winner` persistence (ADR-011, FR-042/FR-043)
must be able to represent zero, one, or multiple winners without a schema
change, so this can be resolved without a migration once answered.

## Consequences

Phase 2-3 result-resolution work must keep winner cardinality generic
until the product owner decides; no default ("first closest wins", etc.)
may be shipped as if it were confirmed.
