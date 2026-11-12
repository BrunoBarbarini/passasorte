# ADR-024: Collective round window and clock model

- Status: ACCEPTED (owner decisions DECISION-16..21 and T-32/T-33, 2026-11-12)
- Supersedes: the sequential per-participant turn model

## Context
Sequential turns for hundreds of participants are slow and predictable. The owner decided on one collective action window per round.

## Decision
1. Each round has a window (`roundActionWindowSeconds`, configurable). Every participant may submit one action.
2. The server clock is authoritative: a submission is accepted only while `serverTime >= actionWindowClosesAt` is false.
3. Submissions are idempotent by `participationId + roundId + idempotencyKey`. A participant may replace a submission until the window closes and the **last one counts** (T-33, approved 2026-11-12). Every submission is stored (`round_action_submissions`, append-only, increasing `submissionSequence`); the resolved outcome is one row per participant in `round_actions` (`UNIQUE(round_id, participation_id)`).
4. After the window closes one worker wins the CAS `WINDOW_CLOSED → RESOLVING` and calls `resolveRound` in a single transaction holding the room lock.
5. Absent participants: `autoAction ≠ NONE` executes one automatic movement; `NONE` or zero balance is a skip that consumes nothing.
6. Each participant gets an audit row per round (DECISION-21).
7. The UI shows resolution in aggregate, never as slow per-player playback.

## Decided after the first version (2026-11-12, partner accepted the PDF suggestions)
- T-32: a round's actions are applied in `entrySequence` order, policy `ENTRY_SEQUENCE_V1`, stored per round. The engine still takes the order as an explicit input. With additive circular displacement the end-of-round Sorte position is order-independent; only per-action before/after in the audit depends on it.
- T-33: replace-until-close, last submission wins.
- T-10 (partial): 5 temperature levels, % of the bar size, level only. The numeric limits are still open and not part of this ADR.

## Consequences
- Domain: `round.ts` and `GameEngineV2.resolveRound`.
- R-21 is reframed; R-22/R-23 added.
