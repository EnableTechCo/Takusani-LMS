import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/programmes/rules";
import type { RequirementItem, RequirementSet, RequirementUnit } from "./requirement-rules";

// Unit credit requirements (S6-01; P-07). The database scopes the requirements to coordinators of the cohort and the
// reconciliation to administrators.

export async function getCohortCreditRequirements(cohortId: string) {
  if (!isUuid(cohortId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_cohort_credit_requirements", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.get_cohort_credit_requirements failed: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;
  return {
    cohortId: row.cohort_id,
    cohortName: row.cohort_name,
    cohortStatus: row.cohort_status,
    units: (row.units ?? []) as unknown as RequirementUnit[],
    items: (row.items ?? []) as unknown as RequirementItem[],
    sets: (row.sets ?? []) as unknown as RequirementSet[],
  };
}

export interface ReconciliationDifference {
  found_at: string;
  kind: string;
  learner_name: string;
  unit_code: string;
  unit_title: string;
}

export async function getCreditReconciliation() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_credit_reconciliation");
  if (error) throw new Error(`api.get_credit_reconciliation failed: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;
  return {
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    lastSuccessAt: row.last_success_at,
    lastDifferences: row.last_differences ?? 0,
    differences: (row.differences ?? []) as unknown as ReconciliationDifference[],
  };
}
