/** Shapes shared by the task editor, the learner's task page and the upload island. */

/** A rubric row as the screens read it (FR-201). */
export interface Criterion {
  ordinal?: number;
  title: string;
  descriptor?: string | null;
  points?: number | null;
}

/** What a learner must hand in (FR-311). */
export interface Requirement {
  id: string;
  title: string;
  guidance?: string | null;
  mandatory?: boolean | null;
}

/** A requirement being edited on a draft: a new row has no id yet. */
export type RequirementDraft = Omit<Requirement, "id"> & { id?: string };
