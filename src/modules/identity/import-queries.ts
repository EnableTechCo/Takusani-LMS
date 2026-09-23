import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Administrators only: the database returns nothing to anyone else.

export async function listImportBatches() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_import_batches");
  if (error) throw new Error(`api.list_import_batches failed: ${error.message}`);
  return data;
}

/** One batch with its counts, or null. The list is small (one row per intake file), so it is read whole. */
export async function getImportBatch(batchId: string) {
  if (!z.string().uuid().safeParse(batchId).success) return null;
  return (await listImportBatches()).find((batch) => batch.id === batchId) ?? null;
}

export async function getImportRows(batchId: string, outcome?: "ready" | "problem" | "exists" | "imported" | "failed") {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_import_rows", { p_batch_id: batchId, p_outcome: outcome });
  if (error) throw new Error(`api.get_import_rows failed: ${error.message}`);
  return data;
}

export async function listImportCohorts() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_import_cohorts");
  if (error) throw new Error(`api.list_import_cohorts failed: ${error.message}`);
  return data;
}
