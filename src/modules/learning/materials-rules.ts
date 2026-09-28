import { formatBytes } from "@/modules/submissions/rules";

/** Learning materials (S2-14; FR-204, FR-301): states in words, refusals, and a file described for a reader. */

export type MaterialStateLabel = "Draft" | "Scheduled" | "Published" | "Archived";

/**
 * The state a person sees. "Scheduled" is derived: published with a release time still to come (data model, material
 * publication states), so no job has to flip it.
 */
export function materialState(state: string, releaseAt: string | null, now: Date): MaterialStateLabel {
  if (state === "archived") return "Archived";
  if (state === "draft") return "Draft";
  return releaseAt && new Date(releaseAt).getTime() > now.getTime() ? "Scheduled" : "Published";
}

export const MATERIAL_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again.",
  forbidden: "You do not set work in this cohort.",
  not_found: "This material no longer exists.",
  cohort_not_found: "Choose a cohort.",
  invalid_title: "Enter a title of up to 200 characters.",
  invalid_description: "The description is longer than 5,000 characters.",
  module_not_in_programme: "Choose a module from this cohort's programme.",
  invalid_link: "Enter a full web address starting with https://.",
  archived: "This material is archived and can no longer be changed.",
  no_content: "Add a file or a link before publishing.",
  release_in_past: "Choose a release time from now on.",
  already_released: "This material is already released.",
  file_not_available: "That file cannot be used. Upload it again.",
  error: "The change could not be saved. Try again.",
};

const TYPE_NAMES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "image/jpeg": "JPG image",
  "image/png": "PNG image",
};

/** "PDF, 1.2 MB" for a file, or "Link to example.org" for a link. */
export function describeContent(material: {
  kind: string | null;
  link_host?: string | null;
  file_media_type?: string | null;
  file_bytes?: number | null;
}): string {
  if (material.kind === "link") return material.link_host ? `Link to ${material.link_host}` : "Link";
  if (material.kind === "file") {
    const type = TYPE_NAMES[material.file_media_type ?? ""] ?? "File";
    return material.file_bytes ? `${type}, ${formatBytes(Number(material.file_bytes))}` : type;
  }
  return "No content yet";
}

/** Types a facilitator can upload as material: the bucket's list (the server checks again). */
export const MATERIAL_TYPES = Object.keys(TYPE_NAMES);
