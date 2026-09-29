// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@/components/ui/test-dom";

vi.mock("./actions", () => ({ allocateReviewer: vi.fn(), decideAdmissibility: vi.fn() }));

const { ReviewerForm } = await import("./admin-forms");

const person = (id: string, name: string, tier: number | null, extra: object = {}) => ({
  profile_id: id,
  full_name: name,
  tier,
  role_label: "Assessor",
  open_reviews: 0,
  excluded_by: null,
  is_current: false,
  ...extra,
});

describe("ReviewerForm (A11Y-21)", () => {
  it("offers only people who can be chosen, and lists the others after the choices with the reason", () => {
    render(
      <ReviewerForm
        appealId="a1"
        candidates={[
          person("p1", "Thandiwe Nkosi", 1),
          person("p2", "Bongani Sithole", null, {
            excluded_by: [{ outcome: "not_yet_competent", decided_at: "2026-09-28T10:00:00+02:00", version_number: 1 }],
          }),
        ]}
        itemTitle="Task 3"
        learnerName="Lerato Mokoena"
        reallocating={false}
        reference="APL-2026-0031"
      />,
    );

    const group = screen.getByRole("group", { name: /Reviewer for appeal APL-2026-0031/ });
    expect(group).toHaveAccessibleName(
      "Reviewer for appeal APL-2026-0031 (Lerato Mokoena, Task 3). 1 person cannot be chosen; they are listed after the choices, with the reason.",
    );
    expect(within(group).getAllByRole("radio")).toHaveLength(1);
    expect(within(group).getByRole("radio", { name: /Thandiwe Nkosi/ })).toBeEnabled();
    expect(screen.queryByRole("radio", { name: /Bongani Sithole/ })).toBeNull();

    const excluded = screen.getByRole("region", { name: "Cannot be chosen" });
    expect(within(excluded).getByRole("listitem")).toHaveTextContent(
      "Bongani Sithole" + "Assessor" + "Marked this work: Not yet competent on Monday 28 September 2026 (version 1).",
    );
    expect(excluded.querySelector("input")).toBeNull();
  });

  it("says nothing about exclusions when everyone can be chosen", () => {
    render(
      <ReviewerForm
        appealId="a1"
        candidates={[person("p1", "Thandiwe Nkosi", 1)]}
        itemTitle="Task 3"
        learnerName="Lerato Mokoena"
        reallocating={false}
        reference="APL-2026-0031"
      />,
    );
    expect(screen.getByRole("group")).toHaveAccessibleName(
      "Reviewer for appeal APL-2026-0031 (Lerato Mokoena, Task 3)",
    );
    expect(screen.queryByRole("region", { name: "Cannot be chosen" })).toBeNull();
  });
});
