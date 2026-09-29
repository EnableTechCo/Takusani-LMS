import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime } from "@/lib/dates";
import { LogisticsForm, ReconcileForm } from "@/modules/learning/logistics-forms";
import { getSessionLogistics } from "@/modules/learning/logistics-queries";
import {
  arrangedText,
  defaultHeadcountText,
  HEADCOUNT_SOURCE_LABELS,
  varianceText,
} from "@/modules/learning/logistics-rules";

export const metadata = { title: "Session logistics · Coordinating" };

const by = (name: string | null, at: string | null) =>
  name && at ? `Arranged by ${name}, ${formatDateTime(at)}` : null;

// C-11 (FR-705 to FR-707): one in-person session. The form for the venue booking, catering and equipment; beside it
// the default headcount and where it came from, and once the register is captured, how attendance compared.
export default async function SessionLogisticsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await getSessionLogistics(sessionId);
  if (!session) notFound();
  const inPerson = session.mode === "in_person";
  const cancelled = session.session_state === "cancelled";
  const needed = 1 + (session.catering_needed ? 1 : 0) + (session.equipment ? 1 : 0);
  const arrangedCount =
    (session.venue_arranged_at ? 1 : 0) +
    (session.catering_arranged_at ? 1 : 0) +
    (session.equipment_arranged_at ? 1 : 0);
  const arranged = arrangedText(arrangedCount, needed);

  return (
    <div className="page">
      <PageHeader
        lead={`${session.cohort_name}. ${formatDateTime(session.starts_at)} (SAST), ${session.duration_minutes} minutes${
          session.venue ? `, ${session.venue}` : ", online"
        }.`}
        meta={
          inPerson && !cancelled && session.version > 0 ? (
            arranged.all ? (
              <Tag tone="positive">{arranged.text}</Tag>
            ) : (
              <Tag shape="half" tone="info">
                {arranged.text}
              </Tag>
            )
          ) : undefined
        }
        title={session.title}
        workspace="Coordinating"
      />
      {!inPerson ? (
        <Banner title="This session is online" tone="info">
          <p>It has no venue, catering or equipment to arrange.</p>
        </Banner>
      ) : (
        <div className="page-layout">
          <div className="page-layout__main stack stack--lg">
            {cancelled ? (
              <Banner title="This session was cancelled" tone="info">
                <p>Its logistics are kept as they were and can no longer change.</p>
              </Banner>
            ) : (
              <section aria-labelledby="logistics-h" className="card">
                <div className="card__header">
                  <h2 className="card__title" id="logistics-h">
                    What is needed, and what is arranged
                  </h2>
                </div>
                <div className="card__body">
                  <LogisticsForm
                    arrangedBy={{
                      venue: by(session.venue_arranged_by_name, session.venue_arranged_at),
                      catering: by(session.catering_arranged_by_name, session.catering_arranged_at),
                      equipment: by(session.equipment_arranged_by_name, session.equipment_arranged_at),
                    }}
                    defaultHeadcount={session.default_headcount}
                    saved={{
                      venue: session.venue ?? "",
                      venueNote: session.venue_note,
                      venueArranged: Boolean(session.venue_arranged_at),
                      cateringNeeded: session.catering_needed,
                      headcount: session.headcount,
                      dietary: session.dietary,
                      cateringArranged: Boolean(session.catering_arranged_at),
                      equipment: session.equipment,
                      equipmentArranged: Boolean(session.equipment_arranged_at),
                    }}
                    sessionId={session.session_id}
                    version={session.version}
                  />
                </div>
              </section>
            )}
            <p>
              <TextLink href="/coordinate/logistics">All session logistics</TextLink>
            </p>
          </div>

          <aside aria-labelledby="headcount-h" className="page-layout__aside stack">
            <section className="card">
              <div className="card__body stack">
                <h2 className="text-heading" id="headcount-h">
                  Headcount and attendance
                </h2>
                <dl className="dl">
                  <div className="dl__row">
                    <dt>Default headcount</dt>
                    <dd>
                      {defaultHeadcountText(session.default_headcount, session.default_source, session.default_basis)}
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Enrolled</dt>
                    <dd>{session.enrolled}</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Confirmed headcount</dt>
                    <dd>
                      {session.catering_needed && session.headcount !== null
                        ? `${session.headcount}, ${HEADCOUNT_SOURCE_LABELS[session.headcount_source ?? "manual"]}`
                        : "No catering"}
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Attendance</dt>
                    <dd>
                      {!session.register_captured
                        ? "The register is not captured yet."
                        : session.present !== null && session.headcount !== null
                          ? varianceText(session.present, session.headcount)
                          : "Captured."}
                    </dd>
                  </div>
                </dl>
                {session.variance_flagged ? (
                  <Banner title="The headcount and attendance differ" tone="caution">
                    <p>
                      They differ by more than {session.variance_percent}%. Reconcile it with the caterer and say what
                      happened.
                    </p>
                  </Banner>
                ) : null}
                {session.variance_flagged && !cancelled ? <ReconcileForm sessionId={session.session_id} /> : null}
                {session.reconciled_at ? (
                  <p className="text-small">
                    Reconciled by {session.reconciled_by_name}, {formatDateTime(session.reconciled_at)} (SAST):{" "}
                    {session.reconciliation_note}
                  </p>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
