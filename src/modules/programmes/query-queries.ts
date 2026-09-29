import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { QueryShow } from "./query-rules";
import { isUuid } from "./rules";

// C-10 (FR-704): the database shows only the queries the coordinator's scope covers.

export async function listStakeholderQueries(show: QueryShow) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_stakeholder_queries", { p_show: show });
  if (error) throw new Error(`api.list_stakeholder_queries failed: ${error.message}`);
  return data ?? [];
}

/** One query with its history and who it can be routed to, or null when the coordinator cannot see it. */
export async function getStakeholderQuery(queryId: string) {
  if (!isUuid(queryId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_stakeholder_query", { p_query_id: queryId });
  if (error) throw new Error(`api.get_stakeholder_query failed: ${error.message}`);
  return data?.[0] ?? null;
}
