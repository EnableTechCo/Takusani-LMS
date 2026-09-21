import { redirect } from "next/navigation";
import { landingPathFor } from "@/modules/identity/navigation";
import { getNavigationSubject } from "@/modules/identity/session";

// Landing rules (UX section 3.3): learner only to /learn, any staff role to /home, nobody signed in to /sign-in.
export default async function RootPage() {
  redirect(landingPathFor(await getNavigationSubject()));
}
