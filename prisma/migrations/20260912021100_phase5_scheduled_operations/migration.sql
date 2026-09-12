-- PassaSorte Phase 5: Scheduled Game Operations
-- Mirrors prisma/schema.prisma exactly. See that file for rationale/comments.

alter table game_rooms
  add column operations_config jsonb not null default '{"finalLockGracePeriodMs": 0}',
  add column final_locked_at timestamptz;

-- The default above only exists so the ALTER can apply to any pre-existing
-- rows without failing; every room created from here on always supplies
-- its own operationsConfig explicitly (CreateRoomUseCase), so the
-- transitional default is never relied on going forward.
alter table game_rooms alter column operations_config drop default;

alter table participations
  add column final_movement_plan jsonb;

create table movement_command_logs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  participation_id uuid not null references participations (id) on delete cascade,
  position_index integer not null,
  direction text not null,
  sequence integer not null,
  created_at timestamptz not null default now()
);

create index movement_command_logs_room_id_sequence_idx on movement_command_logs (room_id, sequence);

create table game_runs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references game_rooms (id) on delete cascade,
  engine_version text not null,
  commitment_hash text not null,
  seed text not null,
  final_sorte_zone jsonb,
  steps jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table winners (
  id uuid primary key default gen_random_uuid(),
  game_run_id uuid not null references game_runs (id) on delete cascade,
  participation_id uuid not null,
  winning_position integer not null,
  created_at timestamptz not null default now()
);

create index winners_game_run_id_idx on winners (game_run_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_read_at_idx on notifications (user_id, read_at);

create table notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  channel text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (user_id, channel)
);

-- Same RLS posture as Phases 1/3/4: the API connects via a privileged
-- Postgres role through Prisma, unaffected by RLS with no policies
-- attached; this only blocks direct PostgREST/anon/authenticated access.
ALTER TABLE "public"."movement_command_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."game_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."winners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;
