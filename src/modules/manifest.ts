export const MODULES = [
  { id: "identity", label: "Identity", summary: "Profiles, scoped roles, allocations, and authentication controls." },
  {
    id: "programmes",
    label: "Programmes & cohorts",
    summary: "Programme structure, cohort lifecycle, enrolment, and moderation policy.",
  },
  {
    id: "learning",
    label: "Learning content",
    summary: "Units, materials, sessions, attendance, and calendar feeds.",
  },
  {
    id: "submissions",
    label: "Assignments & submissions",
    summary: "Assignments, upload intents, immutable versions, and receipts.",
  },
  {
    id: "exams",
    label: "Exams",
    // Deprecated 2026-09-29: no exam route, function or table exists; the empty schema keeps the boundary reserved.
    summary: "Deprecated and in the backlog until further notice. The schema is reserved and empty; no routes exist.",
  },
  { id: "assessment", label: "Assessment", summary: "Allocations, evidence, immutable decisions, and results." },
  {
    id: "moderation",
    label: "Moderation",
    summary: "Scoped cycles, frozen populations, samples, holds, and sign-off.",
  },
  { id: "appeals", label: "Appeals", summary: "Eligibility, reviewer separation, evidence, and decisions." },
  { id: "credits", label: "Credits", summary: "Versioned requirements, roll-up, ledger entries, and reconciliation." },
  { id: "notifications", label: "Notifications", summary: "Outbox, queue delivery, provider calls, and read state." },
  { id: "reporting", label: "Reporting", summary: "Authorised operational and academic projections." },
  {
    id: "department",
    label: "Department integration",
    summary: "Scoped credentials, records API, throttling, and access audit.",
  },
  { id: "audit", label: "Audit & administration", summary: "Atomic audit history and administrative controls." },
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];
