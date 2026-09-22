import { describe, expect, it, vi } from "vitest";
import { checkReadiness } from "./readiness";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
} as unknown as NodeJS.ProcessEnv;

describe("checkReadiness", () => {
  it("is ready when configuration is valid and the database probe answers true", async () => {
    const fetchImpl = vi.fn(async () => new Response("true", { status: 200 }));
    await expect(checkReadiness(env, fetchImpl)).resolves.toEqual({
      ok: true,
      checks: { configuration: "ok", database: "ok" },
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:54321/rest/v1/rpc/health_check");
    expect((init.headers as Record<string, string>)["content-profile"]).toBe("api");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("is not ready when the probe fails or times out", async () => {
    const failing = vi.fn(async () => new Response("{}", { status: 503 }));
    const throwing = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    await expect(checkReadiness(env, failing)).resolves.toMatchObject({ ok: false, checks: { database: "failed" } });
    await expect(checkReadiness(env, throwing)).resolves.toMatchObject({ ok: false, checks: { database: "failed" } });
  });

  it("is not ready, and does not call the database, when configuration is missing", async () => {
    const fetchImpl = vi.fn();
    await expect(checkReadiness({} as NodeJS.ProcessEnv, fetchImpl)).resolves.toEqual({
      ok: false,
      checks: { configuration: "failed", database: "failed" },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
