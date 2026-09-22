/**
 * Unified, role-driven navigation (LMS-ux-architecture.md section 3.3).
 * One navigation grouped by workspace; a group is rendered only for a role the person holds.
 * There is no role switcher and no "acting as" state: the route is the context.
 */

import type { IconName } from "@/components/ui/icons";

export const ROLES = ["learner", "facilitator", "assessor", "moderator", "coordinator", "administrator"] as const;
export type Role = (typeof ROLES)[number];

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  /** Shown in the phone bottom tabs (at most four per workspace, then "More"). */
  tab?: boolean;
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
      { label: "Home", href: "/learn", icon: "house", tab: true },
      { label: "Tasks", href: "/learn/tasks", icon: "clipboard", tab: true },
      { label: "Exams", href: "/learn/exams", icon: "laptop" },
      { label: "Materials", href: "/learn/materials", icon: "book", tab: true },
      { label: "Calendar", href: "/learn/calendar", icon: "calendar" },
      { label: "Results", href: "/learn/results", icon: "check-circle", tab: true },
      { label: "Credits", href: "/learn/credits", icon: "chart" },
      { label: "Notes", href: "/learn/notes", icon: "note" },
    ],
  },
  {
    id: "teach",
    segment: "teach",
    label: "Teaching",
    items: [
      { label: "Overview", href: "/teach", icon: "house", tab: true },
      { label: "Tasks", href: "/teach/tasks", icon: "clipboard", tab: true },
      { label: "Materials", href: "/teach/materials", icon: "book" },
      { label: "Quizzes", href: "/teach/quizzes", icon: "pencil" },
      { label: "Sessions", href: "/teach/sessions", icon: "video", tab: true },
      { label: "Submissions", href: "/teach/submissions", icon: "inbox", tab: true },
    ],
  },
  {
    id: "assess",
    segment: "assess",
    label: "Assessing",
    items: [
      { label: "Queue", href: "/assess", icon: "inbox", tab: true },
      { label: "Returned to me", href: "/assess/returned", icon: "refresh", tab: true },
      { label: "Cohort release status", href: "/assess/cohorts", icon: "lock", tab: true },
    ],
  },
  {
    id: "moderate",
    segment: "moderate",
    label: "Moderating",
    items: [
      { label: "Cycles", href: "/moderate", icon: "scales", tab: true },
      { label: "My sample items", href: "/moderate/items", icon: "eye", tab: true },
    ],
  },
  {
    id: "review",
    segment: "review",
    label: "Appeal reviews",
    items: [{ label: "Reviews", href: "/review/appeals", icon: "scales", tab: true }],
  },
  {
    id: "coordinate",
    segment: "coordinate",
    label: "Coordinating",
    items: [
      { label: "Overview", href: "/coordinate", icon: "grid", tab: true },
      { label: "Cohorts", href: "/coordinate/cohorts", icon: "users", tab: true },
      { label: "Appeals", href: "/coordinate/appeals", icon: "scales", tab: true },
      { label: "Notices", href: "/coordinate/notices", icon: "megaphone", tab: true },
      { label: "Queries", href: "/coordinate/queries", icon: "help" },
      { label: "Logistics", href: "/coordinate/logistics", icon: "calendar" },
      { label: "Reports", href: "/coordinate/reports", icon: "chart" },
    ],
  },
  {
    id: "admin",
    segment: "admin",
    label: "Administration",
    items: [
      { label: "Overview", href: "/admin", icon: "grid", tab: true },
      { label: "Accounts", href: "/admin/accounts", icon: "users", tab: true },
      { label: "Imports", href: "/admin/imports", icon: "upload", tab: true },
      { label: "Configuration", href: "/admin/configuration", icon: "sliders", tab: true },
      { label: "Department integration", href: "/admin/integration", icon: "external" },
      { label: "Audit log", href: "/admin/audit", icon: "clipboard" },
      { label: "Cohort archive", href: "/admin/cohorts", icon: "archive" },
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
