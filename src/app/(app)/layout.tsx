import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { toNavigationSubject } from "@/modules/identity/access";
import { workspacesFor } from "@/modules/identity/navigation";
import { requireActiveAccess, toAccountSummary } from "@/modules/identity/session";

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const access = await requireActiveAccess();
  return (
    <AppShell account={toAccountSummary(access)} workspaces={workspacesFor(toNavigationSubject(access))}>
      {children}
    </AppShell>
  );
}
