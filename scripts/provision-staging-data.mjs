// Creates the sample teaching data a hosted environment needs before anyone can try the coursework flow:
// one programme, one cohort with the test learner enrolled, and one published task with a rubric and an
// evidence list.
//
//   npm run data:staging
//
// It goes through the ordinary API as the test accounts would, so it exercises the same authorisation rules a
// person does: nothing here uses the secret key except to mint a one-time session, and no password is typed.
// Running it again changes nothing: every step looks for what it would create first.
//
// It reads STAGING_SUPABASE_URL, STAGING_SUPABASE_PUBLISHABLE_KEY and STAGING_SUPABASE_SECRET_KEY from
// .env.local. Test accounts come first: npm run accounts:staging.
import { createClient } from "@supabase/supabase-js";

const url = process.env.STAGING_SUPABASE_URL;
const publishable = process.env.STAGING_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.STAGING_SUPABASE_SECRET_KEY;
if (!url || !publishable || !secret) {
  console.error("Missing staging settings: STAGING_SUPABASE_URL, _PUBLISHABLE_KEY and _SECRET_KEY in .env.local.");
  process.exit(2);
}

const PROGRAMME = { code: "CBA-NQF4", title: "Certificate in Business Administration", nqfLevel: 4 };
const COHORT = { name: "2026 Intake B", startsOn: "2026-07-01", endsOn: "2027-06-30" };
const LEARNER = "learner@takusani.test";
const TASK = {
  title: "Task 3: Workplace records portfolio",
  brief:
    "Collect the access register, the retention schedule and the filing index for your workplace. Hand in one PDF " +
    "for each requirement, and say in a short note where each record is kept.",
  criteria: [
    {
      title: "Records are complete",
      descriptor: "All three records are present and cover the period asked for.",
      points: 10,
    },
    {
      title: "Retention rules applied",
      descriptor: "The retention schedule is cited and matches what is kept.",
      points: 5,
    },
    {
      title: "Filing is traceable",
      descriptor: "Someone else could find a named record from the index alone.",
      points: 5,
    },
  ],
  requirements: [
    { title: "Access register", guidance: "A PDF of the register covering the last six months.", mandatory: true },
    { title: "Retention schedule", guidance: "The schedule you work to, with its version or date.", mandatory: true },
    { title: "Filing index", guidance: null, mandatory: true },
    { title: "Anything else you want considered", guidance: null, mandatory: false },
  ],
};

const admin = createClient(url, secret, { auth: { persistSession: false } });

/** A session for a test account, minted the way the checks do: a one-time link, no password. */
async function sessionFor(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`could not sign in as ${email}: ${error.message}`);
  const response = await fetch(`${url}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: publishable, "content-type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: data.properties.hashed_token }),
  });
  const session = await response.json();
  if (!session.access_token) throw new Error(`could not sign in as ${email}: HTTP ${response.status}`);
  return createClient(url, publishable, {
    auth: { persistSession: false },
    db: { schema: "api" }, // Only the api schema is exposed (ADR-024).
    global: { headers: { authorization: `Bearer ${session.access_token}` } },
  });
}

async function call(client, name, args = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`api.${name} failed: ${error.message}`);
  return data?.[0] ?? data;
}

/** A due date a month out, at 17:00 South African time, so the task can be published and stays publishable. */
function dueDate() {
  const day = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(day);
  return `${parts}T17:00:00+02:00`;
}

async function main() {
  const coordinator = await sessionFor("coordinator@takusani.test");
  const facilitator = await sessionFor("facilitator@takusani.test");

  let programme = (await call(coordinator, "list_programmes"))?.find?.((p) => p.code === PROGRAMME.code);
  if (!programme) {
    const created = await call(coordinator, "create_programme", {
      p_code: PROGRAMME.code,
      p_title: PROGRAMME.title,
      p_nqf_level: PROGRAMME.nqfLevel,
    });
    if (created.status !== "ok") throw new Error(`create_programme refused: ${created.status}`);
    programme = { id: created.programme_id, code: PROGRAMME.code, title: PROGRAMME.title };
    console.log(`programme ${PROGRAMME.code} created`);
  } else {
    console.log(`programme ${PROGRAMME.code} already there`);
  }

  const cohorts = await call(coordinator, "list_cohorts");
  let cohort = (Array.isArray(cohorts) ? cohorts : []).find((c) => c.name === COHORT.name);
  if (!cohort) {
    const created = await call(coordinator, "create_cohort", {
      p_programme_id: programme.id,
      p_name: COHORT.name,
      p_starts_on: COHORT.startsOn,
      p_ends_on: COHORT.endsOn,
    });
    if (created.status !== "ok") throw new Error(`create_cohort refused: ${created.status}`);
    cohort = { id: created.cohort_id, name: COHORT.name };
    console.log(`cohort "${COHORT.name}" created`);
  } else {
    console.log(`cohort "${COHORT.name}" already there`);
  }

  const enrolled = await call(coordinator, "enrol_learner", { p_cohort_id: cohort.id, p_email: LEARNER });
  if (!["ok", "already_enrolled"].includes(enrolled.status)) {
    throw new Error(`enrol_learner refused: ${enrolled.status}`);
  }
  console.log(`${LEARNER}: ${enrolled.status === "ok" ? "enrolled" : "already enrolled"}`);

  const tasks = await call(facilitator, "list_tasks", { p_cohort_id: cohort.id });
  let task = (Array.isArray(tasks) ? tasks : []).find((t) => t.title === TASK.title);
  if (task?.state === "published") {
    console.log(`task "${TASK.title}" already published`);
  } else {
    if (!task) {
      const created = await call(facilitator, "create_task", {
        p_cohort_id: cohort.id,
        p_title: TASK.title,
        p_brief: TASK.brief,
        p_submission_type: "file_upload",
        p_due_at: dueDate(),
        p_late_policy: "accept_and_flag",
      });
      if (created.status !== "ok") throw new Error(`create_task refused: ${created.status}`);
      task = { id: created.task_id };
      console.log(`task "${TASK.title}" drafted`);
    }
    const criteria = await call(facilitator, "set_task_criteria", { p_task_id: task.id, p_criteria: TASK.criteria });
    if (criteria.status !== "ok") throw new Error(`set_task_criteria refused: ${criteria.status}`);
    // The evidence list arrives with S2-04; skip it on an environment that does not have it yet.
    const requirements = await facilitator.rpc("set_task_requirements", {
      p_task_id: task.id,
      p_requirements: TASK.requirements,
    });
    if (requirements.error) console.log("evidence list skipped: this environment does not have S2-04 yet");
    else if (requirements.data?.[0]?.status !== "ok") {
      throw new Error(`set_task_requirements refused: ${requirements.data?.[0]?.status}`);
    }
    const published = await call(facilitator, "publish_task", { p_task_id: task.id });
    if (published.status !== "ok") throw new Error(`publish_task refused: ${published.status}`);
    console.log(`task "${TASK.title}" published to ${published.notified} learner(s)`);
  }

  console.log("\nStaging has a programme, a cohort with the test learner, and a published task.");
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
