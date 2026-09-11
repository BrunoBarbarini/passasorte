# prisma/migrations/

These migrations were applied directly to the project's Supabase Postgres
instance via the Supabase MCP tools (`apply_migration`), not via
`prisma migrate dev`, because this environment has no direct Postgres
connection string/password for the Supabase project (Supabase's MCP tools
are the sanctioned way to run DDL against it without ever handling a raw
credential here).

The SQL in each folder is kept in sync with what was actually applied, so
CLAUDE.md #45 ("every schema change is versioned") still holds, and so
`prisma migrate deploy` (CI/production, with a real `DATABASE_URL`) can
replay the exact same history. Before the first `prisma migrate deploy`
against this database from an environment that *does* have the connection
string, run `prisma migrate resolve --applied <migration_name>` for each
folder here (in order) so Prisma's own `_prisma_migrations` tracking table
matches reality instead of trying to re-run DDL that already exists.
