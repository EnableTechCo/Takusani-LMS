import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner } from "@/components/ui/status";
import { getMyResult } from "@/modules/assessment/queries";
import { appealWindow } from "@/modules/assessment/rules";

export const metadata = { title: "Appeal your result" };

// L-16 until online appeals ship (S3-01): how to appeal, and until when (S2-09 MVP). The appeal form (type, grounds,
// the remark warning) replaces this page in Sprint 3.
export default async function LearnAppealNewPage({ params }: { params: Promise<{ resultId: string }> }) {
  const result = await getMyResult((await params).resultId);
  if (!result || result.state !== "released") notFound();

  const window = appealWindow(result.appeal_deadline_at, new Date());

  return (
    <div className="page">
      <PageHeader lead={result.item_title} title="Appeal your result" workspace="Learning" />
      <div className="stack stack--lg u-measure">
        {window.state === "closed" ? (
          <Banner role="note" title="The time to appeal has closed" tone="readonly">
            <p>It closed at the end of {window.lastDay}.</p>
          </Banner>
        ) : (
          <Banner role="note" title="To appeal, contact your coordinator" tone="info">
            <p>
              Appeals cannot be lodged online yet. Contact your coordinator{" "}
              <strong>
                before the end of {window.state === "last_day" ? `today, ${window.lastDay}` : window.lastDay}
              </strong>
              . Say which result you are appealing, and why you think the mark does not match the work you submitted.
            </p>
            <p className="u-mt-2">
              You can ask to see your marked work, or ask for it to be marked again by someone who did not mark it. A
              new mark can go up, stay the same, or go down.
            </p>
          </Banner>
        )}
        <p>
          <TextLink href={`/learn/results/${result.result_id}`}>Back to your result</TextLink>
        </p>
      </div>
    </div>
  );
}
