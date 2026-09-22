import { Subnav } from "@/components/ui/process";

const PAGES = [
  { segment: "", label: "Overview" },
  { segment: "/setup", label: "Setup" },
  { segment: "/people", label: "People" },
  { segment: "/readiness", label: "Readiness" },
  { segment: "/moderation", label: "Moderation" },
] as const;

/** The pages of one cohort (UX architecture 4.6). The cohort is the object of work, so it is in the path. */
export function CohortNav({ cohortId, current }: { cohortId: string; current: (typeof PAGES)[number]["label"] }) {
  return (
    <Subnav
      items={PAGES.map((page) => ({
        label: page.label,
        href: `/coordinate/cohorts/${cohortId}${page.segment}`,
        current: page.label === current,
      }))}
      label="This cohort"
    />
  );
}
