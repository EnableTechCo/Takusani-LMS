-- Account lockout on new sign-ins (S3-06; FR-106; ADR-026; P-14, P-17; transaction test 20).
--
-- On the Pro plan there is no Auth password hook, so password sign-in goes through the application's server, which
-- asks these functions (with the secret key, service_role) before and after each attempt:
--   * sign_in_gate(email): is a lock in force? An expired lock is cleared here and its expiry audited;
--   * record_sign_in_failure(email): count a wrong password; the fifth within 15 minutes locks new sign-ins for 15
--     minutes, audits the lock and tells the person;
--   * record_sign_in_success(email): a correct password clears the count.
-- A caller who uses the Auth endpoint directly is limited by Supabase's per-address rate limits but not counted;
-- that residual risk is accepted (P-17). CAPTCHA on the sign-in form is the other control.
--
-- A lock blocks new password sign-ins only. Nothing else reads it: an existing session and an exam attempt keep
-- working (ADR-026 point 1). Deactivation remains the control that blocks existing sessions. The locked response is
-- the same as a wrong password, so a lock reveals nothing about the account.
--
-- A lock ends by itself, when the person resets their password through the emailed link (clear_my_sign_in_lock,
-- called once the link has signed them in), or when an administrator unlocks the account (unlock_account). Lock,
-- expiry and unlock are audited, and the person is told of the lock and of an administrator's unlock.
--
-- The limits are template values until configuration is versioned (S3-09).

create table identity.sign_in_failures (
  profile_id uuid primary key references identity.profiles (id),
  failures integer not null default 0 check (failures >= 0),
  window_started_at timestamptz,
  last_failure_at timestamptz,
  locked_at timestamptz,
  locked_until timestamptz,
  constraint lock_is_recorded check ((locked_at is null) = (locked_until is null))
);

revoke all on table identity.sign_in_failures from public, anon, authenticated, service_role;

alter table notifications.notifications drop constraint notifications_event_type_check;
alter table notifications.notifications add constraint notifications_event_type_check check (
  event_type in ('result_released', 'task_published', 'task_reminder', 'session_scheduled', 'session_changed',
                 'session_cancelled', 'notice', 'appeal_received', 'appeal_lodged', 'appeal_admitted',
                 'appeal_inadmissible', 'appeal_review_allocated', 'appeal_decided', 'appeal_concluded',
                 'sign_in_locked', 'sign_in_unlocked')
);

-- ---------------------------------------------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------------------------------------------

-- How many wrong passwords, within how long, lock new sign-ins for how long.
create function identity.lockout_policy()
returns table (max_failures integer, failure_window interval, lock_period interval)
language sql
immutable
set search_path = ''
as $$
  select 5, interval '15 minutes', interval '15 minutes'
$$;

-- The profile behind an email address, or null.
create function identity.profile_for_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from auth.users u join identity.profiles p on p.id = u.id
  where lower(u.email) = lower(btrim(coalesce(p_email, '')))
$$;

-- Clears a lock whose time is up, auditing the expiry with the moment it ended. Returns whether a lock is in force.
create function identity.lock_in_force(p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row identity.sign_in_failures;
begin
  select * into v_row from identity.sign_in_failures f where f.profile_id = p_profile_id for update;
  if not found or v_row.locked_until is null then return false; end if;
  if v_row.locked_until > now() then return true; end if;
  update identity.sign_in_failures f
  set failures = 0, window_started_at = null, locked_at = null, locked_until = null
  where f.profile_id = p_profile_id;
  perform audit.append('identity.sign_in_lock_expired', 'profile', p_profile_id::text,
    jsonb_build_object('locked_until', v_row.locked_until), null,
    jsonb_build_object('locked_until', v_row.locked_until), null, 'global', null);
  return false;
end
$$;

revoke all on function identity.lockout_policy() from public, anon, authenticated, service_role;
revoke all on function identity.profile_for_email(text) from public, anon, authenticated, service_role;
revoke all on function identity.lock_in_force(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- The sign-in handler's functions (service_role only)
-- ---------------------------------------------------------------------------------------------------------------

-- True while new password sign-ins are locked for this email. False for an unknown email, so the handler behaves the
-- same either way.
create function api.sign_in_gate(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := identity.profile_for_email(p_email);
begin
  if v_profile is null then return false; end if;
  return identity.lock_in_force(v_profile);
end
$$;

-- A wrong password for this email. Counts consecutive failures within the window; at the limit, locks new sign-ins,
-- audits it and tells the person. Nothing happens for an unknown email.
create function api.record_sign_in_failure(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := identity.profile_for_email(p_email);
  v_policy record;
  v_row identity.sign_in_failures;
begin
  if v_profile is null then return; end if;
  select * into v_policy from identity.lockout_policy();
  if identity.lock_in_force(v_profile) then return; end if;

  insert into identity.sign_in_failures as f (profile_id, failures, window_started_at, last_failure_at)
  values (v_profile, 1, now(), now())
  on conflict (profile_id) do update
  set failures = case when f.window_started_at is null or f.window_started_at < now() - v_policy.failure_window
                      then 1 else f.failures + 1 end,
      window_started_at = case when f.window_started_at is null or f.window_started_at < now() - v_policy.failure_window
                               then now() else f.window_started_at end,
      last_failure_at = now()
  returning * into v_row;

  if v_row.failures >= v_policy.max_failures then
    update identity.sign_in_failures f
    set locked_at = now(), locked_until = now() + v_policy.lock_period
    where f.profile_id = v_profile
    returning * into v_row;
    perform audit.append('identity.sign_in_locked', 'profile', v_profile::text,
      jsonb_build_object('failures', v_row.failures), null, null,
      jsonb_build_object('locked_until', v_row.locked_until), 'global', null);
    perform notifications.enqueue('sign_in_locked', 'sign_in_locked:' || v_profile::text || ':' || v_row.locked_at::text,
      v_profile,
      jsonb_build_object('locked_until', v_row.locked_until, 'failures', v_row.failures),
      '/account');
  end if;
end
$$;

-- A correct password: the count starts again.
create function api.record_sign_in_success(p_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  update identity.sign_in_failures f
  set failures = 0, window_started_at = null, last_failure_at = null
  where f.profile_id = identity.profile_for_email(p_email) and f.locked_until is null
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Clearing a lock: the person's own email recovery, or an administrator
-- ---------------------------------------------------------------------------------------------------------------

-- Called once a password-reset link has signed the person in (/auth/confirm): proof of the mailbox ends the lock.
create function api.clear_my_sign_in_lock()
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row identity.sign_in_failures;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_row from identity.sign_in_failures f where f.profile_id = v_actor for update;
  if not found then return query select 'ok'::text; return; end if;
  update identity.sign_in_failures f
  set failures = 0, window_started_at = null, last_failure_at = null, locked_at = null, locked_until = null
  where f.profile_id = v_actor;
  if v_row.locked_until is not null and v_row.locked_until > now() then
    perform audit.append('identity.sign_in_lock_cleared', 'profile', v_actor::text,
      jsonb_build_object('by', 'email_recovery'), null,
      jsonb_build_object('locked_until', v_row.locked_until), null, 'global', null);
  end if;
  return query select 'ok'::text;
end
$$;

-- FR-106: an administrator unlocks an account, and the person is told. Refusals: unauthenticated, forbidden,
-- not_found, not_locked.
create function api.unlock_account(p_profile_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row identity.sign_in_failures;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  if not identity.has_role(v_actor, 'administrator') then return query select 'forbidden'::text; return; end if;
  if not exists (select 1 from identity.profiles p where p.id = p_profile_id) then
    return query select 'not_found'::text; return;
  end if;
  if not identity.lock_in_force(p_profile_id) then return query select 'not_locked'::text; return; end if;
  select * into v_row from identity.sign_in_failures f where f.profile_id = p_profile_id;
  update identity.sign_in_failures f
  set failures = 0, window_started_at = null, last_failure_at = null, locked_at = null, locked_until = null
  where f.profile_id = p_profile_id;
  perform audit.append('identity.sign_in_unlocked', 'profile', p_profile_id::text, '{}'::jsonb, 'administrator',
    jsonb_build_object('locked_until', v_row.locked_until), jsonb_build_object('locked_until', null), 'global', null);
  perform notifications.enqueue('sign_in_unlocked', 'sign_in_unlocked:' || p_profile_id::text || ':' || now()::text,
    p_profile_id, jsonb_build_object('unlocked_at', now()), '/account');
  return query select 'ok'::text;
end
$$;

-- For the administrator's accounts list: whose new sign-ins are locked now, and until when.
create function api.list_sign_in_locks()
returns table (profile_id uuid, locked_at timestamptz, locked_until timestamptz, failures integer)
language sql
stable
security definer
set search_path = ''
as $$
  select f.profile_id, f.locked_at, f.locked_until, f.failures
  from identity.sign_in_failures f
  where f.locked_until > now() and identity.has_role(auth.uid(), 'administrator')
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.sign_in_gate(text) from public, anon, authenticated, service_role;
revoke all on function api.record_sign_in_failure(text) from public, anon, authenticated, service_role;
revoke all on function api.record_sign_in_success(text) from public, anon, authenticated, service_role;
revoke all on function api.clear_my_sign_in_lock() from public, anon, authenticated, service_role;
revoke all on function api.unlock_account(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_sign_in_locks() from public, anon, authenticated, service_role;

-- The sign-in handler runs before anyone is signed in, so it calls these with the secret key. They are never granted
-- to anon: a public function that counted failures would let anyone lock any account by calling it directly.
grant execute on function api.sign_in_gate(text) to service_role;
grant execute on function api.record_sign_in_failure(text) to service_role;
grant execute on function api.record_sign_in_success(text) to service_role;

grant execute on function api.clear_my_sign_in_lock() to authenticated;
grant execute on function api.unlock_account(uuid) to authenticated;
grant execute on function api.list_sign_in_locks() to authenticated;
