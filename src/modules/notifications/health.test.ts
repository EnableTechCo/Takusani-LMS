import { describe, expect, it } from "vitest";
import { outboxStatus } from "./health";

const now = new Date("2026-09-23T12:10:00Z");
const quiet = {
  pending: 0,
  oldest_pending_at: null,
  queue_length: 0,
  oldest_queued_seconds: null,
  failed_last_hour: 0,
};

describe("outboxStatus", () => {
  it("is fine with nothing waiting, or with work under five minutes old", () => {
    expect(outboxStatus(quiet, now)).toEqual({ stale: false, oldestPendingSeconds: null });
    expect(outboxStatus({ ...quiet, pending: 3, oldest_pending_at: "2026-09-23T12:06:00Z" }, now)).toEqual({
      stale: false,
      oldestPendingSeconds: 240,
    });
  });

  it("is stale when the oldest undelivered row, or the oldest queue message, is over five minutes old", () => {
    expect(outboxStatus({ ...quiet, pending: 1, oldest_pending_at: "2026-09-23T12:04:59Z" }, now).stale).toBe(true);
    expect(outboxStatus({ ...quiet, queue_length: 1, oldest_queued_seconds: 301 }, now).stale).toBe(true);
  });
});
