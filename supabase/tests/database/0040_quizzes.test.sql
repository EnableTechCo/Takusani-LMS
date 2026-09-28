-- Formative quizzes (S4-13; FR-205, FR-302, FR-303; ADR-024 point 6; transaction test 18). Uses the local seed:
-- facilitator@ sets work in "2026 Intake B", where learner@ is enrolled.
create extension if not exists pgtap with schema extensions;

begin;
select plan(40);

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

\set learner 00000000-0000-4000-8000-000000000001
\set facilitator 00000000-0000-4000-8000-000000000002
\set assessor 00000000-0000-4000-8000-000000000003
\set programme 10000000-0000-4000-8000-000000000001
\set cohort 10000000-0000-4000-8000-000000000010

-- ---------------------------------------------------------------------------------------------------------------
-- The schema contract: keys are nobody's to read, and no quiz record reaches competency (FR-303, test 18)
-- ---------------------------------------------------------------------------------------------------------------

select is_empty($$
  select r, t from unnest(array['anon', 'authenticated', 'service_role']) r,
    unnest(array['learning.questions', 'learning.question_keys', 'learning.quizzes', 'learning.quiz_questions',
                 'learning.quiz_attempts', 'learning.quiz_responses']) t
  where has_table_privilege(r, t, 'SELECT') or has_table_privilege(r, t, 'INSERT') or has_table_privilege(r, t, 'UPDATE')
$$, 'no role reads or writes the quiz tables directly: answer keys have no learner path (ADR-024 point 6)');
select is_empty($$
  select conrelid::regclass::text from pg_constraint
  where contype = 'f' and conrelid::regclass::text like 'learning.quiz%'
    and confrelid::regclass::text ~ '^(assessment|appeals|credits|moderation|department)[.]'
$$, 'no quiz record points at an assessment, appeal, credit or moderation record');
select is_empty($$
  select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.prosrc ~* 'learning[.](quizzes|quiz_questions|quiz_attempts|quiz_responses|question_keys|questions)([^a-z_]|$)'
    and n.nspname in ('assessment', 'appeals', 'credits', 'moderation', 'department', 'reporting', 'programmes', 'submissions')
$$, 'no assessment, appeal, credit, moderation, reporting or external function reads a quiz (FR-303)');
select set_eq($$
  select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'api' and p.prosrc ~* 'learning[.]question_keys'
$$, $$ values ('save_question'), ('list_question_bank'), ('get_quiz'), ('submit_quiz_attempt'), ('get_my_quiz_attempt') $$,
  'only the bank, the editor, scoring and the learner''s own marked attempt read the keys');
select is_empty($$
  select distinct v.view_schema || '.' || v.view_name from information_schema.view_table_usage v
  where v.table_schema = 'learning' and v.table_name ~ '^(quiz|question)'
$$, 'no view is built on the quiz tables');

-- ---------------------------------------------------------------------------------------------------------------
-- The question bank
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'learner');
select results_eq(format($$ select status from api.save_question(null, %L, 'What is filed?', 'single',
                            '[{"text": "A", "correct": true}, {"text": "B"}]') $$, :'programme'),
  $$ values ('forbidden'::text) $$, 'a learner cannot write questions');
reset role;
select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select status from api.save_question(null, %L, 'Pick one', 'single',
                            '[{"text": "A", "correct": true}, {"text": "B", "correct": true}]') $$, :'programme'),
  $$ values ('invalid_options'::text) $$, 'a single-answer question has exactly one right option');
select results_eq(format($$ select status from api.save_question(null, %L, 'Pick one', 'single', '[{"text": "Only", "correct": true}]') $$, :'programme'),
  $$ values ('invalid_options'::text) $$, 'and at least two options');
select question_id as q1 from api.save_question(null, :'programme', 'How long are invoices kept?', 'single',
  '[{"text": "One year"}, {"text": "Five years", "correct": true}, {"text": "Forever"}]',
  'Right: five years, under the Tax Administration Act.', 'Not quite: invoices are kept for five years.') \gset
select question_id as q2 from api.save_question(null, :'programme', 'Which belong in a personnel file?', 'multiple',
  '[{"text": "Contract", "correct": true}, {"text": "Leave records", "correct": true}, {"text": "Lunch orders"}]',
  'Yes: the contract and leave records.', 'A personnel file holds the contract and leave records.') \gset
select results_eq($$ select prompt, correct from api.list_question_bank('10000000-0000-4000-8000-000000000001') order by prompt $$,
  $$ values ('How long are invoices kept?'::text, array['b']), ('Which belong in a personnel file?', array['a', 'b']) $$,
  'the bank lists the questions with their keys, for the facilitator');

-- ---------------------------------------------------------------------------------------------------------------
-- Building a quiz
-- ---------------------------------------------------------------------------------------------------------------

select results_eq(format($$ select status from api.create_quiz(%L, 'Records quiz', 'Practice.', 0) $$, :'cohort'),
  $$ values ('invalid_attempt_limit'::text) $$, 'the attempt limit is 1 to 20');
select quiz_id as quiz from api.create_quiz(:'cohort', 'Records quiz', 'Practice for Task 3.', 2) \gset
select results_eq(format($$ select status from api.publish_quiz(%L) $$, :'quiz'), $$ values ('no_questions'::text) $$,
  'a quiz with no questions cannot be published');
select results_eq(format($$ select status from api.update_quiz(%L, 'Records quiz', 'Practice for Task 3.', 2,
                            jsonb_build_array(jsonb_build_object('question_id', %L, 'points', 2), jsonb_build_object('question_id', %L, 'points', 0))) $$,
                         :'quiz', :'q1', :'q2'),
  $$ values ('invalid_questions'::text) $$, 'each question is worth 1 to 100 points');
select results_eq(format($$ select status from api.update_quiz(%L, 'Records quiz', 'Practice for Task 3.', 2,
                            jsonb_build_array(jsonb_build_object('question_id', %L, 'points', 2), jsonb_build_object('question_id', %L, 'points', 3))) $$,
                         :'quiz', :'q1', :'q2'),
  $$ values ('ok'::text) $$, 'the facilitator sets the questions, their points and the attempt limit');
select results_eq(format($$ select status from api.publish_quiz(%L) $$, :'quiz'), $$ values ('ok'::text) $$, 'and publishes it');
select results_eq(format($$ select status from api.update_quiz(%L, 'Changed', '', 5, '[]') $$, :'quiz'),
  $$ values ('not_a_draft'::text) $$, 'a published quiz is fixed');
select results_eq(format($$ select status from api.save_question(%L, null, 'Changed wording', 'single',
                            '[{"text": "A", "correct": true}, {"text": "B"}]') $$, :'q1'),
  $$ values ('in_use'::text) $$, 'and so are its questions');
select results_eq(format($$ select questions, attempt_limit from api.list_quizzes() where id = %L $$, :'quiz'),
  $$ values (2, 2) $$, 'the facilitator''s list shows it');
reset role;

-- ---------------------------------------------------------------------------------------------------------------
-- Taking it
-- ---------------------------------------------------------------------------------------------------------------

select pg_temp.act_as(:'learner');
select results_eq($$ select title, questions, attempt_limit, attempts_used from api.list_my_quizzes() $$,
  $$ values ('Records quiz'::text, 2, 2, 0) $$, 'the learner sees the quiz, its size and the attempt limit');
select is((select count(*)::int from api.get_my_quiz(:'quiz'), jsonb_array_elements(questions) q where q ? 'correct'), 0,
  'the questions reach the learner without the key');
select attempt_id as first_attempt from api.start_quiz_attempt(:'quiz') \gset
select results_eq(format($$ select status, attempt_id from api.start_quiz_attempt(%L) $$, :'quiz'),
  format($$ values ('ok'::text, %L::uuid) $$, :'first_attempt'), 'starting again resumes the attempt in progress');
select results_eq(format($$ select state, items -> 0 -> 'right_options' from api.get_my_quiz_attempt(%L) $$, :'first_attempt'),
  $$ values ('in_progress'::text, 'null'::jsonb) $$, 'an attempt in progress shows no key');

select results_eq(format($$ select status, score, max_score from api.submit_quiz_attempt(%L, jsonb_build_object(%L, '["b"]'::jsonb, %L, '["a"]'::jsonb)) $$,
                         :'first_attempt', :'q1', :'q2'),
  $$ values ('ok'::text, 2, 5) $$, 'the score is computed on submission: all the right options, and only them');
select results_eq(format($$ select i ->> 'prompt', (i ->> 'correct')::boolean, i ->> 'feedback', i -> 'right_options'
                            from api.get_my_quiz_attempt(%L), jsonb_array_elements(items) i $$, :'first_attempt'),
  $$ values ('How long are invoices kept?'::text, true, 'Right: five years, under the Tax Administration Act.'::text, 'null'::jsonb),
            ('Which belong in a personnel file?', false, 'A personnel file holds the contract and leave records.', 'null'::jsonb) $$,
  'the learner sees each answer marked, with its automatic feedback, but not the right answers while attempts remain');
select results_eq(format($$ select status, score from api.submit_quiz_attempt(%L, '{}') $$, :'first_attempt'),
  $$ values ('already_submitted'::text, 2) $$, 'submitting again changes nothing');

select attempt_id as second_attempt from api.start_quiz_attempt(:'quiz') \gset
select results_eq(format($$ select status, score from api.submit_quiz_attempt(%L, jsonb_build_object(%L, '["b"]'::jsonb, %L, '["b", "a", "z"]'::jsonb)) $$,
                         :'second_attempt', :'q1', :'q2'),
  $$ values ('ok'::text, 5) $$, 'a second attempt scores in full; an option that does not exist is ignored');
select results_eq(format($$ select answers_shown, items -> 1 -> 'right_options' from api.get_my_quiz_attempt(%L) $$, :'second_attempt'),
  $$ values (true, '["a", "b"]'::jsonb) $$, 'with no attempts left, the right answers are shown');
select results_eq(format($$ select status from api.start_quiz_attempt(%L) $$, :'quiz'), $$ values ('limit_reached'::text) $$,
  'a third attempt is refused at the limit of two');
select results_eq($$ select attempts_used, best_score, best_max from api.list_my_quizzes() $$, $$ values (2, 5, 5) $$,
  'the learner''s list shows attempts used and the best score');
reset role;

-- Test 18: the limit holds even if two starts race: the number is unique and within the limit snapshot.
select throws_ok(format($$ insert into learning.quiz_attempts (quiz_id, learner_id, attempt_number, attempt_limit_snapshot)
                          values (%L, %L, 3, 2) $$, :'quiz', :'learner'),
  '23514', null, 'no attempt beyond the limit can exist');
select throws_ok(format($$ insert into learning.quiz_attempts (quiz_id, learner_id, attempt_number, attempt_limit_snapshot)
                          values (%L, %L, 2, 2) $$, :'quiz', :'learner'),
  '23505', null, 'and no two attempts can share a number');
select throws_ok(format($$ update learning.quiz_responses set correct = true where attempt_id = %L $$, :'first_attempt'),
  '42501', null, 'a marked answer cannot be changed afterwards');

-- Others
select pg_temp.act_as(:'assessor');
select is_empty(format($$ select * from api.get_my_quiz_attempt(%L) $$, :'first_attempt'), 'an assessor cannot open a learner''s attempt');
select is_empty(format($$ select * from api.get_quiz(%L) $$, :'quiz'), 'nor edit the facilitator''s quiz');
reset role;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000b9', 'authenticated', 'authenticated', 'elsewhere@takusani.test', now(), now());
insert into identity.profiles (id, full_name) values ('00000000-0000-4000-8000-0000000000b9', 'Learner Elsewhere');
select pg_temp.act_as('00000000-0000-4000-8000-0000000000b9');
select results_eq(format($$ select status from api.start_quiz_attempt(%L) $$, :'quiz'), $$ values ('not_found'::text) $$,
  'a learner outside the cohort cannot take it');
select is_empty(format($$ select * from api.get_my_quiz(%L) $$, :'quiz'), 'or see it');
reset role;

select pg_temp.act_as(:'facilitator');
select results_eq(format($$ select learners_tried, average_best_percent from api.list_quizzes() where id = %L $$, :'quiz'),
  $$ values (1, 100) $$, 'the facilitator sees how many tried it and how well, as engagement');
select results_eq(format($$ select status from api.archive_quiz(%L) $$, :'quiz'), $$ values ('ok'::text) $$, 'and can archive it');
reset role;
select pg_temp.act_as(:'learner');
select is_empty($$ select * from api.list_my_quizzes() $$, 'an archived quiz is gone from the learner''s list');
reset role;

-- Nothing reached competency.
select is((select count(*)::int from assessment.results where learner_id = :'learner'), 0, 'no result was created by the quiz');
select is((select count(*)::int from assessment.decisions d join assessment.results r on r.id = d.result_id where r.learner_id = :'learner'), 0,
  'and no decision');

select * from finish();
rollback;
