# ADR-019: Winner-selection semantics

## Status

PARTIALLY DECIDED (2026-11-11)

## Context

BR-033 left open what determines a winner, multi-winner behavior and the
empty-zone case. Under the reconciled model every bar position is bought and
absent pickers are auto-allocated, so every position is owned.

## Decision

- **MVP:** `winningZoneSize = 1`. The Sorte's final position is the winning
  position; its owner is the single winner. No block, no multiple winners, no
  prize split (DECISION-06).
- **Future (K > 1):** the engine keeps `winningZoneSize` as configuration and
  `GameResult`/`Winner` persistence must represent several winning positions
  without a schema change, but K > 1 is rejected for real rooms until the
  zone-expansion rule (center/parity/edges/wrap) and the prize-split rule are
  formally defined. They must not be invented (T-05, T-11).

## Consequences

Result resolution for the MVP is a direct lookup of the owner of the final
position. The empty-winning-zone case cannot occur while unassigned positions
are forbidden.
