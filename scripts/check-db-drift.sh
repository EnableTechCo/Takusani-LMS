#!/usr/bin/env bash
# Schema drift (local only): the running local database must match what the migrations produce.
# A change made in local Studio or by hand SQL, and not captured in a migration, shows up here.
# Run it BEFORE `supabase db reset`, which would rebuild the database from migrations and hide the drift.
set -euo pipefail

out=$(supabase db diff --local 2>&1) || { echo "$out"; exit 1; }
if echo "$out" | grep -qi "no schema changes found"; then
  echo "No schema drift."
  exit 0
fi

echo "$out"
echo "::error::The local database differs from the migrations. Capture the change with 'supabase db diff -f <name>' (or write a migration), then reset."
exit 1
