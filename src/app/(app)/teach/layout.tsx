import type { ReactNode } from "react";
import { requireWorkspace } from "@/modules/identity/session";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  await requireWorkspace("teach");
  return children;
}
