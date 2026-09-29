import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { TextareaField } from "@/components/ui/field";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { cancelVersion } from "@/modules/audit/configuration-actions";
import { NewValueForm } from "@/modules/audit/configuration-forms";
import { getConfigurationKey } from "@/modules/audit/configuration-queries";
import {
  CONFIG_REFUSALS,
  effectiveText,
  fromText,
  VERSION_STATE_LABELS,
  valueText,
  type Choice,
} from "@/modules/audit/configuration-rules";

export const metadata = { title: "Setting · Configuration" };

interface Version {
  version: number;
  value: unknown;
  previous_value: unknown;
  effective_from: string | null;
  reason: string;
  recorded_by_name: string | null;
  recorded_at: string;
  cancelled_at: string | null;
  cancelled_by_name: string | null;
  cancel_reason: string | null;
  state: string;
}

const STATE_TONES: Record<string, "positive" | "info" | "neutral"> = {
  in_force: "positive",
  scheduled: "info",
  superseded: "neutral",
  cancelled: "neutral",
};

// X-06 (FR-108, FR-109, NFR-09): one setting: the value in force, any change scheduled, what a change affects and
// does not, recording a new version, and every version with who recorded it and why.
export default async function ConfigurationKeyPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ recorded?: string; cancel?: string }>;
}) {
  const [{ key }, flash] = await Promise.all([params, searchParams]);
  const setting = await getConfigurationKey(decodeURIComponent(key));
  // Exam settings stay recorded but are not served: exams are deprecated and in the backlog (29 Sep 2026).
  if (!setting || setting.key.startsWith("exam.")) notFound();

  const shape = { ...setting, choices: setting.choices as unknown as Choice[] | null };
  const versions = (setting.versions ?? []) as unknown as Version[];
  const current = versions.find((version) => version.state === "in_force") ?? null;
  const scheduled = versions.find((version) => version.state === "scheduled") ?? null;
  const nextVersion = Math.max(...versions.map((version) => version.version), 0) + 1;

  return (
    <div className="page">
      <PageHeader
        lead={setting.description}
        meta={
          <>
            {current ? (
              <Tag shape="dot" tone="positive">
                In force: {valueText(shape, current.value)} (version {current.version})
              </Tag>
            ) : null}
            {scheduled ? (
              <Tag tone="info">
                Scheduled: {valueText(shape, scheduled.value)} {fromText(scheduled.effective_from)}
              </Tag>
            ) : null}
            <span className="text-meta mono">{setting.key}</span>
          </>
        }
        title={setting.label}
        workspace="Administration"
      />
      <div className="page-layout">
        <div className="page-layout__main stack stack--lg">
          {flash.recorded ? (
            <Banner compact role="status" title={`Version ${flash.recorded} recorded`} tone="positive">
              <p>
                {scheduled && String(scheduled.version) === flash.recorded
                  ? `It takes effect ${fromText(scheduled.effective_from)}. Until then the value in force is unchanged.`
                  : "It is in force now. The earlier version stays in the history."}
              </p>
            </Banner>
          ) : null}
          {flash.cancel === "ok" ? (
            <Banner compact role="status" title="The scheduled change was cancelled" tone="positive">
              <p>It will not take effect. It stays in the history as cancelled.</p>
            </Banner>
          ) : null}
          {flash.cancel && flash.cancel !== "ok" ? (
            <Banner compact title={CONFIG_REFUSALS[flash.cancel] ?? CONFIG_REFUSALS.error} tone="critical" />
          ) : null}
          {!setting.in_use ? (
            <Banner role="note" title="Recorded now, read later" tone="info">
              <p>
                The LMS does not read this setting yet: it is used when moderation is built. The value you record here
                is the one it will use then.
              </p>
            </Banner>
          ) : null}

          {scheduled ? (
            <section aria-labelledby="sched-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="sched-h">
                  A change is scheduled
                </h2>
              </div>
              <div className="card__body stack">
                <p>
                  Version {scheduled.version}: {valueText(shape, scheduled.value)} {fromText(scheduled.effective_from)},
                  recorded by {scheduled.recorded_by_name}. Only one change can wait at a time; cancel it to record a
                  different one.
                </p>
                <form
                  action={cancelVersion.bind(null, setting.key, scheduled.version)}
                  className="stack"
                  id="cancel-form"
                >
                  <TextareaField help="Kept in the history." label="Why it is cancelled" name="reason" rows={2} />
                  <div>
                    <ConsequenceDialog
                      cancelLabel="Keep the change"
                      confirmLabel="Cancel the change"
                      consequence={`${valueText(shape, scheduled.value)} will not take effect. ${valueText(shape, current?.value)} stays in force.`}
                      form="cancel-form"
                      title={`Cancel the scheduled change to ${setting.label}?`}
                      trigger={{ label: "Cancel the scheduled change", variant: "secondary" }}
                    />
                  </div>
                </form>
              </div>
            </section>
          ) : (
            <section aria-labelledby="new-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="new-h">
                  Record a new value
                </h2>
              </div>
              <div className="card__body">
                <NewValueForm
                  affects={setting.affects}
                  current={current?.value ?? null}
                  doesNotAffect={setting.does_not_affect}
                  label={setting.label}
                  max={setting.max_value ?? null}
                  min={setting.min_value ?? null}
                  nextVersion={nextVersion}
                  setting={shape}
                  settingKey={setting.key}
                />
              </div>
            </section>
          )}

          <section aria-labelledby="hist-h" className="stack">
            <h2 className="text-heading" id="hist-h">
              Version history
            </h2>
            <p className="text-small text-muted">Newest first. Nothing here can be edited or deleted.</p>
            <DataTable
              caption={`Every version of ${setting.label}, newest first. Times in SAST.`}
              columns={[
                {
                  key: "version",
                  header: "Version",
                  primary: true,
                  cell: (version) => (
                    <>
                      Version {version.version}{" "}
                      <Tag shape={version.state === "in_force" ? "dot" : undefined} tone={STATE_TONES[version.state]}>
                        {VERSION_STATE_LABELS[version.state]}
                      </Tag>
                    </>
                  ),
                },
                { key: "value", header: "Value", cell: (version) => valueText(shape, version.value) },
                {
                  key: "previous",
                  header: "Previous value",
                  cell: (version) =>
                    version.previous_value === null ? "None: first value" : valueText(shape, version.previous_value),
                },
                { key: "from", header: "In force from", cell: (version) => effectiveText(version.effective_from) },
                {
                  key: "by",
                  header: "Recorded by",
                  cell: (version) => version.recorded_by_name ?? "Set up with the LMS",
                },
                {
                  key: "reason",
                  header: "Reason",
                  cell: (version) => (
                    <>
                      {version.reason}
                      {version.cancelled_at ? (
                        <span className="table__secondary">
                          Cancelled {formatDateTime(version.cancelled_at)} by {version.cancelled_by_name}:{" "}
                          {version.cancel_reason}
                        </span>
                      ) : null}
                    </>
                  ),
                },
                { key: "at", header: "Recorded", cell: (version) => formatDateTime(version.recorded_at) },
              ]}
              rowKey={(version) => String(version.version)}
              rows={versions}
            />
          </section>
        </div>

        <aside aria-labelledby="effect-h" className="page-layout__aside stack">
          <div className="card card--sunken">
            <div className="card__header">
              <h2 className="card__title" id="effect-h">
                What a change affects
              </h2>
            </div>
            <div className="card__body">
              <dl className="dl">
                <div className="dl__row">
                  <dt>Affects</dt>
                  <dd>{setting.affects}</dd>
                </div>
                <div className="dl__row">
                  <dt>Does not affect</dt>
                  <dd>{setting.does_not_affect}</dd>
                </div>
                {setting.value_type === "integer" ? (
                  <div className="dl__row">
                    <dt>Allowed</dt>
                    <dd>
                      {setting.min_value} to {setting.max_value}
                      {setting.unit_label ? ` ${setting.unit_label}` : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
          <p>
            <TextLink href="/admin/configuration">All configuration</TextLink>
          </p>
        </aside>
      </div>
    </div>
  );
}
