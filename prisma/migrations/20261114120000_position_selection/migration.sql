-- Expand-only (CLAUDE.md 45): position-selection phase (TASK-075, DECISION-07..11).
-- ENTRY_LOCKED -> POSITION_SELECTION -> READY -> RUNNING.
alter type "GameRoomStatus" add value if not exists 'POSITION_SELECTION' before 'RUNNING';
alter type "GameRoomStatus" add value if not exists 'READY' before 'RUNNING';

-- {pickWindowMs, startedAt, boardSize}: set when the selection starts, chosen by the operator per room.
alter table game_rooms
  add column if not exists position_selection jsonb;

-- One row per position owner. UNIQUE(room_id, position) is the final guard of BR-010
-- (atomic, exclusive acquisition); UNIQUE(room_id, position) alone already stops two owners.
create table room_position_assignments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references game_rooms(id) on delete restrict,
  participation_id uuid not null references participations(id) on delete restrict,
  position integer not null check (position >= 1),
  pick_kind text not null check (pick_kind in ('MANUAL', 'AUTOMATIC')),
  picked_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (room_id, position)
);
create index room_position_assignments_participation_idx
  on room_position_assignments (participation_id);

-- Append-only, like the other audit tables.
create trigger room_position_assignments_no_update
  before update or delete on room_position_assignments
  for each row execute function ps_forbid_update_delete();
