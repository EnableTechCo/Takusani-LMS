// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/components/ui/test-dom";
import { NotificationList, type NotificationRow } from "./centre";

const now = new Date("2026-09-23T10:00:00+02:00");

const result: NotificationRow = {
  id: "11111111-1111-4111-8111-111111111111",
  event_type: "result_released",
  template_version: 1,
  payload: {
    item_title: "Task 3",
    cohort_name: "2026 Intake B",
    released_at: "2026-09-22T12:05:00Z",
    appeal_deadline_at: "2026-09-29T22:00:00Z",
  },
  created_at: "2026-09-22T12:05:00Z",
  read_at: null,
  email: null,
  first_opened_at: null,
};

const task: NotificationRow = {
  id: "22222222-2222-4222-8222-222222222222",
  event_type: "task_published",
  template_version: 1,
  payload: { title: "Task 4", cohort_name: "2026 Intake B", due_at: "2026-10-02T15:00:00Z" },
  created_at: "2026-09-23T06:00:00Z",
  read_at: "2026-09-23T07:00:00Z",
  email: {
    state: "accepted",
    address: "learner@takusani.test",
    created_at: "2026-09-23T06:00:00Z",
    accepted_at: "2026-09-23T06:01:00Z",
    delivered_at: null,
    failed_at: null,
  },
  first_opened_at: null,
};

describe("NotificationList", () => {
  it("links each row through the open route and marks unread rows in words, not colour alone", () => {
    render(<NotificationList now={now} rows={[task, result]} />);
    const link = screen.getByRole("link", { name: "Your result for Task 3 is ready" });
    expect(link).toHaveAttribute("href", `/notifications/${result.id}`);
    expect(link.closest("li")).toHaveClass("is-unread");
    expect(within(link.closest("li")!).getByText("Unread:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New task: Task 4" }).closest("li")).not.toHaveClass("is-unread");
  });

  it("groups by day under headings", () => {
    render(<NotificationList now={now} rows={[task, result]} />);
    expect(screen.getByRole("heading", { name: "Today, Wednesday 23 September 2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Yesterday, Tuesday 22 September 2026" })).toBeInTheDocument();
  });

  it("gives each 'How you were told' a distinct name (A11Y-18)", () => {
    const { container } = render(<NotificationList now={now} rows={[task, result]} />);
    const names = [...container.querySelectorAll("summary")].map((summary) => summary.textContent);
    expect(names).toEqual([
      "How you were told about: New task: Task 4",
      "How you were told about: Your result for Task 3 is ready",
    ]);
  });

  it("shows the evidence: in the LMS, the email when one was sent, and whether a result was opened (NFR-11)", () => {
    const { container } = render(<NotificationList now={now} rows={[task, result]} />);
    const [taskEvidence, resultEvidence] = [...container.querySelectorAll("details")];
    expect(taskEvidence).toHaveTextContent("In the LMS");
    expect(taskEvidence).toHaveTextContent("Email to learner@takusani.test: sent");
    expect(taskEvidence).not.toHaveTextContent("opened");
    expect(resultEvidence).toHaveTextContent("In the LMS");
    expect(resultEvidence).not.toHaveTextContent("Email");
    expect(resultEvidence).toHaveTextContent("Not opened by you yet");
  });
});
