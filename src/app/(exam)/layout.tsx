import type { ReactNode } from "react";
import { requireWorkspace } from "@/modules/identity/session";

/**
 * ExamShell (UX architecture section 8): no navigation, notifications, search or account menu (FR-901).
 * Each exam page renders its own exam bar. Only learners sit exams.
 */
export default async function ExamLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireWorkspace("learn");
  return children;
}
