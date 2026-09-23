"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { BlockedReason } from "@/components/ui/link";
import { Banner } from "@/components/ui/status";
import { submitTask } from "./actions";
import { formatBytes } from "./rules";
import type { Requirement } from "./types";
import { UploadWidget, type UploadedFile } from "./upload-widget";

/**
 * The submit step of the learner's task (UX flow A, steps 3 to 9). Files go up first; the review line says which
 * version this will be and what happens to the last one; submitting is one command that can be retried with the
 * same identifier, so a lost reply never hands the same work in twice.
 */
export function SubmitForm({
  taskId,
  requirements,
  already,
  nextVersion,
  willBeLate,
  latePolicySentence,
}: {
  taskId: string;
  requirements: Requirement[];
  already: UploadedFile[];
  nextVersion: number;
  /** The due date has passed and late work is accepted: the learner is told before they submit, not after. */
  willBeLate: boolean;
  latePolicySentence: string;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>(already);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // The same attempt identifier for every retry of this submission (UX flow A, E7).
  const attempt = useRef(crypto.randomUUID());

  const onChange = useCallback((uploaded: UploadedFile[]) => setFiles(uploaded), []);

  const missing = requirements.filter(
    (requirement) => requirement.mandatory !== false && !files.some((file) => file.requirementId === requirement.id),
  );
  const blocked = files.length === 0 || missing.length > 0;
  const blockedReason =
    files.length === 0
      ? "Choose at least one file before you submit."
      : missing.length === 1
        ? `${missing[0].title} is still needed.`
        : missing.length > 1
          ? `These are still needed: ${missing.map((requirement) => requirement.title).join(", ")}.`
          : null;

  const submit = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await submitTask(
        taskId,
        files.map((file) => ({ fileId: file.fileId, requirementId: file.requirementId })),
        attempt.current,
      );
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      router.push(`/learn/tasks/${taskId}?receipt=${result.receipt}&version=${result.version}`);
    });

  return (
    <div className="stack stack--lg">
      {willBeLate ? (
        <Banner title="The due date has passed" tone="caution">
          <p>You can still submit. Your work will be marked as late. {latePolicySentence}.</p>
        </Banner>
      ) : null}
      {message ? <Banner title={message} tone="critical" /> : null}

      <section aria-labelledby="files-h" className="stack">
        <h2 className="text-heading" id="files-h">
          Step 1: add your files
        </h2>
        <UploadWidget already={already} onChange={onChange} requirements={requirements} taskId={taskId} />
      </section>

      <section aria-labelledby="review-h" className="stack">
        <h2 className="text-heading" id="review-h">
          Step 2: check and submit
        </h2>
        <p>
          This will be version {nextVersion}. {nextVersion > 1 ? `Version ${nextVersion - 1} stays on record.` : ""}
        </p>
        {files.length > 0 ? (
          <ul className="stack stack--sm">
            {files.map((file) => (
              <li className="cluster cluster--between" key={file.fileId}>
                <span>{file.filename}</span>
                <span className="text-meta mono">{formatBytes(file.bytes)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {blockedReason ? <BlockedReason id="submit-blocked">{blockedReason}</BlockedReason> : null}
        <div className="cluster">
          <Button
            aria-describedby={blockedReason ? "submit-blocked" : undefined}
            disabled={blocked}
            loading={pending}
            loadingLabel="Checking whether your work went through"
            onClick={submit}
            variant="primary"
          >
            Submit version {nextVersion}
          </Button>
        </div>
      </section>
    </div>
  );
}
