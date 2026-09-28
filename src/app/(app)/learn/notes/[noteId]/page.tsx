import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime, formatDayOf } from "@/lib/dates";
import { DeleteNote, NoteForm } from "@/modules/learning/notes-forms";
import { getMyNote, listMyNoteFolders, listNoteLinkTargets } from "@/modules/learning/notes-queries";
import { isUuid } from "@/modules/submissions/rules";

export const metadata = { title: "Note" };

// L-09 (FR-306): one of the learner's notes, to read, edit or delete. Nobody else can open it (FR-307).
export default async function NotePage({
  params,
  searchParams,
}: {
  params: Promise<{ noteId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ noteId }, flash] = await Promise.all([params, searchParams]);
  if (!isUuid(noteId)) notFound();
  const [note, targets, folders] = await Promise.all([getMyNote(noteId), listNoteLinkTargets(), listMyNoteFolders()]);
  if (!note) notFound();

  const link = note.material_id ? `material:${note.material_id}` : note.session_id ? `session:${note.session_id}` : "";
  const options = targets.map((target) => ({
    value: `${target.kind}:${target.id}`,
    label: `${target.kind === "material" ? "Material" : "Session"}: ${target.title}${target.at ? ` (${formatDayOf(target.at)})` : ""}`,
  }));
  // A material withdrawn since stays selectable on this note, so saving does not drop the link.
  if (link && !options.some((option) => option.value === link)) {
    options.unshift({
      value: link,
      label: `${note.material_id ? "Material" : "Session"}: ${note.link_title} (no longer available)`,
    });
  }

  return (
    <div className="page page--form">
      <PageHeader
        lead="Only you can see this note."
        meta={
          <>
            {note.folder ? <Tag>{note.folder}</Tag> : null}
            <span>Last edited {formatDateTime(note.updated_at)} (SAST)</span>
          </>
        }
        title={note.title}
        workspace="Learning"
      />
      <div className="stack stack--lg">
        {flash.saved ? <Banner compact role="status" title="Note saved" tone="positive" /> : null}
        {note.material_id ? (
          <p className="text-small">
            About the material{" "}
            {note.link_available ? (
              <TextLink href={`/learn/materials/${note.material_id}`}>{note.link_title}</TextLink>
            ) : (
              <>
                &ldquo;{note.link_title}&rdquo; <span className="text-muted">(no longer available)</span>
              </>
            )}
            .
          </p>
        ) : note.session_id ? (
          <p className="text-small">
            About the session <TextLink href="/learn/calendar">{note.link_title}</TextLink>.
          </p>
        ) : null}
        <NoteForm
          folders={folders.map((entry) => entry.folder)}
          key={note.version}
          note={{
            id: note.id,
            version: note.version,
            title: note.title,
            body: note.body,
            folder: note.folder,
            link,
          }}
          targets={options}
        />
        <div className="cluster cluster--between">
          <TextLink href="/learn/notes">All notes</TextLink>
          <DeleteNote noteId={note.id} title={note.title} />
        </div>
      </div>
    </div>
  );
}
