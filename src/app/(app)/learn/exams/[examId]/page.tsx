import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Exam: before you start" };

// L-11 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnExamsExamIdPage() {
  return (
    <Screen
      id="L-11"
      frs="FR-312, FR-901"
      workspace="Learning"
      title="Exam: before you start"
      lead="Check this device, read what exam mode does, then start."
      actions={["Start exam"]}
      width="prose"
    >
      <Block
        label="Exam summary"
        detail="Title and unit; window and duration in one sentence; shortened-time notice when the window closes early; attempts used of allowed."
        size="sm"
      />
      <Block
        heading="Check this device"
        label="Device checks"
        detail="Browser, screen size and connection. Phones and tablets cannot start an exam (NFR-10)."
      />
      <Block heading="What happens in exam mode" label="What is switched off (FR-901)" />
      <Block
        heading="What is recorded"
        label="Recorded events"
        detail="Leaving the window, switching tab, leaving fullscreen. Not your camera, microphone or screen."
        example={{ label: "Example exam screen", href: "/exam/example" }}
      />
      <Form fields={[{ label: "I have read how exam mode works", type: "checkbox" }]} />
    </Screen>
  );
}
