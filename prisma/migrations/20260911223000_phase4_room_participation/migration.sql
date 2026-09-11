-- PassaSorte Phase 3/4: Room, Position Hold, Participation
-- Mirrors prisma/schema.prisma exactly. See that file for rationale/comments.

create type "GameRoomStatus" as enum (
  'DRAFT',
  'OPEN',
  'ENTRY_LOCKED',
  'RUNNING',
  'FINAL_LOCK',
  'RESOLVING',
  'COMPLETED',
  'CANCELLED'
);

create type "PositionHoldStatus" as enum ('ACTIVE', 'RELEASED', 'COMMITTED', 'EXPIRED');

create type "ParticipationStatus" as enum (
  'CREATED',
  'RESERVED',
  'AWAITING_REQUIREMENT',
  'CONFIRMED',
  'ACTIVE',
  'LOCKED',
  'RESOLVED',
  'WON',
  'NOT_WON',
  'COMPLETED'
);

create table game_rooms (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id),
  capacity integer not null,
  game_config jsonb not null,
  hold_ttl_ms integer not null,
  participation_packages jsonb not null,
  status "GameRoomStatus" not null default 'DRAFT',
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancellation_reason text
);

create table position_holds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references game_rooms (id) on delete cascade,
  position integer not null,
  holder_ref text not null,
  status "PositionHoldStatus" not null default 'ACTIVE',
  held_at timestamptz not null,
  expires_at timestamptz not null,
  unique (room_id, position)
);

create table participations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references game_rooms (id),
  user_id uuid not null references users (id),
  package_id text not null,
  positions integer[] not null,
  status "ParticipationStatus" not null default 'CREATED',
  movement_allowance_total integer not null,
  movement_allowance_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index participations_user_id_room_id_idx on participations (user_id, room_id);

create table idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  created_at timestamptz not null default now()
);

-- Same RLS posture as Phase 1 (see the 20260911191500 migration): the
-- API connects via a privileged Postgres role through Prisma, unaffected
-- by RLS with no policies attached; this only blocks direct
-- PostgREST/anon/authenticated access to these tables.
ALTER TABLE "public"."game_rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."position_holds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."participations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."idempotency_keys" ENABLE ROW LEVEL SECURITY;
