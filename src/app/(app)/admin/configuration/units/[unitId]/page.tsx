import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { UnitCreditForm } from "@/modules/audit/configuration-forms";
import { getUnitCreditHistory } from "@/modules/audit/configuration-queries";
import { effectiveText, fromText, VERSION_STATE_LABELS } from "@/modules/audit/configuration-rules";

export const metadata = { title: "Credit value · Configuration" };

interface CreditVersion {
  credits: number;
  effective_from: string;
  set_by_name: string | null;
  set_at: string;
  reason: string | null;
  state: string;
}

// X-06 for a unit's credit value (FR-108): effective-dated values, never edited, with who set each and why.
export default async function UnitCreditPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ recorded?: string }>;
}) {
  const [{ unitId }, flash] = await Promise.all([params, searchParams]);
  const unit = await getUnitCreditHistory(unitId);
  if (!unit) notFound();
  const versions = (unit.versions ?? []) as unknown as CreditVersion[];
  const current = versions.find((version) => version.state === "in_force") ?? null;
  const scheduled = versions.find((version) => version.state === "scheduled") ?? null;
  const title = `${unit.unit_code}: ${unit.unit_title}`;

  return (
    <div className="page">
      <PageHeader
        lead={`Credit value per unit, ${unit.programme_title}. Credits already awarded keep the value they were awarded with.`}
        meta={
          <>
            {current ? (
              <Tag shape="dot" tone="positive">
                In force: {current.credits} credits
              </Tag>
            ) : null}
            {scheduled ? (
              <Tag tone="info">
                Scheduled: {scheduled.credits} credits {fromText(scheduled.effective_from)}
              </Tag>
            ) : null}
          </>
        }
        title={title}
        workspace="Administration"
      />
      <div className="stack stack--lg">
        {flash.recorded ? (
          <Banner compact role="status" title="New credit value recorded" tone="positive">
            <p>The earlier value stays in the history.</p>
          </Banner>
        ) : null}
        {scheduled ? (
          <Banner role="note" title="A change is scheduled" tone="info">
            <p>
              {scheduled.credits} credits {fromText(scheduled.effective_from)}. Only one change can wait at a time.
            </p>
          </Banner>
        ) : (
          <section aria-labelledby="new-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="new-h">
                Record a new value
              </h2>
            </div>
            <div className="card__body">
              <UnitCreditForm current={current?.credits ?? null} unitId={unitId} unitTitle={title} />
            </div>
          </section>
        )}
        <section aria-labelledby="hist-h" className="stack">
          <h2 className="text-heading" id="hist-h">
            Value history
          </h2>
          <DataTable
            caption={`Every credit value of ${title}, newest first. Times in SAST.`}
            columns={[
              { key: "credits", header: "Credits", primary: true, cell: (version) => `${version.credits} credits` },
              {
                key: "state",
                header: "State",
                cell: (version) => (
                  <Tag tone={version.state === "in_force" ? "positive" : "neutral"}>
                    {VERSION_STATE_LABELS[version.state]}
                  </Tag>
                ),
              },
              { key: "from", header: "In force from", cell: (version) => effectiveText(version.effective_from) },
              { key: "by", header: "Set by", cell: (version) => version.set_by_name ?? "Set up with the LMS" },
              { key: "reason", header: "Reason", cell: (version) => version.reason ?? "Set when the unit was created" },
              { key: "at", header: "Recorded", cell: (version) => formatDateTime(version.set_at) },
            ]}
            rowKey={(version) => version.effective_from}
            rows={versions}
          />
        </section>
        <p>
          <TextLink href="/admin/configuration">All configuration</TextLink>
        </p>
      </div>
    </div>
  );
}
