import { redirect } from "next/navigation";
import { toNavigationSubject } from "@/modules/identity/access";
import { landingPathFor, workspacesFor } from "@/modules/identity/navigation";
import { getMyAccess } from "@/modules/identity/session";

// Landing rules (UX section 3.3): learner only to /learn, any staff role to /home, nobody signed in to /sign-in.
// A signed-in person with no roles yet goes to their account page rather than back to sign-in.
export default async function RootPage() {
  const access = await getMyAccess();
  if (access?.status === "active" && workspacesFor(toNavigationSubject(access)).length === 0) redirect("/account");
  redirect(landingPathFor(toNavigationSubject(access)));
}
