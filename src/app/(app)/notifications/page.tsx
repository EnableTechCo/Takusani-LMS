import { PageHeader } from "@/components/shell/app-shell";

export const metadata = { title: "Notifications" };

// G-05: notification centre with delivery evidence (NFR-11). Built with the notifications ticket.
export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-[45rem] px-4 py-8 md:px-8">
      <PageHeader
        title="Notifications"
        lead="Results, deadlines, appeals and notices, with a record of when and how you were told."
      />
    </div>
  );
}
