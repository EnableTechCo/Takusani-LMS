"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deliverSoon } from "@/modules/notifications/run";
import { draftSchema, FINALISE_MISSING, FINALISE_REFUSALS, MARKING_REFUSALS, type Draft } from "./rules";

/** Takes the item: from here this assessor is its marker and nobody else can mark it at the same time. */
export async function takeMarking(instanceId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("take_marking", { p_instance_id: instanceId });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return { ok: false, message: MARKING_REFUSALS[status] ?? MARKING_REFUSALS.error };
  revalidatePath(`/assess/instances/${instanceId}`);
  revalidatePath("/assess");
  return { ok: true };
}

/**
 * Saves the working copy. `expectedVersion` is the draft version this page started from, so a second tab cannot
 * silently overwrite the first; on a clash the page is told which version is current.
 */
export async function saveMarkingDraft(
  instanceId: string,
  expectedVersion: number,
  draft: Draft,
): Promise<{ ok: true; version: number; savedAt: string } | { ok: false; message: string; stale?: boolean }> {
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, message: MARKING_REFUSALS.invalid_scores };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_marking_draft", {
    p_instance_id: instanceId,
    p_expected_version: expectedVersion,
    p_scores: parsed.data.scores.map((score) => ({
      ordinal: score.ordinal,
      points: score.points,
      comment: score.comment,
    })),
    p_feedback: parsed.data.feedback,
    p_outcome: parsed.data.outcome ?? undefined,
    p_justification: parsed.data.justification,
    p_remediation: parsed.data.remediation,
    p_resubmission_days: parsed.data.resubmissionDays ?? undefined,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok") {
    return {
      ok: false,
      message: MARKING_REFUSALS[status] ?? MARKING_REFUSALS.error,
      stale: status === "stale_version",
    };
  }
  return { ok: true, version: row!.draft_version!, savedAt: row!.saved_at! };
}

export type FinaliseResult =
  | { ok: true; resultState: string; releasedAt: string | null; appealDeadlineAt: string | null }
  | { ok: false; message: string };

/**
 * Finalises the decision (FR-408). Whether it reaches the learner now or waits for moderation is the database's
 * decision, from the cohort's policy; the page is told which happened. A repeat returns the decision that stands.
 */
export async function finaliseDecision(instanceId: string, draftVersion: number): Promise<FinaliseResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finalise_decision", {
    p_instance_id: instanceId,
    p_expected_draft_version: draftVersion,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok" && status !== "already_finalised") {
    const missing = row?.detail ? FINALISE_MISSING[row.detail] : null;
    return {
      ok: false,
      message:
        status === "incomplete" && missing
          ? `Add ${missing} before finalising.`
          : (FINALISE_REFUSALS[status] ?? FINALISE_REFUSALS.error),
    };
  }
  revalidatePath(`/assess/instances/${instanceId}`);
  revalidatePath("/assess");
  // A release queued the learner's email in the same transaction; send it now rather than at the next schedule.
  if (status === "ok" && row!.result_state === "released") deliverSoon();
  return {
    ok: true,
    resultState: row!.result_state!,
    releasedAt: row!.released_at ?? null,
    appealDeadlineAt: row!.appeal_deadline_at ?? null,
  };
}
