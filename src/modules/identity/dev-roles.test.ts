import { describe, expect, it } from "vitest";
import { parseDevRoles } from "./dev-roles";

describe("parseDevRoles", () => {
  it("reads known roles and the reviewer allocation, ignoring anything else", () => {
    expect(parseDevRoles(" Assessor, moderator ,reviewer, superuser")).toEqual({
      roles: ["assessor", "moderator"],
      hasReviewAllocation: true,
    });
  });

  it("gives no roles when unset", () => {
    expect(parseDevRoles(undefined)).toEqual({ roles: [], hasReviewAllocation: false });
  });
});
