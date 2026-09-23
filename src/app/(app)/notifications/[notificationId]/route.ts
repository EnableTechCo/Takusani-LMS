import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Opening a notification (G-05): marks it read and goes to what it is about. Each row links here, so it works without
// JavaScript. The list uses plain anchors, not prefetching links, so only a real click marks one read.
export async function GET(request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await params;
  const fallback = new URL("/notifications", request.url);
  if (!z.string().uuid().safeParse(notificationId).success) return NextResponse.redirect(fallback, 303);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_my_notification", { p_notification_id: notificationId });
  const row = data?.[0];
  // Links are app paths written by the database (checked to start with "/"); anything else goes back to the list.
  if (error || row?.status !== "ok" || !row.link?.startsWith("/") || row.link.startsWith("//")) {
    return NextResponse.redirect(fallback, 303);
  }
  return NextResponse.redirect(new URL(row.link, request.url), 303);
}
