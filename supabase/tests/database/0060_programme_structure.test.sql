-- Programme structure: qualifications and units by screen and by import (FR-701, FR-108, FR-801; SRS AS-03). Uses the
-- local seed: Sipho (admin@) is an administrator; Ayesha (coordinator@) coordinates the CBA-NQF4 programme, whose
-- qualification Q-CBA4 has unit U3 (12 credits), which module M3 refers to; Lerato (learner@) is a learner.
create extension if not exists pgtap with schema extensions;

begin;
select plan(32);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set coordinator 00000000-0000-4000-8000-000000000005
\set admin 00000000-0000-4000-8000-000000000006
\set programme 10000000-0000-4000-8000-000000000001
\set qualification 10000000-0000-4000-8000-000000000002
\set u3 10000000-0000-4000-8000-000000000003

-- ---------------------------------------------------------------------------------------------------------------
-- Who may manage a programme's structure
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'learner');
select is_empty($$ select * from api.list_programme_structures() $$, 'a learner sees no programme structure');
select is_empty(format($$ select * from api.get_programme_structure(%L) $$, :'programme'), 'nor one programme');
select results_eq(format($$ select status from api.create_unit(%L, 'U8', 'Nope', 4) $$, :'qualification'),
  $$ values ('forbidden'::text) $$, 'nor may add a unit');
select results_eq(format($$ select status from api.import_units(%L, '[{"row":2}]', false) $$, :'programme'),
  $$ values ('not_found'::text) $$, 'nor import one');
reset role;

select pg_temp.act_as(:'admin');
select results_eq($$ select code, qualifications, units, total_credits from api.list_programme_structures() where code = 'CBA-NQF4' $$,
  $$ values ('CBA-NQF4'::text, 1, 1, 12) $$, 'an administrator sees every programme with its totals');
select results_eq($$ select status from api.create_programme('ADM-TEST', 'Programme made by an administrator', 5::smallint) $$,
  $$ values ('ok'::text) $$, 'an administrator may create a programme');
select results_eq(format($$ select status from api.create_qualification(%L, 'Q-EXTRA', 'Extra qualification') $$, :'programme'),
  $$ values ('ok'::text) $$, 'and a qualification');
select qualification_id as extra from api.create_qualification(:'programme', 'Q-SPARE', 'Spare qualification') \gset
select unit_id as u4 from api.create_unit(:'qualification', 'U4', 'Handle correspondence', 8) \gset
select is((select credits from api.get_programme_structure(:'programme') s, jsonb_array_elements(s.qualifications) q,
  jsonb_array_elements(q -> 'units') u, lateral (select (u ->> 'credits')::integer as credits) c where u ->> 'code' = 'U4'),
  8, 'and a unit, with its credit value');
reset role;

select pg_temp.act_as(:'coordinator');
select results_eq(format($$ select status from api.create_unit(%L, 'U5', 'Plan meetings', 6) $$, :'qualification'),
  $$ values ('ok'::text) $$, 'a coordinator of the programme still may too');
reset role;
select is((select acting_role from audit.events where action = 'programmes.unit_created' and after ->> 'code' = 'U4'),
  'administrator', 'each records the role it was done in');

-- ---------------------------------------------------------------------------------------------------------------
-- Editing and removing
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'admin');
select results_eq(format($$ select status from api.update_unit(%L, 'u4', 'Handle business correspondence') $$, :'u4'),
  $$ values ('ok'::text) $$, 'a unit''s title can be corrected');
select results_eq(format($$ select status from api.update_unit(%L, 'U4', 'Handle business correspondence') $$, :'u4'),
  $$ values ('unchanged'::text) $$, 'saving it again changes nothing');
select results_eq(format($$ select status from api.update_unit(%L, 'U3', 'Handle business correspondence') $$, :'u4'),
  $$ values ('code_taken'::text) $$, 'a code another unit of the qualification uses is refused');
select results_eq(format($$ select status from api.update_unit(%L, 'u 4', 'x') $$, :'u4'),
  $$ values ('invalid_code'::text) $$, 'as is a code with a space');
select results_eq(format($$ select status from api.update_qualification(%L, 'Q-CBA4', 'National Certificate: Business Administration') $$, :'qualification'),
  $$ values ('ok'::text) $$, 'a qualification''s title can be corrected');
reset role;
select results_eq($$ select before ->> 'title', after ->> 'title' from audit.events where action = 'programmes.unit_changed' $$,
  $$ values ('Handle correspondence'::text, 'Handle business correspondence'::text) $$, 'the change is audited with both titles');

select pg_temp.act_as(:'admin');
select results_eq(format($$ select status from api.remove_unit(%L) $$, :'u3'),
  $$ values ('in_use'::text) $$, 'a unit something refers to (a module) cannot be removed');
select results_eq(format($$ select status from api.remove_unit(%L) $$, :'u4'),
  $$ values ('ok'::text) $$, 'a unit nothing refers to can be');
select results_eq(format($$ select status from api.remove_qualification(%L) $$, :'qualification'),
  $$ values ('has_units'::text) $$, 'a qualification with units cannot be removed');
select results_eq(format($$ select status from api.remove_qualification(%L) $$, :'extra'),
  $$ values ('ok'::text) $$, 'an empty one can');
reset role;
select is((select count(*)::integer from programmes.units where id = :'u4'), 0, 'the removed unit is gone');
select is((select count(*)::integer from programmes.unit_credit_values where unit_id = :'u4'), 0, 'with its credit value');

-- ---------------------------------------------------------------------------------------------------------------
-- Importing a unit list
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'admin');
select results_eq(format($$ select status, new_qualifications, new_units, problems from api.import_units(%L, %L, false) $$, :'programme',
  '[{"row":2,"qualification_code":"Q-CBA4","qualification_title":"","unit_code":"U6","unit_title":"Keep minutes","credits":"10"},
    {"row":3,"qualification_code":"Q-SUP","qualification_title":"","unit_code":"S1","unit_title":"Supervise a team","credits":"14"},
    {"row":4,"qualification_code":"Q-CBA4","qualification_title":"","unit_code":"U6","unit_title":"Again","credits":"10"},
    {"row":5,"qualification_code":"Q-CBA4","qualification_title":"","unit_code":"U7","unit_title":"Diary","credits":"ten"},
    {"row":6,"qualification_code":"Q CBA4","qualification_title":"","unit_code":"U8","unit_title":"x","credits":"1"}]'),
  $$ values ('problems'::text, 0, 1,
    '[{"row": 3, "problem": "qualification_title_required"}, {"row": 4, "problem": "duplicate_unit", "first_row": 2},
      {"row": 5, "problem": "invalid_credits"}, {"row": 6, "problem": "invalid_qualification_code"}]'::jsonb) $$,
  'every row is checked and each problem named with its line');
reset role;
select is((select count(*)::integer from programmes.units u join programmes.qualifications q on q.id = u.qualification_id
  where q.programme_id = :'programme'), 2, 'nothing is added while any row has a problem');
select pg_temp.act_as(:'admin');

\set good '[{"row":2,"qualification_code":"Q-CBA4","qualification_title":"","unit_code":"U3","unit_title":"Keep workplace records","credits":"12"},{"row":3,"qualification_code":"Q-CBA4","qualification_title":"","unit_code":"U6","unit_title":"Keep minutes","credits":"10"},{"row":4,"qualification_code":"q-sup","qualification_title":"Supervision","unit_code":"S1","unit_title":"Supervise a team","credits":"14"},{"row":5,"qualification_code":"Q-SUP","qualification_title":"","unit_code":"S2","unit_title":"Run a meeting","credits":"6"}]'
select results_eq(format($$ select status, new_qualifications, new_units, skipped from api.import_units(%L, %L, false) $$, :'programme', :'good'),
  $$ values ('ok'::text, 1, 3, '[{"row": 2, "differs": false, "unit_code": "U3"}]'::jsonb) $$,
  'a clean file is previewed: one qualification and three units to add, one unit already there');
reset role;
select is((select count(*)::integer from programmes.qualifications where programme_id = :'programme' and code = 'Q-SUP'), 0,
  'the preview adds nothing');
select pg_temp.act_as(:'admin');
select results_eq(format($$ select status, new_qualifications, new_units from api.import_units(%L, %L, true) $$, :'programme', :'good'),
  $$ values ('ok'::text, 1, 3) $$, 'applied, it adds them');
select results_eq(format($$ select q ->> 'code', jsonb_array_length(q -> 'units') from api.get_programme_structure(%L) s,
  jsonb_array_elements(s.qualifications) q order by 1 $$, :'programme'),
  $$ values ('Q-CBA4'::text, 3), ('Q-EXTRA', 0), ('Q-SUP', 2) $$, 'under the right qualifications');
select results_eq(format($$ select status, new_qualifications, new_units, jsonb_array_length(skipped) from api.import_units(%L, %L, true) $$, :'programme', :'good'),
  $$ values ('ok'::text, 0, 0, 4) $$, 'loading the same file again adds nothing twice');
select results_eq(format($$ select skipped -> 0 ->> 'differs' from api.import_units(%L, %L, false) $$, :'programme',
  '[{"row":2,"qualification_code":"Q-CBA4","qualification_title":"","unit_code":"U6","unit_title":"Take minutes","credits":"10"}]'),
  $$ values ('true'::text) $$, 'an existing unit whose title differs is flagged, and left as it is');
select results_eq(format($$ select status from api.import_units(%L, '{"not":"a list"}', false) $$, :'programme'),
  $$ values ('invalid_rows'::text) $$, 'a body that is not a list of rows is refused');
reset role;
select results_eq($$ select (details ->> 'units_added')::integer, (details ->> 'qualifications_added')::integer, acting_role
  from audit.events where action = 'programmes.units_imported' order by id $$,
  $$ values (3, 1, 'administrator'::text), (0, 0, 'administrator') $$, 'each import is audited with what it added');

select * from finish();
rollback;
