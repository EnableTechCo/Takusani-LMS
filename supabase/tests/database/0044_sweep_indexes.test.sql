-- Codebase sweep: the indexes behind the scoped reads, and the learner-notes policy evaluated once per query.
create extension if not exists pgtap with schema extensions;

begin;
select plan(11);

select has_index('assessment', 'assessable_items', 'assessable_items_cohort_idx', 'cohort_id', 'assessable items are read by cohort');
select has_index('assessment', 'assessment_instances', 'assessment_instances_assessor_idx', 'assessor_id', 'instances are read by assessor');
select has_index('assessment', 'decisions', 'decisions_actor_idx', 'actor_id', 'decisions are read by who decided');
select has_index('appeals', 'appeals', 'appeals_decision_idx', 'decision_id', 'appeals are read by decision');
select has_index('notifications', 'outbox_messages', 'outbox_messages_notification_idx', 'notification_id', 'outbox messages are read by notification');
select has_index('notifications', 'notices', 'notices_cohort_idx', 'cohort_id', 'notices are read by cohort');
select has_index('submissions', 'submission_files', 'submission_files_stored_file_idx', 'stored_file_id', 'submission files are joined from stored files');
select has_index('learning', 'materials', 'materials_stored_file_idx', 'stored_file_id', 'materials are joined from stored files');
select has_index('learning', 'quiz_questions', 'quiz_questions_question_idx', 'question_id', 'quiz questions are read by question');

select policies_are('learning', 'learner_notes', array['only the owner'], 'learner notes keep their one policy');
select ok(
  (select pg_get_expr(polqual, polrelid) from pg_policy
   where polname = 'only the owner' and polrelid = 'learning.learner_notes'::regclass) like '%SELECT auth.uid()%',
  'the policy reads auth.uid() once per query, not once per row');

select * from finish();
rollback;
