import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/link";
import { EmptyState, Meter, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime, formatTime } from "@/lib/dates";
import { durationText } from "@/modules/notifications/templates";
import { attendanceText, learnerRate, sessionAttendanceText, sessionRegisterTag } from "./attendance-rules";

/**
 * A cohort's attendance (F-12, C-15; FR-209), server-rendered for the facilitator and the coordinator alike: each
 * learner's confirmed marks, lowest first, and each session's register with its state. The pages only choose where
 * the register link goes.
 */

export interface LearnerAttendanceRow {
  learner_id: string;
  full_name: string;
  learner_number: string | null;
  enrolled: boolean;
  sessions: number;
  present: number;
  absent: number;
  last_absent_at: string | null;
}

export function LearnerAttendanceTable({ rows, cohortName }: { rows: LearnerAttendanceRow[]; cohortName: string }) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <EmptyState icon="users" title="Nobody is enrolled in this cohort">
          <p>Attendance appears here once learners are enrolled and a register is confirmed.</p>
        </EmptyState>
      </div>
    );
  }
  return (
    <DataTable
      caption={`Attendance of each learner in ${cohortName}, lowest first. Only confirmed registers count.`}
      columns={[
        {
          key: "learner",
          header: "Learner",
          primary: true,
          cell: (row) => (
            <>
              {row.full_name}
              <span className="table__secondary">
                {row.learner_number ? <span className="mono">{row.learner_number}</span> : null}
                {row.enrolled ? null : <Tag>Left the cohort</Tag>}
              </span>
            </>
          ),
        },
        {
          key: "rate",
          header: "Attendance",
          cell: (row) => {
            const rate = learnerRate(row);
            return rate.percent === null ? (
              <span className="text-muted">No register confirmed yet</span>
            ) : (
              <Meter
                caution={rate.percent < 50}
                label={`${row.full_name}: present at ${rate.present} of ${rate.sessions}`}
                max={rate.sessions}
                value={rate.present}
                valueText={`${rate.percent}%`}
              />
            );
          },
        },
        { key: "present", header: "Present", numeric: true, cell: (row) => row.present },
        { key: "absent", header: "Absent", numeric: true, cell: (row) => row.absent },
        {
          key: "last",
          header: "Last absent (SAST)",
          cell: (row) => (row.last_absent_at ? formatDateTime(row.last_absent_at) : "Never"),
        },
      ]}
      rowKey={(row) => row.learner_id}
      rows={rows}
    />
  );
}

export interface RegisterRow {
  session_id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  mode: string;
  venue: string | null;
  state: string;
  register_version: number;
  checkin_state: string;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
  audience: number;
  checked_in: number;
  present: number;
  absent: number;
}

export function RegistersTable({
  rows,
  registerHref,
}: {
  rows: RegisterRow[];
  /** Where "Confirm" or "Open" goes, or undefined for a reader who does not take registers. */
  registerHref?: (row: RegisterRow) => string;
}) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <EmptyState icon="calendar" title="No sessions have started yet">
          <p>
            Each session appears here once it starts, with who has checked in and whether the register is confirmed.
          </p>
        </EmptyState>
      </div>
    );
  }
  return (
    <DataTable
      caption="Sessions that have started, latest first, each with its register. Times in SAST."
      columns={[
        {
          key: "session",
          header: "Session",
          primary: true,
          cell: (row) => (
            <>
              {row.title}
              <span className="table__secondary">
                {formatDateTime(row.starts_at)} · {durationText(row.duration_minutes)} ·{" "}
                {row.mode === "online" ? "Teams" : row.venue}
              </span>
            </>
          ),
        },
        {
          key: "attendance",
          header: "Attendance",
          cell: (row) => {
            const tag = sessionRegisterTag(row);
            return (
              <>
                {sessionAttendanceText(row)}
                {tag ? (
                  <span className="table__secondary">
                    <Tag tone={tag.tone}>{tag.label}</Tag>
                  </span>
                ) : null}
              </>
            );
          },
        },
        {
          key: "confirmed",
          header: "Confirmed",
          cell: (row) =>
            row.confirmed_at ? (
              <>
                {formatDateTime(row.confirmed_at)}
                <span className="table__secondary">{row.confirmed_by_name}</span>
              </>
            ) : (
              <span className="text-muted">Not yet</span>
            ),
        },
        ...(registerHref
          ? [
              {
                key: "open",
                header: "Actions",
                actions: true,
                cell: (row: RegisterRow) => (
                  <ButtonLink
                    href={registerHref(row)}
                    size="sm"
                    variant={row.register_version === 0 ? "primary" : "secondary"}
                  >
                    {row.register_version === 0 ? "Confirm" : "Open"}
                    <span className="u-visually-hidden"> the register for {row.title}</span>
                  </ButtonLink>
                ),
              },
            ]
          : []),
      ]}
      rowKey={(row) => row.session_id}
      rows={rows}
    />
  );
}

/** The figures above a cohort's attendance: sessions confirmed, average attendance, registers to confirm. */
export function CohortAttendanceStats({
  learners,
  registers,
  children,
}: {
  learners: LearnerAttendanceRow[];
  registers: RegisterRow[];
  children?: ReactNode;
}) {
  const confirmed = registers.filter((row) => row.register_version > 0);
  const toConfirm = registers.filter((row) => row.register_version === 0);
  const marks = learners.reduce((sum, row) => sum + row.sessions, 0);
  const present = learners.reduce((sum, row) => sum + row.present, 0);
  const average = marks === 0 ? null : Math.round((present / marks) * 100);
  return (
    <div className="grid grid--4" role="list">
      <div className="stat" role="listitem">
        <span className="stat__label">Registers confirmed</span>
        <span className="stat__value">{confirmed.length}</span>
        <span className="stat__meta">
          {confirmed.length === 0
            ? "None yet"
            : `Latest ${formatTime(confirmed[0].confirmed_at ?? confirmed[0].starts_at)}, ${formatDateTime(confirmed[0].starts_at).split(",")[0]}`}
        </span>
      </div>
      <div className="stat" role="listitem">
        <span className="stat__label">Registers to confirm</span>
        <span className="stat__value">{toConfirm.length}</span>
        <span className="stat__meta">{toConfirm.length === 0 ? "All done" : "Sessions that have started"}</span>
      </div>
      <div className="stat" role="listitem">
        <span className="stat__label">Average attendance</span>
        <span className="stat__value">{average === null ? "–" : `${average}%`}</span>
        <span className="stat__meta">
          {average === null ? "No register confirmed yet" : `${present} present of ${marks} marks`}
        </span>
      </div>
      {children}
    </div>
  );
}

/** One line for a cohort card: the average and how many registers stand behind it. */
export function cohortAttendanceLine(learners: { sessions: number; present: number }[]): string {
  const marks = learners.reduce((sum, row) => sum + row.sessions, 0);
  const present = learners.reduce((sum, row) => sum + row.present, 0);
  return attendanceText(
    { sessions: marks, present, percent: marks === 0 ? null : Math.round((present / marks) * 100) },
    "they",
  ).replace(/^Present at (\d+) of (\d+) sessions? \((\d+)%\)$/, "$3% ($1 of $2 marks)");
}
