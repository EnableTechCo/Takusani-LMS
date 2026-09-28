import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { listConfiguration } from "@/modules/audit/configuration-queries";
import { effectiveText, fromText, valueText, type Choice } from "@/modules/audit/configuration-rules";

export const metadata = { title: "Configuration · Administration" };

// X-05 (FR-108, FR-109, NFR-09): the settings that shape outcomes, each with the value in force, since when, and who
// recorded it. A setting is never edited; a change is a new version.
export default async function ConfigurationPage() {
  const { settings, units } = await listConfiguration();
  const groups = [...new Map(settings.map((setting) => [setting.group_key, setting.group_label])).entries()];
  const scheduled = settings.filter((setting) => setting.scheduled_from).length;

  return (
    <div className="page">
      <PageHeader
        lead="Settings that apply to the whole institution. A setting is never edited: a change is recorded as a new version with the day it takes effect, and every earlier version stays on record with who changed it."
        meta={
          scheduled > 0 ? (
            <Tag tone="info">{scheduled === 1 ? "1 change scheduled" : `${scheduled} changes scheduled`}</Tag>
          ) : (
            <Tag>No changes scheduled</Tag>
          )
        }
        title="Configuration"
        workspace="Administration"
      />
      <div className="stack stack--lg">
        <Banner role="note" title="A change never reaches back" tone="info">
          <p>
            A released result keeps the appeal closing day it was given. An upload keeps the limit it started with. An
            exam attempt will keep the integrity settings it started with, and a moderation cycle the sampling rule it
            was frozen with. Credits already awarded keep their value.
          </p>
        </Banner>

        {groups.map(([groupKey, groupLabel]) => (
          <section aria-labelledby={`g-${groupKey}`} className="stack" key={groupKey}>
            <h2 className="text-heading" id={`g-${groupKey}`}>
              {groupLabel}
            </h2>
            <DataTable
              caption={`${groupLabel} settings. Times in SAST.`}
              columns={[
                {
                  key: "label",
                  header: "Setting",
                  primary: true,
                  cell: (setting) => (
                    <>
                      {setting.label}
                      <span className="table__secondary mono">{setting.key}</span>
                    </>
                  ),
                },
                {
                  key: "value",
                  header: "Value in force",
                  cell: (setting) => {
                    const shape = { ...setting, choices: setting.choices as unknown as Choice[] | null };
                    return (
                      <>
                        {valueText(shape, setting.value)}
                        {setting.scheduled_from ? (
                          <span className="table__secondary">
                            <Tag tone="info">
                              Scheduled: {valueText(shape, setting.scheduled_value)} {fromText(setting.scheduled_from)}
                            </Tag>
                          </span>
                        ) : null}
                      </>
                    );
                  },
                },
                {
                  key: "from",
                  header: "In force from",
                  cell: (setting) =>
                    effectiveText(setting.effective_from === "-infinity" ? null : setting.effective_from),
                },
                {
                  key: "by",
                  header: "Recorded by",
                  cell: (setting) => setting.recorded_by_name ?? "Set up with the LMS",
                },
                {
                  key: "use",
                  header: "Read by",
                  cell: (setting) =>
                    setting.in_use ? (
                      <Tag shape="dot" tone="positive">
                        The LMS, now
                      </Tag>
                    ) : (
                      <Tag shape="half">When {setting.group_key === "exam" ? "exams are" : "moderation is"} built</Tag>
                    ),
                },
                {
                  key: "open",
                  header: "Actions",
                  actions: true,
                  cell: (setting) => (
                    <ButtonLink href={`/admin/configuration/${setting.key}`} variant="secondary">
                      Open {setting.label}
                    </ButtonLink>
                  ),
                },
              ]}
              rowKey={(setting) => setting.key}
              rows={settings.filter((setting) => setting.group_key === groupKey)}
            />
          </section>
        ))}

        <section aria-labelledby="g-credits" className="stack">
          <h2 className="text-heading" id="g-credits">
            Credit values per unit
          </h2>
          {units.length === 0 ? (
            <p className="text-muted">No units yet. Units are added with a programme.</p>
          ) : (
            <DataTable
              caption="Credit values per unit. Times in SAST."
              columns={[
                {
                  key: "unit",
                  header: "Unit",
                  primary: true,
                  cell: (unit) => (
                    <>
                      {unit.unit_code}: {unit.unit_title}
                      <span className="table__secondary">{unit.programme_title}</span>
                    </>
                  ),
                },
                {
                  key: "credits",
                  header: "Value in force",
                  cell: (unit) => (
                    <>
                      {unit.credits === null ? "Not set" : `${unit.credits} credits`}
                      {unit.scheduled_from ? (
                        <span className="table__secondary">
                          <Tag tone="info">
                            Scheduled: {unit.scheduled_credits} credits {fromText(unit.scheduled_from)}
                          </Tag>
                        </span>
                      ) : null}
                    </>
                  ),
                },
                {
                  key: "from",
                  header: "In force from",
                  cell: (unit) => (unit.effective_from ? effectiveText(unit.effective_from) : "Not set"),
                },
                { key: "by", header: "Recorded by", cell: (unit) => unit.set_by_name ?? "Set up with the LMS" },
                {
                  key: "open",
                  header: "Actions",
                  actions: true,
                  cell: (unit) => (
                    <ButtonLink href={`/admin/configuration/units/${unit.unit_id}`} variant="secondary">
                      Open {unit.unit_code}
                    </ButtonLink>
                  ),
                },
              ]}
              rowKey={(unit) => unit.unit_id}
              rows={units}
            />
          )}
        </section>
      </div>
    </div>
  );
}
