"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import { formatDateTime } from "@/lib/dates";
import { cancelImport, importNextChunk, uploadIntake, type UploadState } from "./import-actions";

const initial: UploadState = {};

/** X-05 new import: the cohort and the file. Checking the file creates nothing (flow G, steps 1 to 3). */
export function UploadIntakeForm({ cohorts }: { cohorts: { id: string; label: string }[] }) {
  const [state, action] = useActionState(uploadIntake, initial);
  return (
    <form action={action} className="stack" encType="multipart/form-data" noValidate>
      {state.duplicate ? (
        <Banner title="This exact file was already imported" tone="info">
          <p>
            It was imported on {formatDateTime(state.duplicate.createdAt)} by {state.duplicate.uploadedBy} (import{" "}
            <span className="mono">{state.duplicate.reference}</span>). Nothing has been imported again.{" "}
            <Link className="link" href={`/admin/imports/${state.duplicate.batchId}`}>
              View that import
            </Link>
          </p>
        </Banner>
      ) : null}
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ cohortId: "Cohort", file: "File" }} />
      <SelectField
        defaultValue={state.values?.cohortId}
        error={state.errors?.cohortId}
        help="Every learner in the file is enrolled in this cohort."
        label="Cohort"
        name="cohortId"
        options={cohorts.map((cohort) => ({ value: cohort.id, label: cohort.label }))}
        placeholder="Choose a cohort"
      />
      <Field
        error={state.errors?.file}
        help="A CSV file, up to 900 KB and 5,000 learners. The first row names the columns."
        label="File"
        name="file"
      >
        {(control) => <input {...control} accept=".csv,text/csv" className="input" type="file" />}
      </Field>
      <div className="cluster">
        <SubmitButton pendingLabel="Checking the file">Check the file</SubmitButton>
      </div>
    </form>
  );
}

/**
 * Imports the ready rows a chunk of 100 at a time, showing progress (flow G, step 6). Each chunk commits on its own,
 * so stopping part-way leaves whole groups imported and the rest ready; "Continue" picks up where it stopped.
 */
export function ImportRunner({
  batchId,
  ready,
  cohortName,
  canCancel,
}: {
  batchId: string;
  ready: number;
  cohortName: string;
  /** Nothing imported yet, so the file can still be withdrawn and fixed (flow G, D1). */
  canCancel: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function run() {
    setRunning(true);
    setConfirming(false);
    setMessage(null);
    try {
      for (;;) {
        const result = await importNextChunk(batchId);
        if (!result.ok) {
          setMessage(result.message);
          break;
        }
        setDone((count) => count + result.imported + result.failed);
        if (result.remaining === 0) break;
        if (result.claimed === 0) {
          setMessage(
            "Another window is importing this file. If it was closed, wait five minutes and continue: nothing will be imported twice.",
          );
          break;
        }
      }
    } catch {
      setMessage("The connection was lost. Continue when you are back online: nothing will be imported twice.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  const total = ready;
  const percent = total > 0 ? Math.round((Math.min(done, total) / total) * 100) : 0;

  return (
    <div className="stack">
      {message ? <Banner title={message} tone="caution" /> : null}
      {running ? (
        <div className="stack stack--sm" role="status">
          <p>
            Imported {Math.min(done, total)} of {total}. Keep this page open.
          </p>
          <div
            aria-label="Import progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percent}
            className="progress"
            role="progressbar"
          >
            <div className="progress__bar" style={{ ["--value" as string]: `${percent}%` }} />
          </div>
        </div>
      ) : confirming ? (
        <Banner
          actions={
            <>
              <Button onClick={run} variant="primary">
                Import {total} {total === 1 ? "learner" : "learners"}
              </Button>
              <Button onClick={() => setConfirming(false)} variant="secondary">
                Not yet
              </Button>
            </>
          }
          role="note"
          title={`This creates ${total} ${total === 1 ? "account" : "accounts"} and enrols ${total === 1 ? "it" : "them"} in ${cohortName}.`}
          tone="info"
        >
          <p>No invitation email is sent yet: email is switched off until go-live, and invitations are sent then.</p>
        </Banner>
      ) : (
        <div className="cluster">
          <Button onClick={() => setConfirming(true)} variant="primary">
            {done > 0
              ? `Continue: import the remaining ${total}`
              : `Import the ${total} ready ${total === 1 ? "row" : "rows"}`}
          </Button>
        </div>
      )}
      {canCancel && !running && done === 0 ? (
        <form action={cancelImport}>
          <input name="batchId" type="hidden" value={batchId} />
          <p className="text-small text-muted">
            Rather fix the file first? Nothing has been created yet.{" "}
            <Button size="sm" type="submit" variant="ghost">
              Cancel and fix the file first
            </Button>
          </p>
        </form>
      ) : null}
    </div>
  );
}
