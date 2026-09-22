-- Local development accounts, loaded by `supabase db reset` (config.toml [db.seed]). Never applied to staging or
-- production: `supabase db push` does not run seed files. Staging accounts come from scripts/provision-accounts.mjs.
--
-- Every account signs in with the password below. It only exists in local databases.
--   Password: takusani-local-password
--
--   learner@takusani.test        Learner            -> /learn
--   facilitator@takusani.test    Facilitator        -> /home, Teaching
--   assessor@takusani.test       Assessor           -> /home, Assessing
--   moderator@takusani.test      Moderator          -> /home, Moderating
--   coordinator@takusani.test    Coordinator        -> /home, Coordinating
--   admin@takusani.test          Administrator      -> /home, Administration (can create accounts)
--   staff@takusani.test          Facilitator, assessor, moderator and coordinator -> /home, four workspaces

do $seed$
declare
  v_password text := extensions.crypt('takusani-local-password', extensions.gen_salt('bf'));
  v_account record;
  v_role text;
begin
  for v_account in
    select * from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'learner@takusani.test', 'Lerato Mokoena', array['learner'], 'KSI-2026-0417'),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'facilitator@takusani.test', 'Pieter van Wyk', array['facilitator'], null),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'assessor@takusani.test', 'Nomsa Dlamini', array['assessor'], null),
      ('00000000-0000-4000-8000-000000000004'::uuid, 'moderator@takusani.test', 'Thabo Nkosi', array['moderator'], null),
      ('00000000-0000-4000-8000-000000000005'::uuid, 'coordinator@takusani.test', 'Ayesha Patel', array['coordinator'], null),
      ('00000000-0000-4000-8000-000000000006'::uuid, 'admin@takusani.test', 'Sipho Mahlangu', array['administrator'], null),
      ('00000000-0000-4000-8000-000000000007'::uuid, 'staff@takusani.test', 'Zanele Khumalo',
        array['facilitator', 'assessor', 'moderator', 'coordinator'], null)
    ) as a(id, email, full_name, roles, learner_number)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_account.id, 'authenticated', 'authenticated', v_account.email,
      v_password, now(), '{"provider": "email", "providers": ["email"]}', '{}', now(), now(), '', '', '', ''
    );

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_account.id, v_account.id::text,
      jsonb_build_object('sub', v_account.id::text, 'email', v_account.email, 'email_verified', true),
      'email', now(), now(), now()
    );

    insert into identity.profiles (id, full_name, learner_number)
    values (v_account.id, v_account.full_name, v_account.learner_number);

    foreach v_role in array v_account.roles loop
      insert into identity.role_assignments (profile_id, role) values (v_account.id, v_role);
    end loop;
  end loop;
end
$seed$;
