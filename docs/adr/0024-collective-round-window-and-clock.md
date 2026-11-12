# ADR-024: Collective round window and clock model

- Status: ACCEPTED (owner decisions DECISION-16..21, 2026-11-12)
- Supersedes: the sequential per-participant turn model

## Context
Sequential turns for hundreds of participants are slow and predictable. The owner decided on one collective action window per round.

## Decision
1. Each round has a window (`roundActionWindowSeconds`, configurable). Every participant may submit one action.
2. The server clock is authoritative: a submission is accepted only while `serverTime >= actionWindowClosesAt` is false.
3. Submissions are idempotent by `participationId + roundId + idempotencyKey`; `UNIQUE(round_id, participation_id)`.
4. After the window closes one worker wins the CAS `WINDOW_CLOSED → RESOLVING` and calls `resolveRound` in a single transaction holding the room lock.
5. Absent participants: `autoAction ≠ NONE` executes one automatic movement; `NONE` or zero balance is a skip that consumes nothing.
6. Each participant gets an audit row per round (DECISION-21).
7. The UI shows resolution in aggregate, never as slow per-player playback.

## Open (not decided)
- T-32: `ROUND_RESOLUTION_ORDER`. The engine takes the order as an explicit input and records its policy id. `entrySequence` is only PROPOSED. With additive circular displacement the end-of-round Sorte position is order-independent; only per-action before/after in the audit depends on it.
- T-33: whether an action can be edited before the window closes. Until decided: one action per participant per round.

## Consequences
- Domain: `round.ts` and `GameEngineV2.resolveRound`.
- R-21 is reframed; R-22/R-23 added.
