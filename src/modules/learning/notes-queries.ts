import "server-only";
import { createClient } from "@/lib/supabase/server";

// The learner's own notes (S3-14). Every read acts on the signed-in learner's notes only; the database decides.

export async function listMyNotes(search?: string, folder?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_notes", {
    p_search: search || undefined,
    p_folder: folder || undefined,
  });
  if (error) throw new Error(`api.list_my_notes failed: ${error.message}`);
  return data;
}

export async function listMyNoteFolders() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_note_folders");
  if (error) throw new Error(`api.list_my_note_folders failed: ${error.message}`);
  return data;
}

export async function getMyNote(noteId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_note", { p_note_id: noteId });
  if (error) throw new Error(`api.get_my_note failed: ${error.message}`);
  return data?.[0] ?? null;
}

/** What a note can be about: materials released to the learner, and their sessions. */
export async function listNoteLinkTargets() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_note_link_targets");
  if (error) throw new Error(`api.list_note_link_targets failed: ${error.message}`);
  return data;
}
