-- Bug fix to S2-02: a refused audience change no longer wipes the task's named learners.
--
-- api.set_task_audience deleted the named list first and then checked each email. When it met one that is not
-- enrolled it returned "learner_not_enrolled", but a returned refusal is not a rollback: the deletion, and any
-- learners inserted before the bad address, were kept. A typo in one address silently emptied the audience.
-- Every address is now checked before anything is written. Same signature, so the grant stands.
create or replace function api.set_task_audience(p_task_id uuid, p_audience text, p_emails text[] default null)
returns table (status text, audience_size integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task submissions.tasks;
  v_profiles uuid[] := array[]::uuid[];
  v_email text;
  v_profile uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer; return; end if;
  select * into v_task from submissions.tasks where id = p_task_id for update;
  if not found then return query select 'task_not_found'::text, null::integer; return; end if;
  if not submissions.can_set_work(v_actor, v_task.cohort_id) then
    return query select 'forbidden'::text, null::integer; return;
  end if;
  if v_task.state <> 'draft' then return query select 'not_a_draft'::text, null::integer; return; end if;
  if p_audience not in ('cohort', 'named') then return query select 'invalid_audience'::text, null::integer; return; end if;

  -- Resolve every named learner first. Nothing is changed unless all of them are enrolled in the task's cohort.
  if p_audience = 'named' then
    if coalesce(array_length(p_emails, 1), 0) = 0 then
      return query select 'no_learners_named'::text, null::integer; return;
    end if;
    foreach v_email in array p_emails loop
      v_profile := null;
      select p.id into v_profile
      from identity.profiles p
      join auth.users u on u.id = p.id
      join programmes.enrolments e on e.profile_id = p.id and e.cohort_id = v_task.cohort_id and e.status = 'active'
      where lower(u.email) = lower(btrim(v_email));
      if v_profile is null then return query select 'learner_not_enrolled'::text, null::integer; return; end if;
      v_profiles := array_append(v_profiles, v_profile);
    end loop;
  end if;

  delete from submissions.task_targets where task_id = p_task_id;
  insert into submissions.task_targets (task_id, profile_id)
  select p_task_id, profile_id from unnest(v_profiles) as named(profile_id)
  on conflict do nothing;

  update submissions.tasks set audience = p_audience, updated_at = now() where id = p_task_id;
  perform audit.append('submissions.task_audience_set', 'task', p_task_id::text,
    jsonb_build_object('cohort_id', v_task.cohort_id), 'facilitator',
    jsonb_build_object('audience', v_task.audience),
    jsonb_build_object('audience', p_audience, 'learners', submissions.audience_size(p_task_id)),
    'cohort', v_task.cohort_id);
  return query select 'ok'::text, submissions.audience_size(p_task_id);
end
$$;
