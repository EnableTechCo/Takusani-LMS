"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { QUERY_REFUSALS } from "./query-rules";

// Stakeholder queries (S6-03, FR-704). The database checks the coordinator's scope, keeps the history and audits each
// step; these carry the forms and say what a refusal means.

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

const FIELD_OF: Record<string, string> = {
  programme_not_found: "programmeId",
  cohort_not_in_programme: "cohortId",
  invalid_source_type: "sourceType",
  invalid_source_name: "sourceName",
  invalid_contact: "contact",
  invalid_subject: "subject",
  invalid_details: "details",
  due_in_past: "dueOn",
};

/** C-10: logs a query, then opens it so it can be routed. */
export async function logQuery(_: FormState, form: FormData): Promise<FormState> {
  const values = {
    programmeId: text(form, "programmeId"),
    cohortId: text(form, "cohortId"),
    sourceType: text(form, "sourceType"),
    sourceName: text(form, "sourceName"),
    contact: text(form, "contact"),
    subject: text(form, "subject"),
    details: text(form, "details"),
    dueOn: text(form, "dueOn"),
  };
  const errors: Record<string, string> = {};
  if (!values.programmeId) errors.programmeId = QUERY_REFUSALS.programme_not_found;
  if (!values.sourceType) errors.sourceType = QUERY_REFUSALS.invalid_source_type;
  if (!values.sourceName) errors.sourceName = QUERY_REFUSALS.invalid_source_name;
  if (!values.subject) errors.subject = QUERY_REFUSALS.invalid_subject;
  if (!values.details) errors.details = QUERY_REFUSALS.invalid_details;
  if (Object.keys(errors).length) return { errors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_stakeholder_query", {
    p_programme_id: values.programmeId,
    p_cohort_id: (values.cohortId || null) as unknown as string,
    p_source_type: values.sourceType,
    p_source_name: values.sourceName,
    p_contact: (values.contact || null) as unknown as string,
    p_subject: values.subject,
    p_details: values.details,
    p_due_on: values.dueOn || undefined,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok") {
    const message = QUERY_REFUSALS[status] ?? QUERY_REFUSALS.error;
    const field = FIELD_OF[status];
    return field ? { errors: { [field]: message }, values } : { message, values };
  }
  revalidatePath("/coordinate/queries");
  redirect(`/coordinate/queries/${row!.query_id}?logged=1`);
}

/** Routes the query to a coordinator who covers it; they are told. */
export async function routeQuery(queryId: string, _: FormState, form: FormData): Promise<FormState> {
  const values = { ownerId: text(form, "ownerId"), routeNote: text(form, "routeNote") };
  if (!values.ownerId) return { errors: { ownerId: QUERY_REFUSALS.owner_not_eligible }, values };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("route_stakeholder_query", {
    p_query_id: queryId,
    p_owner_id: values.ownerId,
    p_note: values.routeNote || undefined,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    const message = QUERY_REFUSALS[status] ?? QUERY_REFUSALS.error;
    if (status === "owner_not_eligible" || status === "unchanged") return { errors: { ownerId: message }, values };
    if (status === "invalid_note") return { errors: { routeNote: message }, values };
    return { message, values };
  }
  revalidatePath(`/coordinate/queries/${queryId}`);
  revalidatePath("/coordinate/queries");
  return { done: true };
}

/** Start, add a note, close with the resolution, or reopen with the reason: the button pressed says which. */
export async function actOnQuery(queryId: string, _: FormState, form: FormData): Promise<FormState> {
  const action = text(form, "action");
  const values = { note: text(form, "note") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("act_on_stakeholder_query", {
    p_query_id: queryId,
    p_action: action,
    p_note: values.note || undefined,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    const message = QUERY_REFUSALS[status] ?? QUERY_REFUSALS.error;
    if (["note_required", "resolution_required", "reason_required", "invalid_note"].includes(status)) {
      return { errors: { note: message }, values };
    }
    return { message, values };
  }
  revalidatePath(`/coordinate/queries/${queryId}`);
  revalidatePath("/coordinate/queries");
  return { done: true };
}
