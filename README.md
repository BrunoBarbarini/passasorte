# PassaSorte

Mobile-first platform that connects consumers with businesses through
gamified access to products, services and experiences ("A sorte passa.
Você decide onde estar."). See [`CLAUDE.md`](./CLAUDE.md) for the full
product and engineering constitution — it is the source of truth for
everything below.

This repository is currently in **Phase 0 — Foundation** (CLAUDE.md #53):
monorepo scaffolding, quality toolchain, CI, local infra, typed
configuration and observability. No domain/game/API business logic has
been implemented yet.

## Requirements

- Node.js 22+ (see `.nvmrc`)
- [pnpm](https://pnpm.io) 10.9.8 (via `corepack enable`)
- Docker, for local Postgres/Redis (optional — you can point `.env` at any
  Postgres/Redis instance instead)

## Getting started

```bash
corepack enable
pnpm install

cp .env.example .env

# Optional: local Postgres + Redis
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Load `.env` into your shell (or use your preferred dotenv tool) before
running any app, since Node doesn't load `.env` files automatically.

```bash
pnpm build        # build all apps/packages via Turborepo
pnpm lint          # ESLint across the workspace
pnpm typecheck     # tsc --noEmit across the workspace
pnpm test          # Vitest across the workspace
pnpm format        # Prettier --write
```

Run the API in watch mode:

```bash
pnpm --filter @passasorte/api dev
```

Then `curl http://localhost:3000/health` should return `{"status":"ok",...}`.

## Repository layout

See CLAUDE.md #14 for the authoritative layout and rationale. Summary:

```text
apps/          deployable applications (api, worker, mobile, web)
packages/      shared libraries (domain, application, api-contract,
               config, observability, analytics, testkit)
infrastructure/  Terraform + local docker-compose
prisma/        database schema + migrations
docs/adr/      architectural decision records
docs/product/  product-facing documentation
scripts/       operational/dev scripts
tests/         cross-cutting e2e/load suites
```

`apps/worker`, `apps/mobile` and `apps/web` are intentionally not
scaffolded yet — each has a README explaining what phase introduces it.

## Working on this repo (for humans and for Claude)

Before implementing anything, read the relevant section(s) of
[`CLAUDE.md`](./CLAUDE.md) and the ADRs in [`docs/adr/`](./docs/adr/).
CLAUDE.md #47 and #60 define the exact guardrail checklist to follow, and
#58 lists what must never be invented (prices, board size, winner rules,
legal/compliance answers, ...) — when in doubt, it's a TBD, not a default.

## License

Proprietary — all rights reserved.
