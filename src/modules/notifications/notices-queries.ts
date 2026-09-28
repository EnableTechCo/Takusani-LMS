import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Coordinator notices (S2-17). The database shows a coordinator only the notices in their scope.

const isUuid = (value: string) => z.string().uuid().safeParse(value).success;

export async function listNotices() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_notices");
  if (error) throw new Error(`api.list_notices failed: ${error.message}`);
  return data;
}

export async function getNotice(noticeId: string) {
  if (!isUuid(noticeId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_notice", { p_notice_id: noticeId });
  if (error) throw new Error(`api.get_notice failed: ${error.message}`);
  return data?.[0] ?? null;
}

export async function listNoticeDeliveries(noticeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_notice_deliveries", { p_notice_id: noticeId });
  if (error) throw new Error(`api.list_notice_deliveries failed: ${error.message}`);
  return data;
}

/** The cohorts this coordinator may message, and whether role groups and everyone are open to them. */
export async function myNoticeAudiences() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_notice_audiences");
  if (error) throw new Error(`api.my_notice_audiences failed: ${error.message}`);
  const rows = data ?? [];
  return {
    cohorts: rows
      .filter((row) => row.cohort_id)
      .map((row) => ({
        id: row.cohort_id!,
        name: row.cohort_name!,
        programme: row.programme_title!,
        learners: row.learners!,
      })),
    canSendWide: rows.some((row) => row.can_send_wide),
  };
}
