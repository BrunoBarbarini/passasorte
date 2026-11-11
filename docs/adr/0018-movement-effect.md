# ADR-018: Exact movement effect on the board

## Status

SUPERSEDED by ADR-022 (2026-11-11)

## Context

BR-022 left the effect of a LEFT/RIGHT command undecided and BR-023 recorded
`PLAYER_TRANSLATION_V1` as a simulation-only ASSUMPTION. The consolidated core
rules (CR-002/CR-003) and the owner's decisions of 2026-11-11 settle it.

## Decision

Movements displace **the Sorte**, never the participants' positions. One credit
= one position, on a circular bar. See ADR-022 for the full rule set.
`PLAYER_TRANSLATION_V1` is obsolete and must not be used in any room.

## Consequences

The simulator and tests built on `PLAYER_TRANSLATION_V1` must be replaced
together with GameEngine V2 (CLAUDE.md §0.4, TASK-083).
