import { notFound } from "next/navigation";
import { CohortNav } from "@/components/shell/cohort-nav";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime, formatDay } from "@/lib/dates";
import { MODERATION_POLICY_LABELS } from "@/modules/programmes/rules";
import { ActivateForm, PolicyForm } from "@/modules/programmes/setup-forms";
import { getCohortReadiness, getCohortSetup, listPolicyHistory } from "@/modules/programmes/setup-queries";
import { COHORT_STATUS_LABELS, READINESS_ITEMS, readinessDetail } from "@/modules/programmes/setup-rules";

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }) {
  const cohort = await getCohortSetup((await params).cohortId);
  return { title: cohort ? `Setup: ${cohort.name} · Coordinating` : "Not found" };
}

// C-03 (FR-701, BR-04, P-01; prototype coordinate-cohort-setup.html): the cohort's details, its moderation policy
// (no default; versioned; a change to Not moderated refused while results wait), and activation once the gating
// readiness items are done. Until then the cohort is hidden from learners.
export default async function CohortSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ cohortId: string }>;
  searchParams: Promise<{ policy?: string; activate?: string; learners?: string }>;
}) {
  const [{ cohortId }, flash] = await Promise.all([params, searchParams]);
  const cohort = await getCohortSetup(cohortId);
  if (!cohort) notFound();
  const [readiness, history] = await Promise.all([getCohortReadiness(cohortId), listPolicyHistory(cohortId)]);
  const gate = readiness.filter((item) => item.gate);
  const missing = gate.filter((item) => !item.done);
  const inSetup = cohort.status === "setup";

  return (
    <div className="page">
      <PageHeader
        lead={cohort.programme_title}
        meta={
          <>
            <Tag
              shape={inSetup ? "half" : "dot"}
              tone={inSetup ? "info" : cohort.status === "active" ? "positive" : "neutral"}
            >
              {COHORT_STATUS_LABELS[cohort.status] ?? cohort.status}
            </Tag>
            {cohort.moderation_policy ? (
              <Tag>{MODERATION_POLICY_LABELS[cohort.moderation_policy]}</Tag>
            ) : (
              <Tag tone="caution">Moderation policy not chosen</Tag>
            )}
          </>
        }
        title={`${cohort.name}: setup`}
        workspace="Coordinating"
      />
      <CohortNav cohortId={cohort.cohort_id} current="Setup" />
      <div className="page-layout">
        <div className="page-layout__main stack stack--lg">
          {inSetup ? (
            <Banner role="note" title="This cohort is being set up" tone="info">
              <p>
                Learners do not see it yet. Staff can prepare it: enrol learners, publish assignments and material,
                schedule sessions. Activate it when everything needed is in place.
              </p>
            </Banner>
          ) : null}
          {flash.policy ? (
            <Banner
              compact
              role="status"
              title={`Moderation policy saved as version ${flash.policy}`}
              tone="positive"
            />
          ) : null}
          {flash.activate === "ok" ? (
            <Banner compact role="status" title="Cohort activated" tone="positive">
              <p>
                {flash.learners === "1" ? "Its learner now sees it." : `Its ${flash.learners} learners now see it.`}
              </p>
            </Banner>
          ) : flash.activate === "not_ready" ? (
            <Banner
              compact
              title="The cohort cannot be activated yet: something below is still needed."
              tone="critical"
            />
          ) : null}

          <section aria-labelledby="details-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="details-h">
                1. Details
              </h2>
            </div>
            <div className="card__body">
              <dl className="dl">
                <div className="dl__row">
                  <dt>Programme</dt>
                  <dd>{cohort.programme_title}</dd>
                </div>
                <div className="dl__row">
                  <dt>Cohort name</dt>
                  <dd>{cohort.name}</dd>
                </div>
                <div className="dl__row">
                  <dt>Dates</dt>
                  <dd>
                    {formatDay(cohort.starts_on)} to the end of {formatDay(cohort.ends_on)}
                  </dd>
                </div>
                <div className="dl__row">
                  <dt>Activated</dt>
                  <dd>
                    {cohort.activated_at
                      ? `${formatDateTime(cohort.activated_at)} (SAST)${cohort.activated_by_name ? ` by ${cohort.activated_by_name}` : ""}`
                      : "Not yet"}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section aria-labelledby="policy-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="policy-h">
                2. Moderation policy
              </h2>
              {cohort.moderation_policy ? (
                <span className="text-small text-muted">Version {cohort.policy_version} in force</span>
              ) : (
                <Tag tone="caution">Not chosen</Tag>
              )}
            </div>
            <div className="card__body">
              {cohort.status === "archived" ? (
                <p>{MODERATION_POLICY_LABELS[cohort.moderation_policy ?? ""] ?? "None"}. The cohort is archived.</p>
              ) : (
                <PolicyForm
                  cohortId={cohort.cohort_id}
                  cohortName={cohort.name}
                  key={cohort.policy_version}
                  policy={cohort.moderation_policy}
                  version={cohort.policy_version}
                />
              )}
            </div>
          </section>

          <section aria-labelledby="people-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="people-h">
                3. People
              </h2>
              <TextLink href={`/coordinate/cohorts/${cohort.cohort_id}/people`}>Manage people</TextLink>
            </div>
            <div className="card__body">
              <p>
                {readinessDetail("learners", String(cohort.learners), null)} enrolled
                {inSetup && cohort.learners > 0 ? ", waiting for the cohort to be activated" : ""}. Staff:{" "}
                {["facilitator", "assessor", "moderator"]
                  .map((key) =>
                    readinessDetail(key, readiness.find((item) => item.item_key === key)?.detail ?? "0", null),
                  )
                  .join(", ")}
                .
              </p>
            </div>
          </section>

          {inSetup ? (
            <section aria-labelledby="activate-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="activate-h">
                  4. Review and activate
                </h2>
              </div>
              <div className="card__body stack">
                {missing.length > 0 ? (
                  <>
                    <p>
                      {missing.length === 1 ? "1 thing is" : `${missing.length} things are`} still needed before this
                      cohort can be activated:
                    </p>
                    <ul className="stack" role="list">
                      {missing.map((item) => (
                        <li key={item.item_key}>
                          <strong>{READINESS_ITEMS[item.item_key]?.label}</strong>:{" "}
                          {READINESS_ITEMS[item.item_key]?.help}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <p>Everything needed is in place.</p>
                    <div>
                      <ActivateForm cohortId={cohort.cohort_id} cohortName={cohort.name} learners={cohort.learners} />
                    </div>
                  </>
                )}
              </div>
            </section>
          ) : null}
        </div>

        <aside aria-label="Readiness and history" className="page-layout__aside stack">
          <section aria-labelledby="ready-h" className="card card--sunken">
            <div className="card__header">
              <h2 className="card__title" id="ready-h">
                Readiness ({gate.length - missing.length} of {gate.length} done)
              </h2>
            </div>
            <div className="card__body">
              <ul className="stack" role="list">
                {gate.map((item) => (
                  <li className="cluster cluster--between" key={item.item_key}>
                    <span>{READINESS_ITEMS[item.item_key]?.label}</span>
                    {item.done ? (
                      <Tag shape="check" tone="positive">
                        Done
                      </Tag>
                    ) : (
                      <Tag tone="caution">Needed</Tag>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-small u-mt-3">
                <TextLink href={`/coordinate/cohorts/${cohort.cohort_id}/readiness`}>The whole checklist</TextLink>
              </p>
            </div>
          </section>

          <section aria-labelledby="history-h" className="card card--sunken">
            <div className="card__header">
              <h2 className="card__title" id="history-h">
                Moderation policy history
              </h2>
            </div>
            <div className="card__body">
              {history.length === 0 ? (
                <p className="text-small text-muted">No policy has been chosen yet.</p>
              ) : (
                <ol className="stack" role="list">
                  {history.map((entry, index) => (
                    <li className="text-small" key={index}>
                      {entry.kind === "version" ? (
                        <>
                          <strong>
                            v{entry.version} {MODERATION_POLICY_LABELS[entry.policy ?? ""]}
                          </strong>
                          {index === 0 ? " (current)" : ""}
                          <br />
                          {entry.previous_policy
                            ? `Changed from ${MODERATION_POLICY_LABELS[entry.previous_policy]}`
                            : "First choice"}{" "}
                          by {entry.by_name ?? "the system"}, {formatDateTime(entry.at)}
                          {entry.reason ? (
                            <>
                              <br />
                              &ldquo;{entry.reason}&rdquo;
                            </>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <strong>Change refused</strong>
                          <br />
                          {entry.by_name} asked to change the policy to {MODERATION_POLICY_LABELS[entry.policy ?? ""]},{" "}
                          {formatDateTime(entry.at)}. Refused: {entry.waiting} waiting, {entry.held} held. The policy
                          stayed at version {entry.version}.
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
