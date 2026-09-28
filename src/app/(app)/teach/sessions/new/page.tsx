import { PageHeader } from "@/components/shell/page-header";
import { createClient } from "@/lib/supabase/server";
import { SessionForm } from "@/modules/learning/sessions-forms";
import { listWorkCohorts } from "@/modules/submissions/queries";

export const metadata = { title: "Schedule a session · Teaching" };

// F-06 new session (FR-206): when, how long, and where; the form says how many learners will be told (FR-207).
export default async function NewSessionPage() {
  const cohorts = await listWorkCohorts();
  const supabase = await createClient();
  const sizes = await Promise.all(
    cohorts.map(async (cohort) => {
      const { data } = await supabase.rpc("cohort_audience_size", { p_cohort_id: cohort.id });
      return data ?? 0;
    }),
  );

  return (
    <div className="page page--form">
      <PageHeader
        lead="It goes on the cohort's calendar at once, and every learner in the cohort is told."
        title="Schedule a session"
        workspace="Teaching"
      />
      <div className="card">
        <div className="card__body">
          <SessionForm
            cohorts={cohorts.map((cohort, index) => ({
              id: cohort.id,
              label: `${cohort.name}, ${cohort.programme_title}`,
              audience: sizes[index],
            }))}
          />
        </div>
      </div>
    </div>
  );
}
