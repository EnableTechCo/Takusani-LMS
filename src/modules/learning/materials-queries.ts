import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Facilitators see the materials of cohorts they set work in; learners see material released to them. The database
// decides both.

const isUuid = (value: string) => z.string().uuid().safeParse(value).success;

export async function listMaterials() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_materials");
  if (error) throw new Error(`api.list_materials failed: ${error.message}`);
  return data;
}

export async function getMaterial(materialId: string) {
  if (!isUuid(materialId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_material", { p_material_id: materialId });
  if (error) throw new Error(`api.get_material failed: ${error.message}`);
  return data?.[0] ?? null;
}

export async function listCohortModules(cohortId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_cohort_modules", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.list_cohort_modules failed: ${error.message}`);
  return data;
}

export async function listMyMaterials(search?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_materials", { p_search: search || undefined });
  if (error) throw new Error(`api.list_my_materials failed: ${error.message}`);
  return data;
}

/**
 * One released material for the learner, with a download link for a file. The link is signed as the learner, so the
 * storage policy decides (it allows only material released to them), and it lasts ten minutes: long enough to
 * download, not to pass around.
 */
export async function getMyMaterial(materialId: string) {
  if (!isUuid(materialId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_material", { p_material_id: materialId });
  if (error) throw new Error(`api.get_my_material failed: ${error.message}`);
  const material = data?.[0];
  if (!material) return null;
  let downloadUrl: string | null = null;
  if (material.kind === "file" && material.file_bucket && material.file_key) {
    const { data: signed } = await supabase.storage
      .from(material.file_bucket)
      .createSignedUrl(material.file_key, 600, { download: material.file_name ?? true });
    downloadUrl = signed?.signedUrl ?? null;
  }
  return { ...material, downloadUrl };
}
