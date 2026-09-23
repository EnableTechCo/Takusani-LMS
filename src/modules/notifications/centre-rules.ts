import { formatLongDayOf, sastDaysFromToday } from "@/lib/dates";
import { renderNotification } from "./templates";

/** The notification centre's rules (S2-11, G-05): filters, day groups, and the delivery evidence in words (NFR-11). */

export const CATEGORIES = ["all", "results", "deadlines"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  all: "All",
  results: "Results",
  deadlines: "Deadlines",
};

export function parseCategory(value: string | undefined): Category {
  return (CATEGORIES as readonly string[]).includes(value ?? "") ? (value as Category) : "all";
}

export interface EmailEvidence {
  state: "pending" | "accepted" | "delivered" | "failed" | "skipped";
  address: string | null;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
}

/**
 * The email line under "How you were told". "Sent" means the email provider accepted it; "delivered" needs the
 * provider to confirm delivery, which comes later. A failed email never undoes the LMS record.
 */
export function emailLine(email: EmailEvidence): { text: string; at: string | null; failed: boolean } {
  const to = email.address ? `Email to ${email.address}` : "Email";
  switch (email.state) {
    case "pending":
      return { text: `${to}: sending`, at: email.created_at, failed: false };
    case "accepted":
      return { text: `${to}: sent`, at: email.accepted_at, failed: false };
    case "delivered":
      return { text: `${to}: delivered`, at: email.delivered_at ?? email.accepted_at, failed: false };
    case "failed":
      return { text: "Email could not be delivered", at: email.failed_at, failed: true };
    case "skipped":
      return { text: "Email was not sent", at: null, failed: false };
  }
}

/** A notification's words, from its template. An unreadable payload still shows a row rather than breaking the page. */
export function notificationText(
  eventType: string,
  templateVersion: number,
  payload: Record<string, unknown>,
): { title: string; summary: string | null } {
  try {
    const rendered = renderNotification(eventType, templateVersion, payload);
    return { title: rendered.title, summary: rendered.summary };
  } catch {
    return { title: "Notification", summary: null };
  }
}

/** Groups newest-first items by South African day: "Today, Wednesday 23 September 2026", "Yesterday, ...", or the day. */
export function groupByDay<T extends { created_at: string }>(
  items: T[],
  now: Date,
): { heading: string; key: string; items: T[] }[] {
  const groups: { heading: string; key: string; items: T[] }[] = [];
  for (const item of items) {
    const day = formatLongDayOf(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.key === day) {
      last.items.push(item);
      continue;
    }
    const offset = sastDaysFromToday(item.created_at, now);
    const heading = offset === 0 ? `Today, ${day}` : offset === -1 ? `Yesterday, ${day}` : day;
    groups.push({ heading, key: day, items: [item] });
  }
  return groups;
}
