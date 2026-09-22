import { redirect } from "next/navigation";
import { safeNextPath } from "@/modules/identity/access";
import { SignInForm } from "@/modules/identity/forms";
import { getMyAccess } from "@/modules/identity/session";

export const metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  link_expired: "That link has expired or has already been used. Ask for a new one.",
  no_access: "This account cannot sign in. If you think it should, ask your administrator.",
};

// G-01 (FR-101). Accounts come from an administrator's invitation; there is no public sign-up.
export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next) ?? undefined;
  if ((await getMyAccess())?.status === "active") redirect(next ?? "/");

  return (
    <div className="stack">
      <h1 className="text-title">Sign in</h1>
      <SignInForm next={next} notice={params.reason ? NOTICES[params.reason] : undefined} />
    </div>
  );
}
