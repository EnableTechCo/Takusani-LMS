import { describe, expect, it } from "vitest";
import { stickyInsets } from "./sticky-insets";
import { parseTheme } from "./theme";

describe("stickyInsets", () => {
  it("adds up the regions that currently cover content, per edge", () => {
    expect(
      stickyInsets([
        { edge: "top", height: 56, covering: true },
        { edge: "top", height: 48.2, covering: true },
        { edge: "bottom", height: 164, covering: true },
        { edge: "bottom", height: 64, covering: false }, // bottom tabs hidden on desktop
      ]),
    ).toEqual({ top: 105, bottom: 164 });
  });

  it("is zero when nothing is sticky, as on a short viewport where the bars scroll with the page", () => {
    expect(stickyInsets([{ edge: "bottom", height: 188, covering: false }])).toEqual({ top: 0, bottom: 0 });
  });
});

describe("parseTheme", () => {
  it("accepts the three appearance choices and defaults to light", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("auto")).toBe("auto");
    expect(parseTheme(undefined)).toBe("light");
    expect(parseTheme("purple")).toBe("light");
  });
});
