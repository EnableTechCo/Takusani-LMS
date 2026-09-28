"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { instantFromSast } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { isTeamsLink, SESSION_REFUSALS } from "./sessions-rules";

// Facilitator commands for sessions (S2-15; FR-206, FR-207). The database checks everything again and tells the
// audience; these carry the form, check the Teams link as it is entered, and say what a refusal means.

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

const FIELD_OF: Record<string, string> = {
  invalid_title: "title",
  start_in_past: "startsAt",
  invalid_duration: "duration",
  invalid_teams_link: "teamsUrl",
  invalid_venue: "venue",
  cohort_not_found: "cohortId",
};

function read(form: FormData) {
  return {
    cohortId: text(form, "cohortId"),
    title: text(form, "title"),
    startsAt: text(form, "startsAt"),
    duration: text(form, "duration"),
    mode: text(form, "mode") || "online",
    teamsUrl: text(form, "teamsUrl"),
    venue: text(form, "venue"),
  };
}

/** Checked before the database, so the form can point at the field: the same rules, said the same way. */
function check(values: ReturnType<typeof read>, needsCohort: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (needsCohort && !values.cohortId) errors.cohortId = SESSION_REFUSALS.cohort_not_found;
  if (!values.title) errors.title = SESSION_REFUSALS.invalid_title;
  if (!values.startsAt) errors.startsAt = "Choose the date and start time.";
  if (!values.duration) errors.duration = SESSION_REFUSALS.invalid_duration;
  if (values.mode === "online" && !isTeamsLink(values.teamsUrl)) errors.teamsUrl = SESSION_REFUSALS.invalid_teams_link;
  if (values.mode === "in_person" && !values.venue) errors.venue = SESSION_REFUSALS.invalid_venue;
  return errors;
}

function refused(status: string, values: Record<string, string>): FormState {
  const message = SESSION_REFUSALS[status] ?? SESSION_REFUSALS.error;
  const field = FIELD_OF[status];
  return field ? { errors: { [field]: message }, values } : { message, values };
}

export async function createSession(_: FormState, form: FormData): Promise<FormState> {
  const values = read(form);
  const errors = check(values, true);
  if (Object.keys(errors).length > 0) return { errors, values };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_session", {
    p_cohort_id: values.cohortId,
    p_title: values.title,
    p_starts_at: instantFromSast(values.startsAt),
    p_duration_minutes: Number(values.duration),
    p_mode: values.mode,
    p_teams_url: values.mode === "online" ? values.teamsUrl : undefined,
    p_venue: values.mode === "in_person" ? values.venue : undefined,
  });
  const row = data?.[0];
  if (error || row?.status !== "ok") return refused(row?.status ?? "error", values);
  revalidatePath("/teach/sessions");
  redirect(`/teach/sessions/${row.session_id}?told=${row.notified ?? 0}`);
}

export async function updateSession(
  sessionId: string,
  version: number,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const values = read(form);
  const errors = check(values, false);
  if (Object.keys(errors).length > 0) return { errors, values };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_session", {
    p_session_id: sessionId,
    p_expected_version: version,
    p_title: values.title,
    p_starts_at: instantFromSast(values.startsAt),
    p_duration_minutes: Number(values.duration),
    p_mode: values.mode,
    p_teams_url: values.mode === "online" ? values.teamsUrl : undefined,
    p_venue: values.mode === "in_person" ? values.venue : undefined,
  });
  const row = data?.[0];
  if (error || row?.status !== "ok") return refused(row?.status ?? "error", values);
  revalidatePath("/teach/sessions");
  redirect(`/teach/sessions/${sessionId}?told=${row.notified ?? 0}&changed=1`);
}

export async function cancelSession(sessionId: string, _: FormState, form: FormData): Promise<FormState> {
  const reason = text(form, "reason");
  if (!reason) return { errors: { reason: SESSION_REFUSALS.reason_required } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_session", { p_session_id: sessionId, p_reason: reason });
  const row = data?.[0];
  if (error || row?.status !== "ok") {
    const status = row?.status ?? "error";
    return status === "reason_required"
      ? { errors: { reason: SESSION_REFUSALS.reason_required } }
      : { message: SESSION_REFUSALS[status] ?? SESSION_REFUSALS.error };
  }
  revalidatePath("/teach/sessions");
  redirect(`/teach/sessions/${sessionId}?told=${row.notified ?? 0}&cancelled=1`);
}
