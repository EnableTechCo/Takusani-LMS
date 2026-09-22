import { describe, expect, it } from "vitest";
import {
  homePathFor,
  initialsOf,
  newAccountSchema,
  newPasswordSchema,
  roleLabels,
  safeNextPath,
  signInSchema,
  toNavigationSubject,
  type MyAccess,
} from "./access";

const access = (overrides: Partial<MyAccess> = {}): MyAccess => ({
  profile_id: "00000000-0000-4000-8000-000000000001",
  full_name: "Lerato Mokoena",
  email: "learner@takusani.test",
  status: "active",
  roles: ["learner"],
  has_review_allocation: false,
  ...overrides,
});

describe("toNavigationSubject", () => {
  it("keeps known roles and the review allocation", () => {
    expect(toNavigationSubject(access({ roles: ["assessor", "superuser"], has_review_allocation: true }))).toEqual({
      roles: ["assessor"],
      hasReviewAllocation: true,
    });
  });

  it("gives no workspaces without a profile or when deactivated", () => {
    expect(toNavigationSubject(null)).toEqual({ roles: [], hasReviewAllocation: false });
    expect(toNavigationSubject(access({ status: "deactivated" }))).toEqual({ roles: [], hasReviewAllocation: false });
  });
});

describe("safeNextPath", () => {
  it("allows same-site paths", () => {
    expect(safeNextPath("/learn/tasks/1?tab=brief")).toBe("/learn/tasks/1?tab=brief");
  });

  it("refuses anything that could leave the site", () => {
    const newline = String.fromCharCode(10);
    for (const next of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "learn",
      "",
      undefined,
      `/a${newline}b`,
    ]) {
      expect(safeNextPath(next)).toBeNull();
    }
  });
});

describe("form rules", () => {
  it("normalises the sign-in email", () => {
    expect(signInSchema.parse({ email: " Learner@Takusani.TEST ", password: "x" }).email).toBe("learner@takusani.test");
  });

  it("requires a 12-character password typed twice", () => {
    expect(newPasswordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "long-enough-pw", confirm: "different-pw!" }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: "long-enough-pw", confirm: "long-enough-pw" }).success).toBe(true);
  });

  it("accepts only known roles for a new account and drops an empty learner number", () => {
    expect(newAccountSchema.safeParse({ fullName: "A", email: "a@b.org", role: "superuser" }).success).toBe(false);
    expect(newAccountSchema.parse({ fullName: " A ", email: "a@b.org", role: "learner", learnerNumber: "" })).toEqual({
      fullName: "A",
      email: "a@b.org",
      role: "learner",
      learnerNumber: undefined,
    });
  });
});

describe("initialsOf", () => {
  it("uses first and last names", () => {
    expect(initialsOf("Zanele  Khumalo")).toBe("ZK");
    expect(initialsOf("Sipho")).toBe("SI");
  });
});

describe("homePathFor", () => {
  it("follows the landing rules", () => {
    expect(homePathFor(null)).toBe("/sign-in");
    expect(homePathFor(access())).toBe("/learn");
    expect(homePathFor(access({ roles: ["learner", "assessor"] }))).toBe("/home");
    expect(homePathFor(access({ status: "deactivated" }))).toBe("/sign-in");
  });

  it("sends someone signed in with no roles to their account, not back to sign-in", () => {
    expect(homePathFor(access({ roles: [] }))).toBe("/account");
  });
});

describe("roleLabels", () => {
  it("labels known roles in order and skips unknown codes", () => {
    expect(roleLabels(["assessor", "superuser", "learner"])).toEqual(["Assessor", "Learner"]);
  });
});
