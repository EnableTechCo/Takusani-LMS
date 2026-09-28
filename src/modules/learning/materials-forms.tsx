"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Checkbox, Radio, Fieldset } from "@/components/ui/choice";
import { SelectField, TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { UploadWidget, type UploadedFile } from "@/modules/submissions/upload-widget";
import {
  attachMaterialFile,
  createMaterial,
  logMaterialAccess,
  publishMaterial,
  updateMaterial,
} from "./materials-actions";
import { MATERIAL_TYPES, RECORDING_TYPES } from "./materials-rules";

const initial: FormState = {};

/**
 * F-04 new material or recording (FR-204, FR-208): the cohort, what kind it is, and what it is called. The content and
 * module come next, on the edit page.
 */
export function NewMaterialForm({ cohorts }: { cohorts: { id: string; label: string }[] }) {
  const [state, action] = useActionState(createMaterial, initial);
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ cohortId: "Cohort", title: "Title" }} />
      <SelectField
        defaultValue={state.values?.cohortId}
        error={state.errors?.cohortId}
        help="Learners enrolled in this cohort see the material once it is released."
        label="Cohort"
        name="cohortId"
        options={cohorts.map((cohort) => ({ value: cohort.id, label: cohort.label }))}
        placeholder="Choose a cohort"
      />
      <Fieldset legend="What are you adding?">
        <Radio
          defaultChecked={state.values?.category !== "recording"}
          label="Material"
          help="A document, a presentation, an image or a link."
          name="category"
          value="material"
        />
        <Radio
          defaultChecked={state.values?.category === "recording"}
          label="Lecture recording"
          help="A link to where the recording is kept is best; an upload is limited in size."
          name="category"
          value="recording"
        />
      </Fieldset>
      <TextField defaultValue={state.values?.title} error={state.errors?.title} label="Title" name="title" />
      <TextareaField
        defaultValue={state.values?.description}
        help="What it is and when to use it. Learners can search these words."
        label="Description"
        name="description"
        optional
        rows={4}
      />
      <div className="cluster">
        <SubmitButton pendingLabel="Creating the draft">Create draft</SubmitButton>
      </div>
    </form>
  );
}

/** Title, description, module and (instead of a file) a link. A recording also says whether it has captions. */
export function MaterialDetailsForm({
  material,
  modules,
}: {
  material: {
    id: string;
    title: string;
    description: string;
    module_id: string | null;
    link_url: string | null;
    category: string;
    has_captions: boolean;
  };
  modules: { id: string; label: string }[];
}) {
  const recording = material.category === "recording";
  const [state, action] = useActionState(updateMaterial.bind(null, material.id), initial);
  const values = state.values ?? {
    title: material.title,
    description: material.description,
    moduleId: material.module_id ?? "",
    linkUrl: material.link_url ?? "",
    hasCaptions: material.has_captions ? "on" : "",
  };
  return (
    <form action={action} className="stack" noValidate>
      {state.done ? <Banner compact title="Saved" tone="positive" /> : null}
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ title: "Title", linkUrl: "Link" }} />
      <TextField defaultValue={values.title} error={state.errors?.title} label="Title" name="title" />
      <TextareaField defaultValue={values.description} label="Description" name="description" optional rows={4} />
      <SelectField
        defaultValue={values.moduleId}
        help="Learners find material grouped by module."
        label="Module"
        name="moduleId"
        optional
        options={modules.map((module) => ({ value: module.id, label: module.label }))}
        placeholder="No module"
      />
      <TextField
        defaultValue={values.linkUrl}
        error={state.errors?.linkUrl}
        help={
          recording
            ? "Preferred: where the recording is kept, for example Teams, Stream, OneDrive or YouTube. It plays from there. It must start with https://. Saving a link replaces an uploaded file."
            : "Instead of a file: a web page, a video or a recording. It must start with https://. Saving a link replaces a file."
        }
        inputMode="text"
        label={recording ? "Link to the recording" : "Link"}
        name="linkUrl"
        optional
        type="url"
      />
      {recording ? (
        <>
          <input name="category" type="hidden" value="recording" />
          <Fieldset legend="Captions">
            <Checkbox
              defaultChecked={values.hasCaptions === "on"}
              help="Learners are told when a recording has no captions or transcript, so those who need them know before they open it."
              label="Captions or a transcript are available"
              name="hasCaptions"
            />
          </Fieldset>
        </>
      ) : null}
      <div className="cluster">
        <SubmitButton pendingLabel="Saving">Save details</SubmitButton>
      </div>
    </form>
  );
}

/**
 * The material's file: the same resumable upload learners use for their work (ADR-007), into the materials bucket, or
 * for a recording into the recordings bucket (S3-12). Each file that finishes uploading becomes the material's
 * content; uploading another replaces it.
 */
export function MaterialFileUpload({
  materialId,
  maxMb = 25,
  recording = false,
}: {
  materialId: string;
  maxMb?: number;
  recording?: boolean;
}) {
  const router = useRouter();
  const attached = useRef(new Set<string>());
  const [message, setMessage] = useState<string | null>(null);

  const onChange = (files: UploadedFile[]) => {
    const latest = files[files.length - 1];
    if (!latest || attached.current.has(latest.fileId)) return;
    attached.current.add(latest.fileId);
    void attachMaterialFile(materialId, latest.fileId).then((result) => {
      setMessage(result.ok ? null : result.message);
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="stack">
      {message ? <Banner title={message} tone="critical" /> : null}
      <UploadWidget
        accept={recording ? RECORDING_TYPES : MATERIAL_TYPES}
        already={[]}
        contextId={materialId}
        contextType="material"
        maxMb={maxMb}
        copy={
          recording
            ? {
                slotTitle: "Upload the recording",
                help: `MP4 or WebM video, MP3 or M4A audio. Up to ${maxMb} MB, so a short recording only. A link, added under Details, suits anything longer and plays from where it is kept. A new file replaces the current one.`,
                ready: (count) => `${count} ${count === 1 ? "recording" : "recordings"} uploaded.`,
              }
            : {
                slotTitle: "Upload a file",
                help: `PDF, Word, Excel, PowerPoint, JPG or PNG. Up to ${maxMb} MB. A new file replaces the current one.`,
                ready: (count) => `${count} ${count === 1 ? "file" : "files"} uploaded.`,
              }
        }
        onChange={onChange}
        removable={false}
        requirements={[]}
      />
    </div>
  );
}

/** Publish now, or schedule for a later time (FR-204). A scheduled material can be moved or released at once. */
export function PublishForm({ materialId, scheduled }: { materialId: string; scheduled: boolean }) {
  const [state, action] = useActionState(publishMaterial.bind(null, materialId), initial);
  const [when, setWhen] = useState<"now" | "later">("now");
  return (
    <form action={action} className="stack" noValidate>
      {state.done ? <Banner compact title="Saved" tone="positive" /> : null}
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ releaseAt: "Release time" }} />
      <Fieldset legend={scheduled ? "Change when learners can see it" : "When can learners see it?"}>
        <div onChange={(event) => setWhen((event.target as HTMLInputElement).value as "now" | "later")}>
          <Radio defaultChecked label="Now" name="when" value="now" />
          <Radio label="At a later time" name="when" value="later" />
        </div>
      </Fieldset>
      {when === "later" ? (
        <TextField
          error={state.errors?.releaseAt}
          help="South African time. It appears to learners at this time without anyone doing anything."
          label="Release time"
          name="releaseAt"
          type="datetime-local"
        />
      ) : null}
      <div className="cluster">
        <SubmitButton pendingLabel="Saving">
          {when === "later" ? "Schedule" : scheduled ? "Release now" : "Publish now"}
        </SubmitButton>
      </div>
    </form>
  );
}

/**
 * Records that the learner opened the material, once the page has loaded (FR-301). Off the render path and
 * fire-and-forget: if it fails, nothing is shown and the learner is not held up.
 */
export function AccessLogger({ materialId }: { materialId: string }) {
  useEffect(() => {
    void logMaterialAccess(materialId).catch(() => undefined);
  }, [materialId]);
  return null;
}
