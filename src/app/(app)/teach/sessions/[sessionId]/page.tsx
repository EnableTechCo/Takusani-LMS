import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime, formatLongDayOf, formatTime, sastInputValue } from "@/lib/dates";
import { CancelSessionForm, SessionForm } from "@/modules/learning/sessions-forms";
import { getRegister } from "@/modules/learning/register-queries";
import { registerSummary } from "@/modules/learning/register-rules";
import { seriesLabel, seriesSentence, type SeriesRepeat } from "@/modules/learning/series-rules";
import { listSessions } from "@/modules/learning/sessions-queries";
import { durationText } from "@/modules/notifications/templates";

export const metadata = { title: "Session · Teaching" };

// F-06 (FR-206, FR-207): one session. Change its time or place, or cancel it; either tells the learners. Once it has
// started, its register (F-07, FR-209).
export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ told?: string; changed?: string; cancelled?: string; series?: string }>;
}) {
  const [{ sessionId }, notice] = await Promise.all([params, searchParams]);
  const sessions = await listSessions();
  const session = sessions.find((row) => row.id === sessionId) ?? null;
  if (!session) notFound();
  // The rest of the series, for the label and for cancelling the later ones together.
  const siblings = session.series_id ? sessions.filter((row) => row.series_id === session.series_id) : [];
  const laterInSeries = siblings.filter(
    (row) => row.series_seq! > session.series_seq! && row.state === "scheduled" && new Date(row.starts_at) > new Date(),
  ).length;
  // The rhythm is not stored: a week apart is weekly, anything more is fortnightly.
  const seriesRepeat = (rows: typeof sessions): SeriesRepeat =>
    rows.length > 1 &&
    new Date(rows[1].starts_at).getTime() - new Date(rows[0].starts_at).getTime() > 8 * 24 * 3_600_000
      ? "fortnightly"
      : "weekly";
  const seriesMade = notice.series === undefined ? null : Number(notice.series);
  const cancelledCount = notice.cancelled === undefined ? null : Number(notice.cancelled);

  const endsAt = new Date(session.starts_at).getTime() + session.duration_minutes * 60_000;
  const held = endsAt <= new Date().getTime();
  const cancelled = session.state === "cancelled";
  const started = new Date(session.starts_at).getTime() <= new Date().getTime();
  const register = started && !cancelled ? await getRegister(session.id) : null;
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
            {session.series_seq && session.series_count ? (
              <Tag shape="half">{seriesLabel(session.series_seq, session.series_count)}</Tag>
            ) : null}
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
            title={
              cancelledCount !== null && cancelledCount > 1
                ? `${cancelledCount} sessions cancelled`
                : notice.cancelled
                  ? "Cancelled"
                  : notice.changed
                    ? "Saved"
                    : seriesMade
                      ? `Series of ${seriesMade} scheduled`
                      : "Scheduled"
            }
            tone="positive"
          >
            {seriesMade && session.series_count ? (
              <p>{seriesSentence(siblings[0].starts_at, seriesRepeat(siblings), session.series_count)}</p>
            ) : null}
            <p>
              {told > 0
                ? `${learners(told)} ${told === 1 ? "was" : "were"} told in the LMS${seriesMade || (cancelledCount ?? 0) > 1 ? ", once, about all of them" : ""}.`
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

        {register ? (
          <section aria-labelledby="register-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="register-h">
                Register
              </h2>
              {register.register_version > 0 ? (
                <Tag shape="dot" tone="positive">
                  Taken
                </Tag>
              ) : (
                <Tag>Not taken yet</Tag>
              )}
            </div>
            <div className="card__body stack">
              <p>
                {register.register_version > 0
                  ? `${registerSummary(register.roster)}.${
                      register.amendments.length > 0
                        ? ` Changed ${register.amendments.length === 1 ? "once" : `${register.amendments.length} times`} since it was taken.`
                        : ""
                    }`
                  : "Mark each learner present or absent. Teams attendance is not read: this register is the record."}
              </p>
              <p>
                <ButtonLink
                  href={`/teach/sessions/${session.id}/register`}
                  variant={register.register_version > 0 ? "secondary" : "primary"}
                >
                  {register.register_version > 0 ? "Open the register" : "Take the register"}
                </ButtonLink>
              </p>
            </div>
          </section>
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
                <CancelSessionForm laterInSeries={laterInSeries} sessionId={session.id} />
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
