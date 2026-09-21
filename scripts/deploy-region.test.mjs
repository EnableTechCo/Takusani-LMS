import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkRegions, SUPABASE_TO_VERCEL } from "./deploy-region.mjs";

describe("checkRegions", () => {
  it("accepts a Vercel region that matches the Supabase region", () => {
    expect(checkRegions("eu-west-2", ["lhr1"])).toBeNull();
  });

  it("names the region to use when they differ", () => {
    expect(checkRegions("eu-west-1", ["lhr1"])).toMatch(/must be \["dub1"\]/);
  });

  it("requires exactly one pinned region and a known Supabase region", () => {
    expect(checkRegions("eu-west-2", undefined)).toMatch(/exactly one/);
    expect(checkRegions("eu-west-2", ["lhr1", "fra1"])).toMatch(/exactly one/);
    expect(checkRegions("mars-1", ["lhr1"])).toMatch(/No Vercel region is mapped/);
  });
});

describe("vercel.json", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

  it("pins one function region that some Supabase region maps to", () => {
    expect(config.regions).toHaveLength(1);
    expect(Object.values(SUPABASE_TO_VERCEL)).toContain(config.regions[0]);
  });

  it("stops Vercel's Git integration deploying main, so production goes only through the gated workflow", () => {
    expect(config.git?.deploymentEnabled?.main).toBe(false);
  });
});
