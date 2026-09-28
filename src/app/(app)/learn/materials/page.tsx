import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDayOf } from "@/lib/dates";
import { describeContent } from "@/modules/learning/materials-rules";
import { listMyMaterials } from "@/modules/learning/materials-queries";
import { listMyQuizzes } from "@/modules/learning/quiz-queries";
import { attemptsText, scoreText } from "@/modules/learning/quiz-rules";

export const metadata = { title: "Materials" };

type Material = Awaited<ReturnType<typeof listMyMaterials>>[number];

/** Released material grouped by module, in module order; material without a module last. */
function byModule(materials: Material[]) {
  const groups = new Map<string, { heading: string; items: Material[] }>();
  for (const material of materials) {
    const key = material.module_code ?? "";
    const heading = material.module_code ? `${material.module_code}: ${material.module_title}` : "Other material";
    if (!groups.has(key)) groups.set(key, { heading, items: [] });
    groups.get(key)!.items.push(material);
  }
  return [...groups.values()];
}

// L-04 (FR-301): the material released to the learner, by module, with a search over titles and descriptions.
export default async function LearnMaterialsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = ((await searchParams).q ?? "").trim().slice(0, 100);
  const [materials, quizzes] = await Promise.all([
    listMyMaterials(query),
    query ? Promise.resolve([]) : listMyQuizzes(),
  ]);
  const groups = byModule(materials);

  return (
    <div className="page">
      <PageHeader
        lead="Files, links and lecture recordings for your programme, by module."
        title="Materials"
        workspace="Learning"
      />
      <div className="stack stack--lg">
        <form action="/learn/materials" className="cluster" method="get" role="search">
          <label className="input-icon">
            <span className="u-visually-hidden">Search materials</span>
            <Icon name="search" />
            <input className="input" defaultValue={query} name="q" placeholder="Search materials" type="search" />
          </label>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {query ? <TextLink href="/learn/materials">Show all</TextLink> : null}
        </form>

        {query ? (
          <p aria-live="polite" className="text-small text-muted">
            {materials.length === 1 ? "1 material matches" : `${materials.length} materials match`} &ldquo;{query}
            &rdquo;.
          </p>
        ) : null}

        {quizzes.length > 0 ? (
          <section aria-labelledby="quizzes-h" className="stack">
            <h2 className="text-heading" id="quizzes-h">
              Practice quizzes
            </h2>
            <p className="text-small text-muted">Instant scores and feedback. They never count towards your result.</p>
            <DataTable
              caption="Practice quizzes for your cohort."
              columns={[
                {
                  key: "quiz",
                  header: "Quiz",
                  primary: true,
                  cell: (quiz) => (
                    <>
                      <TextLink href={`/learn/quizzes/${quiz.id}`}>{quiz.title}</TextLink>
                      {quiz.module_title ? <span className="table__secondary">{quiz.module_title}</span> : null}
                    </>
                  ),
                },
                {
                  key: "attempts",
                  header: "Attempts",
                  cell: (quiz) => attemptsText(quiz.attempts_used, quiz.attempt_limit),
                },
                {
                  key: "best",
                  header: "Best score",
                  cell: (quiz) =>
                    quiz.best_score !== null && quiz.best_max !== null
                      ? scoreText(quiz.best_score, quiz.best_max)
                      : "Not tried yet",
                },
              ]}
              rowKey={(quiz) => quiz.id}
              rows={quizzes}
            />
          </section>
        ) : null}

        {materials.length === 0 ? (
          <div className="card">
            <EmptyState icon="book" title={query ? "Nothing matches" : "No materials yet"}>
              <p>
                {query
                  ? "Try fewer or different words."
                  : "When your facilitators publish material for your cohort, it appears here."}
              </p>
            </EmptyState>
          </div>
        ) : (
          groups.map((group, index) => (
            <section aria-labelledby={`module-${index}`} className="stack" key={group.heading}>
              <h2 className="text-heading" id={`module-${index}`}>
                {group.heading}
              </h2>
              <DataTable
                caption={`${group.heading}: material, newest first.`}
                columns={[
                  {
                    key: "title",
                    header: "Material",
                    primary: true,
                    cell: (material) => (
                      <>
                        <TextLink href={`/learn/materials/${material.id}`}>{material.title}</TextLink>
                        {material.category === "recording" ? (
                          <span className="table__secondary">
                            <Tag tone="info">Recording</Tag>{" "}
                            {material.has_captions ? "Captions or transcript available" : "No captions or transcript"}
                          </span>
                        ) : null}
                      </>
                    ),
                  },
                  { key: "type", header: "Type", cell: (material) => describeContent(material) },
                  { key: "released", header: "Released", cell: (material) => formatDayOf(material.release_at) },
                ]}
                rowKey={(material) => material.id}
                rows={group.items}
              />
            </section>
          ))
        )}
      </div>
    </div>
  );
}
