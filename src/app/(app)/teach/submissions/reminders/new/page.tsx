import { redirect } from "next/navigation";

// F-10: a reminder is written in a dialog on the dashboard, with the recipients already chosen there (FR-212). This
// address is kept for links and bookmarks, and leads to the dashboard.
export default function NewReminderPage() {
  redirect("/teach/submissions?status=outstanding");
}
