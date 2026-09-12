# Load test (TASK-062)

`campaigns-read.js` is a real, runnable `autocannon`-based smoke load test
against `apps/api`'s read path (`/health`, `/api/v1/campaigns`). It is the
one script in this batch designed to actually be executed by you, against
your own local API — everything else in Phase 8b (Terraform, CI/CD,
alerts) is written but never applied/run for real, since this session has
no real GCP credentials.

## Prerequisites

1. `autocannon` added to the root `package.json` devDependencies (done in
   this same batch) — run `pnpm install` yourself on your Mac (not via
   this session, to avoid the platform-binary mismatch documented earlier
   in `claude/contexto-passasorte.md`).
2. `apps/api` running locally (`pnpm --filter @passasorte/api dev`, with
   `.env` sourced and Postgres/Redis up via docker-compose — the exact
   steps already validated manually this session).

## Running it

```bash
node scripts/load-test/campaigns-read.js
# or, with custom parameters:
node scripts/load-test/campaigns-read.js --url http://localhost:3000 --duration 30 --connections 20
```

## What it does NOT do

- It never writes/mutates data — only `GET /health` and
  `GET /api/v1/campaigns` are exercised, both read-only.
- It does not exercise `apps/worker`, holds, participations, or any
  transactional path — that is `scripts/pilot-simulation/`'s job
  (TASK-069), which is a correctness simulation, not a load test.
- It does not validate the p95 latency SLO target proposed in
  `docs/slo/slos.md` against real production traffic — only against
  your local machine, which has completely different resource
  constraints than Cloud Run. Treat results as a smoke test, not a
  capacity-planning number.
