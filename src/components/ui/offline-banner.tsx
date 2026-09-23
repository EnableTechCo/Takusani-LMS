"use client";

import { formatTime, sastDaysFromToday, formatDateTime } from "@/lib/dates";
import { useOffline } from "./connection";
import { Banner } from "./status";

/**
 * "No connection" (design system 4.6; prototype learn-home). In the page flow, not dismissible while it is true, and
 * it covers nothing. It says how old the page is, so a learner reading a deadline knows what they are looking at.
 * Announced at once (an offline banner is an alert). Nothing is rendered while online.
 */
export function OfflineBanner({ renderedAt }: { renderedAt: string }) {
  const offline = useOffline();
  if (!offline) return null;
  const when =
    sastDaysFromToday(renderedAt) === 0 ? `at ${formatTime(renderedAt)} today` : `on ${formatDateTime(renderedAt)}`;
  return (
    <Banner title="No connection" tone="offline">
      <p>
        You are seeing this page as it was {when}. You can still read it. Anything new will show when you are back
        online.
      </p>
    </Banner>
  );
}
