import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Home" };

// L-01 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnPage() {
  return (
    <Screen
      id="L-01"
      frs="FR-304, FR-305, FR-316, FR-317, FR-318"
      workspace="Learning"
      title="Home"
      lead="What needs you now."
      aside={
        <>
          <Block
            heading="Coming up"
            label="Sessions, deadlines and exam windows"
            detail="Today's sessions with Join; the next exam window."
            size="lg"
          />
          <Block
            heading="Credits"
            label="Credit progress"
            detail="Credits earned of required, linking to your credits record."
            size="sm"
          />
        </>
      }
      asideLabel="Coming up and credits"
    >
      <Block
        heading="New result"
        label="Result card"
        detail="Outcome, released date, appeal closing day and what to do next. Shown while an appeal window or resubmission period is open."
        example={{ label: "Example result", href: "/learn/results/example" }}
      />
      <Block
        heading="Your tasks"
        label="Due and overdue tasks"
        detail="Title, due date and status; overdue first."
        size="lg"
        example={{ label: "Example task", href: "/learn/tasks/example" }}
      />
    </Screen>
  );
}
