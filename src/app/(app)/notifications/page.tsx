import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/link";
import { EmptyState } from "@/components/ui/status";
import { Pagination } from "@/components/ui/table";
import { markAllRead } from "@/modules/notifications/actions";
import { NotificationList, type NotificationRow } from "@/modules/notifications/centre";
import { CATEGORIES, CATEGORY_LABELS, parseCategory } from "@/modules/notifications/centre-rules";
import { listMyNotifications, PAGE_SIZE } from "@/modules/notifications/queries";

export const metadata = { title: "Notifications" };

// G-05 (P0-02; NFR-11): what the person was told, when, and how. Filters are a GET form and pages are links, so the
// whole screen works on the server; opening a row marks it read.
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; page?: string }>;
}) {
  const { show, page: pageParam } = await searchParams;
  const category = parseCategory(show);
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const rows = (await listMyNotifications(category, page)) as unknown as (NotificationRow & {
    total_count: number;
    unread_count: number;
  })[];

  // Past the last page (for example after marking read in another tab), start again from the first.
  if (rows.length === 0 && page > 1)
    redirect(category === "all" ? "/notifications" : `/notifications?show=${category}`);

  const total = rows[0]?.total_count ?? 0;
  const unread = rows[0]?.unread_count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (target: number) => {
    const query = new URLSearchParams();
    if (category !== "all") query.set("show", category);
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return text ? `/notifications?${text}` : "/notifications";
  };
  const lead = `${unread > 0 ? `${unread} unread. ` : ""}Every message here is also a record of when and how we told you.`;

  return (
    <div className="page page--prose">
      <PageHeader
        actions={
          unread > 0 ? (
            <form action={markAllRead}>
              <input name="show" type="hidden" value={category} />
              <Button type="submit" variant="secondary">
                Mark all as read
              </Button>
            </form>
          ) : null
        }
        lead={lead}
        title="Notifications"
      />

      <form
        action="/notifications"
        aria-label="Filter notifications"
        className="table-toolbar"
        method="get"
        role="group"
      >
        {CATEGORIES.map((option) => (
          <button
            aria-pressed={option === category}
            className="filter-chip"
            key={option}
            name={option === "all" ? undefined : "show"}
            type="submit"
            value={option === "all" ? undefined : option}
          >
            {CATEGORY_LABELS[option]}
          </button>
        ))}
      </form>

      <div className="stack stack--lg">
        {rows.length === 0 ? (
          <div className="card">
            <EmptyState
              actions={
                category === "all" ? null : (
                  <ButtonLink href="/notifications" variant="secondary">
                    Show all notifications
                  </ButtonLink>
                )
              }
              icon="bell"
              title={category === "all" ? "No notifications yet" : "Nothing here"}
            >
              <p>
                {category === "all"
                  ? "Messages about your results and new tasks will appear here."
                  : `You have no ${CATEGORY_LABELS[category].toLowerCase()} notifications.`}
              </p>
            </EmptyState>
          </div>
        ) : (
          <>
            <NotificationList now={new Date()} rows={rows} />
            <Pagination
              href={href}
              label="Notification pages"
              page={page}
              pageCount={pageCount}
              summary={`Showing ${(page - 1) * PAGE_SIZE + 1} to ${(page - 1) * PAGE_SIZE + rows.length} of ${total}`}
            />
          </>
        )}
        <p className="text-small text-muted">
          Times are South African time (SAST). The message in the LMS is the record that you were told: your 7 days to
          appeal a result are counted from its release, even if an email does not arrive.
        </p>
      </div>
    </div>
  );
}
