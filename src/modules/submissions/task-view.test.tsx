// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/components/ui/test-dom";
import { DueLine } from "./task-view";

const now = new Date("2026-09-23T10:00:00+02:00");

describe("DueLine", () => {
  it("says today for work due later today (it used to say tomorrow)", () => {
    render(<DueLine dueAt="2026-09-23T17:00:00+02:00" latePolicy="accept_and_flag" now={now} />);
    expect(screen.getByText("today")).toBeInTheDocument();
  });

  it("says tomorrow for work due tomorrow, and counts days after that", () => {
    const { rerender } = render(<DueLine dueAt="2026-09-24T09:00:00+02:00" latePolicy="accept_and_flag" now={now} />);
    expect(screen.getByText("tomorrow")).toBeInTheDocument();
    rerender(<DueLine dueAt="2026-10-02T17:00:00+02:00" latePolicy="accept_and_flag" now={now} />);
    expect(screen.getByText("in 9 days")).toBeInTheDocument();
  });

  it("after the due time, says late work is still taken, or that the task is closed", () => {
    const { rerender, container } = render(
      <DueLine dueAt="2026-09-23T09:00:00+02:00" latePolicy="accept_and_flag" now={now} />,
    );
    expect(container).toHaveTextContent("You can still hand work in. It will be marked as late.");
    rerender(<DueLine dueAt="2026-09-23T09:00:00+02:00" latePolicy="closed_at_due" now={now} />);
    expect(container).toHaveTextContent("It is closed, so nothing more can be handed in.");
  });
});
