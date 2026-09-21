create extension if not exists pgtap with schema extensions;

begin;
select plan(28);

select ok(has_schema_privilege('anon', 'api', 'USAGE'), 'anon may use the exposed api schema');
select ok(has_schema_privilege('authenticated', 'api', 'USAGE'), 'authenticated may use the exposed api schema');

select ok(not has_schema_privilege('anon', 'identity', 'USAGE'), 'anon cannot use identity');
select ok(not has_schema_privilege('anon', 'programmes', 'USAGE'), 'anon cannot use programmes');
select ok(not has_schema_privilege('anon', 'learning', 'USAGE'), 'anon cannot use learning');
select ok(not has_schema_privilege('anon', 'submissions', 'USAGE'), 'anon cannot use submissions');
select ok(not has_schema_privilege('anon', 'exams', 'USAGE'), 'anon cannot use exams');
select ok(not has_schema_privilege('anon', 'assessment', 'USAGE'), 'anon cannot use assessment');
select ok(not has_schema_privilege('anon', 'moderation', 'USAGE'), 'anon cannot use moderation');
select ok(not has_schema_privilege('anon', 'appeals', 'USAGE'), 'anon cannot use appeals');
select ok(not has_schema_privilege('anon', 'credits', 'USAGE'), 'anon cannot use credits');
select ok(not has_schema_privilege('anon', 'notifications', 'USAGE'), 'anon cannot use notifications');
select ok(not has_schema_privilege('anon', 'reporting', 'USAGE'), 'anon cannot use reporting');
select ok(not has_schema_privilege('anon', 'department', 'USAGE'), 'anon cannot use department');
select ok(not has_schema_privilege('anon', 'audit', 'USAGE'), 'anon cannot use audit');

select ok(not has_schema_privilege('authenticated', 'identity', 'USAGE'), 'authenticated cannot use identity');
select ok(not has_schema_privilege('authenticated', 'programmes', 'USAGE'), 'authenticated cannot use programmes');
select ok(not has_schema_privilege('authenticated', 'learning', 'USAGE'), 'authenticated cannot use learning');
select ok(not has_schema_privilege('authenticated', 'submissions', 'USAGE'), 'authenticated cannot use submissions');
select ok(not has_schema_privilege('authenticated', 'exams', 'USAGE'), 'authenticated cannot use exams');
select ok(not has_schema_privilege('authenticated', 'assessment', 'USAGE'), 'authenticated cannot use assessment');
select ok(not has_schema_privilege('authenticated', 'moderation', 'USAGE'), 'authenticated cannot use moderation');
select ok(not has_schema_privilege('authenticated', 'appeals', 'USAGE'), 'authenticated cannot use appeals');
select ok(not has_schema_privilege('authenticated', 'credits', 'USAGE'), 'authenticated cannot use credits');
select ok(not has_schema_privilege('authenticated', 'notifications', 'USAGE'), 'authenticated cannot use notifications');
select ok(not has_schema_privilege('authenticated', 'reporting', 'USAGE'), 'authenticated cannot use reporting');
select ok(not has_schema_privilege('authenticated', 'department', 'USAGE'), 'authenticated cannot use department');
select ok(not has_schema_privilege('authenticated', 'audit', 'USAGE'), 'authenticated cannot use audit');

select * from finish();
rollback;
