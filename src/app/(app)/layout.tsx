import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { workspacesFor } from "@/modules/identity/navigation";
import { getAccountSummary, getNavigationSubject } from "@/modules/identity/session";

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [subject, account] = await Promise.all([getNavigationSubject(), getAccountSummary()]);
  return (
    <AppShell account={account} workspaces={workspacesFor(subject)}>
      {children}
    </AppShell>
  );
}
