#!/usr/bin/env bash
# Apply all migrations in order, then load seed data.
# Usage: DATABASE_URL=postgres://printshop:printshop@localhost:5432/printshop ./db/run.sh
set -euo pipefail
DB="${DATABASE_URL:-postgres://printshop:printshop@localhost:5432/printshop}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Applying migrations…"
for f in "$DIR"/migrations/*.sql; do
  echo "  → $(basename "$f")"
  psql "$DB" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "Loading seed data…"
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$DIR/seed.sql"
echo "Done. Demo login: thandiwe@printshoppro.co.za / printshop2026"
