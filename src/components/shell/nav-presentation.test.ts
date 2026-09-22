import { describe, expect, it } from "vitest";
import { WORKSPACES } from "@/modules/identity/navigation";
import { NAV_ICONS } from "./nav-presentation";

describe("navigation presentation", () => {
  it("gives every navigation destination an icon", () => {
    const hrefs = WORKSPACES.flatMap((workspace) => workspace.items.map((item) => item.href));
    expect(hrefs.filter((href) => !(href in NAV_ICONS))).toEqual([]);
  });

  it("has no icons for destinations that no longer exist", () => {
    const hrefs = new Set(WORKSPACES.flatMap((workspace) => workspace.items.map((item) => item.href)));
    expect(Object.keys(NAV_ICONS).filter((href) => !hrefs.has(href))).toEqual([]);
  });
});
