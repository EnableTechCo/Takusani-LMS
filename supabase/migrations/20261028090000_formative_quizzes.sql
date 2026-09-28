-- Formative quizzes (S4-13; FR-205, FR-302, FR-303; ADR-024 point 6; transaction test 18; screens F-05, L-06).
--
-- A facilitator writes questions into their programme's question bank and builds a quiz for a cohort from them, with
-- a number of points per question and an attempt limit, then publishes it. A learner in the cohort answers it and
-- gets their score and the automatic feedback straight away.
--
-- Answer keys live apart from the questions (ADR-024 point 6): questions and their options are what a learner may
-- read; question_keys holds which options are right and the feedback, has no grant to anyone, and only the scoring
-- function reads it for a learner. Learners have no write path to a score: the submit function computes it.
--
-- The attempt limit holds under concurrency: an attempt carries its number and the limit in force when it started,
-- the pair (quiz, learner, number) is unique, and a check keeps the number within the limit (transaction test 18).
--
-- Quizzes never count towards competency (FR-303). Nothing links a quiz record to a result, decision or credit: no
-- foreign key, and no assessment, appeal, moderation, credit or external function reads the quiz tables. Test 0040
-- is the schema contract. A published quiz is fixed; a question used by a published quiz can no longer be edited.

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

-- The question bank, per programme. Options are what the learner sees: [{"id": "a", "text": "..."}].
create table learning.questions (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references programmes.programmes (id),
  module_id uuid references programmes.modules (id),
  prompt text not null check (char_length(btrim(prompt)) between 1 and 2000),
  kind text not null check (kind in ('single', 'multiple')),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  created_by uuid not null references identity.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Which options are right, and what the learner is told. No learner may read it.
create table learning.question_keys (
  question_id uuid primary key references learning.questions (id),
  correct text[] not null check (cardinality(correct) >= 1),
  feedback_correct text not null default '' check (char_length(feedback_correct) <= 2000),
  feedback_incorrect text not null default '' check (char_length(feedback_incorrect) <= 2000)
);

create table learning.quizzes (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references programmes.cohorts (id),
  module_id uuid references programmes.modules (id),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  attempt_limit integer not null default 3 check (attempt_limit between 1 and 20),
  state text not null default 'draft' check (state in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid not null references identity.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_is_recorded check (state <> 'published' or published_at is not null)
);

create table learning.quiz_questions (
  quiz_id uuid not null references learning.quizzes (id),
  question_id uuid not null references learning.questions (id),
  ordinal integer not null check (ordinal >= 1),
  points integer not null default 1 check (points between 1 and 100),
  primary key (quiz_id, question_id),
  unique (quiz_id, ordinal)
);

create table learning.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references learning.quizzes (id),
  learner_id uuid not null references identity.profiles (id),
  attempt_number integer not null check (attempt_number >= 1),
  attempt_limit_snapshot integer not null,
  state text not null default 'in_progress' check (state in ('in_progress', 'submitted')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score integer,
  max_score integer,
  unique (quiz_id, learner_id, attempt_number),
  constraint within_the_limit check (attempt_number <= attempt_limit_snapshot),
  constraint submission_is_scored check (
    (state = 'submitted') = (submitted_at is not null and score is not null and max_score is not null)
  )
);

create table learning.quiz_responses (
  attempt_id uuid not null references learning.quiz_attempts (id),
  question_id uuid not null references learning.questions (id),
  chosen text[] not null,
  correct boolean not null,
  points_awarded integer not null check (points_awarded >= 0),
  feedback text not null default '',
  primary key (attempt_id, question_id)
);

create index questions_programme_idx on learning.questions (programme_id, created_at desc);
create index quizzes_cohort_idx on learning.quizzes (cohort_id, state);
create index quiz_attempts_learner_idx on learning.quiz_attempts (learner_id, quiz_id);

revoke all on table learning.questions, learning.question_keys, learning.quizzes, learning.quiz_questions,
  learning.quiz_attempts, learning.quiz_responses from public, anon, authenticated, service_role;

-- A submitted attempt and its responses are the learner's record: never changed.
create trigger quiz_responses_append_only
  before update or delete on learning.quiz_responses
  for each row execute function audit.forbid_mutation();
create trigger quiz_responses_append_only_truncate
  before truncate on learning.quiz_responses
  for each statement execute function audit.forbid_mutation();

-- ---------------------------------------------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------------------------------------------

-- May this person write questions for a programme's bank: they set work in one of its cohorts.
create function learning.can_write_questions(p_profile_id uuid, p_programme_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from programmes.cohorts c
    where c.programme_id = p_programme_id and c.status <> 'archived' and submissions.can_set_work(p_profile_id, c.id)
  )
$$;

-- Is the question in a quiz that has been published (so its wording and key are fixed)?
create function learning.question_in_use(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from learning.quiz_questions qq join learning.quizzes q on q.id = qq.quiz_id
    where qq.question_id = p_question_id and q.published_at is not null
  )
$$;

-- Checks and normalises a question's options: [{"text": ..., "correct": bool}] gives the learner-facing options
-- (ids a, b, c, ...) and the correct ids; null when the shape is wrong.
create function learning.parse_options(p_kind text, p_options jsonb)
returns table (options jsonb, correct text[])
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_options jsonb := '[]'::jsonb;
  v_correct text[] := '{}';
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

revoke all on function learning.can_write_questions(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function learning.question_in_use(uuid) from public, anon, authenticated, service_role;
revoke all on function learning.parse_options(text, jsonb) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- The question bank (facilitators)
-- ---------------------------------------------------------------------------------------------------------------

-- p_options: [{"text": "...", "correct": true|false}]. A single-answer question has exactly one right option.
create function api.save_question(
  p_question_id uuid,
  p_programme_id uuid,
  p_prompt text,
  p_kind text,
  p_options jsonb,
  p_feedback_correct text default '',
  p_feedback_incorrect text default '',
  p_module_id uuid default null
)
returns table (status text, question_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_parsed record;
  v_existing learning.questions;
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  if p_question_id is not null then
    select * into v_existing from learning.questions q where q.id = p_question_id for update;
    if not found or not learning.can_write_questions(v_actor, v_existing.programme_id) then
      return query select 'not_found'::text, null::uuid; return;
    end if;
    if learning.question_in_use(p_question_id) then return query select 'in_use'::text, p_question_id; return; end if;
  elsif p_programme_id is null or not learning.can_write_questions(v_actor, p_programme_id) then
    return query select 'forbidden'::text, null::uuid; return;
  end if;
  if char_length(btrim(coalesce(p_prompt, ''))) not between 1 and 2000 then
    return query select 'invalid_prompt'::text, null::uuid; return;
  end if;
  if p_kind not in ('single', 'multiple') then return query select 'invalid_kind'::text, null::uuid; return; end if;
  select * into v_parsed from learning.parse_options(p_kind, p_options);
  if v_parsed.options is null then return query select 'invalid_options'::text, null::uuid; return; end if;
  if char_length(coalesce(p_feedback_correct, '')) > 2000 or char_length(coalesce(p_feedback_incorrect, '')) > 2000 then
    return query select 'feedback_too_long'::text, null::uuid; return;
  end if;
  if p_module_id is not null and not exists (
    select 1 from programmes.modules m where m.id = p_module_id
      and m.programme_id = coalesce(v_existing.programme_id, p_programme_id)
  ) then
    return query select 'module_not_in_programme'::text, null::uuid; return;
  end if;

  if p_question_id is null then
    insert into learning.questions (programme_id, module_id, prompt, kind, options, created_by)
    values (p_programme_id, p_module_id, btrim(p_prompt), p_kind, v_parsed.options, v_actor)
    returning id into v_id;
    insert into learning.question_keys (question_id, correct, feedback_correct, feedback_incorrect)
    values (v_id, v_parsed.correct, coalesce(p_feedback_correct, ''), coalesce(p_feedback_incorrect, ''));
  else
    v_id := p_question_id;
    update learning.questions q
    set prompt = btrim(p_prompt), kind = p_kind, options = v_parsed.options, module_id = p_module_id, updated_at = now()
    where q.id = v_id;
    update learning.question_keys k
    set correct = v_parsed.correct, feedback_correct = coalesce(p_feedback_correct, ''),
        feedback_incorrect = coalesce(p_feedback_incorrect, '')
    where k.question_id = v_id;
  end if;
  return query select 'ok'::text, v_id;
end
$$;

-- The bank of a programme, with the keys: for the facilitators who write it, never for learners.
create function api.list_question_bank(p_programme_id uuid)
returns table (
  id uuid,
  prompt text,
  kind text,
  options jsonb,
  correct text[],
  feedback_correct text,
  feedback_incorrect text,
  module_title text,
  in_use boolean,
  created_by_name text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.prompt, q.kind, q.options, k.correct, k.feedback_correct, k.feedback_incorrect, m.title,
    learning.question_in_use(q.id), p.full_name, q.updated_at
  from learning.questions q
  join learning.question_keys k on k.question_id = q.id
  left join programmes.modules m on m.id = q.module_id
  left join identity.profiles p on p.id = q.created_by
  where q.programme_id = p_programme_id and learning.can_write_questions(auth.uid(), p_programme_id)
  order by q.updated_at desc
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Quizzes (facilitators)
-- ---------------------------------------------------------------------------------------------------------------

create function api.create_quiz(
  p_cohort_id uuid,
  p_title text,
  p_description text default '',
  p_attempt_limit integer default 3,
  p_module_id uuid default null
)
returns table (status text, quiz_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid; return; end if;
  if not exists (select 1 from programmes.cohorts c where c.id = p_cohort_id and c.status in ('setup', 'active')) then
    return query select 'cohort_not_found'::text, null::uuid; return;
  end if;
  if not submissions.can_set_work(v_actor, p_cohort_id) then return query select 'forbidden'::text, null::uuid; return; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then return query select 'invalid_title'::text, null::uuid; return; end if;
  if char_length(coalesce(p_description, '')) > 5000 then return query select 'invalid_description'::text, null::uuid; return; end if;
  if p_attempt_limit is null or p_attempt_limit not between 1 and 20 then
    return query select 'invalid_attempt_limit'::text, null::uuid; return;
  end if;
  if p_module_id is not null and not exists (
    select 1 from programmes.modules m join programmes.cohorts c on c.programme_id = m.programme_id
    where m.id = p_module_id and c.id = p_cohort_id
  ) then
    return query select 'module_not_in_programme'::text, null::uuid; return;
  end if;
  insert into learning.quizzes (cohort_id, module_id, title, description, attempt_limit, created_by)
  values (p_cohort_id, p_module_id, btrim(p_title), coalesce(p_description, ''), p_attempt_limit, v_actor)
  returning id into v_id;
  perform audit.append('learning.quiz_created', 'quiz', v_id::text, '{}'::jsonb, 'facilitator', null,
    jsonb_build_object('title', btrim(p_title), 'attempt_limit', p_attempt_limit), 'cohort', p_cohort_id);
  return query select 'ok'::text, v_id;
end
$$;

-- A draft's details and its questions, in order: [{"question_id": ..., "points": n}]. A published quiz is fixed.
create function api.update_quiz(
  p_quiz_id uuid,
  p_title text,
  p_description text,
  p_attempt_limit integer,
  p_questions jsonb
)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_quiz learning.quizzes;
  v_programme uuid;
  v_item jsonb;
  v_ordinal integer := 0;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_quiz from learning.quizzes q where q.id = p_quiz_id for update;
  if not found or not submissions.can_set_work(v_actor, v_quiz.cohort_id) then return query select 'not_found'::text; return; end if;
  if v_quiz.state <> 'draft' then return query select 'not_a_draft'::text; return; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 200 then return query select 'invalid_title'::text; return; end if;
  if char_length(coalesce(p_description, '')) > 5000 then return query select 'invalid_description'::text; return; end if;
  if p_attempt_limit is null or p_attempt_limit not between 1 and 20 then return query select 'invalid_attempt_limit'::text; return; end if;
  select c.programme_id into v_programme from programmes.cohorts c where c.id = v_quiz.cohort_id;
  if jsonb_typeof(coalesce(p_questions, 'null'::jsonb)) <> 'array' or jsonb_array_length(p_questions) > 100
     or exists (
       select 1 from jsonb_array_elements(p_questions) e
       where coalesce(e ->> 'question_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or coalesce((e ->> 'points')::integer, 0) not between 1 and 100
          or not exists (select 1 from learning.questions q where q.id = (e ->> 'question_id')::uuid and q.programme_id = v_programme)
     )
     or (select count(*) from jsonb_array_elements(p_questions)) <> (select count(distinct e ->> 'question_id') from jsonb_array_elements(p_questions) e)
  then
    return query select 'invalid_questions'::text; return;
  end if;

  update learning.quizzes q
  set title = btrim(p_title), description = coalesce(p_description, ''), attempt_limit = p_attempt_limit, updated_at = now()
  where q.id = p_quiz_id;
  delete from learning.quiz_questions qq where qq.quiz_id = p_quiz_id;
  for v_item in select value from jsonb_array_elements(p_questions) loop
    v_ordinal := v_ordinal + 1;
    insert into learning.quiz_questions (quiz_id, question_id, ordinal, points)
    values (p_quiz_id, (v_item ->> 'question_id')::uuid, v_ordinal, (v_item ->> 'points')::integer);
  end loop;
  return query select 'ok'::text;
end
$$;

create function api.publish_quiz(p_quiz_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_quiz learning.quizzes;
begin
  if v_actor is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_quiz from learning.quizzes q where q.id = p_quiz_id for update;
  if not found or not submissions.can_set_work(v_actor, v_quiz.cohort_id) then return query select 'not_found'::text; return; end if;
  if v_quiz.state <> 'draft' then return query select 'not_a_draft'::text; return; end if;
  if not exists (select 1 from learning.quiz_questions qq where qq.quiz_id = p_quiz_id) then
    return query select 'no_questions'::text; return;
  end if;
  update learning.quizzes q set state = 'published', published_at = now(), updated_at = now() where q.id = p_quiz_id;
  perform audit.append('learning.quiz_published', 'quiz', p_quiz_id::text,
    jsonb_build_object('questions', (select count(*) from learning.quiz_questions qq where qq.quiz_id = p_quiz_id)),
    'facilitator', jsonb_build_object('state', 'draft'), jsonb_build_object('state', 'published'), 'cohort', v_quiz.cohort_id);
  return query select 'ok'::text;
end
$$;

create function api.archive_quiz(p_quiz_id uuid)
returns table (status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz learning.quizzes;
begin
  if auth.uid() is null then return query select 'unauthenticated'::text; return; end if;
  select * into v_quiz from learning.quizzes q where q.id = p_quiz_id for update;
  if not found or not submissions.can_set_work(auth.uid(), v_quiz.cohort_id) then return query select 'not_found'::text; return; end if;
  if v_quiz.state = 'archived' then return query select 'ok'::text; return; end if;
  update learning.quizzes q
  set state = 'archived', updated_at = now() where q.id = p_quiz_id;
  perform audit.append('learning.quiz_archived', 'quiz', p_quiz_id::text, '{}'::jsonb, 'facilitator',
    jsonb_build_object('state', v_quiz.state), jsonb_build_object('state', 'archived'), 'cohort', v_quiz.cohort_id);
  return query select 'ok'::text;
end
$$;

-- The facilitator's quizzes, with how many learners have tried each and their average best score (engagement only).
create function api.list_quizzes()
returns table (
  id uuid,
  title text,
  cohort_name text,
  programme_id uuid,
  state text,
  attempt_limit integer,
  questions integer,
  learners_tried integer,
  average_best_percent integer,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.title, c.name, c.programme_id, q.state, q.attempt_limit,
    (select count(*)::integer from learning.quiz_questions qq where qq.quiz_id = q.id),
    (select count(distinct a.learner_id)::integer from learning.quiz_attempts a where a.quiz_id = q.id and a.state = 'submitted'),
    (select round(avg(best))::integer from (
       select max(100.0 * a.score / nullif(a.max_score, 0)) as best from learning.quiz_attempts a
       where a.quiz_id = q.id and a.state = 'submitted' group by a.learner_id) b),
    q.updated_at
  from learning.quizzes q
  join programmes.cohorts c on c.id = q.cohort_id
  where submissions.can_set_work(auth.uid(), q.cohort_id)
  order by q.state = 'archived', q.updated_at desc
$$;

-- One quiz for its editor: details and questions in order, with keys.
create function api.get_quiz(p_quiz_id uuid)
returns table (
  id uuid,
  cohort_id uuid,
  cohort_name text,
  programme_id uuid,
  title text,
  description text,
  attempt_limit integer,
  state text,
  published_at timestamptz,
  questions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.cohort_id, c.name, c.programme_id, q.title, q.description, q.attempt_limit, q.state, q.published_at,
    coalesce((
      select jsonb_agg(jsonb_build_object('question_id', qu.id, 'prompt', qu.prompt, 'kind', qu.kind, 'options', qu.options,
        'correct', k.correct, 'points', qq.points) order by qq.ordinal)
      from learning.quiz_questions qq
      join learning.questions qu on qu.id = qq.question_id
      join learning.question_keys k on k.question_id = qu.id
      where qq.quiz_id = q.id
    ), '[]'::jsonb)
  from learning.quizzes q
  join programmes.cohorts c on c.id = q.cohort_id
  where q.id = p_quiz_id and submissions.can_set_work(auth.uid(), q.cohort_id)
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Taking a quiz (learners)
-- ---------------------------------------------------------------------------------------------------------------

-- Published quizzes for the learner's cohorts, with their attempts used and best score.
create function api.list_my_quizzes()
returns table (
  id uuid,
  title text,
  description text,
  module_code text,
  module_title text,
  questions integer,
  attempt_limit integer,
  attempts_used integer,
  best_score integer,
  best_max integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.title, q.description, m.code, m.title,
    (select count(*)::integer from learning.quiz_questions qq where qq.quiz_id = q.id), q.attempt_limit,
    (select count(*)::integer from learning.quiz_attempts a where a.quiz_id = q.id and a.learner_id = auth.uid()),
    b.score, b.max_score
  from learning.quizzes q
  join programmes.enrolments e on e.cohort_id = q.cohort_id and e.profile_id = auth.uid() and e.status = 'active'
  left join programmes.modules m on m.id = q.module_id
  left join lateral (
    select a.score, a.max_score from learning.quiz_attempts a
    where a.quiz_id = q.id and a.learner_id = auth.uid() and a.state = 'submitted'
    order by a.score::numeric / nullif(a.max_score, 0) desc nulls last, a.submitted_at
    limit 1
  ) b on true
  where q.state = 'published'
  order by m.code nulls last, q.published_at desc
$$;

-- A published quiz for a learner in its cohort: its questions and options (never the key), and their attempts.
create function api.get_my_quiz(p_quiz_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  attempt_limit integer,
  questions jsonb,
  attempts jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.title, q.description, q.attempt_limit,
    coalesce((
      select jsonb_agg(jsonb_build_object('question_id', qu.id, 'prompt', qu.prompt, 'kind', qu.kind,
        'options', qu.options, 'points', qq.points) order by qq.ordinal)
      from learning.quiz_questions qq join learning.questions qu on qu.id = qq.question_id
      where qq.quiz_id = q.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('attempt_id', a.id, 'attempt_number', a.attempt_number, 'state', a.state,
        'started_at', a.started_at, 'submitted_at', a.submitted_at, 'score', a.score, 'max_score', a.max_score)
        order by a.attempt_number)
      from learning.quiz_attempts a where a.quiz_id = q.id and a.learner_id = auth.uid()
    ), '[]'::jsonb)
  from learning.quizzes q
  join programmes.enrolments e on e.cohort_id = q.cohort_id and e.profile_id = auth.uid() and e.status = 'active'
  where q.id = p_quiz_id and q.state = 'published'
$$;

-- Starts an attempt, or returns the one already in progress. Refused once the limit is used. Two starts at once
-- cannot both take the last attempt: the attempt number is unique per learner and quiz (transaction test 18).
create function api.start_quiz_attempt(p_quiz_id uuid)
returns table (status text, attempt_id uuid, attempt_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_quiz learning.quizzes;
  v_open learning.quiz_attempts;
  v_next integer;
  v_id uuid;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::uuid, null::integer; return; end if;
  select * into v_quiz from learning.quizzes q where q.id = p_quiz_id and q.state = 'published';
  if not found or not exists (
    select 1 from programmes.enrolments e where e.cohort_id = v_quiz.cohort_id and e.profile_id = v_actor and e.status = 'active'
  ) then
    return query select 'not_found'::text, null::uuid, null::integer; return;
  end if;
  select * into v_open from learning.quiz_attempts a
  where a.quiz_id = p_quiz_id and a.learner_id = v_actor and a.state = 'in_progress';
  if found then return query select 'ok'::text, v_open.id, v_open.attempt_number; return; end if;

  select coalesce(max(a.attempt_number), 0) + 1 into v_next
  from learning.quiz_attempts a where a.quiz_id = p_quiz_id and a.learner_id = v_actor;
  if v_next > v_quiz.attempt_limit then return query select 'limit_reached'::text, null::uuid, null::integer; return; end if;

  insert into learning.quiz_attempts (quiz_id, learner_id, attempt_number, attempt_limit_snapshot)
  values (p_quiz_id, v_actor, v_next, v_quiz.attempt_limit)
  on conflict on constraint quiz_attempts_quiz_id_learner_id_attempt_number_key do nothing
  returning id into v_id;
  if v_id is null then
    -- Another start took this number a moment ago: hand back the attempt it opened.
    select a.id into v_id from learning.quiz_attempts a
    where a.quiz_id = p_quiz_id and a.learner_id = v_actor and a.attempt_number = v_next;
  end if;
  return query select 'ok'::text, v_id, v_next;
end
$$;

-- Submits an attempt: p_answers is {"<question id>": ["a", "c"]}. The score is computed here from the keys: a
-- question scores its points when the chosen options are exactly the right ones. Submitting again returns the same.
create function api.submit_quiz_attempt(p_attempt_id uuid, p_answers jsonb)
returns table (status text, score integer, max_score integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_attempt learning.quiz_attempts;
  v_score integer := 0;
  v_max integer := 0;
  v_row record;
  v_chosen text[];
  v_correct boolean;
begin
  if v_actor is null then return query select 'unauthenticated'::text, null::integer, null::integer; return; end if;
  select * into v_attempt from learning.quiz_attempts a where a.id = p_attempt_id and a.learner_id = v_actor for update;
  if not found then return query select 'not_found'::text, null::integer, null::integer; return; end if;
  if v_attempt.state = 'submitted' then
    return query select 'already_submitted'::text, v_attempt.score, v_attempt.max_score; return;
  end if;
  if p_answers is not null and jsonb_typeof(p_answers) <> 'object' then
    return query select 'invalid_answers'::text, null::integer, null::integer; return;
  end if;

  for v_row in
    select qq.question_id, qq.points, k.correct, k.feedback_correct, k.feedback_incorrect, qu.options
    from learning.quiz_questions qq
    join learning.questions qu on qu.id = qq.question_id
    join learning.question_keys k on k.question_id = qq.question_id
    where qq.quiz_id = v_attempt.quiz_id
    order by qq.ordinal
  loop
    -- Only real option ids count; anything else in the answer is ignored.
    select coalesce(array_agg(distinct c order by c), '{}') into v_chosen
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_answers -> v_row.question_id::text) = 'array' then p_answers -> v_row.question_id::text else '[]'::jsonb end
    ) c
    where exists (select 1 from jsonb_array_elements(v_row.options) o where o ->> 'id' = c);
    v_correct := v_chosen = (select array_agg(c order by c) from unnest(v_row.correct) c);
    insert into learning.quiz_responses (attempt_id, question_id, chosen, correct, points_awarded, feedback)
    values (p_attempt_id, v_row.question_id, v_chosen, v_correct, case when v_correct then v_row.points else 0 end,
            case when v_correct then v_row.feedback_correct else v_row.feedback_incorrect end);
    v_max := v_max + v_row.points;
    if v_correct then v_score := v_score + v_row.points; end if;
  end loop;

  update learning.quiz_attempts a
  set state = 'submitted', submitted_at = now(), score = v_score, max_score = v_max
  where a.id = p_attempt_id;
  return query select 'ok'::text, v_score, v_max;
end
$$;

-- An attempt for its learner. While in progress: the questions to answer. Submitted: the score and, per question,
-- what they chose, whether it was right and the feedback. The right answers are shown once no attempts are left.
create function api.get_my_quiz_attempt(p_attempt_id uuid)
returns table (
  attempt_id uuid,
  quiz_id uuid,
  quiz_title text,
  attempt_number integer,
  attempt_limit integer,
  state text,
  score integer,
  max_score integer,
  submitted_at timestamptz,
  answers_shown boolean,
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with a as (
    select a.*, q.title, q.attempt_limit,
      a.state = 'submitted' and (
        select count(*) from learning.quiz_attempts x where x.quiz_id = a.quiz_id and x.learner_id = a.learner_id
      ) >= q.attempt_limit as shown
    from learning.quiz_attempts a
    join learning.quizzes q on q.id = a.quiz_id
    where a.id = p_attempt_id and a.learner_id = auth.uid()
  )
  select a.id, a.quiz_id, a.title, a.attempt_number, a.attempt_limit, a.state, a.score, a.max_score, a.submitted_at, a.shown,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', qu.id, 'prompt', qu.prompt, 'kind', qu.kind, 'options', qu.options, 'points', qq.points,
        'chosen', r.chosen, 'correct', r.correct, 'points_awarded', r.points_awarded, 'feedback', r.feedback,
        'right_options', case when a.shown then k.correct end) order by qq.ordinal)
      from learning.quiz_questions qq
      join learning.questions qu on qu.id = qq.question_id
      join learning.question_keys k on k.question_id = qu.id
      left join learning.quiz_responses r on r.attempt_id = a.id and r.question_id = qu.id
      where qq.quiz_id = a.quiz_id
    ), '[]'::jsonb)
  from a
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------------------------------

revoke all on function api.save_question(uuid, uuid, text, text, jsonb, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_question_bank(uuid) from public, anon, authenticated, service_role;
revoke all on function api.create_quiz(uuid, text, text, integer, uuid) from public, anon, authenticated, service_role;
revoke all on function api.update_quiz(uuid, text, text, integer, jsonb) from public, anon, authenticated, service_role;
revoke all on function api.publish_quiz(uuid) from public, anon, authenticated, service_role;
revoke all on function api.archive_quiz(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_quizzes() from public, anon, authenticated, service_role;
revoke all on function api.get_quiz(uuid) from public, anon, authenticated, service_role;
revoke all on function api.list_my_quizzes() from public, anon, authenticated, service_role;
revoke all on function api.get_my_quiz(uuid) from public, anon, authenticated, service_role;
revoke all on function api.start_quiz_attempt(uuid) from public, anon, authenticated, service_role;
revoke all on function api.submit_quiz_attempt(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function api.get_my_quiz_attempt(uuid) from public, anon, authenticated, service_role;

grant execute on function api.save_question(uuid, uuid, text, text, jsonb, text, text, uuid) to authenticated;
grant execute on function api.list_question_bank(uuid) to authenticated;
grant execute on function api.create_quiz(uuid, text, text, integer, uuid) to authenticated;
grant execute on function api.update_quiz(uuid, text, text, integer, jsonb) to authenticated;
grant execute on function api.publish_quiz(uuid) to authenticated;
grant execute on function api.archive_quiz(uuid) to authenticated;
grant execute on function api.list_quizzes() to authenticated;
grant execute on function api.get_quiz(uuid) to authenticated;
grant execute on function api.list_my_quizzes() to authenticated;
grant execute on function api.get_my_quiz(uuid) to authenticated;
grant execute on function api.start_quiz_attempt(uuid) to authenticated;
grant execute on function api.submit_quiz_attempt(uuid, jsonb) to authenticated;
grant execute on function api.get_my_quiz_attempt(uuid) to authenticated;
