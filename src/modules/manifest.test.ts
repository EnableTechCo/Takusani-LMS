import { describe, expect, it } from "vitest";
import { MODULES } from "./manifest";

describe("module manifest", () => {
  it("uses one unique stable id for every documented module", () => {
    const identifiers = MODULES.map(({ id }) => id);
    expect(new Set(identifiers).size).toBe(identifiers.length);
    expect(identifiers).toHaveLength(13);
  });
});
