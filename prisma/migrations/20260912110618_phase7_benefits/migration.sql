-- PassaSorte Phase 7: Benefits
-- Mirrors prisma/schema.prisma exactly. See that file for rationale/comments.
--
-- Deliberately only the 3 tables the ERD (CLAUDE.md #8) names. There is
-- no separate "benefits" table: a Benefit is derived at query time from
-- a GRANT row in benefit_ledger_entries plus, once it exists, the single
-- debit row that closed it out.

create table benefit_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table benefit_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references benefit_accounts (id) on delete restrict,
  user_id uuid not null,
  type text not null,
  amount_minor_units integer not null,
  reason text,
  source_ref text,
  expires_at timestamptz,
  -- References the GRANT row this debit closes out; null on every GRANT
  -- row. Postgres allows unlimited NULLs under a unique index, so this
  -- constraint enforces "at most one debit per grant" without blocking
  -- multiple grants from ever existing (BR-039's race-safety backstop,
  -- same pattern as position_holds' (room_id, position) constraint).
  grant_entry_id uuid unique references benefit_ledger_entries (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index benefit_ledger_entries_account_id_idx on benefit_ledger_entries (account_id);
create index benefit_ledger_entries_expires_at_idx on benefit_ledger_entries (expires_at);

create table benefit_redemptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references benefit_accounts (id) on delete restrict,
  benefit_id uuid not null,
  amount_minor_units integer not null,
  redeemed_at timestamptz not null default now()
);

create index benefit_redemptions_account_id_idx on benefit_redemptions (account_id);

-- Same RLS posture as Phases 1/3/4/5: the API connects via a privileged
-- Postgres role through Prisma, unaffected by RLS with no policies
-- attached; this only blocks direct PostgREST/anon/authenticated access.
ALTER TABLE "public"."benefit_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."benefit_ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."benefit_redemptions" ENABLE ROW LEVEL SECURITY;
