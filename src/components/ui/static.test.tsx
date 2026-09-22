// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "./test-dom";
import { Stepper } from "./process";
import { Log } from "./records";
import { Banner, Meter, Tag } from "./status";
import { DataTable, Pagination, visiblePages } from "./table";

describe("Tag", () => {
  it("combines tone, shape and size", () => {
    render(
      <Tag large shape="half" tone="info">
        Being assessed
      </Tag>,
    );
    expect(screen.getByText("Being assessed")).toHaveClass("tag", "tag--info", "tag--shape-half", "tag--lg");
  });
});

describe("Banner", () => {
  it("is announced at once for a fault and politely otherwise", () => {
    render(
      <>
        <Banner title="The LMS is having trouble" tone="critical" />
        <Banner title="We have your work" tone="info" />
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The LMS is having trouble");
    expect(screen.getByRole("status")).toHaveTextContent("We have your work");
  });
});

describe("Stepper", () => {
  it("says each step's state in words and marks the current step", () => {
    render(
      <Stepper
        label="Appeal progress"
        steps={[
          { label: "Received", state: "complete" },
          { label: "Being reviewed", state: "current" },
          { label: "Decided", state: "upcoming" },
        ]}
      />,
    );
    const steps = within(screen.getByRole("list", { name: "Appeal progress" })).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual([
      "Received (done)",
      "Being reviewed (current step)",
      "Decided (not yet)",
    ]);
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[0]).toHaveClass("is-complete");
  });
});

describe("Meter", () => {
  it("exposes the value and says it in words", () => {
    render(<Meter label="Held result age" max={30} value={12} valueText="12 of 30 days" />);
    const meter = screen.getByRole("meter", { name: "Held result age" });
    expect(meter).toHaveAttribute("aria-valuenow", "12");
    expect(meter).toHaveAttribute("aria-valuetext", "12 of 30 days");
    expect(screen.getByText("12 of 30 days")).toBeVisible();
  });
});

describe("Log", () => {
  it("shows each entry's time to the second in South African time", () => {
    render(
      <Log
        entries={[{ id: "1", at: "2026-09-02T07:00:02Z", actor: "Sipho Zulu", event: "started the attempt." }]}
        label="Exam record, oldest first. Times in SAST."
      />,
    );
    const time = screen.getByText("02 Sept 2026, 09:00:02");
    expect(time).toHaveAttribute("datetime", "2026-09-02T07:00:02Z");
  });
});

describe("DataTable", () => {
  const rows = [{ id: "a", name: "Lerato Mokoena", version: 2 }];
  const columns = [
    { key: "name", header: "Learner", primary: true, cell: (row: (typeof rows)[number]) => row.name },
    {
      key: "version",
      header: "Version",
      numeric: true,
      sort: { direction: "ascending" as const, href: "?sort=-version" },
      cell: (row: (typeof rows)[number]) => row.version,
    },
  ];

  it("names each row by its primary cell and marks the sorted column", () => {
    render(<DataTable caption="Queue" columns={columns} rowKey={(row) => row.id} rows={rows} />);
    const table = screen.getByRole("table", { name: "Queue" });
    expect(within(table).getByRole("rowheader", { name: "Lerato Mokoena" })).toBeInTheDocument();
    const sorted = within(table).getByRole("columnheader", { name: "Version" });
    expect(sorted).toHaveAttribute("aria-sort", "ascending");
    expect(within(sorted).getByRole("link")).toHaveAttribute("href", "?sort=-version");
  });

  it("also renders a real list of cards for phones, each cell a label and value", () => {
    render(<DataTable caption="Queue" columns={columns} rowKey={(row) => row.id} rows={rows} />);
    const list = screen.getByRole("list", { name: "Queue" });
    const card = within(list).getByRole("listitem");
    expect(within(card).getByText("Version").tagName).toBe("DT");
    expect(within(card).getByText("2").tagName).toBe("DD");
  });

  it("scrolls a two-dimensional table inside a focusable, labelled region instead of making cards", () => {
    render(<DataTable cards={false} caption="Audit entries" columns={columns} rowKey={(row) => row.id} rows={rows} />);
    expect(screen.getByRole("region", { name: "Audit entries" })).toHaveAttribute("tabindex", "0");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("shows the first, last and nearby pages with gaps between", () => {
    expect(visiblePages(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(visiblePages(1, 3)).toEqual([1, 2, 3]);
    expect(visiblePages(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("marks the current page and disables the end it is at", () => {
    render(<Pagination href={(page) => `?page=${page}`} label="Queue pages" page={1} pageCount={3} />);
    const nav = screen.getByRole("navigation", { name: "Queue pages" });
    expect(within(nav).getByRole("link", { name: "Page 1, current" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Previous page" })).toHaveAttribute("aria-disabled", "true");
    expect(within(nav).getByRole("link", { name: "Next page" })).toHaveAttribute("href", "?page=2");
  });
});
