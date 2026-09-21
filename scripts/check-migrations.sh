#!/usr/bin/env bash
# Migration rules (docs/development/README.md "Database changes"), checked in CI and runnable locally:
#   1. File names are <14-digit UTC timestamp>_<lower_snake_case>.sql, and timestamps are unique.
#   2. With a base ref (pull requests): migrations already on the base branch are never modified,
#      renamed or deleted; applied migrations are immutable, so fix forward with a new migration.
#   3. With a base ref: every new migration sorts after every migration on the base branch, so
#      `supabase db push` applies it in order on staging without --include-all.
#
# Usage: scripts/check-migrations.sh [base-ref]     e.g. scripts/check-migrations.sh origin/main
set -euo pipefail

dir="supabase/migrations"
base="${1:-}"
status=0

fail() { echo "::error::$*"; status=1; }

invalid=$(find "$dir" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | grep -Ev '^[0-9]{14}_[a-z0-9]+(_[a-z0-9]+)*\.sql$' || true)
[ -z "$invalid" ] || fail "Migration file names must be <YYYYMMDDHHMMSS>_<lower_snake_case>.sql: $(echo $invalid)"

duplicates=$(find "$dir" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | cut -c1-14 | sort | uniq -d)
[ -z "$duplicates" ] || fail "Two migrations share a timestamp: $(echo $duplicates)"

if [ -n "$base" ]; then
  git rev-parse --verify --quiet "$base^{commit}" >/dev/null || { echo "::error::Base ref $base not found (fetch it first, e.g. git fetch origin main)."; exit 1; }
  changed=$(git diff --name-only --diff-filter=MDR "$base"...HEAD -- "$dir" | grep '\.sql$' || true)
  [ -z "$changed" ] || fail "Migrations already on $base were modified, renamed or deleted: $(echo $changed). Write a new corrective migration instead."

  latest_base=$(git ls-tree --name-only "$base" -- "$dir/" | grep '\.sql$' | xargs -r -n1 basename | sort | tail -n1 | cut -c1-14)
  if [ -n "$latest_base" ]; then
    for file in $(git diff --name-only --diff-filter=A "$base"...HEAD -- "$dir" | grep '\.sql$' || true); do
      stamp=$(basename "$file" | cut -c1-14)
      [ "$stamp" \> "$latest_base" ] || fail "$(basename "$file") is older than the newest migration on $base ($latest_base). Recreate it with 'supabase migration new' so it sorts last."
    done
  fi
fi

[ "$status" -eq 0 ] && echo "Migration rules pass."
exit "$status"
