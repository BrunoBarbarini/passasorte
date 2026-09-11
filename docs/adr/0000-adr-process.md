# ADR-000: How we use ADRs in PassaSorte

## Status

ACCEPTED

## Context

CLAUDE.md #55 lists a set of key architectural decisions (ADR-001..ADR-020)
that pre-date this repository's first commit. CLAUDE.md #59 places
"Accepted ADRs" above "existing implementation" in the source-of-truth
hierarchy, and #58 forbids Claude from inventing business/technical
decisions marked TBD.

## Decision

Each entry from CLAUDE.md #55 gets its own file here (`NNNN-slug.md`) with
the status CLAUDE.md currently records for it:

- **PROPOSED** - a reasonable default to build against, not yet formally
  confirmed by the product owner. Implementation may proceed, but the
  decision can still change with lower ceremony than an accepted one.
- **ACCEPTED STRATEGY** - treated as settled for architecture purposes.
- **TBD** - explicitly unresolved. No code may hard-code an assumed answer
  (CLAUDE.md #58); the ADR instead documents the open question and what
  depends on it.

When CLAUDE.md's own status for a decision changes (via an explicit
product/owner decision, per CLAUDE.md's priority rule at the top of the
file), update both CLAUDE.md and the matching ADR file in the same change.

## Consequences

Anyone (human or Claude) can find "why" a technology or strategy was
picked without re-deriving it from CLAUDE.md's prose, and TBDs are as
visible and trackable as accepted decisions.
