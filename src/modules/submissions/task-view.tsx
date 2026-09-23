import { Icon } from "@/components/ui/icons";
import { Tag } from "@/components/ui/status";
import { formatDateTime, sastDaysFromToday } from "@/lib/dates";
import type { Criterion, Requirement } from "./types";

/**
 * The parts of the learner's task page that only display (screen L-03). The due date is written as a sentence with
 * what happens after it, never as a bare timestamp, and a late version is marked in words as well as by tone.
 */

export interface Version {
  version_number: number;
  submitted_at: string;
  is_late: boolean;
  receipt_reference: string;
  files: { filename: string; bytes: number; requirement_id: string | null }[];
}

/**
 * "Due Friday 4 September 2026 at 17:00 (SAST), in 8 days. Work submitted after 17:00 is marked as late." `now` is
 * passed in, read once per request by the page, so the component stays a pure function of what it is given.
 */
export function DueLine({ dueAt, latePolicy, now }: { dueAt: string | null; latePolicy: string; now: Date }) {
  if (!dueAt) return null;
  const passed = new Date(dueAt).getTime() <= now.getTime();
  const days = sastDaysFromToday(dueAt, now);
  const left = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const closes = latePolicy === "closed_at_due";
  return (
    <p className={passed ? "deadline-line deadline-line--closed" : "deadline-line"}>
      <Icon name={passed && closes ? "lock" : "clock"} />
      <span>
        {passed ? "This task was due " : "Due "}
        <span className="deadline-line__date">{formatDateTime(dueAt)}</span> (SAST)
        {passed ? ". " : ", "}
        {!passed ? <span className="deadline-line__left">{left}</span> : null}
        {!passed ? ". " : ""}
        {closes
          ? passed
            ? "It is closed, so nothing more can be handed in."
            : "Nothing can be handed in after that time."
          : passed
            ? "You can still hand work in. It will be marked as late."
            : "Work handed in after that time is marked as late."}
      </span>
    </p>
  );
}

export function CriteriaList({ criteria }: { criteria: Criterion[] }) {
  if (criteria.length === 0) return <p className="text-muted">No marking criteria were set for this task.</p>;
  return (
    <ol className="stack stack--sm">
      {criteria.map((criterion, index) => (
        <li className="card" key={index}>
          <div className="card__body stack stack--sm">
            <p className="card__title">
              {criterion.title}
              {criterion.points === null || criterion.points === undefined ? "" : ` · ${criterion.points} points`}
            </p>
            {criterion.descriptor ? <p className="text-small">{criterion.descriptor}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** What to hand in, and whether the latest version answered it. */
export function RequirementChecklist({
  requirements,
  latest,
}: {
  requirements: Requirement[];
  latest?: Version | null;
}) {
  if (requirements.length === 0) {
    return <p className="text-muted">This task asks for no particular files.</p>;
  }
  return (
    <ul className="checklist" aria-label="What to hand in">
      {requirements.map((requirement) => {
        const answered = latest?.files.some((file) => file.requirement_id === requirement.id) ?? false;
        return (
          <li className={answered ? "checklist__item checklist__item--pass" : "checklist__item"} key={requirement.id}>
            <Icon className="icon checklist__icon" name={answered ? "check-circle" : "info"} />
            <span className="checklist__title">{requirement.title}</span>
            {answered ? (
              <Tag tone="positive">Handed in</Tag>
            ) : requirement.mandatory === false ? (
              <Tag plain>Optional</Tag>
            ) : (
              <Tag>Needed</Tag>
            )}
            {requirement.guidance ? <span className="checklist__detail">{requirement.guidance}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Every version, newest first. A superseded version is never removed (FR-310). */
export function VersionHistory({ versions }: { versions: Version[] }) {
  if (versions.length === 0) {
    return <p className="text-muted">You have not handed anything in for this task yet.</p>;
  }
  return (
    <ol className="history-list" aria-label="Your versions, newest first">
      {versions.map((version, index) => (
        <li
          className={index === 0 ? "history-list__item is-current" : "history-list__item"}
          key={version.version_number}
        >
          <span className="history-list__badge">v{version.version_number}</span>
          <span className="history-list__title">
            Version {version.version_number} {version.is_late ? <Tag tone="caution">Late</Tag> : null}
          </span>
          <span className="history-list__meta">
            {formatDateTime(version.submitted_at)} · {version.files.length}{" "}
            {version.files.length === 1 ? "file" : "files"} · receipt{" "}
            <span className="mono">{version.receipt_reference}</span>
            {index > 0 ? ` · replaced by version ${versions[index - 1].version_number}, kept on record` : ""}
          </span>
          <span className="history-list__actions">{index === 0 ? <Tag plain>Current</Tag> : null}</span>
        </li>
      ))}
    </ol>
  );
}
