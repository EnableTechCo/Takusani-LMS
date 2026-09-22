import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { NewCohortForm } from "@/modules/programmes/forms";
import { listProgrammes } from "@/modules/programmes/queries";

export const metadata = { title: "New cohort · Coordinating" };

// C-03 create (FR-701). The moderation policy choice and people sections arrive with cohort setup (S4-03).
export default async function NewCohortPage({ searchParams }: { searchParams: Promise<{ programme?: string }> }) {
  const [{ programme }, programmes] = await Promise.all([searchParams, listProgrammes()]);

  return (
    <div className="page page--form">
      <PageHeader workspace="Coordinating" title="New cohort" lead="A group of learners taking a programme together." />
      <div className="card">
        <div className="card__body">
          {programmes.length === 0 ? (
            <div className="stack">
              <p>There is no programme your role covers yet. A cohort belongs to a programme.</p>
              <div className="cluster">
                <Link className="btn btn--primary" href="/coordinate/programmes/new">
                  New programme
                </Link>
              </div>
            </div>
          ) : (
            <NewCohortForm programmes={programmes} selected={programme} />
          )}
        </div>
      </div>
    </div>
  );
}
