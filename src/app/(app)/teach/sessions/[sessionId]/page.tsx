import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime, formatLongDayOf, formatTime, sastInputValue } from "@/lib/dates";
import { CancelSessionForm, SessionForm } from "@/modules/learning/sessions-forms";
import { getSession } from "@/modules/learning/sessions-queries";
import { durationText } from "@/modules/notifications/templates";

export const metadata = { title: "Session · Teaching" };

// F-06 (FR-206, FR-207): one session. Change its time or place, or cancel it; either tells the learners.
export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ told?: string; changed?: string; cancelled?: string }>;
}) {
  const [{ sessionId }, notice] = await Promise.all([params, searchParams]);
  const session = await getSession(sessionId);
  if (!session) notFound();

  const endsAt = new Date(session.starts_at).getTime() + session.duration_minutes * 60_000;
  const held = endsAt <= new Date().getTime();
  const cancelled = session.state === "cancelled";
  const told = notice.told === undefined ? null : Number(notice.told);
  const learners = (count: number) => (count === 1 ? "1 learner" : `${count} learners`);

  return (
    <div className="page">
      <PageHeader
        lead={session.cohort_name}
        meta={
          <>
            {cancelled ? (
              <Tag tone="caution">Cancelled</Tag>
            ) : held ? (
              <Tag>Held</Tag>
            ) : (
              <Tag tone="info">Scheduled</Tag>
            )}
            <span>
              {formatLongDayOf(session.starts_at)}, {formatTime(session.starts_at)} (SAST),{" "}
              {durationText(session.duration_minutes)}
            </span>
            <span>{session.mode === "online" ? "Online in Teams" : session.venue}</span>
          </>
        }
        title={session.title}
        workspace="Teaching"
      />
      <div className="stack stack--lg">
        {told !== null ? (
          <Banner
            compact
            role="status"
            title={notice.cancelled ? "Cancelled" : notice.changed ? "Saved" : "Scheduled"}
            tone="positive"
          >
            <p>
              {told > 0
                ? `${learners(told)} ${told === 1 ? "was" : "were"} told in the LMS.`
                : "Only the title changed, so nobody was told."}
            </p>
          </Banner>
        ) : null}

        {cancelled ? (
          <Banner role="note" title="This session is cancelled" tone="readonly">
            <p>
              Learners still see it on their calendar, marked cancelled, with your reason: &ldquo;
              {session.cancel_reason}
              &rdquo;
            </p>
          </Banner>
        ) : null}

        {session.mode === "online" && session.teams_url && !cancelled ? (
          <p className="text-small">
            Teams link:{" "}
            <a className="link" href={session.teams_url} rel="noopener noreferrer" target="_blank">
              open the meeting<span className="u-visually-hidden"> (opens Microsoft Teams)</span>
            </a>
          </p>
        ) : null}

        {cancelled || held ? null : (
          <>
            <section aria-labelledby="change-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="change-h">
                  Change
                </h2>
              </div>
              <div className="card__body">
                <SessionForm
                  audience={session.audience}
                  session={{
                    id: session.id,
                    version: session.version,
                    values: {
                      title: session.title,
                      startsAt: sastInputValue(session.starts_at),
                      duration: String(session.duration_minutes),
                      mode: session.mode as "online" | "in_person",
                      teamsUrl: session.teams_url ?? "",
                      venue: session.venue ?? "",
                    },
                  }}
                />
              </div>
            </section>
            <section aria-labelledby="cancel-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="cancel-h">
                  Cancel
                </h2>
              </div>
              <div className="card__body stack">
                <p className="text-small text-muted">
                  The {learners(session.audience)} in the cohort are told, and the session stays on their calendar,
                  marked cancelled.
                </p>
                <CancelSessionForm sessionId={session.id} />
              </div>
            </section>
          </>
        )}

        {held && !cancelled ? (
          <p className="text-muted">This session took place on {formatDateTime(session.starts_at)} (SAST).</p>
        ) : null}

        <p>
          <TextLink href="/teach/sessions">All sessions</TextLink>
        </p>
      </div>
    </div>
  );
}
