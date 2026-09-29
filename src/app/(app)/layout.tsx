import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { toNavigationSubject } from "@/modules/identity/access";
import { workspacesFor } from "@/modules/identity/navigation";
import { getUnreadCount } from "@/modules/notifications/queries";
import { getSessionPolicy, requireActiveAccess, toAccountSummary } from "@/modules/identity/session";

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const access = await requireActiveAccess();
  const [cookieStore, unread, policy] = await Promise.all([cookies(), getUnreadCount(), getSessionPolicy()]);
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  return (
    <AppShell
      account={toAccountSummary(access)}
      idleMinutes={policy.idleMinutes}
      theme={theme}
      unreadNotifications={unread}
      workspaces={workspacesFor(toNavigationSubject(access))}
    >
      {children}
    </AppShell>
  );
}
