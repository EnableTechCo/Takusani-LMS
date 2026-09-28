-- The learner's calendar feed (S3-13; FR-304; ADR-020; screens L-07, L-08; transaction test 19).
--
-- Calendar apps poll a URL and cannot sign in, so the feed is authenticated by a token in the URL. Each learner has
-- at most one active token: 256 random bits, shown once, stored only as its SHA-256 hash. Creating a new one rotates
-- the old one out; the learner can also revoke it; deactivating the account revokes it. A revoked, rotated or
-- unknown token, or one whose owner is no longer active, gets nothing.
--
-- The feed carries schedule fields only: the learner's sessions and task due dates (exam windows join when exams are
-- built, S5), each with its title, start, end, place and a link into the LMS. Never results, feedback, notices, other
-- learners, or Teams join links: a leaked URL discloses a timetable and nothing else.
--
-- The token is the credential, so the feed function is callable without a session. Limits (security and operations,
-- "Calendar feed"): 60 requests an hour per token; unknown tokens are limited per client address, while a token that
-- is known but revoked is answered without counting, because calendar providers keep polling a revoked URL from
-- shared addresses and must not lock other people out. Counting uses rate_buckets, the data model's table for
-- limits, which the scheduled-jobs framework (S3-10) purges. last_used_at is written at most once an hour, so polling
-- adds reads, not writes.

-- ---------------------------------------------------------------------------------------------------------------
-- Rate buckets
-- ---------------------------------------------------------------------------------------------------------------

create table audit.rate_buckets (
  surface text not null,
  subject text not null check (char_length(subject) <= 128),
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (surface, subject, window_start)
);

create index rate_buckets_window_idx on audit.rate_buckets (window_start);

revoke all on table audit.rate_buckets from public, anon, authenticated, service_role;

-- Counts one hit in the current window and says whether it is within the limit.
create function audit.hit_rate_limit(p_surface text, p_subject text, p_limit integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into audit.rate_buckets as b (surface, subject, window_start, count)
  values (p_surface, p_subject, date_bin(p_window, now(), timestamptz '2000-01-01'), 1)
  on conflict (surface, subject, window_start) do update set count = b.count + 1
  returning b.count into v_count;
  return v_count <= p_limit;
end
$$;

-- Buckets older than two hours have no further use.
create function audit.purge_rate_buckets()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from audit.rate_buckets b where b.window_start < now() - interval '2 hours';
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function audit.hit_rate_limit(text, text, integer, interval) from public, anon, authenticated, service_role;
revoke all on function audit.purge_rate_buckets() from public, anon, authenticated, service_role;

insert into audit.scheduled_jobs (name, kind, description, handler, schedule, heartbeat_within)
values ('purge-rate-buckets', 'recurring', 'Removes rate-limit counts more than two hours old.',
        'audit.purge_rate_buckets', '5 * * * *', interval '3 hours');

select cron.schedule('purge-rate-buckets', '5 * * * *', $$select audit.run_job('purge-rate-buckets')$$);

-- ---------------------------------------------------------------------------------------------------------------
-- Feed tokens
-- ---------------------------------------------------------------------------------------------------------------

create table learning.calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references identity.profiles (id),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text check (revoked_reason in ('rotated', 'revoked', 'deactivated')),
  constraint revocation_is_recorded check ((revoked_at is null) = (revoked_reason is null))
);

-- One active token per person.
create unique index calendar_feed_tokens_active_idx on learning.calendar_feed_tokens (profile_id) where revoked_at is null;

revoke all on table learning.calendar_feed_tokens from public, anon, authenticated, service_role;

-- Deactivating an account revokes its feed (ADR-020); reactivating does not bring it back.
create function learning.revoke_feed_on_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'deactivated' and old.status is distinct from 'deactivated' then
    update learning.calendar_feed_tokens t set revoked_at = now(), revoked_reason = 'deactivated'
    where t.profile_id = new.id and t.revoked_at is null;
  end if;
  return new;
end
$$;

revoke all on function learning.revoke_feed_on_deactivation() from public, anon, authenticated, service_role;

create trigger profiles_revoke_calendar_feed
  after update of status on identity.profiles
  for each row execute function learning.revoke_feed_on_deactivation();

-- Creates the learner's feed token, rotating out any active one. The token is returned this once and never again.
create function api.issue_calendar_feed_token()
returns table (status text, token text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_token text;
  v_rotated boolean;
  v_row learning.calendar_feed_tokens;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::text, null::timestamptz; return; end if;
  if not identity.has_role(v_actor, 'learner') then
    return query select 'forbidden'::text, null::text, null::timestamptz; return;
  end if;

  update learning.calendar_feed_tokens t set revoked_at = now(), revoked_reason = 'rotated'
  where t.profile_id = v_actor and t.revoked_at is null;
  v_rotated := found;

  -- 256 random bits, URL-safe base64 without padding: 43 characters.
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  insert into learning.calendar_feed_tokens (profile_id, token_hash)
  values (v_actor, extensions.digest(v_token, 'sha256'))
  returning * into v_row;

  perform audit.append(case when v_rotated then 'learning.calendar_feed_rotated' else 'learning.calendar_feed_created' end,
    'calendar_feed', v_row.id::text, '{}'::jsonb, 'learner', null, null, null, null);
  return query select 'ok'::text, v_token, v_row.created_at;
end
$$;

create function api.revoke_calendar_feed_token()
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  update learning.calendar_feed_tokens t set revoked_at = now(), revoked_reason = 'revoked'
  where t.profile_id = v_actor and t.revoked_at is null
  returning t.id into v_id;
  if v_id is null then return query select 'no_feed'::text; return; end if;
  perform audit.append('learning.calendar_feed_revoked', 'calendar_feed', v_id::text, '{}'::jsonb, 'learner',
    null, null, null, null);
  return query select 'ok'::text;
end
$$;

-- L-08: whether the learner has a feed, since when, and when a calendar app last fetched it. Never the token.
create function api.my_calendar_feed()
returns table (active boolean, created_at timestamptz, last_used_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select true, t.created_at, t.last_used_at
  from learning.calendar_feed_tokens t
  where t.profile_id = auth.uid() and t.revoked_at is null
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- The feed
-- ---------------------------------------------------------------------------------------------------------------

-- The schedule for a token: {status, events}. status is 'ok', 'not_found' (unknown, revoked, rotated, or an owner who
-- is not active) or 'rate_limited'. Each event: kind ('session' or 'due'), id, title, starts_at, ends_at, location,
-- cancelled, updated_at. p_client is the caller's address, used only to limit unknown tokens.
create function api.calendar_feed(p_token text, p_client text default null)
returns table (status text, events jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token learning.calendar_feed_tokens;
  v_owner uuid;
  v_client text := left(coalesce(nullif(btrim(p_client), ''), 'unknown'), 64);
begin
  if coalesce(p_token, '') ~ '^[A-Za-z0-9_-]{43}$' then
    select * into v_token from learning.calendar_feed_tokens t where t.token_hash = extensions.digest(p_token, 'sha256');
  end if;

  if v_token.id is null then
    -- Unknown: counted against the caller's address, so guessing is slow as well as hopeless.
    if not audit.hit_rate_limit('calendar_feed_unknown', v_client, 30, interval '1 hour') then
      return query select 'rate_limited'::text, null::jsonb; return;
    end if;
    return query select 'not_found'::text, null::jsonb; return;
  end if;

  -- Known but revoked, or its owner is not active: answered without counting (ADR-020).
  if v_token.revoked_at is not null or not exists (
    select 1 from identity.profiles p where p.id = v_token.profile_id and p.status = 'active'
  ) then
    return query select 'not_found'::text, null::jsonb; return;
  end if;

  if not audit.hit_rate_limit('calendar_feed_token', encode(v_token.token_hash, 'hex'), 60, interval '1 hour') then
    return query select 'rate_limited'::text, null::jsonb; return;
  end if;

  if v_token.last_used_at is null or v_token.last_used_at < now() - interval '1 hour' then
    update learning.calendar_feed_tokens t set last_used_at = now() where t.id = v_token.id;
  end if;
  v_owner := v_token.profile_id;

  return query
  select 'ok'::text, coalesce(jsonb_agg(e.event order by e.starts_at, e.title), '[]'::jsonb)
  from (
    select s.starts_at, s.title, jsonb_build_object(
      'kind', 'session',
      'id', s.id,
      'title', s.title,
      'starts_at', s.starts_at,
      'ends_at', s.starts_at + make_interval(mins => s.duration_minutes),
      'location', case when s.mode = 'online' then 'Online' else s.venue end,
      'cancelled', s.state = 'cancelled',
      'updated_at', s.updated_at
    ) as event
    from learning.sessions s
    join programmes.enrolments en on en.cohort_id = s.cohort_id and en.profile_id = v_owner and en.status = 'active'
    where s.starts_at > now() - interval '60 days'
    union all
    select t.due_at, t.title, jsonb_build_object(
      'kind', 'due',
      'id', t.id,
      'title', t.title,
      'starts_at', t.due_at,
      'ends_at', t.due_at,
      'location', null,
      'cancelled', false,
      'updated_at', t.updated_at
    )
    from submissions.tasks t
    where t.state = 'published' and t.due_at is not null and t.due_at > now() - interval '60 days'
      and submissions.is_audience(v_owner, t.id)
  ) e;
end
$$;

revoke all on function api.issue_calendar_feed_token() from public, anon, authenticated, service_role;
revoke all on function api.revoke_calendar_feed_token() from public, anon, authenticated, service_role;
revoke all on function api.my_calendar_feed() from public, anon, authenticated, service_role;
revoke all on function api.calendar_feed(text, text) from public, anon, authenticated, service_role;

grant execute on function api.issue_calendar_feed_token() to authenticated;
grant execute on function api.revoke_calendar_feed_token() to authenticated;
grant execute on function api.my_calendar_feed() to authenticated;
-- The token is the credential: a calendar app has no session.
grant execute on function api.calendar_feed(text, text) to anon, authenticated;
