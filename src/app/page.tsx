import { redirect } from "next/navigation";
import { homePathFor } from "@/modules/identity/access";
import { getMyAccess } from "@/modules/identity/session";

// Landing rules live in homePathFor (UX section 3.3).
export default async function RootPage() {
  redirect(homePathFor(await getMyAccess()));
}
