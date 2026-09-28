"use client";

import { useActionState } from "react";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { SelectField, TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { createNote, deleteNote, updateNote } from "./notes-actions";

const LABELS = { title: "Title", body: "Note", folder: "Folder", link: "About" };

export interface NoteTarget {
  value: string;
  label: string;
}

/**
 * L-09: write or edit a note (FR-306). A folder groups notes; "About" links a note to a material or session. Only
 * the learner ever sees it (FR-307).
 */
export function NoteForm({
  note,
  targets,
  folders,
  defaultLink = "",
}: {
  note?: { id: string; version: number; title: string; body: string; folder: string | null; link: string };
  targets: NoteTarget[];
  folders: string[];
  defaultLink?: string;
}) {
  const [state, action] = useActionState(
    note ? updateNote.bind(null, note.id, note.version) : createNote,
    {} as FormState,
  );
  const values = state.values ?? {
    title: note?.title ?? "",
    body: note?.body ?? "",
    folder: note?.folder ?? "",
    link: note?.link ?? defaultLink,
  };

  return (
    <form action={action} className="stack" id="note-form" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={LABELS} />
      <TextField defaultValue={values.title} error={state.errors?.title} label={LABELS.title} name="title" />
      <TextareaField
        defaultValue={values.body}
        error={state.errors?.body}
        feedback
        label={LABELS.body}
        maxLength={20000}
        name="body"
        optional
        rows={12}
      />
      <div className="form__row form__row--2">
        <TextField
          defaultValue={values.folder}
          error={state.errors?.folder}
          help={
            folders.length > 0
              ? `To group notes. Your folders: ${folders.join(", ")}.`
              : "To group notes, for example by unit. Leave it empty for none."
          }
          label={LABELS.folder}
          name="folder"
          optional
        />
        <SelectField
          defaultValue={values.link}
          error={state.errors?.link}
          help="A material or session the note is about."
          label={LABELS.link}
          name="link"
          optional
          options={[{ value: "", label: "Nothing in particular" }, ...targets]}
        />
      </div>
      <div className="cluster cluster--between">
        <SubmitButton pendingLabel="Saving">Save note</SubmitButton>
      </div>
    </form>
  );
}

/** Deleting a note: it is gone for good, so it asks first. */
export function DeleteNote({ noteId, title }: { noteId: string; title: string }) {
  return (
    <form action={deleteNote.bind(null, noteId)} id="delete-note-form">
      <ConsequenceDialog
        cancelLabel="Keep it"
        confirmLabel="Delete the note"
        consequence={`"${title}" is deleted for good. Nobody else could see it, and nobody can bring it back.`}
        form="delete-note-form"
        title="Delete this note?"
        trigger={{ label: "Delete note", variant: "ghost" }}
      />
    </form>
  );
}
