import { PageHeader } from "@/components/shell/page-header";
import { buttonClass, iconClass } from "@/components/ui/button-class";
import { Icon } from "@/components/ui/icons";
import { UploadIntakeForm } from "@/modules/identity/import-forms";
import { listImportCohorts } from "@/modules/identity/import-queries";

export const metadata = { title: "New import · Administration" };

// X-05 new import (FR-103; flow G, steps 1 and 2): the template, the rules, the cohort and the file.
export default async function NewImportPage() {
  const cohorts = await listImportCohorts();
  return (
    <div className="page page--form">
      <PageHeader
        lead="Every row is checked first. Nothing is created until you choose to import the ready rows."
        title="New import"
        workspace="Administration"
      />
      <div className="stack stack--lg">
        <section aria-labelledby="rules-h" className="stack">
          <h2 className="text-subheading" id="rules-h">
            What the file needs
          </h2>
          <ul className="prose">
            <li>One row per learner, under a first row that names the columns.</li>
            <li>
              <span className="mono">full_name</span> and <span className="mono">email</span> are required;{" "}
              <span className="mono">learner_number</span> is optional.
            </li>
            <li>Each email and learner number appears once. The cohort must already exist.</li>
            <li>
              A learner whose email already has an account is skipped, so loading a file twice creates nobody twice.
            </li>
          </ul>
          <p>
            {/* A plain anchor: a file download, not a page for the router to navigate to. */}
            <a className={buttonClass({ variant: "secondary" })} download href="/admin/imports/template.csv">
              <Icon className={iconClass()} name="download" />
              Download the CSV template
            </a>
          </p>
        </section>
        <div className="card">
          <div className="card__body">
            <UploadIntakeForm
              cohorts={cohorts.map((cohort) => ({
                id: cohort.id,
                label: `${cohort.name}, ${cohort.programme_title} (${cohort.enrolled} enrolled)`,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
