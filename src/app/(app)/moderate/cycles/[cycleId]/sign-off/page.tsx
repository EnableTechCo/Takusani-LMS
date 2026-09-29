import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { Stepper } from "@/components/ui/process";
import { Banner, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime, formatDay } from "@/lib/dates";
import { getMyAccess } from "@/modules/identity/session";
import { dueText } from "@/modules/moderation/review-rules";
import { SignOffForm } from "@/modules/moderation/sign-off-forms";
import { getSignOff } from "@/modules/moderation/sign-off-queries";
import {
  afterFreezeText,
  blockerActorText,
  blockerStateLabel,
  blockingReasons,
  consequenceText,
  eligibilityText,
  isReady,
  progressSteps,
  signedOffText,
} from "@/modules/moderation/sign-off-rules";

export async function generateMetadata({ params }: { params: Promise<{ cycleId: string }> }) {
  const facts = await getSignOff((await params).cycleId);
  return { title: facts ? `Sign off: ${facts.name} · Moderating` : "Sign off · Moderating" };
}

// M-04 (P0-13; FR-510, FR-511; P-05, P-06): sign off the cycle, or see exactly what blocks it. The button is disabled
// while anything blocks, with the reason in text; the confirmation states the consequence; the result is a record.
export default async function SignOffPage({
  params,
  searchParams,
}: {
  params: Promise<{ cycleId: string }>;
  searchParams: Promise<{ signed?: string }>;
}) {
  const [{ cycleId }, flash] = await Promise.all([params, searchParams]);
  const [facts, access] = await Promise.all([getSignOff(cycleId), getMyAccess()]);
  if (!facts) notFound();
  const now = new Date();
  const reasons = blockingReasons(facts);
  const ready = isReady(facts);
  const signed = facts.state === "signed_off";
  const openBlockers = facts.blockers.filter((blocker) => blocker.state === "returned" || blocker.state === "remarked");
  const results = (n: number) => `${n} ${n === 1 ? "result" : "results"}`;

  return (
    <div className="page">
      <PageHeader
        lead="Sign-off releases the results that were frozen into this cycle. It is the only way a result in a moderated cohort reaches its learner, and it cannot be undone."
        meta={
          <>
            {signed ? (
              <Tag tone="positive">Signed off. {results(facts.released_count ?? 0)} released</Tag>
            ) : openBlockers.length > 0 ? (
              <Tag tone="caution">Waiting for re-marks ({openBlockers.length} outstanding)</Tag>
            ) : ready ? (
              <Tag tone="positive">Ready to sign off</Tag>
            ) : (
              <Tag shape="half" tone="info">
                In review ({facts.concluded} of {facts.sample} done)
              </Tag>
            )}
            <span>{facts.cohort_name}</span>
          </>
        }
        title={`Sign off: ${facts.name}`}
        workspace="Moderating"
      />
      <div className="stack stack--lg">
        {signed ? (
          <Banner role={flash.signed ? "status" : "note"} title={signedOffText(facts)} tone="positive">
            <p>
              Each learner can appeal until the end of the {facts.appeal_window_days}th day after the release.{" "}
              {afterFreezeText(facts) ?? "No newer decision is waiting for the next cycle."}
            </p>
            {facts.sign_off_statement ? <p>&ldquo;{facts.sign_off_statement}&rdquo;</p> : null}
          </Banner>
        ) : !ready ? (
          <Banner role="alert" title={`You cannot sign off yet: ${reasons.join(" ")}`} tone="caution">
            <p>
              The open items are listed below with who must act next and by when. Nothing is released, and no learner is
              told anything, until every sample item is concluded.
            </p>
          </Banner>
        ) : null}

        <section aria-labelledby="prog-h" className="stack">
          <h2 className="text-heading" id="prog-h">
            Cycle progress
          </h2>
          <Stepper horizontal label={`${facts.name}: moderation cycle progress`} steps={progressSteps(facts)} />
        </section>

        <div className="grid grid--4" role="list">
          <div className="stat" role="listitem">
            <span className="stat__label">Frozen population</span>
            <span className="stat__value">{facts.population}</span>
            <span className="stat__meta">
              {facts.competent} Competent · {facts.not_yet_competent} Not yet competent. Exactly these are released.
            </span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat__label">Sample</span>
            <span className="stat__value">{facts.sample}</span>
            <span className="stat__meta">
              {facts.unallocated > 0 ? `${facts.unallocated} waiting for a moderator` : "All allocated"}
            </span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat__label">Items concluded</span>
            <span className="stat__value">{facts.concluded}</span>
            <span className="stat__meta">
              of {facts.sample}
              {openBlockers.length > 0 ? ` · ${openBlockers.length} returned and still open` : ""}
            </span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat__label">Finalised after the freeze</span>
            <span className="stat__value">{facts.after_freeze}</span>
            <span className="stat__meta">Not in this cycle. They wait for the next one</span>
          </div>
        </div>

        <section aria-labelledby="check-h" className="card">
          <div className="card__header">
            <h2 className="card__title" id="check-h">
              Before you can sign off
            </h2>
          </div>
          <div className="card__body">
            <dl className="dl">
              <div className="dl__row">
                <dt>All sample items concluded</dt>
                <dd>
                  {facts.concluded} of {facts.sample}
                  {facts.concluded < facts.sample
                    ? `. ${facts.sample - facts.concluded} ${facts.sample - facts.concluded === 1 ? "item is" : "items are"} not concluded.`
                    : ""}
                </dd>
              </div>
              <div className="dl__row">
                <dt>No returned items outstanding</dt>
                <dd>{openBlockers.length === 0 ? "None" : `${openBlockers.length} outstanding`}</dd>
              </div>
              <div className="dl__row">
                <dt>You are eligible to sign off this cycle</dt>
                <dd>
                  {facts.may_sign ? "Yes. " : "No. "}
                  {eligibilityText(facts)}
                </dd>
              </div>
              <div className="dl__row">
                <dt>Cohort observations recorded</dt>
                <dd>
                  {facts.observations === 0 ? "None" : `${facts.observations} recorded`}. Optional.{" "}
                  <TextLink href={`/moderate/cycles/${cycleId}`}>Add one on the cycle page</TextLink>.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {facts.blockers.length > 0 && !signed ? (
          <section aria-labelledby="outstanding-h" className="stack" id="outstanding">
            <h2 className="text-heading" id="outstanding-h">
              Items still open ({facts.blockers.length})
            </h2>
            <DataTable
              caption="Sample items that block sign-off, with who must act next and the re-mark deadline. Times in SAST."
              columns={[
                {
                  key: "item",
                  header: "Learner and item",
                  primary: true,
                  cell: (blocker) => (
                    <>
                      {blocker.learner_name}
                      <span className="table__secondary">
                        Item {blocker.seq} of {facts.sample} · {blocker.item_title}
                      </span>
                    </>
                  ),
                },
                {
                  key: "who",
                  header: "Who must act next",
                  cell: (blocker) => blockerActorText(blocker, access?.profile_id ?? null),
                },
                {
                  key: "returned",
                  header: "Returned (SAST)",
                  cell: (blocker) => (blocker.returned_at ? formatDateTime(blocker.returned_at) : "Not returned"),
                },
                {
                  key: "due",
                  header: "Re-mark due",
                  cell: (blocker) =>
                    blocker.due_on ? (
                      <>
                        {formatDay(blocker.due_on)}
                        <span className="table__secondary">
                          {blocker.overdue ? (
                            <Tag tone="caution">{dueText(blocker.due_on, now)}</Tag>
                          ) : (
                            dueText(blocker.due_on, now)
                          )}
                        </span>
                      </>
                    ) : (
                      "–"
                    ),
                },
                {
                  key: "state",
                  header: "State",
                  cell: (blocker) => (
                    <Tag tone={blocker.state === "returned" ? "caution" : "info"}>{blockerStateLabel(blocker)}</Tag>
                  ),
                },
                {
                  key: "open",
                  header: "Actions",
                  actions: true,
                  cell: (blocker) =>
                    blocker.moderator_id === access?.profile_id ? (
                      <ButtonLink href={`/moderate/cycles/${cycleId}/items/${blocker.item_id}`} size="sm">
                        {blocker.state === "remarked" ? "Review again" : "Open"}
                        <span className="u-visually-hidden">
                          {" "}
                          item {blocker.seq}, {blocker.learner_name}
                        </span>
                      </ButtonLink>
                    ) : null,
                },
              ]}
              rowKey={(blocker) => blocker.item_id}
              rows={facts.blockers}
            />
            <p className="text-small text-muted">
              If a deadline passes, the item shows as overdue to you, the assessor and the coordinator. Nothing is
              released automatically. The coordinator can reallocate a moderator.
            </p>
          </section>
        ) : null}

        {!signed ? (
          <section aria-labelledby="will-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="will-h">
                What sign-off will do
              </h2>
            </div>
            <div className="card__body stack">
              <ul className="stack stack--sm">
                <li>
                  Release exactly {results(facts.population)} to learners in {facts.cohort_name}: the population frozen{" "}
                  {facts.frozen_at ? `on ${formatDateTime(facts.frozen_at)} (SAST)` : "at the freeze"}. Sampled or not,
                  all {facts.population} are released together.
                </li>
                <li>
                  Start each learner&rsquo;s {facts.appeal_window_days}-day appeal window on the day you sign off,
                  including weekends and public holidays.
                </li>
                {facts.not_yet_competent > 0 ? (
                  <li>
                    Start the resubmission period for the {results(facts.not_yet_competent)} decided Not yet competent.
                    Each period runs from the day of release, so the time held has not used any of it.
                  </li>
                ) : null}
                <li>
                  Notify {facts.population === 1 ? "the learner" : `${facts.population} learners`} in the LMS:
                  &ldquo;Your result is ready&rdquo;.
                </li>
                {facts.after_freeze > 0 ? (
                  <li>
                    Not released: {results(facts.after_freeze)} finalised after the freeze. They were never eligible for
                    this sample, so they stay held and wait for the next cycle.
                  </li>
                ) : null}
                <li>Sign-off cannot be undone. A released result cannot be taken back.</li>
              </ul>
              {facts.may_sign ? (
                <SignOffForm
                  blockedBy={reasons}
                  consequence={consequenceText(facts, now)}
                  cycleId={cycleId}
                  name={facts.name}
                  released={facts.population}
                  version={facts.version}
                />
              ) : (
                <p className="text-muted">{eligibilityText(facts)}</p>
              )}
            </div>
          </section>
        ) : null}

        <p>
          <TextLink href={`/moderate/cycles/${cycleId}`}>Back to the cycle</TextLink>
        </p>
      </div>
    </div>
  );
}
