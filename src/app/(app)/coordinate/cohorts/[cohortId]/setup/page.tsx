import { CohortNav } from "@/components/skeleton/cohort-nav";
import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Cohort setup · Coordinating" };

// C-03 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateCohortsCohortIdSetupPage() {
  return (
    <Screen
      id="C-03"
      frs="FR-701, FR-104, BR-04"
      workspace="Coordinating"
      title="Cohort setup"
      actions={["Save"]}
      nav={<CohortNav cohortId="example" current="Setup" />}
      aside={
        <>
          <Block heading="Policy history" label="Policy version history" />
          <Block heading="People" label="Enrolment and role summary" size="sm" />
        </>
      }
      asideLabel="History and people"
    >
      <Form
        heading="Dates"
        prefix="dates"
        fields={[
          { label: "Starts", type: "date" },
          { label: "Ends", type: "date" },
        ]}
      />
      <Form
        heading="Moderation"
        prefix="policy"
        fields={[
          {
            label: "Moderation policy",
            type: "radio",
            help: "Required. Moderated cohorts hold results until a moderation cycle is signed off (BR-04).",
            options: ["Moderated", "Not moderated"],
          },
        ]}
      />
    </Screen>
  );
}
