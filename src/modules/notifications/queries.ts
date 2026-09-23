import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type Category } from "./centre-rules";

// Each query answers for the signed-in person only: the database returns their own notifications and nothing else.

export const PAGE_SIZE = 20;

/** One page of the person's notifications, newest first, with the evidence of how they were told (NFR-11). */
export async function listMyNotifications(category: Category, page: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_notifications", {
    p_category: CATEGORIES.includes(category) ? category : "all",
    p_page: page,
    p_page_size: PAGE_SIZE,
  });
  if (error) throw new Error(`api.list_my_notifications failed: ${error.message}`);
  return data;
}

/** For the bell in the top bar. Cached for the request; a failure shows no count rather than breaking the page. */
export const getUnreadCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_unread_notification_count");
  if (error) {
    console.error("api.my_unread_notification_count failed", error.message);
    return 0;
  }
  return data ?? 0;
});
