-- Assignments, not tasks (plain words): the reworded notification templates are a new version, recorded per event.
create extension if not exists pgtap with schema extensions;

begin;
select plan(5);

\set learner 00000000-0000-4000-8000-000000000001

select is(notifications.template_version('task_published'), 2, 'a new assignment is worded by version 2');
select is(notifications.template_version('task_reminder'), 2, 'so is a reminder');
select is(notifications.template_version('notice'), 1, 'events with unchanged words stay on version 1');

update notifications.settings set email_enabled = true;
select notifications.enqueue('task_published', 'pgtap:assignment-wording', :'learner', '{}'::jsonb, '/learn/tasks/x');
select results_eq(
  $$ select template_version from notifications.outbox_messages where dedupe_key like 'pgtap:assignment-wording:%' $$,
  $$ values (2) $$,
  'the outbox row carries the version in force for its event');
select results_eq(
  $$ select dedupe_key from notifications.outbox_messages where dedupe_key like 'pgtap:assignment-wording:%' $$,
  format($$ values ('pgtap:assignment-wording:%s:email:v2'::text) $$, :'learner'),
  'and the dedupe key names that version');

select * from finish();
rollback;
