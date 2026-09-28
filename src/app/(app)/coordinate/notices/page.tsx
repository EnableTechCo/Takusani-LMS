import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { audienceLabel, noticeStateLabel } from "@/modules/notifications/notices-rules";
import { listNotices } from "@/modules/notifications/notices-queries";

export const metadata = { title: "Notices · Coordinating" };

// C-09 (FR-703): notices sent and scheduled, newest first, with how many were told and how many have read it.
export default async function NoticesPage() {
  const notices = await listNotices();
  return (
    <div className="page">
      <PageHeader
        actions={
          <ButtonLink href="/coordinate/notices/new" variant="primary">
            New notice
          </ButtonLink>
        }
        lead="Message a cohort, a role group or everyone, now or at a later time. Times are SAST."
        title="Notices"
        workspace="Coordinating"
      />
      {notices.length === 0 ? (
        <div className="card">
          <EmptyState icon="megaphone" title="No notices yet">
            <p>Each person is told in the LMS, and you see who was told and who has read it.</p>
          </EmptyState>
        </div>
      ) : (
        <DataTable
          caption="Notices, newest first. Times in SAST."
          columns={[
            {
              key: "title",
              header: "Notice",
              primary: true,
              cell: (notice) => (
                <>
                  <TextLink href={`/coordinate/notices/${notice.id}`}>{notice.title}</TextLink>
                  <span className="table__secondary">From {notice.sender_name}</span>
                </>
              ),
            },
            { key: "audience", header: "For", cell: (notice) => audienceLabel(notice) },
            {
              key: "when",
              header: "Sends (SAST)",
              cell: (notice) => formatDateTime(notice.sent_at ?? notice.send_at),
            },
            {
              key: "state",
              header: "State",
              cell: (notice) => {
                const label = noticeStateLabel(notice.state);
                return (
                  <Tag
                    shape={label === "Scheduled" ? "half" : undefined}
                    tone={label === "Sent" ? "positive" : label === "Scheduled" ? "info" : "neutral"}
                  >
                    {label}
                  </Tag>
                );
              },
            },
            {
              key: "read",
              header: "Read",
              cell: (notice) =>
                notice.state === "sent" ? `${notice.read_count} of ${notice.recipients}` : "Not sent yet",
            },
          ]}
          rowKey={(notice) => notice.id}
          rows={notices}
        />
      )}
    </div>
  );
}
