"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { requestReportExport } from "./report-actions";
import type { ReportScope } from "./report-rules";

const initial: FormState = {};

/** Asks for the whole report as a CSV, built in the background (R-20). */
export function ExportReportForm({ type, scope }: { type: string; scope: ReportScope }) {
  const [state, action] = useActionState(requestReportExport.bind(null, type), initial);
  return (
    <form action={action} className="stack">
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <input name="programme" type="hidden" value={scope.programmeId ?? ""} />
      <input name="cohort" type="hidden" value={scope.cohortId ?? ""} />
      <input name="from" type="hidden" value={scope.from ?? ""} />
      <input name="to" type="hidden" value={scope.to ?? ""} />
      <div className="cluster">
        <SubmitButton pendingLabel="Asking">Export as CSV</SubmitButton>
      </div>
      <p className="text-small text-muted">
        The export is built in the background. You are told when it is ready, and can download it for 7 days.
      </p>
    </form>
  );
}
