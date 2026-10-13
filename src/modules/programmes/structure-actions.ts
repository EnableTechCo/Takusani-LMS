"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrors, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { newProgrammeSchema, PROGRAMME_REFUSALS } from "./rules";
import {
  MAX_UNIT_LIST_BYTES,
  REFUSAL_FIELD,
  STRUCTURE_REFUSALS,
  UNIT_LIST_FILE_PROBLEMS,
  readUnitList,
  type UnitListRow,
} from "./structure-rules";

// Programme structure (FR-701, FR-108; SRS AS-03). The database decides who may change a programme and checks every
// value; these carry the forms and say what happened.

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const page = (programmeId: string) => `/admin/programmes/${programmeId}`;

function refused(status: string, values?: Record<string, string>): FormState {
  const message = STRUCTURE_REFUSALS[status] ?? STRUCTURE_REFUSALS.error;
  const field = REFUSAL_FIELD[status];
  return field ? { errors: { [field]: message }, values } : { message, values };
}

/** Creates a programme from Administration and opens it, ready for its qualifications and units. */
export async function createProgrammeForStructure(_: FormState, form: FormData): Promise<FormState> {
  const values = { code: text(form, "code"), title: text(form, "title"), nqfLevel: text(form, "nqfLevel") };
  const parsed = newProgrammeSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_programme", {
    p_code: parsed.data.code,
    p_title: parsed.data.title,
    p_nqf_level: parsed.data.nqfLevel,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    const refusal = PROGRAMME_REFUSALS[status] ?? { message: STRUCTURE_REFUSALS.error };
    return refusal.field
      ? { errors: { [refusal.field]: refusal.message }, values }
      : { message: refusal.message, values };
  }
  revalidatePath("/admin/programmes");
  redirect(`${page(data![0].programme_id)}?created=programme`);
}

export async function addQualification(programmeId: string, _: FormState, form: FormData): Promise<FormState> {
  const values = { code: text(form, "code"), title: text(form, "title") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_qualification", {
    p_programme_id: programmeId,
    p_code: values.code,
    p_title: values.title,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, values);
  revalidatePath(page(programmeId));
  redirect(`${page(programmeId)}?added=qualification`);
}

export async function addUnit(programmeId: string, _: FormState, form: FormData): Promise<FormState> {
  const values = {
    qualificationId: text(form, "qualificationId"),
    code: text(form, "code"),
    title: text(form, "title"),
    credits: text(form, "credits"),
  };
  if (!values.qualificationId) return { errors: { qualificationId: "Choose the qualification." }, values };
  if (!/^\d{1,4}$/.test(values.credits)) return { errors: { credits: STRUCTURE_REFUSALS.invalid_credits }, values };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_unit", {
    p_qualification_id: values.qualificationId,
    p_code: values.code,
    p_title: values.title,
    p_credits: Number(values.credits),
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, values);
  revalidatePath(page(programmeId));
  redirect(`${page(programmeId)}?added=unit#qualification-${values.qualificationId}`);
}

export async function editQualification(
  programmeId: string,
  qualificationId: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const values = { code: text(form, "code"), title: text(form, "title") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_qualification", {
    p_qualification_id: qualificationId,
    p_code: values.code,
    p_title: values.title,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, values);
  revalidatePath(page(programmeId));
  redirect(`${page(programmeId)}?changed=qualification#qualification-${qualificationId}`);
}

export async function editUnit(programmeId: string, unitId: string, _: FormState, form: FormData): Promise<FormState> {
  const values = { code: text(form, "code"), title: text(form, "title") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_unit", {
    p_unit_id: unitId,
    p_code: values.code,
    p_title: values.title,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, values);
  revalidatePath(page(programmeId));
  redirect(`${page(programmeId)}?changed=unit`);
}

export async function removeUnit(programmeId: string, unitId: string): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_unit", { p_unit_id: unitId });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status);
  revalidatePath(page(programmeId));
  redirect(`${page(programmeId)}?removed=unit`);
}

export async function removeQualification(programmeId: string, qualificationId: string): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_qualification", { p_qualification_id: qualificationId });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status);
  revalidatePath(page(programmeId));
  redirect(`${page(programmeId)}?removed=qualification`);
}

/** What checking a unit list produced, for the import form to show and, when clean, to apply. */
export interface UnitImportState extends FormState {
  check?: {
    fileName: string;
    newQualifications: number;
    newUnits: number;
    skipped: { row: number; unit_code: string; differs: boolean }[];
    problems: { row: number; problem: string; first_row?: number }[];
    /** The rows, sent back with "Import" so the same list is applied; the database checks them again. */
    rows: string;
  };
  imported?: { newQualifications: number; newUnits: number; skipped: number };
}

type ImportResult = {
  status: string;
  new_qualifications: number | null;
  new_units: number | null;
  skipped: unknown;
  problems: unknown;
};

async function runImport(programmeId: string, rows: UnitListRow[], apply: boolean): Promise<ImportResult | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_units", {
    p_programme_id: programmeId,
    p_rows: rows,
    p_apply: apply,
  });
  if (error) return null;
  return (data?.[0] as ImportResult | undefined) ?? null;
}

/** Step 1: reads the file and has the database check every line, adding nothing. */
export async function checkUnitList(programmeId: string, _: UnitImportState, form: FormData): Promise<UnitImportState> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { errors: { file: UNIT_LIST_FILE_PROBLEMS.no_file } };
  if (file.size > MAX_UNIT_LIST_BYTES) return { errors: { file: UNIT_LIST_FILE_PROBLEMS.too_big } };
  const read = readUnitList(await file.text());
  if (!read.ok) {
    const message = UNIT_LIST_FILE_PROBLEMS[read.problem];
    return {
      errors: { file: read.detail && read.problem === "missing_columns" ? `${message} ${read.detail}.` : message },
    };
  }
  const result = await runImport(programmeId, read.rows, false);
  if (!result) return { message: STRUCTURE_REFUSALS.error };
  if (result.status !== "ok" && result.status !== "problems") return refused(result.status);
  return {
    check: {
      fileName: file.name,
      newQualifications: result.new_qualifications ?? 0,
      newUnits: result.new_units ?? 0,
      skipped: (result.skipped ?? []) as NonNullable<UnitImportState["check"]>["skipped"],
      problems: (result.problems ?? []) as NonNullable<UnitImportState["check"]>["problems"],
      rows: JSON.stringify(read.rows),
    },
  };
}

/** Step 2: applies the checked list. The database checks it again and adds it all, or nothing. */
export async function applyUnitList(programmeId: string, _: UnitImportState, form: FormData): Promise<UnitImportState> {
  let rows: UnitListRow[];
  try {
    rows = JSON.parse(String(form.get("rows") ?? "[]")) as UnitListRow[];
  } catch {
    return { message: STRUCTURE_REFUSALS.invalid_rows };
  }
  const result = await runImport(programmeId, rows, true);
  if (!result) return { message: STRUCTURE_REFUSALS.error };
  if (result.status === "problems") {
    return {
      message: "Something changed since the file was checked, and the list now has problems. Nothing was imported.",
    };
  }
  if (result.status !== "ok") return refused(result.status);
  revalidatePath(page(programmeId));
  revalidatePath("/admin/programmes");
  return {
    imported: {
      newQualifications: result.new_qualifications ?? 0,
      newUnits: result.new_units ?? 0,
      skipped: Array.isArray(result.skipped) ? result.skipped.length : 0,
    },
  };
}
