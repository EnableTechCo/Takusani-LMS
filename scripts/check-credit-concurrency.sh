#!/usr/bin/env bash
# Transaction test 17, the concurrent half (S6-01; ADR-022): a unit with two required items, whose two Competent
# results are released by two sessions at the same moment, is awarded exactly once. Without the learner-unit lock each
# release would see the other as unreleased and neither would award.
#
# Local database only: it commits a learner, a unit, two assessments and a frozen requirement set to the local
# Supabase database (npm run db:reset clears them). Usage: bash scripts/check-credit-concurrency.sh
set -euo pipefail
export MSYS_NO_PATHCONV=1

container="$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_' | head -n 1)"
if [ -z "$container" ]; then
  echo "No local Supabase database is running (npx supabase start)." >&2
  exit 1
fi
psql() { docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -t -A "$@"; }

run="$(date +%s)"
cohort="10000000-0000-4000-8000-000000000010"
qualification="10000000-0000-4000-8000-000000000002"
coordinator="00000000-0000-4000-8000-000000000005"

# The fixture: a learner, unit CC<run> worth 5, two tasks and a frozen set requiring both, two held Competent results.
read -r learner unit < <(psql <<SQL | tr '|' ' '
with learner as (
  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
          'concurrency.$run@takusani.test', now(), now())
  returning id
), profile as (
  insert into identity.profiles (id, full_name) select id, 'Concurrency $run' from learner returning id
), enrolment as (
  insert into programmes.enrolments (cohort_id, profile_id) select '$cohort', id from profile returning profile_id
), unit as (
  insert into programmes.units (qualification_id, code, title) values ('$qualification', 'CC$run', 'Concurrency check')
  returning id
), credit as (
  insert into programmes.unit_credit_values (unit_id, credits) select id, 5 from unit returning unit_id
)
select (select profile_id from enrolment), (select unit_id from credit);
SQL
)
read -r result_a result_b < <(psql <<SQL | tr '|' ' '
with tasks as (
  insert into submissions.tasks (cohort_id, title, brief, submission_type, due_at, state, published_at, published_by)
  values ('$cohort', 'Concurrency A $run', 'A.', 'text', now() + interval '30 days', 'published', now(), '$coordinator'),
         ('$cohort', 'Concurrency B $run', 'B.', 'text', now() + interval '30 days', 'published', now(), '$coordinator')
  returning id, title
), items as (
  insert into assessment.assessable_items (cohort_id, kind, task_id, title)
  select '$cohort', 'task', id, title from tasks returning id, title
), results as (
  insert into assessment.results (assessable_item_id, learner_id) select id, '$learner' from items returning id, assessable_item_id
)
select string_agg(r.id::text, '|' order by i.title) from results r join items i on i.id = r.assessable_item_id;
SQL
)
psql <<SQL
insert into credits.requirement_sets (cohort_id, version, created_by, frozen_at, frozen_by)
values ('$cohort', coalesce((select max(version) from credits.requirement_sets where cohort_id = '$cohort'), 0) + 1,
        '$coordinator', null, null);
insert into credits.unit_assessment_requirements (requirement_set_id, unit_id, assessable_item_id)
select s.id, '$unit', r.assessable_item_id
from credits.requirement_sets s, assessment.results r
where s.cohort_id = '$cohort' and s.frozen_at is null and r.id in ('$result_a', '$result_b');
update credits.requirement_sets set frozen_at = now(), frozen_by = '$coordinator', reason = 'Concurrency check $run.'
where cohort_id = '$cohort' and frozen_at is null;
with d as (
  insert into assessment.decisions (result_id, type, outcome, actor_id, acting_role, justification)
  select r.id, 'assessment', 'competent', '00000000-0000-4000-8000-000000000003', 'assessor', 'Meets every criterion.'
  from assessment.results r where r.id in ('$result_a', '$result_b')
  returning id, result_id
)
update assessment.results r set current_decision_id = d.id from d where d.result_id = r.id;
SQL

# Two sessions release one result each. A holds its transaction open for two seconds after its release, so B's release
# happens while A's is uncommitted: exactly the case the lock exists for.
psql -c "begin; update assessment.results set state = 'released' where id = '$result_a'; select pg_sleep(2); commit;" >/dev/null &
first=$!
sleep 0.5
psql -c "begin; update assessment.results set state = 'released' where id = '$result_b'; commit;" >/dev/null &
second=$!
wait "$first" "$second"

awards="$(psql -c "select count(*) from credits.ledger_entries where learner_id = '$learner' and unit_id = '$unit' and entry_type = 'award';")"
awarded="$(psql -c "select awarded from credits.learner_unit_outcomes where learner_id = '$learner' and unit_id = '$unit';")"
if [ "$awards" = "1" ] && [ "$awarded" = "t" ]; then
  echo "ok: two concurrent releases awarded unit CC$run exactly once"
else
  echo "FAILED: $awards award entries, awarded=$awarded for unit CC$run" >&2
  exit 1
fi
