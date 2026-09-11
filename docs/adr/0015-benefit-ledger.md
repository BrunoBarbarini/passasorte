# ADR-015: Append-only benefit ledger

## Status

PROPOSED

## Context

CLAUDE.md BR-038/BR-039/FR-054..FR-058 require benefit balances to derive
from an immutable ledger, non-withdrawable/non-transferable until
explicitly approved otherwise.

## Decision

`benefit_ledger_entries` is append-only; `benefit_accounts.balance` (if
materialized) is always a projection of the ledger, never an
independently-mutated field. Redemption creates a ledger entry inside the
same transaction as the redemption record, guarded by idempotency
(FR-058).

## Consequences

Full auditability of every credit/debit; requires ledger replay/aggregation
logic instead of a simple `UPDATE balance = balance - x`.
