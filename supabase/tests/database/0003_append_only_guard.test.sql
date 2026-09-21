-- The append-only guard refuses UPDATE, DELETE and TRUNCATE, including for the table owner, which is the
-- case privilege revocation alone cannot cover (service_role, SECURITY DEFINER functions).
create extension if not exists pgtap with schema extensions;

begin;
select plan(5);

create table audit.zz_append_only (id integer primary key, note text);
create trigger zz_append_only_row before update or delete on audit.zz_append_only
  for each row execute function audit.forbid_mutation();
create trigger zz_append_only_truncate before truncate on audit.zz_append_only
  for each statement execute function audit.forbid_mutation();

select lives_ok($$ insert into audit.zz_append_only values (1, 'first') $$, 'insert is allowed');
select throws_ok($$ update audit.zz_append_only set note = 'changed' where id = 1 $$, '42501', null, 'update is refused');
select throws_ok($$ delete from audit.zz_append_only where id = 1 $$, '42501', null, 'delete is refused');
select throws_ok($$ truncate audit.zz_append_only $$, '42501', null, 'truncate is refused');
select ok(not has_function_privilege('authenticated', 'audit.forbid_mutation()', 'EXECUTE'), 'the guard function is not callable by authenticated');

select * from finish();
rollback;
