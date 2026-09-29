"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { roleLabel, type Advisory } from "@/modules/identity/roles-rules";
import { SETUP_REFUSALS } from "./setup-rules";

// Cohort setup (S4-03). The database checks the coordinator's scope, locks the moderation state first (ADR-019), and
// audits every change; these carry the form and say what a refusal means.

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const refreshCohort = (cohortId: string) => {
  for (const page of ["", "/setup", "/people", "/readiness"]) revalidatePath(`/coordinate/cohorts/${cohortId}${page}`);
};

export interface PolicyState extends FormState {
  /** Set when a change to Not moderated was refused: how many results are waiting and held. */
  blocked?: { waiting: number; held: number };
}

export async function setModerationPolicy(
  cohortId: string,
  expectedVersion: number,
  _: PolicyState,
  form: FormData,
): Promise<PolicyState> {
  const values = { policy: text(form, "policy"), reason: text(form, "reason") };
  if (!values.policy) return { errors: { policy: SETUP_REFUSALS.invalid_policy }, values };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_moderation_policy", {
    p_cohort_id: cohortId,
    p_policy: values.policy,
    p_expected_version: expectedVersion,
    p_reason: values.reason || undefined,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status === "results_pending_or_held") {
    return { message: SETUP_REFUSALS[status], values, blocked: { waiting: row!.waiting ?? 0, held: row!.held ?? 0 } };
  }
  if (status !== "ok") {
    const message = SETUP_REFUSALS[status] ?? SETUP_REFUSALS.error;
    if (status === "reason_required" || status === "reason_too_long") return { errors: { reason: message }, values };
    return { message, values };
  }
  refreshCohort(cohortId);
  redirect(`/coordinate/cohorts/${cohortId}/setup?policy=${row!.policy_version}`);
}

export async function activateCohort(cohortId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("activate_cohort", { p_cohort_id: cohortId });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  refreshCohort(cohortId);
  revalidatePath("/coordinate/cohorts");
  redirect(
    `/coordinate/cohorts/${cohortId}/setup?activate=${status}${status === "ok" ? `&learners=${row!.learners}` : ""}`,
  );
}

export async function assignReadinessItem(
  cohortId: string,
  itemKey: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const values = { assignee: text(form, "assignee"), dueOn: text(form, "dueOn"), note: text(form, "note") };
  if (!values.assignee) return { errors: { assignee: SETUP_REFUSALS.not_staff }, values };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_readiness_item", {
    p_cohort_id: cohortId,
    p_item_key: itemKey,
    p_assignee_id: values.assignee,
    p_due_on: values.dueOn || undefined,
    p_note: values.note || undefined,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    const message = SETUP_REFUSALS[status] ?? SETUP_REFUSALS.error;
    if (status === "due_in_past") return { errors: { dueOn: message }, values };
    if (status === "note_too_long") return { errors: { note: message }, values };
    return { message, values };
  }
  refreshCohort(cohortId);
  return { done: true, values };
}

export interface CohortRoleState extends FormState {
  assigned?: string;
  personName?: string;
  advisories?: Advisory[];
}

/** "Until the end of" a date in South Africa: the start of the next day, SAST. */
function endOfSastDay(date: string): string {
  return new Date(new Date(`${date}T00:00:00+02:00`).getTime() + 86_400_000).toISOString();
}

export async function assignCohortRole(cohortId: string, _: CohortRoleState, form: FormData): Promise<CohortRoleState> {
  const values = { email: text(form, "email").toLowerCase(), role: text(form, "role"), until: text(form, "until") };
  const errors: Record<string, string> = {};
  if (!/^\S+@\S+\.\S+$/.test(values.email)) errors.email = "Enter their email address, like name@example.org.";
  if (!values.role) errors.role = SETUP_REFUSALS.invalid_role;
  if (values.until && !/^\d{4}-\d{2}-\d{2}$/.test(values.until)) errors.until = "Enter a date.";
  if (Object.keys(errors).length > 0) return { errors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_cohort_role", {
    p_cohort_id: cohortId,
    p_email: values.email,
    p_role: values.role,
    p_until: values.until ? endOfSastDay(values.until) : undefined,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok") {
    const refusals: Record<string, string> = {
      ...SETUP_REFUSALS,
      already_assigned: "They already hold that role here. Nothing was changed.",
      account_inactive: "That account is deactivated, so it cannot be given a role.",
      forbidden: "You cannot assign that role here. Nothing was changed.",
      invalid_until: "The end date must be in the future.",
    };
    const message = refusals[status] ?? SETUP_REFUSALS.error;
    if (status === "account_not_found") return { errors: { email: message }, values };
    if (status === "invalid_until") return { errors: { until: message }, values };
    return { message, values };
  }
  refreshCohort(cohortId);
  const { data: staff } = await supabase.rpc("list_cohort_staff", { p_cohort_id: cohortId });
  return {
    done: true,
    values: { email: "", role: "", until: "" },
    assigned: roleLabel(values.role),
    personName: staff?.find((person) => person.profile_id === row!.profile_id)?.full_name ?? values.email,
    advisories: (row!.advisories ?? []) as unknown as Advisory[],
  };
}

/** Ends a cohort role now. Refused while the person has open work here that no other role covers (FR-105). */
export async function endCohortRole(cohortId: string, assignmentId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("end_role", { p_assignment_id: assignmentId });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  refreshCohort(cohortId);
  redirect(`/coordinate/cohorts/${cohortId}/people?ended=${status}`);
}
