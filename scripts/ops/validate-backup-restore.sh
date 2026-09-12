#!/usr/bin/env bash
# TASK-063 (Backup/PITR Validation) — real, runnable backup/restore cycle
# against the LOCAL docker-compose Postgres (infrastructure/docker/docker-compose.yml).
#
# What this validates: that a pg_dump of the current schema+data can be
# restored cleanly into a fresh database, exercising the actual mechanics
# of backup/restore against this project's real schema (prisma/schema.prisma).
#
# What this does NOT validate: real Supabase Point-in-Time Recovery. Supabase
# manages PITR itself (WAL-based, via their own infrastructure) — there is no
# local equivalent to test from this repo, and validating it for real requires
# either the Supabase dashboard's own restore flow or contacting Supabase
# support to perform a real point-in-time restore against a project (never done
# from this session — no Supabase project credentials with that scope exist
# here). See docs/runbooks/backup-pitr.md for the real Supabase PITR procedure.
#
# Usage (from repo root, with the local docker-compose stack running):
#   ./scripts/ops/validate-backup-restore.sh

set -euo pipefail

COMPOSE_FILE="infrastructure/docker/docker-compose.yml"
SOURCE_DB="${SOURCE_DB:-passasorte}"
SOURCE_CONTAINER="${SOURCE_CONTAINER:-$(docker compose -f "$COMPOSE_FILE" ps -q postgres)}"
RESTORE_DB="passasorte_restore_validation"
DUMP_FILE="/tmp/passasorte-backup-validation-$(date +%s).sql"

if [ -z "$SOURCE_CONTAINER" ]; then
  echo "[validate-backup-restore] postgres container not found/running — start it first:"
  echo "  docker compose -f $COMPOSE_FILE up -d"
  exit 1
fi

echo "[validate-backup-restore] dumping '$SOURCE_DB' from container $SOURCE_CONTAINER..."
docker exec "$SOURCE_CONTAINER" pg_dump -U postgres "$SOURCE_DB" > "$DUMP_FILE"
echo "[validate-backup-restore] dump written to $DUMP_FILE ($(wc -c < "$DUMP_FILE") bytes)"

echo "[validate-backup-restore] creating fresh database '$RESTORE_DB' for restore..."
docker exec "$SOURCE_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS $RESTORE_DB;"
docker exec "$SOURCE_CONTAINER" psql -U postgres -c "CREATE DATABASE $RESTORE_DB;"

echo "[validate-backup-restore] restoring dump into '$RESTORE_DB'..."
docker exec -i "$SOURCE_CONTAINER" psql -U postgres -d "$RESTORE_DB" < "$DUMP_FILE"

echo "[validate-backup-restore] comparing table counts between source and restored database..."
SOURCE_TABLES=$(docker exec "$SOURCE_CONTAINER" psql -U postgres -d "$SOURCE_DB" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
RESTORED_TABLES=$(docker exec "$SOURCE_CONTAINER" psql -U postgres -d "$RESTORE_DB" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

echo "[validate-backup-restore] source public tables: $SOURCE_TABLES, restored public tables: $RESTORED_TABLES"

if [ "$SOURCE_TABLES" != "$RESTORED_TABLES" ]; then
  echo "[validate-backup-restore] FAIL — table count mismatch"
  exit 1
fi

echo "[validate-backup-restore] cleaning up: dropping '$RESTORE_DB' and removing dump file..."
docker exec "$SOURCE_CONTAINER" psql -U postgres -c "DROP DATABASE $RESTORE_DB;"
rm -f "$DUMP_FILE"

echo "[validate-backup-restore] PASS — dump/restore cycle completed and table counts matched."
