#!/usr/bin/env bash
# Verifică pe catalogul real că fiecare domeniu are pompe și fiecare material
# sugerează o categorie. Ridică o bază temporară, încarcă migrațiile și
# catalogul, apoi rulează verificarea în Node.
#
#   ./scripts/verifica-domenii.sh
#   DATABASE_URL=postgres://... ./scripts/verifica-domenii.sh
set -euo pipefail

cd "$(dirname "$0")/.."

DB_NAME="${DB_NAME:-romcrete_domenii}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -n "${DATABASE_URL:-}" ]; then
  PSQL=(psql -v ON_ERROR_STOP=1 "$DATABASE_URL")
else
  dropdb --if-exists "$DB_NAME"
  createdb "$DB_NAME"
  PSQL=(psql -v ON_ERROR_STOP=1 -d "$DB_NAME")
fi

MIGRATION_ARGS=()
for migration in supabase/migrations/*.sql; do
  MIGRATION_ARGS+=(-f "$migration")
done

"${PSQL[@]}" -q -f supabase/tests/00_stub_supabase.sql "${MIGRATION_ARGS[@]}"

# Catalogul se încarcă doar când există o firmă, deci migrația lui se reia acum —
# urmată de corecturile de import, exact cum trebuie să facă orice reîncărcare.
"${PSQL[@]}" -q \
  -c "insert into public.organizations (name) values ('Verificare');" \
  -f supabase/migrations/20260922180000_catalog_graco_date.sql \
  -c "select public.catalog_repara_pozitiile();"

"${PSQL[@]}" -t -A \
  -c "select json_agg(row_to_json(t)) from (select category, tech_type, description, materials, is_active, price_on_request from public.catalog_items) t;" \
  > "$TMP/catalog.json"
"${PSQL[@]}" -t -A \
  -c "select json_agg(row_to_json(d)) from (select id, label, pump_categories, tech_types from public.domains order by position) d;" \
  > "$TMP/domains.json"

node scripts/verifica-domenii.mjs "$TMP"
