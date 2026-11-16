-- Expand-only (CLAUDE.md 45): DECISION-23..37 — position-selection window per room, audit per
-- window and idempotent turn notices.

-- DECISION-23/36: {selectionWindowSeconds, warningThresholdSeconds?, upcomingTurnThresholds?, autoAssignOnTimeout}
-- chosen by the operator per room; no default exists.
alter table game_rooms
  add column if not exists position_selection_config jsonb;

-- DECISION-34: one audit row per selection window (append-only).
create table position_selection_windows (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references game_rooms(id) on delete restrict,
  participation_id uuid not null references participations(id) on delete restrict,
  entry_sequence integer not null check (entry_sequence >= 1),
  window_opened_at timestamptz not null,
  window_closes_at timestamptz not null,
  selection_type text not null check (selection_type in ('MANUAL', 'AUTOMATIC')),
  selected_positions integer[] not null,
  automatic_selection_reason text check (automatic_selection_reason in ('TIMEOUT')),
  selection_completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (room_id, participation_id),
  check ((selection_type = 'AUTOMATIC') = (automatic_selection_reason is not null))
);
create index position_selection_windows_participation_idx
  on position_selection_windows (participation_id);
create trigger position_selection_windows_no_update
  before update or delete on position_selection_windows
  for each row execute function ps_forbid_update_delete();

-- DECISION-25/35: which time/turn notices were already sent, so retries never duplicate them.
create table position_selection_notices (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references game_rooms(id) on delete restrict,
  participation_id uuid not null references participations(id) on delete restrict,
  kind text not null check (kind in ('TURN_WARNING', 'TURN_APPROACHING')),
  threshold integer not null check (threshold >= 1),
  created_at timestamptz not null default now(),
  unique (room_id, participation_id, kind, threshold)
);
create trigger position_selection_notices_no_update
  before update or delete on position_selection_notices
  for each row execute function ps_forbid_update_delete();
