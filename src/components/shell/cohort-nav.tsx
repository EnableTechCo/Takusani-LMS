import { Banner } from "@/components/ui/status";
import { Subnav } from "@/components/ui/process";
import { getCohort } from "@/modules/programmes/queries";

const PAGES = [
  { segment: "", label: "Overview" },
  { segment: "/setup", label: "Setup" },
  { segment: "/people", label: "People" },
  { segment: "/readiness", label: "Readiness" },
  { segment: "/attendance", label: "Attendance" },
  { segment: "/moderation", label: "Moderation" },
  { segment: "/credits", label: "Credits" },
] as const;

/**
 * The pages of one cohort (UX architecture 4.6). The cohort is the object of work, so it is in the path. An archived
 * cohort carries the read-only banner on every one of its pages (FR-112); the database refuses any change to it.
 */
export async function CohortNav({ cohortId, current }: { cohortId: string; current: (typeof PAGES)[number]["label"] }) {
  const cohort = await getCohort(cohortId);
  return (
    <>
      <Subnav
        items={PAGES.map((page) => ({
          label: page.label,
          href: `/coordinate/cohorts/${cohortId}${page.segment}`,
          current: page.label === current,
        }))}
        label="This cohort"
      />
      {cohort?.status === "archived" ? (
        <Banner
          title="This cohort is archived. Its records are read-only: they stay available to reports and records, and nothing can be changed."
          tone="readonly"
        />
      ) : null}
    </>
  );
}
