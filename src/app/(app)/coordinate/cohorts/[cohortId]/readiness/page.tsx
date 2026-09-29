import { notFound } from "next/navigation";
import { CohortNav } from "@/components/shell/cohort-nav";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Tag } from "@/components/ui/status";
import { formatDateTime, formatDay } from "@/lib/dates";
import { roleLabel } from "@/modules/identity/roles-rules";
import { AssignItemForm, LogisticsToggle } from "@/modules/programmes/setup-forms";
import { getCohortReadiness, getCohortSetup, listCohortStaff } from "@/modules/programmes/setup-queries";
import { READINESS_ITEMS, readinessDetail } from "@/modules/programmes/setup-rules";

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }) {
  const cohort = await getCohortSetup((await params).cohortId);
  return { title: cohort ? `Readiness: ${cohort.name} · Coordinating` : "Not found" };
}

// C-05 (FR-702): the readiness checklist, counted from the cohort itself: material, published tasks, role
// assignments, enrolments, scheduled sessions and logistics. Items marked "Needed to activate" gate activation. An
// open item can be assigned to someone on the cohort's staff, with a due date; they are told in the LMS.
export default async function ReadinessPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const cohort = await getCohortSetup(cohortId);
  if (!cohort) notFound();
  const [items, staff] = await Promise.all([getCohortReadiness(cohortId), listCohortStaff(cohortId)]);
  const people = [...new Map(staff.map((person) => [person.profile_id, person])).values()].map((person) => ({
    value: person.profile_id,
    label: `${person.full_name} (${[...new Set(staff.filter((s) => s.profile_id === person.profile_id).map((s) => roleLabel(s.role)))].join(", ")})`,
  }));
  const done = items.filter((item) => item.done).length;
  const archived = cohort.status === "archived";

  return (
    <div className="page">
      <PageHeader
        lead={cohort.programme_title}
        meta={
          <span>
            {done} of {items.length} done
          </span>
        }
        title={`${cohort.name}: readiness`}
        workspace="Coordinating"
      />
      <CohortNav cohortId={cohort.cohort_id} current="Readiness" />
      <ol className="stack stack--lg" role="list">
        {items.map((item) => {
          const meta = READINESS_ITEMS[item.item_key];
          const detail = readinessDetail(item.item_key, item.detail, cohort.moderation_policy);
          return (
            <li className="card" key={item.item_key}>
              <div className="card__header">
                <h2 className="card__title">{meta?.label ?? item.item_key}</h2>
                <span className="cluster">
                  {item.gate && cohort.status === "setup" ? <Tag shape="half">Needed to activate</Tag> : null}
                  {item.done ? (
                    <Tag shape="check" tone="positive">
                      Done
                    </Tag>
                  ) : (
                    <Tag tone="caution">Open</Tag>
                  )}
                </span>
              </div>
              <div className="card__body stack">
                <p className="text-small">
                  {detail ? <strong>{detail}. </strong> : null}
                  {item.done ? null : meta?.help}
                  {item.item_key === "moderation_policy" || item.item_key === "details" ? (
                    <>
                      {" "}
                      <TextLink href={`/coordinate/cohorts/${cohort.cohort_id}/setup`}>Open setup</TextLink>
                    </>
                  ) : ["learners", "facilitator", "assessor", "moderator"].includes(item.item_key) ? (
                    <>
                      {" "}
                      <TextLink href={`/coordinate/cohorts/${cohort.cohort_id}/people`}>Open people</TextLink>
                    </>
                  ) : null}
                </p>
                {item.assignee_name ? (
                  <p className="text-small">
                    Assigned to <strong>{item.assignee_name}</strong>
                    {item.due_on ? `, due ${formatDay(item.due_on)}` : ""}
                    {item.note ? `: "${item.note}"` : "."}
                  </p>
                ) : null}
                {item.item_key === "logistics" && item.confirmed_at ? (
                  <p className="text-small text-muted">
                    Confirmed by {item.confirmed_by_name}, {formatDateTime(item.confirmed_at)} (SAST).
                  </p>
                ) : null}
                {archived ? null : (
                  <>
                    {item.item_key === "logistics" ? (
                      <div>
                        <LogisticsToggle cohortId={cohort.cohort_id} confirmed={item.done} />
                      </div>
                    ) : null}
                    {!item.done && people.length > 0 ? (
                      <details className="disclosure">
                        {/* A11Y-18: one of these per item, so each says which item it is. */}
                        <summary>
                          {item.assignee_name ? "Reassign this item" : "Assign this item"}
                          <span className="u-visually-hidden">: {meta?.label ?? item.item_key}</span>
                        </summary>
                        <AssignItemForm
                          assigneeId={item.assignee_id}
                          cohortId={cohort.cohort_id}
                          dueOn={item.due_on}
                          itemKey={item.item_key}
                          itemLabel={meta?.label ?? item.item_key}
                          note={item.note}
                          staff={people}
                        />
                      </details>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
