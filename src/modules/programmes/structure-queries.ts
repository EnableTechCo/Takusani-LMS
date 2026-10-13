import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "./rules";
import type { StructureQualification } from "./structure-rules";

// Programme structure (FR-701, FR-108). The database returns only programmes the person may manage: all of them for an
// administrator, those a coordinator's scope covers.

export async function listProgrammeStructures() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_programme_structures");
  if (error) throw new Error(`api.list_programme_structures failed: ${error.message}`);
  return data ?? [];
}

export async function getProgrammeStructure(programmeId: string) {
  if (!isUuid(programmeId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_programme_structure", { p_programme_id: programmeId });
  if (error) throw new Error(`api.get_programme_structure failed: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;
  return { ...row, qualifications: (row.qualifications ?? []) as unknown as StructureQualification[] };
}
