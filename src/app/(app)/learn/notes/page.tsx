import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { Banner, EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { listMyNoteFolders, listMyNotes } from "@/modules/learning/notes-queries";
import { linkLabel } from "@/modules/learning/notes-rules";

export const metadata = { title: "Notes" };

// L-09 (FR-306, FR-307): the learner's private notes, newest first, by folder, searchable. Nobody else can see them:
// not facilitators, assessors, moderators, administrators, reports or the Department.
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; folder?: string; deleted?: string }>;
}) {
  const { q, folder, deleted } = await searchParams;
  const query = q?.trim() ?? "";
  const [notes, folders] = await Promise.all([listMyNotes(query, folder), listMyNoteFolders()]);
  const filtered = Boolean(query || folder);

  return (
    <div className="page">
      <PageHeader
        actions={
          <ButtonLink href="/learn/notes/new" icon="plus" variant="primary">
            New note
          </ButtonLink>
        }
        lead="Only you can see your notes. Nobody else can: not your facilitators, assessors or administrators."
        title="Notes"
        workspace="Learning"
      />
      <div className="stack stack--lg">
        {deleted ? <Banner compact role="status" title="Note deleted" tone="positive" /> : null}

        <form action="/learn/notes" className="cluster" method="get" role="search">
          <label className="input-icon">
            <span className="u-visually-hidden">Search your notes</span>
            <Icon name="search" />
            <input className="input" defaultValue={query} name="q" placeholder="Search your notes" type="search" />
          </label>
          {folder ? <input name="folder" type="hidden" value={folder} /> : null}
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {filtered ? <TextLink href="/learn/notes">Show all</TextLink> : null}
        </form>

        {folders.length > 0 ? (
          <form action="/learn/notes" aria-label="Folders" className="table-toolbar" method="get" role="group">
            {query ? <input name="q" type="hidden" value={query} /> : null}
            <button aria-pressed={!folder} className="filter-chip" type="submit">
              All folders
            </button>
            {folders.map((entry) => (
              <button
                aria-pressed={entry.folder === folder}
                className="filter-chip"
                key={entry.folder}
                name="folder"
                type="submit"
                value={entry.folder}
              >
                {entry.folder} <span className="text-muted">{entry.notes}</span>
              </button>
            ))}
          </form>
        ) : null}

        {notes.length === 0 ? (
          <div className="card">
            <EmptyState icon="note" title={filtered ? "No notes match" : "No notes yet"}>
              <p>
                {filtered
                  ? "Try fewer or different words, or another folder."
                  : "Write notes for yourself, about a material, a session or anything else. Only you can see them."}
              </p>
            </EmptyState>
          </div>
        ) : (
          <DataTable
            caption="Your notes, most recently edited first. Times in SAST."
            columns={[
              {
                key: "title",
                header: "Note",
                primary: true,
                cell: (note) => (
                  <>
                    <TextLink href={`/learn/notes/${note.id}`}>{note.title}</TextLink>
                    {note.excerpt ? <span className="table__secondary">{note.excerpt}</span> : null}
                  </>
                ),
              },
              { key: "folder", header: "Folder", cell: (note) => (note.folder ? <Tag>{note.folder}</Tag> : "None") },
              {
                key: "about",
                header: "About",
                cell: (note) => linkLabel(note.link_kind, note.link_title) ?? "Nothing in particular",
              },
              { key: "edited", header: "Last edited", cell: (note) => formatDateTime(note.updated_at) },
            ]}
            rowKey={(note) => note.id}
            rows={notes}
          />
        )}
      </div>
    </div>
  );
}
