"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Tag } from "@/components/ui/status";
import { formatTime } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { markMyAttendance } from "./attendance-actions";

/**
 * "I'm here" (L-01, L-07; FR-209): one press marks the learner present at a session that is on. Afterwards the
 * time is shown in its place; the facilitator confirms the register later. A refusal is said in words beside it.
 */
export function CheckInButton({
  sessionId,
  sessionTitle,
  checkedInAt,
}: {
  sessionId: string;
  sessionTitle: string;
  checkedInAt: string | null;
}) {
  const [state, action, pending] = useActionState(() => markMyAttendance(sessionId), {} as FormState);
  const at = state.values?.checkedInAt ?? checkedInAt;

  if (at) {
    return (
      <span className="agenda__meta">
        <Tag shape="check" tone="info">
          Checked in {formatTime(at)}
        </Tag>
        <span className="text-small text-muted">Your facilitator confirms the register.</span>
      </span>
    );
  }

  return (
    <form action={action} className="cluster">
      <Button
        icon="check"
        loading={pending}
        loadingLabel="Marking you present"
        size="sm"
        type="submit"
        variant="primary"
      >
        I&apos;m here<span className="u-visually-hidden"> at {sessionTitle}</span>
      </Button>
      {state.message ? (
        <span className="text-small" role="alert">
          <Icon className="icon icon--sm" name="info" /> {state.message}
        </span>
      ) : null}
    </form>
  );
}
