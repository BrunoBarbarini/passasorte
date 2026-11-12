# ADR-023: Entry → lock → exact-position selection and dynamic bar

- Status: ACCEPTED (owner decisions DECISION-07..11, 2026-11-12)
- Supersedes: the entry-time position hold design

## Context
Participants buy positions and movements before the bar exists. The owner decided that the bar is created only after entries close, that each participant chooses exact positions in entry order, and that no position may stay empty.

## Decision
1. During entry only the composition (positions, movements, autoAction) is recorded; there are no holds.
2. `entrySequence` is assigned in the confirming transaction from a per-room counter (server clock/counter, unique, gapless, immutable, `UNIQUE(room_id, entry_sequence)`).
3. When entries close, `boardSize = Σ position credits`.
4. Selection runs in `entrySequence` order; each picker chooses exactly the purchased number of free positions. The last picker takes what is left; the bar never grows.
5. Absent pickers get a deterministic server-side random allocation from the committed seed.
6. The match starts only if `allocatedPositions == boardSize`.
7. Quadrants are disabled (`quadrantsEnabled = false`).

## Consequences
- Pure logic lives in `packages/domain/src/game/v2/entry-phase.ts`; persistence is TASK-098/075/076.
- The database stays the final concurrency guard (unique constraints).
- Late entrants may get worse positions: disclosed in the terms (R-24).
