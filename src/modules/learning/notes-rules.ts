/** Private learner notes (S3-14; FR-306, FR-307): refusals, and a note's link as one form value. */

export const NOTE_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; your note was not saved.",
  forbidden: "Notes are for learners.",
  not_found: "This note no longer exists.",
  invalid_title: "Give the note a title of up to 200 characters.",
  body_too_long: "The note is longer than 20,000 characters. Split it into two notes.",
  invalid_folder: "A folder name is up to 60 characters.",
  one_link_only: "A note can be about one material or one session.",
  link_not_found: "That material or session is not available to you. Choose another, or none.",
  stale:
    "This note was changed in another tab or window since you opened it. Nothing was saved: reload it and edit again.",
  error: "The note could not be saved. Try again.",
};

export type NoteLink = { kind: "material" | "session"; id: string } | null;

/** "material:<id>" or "session:<id>" for a select's value; "" for none. */
export function linkValue(link: NoteLink): string {
  return link ? `${link.kind}:${link.id}` : "";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The link a select's value names, or null for none or anything malformed. */
export function parseLink(value: string): NoteLink {
  const [kind, id] = value.split(":");
  if ((kind === "material" || kind === "session") && id && UUID.test(id)) return { kind, id };
  return null;
}

/** "Material: Filing checklist" or "Session: Session 12" for what a note is about. */
export function linkLabel(kind: string | null, title: string | null): string | null {
  if (!kind || !title) return null;
  return `${kind === "material" ? "Material" : "Session"}: ${title}`;
}
