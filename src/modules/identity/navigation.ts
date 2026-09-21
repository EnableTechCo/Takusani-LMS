/**
 * Unified, role-driven navigation (LMS-ux-architecture.md section 3.3).
 * One navigation grouped by workspace; a group is rendered only for a role the person holds.
 * There is no role switcher and no "acting as" state: the route is the context.
 */

export const ROLES = ["learner", "facilitator", "assessor", "moderator", "coordinator", "administrator"] as const;
export type Role = (typeof ROLES)[number];

export interface NavItem {
  label: string;
  href: string;
}

export interface Workspace {
  id: WorkspaceId;
  /** Route prefix, without the leading slash. */
  segment: string;
  /** Label shown above page titles and as the navigation group heading. */
  label: string;
  items: readonly NavItem[];
}

export type WorkspaceId = "learn" | "teach" | "assess" | "moderate" | "review" | "coordinate" | "admin";

/** Desktop order, section 3.3. Learning is always listed first. */
export const WORKSPACES: readonly Workspace[] = [
  {
    id: "learn",
    segment: "learn",
    label: "Learning",
    items: [
      { label: "Home", href: "/learn" },
      { label: "Tasks", href: "/learn/tasks" },
      { label: "Exams", href: "/learn/exams" },
      { label: "Materials", href: "/learn/materials" },
      { label: "Calendar", href: "/learn/calendar" },
      { label: "Results", href: "/learn/results" },
      { label: "Credits", href: "/learn/credits" },
      { label: "Notes", href: "/learn/notes" },
    ],
  },
  {
    id: "teach",
    segment: "teach",
    label: "Teaching",
    items: [
      { label: "Overview", href: "/teach" },
      { label: "Tasks", href: "/teach/tasks" },
      { label: "Materials", href: "/teach/materials" },
      { label: "Quizzes", href: "/teach/quizzes" },
      { label: "Sessions", href: "/teach/sessions" },
      { label: "Submissions", href: "/teach/submissions" },
    ],
  },
  {
    id: "assess",
    segment: "assess",
    label: "Assessing",
    items: [
      { label: "Queue", href: "/assess" },
      { label: "Returned to me", href: "/assess/returned" },
      { label: "Cohort release status", href: "/assess/status" },
    ],
  },
  {
    id: "moderate",
    segment: "moderate",
    label: "Moderating",
    items: [
      { label: "Cycles", href: "/moderate" },
      { label: "My sample items", href: "/moderate/items" },
    ],
  },
  {
    id: "review",
    segment: "review",
    label: "Appeal reviews",
    items: [{ label: "Reviews", href: "/review" }],
  },
  {
    id: "coordinate",
    segment: "coordinate",
    label: "Coordinating",
    items: [
      { label: "Overview", href: "/coordinate" },
      { label: "Cohorts", href: "/coordinate/cohorts" },
      { label: "Appeals", href: "/coordinate/appeals" },
      { label: "Notices", href: "/coordinate/notices" },
      { label: "Queries", href: "/coordinate/queries" },
      { label: "Logistics", href: "/coordinate/logistics" },
      { label: "Reports", href: "/coordinate/reports" },
    ],
  },
  {
    id: "admin",
    segment: "admin",
    label: "Administration",
    items: [
      { label: "Accounts", href: "/admin/accounts" },
      { label: "Imports", href: "/admin/imports" },
      { label: "Configuration", href: "/admin/configuration" },
      { label: "Department integration", href: "/admin/department" },
      { label: "Audit log", href: "/admin/audit" },
      { label: "Cohort archive", href: "/admin/archive" },
    ],
  },
];

const ROLE_WORKSPACE: Record<Role, WorkspaceId> = {
  learner: "learn",
  facilitator: "teach",
  assessor: "assess",
  moderator: "moderate",
  coordinator: "coordinate",
  administrator: "admin",
};

export interface NavigationSubject {
  roles: readonly Role[];
  /** Appeal reviews are allocation-based, not a role (BR-02, AS-02). */
  hasReviewAllocation: boolean;
}

/** The workspaces this person may see, in desktop order. Unheld workspaces are never returned. */
export function workspacesFor(subject: NavigationSubject): Workspace[] {
  const held = new Set<WorkspaceId>(subject.roles.map((role) => ROLE_WORKSPACE[role]));
  if (subject.hasReviewAllocation) held.add("review");
  return WORKSPACES.filter((workspace) => held.has(workspace.id));
}

export function findWorkspace(segment: string): Workspace | undefined {
  return WORKSPACES.find((workspace) => workspace.segment === segment);
}

/** Section 3.3 landing rules: learner only goes to /learn; any staff role goes to /home; nobody signed in goes to /sign-in. */
export function landingPathFor(subject: NavigationSubject): string {
  const workspaces = workspacesFor(subject);
  if (workspaces.length === 0) return "/sign-in";
  if (workspaces.length === 1 && workspaces[0].id === "learn") return "/learn";
  return "/home";
}
