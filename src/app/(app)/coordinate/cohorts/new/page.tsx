import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "New cohort · Coordinating" };

// C-03 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateCohortsNewPage() {
  return (
    <Screen
      id="C-03"
      frs="FR-701, BR-04"
      workspace="Coordinating"
      title="New cohort"
      actions={["Create cohort"]}
      width="form"
    >
      <Form
        heading="Programme and dates"
        prefix="dates"
        fields={[
          { label: "Programme", type: "select" },
          { label: "Cohort name" },
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
      <Block
        label="What each policy means"
        detail="Consequences for learners and for when results are released"
        size="sm"
      />
    </Screen>
  );
}
