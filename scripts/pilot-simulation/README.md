# Pilot simulation (TASK-069)

`run.ts` is a real, runnable script that walks a full campaign→room→
participation→resolution→benefit lifecycle against your local Postgres,
using the actual Prisma schema and the state-machine values CLAUDE.md #7
documents. See the long comment at the top of `run.ts` for exactly what it
does and does not validate — in short: referential integrity and state
transitions, not the (still undecided) game/movement/winner-selection
business rules themselves.

## Prerequisites

- `tsx` added to the root `package.json` devDependencies (done in this
  batch) — run `pnpm install` yourself on your Mac.
- Local docker-compose Postgres running and migrated, `.env` sourced —
  the same setup already validated manually earlier this session.

## Running it

```bash
npx tsx scripts/pilot-simulation/run.ts
```

Every row it creates is tagged with the string `pilot-simulation` (in the
merchant's `legalName` and the user's `email`), so it's easy to spot in
`prisma studio` afterwards. To remove everything the script created:

```bash
npx tsx scripts/pilot-simulation/run.ts --cleanup
```

## What a successful run looks like

The script logs each step and ends with `SUCCESS — full lifecycle
completed without a referential-integrity or state-machine error` plus
the ids it created. Any thrown error (a unique-constraint violation, a
foreign-key violation, a Prisma validation error) means either a real bug
was found, or the schema/state-machine values encoded in this script have
drifted from `prisma/schema.prisma` — check which before assuming either.
