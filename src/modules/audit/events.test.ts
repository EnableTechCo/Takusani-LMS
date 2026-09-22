import { describe, expect, it } from "vitest";
import { actionLabel, describeChange, parseAuditFilters } from "./events";

describe("actionLabel", () => {
  it("names known actions and shows unknown ones as they are", () => {
    expect(actionLabel("identity.account_created")).toBe("Account created");
    expect(actionLabel("moderation.cycle_signed_off")).toBe("moderation.cycle_signed_off");
  });
});

describe("describeChange", () => {
  it("lists what was set when something is created", () => {
    expect(describeChange(null, { full_name: "Audit Person", learner_number: null, status: "active" })).toEqual([
      "Name: Audit Person",
      "Learner number: none",
      "Status: active",
    ]);
  });

  it("shows only fields that changed, as from and to", () => {
    expect(describeChange({ status: "active", full_name: "A" }, { status: "deactivated", full_name: "A" })).toEqual([
      "Status: active to deactivated",
    ]);
  });

  it("shows what was removed", () => {
    expect(describeChange({ role: "assessor" }, null)).toEqual(["Role: assessor removed"]);
  });
});

describe("parseAuditFilters", () => {
  it("turns dates into a South African day range, the end exclusive", () => {
    expect(parseAuditFilters({ from: "2026-09-22", to: "2026-09-22" })).toEqual({
      action: undefined,
      actorEmail: undefined,
      from: "2026-09-21T22:00:00.000Z",
      to: "2026-09-22T22:00:00.000Z",
      beforeId: undefined,
    });
  });

  it("ignores malformed values instead of failing", () => {
    expect(parseAuditFilters({ from: "yesterday", before: "-3", action: "" })).toEqual({
      action: undefined,
      actorEmail: undefined,
      from: undefined,
      to: undefined,
      beforeId: undefined,
    });
  });

  it("keeps the action, the actor and the page", () => {
    expect(
      parseAuditFilters({ action: "identity.role_assigned", actor: "admin@takusani.test", before: "42" }),
    ).toMatchObject({
      action: "identity.role_assigned",
      actorEmail: "admin@takusani.test",
      beforeId: 42,
    });
  });
});
