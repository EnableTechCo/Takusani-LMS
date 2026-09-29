"use client";

import { useActionState } from "react";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { archiveCohort } from "./archival-actions";

const initial: FormState = {};

/** X-10: archive a cohort whose every condition is met, after the consequence dialog (FR-111, FR-112). */
export function ArchiveCohortForm({
  cohortId,
  cohortName,
  consequence,
}: {
  cohortId: string;
  cohortName: string;
  consequence: string;
}) {
  const [state, action] = useActionState(() => archiveCohort(cohortId), initial);
  const formId = `archive-${cohortId}`;
  return (
    <form action={action} className="stack" id={formId}>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <div>
        <ConsequenceDialog
          cancelLabel="Not yet"
          confirmLabel="Archive cohort"
          consequence={consequence}
          form={formId}
          title={`Archive ${cohortName}?`}
          trigger={{ label: "Archive cohort", variant: "secondary" }}
        />
      </div>
    </form>
  );
}
