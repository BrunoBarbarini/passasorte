# ADR-022: The Sorte moves — GameEngine V2 contract

## Status

ACCEPTED (2026-11-11). Items 1-6 are owner decisions (DECISION-01..06). Items 8-9
are ASSUMPTIONS adopted with the owner's authorization (T-07, T-31) and revisable.

## Context

The consolidated core rules (CR-001..CR-033) state that players do **not** move:
positions are fixed after the selection phase and the **Sorte** is the only
movable entity. The earlier prototype (`PLAYER_TRANSLATION_V1`, ADR-018) is
obsolete. On 2026-11-11 the product owner closed the rules that blocked the
engine (DECISION-01..06, CLAUDE.md §6.5).

## Decision

1. **Movement.** Each movement credit displaces the Sorte by exactly one
   position (LEFT = lower, RIGHT = higher). STAY does not displace.
2. **Circular bar.** `BAR_BOUNDARY_POLICY = CIRCULAR`:
   `next = ((pos - 1 + delta) mod N + N) mod N + 1` with `delta = +credits`
   (RIGHT), `-credits` (LEFT), `0` (STAY). `N + RIGHT -> 1`, `1 + LEFT -> N`.
   CLAMP, REJECT and BOUNCE/REVERSE_DIRECTION are not implemented. Distance
   (temperature) uses circular distance `min(abs(a-b), N - abs(a-b))`.
3. **Single credit unit.** `1 credit = 1 position OR 1 movement`, same cost.
   `creditQuantity` (count) and `creditUnitPrice` (integer minor units, per
   campaign) are separate domain values; neither is hard-coded.
   `maxCreditsPerParticipant` is a campaign setting enforced server-side,
   cumulatively; an over-limit purchase is rejected in full.
4. **Absence at a turn.** Participant `autoAction` is `LEFT | RIGHT | STAY |
   NONE`. Absent with `autoAction != NONE`: the action executes as a normal move,
   consumes 1 movement, recorded `executionType = AUTOMATIC` (vs `MANUAL`).
   Absent with `NONE`: the turn is skipped (`outcome = SKIPPED`), nothing is
   consumed, the participant is notified; the skip is a hash-chained transition.
5. **Expiry.** Unused movements expire when the participation ends: no
   cashback, refund, balance, transfer or carry-over. Movement credits are
   campaign-scoped.
6. **Result in the MVP.** `winningZoneSize = 1`: the final Sorte position is the
   winning position and its owner the single winner. The engine keeps
   `winningZoneSize` as configuration but **rejects K > 1** for real rooms until
   a zone-expansion rule and a prize-split rule are formally defined.
7. **Contract.** `initialize`, `applyMovement`, `skipTurn`, `calculateWinners`,
   `replay` — pure, versioned, deterministic; hash-chained transitions
   (`previousStateHash`/`currentStateHash`), `engineVersion` persisted per room.

8. **No final lock (T-07).** There is no final strategy lock / final plan; the
   game ends at the last turn of the last round and the result is resolved right after.
9. **Derived semantics (T-31).** A manual STAY costs 1 movement; `maxMovementsPerTurn`
   is a campaign setting for manual commands (explicit number or explicit `null`,
   no default); there is no explicit pass (not acting before the server deadline =
   absent); an automatic action always consumes exactly 1 movement; with zero
   balance a turn is skipped with reason `NO_MOVEMENTS_LEFT` (vs
   `ABSENT_NO_AUTO_ACTION`).

Supersedes ADR-018. Amends ADR-011 (contract) and narrows ADR-019.

## Consequences

- `PLAYER_TRANSLATION_V1`, `positionIndex` commands and any bounded/linear
  board behavior are obsolete and must be migrated (CLAUDE.md §0.4, C-17).
- Required tests: golden scenarios G-01..G-12 (CLAUDE.md §36.1) plus property
  tests (reversibility, full lap, conservation, skipped turn = 0 credits).
- A participant may skip every round at no cost and spend all movements in the
  last turn (R-21). A per-turn cap (T-31b) is the lever; simulate before the pilot.
- Numbers used in the owner's examples (10/20 credits, R$ 0,50, 200/300
  positions) are examples, never constants.
