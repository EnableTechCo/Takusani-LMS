import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/status";
import { NoticeForm } from "@/modules/notifications/notices-forms";
import { myNoticeAudiences } from "@/modules/notifications/notices-queries";

export const metadata = { title: "New notice · Coordinating" };

// C-09 new notice (FR-703): the message, who it is for, and when.
export default async function NewNoticePage() {
  const { cohorts, canSendWide } = await myNoticeAudiences();
  return (
    <div className="page page--form">
      <PageHeader lead="Everyone it is for is told in the LMS." title="New notice" workspace="Coordinating" />
      <div className="card">
        <div className="card__body">
          {cohorts.length === 0 && !canSendWide ? (
            <EmptyState icon="megaphone" title="No one to send to">
              <p>You can message the cohorts you coordinate. None is active at the moment.</p>
            </EmptyState>
          ) : (
            <NoticeForm canSendWide={canSendWide} cohorts={cohorts} />
          )}
        </div>
      </div>
    </div>
  );
}
