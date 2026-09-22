import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WORKSPACES } from "./navigation";

const APP = fileURLToPath(new URL("../../app/(app)", import.meta.url));

describe("navigation destinations", () => {
  it("each have a page (a skeleton until the feature is built)", () => {
    const missing = WORKSPACES.flatMap((w) => w.items.map((i) => i.href)).filter(
      (href) => !existsSync(`${APP}${href}/page.tsx`),
    );
    expect(missing).toEqual([]);
  });
});
