# PassaSorte Web / Backoffice

Web and backoffice app (CLAUDE.md #13, ADR-007: Next.js + React).

## Scope (Phase 5)

TASK-047 Game Operational Dashboard: a minimal, real operator surface
for the parts of Scheduled Game Operations (Phase 5) that benefit from
a human in the loop while `ENABLE_GAME_AUTO_ADVANCE` is off (CLAUDE.md
#22, default OFF) or as a manual override — never a second
implementation of apps/worker's logic, just apps/api's
`OperationsController` from a browser:

- Rooms currently OPEN / ENTRY_LOCKED / RUNNING / FINAL_LOCK / RESOLVING.
- The outbox backlog size (ADR-010).
- Manual "advance room", "expire holds" and "dispatch outbox" actions.

Sign-in is Supabase email/password (ADR-008 decided the PROVIDER; the
concrete sign-in METHOD here is a pragmatic implementation choice, same
as apps/mobile — not a CLAUDE.md decision). A full merchant/campaign
backoffice (FR-010..FR-017 CRUD screens) is not built here: this phase
only needed the game-operations surface TASK-047 asks for; those
screens are a natural next scaffold once a task asks for them.

## Local development

```
pnpm --filter @passasorte/web dev
```

Requires `apps/web/.env.example`'s variables — copy to `.env.local` and
fill in your Supabase project URL/anon key and the running apps/api
base URL. Signing in requires a Supabase user already granted the
OPERATOR or ADMIN role (CLAUDE.md #17) — this app has no self-service
role assignment, matching apps/api's `OperationsController` guard.
