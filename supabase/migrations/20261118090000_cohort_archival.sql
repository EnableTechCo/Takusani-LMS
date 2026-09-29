-- Cohort archival (S6-05; FR-111, FR-112; ADR-019; R-21; screen X-10).
--
-- FR-111: an administrator archives an active cohort only when nothing about it is still open:
--   * moderation signed off: no planned or frozen cycle;
--   * no result pending or held: nothing handed in and not yet decided, no decision held or waiting for moderation,
--     no later decision waiting behind a release, and no resubmission waiting to be marked;
--   * every appeal window closed, and no appeal open;
--   * no correction waiting for its second person.
-- The check runs again under the cohort's lock (ADR-019 lock order: cohort_moderation_state first), which every
-- finalise, freeze and sign-off also takes, so nothing can be released or held between the check and the archive.
-- A refusal lists each unmet condition with its count, as X-10 shows them.
--
-- FR-112: an archived cohort is read-only for everyone. Many commands already refuse an archived cohort with a typed
-- status; this adds the backstop the data model asks for: a trigger on every cohort-owned table refuses any insert,
-- update or delete that belongs to an archived cohort, whoever makes it. Reads are unchanged, so reports, the credits
-- record and the Department API keep every record for the retention period.

-- ---------------------------------------------------------------------------------------------------------------
-- The cohort's archival facts
-- ---------------------------------------------------------------------------------------------------------------

alter table programmes.cohorts
  add column archived_at timestamptz,
  add column archived_by uuid references identity.profiles (id);

update programmes.cohorts set archived_at = created_at where status = 'archived' and archived_at is null;

alter table programmes.cohorts
  add constraint archival_is_recorded check ((status = 'archived') = (archived_at is not null));

-- What still blocks archiving a cohort: each condition's count, the last moment an appeal can still be lodged, and
-- whether nothing blocks it. Read-only views over the higher layers (system design: Programmes evaluates archival
-- preconditions through published reads).
create function programmes.archival_blockers(p_cohort_id uuid)
returns table (
  open_cycles integer,
  not_assessed integer,
  held integer,
  pending integer,
  resubmissions integer,
  appeal_window_until timestamptz,
  open_appeals integer,
  open_corrections integer,
  archivable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with r as (
    select r.* from assessment.results r
    join assessment.assessable_items ai on ai.id = r.assessable_item_id
    where ai.cohort_id = p_cohort_id
  ),
  x as (
    select
      (select count(*)::integer from moderation.cycles cy
       where cy.cohort_id = p_cohort_id and cy.state in ('planned', 'frozen')) as open_cycles,
      (select count(*)::integer from r where r.state = 'held' and r.current_decision_id is null) as not_assessed,
      (select count(*)::integer from r where r.state = 'held' and r.current_decision_id is not null) as held,
      (select count(*)::integer from r where r.state = 'released' and r.pending_decision_id is not null) as pending,
      (select count(distinct i.result_id)::integer from assessment.assessment_instances i
       join r on r.id = i.result_id
       where r.state = 'released' and i.state in ('to_mark', 'marking')) as resubmissions,
      (select max(r.appeal_deadline_at) from r where r.state = 'released' and r.appeal_deadline_at > now()) as appeal_window_until,
      (select count(*)::integer from appeals.appeals a join r on r.id = a.result_id
       where a.state not in ('concluded', 'inadmissible')) as open_appeals,
      (select count(*)::integer from assessment.corrections co
       where co.cohort_id = p_cohort_id and co.state = 'proposed') as open_corrections
  )
  select x.open_cycles, x.not_assessed, x.held, x.pending, x.resubmissions, x.appeal_window_until, x.open_appeals,
    x.open_corrections,
    x.open_cycles = 0 and x.not_assessed = 0 and x.held = 0 and x.pending = 0 and x.resubmissions = 0
      and x.appeal_window_until is null and x.open_appeals = 0 and x.open_corrections = 0
  from x
$$;

revoke all on function programmes.archival_blockers(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- The command
-- ---------------------------------------------------------------------------------------------------------------

-- Archives a cohort. Refusals: unauthenticated, forbidden (not an administrator), not_found, already_archived,
-- not_active (still in setup), blocked (with the blockers as a JSON object).
create function api.archive_cohort(p_cohort_id uuid)
returns table (status text, blockers jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_cohort programmes.cohorts;
  v_blockers record;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::jsonb; return; end if;
  if not identity.has_role(v_actor, 'administrator') then return query select 'forbidden'::text, null::jsonb; return; end if;
  if not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id) then
    return query select 'not_found'::text, null::jsonb; return;
  end if;

  perform 1 from programmes.cohort_moderation_state m where m.cohort_id = p_cohort_id for update;
  select * into v_cohort from programmes.cohorts c where c.id = p_cohort_id for update;
  if v_cohort.status = 'archived' then return query select 'already_archived'::text, null::jsonb; return; end if;
  if v_cohort.status <> 'active' then return query select 'not_active'::text, null::jsonb; return; end if;

  select * into v_blockers from programmes.archival_blockers(p_cohort_id);
  if not v_blockers.archivable then
    perform audit.append('programmes.cohort_archive_refused', 'cohort', p_cohort_id::text,
      to_jsonb(v_blockers), 'administrator', null, null, 'cohort', p_cohort_id);
    return query select 'blocked'::text, to_jsonb(v_blockers); return;
  end if;

  update programmes.cohorts c set status = 'archived', archived_at = now(), archived_by = v_actor where c.id = p_cohort_id;
  perform audit.append('programmes.cohort_archived', 'cohort', p_cohort_id::text, '{}'::jsonb, 'administrator',
    jsonb_build_object('status', v_cohort.status), jsonb_build_object('status', 'archived'), 'cohort', p_cohort_id);
  return query select 'ok'::text, null::jsonb;
end
$$;

-- X-10: every cohort that is active or archived, with what blocks archiving it. Administrators only.
create function api.list_cohort_archival()
returns table (
  cohort_id uuid,
  cohort_name text,
  programme_title text,
  starts_on date,
  ends_on date,
  status text,
  archived_at timestamptz,
  archived_by_name text,
  learners integer,
  open_cycles integer,
  not_assessed integer,
  held integer,
  pending integer,
  resubmissions integer,
  appeal_window_until timestamptz,
  open_appeals integer,
  open_corrections integer,
  archivable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, p.title, c.starts_on, c.ends_on, c.status, c.archived_at, ap.full_name,
    (select count(*)::integer from programmes.enrolments e where e.cohort_id = c.id and e.status = 'active'),
    b.open_cycles, b.not_assessed, b.held, b.pending, b.resubmissions, b.appeal_window_until, b.open_appeals,
    b.open_corrections, c.status = 'active' and b.archivable
  from programmes.cohorts c
  join programmes.programmes p on p.id = c.programme_id
  left join identity.profiles ap on ap.id = c.archived_by
  cross join lateral programmes.archival_blockers(c.id) b
  where c.status in ('active', 'archived') and identity.has_role(auth.uid(), 'administrator')
  order by c.status = 'archived', c.ends_on, c.name
$$;

revoke all on function api.archive_cohort(uuid), api.list_cohort_archival() from public, anon, authenticated, service_role;
grant execute on function api.archive_cohort(uuid), api.list_cohort_archival() to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Read-only once archived (FR-112)
-- ---------------------------------------------------------------------------------------------------------------

-- Refuses a write that belongs to an archived cohort. The argument says how to find the cohort from the row: its
-- own cohort_id, or through its task, submission, session, assessable item or result.
create function programmes.refuse_archived_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_cohort uuid;
begin
  v_cohort := case tg_argv[0]
    when 'cohort' then (v_row ->> 'cohort_id')::uuid
    when 'task' then (select t.cohort_id from submissions.tasks t where t.id = (v_row ->> 'task_id')::uuid)
    when 'submission' then (select t.cohort_id from submissions.submissions s
                            join submissions.tasks t on t.id = s.task_id where s.id = (v_row ->> 'submission_id')::uuid)
    when 'session' then (select se.cohort_id from learning.sessions se where se.id = (v_row ->> 'session_id')::uuid)
    when 'item' then (select ai.cohort_id from assessment.assessable_items ai
                      where ai.id = (v_row ->> 'assessable_item_id')::uuid)
    when 'result' then (select ai.cohort_id from assessment.results r
                        join assessment.assessable_items ai on ai.id = r.assessable_item_id
                        where r.id = (v_row ->> 'result_id')::uuid)
  end;
  if exists (select 1 from programmes.cohorts c where c.id = v_cohort and c.status = 'archived') then
    raise exception 'This cohort is archived, so its records are read-only (FR-112).' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

revoke all on function programmes.refuse_archived_write() from public, anon, authenticated, service_role;

do $guard$
declare
  v_table record;
begin
  for v_table in
    select * from (values
      ('programmes', 'enrolments', 'cohort'),
      ('submissions', 'tasks', 'cohort'),
      ('submissions', 'submissions', 'task'),
      ('submissions', 'submission_versions', 'submission'),
      ('learning', 'materials', 'cohort'),
      ('learning', 'quizzes', 'cohort'),
      ('learning', 'sessions', 'cohort'),
      ('learning', 'attendance', 'session'),
      ('learning', 'attendance_checkins', 'session'),
      ('learning', 'session_logistics', 'session'),
      ('assessment', 'assessable_items', 'cohort'),
      ('assessment', 'results', 'item'),
      ('assessment', 'assessment_instances', 'result'),
      ('assessment', 'decisions', 'result'),
      ('assessment', 'corrections', 'cohort'),
      ('appeals', 'appeals', 'result'),
      ('moderation', 'cycles', 'cohort'),
      ('credits', 'requirement_sets', 'cohort')
    ) t (schema_name, table_name, lookup)
  loop
    execute format(
      'create trigger archived_cohort_read_only before insert or update or delete on %I.%I '
      'for each row execute function programmes.refuse_archived_write(%L)',
      v_table.schema_name, v_table.table_name, v_table.lookup);
  end loop;
end
$guard$;
