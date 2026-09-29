"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextareaField } from "@/components/ui/field";
import { ErrorSummary } from "@/components/ui/form-feedback";
import { Banner, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatTime } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { saveRegister } from "./register-actions";
import {
  checkinSummary,
  initialMarks,
  MARK_LABELS,
  registerSummary,
  type Mark,
  type RosterEntry,
} from "./register-rules";

/**
 * F-07 register (FR-209). Before it is confirmed, the learners' own check-ins fill it in (checked in: present;
 * not: absent), the facilitator changes any mark that is wrong, and every learner is confirmed at once. Once
 * confirmed, a change is an amendment: only the marks that differ are saved, with the reason, and the version the
 * facilitator saw stops them saving over someone else's changes.
 */
export function RegisterForm({
  sessionId,
  version,
  roster,
}: {
  sessionId: string;
  version: number;
  roster: RosterEntry[];
}) {
  const [state, action, pending] = useActionState(saveRegister.bind(null, sessionId), {} as FormState);
  const captured = version > 0;
  const saved = new Map(roster.map((entry) => [entry.learner_id, entry.status]));
  const [marks, setMarks] = useState<Map<string, Mark | null>>(() => {
    const values = state.values ?? {};
    const initial = initialMarks(roster, captured);
    return new Map(
      roster.map((entry) => [
        entry.learner_id,
        (values[`mark:${entry.learner_id}`] as Mark) ?? initial.get(entry.learner_id) ?? null,
      ]),
    );
  });
  const changed = roster.filter((entry) => marks.get(entry.learner_id) !== saved.get(entry.learner_id)).length;
  const unmarked = roster.filter((entry) => !marks.get(entry.learner_id)).length;
  const set = (learnerId: string, mark: Mark) => setMarks((current) => new Map(current).set(learnerId, mark));

  // Dispatched here rather than through the form's action, which resets the form afterwards: the radios would go back
  // to the marks first loaded while this component still shows the facilitator's, and a retry would send the old ones.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  };

  return (
    <form className="stack" noValidate onSubmit={submit}>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ reason: "Reason for the change" }} />
      <input name="expectedVersion" type="hidden" value={version} />

      <div className="cluster cluster--between">
        <p aria-live="polite" className="text-small">
          {captured ? "" : `${checkinSummary(roster)}. `}
          {registerSummary(roster.map((entry) => ({ status: marks.get(entry.learner_id) ?? null })))}
          {captured && changed > 0 ? `. ${changed} ${changed === 1 ? "change" : "changes"} not saved yet.` : "."}
        </p>
        {!captured && unmarked > 0 ? (
          <Button
            onClick={() =>
              setMarks(
                (current) => new Map([...current].map(([learnerId, mark]) => [learnerId, mark ?? ("present" as Mark)])),
              )
            }
            size="sm"
            variant="secondary"
          >
            Mark everyone else present
          </Button>
        ) : null}
      </div>

      <DataTable
        caption="The session's roster: each learner's check-in, and present or absent."
        // One table at every width: the card list would repeat each learner's radios under the same name, and two
        // radio groups sharing a name fight over which one is checked.
        cards={false}
        columns={[
          {
            key: "learner",
            header: "Learner",
            primary: true,
            cell: (entry) => (
              <>
                {entry.full_name}
                <span className="table__secondary">
                  {entry.learner_number ? <span className="mono">{entry.learner_number}</span> : null}
                  {entry.enrolled ? null : <Tag>Left the cohort</Tag>}
                </span>
              </>
            ),
          },
          {
            key: "checkin",
            header: "Checked in",
            cell: (entry) =>
              entry.checked_in_at ? (
                <Tag shape="check" tone="info">
                  {formatTime(entry.checked_in_at)}
                </Tag>
              ) : (
                <span className="text-muted">No</span>
              ),
          },
          {
            key: "mark",
            header: "Attendance",
            cell: (entry) => (
              <div aria-label={`${entry.full_name}: present or absent`} className="cluster" role="radiogroup">
                {(["present", "absent"] as Mark[]).map((mark) => (
                  <label className="check" key={mark}>
                    <input
                      checked={marks.get(entry.learner_id) === mark}
                      className="check__input"
                      name={`mark:${entry.learner_id}`}
                      onChange={() => set(entry.learner_id, mark)}
                      type="radio"
                      value={mark}
                    />
                    <span className="check__label">{MARK_LABELS[mark]}</span>
                  </label>
                ))}
              </div>
            ),
          },
          ...(captured
            ? [
                {
                  key: "saved",
                  header: "Saved",
                  cell: (entry: RosterEntry) => (entry.status ? MARK_LABELS[entry.status] : "Not marked"),
                },
              ]
            : []),
        ]}
        rowKey={(entry) => entry.learner_id}
        rows={roster}
      />

      {captured ? (
        <TextareaField
          defaultValue={state.values?.reason}
          error={state.errors?.reason}
          help="Kept with each change, with your name and the time. For example: arrived late and signed the paper register."
          label="Reason for the change"
          name="reason"
          rows={2}
        />
      ) : null}

      <div className="cluster">
        <Button loading={pending} loadingLabel={captured ? "Saving" : "Confirming"} type="submit" variant="primary">
          {captured ? (changed === 1 ? "Save the change" : "Save the changes") : "Confirm register"}
        </Button>
        {!captured && unmarked > 0 ? (
          <span className="text-small text-muted">
            {unmarked === 1 ? "1 learner is" : `${unmarked} learners are`} not marked yet.
          </span>
        ) : null}
      </div>
    </form>
  );
}
