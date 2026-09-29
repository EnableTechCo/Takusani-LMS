import type { ReactNode } from "react";
import { ActivityBeacon } from "@/components/shell/idle-sign-out";
import { requireWorkspace } from "@/modules/identity/session";

/**
 * ExamShell (UX architecture section 8): no navigation, notifications, search or account menu (FR-901).
 * Each exam page renders its own exam bar. Only learners sit exams. No inactivity limit applies here, and an open exam
 * page keeps the learner's other tabs from signing them out (A11Y-07).
 */
export default async function ExamLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireWorkspace("learn");
  return (
    <>
      <ActivityBeacon />
      {children}
    </>
  );
}
