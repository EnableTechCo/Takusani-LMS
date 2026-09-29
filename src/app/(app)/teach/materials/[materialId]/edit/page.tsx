import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime } from "@/lib/dates";
import { archiveMaterial } from "@/modules/learning/materials-actions";
import { getPublicSettings } from "@/modules/audit/settings";
import { MaterialDetailsForm, MaterialFileUpload, PublishForm } from "@/modules/learning/materials-forms";
import { describeContent, materialState } from "@/modules/learning/materials-rules";
import { getMaterial, listCohortModules } from "@/modules/learning/materials-queries";

export const metadata = { title: "Edit material · Teaching" };

// F-04 (FR-204, FR-208): one material or recording. Its details and module, its content (a file or a link), and when
// learners see it. A recording is best added as a link; an upload goes to the recordings bucket, within its own limit.
export default async function EditMaterialPage({ params }: { params: Promise<{ materialId: string }> }) {
  const { materialId } = await params;
  const [material, settings] = await Promise.all([getMaterial(materialId), getPublicSettings()]);
  if (!material) notFound();
  const modules = await listCohortModules(material.cohort_id);
  const label = materialState(material.state, material.release_at, new Date());
  const archived = label === "Archived";
  const recording = material.category === "recording";
  const content = describeContent({
    kind: material.kind,
    link_host: material.link_url ? new URL(material.link_url).host : null,
    file_media_type: material.file_media_type,
    file_bytes: material.file_bytes,
  });

  return (
    <div className="page">
      <PageHeader
        lead={material.cohort_name}
        meta={
          <>
            {recording ? <Tag tone="info">Recording</Tag> : null}
            <Tag
              shape={label === "Scheduled" ? "half" : undefined}
              tone={label === "Published" ? "positive" : label === "Scheduled" ? "info" : "neutral"}
            >
              {label}
            </Tag>
            {material.release_at ? <span>Release {formatDateTime(material.release_at)} (SAST)</span> : null}
            <span>
              Opened by {material.opened_by} {material.opened_by === 1 ? "learner" : "learners"}
            </span>
          </>
        }
        title={material.title}
        workspace="Teaching"
      />

      <div className="stack stack--lg">
        {archived ? (
          <Banner role="note" title="This material is archived" tone="readonly">
            <p>Learners no longer see it. It stays on record and cannot be changed.</p>
          </Banner>
        ) : null}

        <section aria-labelledby="content-h" className="card">
          <div className="card__header">
            <h2 className="card__title" id="content-h">
              Content
            </h2>
            <span className="text-small text-muted">
              {material.kind === "file" && material.file_name ? `${material.file_name}: ${content}` : content}
            </span>
          </div>
          {archived ? null : (
            <div className="card__body">
              <MaterialFileUpload
                materialId={material.id}
                maxMb={recording ? settings.recordingMaxMb : settings.uploadMaxMb}
                recording={recording}
              />
            </div>
          )}
        </section>

        {archived ? null : (
          <section aria-labelledby="details-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="details-h">
                Details
              </h2>
            </div>
            <div className="card__body">
              <MaterialDetailsForm
                material={material}
                modules={modules.map((module) => ({ id: module.id, label: `${module.code}: ${module.title}` }))}
              />
            </div>
          </section>
        )}

        {archived || label === "Published" ? null : (
          <section aria-labelledby="publish-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="publish-h">
                {label === "Scheduled" ? "Scheduled" : "Publish"}
              </h2>
            </div>
            <div className="card__body stack">
              {material.kind === null ? (
                <p className="text-muted">
                  {recording
                    ? "Add a link to the recording, or upload it, first."
                    : "Add a file or a link first. A material with nothing in it cannot be published."}
                </p>
              ) : (
                <PublishForm materialId={material.id} scheduled={label === "Scheduled"} />
              )}
            </div>
          </section>
        )}

        <div className="cluster cluster--between">
          <TextLink href="/teach/materials">All materials</TextLink>
          {archived ? null : (
            <form action={archiveMaterial.bind(null, material.id)}>
              <Button type="submit" variant="ghost">
                Archive this material
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
