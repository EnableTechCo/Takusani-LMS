-- Account administration (S3-08; FR-103, FR-105, FR-106, FR-107; screen X-03). An administrator edits an account's
-- details, deactivates and reactivates it, and sends a password reset; unlocking a sign-in lock is S3-06.
--
-- Deactivation blocks existing sessions immediately (security doc, "Accounts are active or deactivated"): an Auth
-- token lives on until it expires, so the database refuses every API request from a deactivated account before it
-- runs. PostgREST calls api.check_request() first on each request (db_pre_request). Only api.my_access() is let
-- through, so the application can see the account is deactivated and sign the person out. The application also bans
-- the account in Supabase Auth, so it can neither sign in nor refresh its session.
--
-- Deactivation is refused while the person still holds open work (FR-105): marking they have taken, or an appeal they
-- are reviewing. The refusal names it, and is recorded. An administrator cannot deactivate their own account; since
-- whoever deactivates is an active administrator, the institution is never left without one.

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled', 'notice', 'appeal_received', 'appeal_lodged', 'appeal_admitted',
                 'appeal_inadmissible', 'appeal_review_allocated', 'appeal_decided', 'appeal_concluded',
                 'sign_in_locked', 'sign_in_unlocked', 'role_assigned', 'role_ended', 'password_reset_sent',
                 'account_deactivated', 'account_reactivated')
);

-- ---------------------------------------------------------------------------------------------------------------
-- Every API request: a deactivated account is refused before anything runs
-- ---------------------------------------------------------------------------------------------------------------

-- It lives in the api schema because PostgREST runs it as the request's role, which may use no other schema. Called
-- directly, it returns nothing and reveals nothing.
create function api.check_request()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  -- The application reads the account's status here, to sign a deactivated person out with a clear message.
  if current_setting('request.path', true) = '/rpc/my_access' then return; end if;
  if exists (select 1 from identity.profiles p where p.id = v_uid and p.status = 'deactivated') then
    raise exception 'This account is deactivated.' using errcode = '42501';
  end if;
end
$$;

revoke all on function api.check_request() from public, anon, authenticated, service_role;
-- PostgREST runs it as the request's role, which therefore needs EXECUTE.
grant execute on function api.check_request() to anon, authenticated;

alter role authenticator set pgrst.db_pre_request = 'api.check_request';
notify pgrst, 'reload config';

-- ---------------------------------------------------------------------------------------------------------------
-- Commands
-- ---------------------------------------------------------------------------------------------------------------

-- Refusals: unauthenticated, forbidden, not_found, invalid_name, learner_number_taken.
create function api.update_account(p_profile_id uuid, p_full_name text, p_learner_number text default null)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_before identity.profiles;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_number text := nullif(btrim(coalesce(p_learner_number, '')), '');
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  if not identity.has_role(v_actor, 'administrator') then return query select 'forbidden'::text; return; end if;
  select * into v_before from identity.profiles p where p.id = p_profile_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if char_length(v_name) not between 1 and 200 then return query select 'invalid_name'::text; return; end if;
  if v_number is not null and exists (
    select 1 from identity.profiles p where p.learner_number = v_number and p.id <> p_profile_id
  ) then
    return query select 'learner_number_taken'::text; return;
  end if;
  if v_before.full_name = v_name and v_before.learner_number is not distinct from v_number then
    return query select 'ok'::text; return;
  end if;

  update identity.profiles p set full_name = v_name, learner_number = v_number where p.id = p_profile_id;
  perform audit.append('identity.account_updated', 'profile', p_profile_id::text, '{}'::jsonb, 'administrator',
    jsonb_build_object('full_name', v_before.full_name, 'learner_number', v_before.learner_number),
    jsonb_build_object('full_name', v_name, 'learner_number', v_number), 'global', null);
  return query select 'ok'::text;
end
$$;

-- Refusals: unauthenticated, forbidden, not_found, already_deactivated, cannot_deactivate_self, open_allocations (allocations names the work to reallocate first).
create function api.deactivate_account(p_profile_id uuid, p_reason text default null)
returns table (status text, allocations jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile identity.profiles;
  v_open jsonb;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::jsonb; return; end if;
  if not identity.has_role(v_actor, 'administrator') then return query select 'forbidden'::text, null::jsonb; return; end if;
  select * into v_profile from identity.profiles p where p.id = p_profile_id for update;
  if not found then return query select 'not_found'::text, null::jsonb; return; end if;
  if v_profile.status = 'deactivated' then return query select 'already_deactivated'::text, null::jsonb; return; end if;
  if p_profile_id = v_actor then return query select 'cannot_deactivate_self'::text, null::jsonb; return; end if;

  -- FR-105: every piece of open work, whatever role it rests on.
  select jsonb_agg(jsonb_build_object('kind', o.kind, 'cohort_name', o.cohort_name, 'items', o.items,
                                      'oldest_at', o.oldest_at) order by o.kind, o.cohort_name)
  into v_open from identity.open_allocations(p_profile_id) o;
  if v_open is not null then
    perform audit.append('identity.deactivation_refused', 'profile', p_profile_id::text,
      jsonb_build_object('reason', 'open_allocations', 'allocations', v_open), 'administrator',
      jsonb_build_object('status', 'active'), null, 'global', null);
    return query select 'open_allocations'::text, v_open;
    return;
  end if;

  update identity.profiles p set status = 'deactivated', deactivated_at = now() where p.id = p_profile_id;
  perform audit.append('identity.account_deactivated', 'profile', p_profile_id::text,
    jsonb_strip_nulls(jsonb_build_object('reason', v_reason)), 'administrator',
    jsonb_build_object('status', 'active'), jsonb_build_object('status', 'deactivated'), 'global', null);
  perform notifications.enqueue('account_deactivated', 'account_deactivated:' || p_profile_id::text || ':' || now()::text,
    p_profile_id, jsonb_build_object('deactivated_at', now()), '/sign-in');
  return query select 'ok'::text, null::jsonb;
end
$$;

-- Refusals: unauthenticated, forbidden, not_found, already_active.
create function api.reactivate_account(p_profile_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile identity.profiles;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  if not identity.has_role(v_actor, 'administrator') then return query select 'forbidden'::text; return; end if;
  select * into v_profile from identity.profiles p where p.id = p_profile_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if v_profile.status = 'active' then return query select 'already_active'::text; return; end if;
  update identity.profiles p set status = 'active', deactivated_at = null where p.id = p_profile_id;
  perform audit.append('identity.account_reactivated', 'profile', p_profile_id::text, '{}'::jsonb, 'administrator',
    jsonb_build_object('status', 'deactivated'), jsonb_build_object('status', 'active'), 'global', null);
  perform notifications.enqueue('account_reactivated', 'account_reactivated:' || p_profile_id::text || ':' || now()::text,
    p_profile_id, jsonb_build_object('reactivated_at', now()), '/');
  return query select 'ok'::text;
end
$$;

-- FR-106: an administrator sends the person a link to set a new password. Recorded, and the person told, before the
-- application asks Supabase Auth to send the email. Refusals: unauthenticated, forbidden, not_found, deactivated.
create function api.record_password_reset(p_profile_id uuid)
returns table (status text, email text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile identity.profiles;
  v_email text;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::text; return; end if;
  if not identity.has_role(v_actor, 'administrator') then return query select 'forbidden'::text, null::text; return; end if;
  select * into v_profile from identity.profiles p where p.id = p_profile_id;
  if not found then return query select 'not_found'::text, null::text; return; end if;
  if v_profile.status <> 'active' then return query select 'deactivated'::text, null::text; return; end if;
  select u.email::text into v_email from auth.users u where u.id = p_profile_id;
  perform audit.append('identity.password_reset_sent', 'profile', p_profile_id::text, '{}'::jsonb, 'administrator',
    null, null, 'global', null);
  perform notifications.enqueue('password_reset_sent', 'password_reset_sent:' || p_profile_id::text || ':' || now()::text,
    p_profile_id, jsonb_build_object('sent_at', now()), '/account');
  return query select 'ok'::text, v_email;
end
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.update_account(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function api.deactivate_account(uuid, text) from public, anon, authenticated, service_role;
revoke all on function api.reactivate_account(uuid) from public, anon, authenticated, service_role;
revoke all on function api.record_password_reset(uuid) from public, anon, authenticated, service_role;

grant execute on function api.update_account(uuid, text, text) to authenticated;
grant execute on function api.deactivate_account(uuid, text) to authenticated;
grant execute on function api.reactivate_account(uuid) to authenticated;
grant execute on function api.record_password_reset(uuid) to authenticated;
