import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { formatDayOf } from "@/lib/dates";
import { NoteForm } from "@/modules/learning/notes-forms";
import { listMyNoteFolders, listNoteLinkTargets } from "@/modules/learning/notes-queries";
import { linkValue, parseLink } from "@/modules/learning/notes-rules";

export const metadata = { title: "New note" };

// L-09 (FR-306): a new note, optionally already about a material or session (from its page: ?about=material:<id>).
export default async function NewNotePage({ searchParams }: { searchParams: Promise<{ about?: string }> }) {
  const { about } = await searchParams;
  const [targets, folders] = await Promise.all([listNoteLinkTargets(), listMyNoteFolders()]);
  const options = targets.map((target) => ({
    value: `${target.kind}:${target.id}`,
    label: `${target.kind === "material" ? "Material" : "Session"}: ${target.title}${target.at ? ` (${formatDayOf(target.at)})` : ""}`,
  }));
  const asked = linkValue(parseLink(about ?? ""));

  return (
    <div className="page page--form">
      <PageHeader lead="Only you can see this note." title="New note" workspace="Learning" />
      <div className="stack stack--lg">
        <NoteForm
          defaultLink={options.some((option) => option.value === asked) ? asked : ""}
          folders={folders.map((entry) => entry.folder)}
          targets={options}
        />
        <p>
          <TextLink href="/learn/notes">All notes</TextLink>
        </p>
      </div>
    </div>
  );
}
