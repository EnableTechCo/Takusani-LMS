import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TEST_ACCOUNTS } from "./provision-accounts.mjs";

// Local accounts come from supabase/seed.sql and staging accounts from this script; they must be the same people.
const seed = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");
const seeded = [...seed.matchAll(/'([a-z]+@takusani\.test)',\s*'([^']+)',\s*array\[([^\]]+)\]/g)].map((match) => ({
  email: match[1],
  fullName: match[2],
  roles: [...match[3].matchAll(/'([a-z]+)'/g)].map((role) => role[1]),
}));

describe("test accounts", () => {
  it("are the same locally and on staging", () => {
    expect(seeded).toHaveLength(TEST_ACCOUNTS.length);
    expect(TEST_ACCOUNTS.map(({ email, fullName, roles }) => ({ email, fullName, roles }))).toEqual(seeded);
  });
});
