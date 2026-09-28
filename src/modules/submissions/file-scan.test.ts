import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { cleanUpOrphans, scanFiles } from "./file-scan";

const pdf = new TextEncoder().encode("%PDF-1.7 evidence");
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");

const claim = (overrides: Record<string, unknown> = {}) => ({
  file_id: "f1",
  bucket: "submissions",
  object_key: "task/learner/one.pdf",
  bytes: pdf.length,
  declared_sha256: null as string | null,
  allowed_media_types: ["application/pdf"],
  attempt: 1,
  ...overrides,
});

/** A stand-in database client: hands out the batches, then nothing, and records each outcome. */
function fakeClient(
  batches: ReturnType<typeof claim>[][],
  stateFor: (args: Record<string, unknown>) => unknown = (args) => args.p_outcome,
) {
  const recorded: Record<string, unknown>[] = [];
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "claim_file_scans") return { data: batches.shift() ?? [], error: null };
    recorded.push(args);
    const state = stateFor(args) === "retry" ? "pending" : stateFor(args);
    return { data: [{ status: "ok", scan_state: state }], error: null };
  });
  return { client: { rpc } as never, recorded };
}

describe("scanFiles", () => {
  it("records the authoritative checksum and the detected type", async () => {
    const { client, recorded } = fakeClient([[claim()]]);
    const summary = await scanFiles({ client, read: async () => pdf });
    expect(recorded).toEqual([
      {
        p_file_id: "f1",
        p_scanner: "integrity-v1",
        p_outcome: "clean",
        p_sha256: sha(pdf),
        p_detected_media_type: "application/pdf",
      },
    ]);
    expect(summary).toMatchObject({ claimed: 1, clean: 1, rejected: 0 });
  });

  it("rejects a file that is not what it claims, with the reason", async () => {
    const renamed = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    const { client, recorded } = fakeClient([[claim({ bytes: renamed.length })]]);
    const summary = await scanFiles({ client, read: async () => renamed });
    expect(recorded[0]).toMatchObject({ p_outcome: "rejected", p_reason: "type_mismatch" });
    expect(summary.rejected).toBe(1);
  });

  it("asks for a retry when the object cannot be read, and counts what the database decides", async () => {
    const { client, recorded } = fakeClient([[claim(), claim({ file_id: "f2" })]], (args) =>
      args.p_file_id === "f2" ? "failed" : args.p_outcome,
    );
    const summary = await scanFiles({
      client,
      read: async () => {
        throw new Error("network");
      },
    });
    expect(recorded.map((args) => args.p_outcome)).toEqual(["retry", "retry"]);
    expect(summary).toMatchObject({ retried: 1, failed: 1 });
  });

  it("stops at its time budget", async () => {
    let clock = 0;
    const { client } = fakeClient([[claim()], [claim({ file_id: "f2" })]]);
    const summary = await scanFiles({
      client,
      read: async () => {
        clock += 50_000;
        return pdf;
      },
      now: () => clock,
    });
    expect(summary.claimed).toBe(1);
  });
});

describe("cleanUpOrphans", () => {
  const orphans = [
    { intent_id: "i1", bucket: "submissions", object_key: "a.pdf", reason: "expired" },
    { intent_id: "i2", bucket: "submissions", object_key: "b.pdf", reason: "discarded" },
    { intent_id: "i3", bucket: "materials", object_key: "c.pdf", reason: "expired" },
  ];
  const database = () =>
    vi.fn(async (name: string, args: Record<string, unknown>) =>
      name === "list_orphan_uploads"
        ? { data: orphans, error: null }
        : { data: (args.p_intent_ids as string[]).length, error: null },
    );

  it("removes each bucket's objects, then has the database confirm them", async () => {
    const rpc = database();
    const remove = vi.fn(async () => {});
    const summary = await cleanUpOrphans({ client: { rpc } as never, remove });
    expect(remove).toHaveBeenCalledWith("submissions", ["a.pdf", "b.pdf"]);
    expect(remove).toHaveBeenCalledWith("materials", ["c.pdf"]);
    expect(rpc).toHaveBeenLastCalledWith("record_orphans_removed", { p_intent_ids: ["i1", "i2", "i3"] });
    expect(summary).toEqual({ listed: 3, removed: 3, kept: 0 });
  });

  it("keeps a bucket's objects for the next run when Storage refuses", async () => {
    const rpc = database();
    const remove = vi.fn(async (bucket: string) => {
      if (bucket === "materials") throw new Error("storage unavailable");
    });
    const summary = await cleanUpOrphans({ client: { rpc } as never, remove });
    expect(rpc).toHaveBeenLastCalledWith("record_orphans_removed", { p_intent_ids: ["i1", "i2"] });
    expect(summary).toEqual({ listed: 3, removed: 2, kept: 1 });
  });
});
