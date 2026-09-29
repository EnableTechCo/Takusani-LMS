-- Codebase sweep: indexes for the foreign keys the functions filter and join on, the learner-notes policy reading
-- auth.uid() once per query rather than once per row, and notice deliveries reading the latest message.

-- Read by cohort in every appeal, result and marking read.
create index assessable_items_cohort_idx on assessment.assessable_items (cohort_id);
-- The assessor's queue.
create index assessment_instances_assessor_idx on assessment.assessment_instances (assessor_id)
  where assessor_id is not null;
-- Separation-of-duties checks and history reads by the person who decided.
create index decisions_actor_idx on assessment.decisions (actor_id);
create index appeals_decision_idx on appeals.appeals (decision_id);
-- Delivery state per notification.
create index outbox_messages_notification_idx on notifications.outbox_messages (notification_id);
create index notices_cohort_idx on notifications.notices (cohort_id) where cohort_id is not null;
-- Evidence and material reads, and the orphan-upload sweep, join stored files from these.
create index submission_files_stored_file_idx on submissions.submission_files (stored_file_id);
create index materials_stored_file_idx on learning.materials (stored_file_id) where stored_file_id is not null;
-- Whether a question is in use.
create index quiz_questions_question_idx on learning.quiz_questions (question_id);

-- The policy's auth.uid() as a subquery, so it is evaluated once per statement (Supabase lint 0003).
alter policy "only the owner" on learning.learner_notes
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- A notification has at most one email in the outbox today; should it ever have more, the latest one's state is
-- the one reported, rather than whichever row the planner reaches first.
create or replace function api.list_notice_deliveries(p_notice_id uuid)
returns table (
  recipient_name text,
  learner_number text,
  told_at timestamptz,
  read_at timestamptz,
  email_state text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name, p.learner_number, x.created_at, x.read_at,
    (select d.state from notifications.outbox_messages o
     join notifications.notification_deliveries d on d.outbox_message_id = o.id
     where o.notification_id = x.id
     order by o.created_at desc
     limit 1)
  from notifications.notices n
  join notifications.notifications x on x.event_key = 'notice:' || n.id::text
  join identity.profiles p on p.id = x.recipient_id
  where n.id = p_notice_id and notifications.can_see_notice(auth.uid(), n)
  order by p.full_name
$$;

-- The option parser builds jsonb, which Postgres classes as stable, so the function is stable rather than immutable,
-- and its empty array starts typed (the database linter warned on both; nothing indexes on it).
create or replace function learning.parse_options(p_kind text, p_options jsonb)
returns table (options jsonb, correct text[])
language plpgsql
stable
set search_path = ''
as $$
declare
  v_options jsonb := '[]'::jsonb;
  v_correct text[] := '{}'::text[];
  v_item jsonb;
  v_index integer := 0;
  v_id text;
begin
  if jsonb_typeof(coalesce(p_options, 'null'::jsonb)) <> 'array' or jsonb_array_length(p_options) not between 2 and 8 then
    return;
  end if;
  for v_item in select value from jsonb_array_elements(p_options) loop
    if jsonb_typeof(v_item) <> 'object' or char_length(btrim(coalesce(v_item ->> 'text', ''))) not between 1 and 500 then
      return;
    end if;
    v_id := chr(97 + v_index);
    v_options := v_options || jsonb_build_object('id', v_id, 'text', btrim(v_item ->> 'text'));
    if coalesce((v_item ->> 'correct')::boolean, false) then v_correct := v_correct || v_id; end if;
    v_index := v_index + 1;
  end loop;
  if cardinality(v_correct) = 0 or (p_kind = 'single' and cardinality(v_correct) <> 1) then return; end if;
  return query select v_options, v_correct;
end
$$;
