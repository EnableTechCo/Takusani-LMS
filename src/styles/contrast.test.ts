import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * WCAG 2.2 contrast for every colour pairing the design system relies on (LMS-design-system.md section 2),
 * computed from the actual values in tokens.css for both themes. Text needs 4.5:1 (1.4.3); control boundaries,
 * focus rings and meaningful graphics need 3:1 (1.4.11). A token change that breaks a pairing fails here.
 */

const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${selector} not found in tokens.css`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error(`${selector} is not closed`);
}

function colours(source: string): Record<string, string> {
  return Object.fromEntries([...source.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

const light = colours(block(":root"));
const dark = { ...light, ...colours(block('[data-theme="dark"]')) };

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const TEXT = 4.5;
const NON_TEXT = 3;
const TONES = ["neutral", "info", "positive", "caution", "critical"];

// [foreground, background, minimum]
const PAIRS: [string, string, number][] = [
  ...["text-strong", "text", "text-secondary", "text-tertiary", "accent"].flatMap((fg) =>
    ["canvas", "surface", "surface-sunken"].map((bg): [string, string, number] => [fg, bg, TEXT]),
  ),
  ["text", "accent-subtle", TEXT],
  ["accent", "accent-subtle", TEXT],
  ["text-inverse", "ink", TEXT],
  ["text-inverse", "ink-hover", TEXT],
  ["on-accent", "accent", TEXT],
  ["on-critical", "critical-fill", TEXT],
  ...["canvas", "surface", "surface-sunken"].flatMap((bg): [string, string, number][] => [
    ["border-strong", bg, NON_TEXT],
    ["focus", bg, NON_TEXT],
  ]),
  ...TONES.flatMap((tone): [string, string, number][] => [
    [`${tone}-text`, `${tone}-bg`, TEXT],
    [`${tone}-solid`, `${tone}-bg`, NON_TEXT],
    [`${tone}-solid`, "surface", NON_TEXT],
  ]),
  ...["info", "positive", "caution", "critical"].map((tone): [string, string, number] => [
    `${tone}-text`,
    "surface",
    TEXT,
  ]),
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme contrast", (_, palette: Record<string, string>) => {
  it.each(PAIRS)("%s on %s is at least %s:1", (fg, bg, minimum) => {
    expect(palette[fg], `--color-${fg}`).toBeDefined();
    expect(palette[bg], `--color-${bg}`).toBeDefined();
    expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(minimum);
  });
});

describe("theme blocks", () => {
  it("contrast is computed the WCAG way (black on white is 21:1)", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("the 'follow system' dark block matches the dark theme exactly", () => {
    // tokens.css duplicates the dark values for data-theme="auto" because CSS has no mixins.
    const auto = colours(block("@media (prefers-color-scheme: dark)"));
    expect(auto).toEqual(colours(block('[data-theme="dark"]')));
  });
});
