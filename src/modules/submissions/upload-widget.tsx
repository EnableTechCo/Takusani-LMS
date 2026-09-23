"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as tus from "tus-js-client";
import { Button, IconButton } from "@/components/ui/button";
import { Banner } from "@/components/ui/status";
import { UploadDrop, UploadRow, type UploadState } from "@/components/ui/upload";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { authoriseUpload, finaliseUpload } from "./actions";
import { formatBytes, UPLOAD_REFUSALS } from "./rules";

/**
 * The learner's upload island (UX flow A, P0-04). The file goes straight from here to private Storage over the
 * resumable protocol (ADR-007), so a dropped connection carries on where it stopped instead of starting again.
 *
 * Every state is said in words. A pause is never called a failure, and a rejection says what to do instead. One
 * polite status line reports progress for the whole set; a row that needs the learner to act announces itself.
 */

const MEGABYTE = 1024 * 1024;
const CHUNK_SIZE = 6 * MEGABYTE; // The resumable endpoint takes 6 MB chunks.
const RETRY_DELAYS = [0, 3000, 5000, 10000, 20000];

export interface Requirement {
  id: string;
  title: string;
  guidance?: string | null;
  mandatory?: boolean | null;
}

export interface UploadedFile {
  fileId: string;
  requirementId: string | null;
  filename: string;
  bytes: number;
}

interface Row {
  key: string;
  requirementId: string | null;
  file?: File;
  filename: string;
  bytes: number;
  state: UploadState;
  sent: number;
  message?: string;
  fileId?: string;
  /** When paused, the moment the next attempt is due, so the row can say how long it will wait. */
  retryAt?: number;
}

const ACCEPTED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
];
const MAX_BYTES = 25 * MEGABYTE;

/** The browser's own view of the connection, read the way React wants an external value read. */
function subscribeToConnection(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function UploadWidget({
  taskId,
  requirements,
  already,
  onChange,
}: {
  taskId: string;
  requirements: Requirement[];
  /** Files uploaded earlier and not yet handed in; they survive a reload because the server remembers them. */
  already: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    already.map((file) => ({
      key: file.fileId,
      requirementId: file.requirementId,
      filename: file.filename,
      bytes: file.bytes,
      state: "uploaded" as UploadState,
      sent: file.bytes,
      fileId: file.fileId,
    })),
  );
  const offline = useSyncExternalStore(
    subscribeToConnection,
    () => !navigator.onLine,
    () => false,
  );
  const [now, setNow] = useState(() => Date.now());
  const uploads = useRef(new Map<string, tus.Upload>());

  const patch = useCallback(
    (key: string, change: Partial<Row>) =>
      setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row))),
    [],
  );

  // Report the finished files upward, so the submit button knows what it would hand in.
  useEffect(() => {
    onChange(
      rows
        .filter((row) => row.state === "uploaded" && row.fileId)
        .map((row) => ({
          fileId: row.fileId!,
          requirementId: row.requirementId,
          filename: row.filename,
          bytes: row.bytes,
        })),
    );
  }, [rows, onChange]);

  // A paused row says how long it will wait, so the count has to tick.
  useEffect(() => {
    if (!rows.some((row) => row.state === "paused" && row.retryAt)) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [rows]);

  const start = useCallback(
    async (row: Row) => {
      if (!row.file) return;
      patch(row.key, { state: "waiting", message: undefined });

      const authorised = await authoriseUpload({
        taskId,
        requirementId: row.requirementId,
        filename: row.file.name,
        mediaType: row.file.type || "application/octet-stream",
        bytes: row.file.size,
        clientUploadId: row.key,
      });
      if (!authorised.ok) {
        patch(row.key, { state: "rejected", message: authorised.message });
        return;
      }

      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        patch(row.key, { state: "rejected", message: UPLOAD_REFUSALS.unauthenticated });
        return;
      }

      const upload = new tus.Upload(row.file, {
        endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
        headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: CHUNK_SIZE,
        retryDelays: RETRY_DELAYS,
        metadata: {
          bucketName: authorised.bucket,
          objectName: authorised.objectKey,
          contentType: row.file.type || "application/octet-stream",
        },
        onProgress: (sent) => patch(row.key, { state: "uploading", sent, retryAt: undefined }),
        onShouldRetry: (_error, attempt) => {
          // Not a failure: say it is waiting, and when it will try again.
          patch(row.key, { state: "paused", retryAt: Date.now() + (RETRY_DELAYS[attempt + 1] ?? 20000) });
          return attempt < RETRY_DELAYS.length - 1;
        },
        onSuccess: async () => {
          patch(row.key, { state: "checking" });
          const accepted = await finaliseUpload(authorised.intentId);
          if (accepted.ok) patch(row.key, { state: "uploaded", fileId: accepted.fileId, bytes: accepted.bytes });
          else patch(row.key, { state: "rejected", message: accepted.message });
        },
        onError: (error) => {
          const expired = new Date(authorised.expiresAt).getTime() < Date.now();
          patch(row.key, {
            state: expired ? "expired" : "rejected",
            message: expired ? UPLOAD_REFUSALS.expired : String(error.message ?? UPLOAD_REFUSALS.error),
          });
        },
      });

      uploads.current.set(row.key, upload);
      upload.start();
    },
    [patch, taskId],
  );

  const choose = (requirementId: string | null, files: FileList) => {
    for (const file of Array.from(files)) {
      const key = crypto.randomUUID();
      // Checked here first so an obviously wrong file is never uploaded; the server checks again (FR-311).
      const tooBig = file.size > MAX_BYTES;
      const wrongType = file.type && !ACCEPTED.includes(file.type);
      const row: Row = {
        key,
        requirementId,
        file,
        filename: file.name,
        bytes: file.size,
        sent: 0,
        state: tooBig || wrongType ? "rejected" : "waiting",
        message: tooBig
          ? `This file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_BYTES)}. Save it as a PDF, or take photos at a lower quality.`
          : wrongType
            ? "This kind of file is not accepted. Hand in a PDF, a Word or Excel file, or a photo (JPG or PNG)."
            : undefined,
      };
      setRows((current) => [...current, row]);
      if (row.state === "waiting") void start(row);
    }
  };

  const remove = useCallback((key: string) => {
    uploads.current.get(key)?.abort();
    uploads.current.delete(key);
    setRows((current) => current.filter((row) => row.key !== key));
  }, []);

  const retry = useCallback(
    (key: string) => {
      const row = rows.find((item) => item.key === key);
      if (row) void start({ ...row, state: "waiting" });
    },
    [rows, start],
  );

  const slots: { id: string | null; title: string; help: string; mandatory: boolean }[] = requirements.length
    ? requirements.map((requirement) => ({
        id: requirement.id,
        title: `Add evidence for ${requirement.title}`,
        help: requirement.guidance ?? "PDF, Word, Excel, JPG or PNG. Up to 25 MB each.",
        mandatory: requirement.mandatory !== false,
      }))
    : [{ id: null, title: "Add your work", help: "PDF, Word, Excel, JPG or PNG. Up to 25 MB each.", mandatory: true }];

  const working = rows.filter((row) => ["waiting", "uploading", "resuming", "checking"].includes(row.state)).length;
  const done = rows.filter((row) => row.state === "uploaded").length;

  return (
    <div className="stack stack--lg">
      {offline ? (
        <Banner title="No connection" tone="caution">
          <p>Your uploads are waiting. They will carry on by themselves when you are back online.</p>
        </Banner>
      ) : null}

      <p className="status-line" role="status">
        {working > 0 ? (
          <>
            <span aria-hidden="true" className="spinner" />
            {done} of {done + working} files uploaded. Keep this page open.
          </>
        ) : done === 0 ? (
          "No files chosen yet."
        ) : (
          `${done} ${done === 1 ? "file" : "files"} ready to hand in.`
        )}
      </p>

      {slots.map((slot, index) => (
        <UploadDrop
          accept={ACCEPTED.join(",")}
          help={
            <>
              {slot.help} {slot.mandatory ? "" : "This one is optional."}
            </>
          }
          id={`upload-${index}`}
          key={slot.id ?? "any"}
          multiple
          onFiles={(files) => choose(slot.id, files)}
          title={slot.title}
        >
          {rows
            .filter((row) => row.requirementId === slot.id)
            .map((row) => (
              <UploadRow
                actions={<RowActions onRemove={remove} onRetry={retry} row={row} />}
                indeterminate={row.state === "checking"}
                key={row.key}
                name={row.filename}
                percent={
                  ["uploading", "paused", "resuming"].includes(row.state)
                    ? (row.sent / Math.max(row.bytes, 1)) * 100
                    : undefined
                }
                state={row.state}
                status={statusText(row, now)}
              />
            ))}
        </UploadDrop>
      ))}
    </div>
  );
}

/** The wording for each state, from design system 4.4. */
function statusText(row: Row, now: number): string {
  switch (row.state) {
    case "waiting":
      return `Waiting · ${formatBytes(row.bytes)}`;
    case "uploading":
      return `Uploading ${Math.round((row.sent / Math.max(row.bytes, 1)) * 100)}% · ${formatBytes(row.sent)} of ${formatBytes(row.bytes)}`;
    case "paused": {
      const seconds = row.retryAt ? Math.max(0, Math.ceil((row.retryAt - now) / 1000)) : 0;
      const when = seconds > 0 ? ` Trying again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.` : "";
      return `Paused at ${Math.round((row.sent / Math.max(row.bytes, 1)) * 100)}%, no connection. It will carry on by itself when you are back online.${when}`;
    }
    case "resuming":
      return `Resuming from ${Math.round((row.sent / Math.max(row.bytes, 1)) * 100)}%`;
    case "checking":
      return "Checking file";
    case "uploaded":
      return `Uploaded · ${formatBytes(row.bytes)}`;
    case "expired":
      return row.message ?? UPLOAD_REFUSALS.expired;
    case "rejected":
      return `Not accepted. ${row.message ?? UPLOAD_REFUSALS.error}`;
  }
}

/** What a row offers: try now while paused, dismiss a refusal, remove a finished file, stop one in flight. */
function RowActions({
  row,
  onRemove,
  onRetry,
}: {
  row: Row;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
}) {
  if (row.state === "paused") {
    return (
      <Button onClick={() => onRetry(row.key)} size="sm">
        Try now
      </Button>
    );
  }
  if (row.state === "expired" || row.state === "rejected") {
    return <IconButton icon="x" label={`Dismiss ${row.filename}`} onClick={() => onRemove(row.key)} size="sm" />;
  }
  if (row.state === "uploaded") {
    return <IconButton icon="trash" label={`Remove ${row.filename}`} onClick={() => onRemove(row.key)} size="sm" />;
  }
  return <IconButton icon="x" label={`Stop uploading ${row.filename}`} onClick={() => onRemove(row.key)} size="sm" />;
}
