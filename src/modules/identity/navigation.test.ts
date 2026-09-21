import { describe, expect, it } from "vitest";
import { findWorkspace, landingPathFor, workspacesFor, WORKSPACES } from "./navigation";

const ids = (subject: Parameters<typeof workspacesFor>[0]) => workspacesFor(subject).map((w) => w.id);

describe("workspacesFor", () => {
  it("shows only the workspaces for roles the person holds", () => {
    expect(ids({ roles: ["assessor"], hasReviewAllocation: false })).toEqual(["assess"]);
    expect(ids({ roles: [], hasReviewAllocation: false })).toEqual([]);
  });

  it("keeps desktop order with Learning first for a learner who is also staff", () => {
    expect(ids({ roles: ["moderator", "learner", "assessor"], hasReviewAllocation: false })).toEqual(["learn", "assess", "moderate"]);
  });

  it("shows appeal reviews only with an allocation, never from a role", () => {
    expect(ids({ roles: ["moderator"], hasReviewAllocation: true })).toEqual(["moderate", "review"]);
    expect(ids({ roles: ["moderator", "coordinator", "administrator"], hasReviewAllocation: false })).not.toContain("review");
  });
});

describe("landingPathFor", () => {
  it("sends a learner to /learn and any staff role to /home", () => {
    expect(landingPathFor({ roles: ["learner"], hasReviewAllocation: false })).toBe("/learn");
    expect(landingPathFor({ roles: ["learner", "assessor"], hasReviewAllocation: false })).toBe("/home");
    expect(landingPathFor({ roles: ["facilitator"], hasReviewAllocation: false })).toBe("/home");
  });

  it("sends someone with no roles to sign in", () => {
    expect(landingPathFor({ roles: [], hasReviewAllocation: false })).toBe("/sign-in");
  });
});

describe("workspace routes", () => {
  it("uses the route prefixes from the UX architecture", () => {
    expect(WORKSPACES.map((w) => `/${w.segment}`)).toEqual(["/learn", "/teach", "/assess", "/moderate", "/review", "/coordinate", "/admin"]);
    expect(findWorkspace("learning")).toBeUndefined();
    expect(findWorkspace("assess")?.label).toBe("Assessing");
  });

  it("keeps every navigation item inside its own workspace", () => {
    for (const workspace of WORKSPACES) {
      for (const item of workspace.items) expect(item.href.startsWith(`/${workspace.segment}`)).toBe(true);
    }
  });
});
