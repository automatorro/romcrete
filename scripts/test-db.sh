#!/usr/bin/env bash
# Rulează migrațiile și verificările pe o bază PostgreSQL locală.
#
#   ./scripts/test-db.sh                      # folosește baza romcrete_test, prin psql local
#   DATABASE_URL=postgres://... ./scripts/test-db.sh
#
# Testele recreează baza de la zero, deci nu o folosi pe date reale.
set -euo pipefail

cd "$(dirname "$0")/.."

DB_NAME="${DB_NAME:-romcrete_test}"

if [ -n "${DATABASE_URL:-}" ]; then
  PSQL=(psql -v ON_ERROR_STOP=1 "$DATABASE_URL")
else
  dropdb --if-exists "$DB_NAME"
  createdb "$DB_NAME"
  PSQL=(psql -v ON_ERROR_STOP=1 -d "$DB_NAME")
fi

# Migrațiile se aplică în ordinea numelui, ca în Supabase.
MIGRATION_ARGS=()
for migration in supabase/migrations/*.sql; do
  MIGRATION_ARGS+=(-f "$migration")
done

"${PSQL[@]}" -q \
  -f supabase/tests/00_stub_supabase.sql \
  "${MIGRATION_ARGS[@]}" \
  -f supabase/tests/01_grants.sql

# 03 și 04 se rulează pe proiectul Supabase real, nu local.
"${PSQL[@]}" -f supabase/tests/02_smoke.sql -f supabase/tests/05_crm.sql -f supabase/tests/06_domenii.sql -f supabase/tests/07_istoric.sql
