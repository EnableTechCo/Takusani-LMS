import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { workspacesFor } from "@/modules/identity/navigation";
import { getNavigationSubject } from "@/modules/identity/session";

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const workspaces = workspacesFor(await getNavigationSubject());
  return <AppShell workspaces={workspaces}>{children}</AppShell>;
}
