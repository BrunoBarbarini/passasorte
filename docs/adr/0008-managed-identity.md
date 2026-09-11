# ADR-008: Managed identity provider + internal RBAC

## Status
ACCEPTED (2026-09-11)

## Context
CLAUDE.md #17 requires managed identity plus internal roles (PARTICIPANT,
MERCHANT_OPERATOR, SUPPORT, OPERATOR, FINANCE, COMPLIANCE, ADMIN) with MFA
for privileged roles. This was originally an open, HIGH-priority technical
question (CLAUDE.md #56).

## Decision
Use **Supabase Auth** as the managed identity provider, behind an internal
`AuthPort` (`@passasorte/application`) so PassaSorte's domain/application
code never imports the Supabase SDK directly (CLAUDE.md #11/#46).

- `apps/api` verifies the Supabase-issued JWT on every request (a Nest
  guard reads the `Authorization: Bearer <token>` header and validates it
  against Supabase's JWKS/JWT secret).
- On first successful verification for a given Supabase user id,
  PassaSorte creates/updates its own `users` row (mirroring email and
  Supabase user id) — Supabase owns credentials/MFA/password recovery;
  PassaSorte owns authorization (roles, via `user_roles`) as its own data,
  never delegated to Supabase's role/claims system, so RBAC decisions stay
  auditable and queryable from PassaSorte's own database (CLAUDE.md #34).
- Supabase Postgres is also used as the managed PostgreSQL instance
  (ADR-004), so the API's database and identity provider are provisioned
  together, but remain logically separate: Prisma talks to the Postgres
  connection string, never to Supabase's client SDK, keeping `@passasorte/domain`
  and `@passasorte/application` free of any Supabase dependency.

## Consequences
Removes an open TBD blocking Phase 1 (Identity). Auth UI (login/signup/
password reset) for mobile/web can use Supabase's client SDKs directly
against Supabase Auth; PassaSorte's backend only ever sees and verifies
the resulting JWT. Privileged-role MFA (CLAUDE.md #17) is enforced via
Supabase Auth's MFA enrollment, checked as a claim on the verified token.
