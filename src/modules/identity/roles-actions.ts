"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { ROLE_REFUSALS, roleLabel, type Advisory } from "./roles-rules";

// X-04 role administration (S3-07). The database checks the caller's scope, locks the person, audits the change with
// its previous value, and works out the advisory (U-01) or the work that blocks an end (FR-105).

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export interface AssignState extends FormState {
  /** The role just assigned ("Moderator"), and what the person will be kept away from (U-01). */
  assigned?: string;
  advisories?: Advisory[];
}

/** "Until the end of" a date in South Africa: the start of the next day, SAST. */
function endOfSastDay(date: string): string {
  const start = new Date(`${date}T00:00:00+02:00`);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

export async function assignRole(profileId: string, _: AssignState, form: FormData): Promise<AssignState> {
  const values = { role: text(form, "role"), scope: text(form, "scope"), until: text(form, "until") };
  const errors: Record<string, string> = {};
  if (!values.role) errors.role = ROLE_REFUSALS.invalid_role;
  if (!values.scope) errors.scope = ROLE_REFUSALS.invalid_scope;
  if (values.until && !/^\d{4}-\d{2}-\d{2}$/.test(values.until)) errors.until = ROLE_REFUSALS.invalid_until;
  if (Object.keys(errors).length > 0) return { errors, values };

  const [scopeType, scopeKey] = values.scope.split("|");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_role", {
    p_profile_id: profileId,
    p_role: values.role,
    p_scope_type: scopeType,
    p_scope_key: z.string().uuid().safeParse(scopeKey).success ? scopeKey : undefined,
    p_until: values.until ? endOfSastDay(values.until) : undefined,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok") {
    const message = ROLE_REFUSALS[status] ?? ROLE_REFUSALS.error;
    if (status === "invalid_until") return { errors: { until: message }, values };
    if (status === "invalid_scope") return { errors: { scope: message }, values };
    return { message, values };
  }
  revalidatePath(`/admin/accounts/${profileId}/roles`);
  return {
    done: true,
    values,
    assigned: roleLabel(values.role),
    advisories: (row?.advisories ?? []) as unknown as Advisory[],
  };
}

/**
 * Ends a role now. The page reads the outcome from the address: ended, or refused because open work depends on it
 * (FR-105), in which case it shows that work.
 */
export async function endRole(profileId: string, assignmentId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("end_role", { p_assignment_id: assignmentId });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  revalidatePath(`/admin/accounts/${profileId}/roles`);
  redirect(`/admin/accounts/${profileId}/roles?end=${status}&assignment=${assignmentId}`);
}
