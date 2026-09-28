import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Icon } from "@/components/ui/icons";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { DateTime } from "@/components/ui/records";
import { Banner, Tag } from "@/components/ui/status";
import { formatLongDayOf } from "@/lib/dates";
import { viewMyMarkedWork } from "@/modules/appeals/queries";
import { signEvidence, type EvidenceFile } from "@/modules/assessment/queries";
import { MarksTable, Paragraphs, type Mark, type VersionFacts } from "@/modules/assessment/result-view";
import { appealWindow, OUTCOME_LABELS } from "@/modules/assessment/rules";
import { formatBytes } from "@/modules/submissions/rules";

export async function generateMetadata({ params }: { params: Promise<{ appealId: string }> }) {
  const view = await viewMyMarkedWork((await params).appealId);
  return { title: view?.status === "ok" ? `Your marked work for ${view.item_title}` : "Your marked work" };
}

/**
 * FR-607: the time left to ask for a re-mark, in a fixed place at the top. Seeing the work does not give more time
 * (P-08), and a re-mark already asked for or done is said in words rather than offered again.
 */
function RemarkLine({
  resultId,
  deadlineAt,
  standing,
  remarkAppealId,
  remarkReference,
  decisionFinal,
}: {
  resultId: string;
  deadlineAt: string;
  standing: string;
  remarkAppealId: string | null;
  remarkReference: string | null;
  decisionFinal: boolean;
}) {
  if (decisionFinal) {
    return (
      <p className="deadline-line deadline-line--closed">
        <Icon name="lock" />
        <span>This result was decided on appeal. That decision is final; there is no further appeal.</span>
      </p>
    );
  }
  const window = appealWindow(deadlineAt, new Date());
  if (window.state === "closed") {
    return (
      <p className="deadline-line deadline-line--closed">
        <Icon name="lock" />
        <span>The time to ask for a re-mark closed at the end of {window.lastDay}.</span>
      </p>
    );
  }
  if (standing !== "available") {
    return (
      <p className="deadline-line">
        <Icon name="scales" />
        <span>
          {standing === "open"
            ? `You have already asked for a re-mark of this result (${remarkReference}). `
            : `A re-mark of this result has already been done (${remarkReference}). Only one is allowed. `}
          {remarkAppealId ? <TextLink href={`/learn/appeals/${remarkAppealId}`}>See that appeal</TextLink> : null}
        </span>
      </p>
    );
  }
  return (
    <div className="stack stack--sm">
      <p className={window.state === "last_day" ? "deadline-line deadline-line--soon" : "deadline-line"}>
        <Icon name="clock" />
        <span>
          {window.state === "last_day" ? (
            <>
              <strong>Today is the last day to ask for a re-mark.</strong> You can ask{" "}
              <span className="deadline-line__date">until the end of today, {window.lastDay}</span>.
            </>
          ) : (
            <>
              You can still ask for a re-mark{" "}
              <span className="deadline-line__date">until the end of {window.lastDay}</span>.{" "}
              <span className="deadline-line__left">
                {window.daysLeft === 1 ? "1 day left" : `${window.daysLeft} days left`}
              </span>
              .
            </>
          )}{" "}
          Seeing your work does not give you more time.
        </span>
      </p>
      <p>
        <ButtonLink href={`/learn/results/${resultId}/appeal/new`} variant="secondary">
          Ask for a re-mark
        </ButtonLink>
      </p>
    </div>
  );
}

// L-18 (FR-606, FR-607): the learner's work as it was assessed, beside the mark and comment for each criterion and the
// assessor's feedback. Opening it is recorded on the appeal (FR-606).
export default async function LearnMarkedWorkPage({ params }: { params: Promise<{ appealId: string }> }) {
  const { appealId } = await params;
  const view = await viewMyMarkedWork(appealId);
  if (!view || view.status === "not_found" || view.status === "not_a_view" || view.status === "unauthenticated") {
    notFound();
  }
  const back = (
    <p>
      <TextLink href={`/learn/appeals/${appealId}`}>Back to your appeal</TextLink>
    </p>
  );

  if (view.status !== "ok") {
    return (
      <div className="page page--form">
        <PageHeader title="Your marked work" workspace="Learning" />
        <div className="stack stack--lg">
          {view.status === "refused" ? (
            <Banner icon="scales" role="note" title="Your request was not accepted" tone="readonly">
              <p>The reason is on your appeal&apos;s page.</p>
            </Banner>
          ) : (
            <Banner role="status" title="Your request is still being checked" tone="info">
              <p>You will be told when you can see your marked work.</p>
            </Banner>
          )}
          {back}
        </div>
      </div>
    );
  }

  const files = (view.files ?? []) as unknown as EvidenceFile[];
  const links = await signEvidence(files);
  const version = view.assessed_version as unknown as VersionFacts | null;
  const outcome = view.outcome as "competent" | "not_yet_competent";

  return (
    <div className="page">
      <PageHeader
        lead={`${view.cohort_name} · appeal ${view.reference}`}
        meta={<Tag tone={outcome === "competent" ? "positive" : "caution"}>{OUTCOME_LABELS[outcome]}</Tag>}
        title={`Your marked work for ${view.item_title}`}
        workspace="Learning"
      />
      <div className="stack stack--lg">
        <RemarkLine
          deadlineAt={view.appeal_deadline_at}
          decisionFinal={view.decision_final}
          remarkAppealId={view.remark_appeal_id ?? null}
          remarkReference={view.remark_reference ?? null}
          resultId={view.result_id}
          standing={view.remark_standing}
        />
        <div className="page-layout">
          <div className="page-layout__main stack stack--lg">
            <section aria-labelledby="work-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="work-h">
                  Your work, as it was assessed
                </h2>
              </div>
              <div className="card__body stack">
                {version ? (
                  <p className="text-small text-muted">
                    Version {version.version_number}, submitted <DateTime iso={version.submitted_at} zone />
                    {version.is_late ? " (late)" : ""}. Receipt{" "}
                    <span className="mono">{version.receipt_reference}</span>.
                  </p>
                ) : null}
                {files.length === 0 ? (
                  <p className="text-muted">No files are recorded for this version.</p>
                ) : (
                  <ul className="stack stack--sm">
                    {files.map((file) => (
                      <li className="cluster cluster--between" key={file.object_key}>
                        <span>
                          {links[file.object_key] ? (
                            <a download={file.filename} href={links[file.object_key]}>
                              {file.filename}
                            </a>
                          ) : (
                            file.filename
                          )}
                          {file.requirement ? <span className="text-muted"> · {file.requirement}</span> : null}
                        </span>
                        <span className="text-meta mono">{formatBytes(file.bytes)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-small text-muted">
                  Links to your files work for 10 minutes. Reload the page for new ones.
                </p>
              </div>
            </section>

            <MarksTable itemTitle={view.item_title} marks={(view.marks ?? []) as unknown as Mark[]} outcome={outcome} />

            <section aria-labelledby="feedback-h" className="stack">
              <h2 className="text-subheading" id="feedback-h">
                {view.assessor_name ? `Feedback from your assessor, ${view.assessor_name}` : "Feedback"}
              </h2>
              {view.feedback ? (
                <Paragraphs text={view.feedback} />
              ) : (
                <p className="text-muted">Your assessor did not add overall feedback.</p>
              )}
            </section>
          </div>

          <aside aria-label="About this view" className="page-layout__aside stack">
            <div className="card">
              <div className="card__body stack stack--sm">
                <p className="text-small">
                  This is the work and the marks for the decision you appealed. Each time you open this page it is
                  recorded on your appeal.
                </p>
                {view.first_viewed_at ? (
                  <p className="text-small text-muted">
                    First opened {formatLongDayOf(view.first_viewed_at)}. Opened {view.views}{" "}
                    {view.views === 1 ? "time" : "times"}.
                  </p>
                ) : null}
              </div>
            </div>
            {back}
          </aside>
        </div>
      </div>
    </div>
  );
}
