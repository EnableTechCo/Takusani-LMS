"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { LOGISTICS_REFUSALS } from "./logistics-rules";

// Session logistics (S6-03; FR-705 to FR-707). The database checks the coordinator's scope and the session, records
// who arranged what and when, and audits each save.

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const ticked = (form: FormData, name: string) => form.get(name) === "on";

const refresh = (sessionId: string) => {
  revalidatePath(`/coordinate/sessions/${sessionId}/logistics`);
  revalidatePath("/coordinate/logistics");
};

export async function saveLogistics(
  sessionId: string,
  expectedVersion: number,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const values = {
    venueNote: text(form, "venueNote"),
    headcount: text(form, "headcount"),
    dietary: text(form, "dietary"),
    equipment: text(form, "equipment"),
  };
  const cateringNeeded = ticked(form, "cateringNeeded");
  const headcount = Number(values.headcount);
  if (cateringNeeded && (!values.headcount || !Number.isInteger(headcount) || headcount < 0)) {
    return { errors: { headcount: LOGISTICS_REFUSALS.invalid_headcount }, values };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_session_logistics", {
    p_session_id: sessionId,
    p_expected_version: expectedVersion,
    p_venue_note: values.venueNote,
    p_venue_arranged: ticked(form, "venueArranged"),
    p_catering_needed: cateringNeeded,
    p_headcount: (cateringNeeded ? headcount : null) as unknown as number,
    p_dietary: values.dietary,
    p_catering_arranged: ticked(form, "cateringArranged"),
    p_equipment: values.equipment,
    p_equipment_arranged: ticked(form, "equipmentArranged"),
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    const message = LOGISTICS_REFUSALS[status] ?? LOGISTICS_REFUSALS.error;
    if (status === "invalid_headcount") return { errors: { headcount: message }, values };
    if (status === "equipment_required") return { errors: { equipment: message }, values };
    if (status === "stale_version") refresh(sessionId);
    return { message, values };
  }
  refresh(sessionId);
  return { done: true };
}

export async function reconcileVariance(sessionId: string, _: FormState, form: FormData): Promise<FormState> {
  const values = { note: text(form, "note") };
  if (!values.note) return { errors: { note: LOGISTICS_REFUSALS.note_required }, values };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reconcile_logistics_variance", {
    p_session_id: sessionId,
    p_note: values.note,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    const message = LOGISTICS_REFUSALS[status] ?? LOGISTICS_REFUSALS.error;
    return status === "note_required" ? { errors: { note: message }, values } : { message, values };
  }
  refresh(sessionId);
  return { done: true };
}
