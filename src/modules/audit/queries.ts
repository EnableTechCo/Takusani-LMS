import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AuditFilters } from "./events";

export const AUDIT_PAGE_SIZE = 50;

/** One page of the audit log, newest first. The database returns nothing unless the caller is an administrator. */
export async function listAuditEvents(filters: AuditFilters) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_audit_events", {
    p_action: filters.action,
    p_actor_email: filters.actorEmail,
    p_from: filters.from,
    p_to: filters.to,
    p_before_id: filters.beforeId,
    p_limit: AUDIT_PAGE_SIZE,
  });
  if (error) throw new Error(`api.list_audit_events failed: ${error.message}`);
  return data;
}
