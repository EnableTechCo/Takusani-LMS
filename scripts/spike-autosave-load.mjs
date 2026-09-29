// Spike X-3 (S5-01; ADR-023, ADR-027), throwaway: can a one-function autosave keep p95 at or under 500 ms for 250
// clients? Simulates exam clients against /api/spike/autosave, each with its own attempt, starting over a ramp and
// then saving a batch of changed answers every 10 seconds with jitter, as ADR-023 specifies.
//
//   node --env-file=.env.local scripts/spike-autosave-load.mjs --target staging --base https://takusani-lms.vercel.app
//   node --env-file=.env.local scripts/spike-autosave-load.mjs --target local --base http://localhost:3000 --clients 20
//
// Signs in learner@takusani.test with a one-time link made with the secret key (no password), and sends the session
// as the cookies a browser would, so each request takes the real path: the proxy's session check, the handler's claim
// check and one database call. Reads STAGING_SUPABASE_URL, STAGING_SUPABASE_PUBLISHABLE_KEY and
// STAGING_SUPABASE_SECRET_KEY for staging; NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
// SUPABASE_SECRET_KEY for local. For a protected Vercel preview (the Cape Town run), set
// VERCEL_AUTOMATION_BYPASS_SECRET and it is sent as Vercel's bypass header. Prints a summary and writes every sample
// to --out.
import { writeFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (pairs, arg, index, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[index + 1]]] : pairs),
      [],
    ),
);
const target = args.target ?? "local";
const base = (args.base ?? "http://localhost:3000").replace(/\/$/, "");
const clients = Number(args.clients ?? 250);
const seconds = Number(args.seconds ?? 180);
const ramp = Number(args.ramp ?? 60);
const interval = Number(args.interval ?? 10);
const out = args.out ?? `spike-autosave-${target}-${Date.now()}.json`;
const email = args.email ?? "learner@takusani.test";

const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};
const url = env(target === "staging" ? "STAGING_SUPABASE_URL" : "NEXT_PUBLIC_SUPABASE_URL");
const publishable = env(
  target === "staging" ? "STAGING_SUPABASE_PUBLISHABLE_KEY" : "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);
const secret = env(target === "staging" ? "STAGING_SUPABASE_SECRET_KEY" : "SUPABASE_SECRET_KEY");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
const percentile = (values, p) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};
const summary = (values) => ({
  n: values.length,
  p50: percentile(values, 50),
  p95: percentile(values, 95),
  p99: percentile(values, 99),
  max: values.length ? Math.max(...values) : null,
});
const round = (value) => (value === null ? null : Math.round(value));
const serverTiming = (header, name) => {
  const match = new RegExp(`${name};dur=([0-9.]+)`).exec(header ?? "");
  return match ? Number(match[1]) : null;
};

// 1. A session for the test account, without a password.
const admin = createClient(url, secret, { auth: { persistSession: false } });
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (linkError) throw linkError;
const anon = createClient(url, publishable, { auth: { persistSession: false } });
const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
  token_hash: link.properties.hashed_token,
  type: "magiclink",
});
if (verifyError) throw verifyError;
const session = verified.session;

// 2. The session as the browser's cookies.
const jar = new Map();
const ssr = createServerClient(url, publishable, {
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
  },
});
await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

// 3. One attempt per client.
const user = createClient(url, publishable, {
  auth: { persistSession: false },
  db: { schema: "api" },
  global: { headers: { Authorization: `Bearer ${session.access_token}` } },
});
const { data: attempts, error: prepareError } = await user.rpc("spike_prepare", {
  p_count: clients,
  p_minutes: Math.ceil((seconds + ramp) / 60) + 5,
});
if (prepareError) throw prepareError;
if (!attempts || attempts.length !== clients)
  throw new Error(`prepared ${attempts?.length ?? 0} of ${clients} attempts`);

// 4. Baseline: the same path without the database call.
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
  : {};
const endpoint = `${base}/api/spike/autosave`;
const baseline = [];
for (let i = 0; i < 30; i++) {
  const start = performance.now();
  const response = await fetch(endpoint, { headers: { cookie, ...bypass } });
  await response.arrayBuffer();
  if (response.status !== 204)
    throw new Error(`baseline got ${response.status}: is the route deployed, and the session accepted?`);
  if (i > 0) baseline.push(performance.now() - start); // the first pays for the connection
}

// 5. The load.
const words = "the learner writes a considered answer about records retention and filing under pressure ".split(" ");
const text = (length) => Array.from({ length }, (_, i) => words[i % words.length]).join(" ");
const samples = [];
const started = performance.now();
const deadline = started + (ramp + seconds) * 1000;

async function client(index, attempt) {
  const seqs = new Map();
  await sleep(Math.random() * ramp * 1000);
  while (performance.now() < deadline) {
    const cycleStart = performance.now();
    // A batch names each changed question once, as the client will.
    const changed = new Set();
    while (changed.size < 3 + Math.floor(Math.random() * 4)) changed.add(1 + Math.floor(Math.random() * 20));
    const answers = [...changed].map((question) => {
      const seq = (seqs.get(question) ?? 0) + 1;
      seqs.set(question, seq);
      return {
        question_id: question,
        client_seq: seq,
        payload: question <= 12 ? { choice: ["a", "b", "c", "d"][seq % 4] } : { text: text(60 + seq * 20) },
      };
    });
    const start = performance.now();
    let http = 0;
    let status = "network_error";
    let timing = null;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { cookie, ...bypass, "content-type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.attempt_id, leaseId: attempt.lease_id, answers }),
      });
      http = response.status;
      timing = response.headers.get("server-timing");
      status = (await response.json().catch(() => ({ status: "bad_body" }))).status;
    } catch {
      // Counted as a failure below.
    }
    const elapsed = performance.now() - start;
    samples.push({
      client: index,
      at: Math.round(start - started),
      ms: elapsed,
      http,
      status,
      auth: serverTiming(timing, "auth"),
      db: serverTiming(timing, "db"),
      steady: start - started >= ramp * 1000,
    });
    const jitter = (Math.random() * 4 - 2) * 1000;
    await sleep(interval * 1000 + jitter - (performance.now() - cycleStart));
  }
}

console.log(`${clients} clients against ${endpoint} for ${ramp}s ramp + ${seconds}s, every ${interval}s ± 2s ...`);
await Promise.all(attempts.map((attempt, index) => client(index, attempt)));

// 6. Clean up and report.
await user.rpc("spike_cleanup");
const ok = samples.filter((sample) => sample.status === "ok");
const steady = ok.filter((sample) => sample.steady);
const report = {
  target,
  endpoint,
  clients,
  seconds,
  ramp,
  interval,
  at: new Date().toISOString(),
  requests: samples.length,
  success_rate: samples.length ? ok.length / samples.length : 0,
  failures: Object.entries(
    samples
      .filter((sample) => sample.status !== "ok")
      .reduce((counts, sample) => {
        const key = `${sample.http} ${sample.status}`;
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
  ),
  baseline_ms: summary(baseline),
  autosave_ms: summary(ok.map((sample) => sample.ms)),
  autosave_steady_ms: summary(steady.map((sample) => sample.ms)),
  server_auth_ms: summary(ok.map((sample) => sample.auth).filter((value) => value !== null)),
  server_db_ms: summary(ok.map((sample) => sample.db).filter((value) => value !== null)),
};
writeFileSync(out, JSON.stringify({ report, samples }, null, 1));
const line = (label, s) =>
  console.log(
    `${label.padEnd(26)} n=${String(s.n).padStart(5)}  p50=${round(s.p50)}  p95=${round(s.p95)}  p99=${round(s.p99)}  max=${round(s.max)}`,
  );
console.log(`requests ${report.requests}, success ${(report.success_rate * 100).toFixed(2)}%`, report.failures);
line("baseline (no database)", report.baseline_ms);
line("autosave, all", report.autosave_ms);
line("autosave, after the ramp", report.autosave_steady_ms);
line("server: claim check", report.server_auth_ms);
line("server: database call", report.server_db_ms);
console.log(`samples written to ${out}`);
