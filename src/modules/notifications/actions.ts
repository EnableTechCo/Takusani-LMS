"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseCategory } from "./centre-rules";

/**
 * "Mark all as read" (G-05), for the filter in view. A plain form post, so it works before any JavaScript loads.
 * Returns to the same view; the bell's count in the top bar is refreshed with it.
 */
export async function markAllRead(formData: FormData): Promise<void> {
  const category = parseCategory(formData.get("show")?.toString());
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_my_notifications_read", { p_category: category });
  if (error) throw new Error(`api.mark_my_notifications_read failed: ${error.message}`);
  revalidatePath("/", "layout");
  redirect(category === "all" ? "/notifications" : `/notifications?show=${category}`);
}
