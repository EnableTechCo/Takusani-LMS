import Link from "next/link";

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
    <nav aria-label="This cohort" className="tabs">
      <div className="tabs__list">
        {PAGES.map((page) => (
          <Link
            aria-current={page.label === current ? "page" : undefined}
            className="tabs__tab"
            href={`/coordinate/cohorts/${cohortId}${page.segment}`}
            key={page.label}
          >
            {page.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
