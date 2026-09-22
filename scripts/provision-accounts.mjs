// Creates the test accounts on staging: the same people and roles as supabase/seed.sql, which only runs locally.
// Safe to run again: existing accounts are left alone and only missing profiles and roles are added.
//
//   npm run accounts:staging
//
// Reads from .env.local (git-ignored): STAGING_SUPABASE_URL, STAGING_SUPABASE_SECRET_KEY and
// STAGING_TEST_ACCOUNT_PASSWORD (at least 12 characters, shared by every test account). Needs the identity
// migration applied to staging first.
import { createClient } from "@supabase/supabase-js";

export const TEST_ACCOUNTS = [
  { email: "learner@takusani.test", fullName: "Lerato Mokoena", roles: ["learner"], learnerNumber: "KSI-2026-0417" },
  { email: "facilitator@takusani.test", fullName: "Pieter van Wyk", roles: ["facilitator"] },
  { email: "assessor@takusani.test", fullName: "Nomsa Dlamini", roles: ["assessor"] },
  { email: "moderator@takusani.test", fullName: "Thabo Nkosi", roles: ["moderator"] },
  { email: "coordinator@takusani.test", fullName: "Ayesha Patel", roles: ["coordinator"] },
  { email: "admin@takusani.test", fullName: "Sipho Mahlangu", roles: ["administrator"] },
  {
    email: "staff@takusani.test",
    fullName: "Zanele Khumalo",
    roles: ["facilitator", "assessor", "moderator", "coordinator"],
  },
];

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set in .env.local`);
  return value;
}

async function findUserByEmail(admin, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user || data.users.length < 200) return user ?? null;
  }
}

async function main() {
  const url = required("STAGING_SUPABASE_URL");
  const secretKey = required("STAGING_SUPABASE_SECRET_KEY");
  const password = required("STAGING_TEST_ACCOUNT_PASSWORD");
  if (password.length < 12) throw new Error("STAGING_TEST_ACCOUNT_PASSWORD must be at least 12 characters");

  const admin = createClient(url, secretKey, { db: { schema: "api" }, auth: { persistSession: false } });

  for (const account of TEST_ACCOUNTS) {
    let user = await findUserByEmail(admin, account.email);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: account.fullName },
      });
      if (error) throw error;
      user = data.user;
    }

    const { data: created, error } = await admin.rpc("provision_account", {
      p_user_id: user.id,
      p_full_name: account.fullName,
      p_role: account.roles[0],
      p_learner_number: account.learnerNumber ?? null,
    });
    if (error) throw error;
    const status = created?.[0]?.status;
    if (status !== "ok" && status !== "already_exists") throw new Error(`${account.email}: ${status}`);

    // Every role, so a re-run also restores any that are missing; roles already held are skipped.
    for (const role of account.roles) {
      const { data: result, error: roleError } = await admin.rpc("provision_role", {
        p_user_id: user.id,
        p_role: role,
      });
      if (roleError) throw roleError;
      if (result !== "ok" && result !== "already_held") throw new Error(`${account.email} ${role}: ${result}`);
    }

    console.log(`${account.email.padEnd(28)} ${account.roles.join(", ")}`);
  }
  console.log(`\n${TEST_ACCOUNTS.length} test accounts ready. They sign in with STAGING_TEST_ACCOUNT_PASSWORD.`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
