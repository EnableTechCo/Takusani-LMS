import { describe, expect, it } from "vitest";
import { linkLabel, linkValue, parseLink } from "./notes-rules";

const id = "70000000-0000-4000-8000-000000000001";

describe("a note's link", () => {
  it("round-trips through a select's value", () => {
    expect(linkValue({ kind: "material", id })).toBe(`material:${id}`);
    expect(parseLink(`material:${id}`)).toEqual({ kind: "material", id });
    expect(parseLink(`session:${id}`)).toEqual({ kind: "session", id });
    expect(linkValue(null)).toBe("");
  });

  it("reads anything else as no link", () => {
    expect(parseLink("")).toBeNull();
    expect(parseLink(`task:${id}`)).toBeNull();
    expect(parseLink("material:not-an-id")).toBeNull();
  });

  it("says what the note is about", () => {
    expect(linkLabel("material", "Filing checklist")).toBe("Material: Filing checklist");
    expect(linkLabel("session", "Session 12")).toBe("Session: Session 12");
    expect(linkLabel(null, null)).toBeNull();
  });
});
