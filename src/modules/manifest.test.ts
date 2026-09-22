import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MODULES } from "./manifest";

// The module boundaries migration creates one database schema per module; the ids must match them.
const boundaries = readFileSync(
  fileURLToPath(new URL("../../supabase/migrations/20260921000000_module_boundaries.sql", import.meta.url)),
  "utf8",
);
const schemaList = boundaries.slice(boundaries.indexOf("foreach module_schema in array array["));
const schemas = [...schemaList.slice(0, schemaList.indexOf("]")).matchAll(/'([a-z]+)'/g)].map((match) => match[1]);

describe("module manifest", () => {
  it("uses one unique stable id for every documented module", () => {
    const identifiers = MODULES.map(({ id }) => id);
    expect(new Set(identifiers).size).toBe(identifiers.length);
    expect(identifiers).toHaveLength(13);
  });

  it("names each module after its database schema", () => {
    expect(MODULES.map(({ id }) => id).sort()).toEqual([...schemas].sort());
  });
});
