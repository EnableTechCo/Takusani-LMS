"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MAX_INTAKE_BYTES, readIntake } from "./intake";
import { authUserOutcome } from "./import-rules";

/**
 * Bulk learner import (S2-01, FR-103; flow G). Upload checks the file and records every row with nothing created;
 * import then runs a chunk of up to 100 rows per call, which the batch page repeats until nothing is left.
 */

const FILE_PROBLEMS: Record<string, string> = {
  empty: "The file has no learners in it. Add one row per learner under the header.",
  unreadable: 'The file could not be read as a CSV. Save it from your spreadsheet as "CSV (comma delimited)".',
  too_many_rows: "The file has more than 5,000 learners. Split it into smaller files.",
};

const BATCH_REFUSALS: Record<string, string> = {
  forbidden: "Only an administrator can import learners.",
  unauthenticated: "Your session has ended. Sign in again.",
  cohort_not_found: "Choose an active cohort.",
  invalid_file: "The file could not be read. Try again.",
  no_rows: FILE_PROBLEMS.empty,
  too_many_rows: FILE_PROBLEMS.too_many_rows,
};

export interface UploadState extends FormState {
  /** The same file was imported before: the earlier batch, so the page can link to it (flow G, E2). */
  duplicate?: { batchId: string; reference: string; createdAt: string; uploadedBy: string };
}

export async function uploadIntake(_: UploadState, form: FormData): Promise<UploadState> {
  const cohortId = String(form.get("cohortId") ?? "");
  const file = form.get("file");
  const values = { cohortId };
  if (!cohortId) return { errors: { cohortId: "Choose the cohort to enrol these learners in." }, values };
  if (!(file instanceof File) || file.size === 0) return { errors: { file: "Choose the CSV file to import." }, values };
  if (!/\.csv$/i.test(file.name)) {
    return { errors: { file: 'Choose a CSV file. In your spreadsheet, save as "CSV (comma delimited)".' }, values };
  }
  if (file.size > MAX_INTAKE_BYTES)
    return { errors: { file: "The file is larger than 900 KB. Split it into smaller files." }, values };

  const bytes = Buffer.from(await file.arrayBuffer());
  const read = readIntake(bytes.toString("utf8"));
  if (!read.ok) {
    const message =
      read.problem === "missing_columns"
        ? `The file has no ${read.detail} column. The first row must name the columns: full_name, email, and optionally learner_number.`
        : FILE_PROBLEMS[read.problem];
    return { errors: { file: message }, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_import_batch", {
    p_cohort_id: cohortId,
    p_file_name: file.name,
    p_file_digest: createHash("sha256").update(bytes).digest("hex"),
    p_rows: read.rows,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status === "duplicate_file") {
    const detail = row!.detail as { reference: string; created_at: string; uploaded_by: string };
    return {
      values,
      duplicate: {
        batchId: row!.batch_id,
        reference: detail.reference,
        createdAt: detail.created_at,
        uploadedBy: detail.uploaded_by,
      },
    };
  }
  if (status !== "ok")
    return { message: BATCH_REFUSALS[status] ?? "The file could not be checked. Try again.", values };

  revalidatePath("/admin/imports");
  redirect(`/admin/imports/${row!.batch_id}`);
}

export type ChunkResult =
  { ok: true; claimed: number; imported: number; failed: number; remaining: number } | { ok: false; message: string };

/** What the Auth admin API said about one account. */
type Created = { row: number; error: string | null; retry?: boolean };

/** The auth user for one row, created without an invitation (email is off until go-live). */
async function createAuthUser(
  admin: ReturnType<typeof createAdminClient>,
  row: { row_number: number; full_name: string; email: string },
): Promise<Created> {
  try {
    const { error } = await admin.auth.admin.createUser({
      email: row.email,
      email_confirm: true,
      user_metadata: { full_name: row.full_name },
    });
    return { row: row.row_number, ...authUserOutcome(error) };
  } catch (thrown) {
    return { row: row.row_number, error: (thrown as Error).message.slice(0, 300), retry: true };
  }
}

/** Runs `work` over `items`, at most `limit` at a time, keeping the order of results. */
async function inPool<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * One chunk: claim up to 100 ready rows, create their auth users (ten at a time), then create the profiles, roles and
 * enrolments in one transaction. No invitation is sent: email is off until go-live. Safe to repeat.
 */
export async function importNextChunk(batchId: string): Promise<ChunkResult> {
  const supabase = await createClient();
  const { data: claimed, error } = await supabase.rpc("claim_import_chunk", { p_batch_id: batchId, p_size: 100 });
  if (error) return { ok: false, message: "The next group could not be started. Try again." };
  if (!claimed || claimed.length === 0) {
    const { data } = await supabase.rpc("complete_import_chunk", { p_batch_id: batchId, p_results: [] });
    const done = data?.[0];
    return { ok: true, claimed: 0, imported: 0, failed: 0, remaining: done?.remaining ?? 0 };
  }

  const admin = createAdminClient();
  const results = await inPool(claimed, 10, (row) => createAuthUser(admin, row));
  const { data, error: completeError } = await supabase.rpc("complete_import_chunk", {
    p_batch_id: batchId,
    p_results: results,
  });
  const done = data?.[0];
  if (completeError || done?.status !== "ok") {
    // Hand the rows straight back, so "Try again" works now rather than after the five minutes a lost chunk waits.
    // Best effort: if the database cannot be reached, the rows are claimed again once those minutes pass.
    await supabase.rpc("complete_import_chunk", {
      p_batch_id: batchId,
      p_results: claimed.map((row) => ({ row: row.row_number, error: "interrupted", retry: true })),
    });
    const first = claimed[0].row_number;
    const last = claimed[claimed.length - 1].row_number;
    return {
      ok: false,
      message: `Rows ${first} to ${last} could not be imported, and no learner in that group was added. Try again: rows already imported are skipped.`,
    };
  }
  revalidatePath(`/admin/imports/${batchId}`);
  return {
    ok: true,
    claimed: claimed.length,
    imported: done.imported,
    failed: done.failed,
    remaining: done.remaining,
  };
}

/** "Cancel and fix the file first": only before anything is imported. */
export async function cancelImport(form: FormData): Promise<void> {
  const batchId = String(form.get("batchId") ?? "");
  const supabase = await createClient();
  await supabase.rpc("cancel_import_batch", { p_batch_id: batchId });
  revalidatePath("/admin/imports");
  redirect("/admin/imports");
}
