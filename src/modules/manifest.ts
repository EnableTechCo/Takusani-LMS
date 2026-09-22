export const MODULES = [
  { id: "identity", label: "Identity", summary: "Profiles, scoped roles, allocations, and authentication controls." },
  {
    id: "programmes",
    label: "Programmes & cohorts",
    summary: "Programme structure, cohort lifecycle, enrolment, and moderation policy.",
  },
  {
    id: "learning-content",
    label: "Learning content",
    summary: "Units, materials, sessions, attendance, and calendar feeds.",
  },
  {
    id: "submissions",
    label: "Tasks & submissions",
    summary: "Tasks, upload intents, immutable versions, and receipts.",
  },
  { id: "exams", label: "Exams", summary: "Attempts, leases, batched autosave, expiry, submission, and recovery." },
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
