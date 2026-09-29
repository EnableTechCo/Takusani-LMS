import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CreditUnitRow, HistoryRow } from "./record-rules";

// The learner's credits record (L-19). Both reads are the signed-in learner's own; the database decides what is
// visible (FR-804).

export async function getMyCredits(): Promise<CreditUnitRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_credits");
  if (error) throw new Error(`api.get_my_credits failed: ${error.message}`);
  return (data ?? []) as unknown as CreditUnitRow[];
}

export async function listMyCreditHistory(): Promise<HistoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_credit_history");
  if (error) throw new Error(`api.list_my_credit_history failed: ${error.message}`);
  return data ?? [];
}
