// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/components/ui/test-dom";
import { Agenda, agendaItems } from "./agenda";

const now = new Date("2026-09-28T10:00:00+02:00");
const teams = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0";

const sessions = [
  {
    id: "s1",
    title: "Session 15: Office administration",
    starts_at: "2026-09-29T09:00:00+02:00",
    duration_minutes: 120,
    mode: "online",
    teams_url: teams,
    venue: null,
    state: "scheduled",
    cancel_reason: null,
    facilitator_name: "Pieter van Wyk",
  },
  {
    id: "s2",
    title: "Contact day",
    starts_at: "2026-10-01T09:00:00+02:00",
    duration_minutes: 360,
    mode: "in_person",
    teams_url: null,
    venue: "Training Room 2",
    state: "cancelled",
    cancel_reason: "The venue is closed for repairs.",
    facilitator_name: "Pieter van Wyk",
  },
];

const tasks = [
  { id: "t4", title: "Task 4", due_at: "2026-09-29T17:00:00+02:00", latest_version: null },
  { id: "t3", title: "Task 3", due_at: "2026-09-20T17:00:00+02:00", latest_version: 1 },
];

describe("Agenda (L-07, FR-305)", () => {
  it("groups sessions and due dates by day, naming tomorrow, and leaves out past due dates", () => {
    render(<Agenda items={agendaItems(sessions, tasks, now)} label="Coming up" now={now} />);
    expect(screen.getByRole("heading", { name: "Tomorrow, Tuesday 29 September 2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Thursday 1 October 2026" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Task 4" })).toHaveAttribute("href", "/learn/tasks/t4");
    expect(screen.queryByRole("link", { name: "Task 3" })).toBeNull();
  });

  it("gives the Teams link on the calendar, and says when it opens", () => {
    const { container } = render(<Agenda items={agendaItems(sessions, [], now)} label="Coming up" now={now} />);
    expect(screen.getByRole("link", { name: /^Join in Teams/ })).toHaveAttribute("href", teams);
    expect(container).toHaveTextContent("You can join from 08:50.");
  });

  it("keeps a cancelled session, marked, with the reason and no way to join", () => {
    const { container } = render(<Agenda items={agendaItems([sessions[1]], [], now)} label="Coming up" now={now} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(container).toHaveTextContent("The venue is closed for repairs.");
    expect(screen.queryByRole("link", { name: /Join in Teams/ })).toBeNull();
  });
});
