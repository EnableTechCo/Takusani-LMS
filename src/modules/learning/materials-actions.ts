"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { instantFromSast } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { MATERIAL_REFUSALS } from "./materials-rules";

// Facilitator commands for learning materials (S2-14, FR-204), and the learner's access log (FR-301). Every rule is
// the database's; these only carry the form and say what a refusal means.

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const refused = (status: string, values?: Record<string, string>): FormState => ({
  message: MATERIAL_REFUSALS[status] ?? MATERIAL_REFUSALS.error,
  values,
});

export async function createMaterial(_: FormState, form: FormData): Promise<FormState> {
  const values = {
    cohortId: text(form, "cohortId"),
    title: text(form, "title"),
    description: text(form, "description"),
    category: text(form, "category") === "recording" ? "recording" : "material",
  };
  if (!values.cohortId) return { errors: { cohortId: "Choose the cohort this material is for." }, values };
  if (!values.title) return { errors: { title: "Enter a title." }, values };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(values.category === "recording" ? "create_recording" : "create_material", {
    p_cohort_id: values.cohortId,
    p_title: values.title,
    p_description: values.description,
  });
  const row = data?.[0];
  if (error || row?.status !== "ok") return refused(row?.status ?? "error", values);
  revalidatePath("/teach/materials");
  redirect(`/teach/materials/${row.material_id}/edit`);
}

export async function updateMaterial(materialId: string, _: FormState, form: FormData): Promise<FormState> {
  const values = {
    title: text(form, "title"),
    description: text(form, "description"),
    moduleId: text(form, "moduleId"),
    linkUrl: text(form, "linkUrl"),
  };
  if (!values.title) return { errors: { title: "Enter a title." }, values };
  if (values.linkUrl && !/^https:\/\/\S+$/.test(values.linkUrl)) {
    return { errors: { linkUrl: MATERIAL_REFUSALS.invalid_link }, values };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_material", {
    p_material_id: materialId,
    p_title: values.title,
    p_description: values.description,
    p_module_id: values.moduleId || undefined,
    p_link_url: values.linkUrl || undefined,
  });
  let status = error ? "error" : (data?.[0]?.status ?? "error");
  // A recording also says whether captions or a transcript are available (FR-208, accessibility audit 1.2.x).
  if (status === "ok" && text(form, "category") === "recording") {
    const { data: captions, error: captionsError } = await supabase.rpc("set_recording_captions", {
      p_material_id: materialId,
      p_has_captions: form.get("hasCaptions") === "on",
    });
    status = captionsError ? "error" : (captions?.[0]?.status ?? "error");
  }
  if (status !== "ok") {
    return status === "invalid_link"
      ? { errors: { linkUrl: MATERIAL_REFUSALS.invalid_link }, values }
      : refused(status, values);
  }
  revalidatePath(`/teach/materials/${materialId}/edit`);
  revalidatePath("/teach/materials");
  return { done: true, values };
}

export async function attachMaterialFile(
  materialId: string,
  fileId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attach_material_file", { p_material_id: materialId, p_file_id: fileId });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return { ok: false, message: MATERIAL_REFUSALS[status] ?? MATERIAL_REFUSALS.error };
  revalidatePath(`/teach/materials/${materialId}/edit`);
  return { ok: true };
}

/** Publish now, or schedule for a South African date and time from the form. */
export async function publishMaterial(materialId: string, _: FormState, form: FormData): Promise<FormState> {
  const when = text(form, "when");
  const releaseLocal = text(form, "releaseAt");
  if (when === "later" && !releaseLocal) return { errors: { releaseAt: "Choose when learners can see it." } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_material", {
    p_material_id: materialId,
    p_release_at: when === "later" ? instantFromSast(releaseLocal) : undefined,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    return status === "release_in_past"
      ? { errors: { releaseAt: MATERIAL_REFUSALS.release_in_past } }
      : refused(status);
  }
  revalidatePath(`/teach/materials/${materialId}/edit`);
  revalidatePath("/teach/materials");
  return { done: true };
}

export async function archiveMaterial(materialId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("archive_material", { p_material_id: materialId });
  revalidatePath("/teach/materials");
  redirect("/teach/materials");
}

/**
 * The learner opened a material (FR-301). Called from the page once it has loaded, not while it renders, and every
 * failure is swallowed: the log feeds engagement reporting and must never stand between a learner and the material.
 */
export async function logMaterialAccess(materialId: string): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("log_material_access", { p_material_id: materialId });
  } catch {
    // Deliberately nothing: access is never blocked by its log.
  }
}
