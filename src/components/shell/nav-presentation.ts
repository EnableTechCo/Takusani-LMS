import type { IconName } from "@/components/ui/icons";

/**
 * How each navigation destination looks: its icon, and whether it is one of the phone bottom tabs (at most four
 * per workspace, then "More"). Which destinations exist, and who sees them, is decided in
 * src/modules/identity/navigation.ts; a test checks that every destination has an icon here.
 */
export const NAV_ICONS: Record<string, IconName> = {
  "/learn": "house",
  "/learn/tasks": "clipboard",
  "/learn/exams": "laptop",
  "/learn/materials": "book",
  "/learn/calendar": "calendar",
  "/learn/results": "check-circle",
  "/learn/credits": "chart",
  "/learn/notes": "note",
  "/teach": "house",
  "/teach/tasks": "clipboard",
  "/teach/materials": "book",
  "/teach/quizzes": "pencil",
  "/teach/sessions": "video",
  "/teach/submissions": "inbox",
  "/assess": "inbox",
  "/assess/returned": "refresh",
  "/assess/cohorts": "lock",
  "/moderate": "scales",
  "/moderate/items": "eye",
  "/review/appeals": "scales",
  "/coordinate": "grid",
  "/coordinate/cohorts": "users",
  "/coordinate/appeals": "scales",
  "/coordinate/notices": "megaphone",
  "/coordinate/queries": "help",
  "/coordinate/logistics": "calendar",
  "/coordinate/reports": "chart",
  "/admin": "grid",
  "/admin/accounts": "users",
  "/admin/imports": "upload",
  "/admin/configuration": "sliders",
  "/admin/integration": "external",
  "/admin/audit": "clipboard",
  "/admin/cohorts": "archive",
};

const BOTTOM_TABS = new Set<string>([
  "/learn",
  "/learn/tasks",
  "/learn/materials",
  "/learn/results",
  "/teach",
  "/teach/tasks",
  "/teach/sessions",
  "/teach/submissions",
  "/assess",
  "/assess/returned",
  "/assess/cohorts",
  "/moderate",
  "/moderate/items",
  "/review/appeals",
  "/coordinate",
  "/coordinate/cohorts",
  "/coordinate/appeals",
  "/coordinate/notices",
  "/admin",
  "/admin/accounts",
  "/admin/imports",
  "/admin/configuration",
]);

export function navIcon(href: string): IconName {
  return NAV_ICONS[href] ?? "arrow-right";
}

export function isBottomTab(href: string): boolean {
  return BOTTOM_TABS.has(href);
}
