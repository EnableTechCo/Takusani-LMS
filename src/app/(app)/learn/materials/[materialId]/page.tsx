import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClass, iconClass } from "@/components/ui/button-class";
import { Icon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { formatLongDayOf } from "@/lib/dates";
import { AccessLogger } from "@/modules/learning/materials-forms";
import { describeContent } from "@/modules/learning/materials-rules";
import { getMyMaterial } from "@/modules/learning/materials-queries";

export const metadata = { title: "Material" };

// L-05 (FR-301): one released material, to download or open. Opening it is logged once the page has loaded.
export default async function LearnMaterialPage({ params }: { params: Promise<{ materialId: string }> }) {
  const material = await getMyMaterial((await params).materialId);
  if (!material) notFound();
  const host = material.link_url ? new URL(material.link_url).host : null;

  return (
    <div className="page page--prose">
      <AccessLogger materialId={material.id} />
      <PageHeader
        lead={material.module_title ?? undefined}
        meta={
          <>
            {material.category === "recording" ? <Tag tone="info">Recording</Tag> : null}
            <span>Released {formatLongDayOf(material.release_at)}</span>
          </>
        }
        title={material.title}
        workspace="Learning"
      />
      <div className="stack stack--lg">
        {material.category === "recording" && !material.has_captions ? (
          <Banner role="note" title="This recording has no captions or transcript" tone="info">
            <p>If you need them, ask your facilitator.</p>
          </Banner>
        ) : null}
        {material.description ? (
          <div className="prose">
            {material.description
              .split(/\n\s*\n/)
              .filter((paragraph) => paragraph.trim())
              .map((paragraph, index) => (
                <p className="whitespace-pre-line" key={index}>
                  {paragraph.trim()}
                </p>
              ))}
          </div>
        ) : null}

        {material.kind === "file" ? (
          material.downloadUrl ? (
            <p>
              {/* A plain anchor: the signed link downloads the file directly from storage. */}
              <a className={buttonClass({ variant: "primary" })} download href={material.downloadUrl}>
                <Icon className={iconClass()} name="download" />
                Download {material.file_name}
              </a>
              <span className="text-small text-muted"> {describeContent(material)}</span>
            </p>
          ) : (
            <Banner title="The file could not be prepared" tone="caution">
              <p>Reload the page to try again.</p>
            </Banner>
          )
        ) : material.link_url ? (
          <p>
            <a
              className={buttonClass({ variant: "primary" })}
              href={material.link_url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon className={iconClass()} name="external" />
              {material.category === "recording" ? "Open the recording" : "Open the link"}
              <span className="u-visually-hidden"> (opens {host} in a new tab)</span>
            </a>
            <span className="text-small text-muted"> {host}</span>
          </p>
        ) : null}

        <p>
          <TextLink href="/learn/materials">All materials</TextLink>
        </p>
      </div>
    </div>
  );
}
