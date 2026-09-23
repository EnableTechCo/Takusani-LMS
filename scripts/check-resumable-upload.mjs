// Spike X-5 as a standing check (ADR-007; design register G3): a 25 MB evidence file uploaded straight to private
// Storage with the learner's own session, interrupted part way, resumed, then finalised.
//
//   node scripts/check-resumable-upload.mjs local      local stack
//   node scripts/check-resumable-upload.mjs staging    staging (uses the staging test learner)
//
// What it proves, and why each part matters:
//   * The browser needs no service key: the storage policy lets a learner write exactly the object key their
//     unexpired, unfinalised intent names, and nothing else.
//   * A broken connection does not start the upload again: TUS resumes from the offset Storage reports.
//   * Finalisation reads the real size and type from Storage's metadata, so a smaller or different file than the
//     one declared is caught. It also records which integrity fields Storage exposes (no content hash: ADR-007).
// The refusals that need a clock or a tampered intent (expired, too large, wrong type) are database tests:
// supabase/tests/database/0010_uploads.test.sql.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";

const target = process.argv[2];
const verbose = process.argv.includes("--verbose");
if (!["local", "staging"].includes(target)) {
  console.error("Usage: check-resumable-upload.mjs local|staging");
  process.exit(2);
}

function localEnv() {
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

const LEARNER = "learner@takusani.test";
const MEGABYTE = 1024 * 1024;
const FILE_BYTES = 25 * MEGABYTE;

const admin = createClient(url, secret, { auth: { persistSession: false } });

/** Only the `api` schema is exposed (ADR-024), so a client that calls our functions must ask for it by name. */
const apiClient = (token) =>
  createClient(url, publishable, {
    auth: { persistSession: false },
    db: { schema: "api" },
    global: { headers: { authorization: `Bearer ${token}` } },
  });

/** Signs the learner in without a password, the way the other checks do. */
async function learnerSession() {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: LEARNER });
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

/** A published task the learner is the audience for, created through the API as the facilitator would. */
async function publishedTaskId(learnerToken) {
  const learner = apiClient(learnerToken);
  const { data, error } = await learner.rpc("list_my_tasks");
  if (error) throw new Error(`api.list_my_tasks failed: ${error.message}`);
  if (!data?.length) {
    throw new Error(
      `${LEARNER} has no published task. Publish one first (Teaching, then Tasks), or run this after the task test data exists.`,
    );
  }
  return data[0].id;
}

/**
 * Uploads with TUS, aborting once `abortAfter` bytes have gone up, then resuming from the offset Storage reports.
 * Returns how many bytes the second attempt had to send.
 */
function upload({ token, objectKey, body, mediaType, abortAfter }) {
  const endpoint = `${url}/storage/v1/upload/resumable`;
  const options = {
    endpoint,
    headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    chunkSize: 6 * MEGABYTE, // Supabase requires 6 MB chunks on the resumable endpoint.
    metadata: { bucketName: "submissions", objectName: objectKey, contentType: mediaType },
  };

  let uploadUrl = null;
  let sentBeforeBreak = 0;

  const first = new Promise((resolve, reject) => {
    const attempt = new tus.Upload(body, {
      ...options,
      onAfterResponse: (_, response) => {
        uploadUrl ??= response.getHeader("Location") ?? null;
      },
      onProgress: (sent) => {
        sentBeforeBreak = sent;
        if (abortAfter && sent >= abortAfter) attempt.abort().then(() => resolve({ broken: true }));
      },
      onSuccess: () => resolve({ broken: false }),
      onError: reject,
    });
    attempt.start();
  });

  return first.then(async (outcome) => {
    if (!outcome.broken) return { resumedFrom: 0, sentBeforeBreak };
    // The connection died. A new upload object with the same fingerprint asks Storage where it got to.
    let firstOffsetAfterResume = null;
    await new Promise((resolve, reject) => {
      const attempt = new tus.Upload(body, {
        ...options,
        uploadUrl,
        onProgress: (sent) => {
          firstOffsetAfterResume ??= sent;
        },
        onSuccess: resolve,
        onError: reject,
      });
      attempt.start();
    });
    return { resumedFrom: sentBeforeBreak, firstOffsetAfterResume };
  });
}

const checks = [];
const record = (name, ok, detail = "") => checks.push({ name, ok, detail });

async function main() {
  const token = await learnerSession();
  const learner = apiClient(token);
  const taskId = await publishedTaskId(token);

  // A 25 MB file of stable, non-compressible bytes, and its checksum, as a browser would declare it.
  const body = Buffer.alloc(FILE_BYTES);
  for (let at = 0; at < FILE_BYTES; at += 4096) body.writeUInt32LE(at, at);
  const sha256 = createHash("sha256").update(body).digest("hex");
  const clientUploadId = randomUUID();

  // 1. Authorise
  const { data: authorised, error: authError } = await learner.rpc("authorise_upload", {
    p_context_type: "task_submission",
    p_context_id: taskId,
    p_filename: "workplace-records-portfolio.pdf",
    p_media_type: "application/pdf",
    p_bytes: FILE_BYTES,
    p_sha256: sha256,
    p_client_upload_id: clientUploadId,
  });
  if (authError) throw new Error(`api.authorise_upload failed: ${authError.message}`);
  const intent = authorised[0];
  record("the learner is authorised to upload for their task", intent.status === "ok", intent.status);
  record(
    "the object key is random and carries no file name",
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/.test(intent.object_key),
    intent.object_key,
  );

  // A retry of the same authorisation must not mint a second key.
  const { data: retried } = await learner.rpc("authorise_upload", {
    p_context_type: "task_submission",
    p_context_id: taskId,
    p_filename: "workplace-records-portfolio.pdf",
    p_media_type: "application/pdf",
    p_bytes: FILE_BYTES,
    p_sha256: sha256,
    p_client_upload_id: clientUploadId,
  });
  record("a retried authorisation returns the same intent", retried?.[0]?.object_key === intent.object_key);

  // 2. Nothing may be submitted before the file is there.
  const { data: early } = await learner.rpc("finalise_upload", { p_intent_id: intent.intent_id });
  record("finalising before the file arrives is refused", early?.[0]?.status === "not_uploaded", early?.[0]?.status);

  // 3. A key nobody authorised is refused by Storage itself.
  const strayKey = `${taskId}/${randomUUID()}/${randomUUID()}.pdf`;
  const stray = await upload({ token, objectKey: strayKey, body: Buffer.alloc(1024), mediaType: "application/pdf" })
    .then(() => null)
    .catch((error) => error);
  record(
    "an object key nobody authorised is refused",
    stray !== null,
    stray ? String(stray).slice(0, 120) : "uploaded",
  );

  // 4. The real thing: 25 MB, interrupted at about 40%, then resumed.
  const started = Date.now();
  const outcome = await upload({
    token,
    objectKey: intent.object_key,
    body,
    mediaType: "application/pdf",
    abortAfter: Math.floor(FILE_BYTES * 0.4),
  });
  record(
    "the upload was interrupted part way",
    outcome.resumedFrom > 0,
    `${(outcome.resumedFrom / MEGABYTE).toFixed(1)} MB sent before the break`,
  );
  // Storage resumes from the last whole chunk it stored, which is behind what the client had put on the wire: the
  // part-sent chunk at the moment the connection died is not counted. What matters is that it is not back at zero.
  record(
    "it carried on from the last chunk Storage had stored, not from the beginning",
    outcome.firstOffsetAfterResume > 0 && outcome.firstOffsetAfterResume < FILE_BYTES,
    `resumed at ${(outcome.firstOffsetAfterResume / MEGABYTE).toFixed(1)} MB of 25 MB, after the client had sent ${(
      outcome.resumedFrom / MEGABYTE
    ).toFixed(1)} MB`,
  );

  // 5. Finalise: Storage's own metadata is the authority.
  const { data: finalised, error: finaliseError } = await learner.rpc("finalise_upload", {
    p_intent_id: intent.intent_id,
  });
  if (finaliseError) throw new Error(`api.finalise_upload failed: ${finaliseError.message}`);
  const file = finalised[0];
  record("finalisation accepts the resumed upload", file.status === "ok", file.status);
  record(
    "the whole 25 MB arrived, byte for byte the declared size",
    Number(file.bytes) === FILE_BYTES,
    `${file.bytes} bytes`,
  );
  record("the type comes from Storage, not the browser", file.media_type === "application/pdf", file.media_type);

  const { data: listed } = await learner.rpc("list_my_uploads", { p_task_id: taskId });
  record(
    "the file is listed for the learner's next submission",
    listed?.some((row) => row.file_id === file.file_id),
  );

  const { data: again } = await learner.rpc("finalise_upload", { p_intent_id: intent.intent_id });
  record(
    "finalising twice returns the same file, not a second one",
    again?.[0]?.status === "already_finalised",
    again?.[0]?.status,
  );

  // 6. What Storage exposes about the object: the integrity fields G3 asked us to record.
  const { data: metadata } = await admin.storage.from("submissions").list(intent.object_key.replace(/\/[^/]+$/, ""), {
    search: intent.object_key.split("/").pop(),
  });
  const fields = metadata?.[0]?.metadata ?? {};
  record("Storage reports the size", typeof fields.size === "number", `size=${fields.size}`);
  record(
    "Storage exposes no content hash, so the checksum stays declared",
    !("sha256" in fields) && !("checksum" in fields),
    Object.keys(fields).join(", "),
  );

  // Leave nothing behind: on staging this would otherwise add 25 MB to the bucket on every run.
  const { error: removeError } = await admin.storage.from("submissions").remove([intent.object_key]);
  record("the check removes the file it uploaded", !removeError, removeError?.message ?? "");

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const failed = checks.filter((check) => !check.ok).length;
  for (const check of checks) {
    const detail = !check.ok || verbose ? `  -> ${check.detail}` : "";
    console.log(`${check.ok ? "pass" : "FAIL"}  ${check.name}${detail}`);
  }
  console.log(`\nStorage metadata fields: ${Object.keys(fields).join(", ") || "none"}`);
  console.log(`25 MB with one interruption took ${seconds}s against ${target}.`);
  console.log(`\n${checks.length - failed} of ${checks.length} checks passed against ${target}.`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
