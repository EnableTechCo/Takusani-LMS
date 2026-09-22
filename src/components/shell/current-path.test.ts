import { describe, expect, it } from "vitest";
import { isCurrentPath } from "./current-path";

describe("isCurrentPath", () => {
  it("matches a section and the pages below it", () => {
    expect(isCurrentPath("/learn/tasks/7", "/learn/tasks", false)).toBe(true);
    expect(isCurrentPath("/learn/tasks-old", "/learn/tasks", false)).toBe(false);
  });

  it("matches a workspace root only exactly, so Home is not current on every learner page", () => {
    expect(isCurrentPath("/learn", "/learn", true)).toBe(true);
    expect(isCurrentPath("/learn/tasks", "/learn", true)).toBe(false);
  });
});
