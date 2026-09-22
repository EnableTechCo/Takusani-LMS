// Spike X-1 as a standing check (ADR-024; design register E1 to E3): what can a browser reach through the
// Supabase Data API with only the publishable key, and with a signed-in learner's token?
//
//   node scripts/check-data-api-exposure.mjs local      local stack (creates and removes probe functions)
//   node scripts/check-data-api-exposure.mjs staging    staging (read-only: no probes are created)
//
// Local reads API_URL, PUBLISHABLE_KEY and SECRET_KEY from `supabase status -o env`. Staging reads
// STAGING_SUPABASE_URL, STAGING_SUPABASE_PUBLISHABLE_KEY and STAGING_SUPABASE_SECRET_KEY (.env.local).
// The secret key is used only to mint a one-time sign-in for learner@takusani.test; no password is involved.
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const target = process.argv[2];
const verbose = process.argv.includes("--verbose");
if (!["local", "staging"].includes(target)) {
  console.error("Usage: check-data-api-exposure.mjs local|staging");
  process.exit(2);
}

function localEnv() {
  // CI has the CLI binary on the PATH (SUPABASE_CLI=supabase); locally it comes from node_modules.
  const cli = process.env.SUPABASE_CLI ?? "npx supabase";
  const out = execFileSync(`${cli} status -o env`, { encoding: "utf8", shell: true });
  const env = Object.fromEntries(
    out
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
  return { url: env.API_URL, publishable: env.PUBLISHABLE_KEY, secret: env.SECRET_KEY };
}

const { url, publishable, secret } =
  target === "local"
    ? localEnv()
    : {
        url: process.env.STAGING_SUPABASE_URL,
        publishable: process.env.STAGING_SUPABASE_PUBLISHABLE_KEY,
        secret: process.env.STAGING_SUPABASE_SECRET_KEY,
      };
if (!url || !publishable || !secret) {
  console.error(`Missing settings for ${target}: need the API URL, publishable key and secret key.`);
  process.exit(2);
}

// Local only: probe functions a careless migration might create. They are dropped again at the end.
const PROBES_UP = `
  create function public.x1_probe() returns text language sql as $$ select 'reached public' $$;
  grant execute on function public.x1_probe() to anon, authenticated;
  create function identity.x1_probe() returns text language sql as $$ select 'reached identity' $$;
  grant usage on schema identity to authenticated;
  grant execute on function identity.x1_probe() to authenticated;
  create function api.x1_probe() returns text language sql as $$ select 'reached api without a grant' $$;
  notify pgrst, 'reload schema';`;
const PROBES_DOWN = `
  drop function if exists public.x1_probe();
  drop function if exists identity.x1_probe();
  revoke usage on schema identity from authenticated;
  drop function if exists api.x1_probe();
  notify pgrst, 'reload schema';`;

function sql(statements) {
  execFileSync("docker", ["exec", "-i", "supabase_db_LMS", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], {
    input: statements,
    stdio: ["pipe", "ignore", "inherit"],
  });
}

async function learnerToken() {
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: "learner@takusani.test" });
  if (error) throw new Error(`could not mint a learner session: ${error.message}`);
  const response = await fetch(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: publishable, "content-type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: data.properties.hashed_token }),
  });
  const session = await response.json();
  if (!session.access_token) throw new Error(`could not mint a learner session: HTTP ${response.status}`);
  return session.access_token;
}

async function call({ path, method = "POST", profile, token, body = {} }) {
  const headers = { apikey: publishable, "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (profile) headers[method === "GET" ? "accept-profile" : "content-profile"] = profile;
  const response = await fetch(`${url}${path}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, payload };
}

// A refusal must be for the right reason, so a check cannot pass by accident (for example "not found" because the
// schema cache was stale): the schema is not exposed at all, or the role lacks EXECUTE.
const notExposed = (r) => r.status === 406 && r.payload?.code === "PGRST106";
const denied = (r) => (r.status === 401 || r.status === 403) && r.payload?.code === "42501";
const rpc = (name) => `/rest/v1/rpc/${name}`;

async function main() {
  const probes = target === "local";
  if (probes) sql(PROBES_UP);
  await new Promise((resolve) => setTimeout(resolve, probes ? 1500 : 0)); // let PostgREST reload its schema cache

  const learner = await learnerToken();
  const checks = [
    // What must work
    [
      "anon calls api.health_check (allow-listed)",
      { path: rpc("health_check") },
      (r) => r.status === 200 && r.payload === true,
    ],
    [
      "learner reads their own access",
      { path: rpc("my_access"), token: learner },
      (r) => r.status === 200 && r.payload?.[0]?.roles?.includes("learner"),
    ],
    // Anonymous callers
    ["anon cannot read access", { path: rpc("my_access") }, denied],
    ["anon cannot list accounts", { path: rpc("list_accounts") }, denied],
    // Signed-in learner, inside api: functions refuse or return nothing
    [
      "learner lists no accounts",
      { path: rpc("list_accounts"), token: learner },
      (r) => r.status === 200 && r.payload.length === 0,
    ],
    [
      "learner lists no audit entries",
      { path: rpc("list_audit_events"), token: learner },
      (r) => r.status === 200 && r.payload.length === 0,
    ],
    [
      "learner lists no cohorts",
      { path: rpc("list_cohorts"), token: learner },
      (r) => r.status === 200 && r.payload.length === 0,
    ],
    [
      "learner cannot create an account",
      {
        path: rpc("create_account"),
        token: learner,
        body: { p_user_id: "00000000-0000-4000-8000-000000000099", p_full_name: "X", p_role: "administrator" },
      },
      (r) => r.status === 200 && r.payload?.[0]?.status === "forbidden",
    ],
    [
      "learner cannot call the service-only provisioning",
      {
        path: rpc("provision_role"),
        token: learner,
        body: { p_user_id: "00000000-0000-4000-8000-000000000001", p_role: "administrator" },
      },
      denied,
    ],
    // Unexposed schemas: tables and functions are unreachable whatever the grants say
    [
      "learner cannot read identity tables",
      { path: "/rest/v1/profiles", method: "GET", profile: "identity", token: learner },
      notExposed,
    ],
    [
      "learner cannot read the audit log table",
      { path: "/rest/v1/events", method: "GET", profile: "audit", token: learner },
      notExposed,
    ],
    [
      "learner cannot call audit.append",
      {
        path: rpc("append"),
        profile: "audit",
        token: learner,
        body: { p_action: "x.y", p_object_type: "x", p_object_id: "x" },
      },
      notExposed,
    ],
    // Any name will do: an unexposed schema is refused before PostgREST looks for the function (ADR-028 keeps it empty).
    ["anon cannot reach the public schema", { path: rpc("any_function"), profile: "public" }, notExposed],
    [
      "learner cannot reach the public schema",
      { path: rpc("any_function"), profile: "public", token: learner },
      notExposed,
    ],
    ["GraphQL is not exposed", { path: "/graphql/v1", token: learner, body: { query: "{ __typename }" } }, notExposed],
  ];
  if (probes) {
    checks.push(
      ["anon cannot call a public function granted to anon", { path: rpc("x1_probe"), profile: "public" }, notExposed],
      [
        "learner cannot call a public function granted to them",
        { path: rpc("x1_probe"), profile: "public", token: learner },
        notExposed,
      ],
      [
        "learner cannot call an identity function granted to them",
        { path: rpc("x1_probe"), profile: "identity", token: learner },
        notExposed,
      ],
      ["anon cannot call a new api function (no grant by default)", { path: rpc("x1_probe") }, denied],
      [
        "learner cannot call a new api function (no grant by default)",
        { path: rpc("x1_probe"), token: learner },
        denied,
      ],
    );
  }

  let failed = 0;
  try {
    for (const [name, request, pass] of checks) {
      const result = await call(request);
      const ok = pass(result);
      if (!ok) failed++;
      const code = result.payload?.code ? ` ${result.payload.code}` : "";
      const detail =
        !ok || verbose
          ? `  -> HTTP ${result.status}${code} ${ok ? "" : JSON.stringify(result.payload)?.slice(0, 160)}`
          : "";
      console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail}`);
    }
  } finally {
    if (probes) sql(PROBES_DOWN);
  }
  console.log(`\n${checks.length - failed} of ${checks.length} checks passed against ${target}.`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  if (target === "local") {
    try {
      sql(PROBES_DOWN);
    } catch {
      // the probes may never have been created
    }
  }
  console.error(error.message ?? error);
  process.exit(1);
});
