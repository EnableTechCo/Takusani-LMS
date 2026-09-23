-- Learner home (S2-12): a learner reads only their own active enrolments. Uses the local seed.
create extension if not exists pgtap with schema extensions;

begin;
select plan(4);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set assessor 00000000-0000-4000-8000-000000000003
\set cohort 10000000-0000-4000-8000-000000000010

select pg_temp.act_as(:'learner');
select results_eq($$ select cohort_id, cohort_name from api.list_my_enrolments() $$,
  format($$ values (%L::uuid, '2026 Intake B'::text) $$, :'cohort'), 'the learner sees their cohort');

reset role;
select pg_temp.act_as(:'assessor');
select is_empty($$ select * from api.list_my_enrolments() $$, 'someone not enrolled sees none');

reset role;
update programmes.enrolments set status = 'withdrawn' where profile_id = :'learner';
select pg_temp.act_as(:'learner');
select is_empty($$ select * from api.list_my_enrolments() $$, 'a withdrawn enrolment is not shown');

reset role;
select set_config('request.jwt.claims', '', true);
set local role authenticated;
select is_empty($$ select * from api.list_my_enrolments() $$, 'someone not signed in sees none');

select * from finish();
rollback;
