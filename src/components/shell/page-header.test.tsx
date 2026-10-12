// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/components/ui/test-dom";
import { PageHeader } from "./page-header";

describe("PageHeader back link", () => {
  it("links to the parent page above the title, named for screen readers as the way back", () => {
    render(<PageHeader back={{ href: "/admin/accounts", label: "Accounts" }} title="Lerato Mokoena" />);
    const link = screen.getByRole("link", { name: "Back to Accounts" });
    expect(link.getAttribute("href")).toBe("/admin/accounts");
    // It comes before the heading, so it is the first thing in the header.
    const heading = screen.getByRole("heading", { level: 1, name: "Lerato Mokoena" });
    expect(link.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no back link on a page without a parent", () => {
    render(<PageHeader title="Accounts" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
