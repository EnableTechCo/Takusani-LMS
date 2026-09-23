import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Every query answers only within the assessor's scope; an item outside it returns nothing and is audited (FR-401).

export async function listMarkingQueue() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_marking_queue", {});
  if (error) throw new Error(`api.list_marking_queue failed: ${error.message}`);
  return data;
}

/**
 * One item for the workspace. Cached for the request: the page and its title both ask, and the database audits an
 * out-of-scope attempt, which must be recorded once, not once per caller.
 */
export const getMarkingItem = cache(async (instanceId: string) => {
  if (!z.string().uuid().safeParse(instanceId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_marking_item", { p_instance_id: instanceId });
  if (error) throw new Error(`api.get_marking_item failed: ${error.message}`);
  return data?.[0] ?? null;
});

export interface EvidenceFile {
  filename: string;
  bytes: number;
  media_type: string;
  bucket: string;
  object_key: string;
  requirement: string | null;
}

/**
 * Short-lived links to open the evidence. They are signed as the assessor, so the storage policy decides: only
 * files of work they may mark can be opened (S2-07). Ten minutes is long enough to open a file, not to share it.
 */
export async function signEvidence(files: EvidenceFile[]): Promise<Record<string, string>> {
  if (files.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("submissions").createSignedUrls(
    files.map((file) => file.object_key),
    600,
  );
  if (error) throw new Error(`could not sign the evidence links: ${error.message}`);
  return Object.fromEntries((data ?? []).filter((row) => row.signedUrl).map((row) => [row.path, row.signedUrl]));
}

/**
 * One result as its learner may read it, or null when it is not theirs. Cached for the request: the page and its
 * title both ask, and opening a released result records the learner's first view, once.
 */
export const getMyResult = cache(async (resultId: string) => {
  if (!z.string().uuid().safeParse(resultId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_result", { p_result_id: resultId });
  if (error) throw new Error(`api.get_my_result failed: ${error.message}`);
  return data?.[0] ?? null;
});

/** The learner's own results: released first, newest release first, then the ones still being assessed. */
export async function listMyResults() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_results");
  if (error) throw new Error(`api.list_my_results failed: ${error.message}`);
  return data;
}
