// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/components/ui/test-dom";
import { HeldResultView, ReleasedResultView, type ReleasedResult } from "./result-view";

// Released on Tuesday 22 September 2026 at 14:05: the appeal window closes at the start of Wednesday 30 September.
const nyc: ReleasedResult = {
  resultId: "30000000-0000-4000-8000-000000000001",
  taskId: "10000000-0000-4000-8000-000000000020",
  itemTitle: "Task 3: Workplace records portfolio",
  taskClosed: false,
  outcome: "not_yet_competent",
  releasedAt: "2026-09-22T14:05:00+02:00",
  appealDeadlineAt: "2026-09-30T00:00:00+02:00",
  remediation: "Upload the access register.\n\nAdd one paragraph on who approves a request.",
  remediationDeadlineAt: "2026-10-06T14:05:00+02:00",
  feedback: "Your filing index is clear.",
  assessorName: "Nomsa Dlamini",
  marks: [
    { ordinal: 1, title: "Records are complete", max_points: 10, points: 9, comment: "Every record is there." },
    { ordinal: 2, title: "Retention rules applied", max_points: 5, points: 2, comment: null },
  ],
  assessedVersion: {
    version_number: 1,
    submitted_at: "2026-09-04T17:42:00+02:00",
    is_late: true,
    receipt_reference: "SUB-20260904-7K2M",
  },
  latestVersion: {
    version_number: 1,
    submitted_at: "2026-09-04T17:42:00+02:00",
    is_late: true,
    receipt_reference: "SUB-20260904-7K2M",
  },
  firstViewedAt: "2026-09-22T18:31:00+02:00",
};

const dayAfterRelease = new Date("2026-09-23T10:00:00+02:00");

describe("ReleasedResultView", () => {
  it("puts the outcome, appeal closing day and next step in the first screenful (FR-316, FR-317, SRS 5.3)", () => {
    const { container } = render(<ReleasedResultView now={dayAfterRelease} result={nyc} />);
    expect(screen.getAllByText("Not yet competent").length).toBeGreaterThan(0);
    expect(container).toHaveTextContent(
      "You can appeal this result until the end of Tuesday 29 September 2026. 6 days left, including weekends and public holidays. To appeal, contact your coordinator.",
    );
    expect(container).toHaveTextContent("You can resubmit until Tuesday 6 October 2026 at 14:05 (SAST).");
    expect(screen.getByText("Upload the access register.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start your resubmission" })).toHaveAttribute(
      "href",
      `/learn/tasks/${nyc.taskId}/submit`,
    );
  });

  it("offers the appeal as a full-size button, not a small link (A11Y-20)", () => {
    render(<ReleasedResultView now={dayAfterRelease} result={nyc} />);
    const appeal = screen.getByRole("link", { name: "Appeal this result" });
    expect(appeal).toHaveClass("btn");
    expect(appeal).toHaveAttribute("href", `/learn/results/${nyc.resultId}/appeal/new`);
  });

  it("shows marks per criterion with the total and the outcome in words", () => {
    const { container } = render(<ReleasedResultView now={dayAfterRelease} result={nyc} />);
    expect(screen.getAllByText("9 of 10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No comment").length).toBeGreaterThan(0);
    expect(container).toHaveTextContent("Total: 11 of 15. Outcome: Not yet competent.");
    expect(screen.getByRole("heading", { name: "Feedback from your assessor, Nomsa Dlamini" })).toBeInTheDocument();
  });

  it("says how the learner was told, and when they first opened it (NFR-11)", () => {
    const { container } = render(<ReleasedResultView now={dayAfterRelease} result={nyc} />);
    expect(container).toHaveTextContent("Released in the LMS");
    expect(container).toHaveTextContent("First opened by you");
    expect(container).toHaveTextContent("Released on Tuesday 22 September 2026 at 14:05 (SAST).");
  });

  it("says when it is the last day to appeal", () => {
    const { container } = render(<ReleasedResultView now={new Date("2026-09-29T09:00:00+02:00")} result={nyc} />);
    expect(container).toHaveTextContent("Today is the last day to appeal.");
    expect(container.querySelector(".deadline-line--soon")).not.toBeNull();
  });

  it("once the window has closed, says so and offers no appeal (FR-603)", () => {
    const { container } = render(<ReleasedResultView now={new Date("2026-09-30T00:00:00+02:00")} result={nyc} />);
    expect(container).toHaveTextContent(
      "The time to appeal closed at the end of Tuesday 29 September 2026. You had 7 days from the day your result was released, Tuesday 22 September 2026.",
    );
    expect(screen.queryByRole("link", { name: "Appeal this result" })).toBeNull();
  });

  it("does not offer a resubmission the task would refuse", () => {
    const { container } = render(<ReleasedResultView now={dayAfterRelease} result={{ ...nyc, taskClosed: true }} />);
    expect(screen.queryByRole("link", { name: "Start your resubmission" })).toBeNull();
    expect(container).toHaveTextContent("ask your coordinator how to hand in your work");
  });

  it("says a later version is being assessed instead of offering another resubmission", () => {
    const { container } = render(
      <ReleasedResultView
        now={dayAfterRelease}
        result={{ ...nyc, latestVersion: { ...nyc.latestVersion, version_number: 2 } }}
      />,
    );
    expect(container).toHaveTextContent("You handed in version 2");
    expect(screen.queryByRole("link", { name: "Start your resubmission" })).toBeNull();
  });

  it("gives a Competent result no next-step banner", () => {
    render(
      <ReleasedResultView
        now={dayAfterRelease}
        result={{ ...nyc, outcome: "competent", remediation: null, remediationDeadlineAt: null }}
      />,
    );
    expect(screen.getAllByText("Competent").length).toBeGreaterThan(0);
    expect(screen.queryByText("Here is what to do next")).toBeNull();
  });
});

describe("HeldResultView", () => {
  it("shows only that the work is being assessed: no outcome, no marks, no deadline (BR-04)", () => {
    const { container } = render(
      <HeldResultView
        itemTitle={nyc.itemTitle}
        latestVersion={{ ...nyc.latestVersion, files: 3, bytes: 18_140_000 }}
        moderated
        taskId={nyc.taskId}
      />,
    );
    expect(screen.getByText("Being assessed")).toBeInTheDocument();
    expect(container).toHaveTextContent("checked by a second person (a moderator)");
    expect(container).not.toHaveTextContent("Not yet competent");
    expect(container).not.toHaveTextContent(/until the end of/);
    expect(screen.queryByRole("link", { name: "Appeal this result" })).toBeNull();
  });
});
