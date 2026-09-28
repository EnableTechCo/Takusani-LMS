"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Radio, Fieldset } from "@/components/ui/choice";
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
import { MATERIAL_TYPES } from "./materials-rules";

const initial: FormState = {};

/** F-04 new material: the cohort and what it is called. The content and module come next, on the edit page. */
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

/** Title, description, module and (instead of a file) a link. */
export function MaterialDetailsForm({
  material,
  modules,
}: {
  material: { id: string; title: string; description: string; module_id: string | null; link_url: string | null };
  modules: { id: string; label: string }[];
}) {
  const [state, action] = useActionState(updateMaterial.bind(null, material.id), initial);
  const values = state.values ?? {
    title: material.title,
    description: material.description,
    moduleId: material.module_id ?? "",
    linkUrl: material.link_url ?? "",
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
        help="Instead of a file: a web page, a video or a recording. It must start with https://. Saving a link replaces a file."
        inputMode="text"
        label="Link"
        name="linkUrl"
        optional
        type="url"
      />
      <div className="cluster">
        <SubmitButton pendingLabel="Saving">Save details</SubmitButton>
      </div>
    </form>
  );
}

/**
 * The material's file: the same resumable upload learners use for their work (ADR-007), into the materials bucket.
 * Each file that finishes uploading becomes the material's content; uploading another replaces it.
 */
export function MaterialFileUpload({ materialId }: { materialId: string }) {
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
        accept={MATERIAL_TYPES}
        already={[]}
        contextId={materialId}
        contextType="material"
        copy={{
          slotTitle: "Upload a file",
          help: "PDF, Word, Excel, PowerPoint, JPG or PNG. Up to 25 MB. A new file replaces the current one.",
          ready: (count) => `${count} ${count === 1 ? "file" : "files"} uploaded.`,
        }}
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
