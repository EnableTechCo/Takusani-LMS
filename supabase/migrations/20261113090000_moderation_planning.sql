-- Moderation planning on real data (S4-10; P0-15; FR-501, FR-506; BR-01; P-03). The planning screen was built with
-- S4-05 to S4-09; what it still lacked from the specification:
--   * the moderators available to a cycle, each with how many of the waiting results they assessed (and so can never
--     be given), and a warning when an item in scope has waiting results that every eligible moderator assessed,
--     because nobody could be allocated them (BR-01);
--   * how many sample items a cycle has concluded, so the cycle list can show review progress.
-- The hold-age alert (P-03) reads the configured maximum hold already on the page; the copy of the sample record is
-- client-side.

-- The eligible moderators of a cohort, each with the waiting results they assessed and the items they hold in open
-- cycles. Coordinators of the cohort read it.
create function api.list_moderation_moderators(p_cohort_id uuid)
returns table (profile_id uuid, full_name text, assessed_waiting integer, holds_open integer)
language sql
stable
security definer
set search_path = ''
as $$
  select em.profile_id, em.full_name,
    (select count(*)::integer from assessment.results r
     join assessment.assessable_items ai on ai.id = r.assessable_item_id
     where ai.cohort_id = p_cohort_id and moderation.is_waiting(r) and moderation.assessed_result(em.profile_id, r.id)),
    (select count(*)::integer from moderation.sample_items si
     join moderation.cycles c on c.id = si.cycle_id
     where c.cohort_id = p_cohort_id and c.state = 'frozen' and si.moderator_id = em.profile_id and si.state <> 'agreed')
  from moderation.eligible_moderators(p_cohort_id) em
  where programmes.can_coordinate(auth.uid(), p_cohort_id)
  order by em.full_name
$$;

-- The pool, from 20261107090000, now saying per item how many waiting results no eligible moderator could take.
drop function api.get_moderation_pool(uuid);
create function api.get_moderation_pool(p_cohort_id uuid)
returns table (
  item_id uuid,
  title text,
  kind text,
  unit_id uuid,
  unit_code text,
  unit_title text,
  waiting integer,
  oldest_decided_at timestamptz,
  assessors jsonb,
  held integer,
  released integer,
  open_cycle_id uuid,
  open_cycle_name text,
  open_cycle_state text,
  open_cycle_scheduled_start_at timestamptz,
  unmoderatable integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with items as (
    select ai.id, ai.title, ai.kind, moderation.item_unit(ai.id) as unit_id
    from assessment.assessable_items ai
    where ai.cohort_id = p_cohort_id and programmes.can_coordinate(auth.uid(), p_cohort_id)
  ),
  waiting as (
    select r.id as result_id, r.assessable_item_id, d.created_at, p.full_name
    from assessment.results r
    join assessment.decisions d on d.id = moderation.waiting_decision(r)
    join identity.profiles p on p.id = d.actor_id
    where moderation.is_waiting(r) and r.assessable_item_id in (select id from items)
  ),
  moderators as (
    select em.profile_id from moderation.eligible_moderators(p_cohort_id) em
  )
  select i.id, i.title, i.kind, i.unit_id, u.code, u.title,
    (select count(*)::integer from waiting w where w.assessable_item_id = i.id),
    (select min(w.created_at) from waiting w where w.assessable_item_id = i.id),
    coalesce((select jsonb_agg(jsonb_build_object('name', a.full_name, 'count', a.n) order by a.n desc, a.full_name)
              from (select w.full_name, count(*) as n from waiting w where w.assessable_item_id = i.id group by w.full_name) a),
             '[]'::jsonb),
    (select count(*)::integer from assessment.results r where r.assessable_item_id = i.id and r.hold_cycle_id is not null and r.state = 'held'),
    (select count(*)::integer from assessment.results r where r.assessable_item_id = i.id and r.state = 'released' and r.pending_decision_id is null),
    c.id, c.name, c.state, c.scheduled_start_at,
    (select count(*)::integer from waiting w
     where w.assessable_item_id = i.id
       and not exists (select 1 from moderators m where not moderation.assessed_result(m.profile_id, w.result_id)))
  from items i
  left join programmes.units u on u.id = i.unit_id
  left join moderation.cycles c on c.id = moderation.open_cycle_for(i.id)
  order by i.title
$$;

-- The cycle list, from 20261112090000, now with the sample items concluded.
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
  concluded integer,
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
    (select count(*)::integer from moderation.sample_items si where si.cycle_id = c.id and si.state = 'agreed'),
    (select count(*)::integer from moderation.returns rt where rt.cycle_id = c.id and rt.remarked_at is null),
    c.signed_off_at, sb.full_name, c.released_count
  from moderation.cycles c
  join identity.profiles pb on pb.id = c.planned_by
  left join identity.profiles cb on cb.id = c.cancelled_by
  left join identity.profiles sb on sb.id = c.signed_off_by
  where c.cohort_id = p_cohort_id and programmes.can_coordinate(auth.uid(), p_cohort_id)
  order by c.planned_at desc
$$;

revoke all on function api.list_moderation_moderators(uuid), api.get_moderation_pool(uuid), api.list_moderation_cycles(uuid)
  from public, anon, authenticated, service_role;
grant execute on function api.list_moderation_moderators(uuid), api.get_moderation_pool(uuid), api.list_moderation_cycles(uuid)
  to authenticated;
