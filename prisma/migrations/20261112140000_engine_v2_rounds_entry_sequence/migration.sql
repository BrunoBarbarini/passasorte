-- PassaSorte Engine V2 (ADR-023, ADR-024): entry sequence, collective rounds,
-- replaceable round submissions, resolved round actions and the initial Sorte record.
-- EXPAND-only (CLAUDE.md #45): adds columns/tables, drops nothing. Legacy
-- tables (position_holds, movement_command_logs, final_movement_plan) stay
-- until the contract step (TASK-083).

-- DECISION-08: entry_sequence is assigned in the confirming transaction from a
-- per-room counter (UPDATE ... SET counter = counter + 1 RETURNING counter).
alter table game_rooms
  add column entry_sequence_counter integer not null default 0;

alter table participations
  add column entry_sequence integer;

-- Postgres allows many NULLs under a unique index; legacy rows stay valid.
create unique index participations_room_id_entry_sequence_key
  on participations (room_id, entry_sequence);

alter table participations
  add constraint participations_entry_sequence_positive
  check (entry_sequence is null or entry_sequence >= 1);

-- DECISION-16/17: one collective action window per round.
create table game_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references game_rooms (id) on delete restrict,
  round_no integer not null check (round_no >= 1),
  action_window_opens_at timestamptz not null,
  action_window_closes_at timestamptz not null,
  resolution_started_at timestamptz,
  resolution_completed_at timestamptz,
  status text not null default 'SCHEDULED'
    check (status in ('SCHEDULED', 'WINDOW_OPEN', 'WINDOW_CLOSED', 'RESOLVING', 'RESOLVED')),
  -- T-32 (approved): ENTRY_SEQUENCE_V1; recorded per round so a future policy is a new id.
  resolution_order_policy text,
  luck_position_before integer,
  luck_position_after integer,
  created_at timestamptz not null default now(),
  constraint game_rounds_window_valid check (action_window_closes_at > action_window_opens_at),
  constraint game_rounds_room_round_key unique (room_id, round_no)
);

create index game_rounds_status_closes_at_idx on game_rounds (status, action_window_closes_at);

-- T-33 (approved 2026-11-12): a participant may replace the action until the
-- window closes; the LAST submission counts. Every submission is kept
-- (append-only) so the audit shows what was sent and when.
create table round_action_submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references game_rounds (id) on delete restrict,
  participation_id uuid not null references participations (id) on delete restrict,
  -- Server-assigned, increasing per (round, participation); highest wins.
  submission_sequence integer not null check (submission_sequence >= 1),
  kind text not null check (kind in ('LEFT', 'RIGHT', 'STAY')),
  credits integer not null check (credits >= 0),
  -- Server clock, never the client's (BR-086).
  submitted_at timestamptz not null default now(),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint round_action_submissions_sequence_key
    unique (round_id, participation_id, submission_sequence),
  -- BR-086: a retried request (same key) never registers a second submission.
  constraint round_action_submissions_idem_key
    unique (participation_id, round_id, idempotency_key)
);

create index round_action_submissions_round_id_idx on round_action_submissions (round_id);

-- DECISION-21 / BR-085: the RESULT of a round for each participant (one row per
-- participant per round, written at resolution). Append-only.
create table round_actions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references game_rounds (id) on delete restrict,
  participation_id uuid not null references participations (id) on delete restrict,
  entry_sequence integer not null,
  kind text not null check (kind in ('LEFT', 'RIGHT', 'STAY')),
  credits integer not null check (credits >= 0),
  execution_type text not null check (execution_type in ('MANUAL', 'AUTOMATIC')),
  outcome text not null default 'APPLIED' check (outcome in ('APPLIED', 'SKIPPED')),
  skip_reason text,
  -- The winning (last) submission for MANUAL rows; null for AUTOMATIC / SKIPPED.
  submission_id uuid references round_action_submissions (id) on delete restrict,
  submitted_at timestamptz,
  -- T-32 (approved): applied in entry_sequence order, policy ENTRY_SEQUENCE_V1 (0-based).
  resolution_sequence integer not null check (resolution_sequence >= 0),
  luck_position_before integer,
  luck_position_after integer,
  created_at timestamptz not null default now(),
  -- BR-056: exactly one resolved outcome per participant per round.
  constraint round_actions_round_participation_key unique (round_id, participation_id)
);

create index round_actions_round_id_idx on round_actions (round_id);

-- DECISION-15: initial Sorte record, one per room, immutable (BR-079).
create table initial_sorte_records (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references game_rooms (id) on delete restrict,
  game_id text not null,
  board_size integer not null check (board_size >= 1),
  engine_version text not null,
  randomness_commitment_hash text not null,
  initial_luck_position integer not null,
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint initial_sorte_position_in_range
    check (initial_luck_position >= 1 and initial_luck_position <= board_size)
);

-- Append-only guards (BR-046): history can never be rewritten, not even by the API role.
create function ps_forbid_update_delete() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only (CLAUDE.md BR-046)', tg_table_name using errcode = '55000';
end;
$$;

create trigger round_actions_append_only
  before update or delete on round_actions
  for each row execute function ps_forbid_update_delete();

create trigger round_action_submissions_append_only
  before update or delete on round_action_submissions
  for each row execute function ps_forbid_update_delete();

create trigger initial_sorte_records_append_only
  before update or delete on initial_sorte_records
  for each row execute function ps_forbid_update_delete();

-- Same RLS posture as every other table (docs/adr/0008-managed-identity.md).
alter table game_rounds enable row level security;
alter table round_action_submissions enable row level security;
alter table round_actions enable row level security;
alter table initial_sorte_records enable row level security;
