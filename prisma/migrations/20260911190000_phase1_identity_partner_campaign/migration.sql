-- PassaSorte Phase 1: Identity + Partner + Campaign
-- Mirrors prisma/schema.prisma exactly. See that file for rationale/comments.

create type "RoleKey" as enum (
  'PARTICIPANT',
  'MERCHANT_OPERATOR',
  'SUPPORT',
  'OPERATOR',
  'FINANCE',
  'COMPLIANCE',
  'ADMIN'
);

create type "MerchantStatus" as enum ('ACTIVE', 'INACTIVE');

create type "ExperienceStatus" as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');

create type "CampaignStatus" as enum (
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'ENDED',
  'CANCELLED'
);

create table users (
  id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid not null unique,
  email text not null unique,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users (id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  role "RoleKey" not null,
  granted_at timestamptz not null default now(),
  granted_by_user_id uuid,
  unique (user_id, role)
);

create table merchants (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  status "MerchantStatus" not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table merchant_locations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants (id) on delete cascade,
  label text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table experiences (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants (id) on delete restrict,
  title text not null,
  description text not null,
  status "ExperienceStatus" not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants (id) on delete restrict,
  experience_id uuid not null references experiences (id) on delete restrict,
  title text not null,
  status "CampaignStatus" not null default 'DRAFT',
  timezone text not null default 'America/Sao_Paulo',
  experience_snapshot jsonb,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  published_at timestamptz,
  ended_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);

create table outbox_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0
);
create index outbox_events_processed_at_idx on outbox_events (processed_at);
