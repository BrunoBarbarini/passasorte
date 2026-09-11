# ADR-018: Exact movement effect on the board

## Status

TBD

## Context

CLAUDE.md BR-022 states the exact effect of a LEFT/RIGHT movement command
is undecided; BR-023 records `PLAYER_TRANSLATION_V1` as an ASSUMPTION for
simulation/prototyping only, not a product decision. CLAUDE.md #56
(Product - CRITICAL) lists "what exactly does a movement move?" as an open
question, and #58 forbids inventing the answer.

## Decision

Not yet decided. The GameEngine interface (ADR-011) must accept a pluggable
movement-resolution strategy so this can be resolved without an engine
rewrite; `PLAYER_TRANSLATION_V1` may be used only in non-product
simulations/tests, clearly labeled as such.

## Consequences

Phase 2 (Game Domain Simulator, CLAUDE.md #53) cannot finalize the real
movement semantics until this is answered by the product owner; simulator
work must not be mistaken for a shipped rule.
