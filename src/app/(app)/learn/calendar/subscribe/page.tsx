import { headers } from "next/headers";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime } from "@/lib/dates";
import { FeedLinkPanel } from "@/modules/learning/calendar-feed-forms";
import { getMyCalendarFeed } from "@/modules/learning/sessions-queries";

export const metadata = { title: "Subscribe to your calendar" };

// L-08 (FR-304, ADR-020): the learner's own calendar link for a phone or computer calendar. It carries the schedule
// only; the link is a secret, shown once, and can be replaced or turned off at any time.
export default async function SubscribePage({ searchParams }: { searchParams: Promise<{ revoked?: string }> }) {
  const [feed, flash, requestHeaders] = await Promise.all([getMyCalendarFeed(), searchParams, headers()]);
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const feedBase = `${protocol}://${host}/api/calendar/feeds/`;

  return (
    <div className="page page--form">
      <PageHeader
        lead="See your sessions and due dates in your phone or computer calendar. It updates by itself, about once an hour."
        meta={
          feed ? (
            <Tag shape="dot" tone="positive">
              On
            </Tag>
          ) : (
            <Tag>Off</Tag>
          )
        }
        title="Subscribe to your calendar"
        workspace="Learning"
      />
      <div className="stack stack--lg">
        {flash.revoked ? (
          <Banner compact role="status" title="Your calendar link is turned off" tone="positive">
            <p>Calendars subscribed to it stop updating. Create a new link whenever you like.</p>
          </Banner>
        ) : null}

        <section aria-labelledby="link-h" className="card">
          <div className="card__header">
            <h2 className="card__title" id="link-h">
              Your calendar link
            </h2>
          </div>
          <div className="card__body stack">
            {feed ? (
              <p className="text-small">
                Created {formatDateTime(feed.created_at)} (SAST).{" "}
                {feed.last_used_at
                  ? `Last fetched by a calendar app ${formatDateTime(feed.last_used_at)} (SAST).`
                  : "Not fetched by a calendar app yet."}{" "}
                The link is shown only when it is made; to see it again, make a new one.
              </p>
            ) : (
              <p className="text-small">Create a link, then add it to your calendar app as a subscription.</p>
            )}
            <FeedLinkPanel active={Boolean(feed)} feedBase={feedBase} />
          </div>
        </section>

        <section aria-labelledby="contents-h" className="card card--sunken">
          <div className="card__header">
            <h2 className="card__title" id="contents-h">
              What the calendar shows
            </h2>
          </div>
          <div className="card__body">
            <dl className="dl">
              <div className="dl__row">
                <dt>Shows</dt>
                <dd>
                  Your sessions, with the time and place (an online session says &ldquo;Online&rdquo;), and the due date
                  of each task, each with a link to open it in the LMS. A cancelled session stays, marked cancelled.
                </dd>
              </div>
              <div className="dl__row">
                <dt>Leaves out</dt>
                <dd>
                  Teams join links (join from the LMS), results, feedback, notices and your notes. Anyone who sees the
                  link sees your timetable and nothing else.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section aria-labelledby="how-h" className="stack">
          <h2 className="text-heading" id="how-h">
            Adding it to your calendar
          </h2>
          <ul className="stack text-small" role="list">
            <li>
              <strong>iPhone or Mac:</strong> choose &ldquo;Open in your calendar app&rdquo; after creating the link, or
              in Calendar add a subscribed calendar and paste the link.
            </li>
            <li>
              <strong>Google Calendar:</strong> on a computer, next to &ldquo;Other calendars&rdquo; choose &ldquo;From
              URL&rdquo; and paste the link. It then appears on your phone too.
            </li>
            <li>
              <strong>Outlook:</strong> add a calendar, choose &ldquo;Subscribe from web&rdquo; and paste the link.
            </li>
          </ul>
        </section>

        <p>
          <TextLink href="/learn/calendar">Back to your calendar</TextLink>
        </p>
      </div>
    </div>
  );
}
