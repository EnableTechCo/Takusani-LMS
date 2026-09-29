-- Sign-off and release (S4-09; FR-510, FR-511; BR-04, BR-05; P-05, P-06; ADR-019). One transaction releases a
-- cycle's frozen population.
--   * Who: a moderator of the cohort who took no assessment decision on any result in the frozen population (P-05,
--     tightened 29 Sep 2026): sign-off releases the whole population, so the signer must have assessed none of it.
--   * When: every sample item is concluded (agreed) and no return is open (FR-510). A refusal lists what blocks it.
--   * What: exactly the population claimed at the freeze (P-06). Held results are released; a released result whose
--     later decision was held behind the release (P-04) gets that decision as current, with a new release. The
--     release guard writes each result's release time, sequence number, appeal deadline and remediation deadline,
--     and the release trigger tells each learner (FR-511). Results decided after the freeze stay pending for the
--     next cycle. Released results leave the cycle's hold (hold_cycle_id null) so a later decision on one of them
--     can wait for a cycle again; what was released is kept in moderation.releases.
--   * Credits (FR-801) are evaluated when the credits module is built (S6-01); sign-off is where it will hook in.
--   * The cycle records who signed, when, the statement, and the counts. A retry returns the original facts and
--     changes nothing (test plan 7). The scope closes, so another cycle can cover the same items.

-- ---------------------------------------------------------------------------------------------------------------
-- Records
-- ---------------------------------------------------------------------------------------------------------------

alter table moderation.cycles
  add column signed_off_at timestamptz,
  add column signed_off_by uuid references identity.profiles (id),
  add column sign_off_statement text check (sign_off_statement is null or char_length(btrim(sign_off_statement)) between 1 and 2000),
  add column released_count integer check (released_count is null or released_count >= 0),
  add column notified_count integer check (notified_count is null or notified_count >= 0),
  add constraint sign_off_is_recorded check (
    (state = 'signed_off') = (signed_off_at is not null and signed_off_by is not null and sign_off_statement is not null
                              and released_count is not null and notified_count is not null)
  );

-- Exactly what a sign-off released: one row per result, with the release facts as written. Append-only.
create table moderation.releases (
  cycle_id uuid not null references moderation.cycles (id),
  result_id uuid not null references assessment.results (id),
  decision_id uuid not null references assessment.decisions (id),
  release_seq bigint not null,
  released_at timestamptz not null,
  primary key (cycle_id, result_id)
);

create index releases_result_idx on moderation.releases (result_id);
create index releases_decision_idx on moderation.releases (decision_id);

revoke all on table moderation.releases from public, anon, authenticated, service_role;

create trigger releases_append_only
  before update or delete on moderation.releases
  for each row execute function audit.forbid_mutation();
create trigger releases_append_only_truncate
  before truncate on moderation.releases
  for each statement execute function audit.forbid_mutation();

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled', 'session_series_scheduled', 'session_series_changed',
                 'session_series_cancelled', 'notice', 'appeal_received', 'appeal_lodged', 'appeal_admitted',
                 'appeal_inadmissible', 'appeal_review_allocated', 'appeal_decided', 'appeal_concluded',
                 'sign_in_locked', 'sign_in_unlocked', 'role_assigned', 'role_ended', 'password_reset_sent',
                 'account_deactivated', 'account_reactivated', 'readiness_item_assigned', 'query_assigned',
                 'moderation_items_allocated', 'moderation_item_reallocated',
                 'moderation_item_returned', 'moderation_return_logged', 'moderation_item_remarked',
                 'moderation_cycle_signed_off')
);

-- ---------------------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------------------

-- The results a cycle holds or released: its frozen population.
create function moderation.population_results(p_cycle_id uuid)
returns table (result_id uuid)
language sql
stable
set search_path = ''
as $$
  select r.id from assessment.results r where r.hold_cycle_id = p_cycle_id
  union
  select rl.result_id from moderation.releases rl where rl.cycle_id = p_cycle_id
$$;

-- How many of a cycle's population results this person took an assessment decision on (P-05).
create function moderation.assessed_in_population(p_profile_id uuid, p_cycle_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(distinct d.result_id)::integer
  from assessment.decisions d
  where d.type = 'assessment' and d.actor_id = p_profile_id
    and d.result_id in (select pr.result_id from moderation.population_results(p_cycle_id) pr)
$$;

-- Whether this person may sign off the cycle: a moderator of its cohort who assessed none of its population.
create function moderation.may_sign_off(p_profile_id uuid, p_cycle_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from moderation.cycles c
    join moderation.eligible_moderators(c.cohort_id) em on em.profile_id = p_profile_id
    where c.id = p_cycle_id
  ) and moderation.assessed_in_population(p_profile_id, p_cycle_id) = 0
$$;

-- What blocks a sign-off (FR-510): sample items not concluded, and returns still open. Empty when nothing does.
create function moderation.sign_off_blockers(p_cycle_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', si.id, 'seq', si.seq, 'learner_name', lp.full_name, 'item_title', ai.title,
           'assessor_name', ap.full_name, 'moderator_id', si.moderator_id, 'moderator_name', mp.full_name,
           'state', si.state, 'returned_at', rt.returned_at, 'due_on', rt.due_on,
           'overdue', rt.due_on < (now() at time zone 'Africa/Johannesburg')::date)
           order by si.seq), '[]'::jsonb)
  from (
    select x.*, row_number() over (order by x.stratum, x.result_id)::integer as seq
    from moderation.sample_items x where x.cycle_id = p_cycle_id
  ) si
  join assessment.results r on r.id = si.result_id
  join assessment.assessable_items ai on ai.id = r.assessable_item_id
  join identity.profiles lp on lp.id = r.learner_id
  join assessment.decisions d on d.id = coalesce(r.pending_decision_id, r.current_decision_id)
  left join identity.profiles ap on ap.id = d.actor_id
  left join identity.profiles mp on mp.id = si.moderator_id
  left join moderation.returns rt on rt.sample_item_id = si.id and rt.remarked_at is null
  where si.state <> 'agreed'
$$;

revoke all on function moderation.population_results(uuid), moderation.assessed_in_population(uuid, uuid),
  moderation.may_sign_off(uuid, uuid), moderation.sign_off_blockers(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- M-04: everything the sign-off page shows
-- ---------------------------------------------------------------------------------------------------------------

-- For a moderator of the cohort (eligible or not: an ineligible one is told why and who can sign).
create function api.get_sign_off(p_cycle_id uuid)
returns table (
  cycle_id uuid,
  name text,
  state text,
  version integer,
  cohort_id uuid,
  cohort_name text,
  planned_by_name text,
  planned_at timestamptz,
  frozen_at timestamptz,
  frozen_by_name text,
  population integer,
  competent integer,
  not_yet_competent integer,
  sample integer,
  concluded integer,
  unallocated integer,
  observations integer,
  after_freeze integer,
  blockers jsonb,
  may_sign boolean,
  assessed_by_me integer,
  other_signers jsonb,
  appeal_window_days integer,
  signed_off_at timestamptz,
  signed_off_by_name text,
  sign_off_statement text,
  released_count integer,
  notified_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.state, c.version, c.cohort_id, co.name, pb.full_name, c.planned_at, c.frozen_at, fb.full_name,
    (select count(*)::integer from moderation.population_results(c.id)),
    (select count(*)::integer from moderation.population_results(c.id) pr join assessment.results r on r.id = pr.result_id
       join assessment.decisions d on d.id = coalesce(r.pending_decision_id, r.current_decision_id)
       where d.outcome = 'competent'),
    (select count(*)::integer from moderation.population_results(c.id) pr join assessment.results r on r.id = pr.result_id
       join assessment.decisions d on d.id = coalesce(r.pending_decision_id, r.current_decision_id)
       where d.outcome = 'not_yet_competent'),
    (select count(*)::integer from moderation.sample_items si where si.cycle_id = c.id),
    (select count(*)::integer from moderation.sample_items si where si.cycle_id = c.id and si.state = 'agreed'),
    (select count(*)::integer from moderation.sample_items si where si.cycle_id = c.id and si.moderator_id is null),
    (select count(*)::integer from moderation.observations o where o.cycle_id = c.id),
    (select count(*)::integer from assessment.results r
       join moderation.cycle_scope s on s.cycle_id = c.id and s.assessable_item_id = r.assessable_item_id
       where moderation.is_waiting(r)),
    moderation.sign_off_blockers(c.id),
    moderation.may_sign_off(auth.uid(), c.id),
    moderation.assessed_in_population(auth.uid(), c.id),
    coalesce((select jsonb_agg(em.full_name order by em.full_name) from moderation.eligible_moderators(c.cohort_id) em
              where em.profile_id <> auth.uid() and moderation.may_sign_off(em.profile_id, c.id)), '[]'::jsonb),
    coalesce(audit.config_int('appeal.window_days'), 7),
    c.signed_off_at, sb.full_name, c.sign_off_statement, c.released_count, c.notified_count
  from moderation.cycles c
  join programmes.cohorts co on co.id = c.cohort_id
  join identity.profiles pb on pb.id = c.planned_by
  left join moderation.populations p on p.cycle_id = c.id
  left join identity.profiles fb on fb.id = p.frozen_by
  left join identity.profiles sb on sb.id = c.signed_off_by
  where c.id = p_cycle_id
    and c.state in ('frozen', 'signed_off')
    and (exists (select 1 from moderation.eligible_moderators(c.cohort_id) em where em.profile_id = auth.uid())
         or exists (select 1 from moderation.sample_items si where si.cycle_id = c.id and si.moderator_id = auth.uid()))
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- The sign-off
-- ---------------------------------------------------------------------------------------------------------------

-- Refusals: unauthenticated, not_found, not_frozen, stale_version, not_eligible (details: how many population
-- results the caller assessed), blocked (details: the items, as sign_off_blockers lists them), statement_required.
-- already_signed_off returns the original facts. The function sets its own statement timeout, which PostgREST
-- applies in place of the role's default (spike X-4); the release itself is set-based.
create function api.sign_off_moderation_cycle(p_cycle_id uuid, p_expected_version integer, p_statement text)
returns table (status text, signed_off_at timestamptz, released integer, notified integer, details jsonb)
language plpgsql
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v_actor uuid := auth.uid();
  v_cycle moderation.cycles;
  v_cohort_name text;
  v_statement text := nullif(btrim(coalesce(p_statement, '')), '');
  v_blockers jsonb;
  v_assessed integer;
  v_released integer := 0;
  v_pending integer := 0;
  v_notified integer;
  v_now timestamptz;
  v_coordinator uuid;
  v_digest text;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::timestamptz, null::integer, null::integer, null::jsonb; return; end if;

  select * into v_cycle from moderation.cycles c where c.id = p_cycle_id;
  if not found or not exists (select 1 from moderation.eligible_moderators(v_cycle.cohort_id) em where em.profile_id = v_actor) then
    return query select 'not_found'::text, null::timestamptz, null::integer, null::integer, null::jsonb; return;
  end if;

  -- Lock order (ADR-019): the cohort's moderation state, then the cycle, then the results.
  perform 1 from programmes.cohort_moderation_state ms where ms.cohort_id = v_cycle.cohort_id for update;
  select * into v_cycle from moderation.cycles c where c.id = p_cycle_id for update;

  if v_cycle.state = 'signed_off' then
    return query select 'already_signed_off'::text, v_cycle.signed_off_at, v_cycle.released_count, v_cycle.notified_count,
      jsonb_build_object('signed_off_by', v_cycle.signed_off_by);
    return;
  end if;
  if v_cycle.state <> 'frozen' then
    return query select 'not_frozen'::text, null::timestamptz, null::integer, null::integer, jsonb_build_object('state', v_cycle.state); return;
  end if;
  if p_expected_version is distinct from v_cycle.version then
    return query select 'stale_version'::text, null::timestamptz, null::integer, null::integer, jsonb_build_object('version', v_cycle.version); return;
  end if;

  v_assessed := moderation.assessed_in_population(v_actor, p_cycle_id);
  if v_assessed > 0 then
    return query select 'not_eligible'::text, null::timestamptz, null::integer, null::integer,
      jsonb_build_object('assessed', v_assessed, 'population', (select count(*) from moderation.population_results(p_cycle_id)));
    return;
  end if;

  v_blockers := moderation.sign_off_blockers(p_cycle_id);
  if jsonb_array_length(v_blockers) > 0 or exists (
    select 1 from moderation.sample_items si where si.cycle_id = p_cycle_id and si.moderator_id is null
  ) then
    return query select 'blocked'::text, null::timestamptz, null::integer, null::integer, v_blockers; return;
  end if;

  if v_statement is null then
    return query select 'statement_required'::text, null::timestamptz, null::integer, null::integer, null::jsonb; return;
  end if;
  if char_length(v_statement) > 2000 then
    return query select 'statement_too_long'::text, null::timestamptz, null::integer, null::integer, null::jsonb; return;
  end if;

  -- The population, locked in identifier order.
  perform r.id from assessment.results r where r.hold_cycle_id = p_cycle_id order by r.id for update;

  -- Held results: released. The guard writes the release facts; the trigger tells each learner.
  with released as (
    update assessment.results r
    set state = 'released', hold_cycle_id = null
    where r.hold_cycle_id = p_cycle_id and r.state = 'held'
    returning r.id, r.current_decision_id, r.release_seq, r.released_at
  )
  insert into moderation.releases (cycle_id, result_id, decision_id, release_seq, released_at)
  select p_cycle_id, rl.id, rl.current_decision_id, rl.release_seq, rl.released_at from released rl;
  get diagnostics v_released = row_count;

  -- Released results with a decision held behind the release (P-04): that decision becomes current, with a new
  -- release, a new appeal window and its own remediation period.
  with released as (
    update assessment.results r
    set current_decision_id = r.pending_decision_id,
        pending_decision_id = null,
        hold_cycle_id = null,
        remediation_period = case when d.outcome = 'not_yet_competent' then make_interval(days => d.resubmission_days) end
    from assessment.decisions d
    where d.id = r.pending_decision_id and r.hold_cycle_id = p_cycle_id and r.state = 'released'
    returning r.id, r.current_decision_id, r.release_seq, r.released_at
  )
  insert into moderation.releases (cycle_id, result_id, decision_id, release_seq, released_at)
  select p_cycle_id, rl.id, rl.current_decision_id, rl.release_seq, rl.released_at from released rl;
  get diagnostics v_pending = row_count;
  v_released := v_released + v_pending;

  select count(*)::integer into v_notified
  from moderation.releases rl
  join notifications.notifications n on n.event_key = 'result_released:' || rl.result_id::text || ':' || rl.release_seq::text
  where rl.cycle_id = p_cycle_id;

  v_now := now();
  update moderation.cycles c
  set state = 'signed_off', signed_off_at = v_now, signed_off_by = v_actor, sign_off_statement = v_statement,
      released_count = v_released, notified_count = v_notified, version = c.version + 1, updated_at = v_now
  where c.id = p_cycle_id;
  update moderation.cycle_scope s set open = false where s.cycle_id = p_cycle_id;

  select p.digest into v_digest from moderation.populations p where p.cycle_id = p_cycle_id;
  select co.name into v_cohort_name from programmes.cohorts co where co.id = v_cycle.cohort_id;

  perform audit.append('moderation.cycle_signed_off', 'moderation_cycle', p_cycle_id::text,
    jsonb_build_object('released', v_released, 'notified', v_notified, 'population_digest', v_digest,
                       'held_behind_release', v_pending, 'statement', v_statement),
    'moderator', jsonb_build_object('state', 'frozen'), jsonb_build_object('state', 'signed_off'),
    'cohort', v_cycle.cohort_id);

  for v_coordinator in select cc.profile_id from appeals.cohort_coordinators(v_cycle.cohort_id) cc loop
    perform notifications.enqueue('moderation_cycle_signed_off', 'moderation_cycle_signed_off:' || p_cycle_id::text, v_coordinator,
      jsonb_build_object('cycle_id', p_cycle_id, 'cycle_name', v_cycle.name, 'cohort_name', v_cohort_name,
                         'signed_off_by', (select p.full_name from identity.profiles p where p.id = v_actor),
                         'signed_off_at', v_now, 'released', v_released, 'notified', v_notified),
      '/coordinate/cohorts/' || v_cycle.cohort_id::text || '/moderation/cycles/' || p_cycle_id::text);
  end loop;

  return query select 'ok'::text, v_now, v_released, v_notified,
    jsonb_build_object('held_behind_release', v_pending, 'population_digest', v_digest);
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Cycle lists carry the sign-off
-- ---------------------------------------------------------------------------------------------------------------

drop function api.list_moderation_cycles(uuid);
create function api.list_moderation_cycles(p_cohort_id uuid)
returns table (
  id uuid,
  name text,
  state text,
  unit_ids uuid[],
  period_from date,
  period_to date,
  scheduled_start_at timestamptz,
  planned_by_name text,
  planned_at timestamptz,
  frozen_at timestamptz,
  cancelled_by_name text,
  cancelled_at timestamptz,
  cancel_reason text,
  version integer,
  items jsonb,
  waiting integer,
  held integer,
  sampled integer,
  returned integer,
  signed_off_at timestamptz,
  signed_off_by_name text,
  released_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.state, c.unit_ids, c.period_from, c.period_to, c.scheduled_start_at,
    pb.full_name, c.planned_at, c.frozen_at, cb.full_name, c.cancelled_at, c.cancel_reason, c.version,
    coalesce((select jsonb_agg(jsonb_build_object('id', ai.id, 'title', ai.title, 'via_unit_id', s.via_unit_id)
                               order by ai.title)
              from moderation.cycle_scope s join assessment.assessable_items ai on ai.id = s.assessable_item_id
              where s.cycle_id = c.id), '[]'::jsonb),
    (select count(*)::integer from assessment.results r
     join moderation.cycle_scope s on s.cycle_id = c.id and s.assessable_item_id = r.assessable_item_id
     join assessment.decisions d on d.id = moderation.waiting_decision(r)
     where c.state = 'planned' and moderation.is_waiting(r)
       and (c.period_from is null or (d.created_at at time zone 'Africa/Johannesburg')::date >= c.period_from)
       and (c.period_to is null or (d.created_at at time zone 'Africa/Johannesburg')::date <= c.period_to)),
    (select count(*)::integer from moderation.population_results(c.id)),
    (select count(*)::integer from moderation.sample_items si where si.cycle_id = c.id),
    (select count(*)::integer from moderation.returns rt where rt.cycle_id = c.id and rt.remarked_at is null),
    c.signed_off_at, sb.full_name, c.released_count
  from moderation.cycles c
  join identity.profiles pb on pb.id = c.planned_by
  left join identity.profiles cb on cb.id = c.cancelled_by
  left join identity.profiles sb on sb.id = c.signed_off_by
  where c.cohort_id = p_cohort_id and programmes.can_coordinate(auth.uid(), p_cohort_id)
  order by c.planned_at desc
$$;

drop function api.list_my_moderation_cycles();
create function api.list_my_moderation_cycles()
returns table (
  cycle_id uuid,
  name text,
  state text,
  cohort_id uuid,
  cohort_name text,
  frozen_at timestamptz,
  my_items integer,
  my_concluded integer,
  my_returned integer,
  my_remarked integer,
  total_items integer,
  total_concluded integer,
  open_returns integer,
  may_sign boolean,
  signed_off_at timestamptz,
  released_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.state, c.cohort_id, co.name, c.frozen_at,
    count(*) filter (where si.moderator_id = auth.uid())::integer,
    count(*) filter (where si.moderator_id = auth.uid() and si.state = 'agreed')::integer,
    count(*) filter (where si.moderator_id = auth.uid() and si.state = 'returned')::integer,
    count(*) filter (where si.moderator_id = auth.uid() and si.state = 'remarked')::integer,
    count(*)::integer,
    count(*) filter (where si.state = 'agreed')::integer,
    (select count(*)::integer from moderation.returns rt where rt.cycle_id = c.id and rt.remarked_at is null),
    moderation.may_sign_off(auth.uid(), c.id),
    c.signed_off_at, c.released_count
  from moderation.cycles c
  join programmes.cohorts co on co.id = c.cohort_id
  join moderation.sample_items si on si.cycle_id = c.id
  where c.state in ('frozen', 'signed_off')
    and (exists (select 1 from moderation.sample_items x where x.cycle_id = c.id and x.moderator_id = auth.uid())
         or exists (select 1 from moderation.eligible_moderators(c.cohort_id) em where em.profile_id = auth.uid()))
  group by c.id, co.name
  order by c.state = 'signed_off', c.frozen_at desc
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.get_sign_off(uuid) from public, anon, authenticated, service_role;
revoke all on function api.sign_off_moderation_cycle(uuid, integer, text) from public, anon, authenticated, service_role;
revoke all on function api.list_moderation_cycles(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_my_moderation_cycles() from public, anon, authenticated, service_role;

grant execute on function api.get_sign_off(uuid) to authenticated;
grant execute on function api.sign_off_moderation_cycle(uuid, integer, text) to authenticated;
grant execute on function api.list_moderation_cycles(uuid) to authenticated;
grant execute on function api.list_my_moderation_cycles() to authenticated;
