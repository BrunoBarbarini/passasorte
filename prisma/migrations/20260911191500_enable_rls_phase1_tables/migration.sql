-- Locks direct Supabase (PostgREST/anon/authenticated key) access to every
-- Phase 1 table. PassaSorte's own API connects with a privileged Postgres
-- role via Prisma, which is unaffected by RLS with no policies defined
-- (RLS only restricts roles it is explicitly applied to's default-deny
-- behavior; the API's role is not `anon`/`authenticated`). See
-- docs/adr/0008-managed-identity.md.
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."merchants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."merchant_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."experiences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."outbox_events" ENABLE ROW LEVEL SECURITY;
