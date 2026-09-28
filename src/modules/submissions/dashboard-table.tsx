"use client";

import Link from "next/link";
import { useActionState, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextareaField } from "@/components/ui/field";
import { Banner, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { sendReminder, type ReminderState } from "./dashboard-actions";
import { lateBy, statusLabel, type TaskRow } from "./dashboard-rules";

const initial: ReminderState = {};

function StatusCell({ row, dueAt, now }: { row: TaskRow; dueAt: string | null; now: Date }) {
  const label = statusLabel(row.status, dueAt, now);
  const tone =
    row.status === "submitted"
      ? "positive"
      : row.status === "late"
        ? "caution"
        : label.includes("overdue")
          ? "caution"
          : "neutral";
  return (
    <>
      <Tag tone={tone}>{label}</Tag>
      {row.status === "late" && lateBy(row.late_by_seconds) ? (
        <span className="table__secondary">{lateBy(row.late_by_seconds)}</span>
      ) : null}
      {row.files_waiting ? <span className="table__secondary">Files uploaded, not yet handed in</span> : null}
    </>
  );
}

/**
 * The learners of one task (F-08), with selection and the reminder (F-10, FR-212). Only learners who have not handed
 * in can be selected: a reminder is for them. The dialog names who it goes to and says it is logged on each record.
 */
export function SubmissionTable({
  taskId,
  taskTitle,
  dueAt,
  rows,
  nowIso,
}: {
  taskId: string;
  taskTitle: string;
  dueAt: string | null;
  rows: TaskRow[];
  nowIso: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Once sent, the selection is cleared; the page refreshes with the new "last reminder" times.
  const [state, action] = useActionState(async (previous: ReminderState, form: FormData) => {
    const result = await sendReminder(taskId, previous, form);
    if (result.done) setSelected(new Set());
    return result;
  }, initial);
  const formId = useId();
  const outstanding = rows.filter((row) => row.status === "outstanding");
  const chosen = outstanding.filter((row) => selected.has(row.learner_id));
  const overdue = dueAt !== null && new Date(dueAt).getTime() <= now.getTime();
  const defaultMessage = overdue
    ? `${taskTitle} was due on ${formatDateTime(dueAt!)} (SAST) and we have not received it. Please hand it in as soon as you can, or tell me if something is in the way.`
    : `A reminder that ${taskTitle} is due on ${dueAt ? `${formatDateTime(dueAt)} (SAST)` : "its due date"}. Please hand it in on time.`;

  const toggle = (learnerId: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(learnerId)) next.delete(learnerId);
      else next.add(learnerId);
      return next;
    });

  return (
    <div className="stack">
      {state.done ? (
        <Banner
          role="status"
          title={`Reminder sent to ${state.sent ?? 0} ${state.sent === 1 ? "learner" : "learners"}`}
          tone="positive"
        >
          <p>
            It is logged on each learner&apos;s record.
            {(state.skippedSubmitted ?? 0) > 0
              ? ` ${state.skippedSubmitted} had handed in by then and ${state.skippedSubmitted === 1 ? "was" : "were"} not reminded.`
              : ""}
            {(state.skippedRecent ?? 0) > 0
              ? ` ${state.skippedRecent} had been reminded in the last hour and ${state.skippedRecent === 1 ? "was" : "were"} not reminded again.`
              : ""}
          </p>
        </Banner>
      ) : null}

      <div className="cluster cluster--between">
        <p className="text-small" role="status">
          {chosen.length} selected
        </p>
        <div className="cluster">
          {outstanding.length > 0 ? (
            <Button
              onClick={() =>
                setSelected(
                  chosen.length === outstanding.length ? new Set() : new Set(outstanding.map((row) => row.learner_id)),
                )
              }
              size="sm"
              variant="secondary"
            >
              {chosen.length === outstanding.length
                ? "Clear selection"
                : `Select all outstanding (${outstanding.length})`}
            </Button>
          ) : null}
          {chosen.length > 0 ? (
            <Dialog
              footer={(close) => (
                <>
                  <Button onClick={close} variant="secondary">
                    Not now
                  </Button>
                  <Button form={formId} onClick={() => setTimeout(close, 0)} type="submit" variant="primary">
                    Send to {chosen.length} {chosen.length === 1 ? "learner" : "learners"}
                  </Button>
                </>
              )}
              title="Send a reminder"
              trigger={{ label: "Send reminder", variant: "primary" }}
            >
              <form action={action} className="stack" id={formId}>
                <p>
                  {chosen.length === 1
                    ? `To ${chosen[0].full_name}, who has not handed in ${taskTitle}.`
                    : `To ${chosen.length} learners who have not handed in ${taskTitle}.`}{" "}
                  They see it in the LMS, and it is logged on each learner&apos;s record.
                </p>
                {chosen.map((row) => (
                  <input key={row.learner_id} name="learnerId" type="hidden" value={row.learner_id} />
                ))}
                <TextareaField defaultValue={state.message ?? defaultMessage} label="Message" name="message" rows={5} />
              </form>
            </Dialog>
          ) : null}
        </div>
      </div>
      {state.error ? <Banner title={state.error} tone="critical" /> : null}

      <DataTable
        caption={`Learners and their submission status for ${taskTitle}, outstanding first. Times in SAST.`}
        columns={[
          {
            key: "select",
            header: "Select",
            cell: (row) =>
              row.status === "outstanding" ? (
                <label className="check check--bare">
                  <input
                    checked={selected.has(row.learner_id)}
                    className="check__input"
                    onChange={() => toggle(row.learner_id)}
                    type="checkbox"
                  />
                  <span className="u-visually-hidden">Select {row.full_name}</span>
                </label>
              ) : null,
          },
          {
            key: "learner",
            header: "Learner",
            primary: true,
            cell: (row) => (
              <>
                <Link className="link" href={`/teach/submissions/learners/${row.learner_id}`}>
                  {row.full_name}
                </Link>
                {row.learner_number ? <span className="table__secondary mono">{row.learner_number}</span> : null}
              </>
            ),
          },
          { key: "status", header: "Status", cell: (row) => <StatusCell dueAt={dueAt} now={now} row={row} /> },
          {
            key: "submitted",
            header: "Submitted (SAST)",
            cell: (row) => (row.submitted_at ? formatDateTime(row.submitted_at) : "Not submitted"),
          },
          { key: "version", header: "Version", numeric: true, cell: (row) => row.latest_version ?? "None" },
          {
            key: "reminder",
            header: "Last reminder (SAST)",
            cell: (row) => (row.last_reminder_at ? formatDateTime(row.last_reminder_at) : "None sent"),
          },
        ]}
        rowKey={(row) => row.learner_id}
        rows={rows}
      />
    </div>
  );
}
