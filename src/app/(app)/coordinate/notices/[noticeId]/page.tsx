import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/link";
import { Banner, EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { cancelNotice } from "@/modules/notifications/notices-actions";
import { audienceLabel, noticeStateLabel } from "@/modules/notifications/notices-rules";
import { getNotice, listNoticeDeliveries } from "@/modules/notifications/notices-queries";

export const metadata = { title: "Notice · Coordinating" };

const EMAIL_STATES: Record<string, string> = {
  pending: "Sending",
  accepted: "Sent",
  delivered: "Delivered",
  failed: "Could not be delivered",
  skipped: "Not sent",
};

// C-09 (FR-703): one notice, and its delivery log: each recipient, when they were told, and whether they have read it.
export default async function NoticePage({
  params,
  searchParams,
}: {
  params: Promise<{ noticeId: string }>;
  searchParams: Promise<{ sent?: string; scheduled?: string }>;
}) {
  const [{ noticeId }, flash] = await Promise.all([params, searchParams]);
  const notice = await getNotice(noticeId);
  if (!notice) notFound();
  const deliveries = notice.state === "sent" ? await listNoticeDeliveries(notice.id) : [];
  const read = deliveries.filter((row) => row.read_at).length;
  const label = noticeStateLabel(notice.state);
  const people = (count: number) => (count === 1 ? "1 person" : `${count} people`);

  return (
    <div className="page">
      <PageHeader
        lead={`From ${notice.sender_name}. For: ${audienceLabel(notice)}.`}
        meta={
          <>
            <Tag
              shape={label === "Scheduled" ? "half" : undefined}
              tone={label === "Sent" ? "positive" : label === "Scheduled" ? "info" : "neutral"}
            >
              {label}
            </Tag>
            <span>
              {notice.state === "sent"
                ? `Sent ${formatDateTime(notice.sent_at!)} (SAST)`
                : `${notice.state === "cancelled" ? "Was to send" : "Sends"} ${formatDateTime(notice.send_at)} (SAST)`}
            </span>
          </>
        }
        title={notice.title}
        workspace="Coordinating"
      />
      <div className="stack stack--lg">
        {flash.sent !== undefined ? (
          <Banner compact role="status" title="Sent" tone="positive">
            <p>{people(Number(flash.sent))} told in the LMS.</p>
          </Banner>
        ) : null}
        {flash.scheduled !== undefined ? (
          <Banner compact role="status" title="Scheduled" tone="positive">
            <p>
              It goes out at {formatDateTime(notice.send_at)} (SAST), to {people(Number(flash.scheduled))} as things
              stand today.
            </p>
          </Banner>
        ) : null}

        <section aria-labelledby="message-h" className="card">
          <div className="card__header">
            <h2 className="card__title" id="message-h">
              Message
            </h2>
          </div>
          <div className="card__body prose">
            {notice.body
              .split(/\n\s*\n/)
              .filter((paragraph) => paragraph.trim())
              .map((paragraph, index) => (
                <p className="whitespace-pre-line" key={index}>
                  {paragraph.trim()}
                </p>
              ))}
          </div>
        </section>

        {notice.state === "sent" ? (
          <section aria-labelledby="log-h" className="stack">
            <h2 className="text-heading" id="log-h">
              Delivery log
            </h2>
            <p className="text-small text-muted">
              {people(notice.recipients ?? 0)} told in the LMS; {read} {read === 1 ? "has" : "have"} read it.
            </p>
            {deliveries.length === 0 ? (
              <div className="card">
                <EmptyState title="Nobody to tell">
                  <p>No one was in the audience when it was sent.</p>
                </EmptyState>
              </div>
            ) : (
              <DataTable
                caption="Each recipient, when they were told, and whether they have read it. Times in SAST."
                columns={[
                  {
                    key: "name",
                    header: "Recipient",
                    primary: true,
                    cell: (row) => (
                      <>
                        {row.recipient_name}
                        {row.learner_number ? (
                          <span className="table__secondary mono">{row.learner_number}</span>
                        ) : null}
                      </>
                    ),
                  },
                  { key: "told", header: "Told in the LMS", cell: (row) => formatDateTime(row.told_at) },
                  {
                    key: "read",
                    header: "Read",
                    cell: (row) => (row.read_at ? formatDateTime(row.read_at) : "Not yet"),
                  },
                  {
                    key: "email",
                    header: "Email",
                    cell: (row) =>
                      row.email_state ? (EMAIL_STATES[row.email_state] ?? row.email_state) : "Email is off",
                  },
                ]}
                rowKey={(row) => `${row.recipient_name}-${row.told_at}`}
                rows={deliveries}
              />
            )}
          </section>
        ) : null}

        <div className="cluster cluster--between">
          <TextLink href="/coordinate/notices">All notices</TextLink>
          {notice.can_cancel ? (
            <form action={cancelNotice.bind(null, notice.id)}>
              <Button type="submit" variant="ghost">
                Cancel this notice
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
