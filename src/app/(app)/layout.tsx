import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { toNavigationSubject } from "@/modules/identity/access";
import { workspacesFor } from "@/modules/identity/navigation";
import { requireActiveAccess, toAccountSummary } from "@/modules/identity/session";

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const access = await requireActiveAccess();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <AppShell account={toAccountSummary(access)} theme={theme} workspaces={workspacesFor(toNavigationSubject(access))}>
      {children}
    </AppShell>
  );
}
