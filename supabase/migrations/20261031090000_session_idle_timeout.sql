-- Signing out after inactivity, with a warning first (S4-14; audit finding A11Y-07; WCAG 2.2.1; UX architecture 11.1).
--
-- Nothing signed anyone out before: the session refreshes itself while a tab is open. The product owner set an
-- inactivity limit of 30 minutes (29 Sep 2026). It is a versioned setting like the others, so an administrator can
-- change it with a reason, and the app reads the value in force.
--
-- The app enforces it in the browser: two minutes before the limit it asks "Stay signed in?" (at least two minutes'
-- notice, the safe choice focused, as many times as needed); at the limit it signs out. Activity in any tab counts,
-- and an exam in progress keeps every tab active, so a quiet tab never ends an exam. Drafts are already saved on the
-- server, so nothing is lost. Enforcing an inactivity limit on the session itself (Supabase's own setting, on a paid
-- plan, P-14) is left for go-live.

insert into audit.configuration_keys (key, group_key, group_label, group_order, sort_order, label, description,
  value_type, unit_label, min_value, max_value, choices, affects, does_not_affect, in_use) values
('identity.session.idle_minutes', 'sign_in', 'Sign-in protection', 6, 4, 'Sign out after doing nothing for',
 'How long someone may do nothing in the LMS before they are signed out. They are asked two minutes before, and can stay signed in.',
 'integer', 'minutes', 5, 480, null,
 'Every open session, from the moment it takes effect.',
 'An exam in progress never signs anyone out. Saved drafts and uploads already made are kept.',
 true);

insert into audit.configuration_versions (key, version, value, previous_value, effective_from, reason)
values ('identity.session.idle_minutes', 1, '30', null, '-infinity',
  'Set when signing out after inactivity was introduced (S4-14, A11Y-07): 30 minutes, decided by the product owner.');

-- The session policy for the signed-in person: how long they may be inactive. Nothing without a session.
create function api.get_session_policy()
returns table (idle_minutes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select audit.config_int('identity.session.idle_minutes') where auth.uid() is not null
$$;

revoke all on function api.get_session_policy() from public, anon, authenticated, service_role;
grant execute on function api.get_session_policy() to authenticated;
