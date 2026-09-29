// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GLOSSARY, navigationMeaning } from "@/config/glossary";
import { Glossed } from "./term";
import "./test-dom";

describe("Glossed", () => {
  it("marks the first use of each glossary term with its meaning, and leaves later uses plain", () => {
    render(
      <p>
        <Glossed prefix="t" text="Your cohorts and appeals, by cohort. Times are SAST." />
      </p>,
    );
    const words = screen.getAllByRole("button").map((button) => button.textContent);
    expect(words).toEqual(["cohorts", "appeals", "SAST"]);
    const cohort = screen.getByRole("button", { name: "cohorts" });
    expect(cohort).toHaveAttribute("aria-describedby", "t-cohort");
    expect(screen.getByRole("tooltip", { name: /group of learners/ })).toHaveAttribute("id", "t-cohort");
    expect(screen.getByText(/, by cohort\./)).toBeInTheDocument();
  });

  it("prefers the longer term when one contains another", () => {
    render(<Glossed prefix="t" text="Not yet competent, then competent." />);
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Not yet competent",
      "competent",
    ]);
  });

  it("leaves text without glossary terms untouched", () => {
    render(<Glossed prefix="t" text="Nothing needs you right now." />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Nothing needs you right now.")).toBeInTheDocument();
  });
});

describe("glossary", () => {
  it("gives every term a plain-language meaning that ends as a sentence", () => {
    for (const entry of GLOSSARY) {
      expect(entry.meaning.length, entry.term).toBeGreaterThan(20);
      expect(entry.meaning.endsWith("."), entry.term).toBe(true);
      expect(new RegExp(`^${entry.pattern}$`, "i").test(entry.term), entry.term).toBe(true);
    }
  });

  it("explains navigation labels that are terms, and not the others", () => {
    expect(navigationMeaning("Cohorts")).toMatch(/group of learners/);
    expect(navigationMeaning("Assignments")).toMatch(/Work set/);
    expect(navigationMeaning("Overview")).toBeUndefined();
  });
});
