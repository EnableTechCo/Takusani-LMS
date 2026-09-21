import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8").replace(/\r\n/g, "\n");

describe("design tokens", () => {
  it("match the design system's source of truth exactly", () => {
    // The prototype's tokens.css carries the measured contrast ratios. Change it there first, then copy.
    expect(read("./tokens.css")).toBe(read("../../docs/design/ui/prototype/assets/tokens.css"));
  });
});
