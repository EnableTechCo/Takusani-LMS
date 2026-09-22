import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { formatDay } from "@/lib/dates";
import { listCohorts } from "@/modules/programmes/queries";
import { MODERATION_POLICY_LABELS } from "@/modules/programmes/rules";

export const metadata = { title: "Cohorts · Coordinating" };

// C-02 (FR-701): the cohorts this coordinator's role covers.
export default async function CohortsPage() {
  const cohorts = await listCohorts();

  return (
    <div className="page">
      <PageHeader workspace="Coordinating" title="Cohorts" lead="The cohorts your coordinator role covers." />
      <div className="stack stack--lg">
        <div className="cluster">
          <Link className="btn btn--primary" href="/coordinate/cohorts/new">
            New cohort
          </Link>
          <Link className="btn btn--secondary" href="/coordinate/programmes/new">
            New programme
          </Link>
        </div>
        {cohorts.length === 0 ? (
          <div className="card">
            <div className="empty">
              <p className="empty__title">No cohorts yet</p>
              <p className="empty__body">Create a programme, then a cohort in it, and enrol learners.</p>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--cards">
              <caption className="u-visually-hidden">Cohorts, most recent start first</caption>
              <thead>
                <tr>
                  <th scope="col">Cohort</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Moderation</th>
                  <th scope="col">Learners</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((cohort) => (
                  <tr key={cohort.id}>
                    <th className="table__primary-cell" data-label="Cohort" scope="row">
                      <Link className="link" href={`/coordinate/cohorts/${cohort.id}`}>
                        {cohort.name}
                      </Link>
                      <span className="table__secondary">{cohort.programme_title}</span>
                    </th>
                    <td data-label="Dates">
                      {formatDay(cohort.starts_on)} to {formatDay(cohort.ends_on)}
                    </td>
                    <td data-label="Moderation">{MODERATION_POLICY_LABELS[cohort.moderation_policy]}</td>
                    <td className="table__num" data-label="Learners">
                      {cohort.enrolment_count}
                    </td>
                    <td data-label="Status">
                      <span className={cohort.status === "active" ? "tag tag--positive" : "tag"}>
                        {cohort.status === "active" ? "Active" : "Archived"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
