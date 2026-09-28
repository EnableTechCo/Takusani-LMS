import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, EmptyState, Tag } from "@/components/ui/status";
import { formatDateTime, formatLongDayOf, formatTime } from "@/lib/dates";
import { RegisterForm } from "@/modules/learning/register-forms";
import { getRegister } from "@/modules/learning/register-queries";
import { amendmentText, registerSummary } from "@/modules/learning/register-rules";
import { durationText } from "@/modules/notifications/templates";

export const metadata = { title: "Register · Teaching" };

// F-07 (FR-209, CR-03): mark each learner present or absent, then amend with a reason. Teams attendance is never read;
// the register is what the facilitator records here, and every change after the first save is logged.
export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ sessionId }, flash] = await Promise.all([params, searchParams]);
  const register = await getRegister(sessionId);
  if (!register) notFound();

  const cancelled = register.state === "cancelled";
  const started = new Date(register.starts_at).getTime() <= new Date().getTime();
  const captured = register.register_version > 0;

  return (
    <div className="page">
      <PageHeader
        lead={register.cohort_name}
        meta={
          <>
            {cancelled ? (
              <Tag tone="caution">Cancelled</Tag>
            ) : captured ? (
              <Tag shape="dot" tone="positive">
                Taken
              </Tag>
            ) : (
              <Tag>Not taken yet</Tag>
            )}
            <span>
              {formatLongDayOf(register.starts_at)}, {formatTime(register.starts_at)} (SAST),{" "}
              {durationText(register.duration_minutes)}
            </span>
          </>
        }
        title={`Register: ${register.title}`}
        workspace="Teaching"
      />
      <div className="page-layout">
        <div className="page-layout__main stack stack--lg">
          {flash.saved ? (
            <Banner
              compact
              role="status"
              title={flash.saved === "1" ? "Register saved" : "Changes saved"}
              tone="positive"
            >
              <p>{registerSummary(register.roster)}.</p>
            </Banner>
          ) : null}

          {cancelled ? (
            <Banner role="note" title="This session was cancelled" tone="readonly">
              <p>A cancelled session has no register.</p>
            </Banner>
          ) : !started ? (
            <Banner role="note" title="The register opens when the session starts" tone="info">
              <p>
                {formatLongDayOf(register.starts_at)} at {formatTime(register.starts_at)} (SAST). Come back then to mark
                who is there.
              </p>
            </Banner>
          ) : register.roster.length === 0 ? (
            <div className="card">
              <EmptyState icon="users" title="Nobody is enrolled in this cohort">
                <p>There is nobody to mark.</p>
              </EmptyState>
            </div>
          ) : (
            <>
              {captured ? (
                <p className="text-small text-muted">
                  Taken by {register.captured_by_name} on {formatDateTime(register.captured_at!)} (SAST). A change now
                  is an amendment: it needs a reason, and the mark it replaces stays on record.
                </p>
              ) : (
                <p className="text-small text-muted">
                  Mark every learner, then save. Teams attendance is not read: this register is the record.
                </p>
              )}
              <RegisterForm
                key={register.register_version}
                roster={register.roster}
                sessionId={register.session_id}
                version={register.register_version}
              />
            </>
          )}
          <p>
            <TextLink href={`/teach/sessions/${register.session_id}`}>Back to the session</TextLink>
          </p>
        </div>

        <aside aria-labelledby="changes-h" className="page-layout__aside stack">
          <div className="card card--sunken">
            <div className="card__header">
              <h2 className="card__title" id="changes-h">
                Changes
              </h2>
            </div>
            <div className="card__body">
              {register.amendments.length === 0 ? (
                <p className="text-small text-muted">
                  {captured ? "No changes since the register was taken." : "Changes after the first save appear here."}
                </p>
              ) : (
                <ol className="stack" role="list">
                  {register.amendments.map((amendment, index) => (
                    <li className="text-small" key={index}>
                      <strong>{amendment.learner_name}</strong>: {amendmentText(amendment)}
                      <br />
                      <span className="text-muted">
                        {amendment.changed_by_name}, {formatDateTime(amendment.changed_at)}
                      </span>
                      <br />
                      &ldquo;{amendment.reason}&rdquo;
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
