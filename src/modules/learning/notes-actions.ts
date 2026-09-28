"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { NOTE_REFUSALS, parseLink } from "./notes-rules";

// The learner's own notes (S3-14, FR-306). The database checks the owner, the title and length, and the link.

const text = (form: FormData, name: string) => String(form.get(name) ?? "");
const FIELD_OF: Record<string, string> = {
  invalid_title: "title",
  body_too_long: "body",
  invalid_folder: "folder",
  one_link_only: "link",
  link_not_found: "link",
};

function read(form: FormData) {
  return {
    title: text(form, "title").trim(),
    body: text(form, "body"),
    folder: text(form, "folder").trim(),
    link: text(form, "link"),
  };
}

function refused(status: string, values: Record<string, string>): FormState {
  const message = NOTE_REFUSALS[status] ?? NOTE_REFUSALS.error;
  return FIELD_OF[status] ? { errors: { [FIELD_OF[status]]: message }, values } : { message, values };
}

export async function createNote(_: FormState, form: FormData): Promise<FormState> {
  const values = read(form);
  if (!values.title) return { errors: { title: NOTE_REFUSALS.invalid_title }, values };
  const link = parseLink(values.link);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_note", {
    p_title: values.title,
    p_body: values.body,
    p_folder: values.folder || undefined,
    p_material_id: link?.kind === "material" ? link.id : undefined,
    p_session_id: link?.kind === "session" ? link.id : undefined,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok") return refused(status, values);
  revalidatePath("/learn/notes");
  redirect(`/learn/notes/${row!.note_id}?saved=1`);
}

export async function updateNote(noteId: string, version: number, _: FormState, form: FormData): Promise<FormState> {
  const values = read(form);
  if (!values.title) return { errors: { title: NOTE_REFUSALS.invalid_title }, values };
  const link = parseLink(values.link);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_note", {
    p_note_id: noteId,
    p_title: values.title,
    p_body: values.body,
    p_folder: values.folder || undefined,
    p_material_id: link?.kind === "material" ? link.id : undefined,
    p_session_id: link?.kind === "session" ? link.id : undefined,
    p_expected_version: version,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, values);
  revalidatePath("/learn/notes");
  redirect(`/learn/notes/${noteId}?saved=1`);
}

export async function deleteNote(noteId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("delete_note", { p_note_id: noteId });
  revalidatePath("/learn/notes");
  redirect("/learn/notes?deleted=1");
}
