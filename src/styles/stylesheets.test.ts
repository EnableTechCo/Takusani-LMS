import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8").replace(/\r\n/g, "\n");

describe("design system stylesheets", () => {
  it("match the design system's source of truth exactly", () => {
    // The prototype's tokens.css carries the measured contrast ratios. Change it there first, then copy.
    expect(read("./tokens.css")).toBe(read("../../docs/design/ui/prototype/assets/tokens.css"));
  });

  it("use the prototype's component layer unchanged", () => {
    // Screens are ported from the prototype markup, so its ui.css is the component layer. Change it there first.
    expect(read("./ui.css")).toBe(read("../../docs/design/ui/prototype/assets/ui.css"));
  });
});
