"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { instantFromSast } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { NOTICE_REFUSALS } from "./notices-rules";

// Coordinator notices (S2-17, FR-703). The database decides who may send to whom and delivers the notice.

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

const FIELD_OF: Record<string, string> = {
  invalid_title: "title",
  invalid_body: "body",
  cohort_not_found: "cohortId",
  invalid_role: "role",
  send_in_past: "sendAt",
};

export async function createNotice(_: FormState, form: FormData): Promise<FormState> {
  const values = {
    title: text(form, "title"),
    body: text(form, "body"),
    audience: text(form, "audience") || "cohort",
    cohortId: text(form, "cohortId"),
    role: text(form, "role"),
    when: text(form, "when") || "now",
    sendAt: text(form, "sendAt"),
  };
  const errors: Record<string, string> = {};
  if (!values.title) errors.title = NOTICE_REFUSALS.invalid_title;
  if (!values.body) errors.body = NOTICE_REFUSALS.invalid_body;
  if (values.audience === "cohort" && !values.cohortId) errors.cohortId = NOTICE_REFUSALS.cohort_not_found;
  if (values.audience === "role" && !values.role) errors.role = NOTICE_REFUSALS.invalid_role;
  if (values.when === "later" && !values.sendAt) errors.sendAt = "Choose when it goes out.";
  if (Object.keys(errors).length > 0) return { errors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_notice", {
    p_title: values.title,
    p_body: values.body,
    p_audience: values.audience,
    p_cohort_id: values.audience === "cohort" ? values.cohortId : undefined,
    p_role: values.audience === "role" ? values.role : undefined,
    p_send_at: values.when === "later" ? instantFromSast(values.sendAt) : undefined,
  });
  const row = data?.[0];
  if (error || row?.status !== "ok") {
    const status = row?.status ?? "error";
    const message = NOTICE_REFUSALS[status] ?? NOTICE_REFUSALS.error;
    const field = FIELD_OF[status];
    return field ? { errors: { [field]: message }, values } : { message, values };
  }
  revalidatePath("/coordinate/notices");
  redirect(`/coordinate/notices/${row.notice_id}?${row.scheduled ? "scheduled" : "sent"}=${row.recipients ?? 0}`);
}

export async function cancelNotice(noticeId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("cancel_notice", { p_notice_id: noticeId });
  revalidatePath("/coordinate/notices");
  redirect(`/coordinate/notices/${noticeId}`);
}
