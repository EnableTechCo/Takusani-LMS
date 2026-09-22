import { redirect } from "next/navigation";

// The appeal-review workspace has one destination (R-01).
export default function ReviewPage() {
  redirect("/review/appeals");
}
