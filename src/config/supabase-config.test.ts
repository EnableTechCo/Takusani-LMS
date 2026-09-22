import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The deploy pushes supabase/config.toml to hosted projects, so these settings reach staging and production.
const config = readFileSync(fileURLToPath(new URL("../../supabase/config.toml", import.meta.url)), "utf8");

function setting(section: string, key: string): string | undefined {
  const body = config.split(/^\[/m).find((block) => block.startsWith(`${section}]`));
  return body?.match(new RegExp(String.raw`^${key}\s*=\s*([^#\n]+)`, "m"))?.[1].trim();
}

describe("Supabase auth settings", () => {
  it("keeps public sign-up closed (accounts come from administrators, FR-103)", () => {
    expect(setting("auth", "enable_signup")).toBe("false");
  });

  it("keeps the email provider on, or nobody can sign in with a password", () => {
    // On hosted projects [auth.email] enable_signup is the Email provider switch, not a sign-up setting.
    expect(setting("auth.email", "enable_signup")).toBe("true");
  });

  it("requires 12-character passwords", () => {
    expect(setting("auth", "minimum_password_length")).toBe("12");
  });
});
