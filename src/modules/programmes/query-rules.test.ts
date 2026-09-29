import { describe, expect, it } from "vitest";
import { dueText, eventText, parseQueryShow, type QueryEvent } from "./query-rules";

const event = (overrides: Partial<QueryEvent>): QueryEvent => ({
  event: "logged",
  actor_name: "Ayesha Patel",
  owner_name: null,
  note: null,
  at: "2026-10-26T08:00:00Z",
  ...overrides,
});

describe("eventText", () => {
  it("says who did each step", () => {
    expect(eventText(event({}))).toBe("Logged by Ayesha Patel");
    expect(eventText(event({ event: "routed", owner_name: "Zanele Khumalo" }))).toBe(
      "Routed to Zanele Khumalo by Ayesha Patel",
    );
    expect(eventText(event({ event: "closed", actor_name: "Zanele Khumalo" }))).toBe("Closed by Zanele Khumalo");
    expect(eventText(event({ event: "reopened" }))).toBe("Reopened by Ayesha Patel");
  });
});

describe("dueText", () => {
  it("says when it is due, and that it is overdue once the day has passed", () => {
    expect(dueText("2026-10-30", "open", "2026-10-26")).toEqual({ text: "Due 30 Oct 2026", late: false });
    expect(dueText("2026-10-20", "in_progress", "2026-10-26")).toEqual({
      text: "Overdue: due 20 Oct 2026",
      late: true,
    });
  });

  it("never calls a closed query overdue, and says nothing without a due date", () => {
    expect(dueText("2026-10-20", "closed", "2026-10-26")).toEqual({ text: "Due 20 Oct 2026", late: false });
    expect(dueText(null, "open", "2026-10-26")).toBeNull();
  });
});

describe("parseQueryShow", () => {
  it("shows open queries unless asked for another list", () => {
    expect(parseQueryShow(undefined)).toBe("open");
    expect(parseQueryShow("mine")).toBe("mine");
    expect(parseQueryShow("everything")).toBe("open");
  });
});
