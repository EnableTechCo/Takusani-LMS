import { describe, expect, it, vi } from "vitest";
import type { EmailSender, OutgoingEmail, SendOutcome } from "./email";
import { deliverNotifications, retryDelaySeconds } from "./worker";

const row = (overrides: Record<string, unknown> = {}) => ({
  msg_id: 1,
  attempt: 1,
  delivery_id: "d1",
  idempotency_key: "k".repeat(64),
  event_type: "task_published",
  template_version: 1,
  payload: { task_id: "t1", title: "Task 4", cohort_name: "2026 Intake B", due_at: "2026-10-02T15:00:00Z" } as Record<
    string,
    unknown
  >,
  link: "/learn/tasks/t1",
  address: "learner@takusani.test",
  recipient_name: "Lerato Mokoena",
  ...overrides,
});

/** A stand-in for the worker's database client: hands out the batches in turn, then nothing, and records settles. */
function fakeClient(batches: ReturnType<typeof row>[][]) {
  const settled: Record<string, unknown>[] = [];
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "claim_notification_deliveries") return { data: batches.shift() ?? [], error: null };
    settled.push(args);
    return { data: [{ status: "ok" }], error: null };
  });
  return { client: { rpc } as never, settled };
}

function sender(outcome: SendOutcome) {
  const sent: OutgoingEmail[] = [];
  const emailSender: EmailSender = {
    provider: "resend",
    send: async (email) => {
      sent.push(email);
      return outcome;
    },
  };
  return { emailSender, sent };
}

describe("deliverNotifications", () => {
  it("sends each claimed email with its idempotency key and records it as accepted", async () => {
    const { client, settled } = fakeClient([[row()]]);
    const { emailSender, sent } = sender({ outcome: "accepted", providerMessageId: "re_1" });
    const summary = await deliverNotifications({ client, sender: emailSender, appUrl: "https://lms.example" });

    expect(summary).toMatchObject({ claimed: 1, accepted: 1 });
    expect(sent[0]).toMatchObject({
      to: "learner@takusani.test",
      subject: "New task: Task 4",
      idempotencyKey: "k".repeat(64),
    });
    expect(sent[0].text).toContain("Open the task: https://lms.example/learn/tasks/t1");
    expect(settled[0]).toMatchObject({
      p_msg_id: 1,
      p_delivery_id: "d1",
      p_outcome: "accepted",
      p_provider_message_id: "re_1",
    });
  });

  it("keeps a transient failure pending, backing off by attempt", async () => {
    const { client, settled } = fakeClient([[row({ attempt: 3 })]]);
    const { emailSender } = sender({ outcome: "retry", error: "429" });
    await deliverNotifications({ client, sender: emailSender, appUrl: "https://x.example" });
    expect(settled[0]).toMatchObject({ p_outcome: "retry", p_error: "429", p_retry_seconds: 540 });
  });

  it("records a permanent refusal, and a payload that cannot be rendered, as failed", async () => {
    const { client, settled } = fakeClient([[row(), row({ msg_id: 2, delivery_id: "d2", payload: {} })]]);
    const { emailSender } = sender({ outcome: "failed", error: "422 invalid to" });
    const summary = await deliverNotifications({ client, sender: emailSender, appUrl: "https://x.example" });
    expect(summary).toMatchObject({ claimed: 2, failed: 2 });
    expect(settled[1]).toMatchObject({
      p_delivery_id: "d2",
      p_outcome: "failed",
      p_error: expect.stringContaining("could not prepare"),
    });
  });

  it("records emails as skipped when email is not set up, so nothing waits for ever", async () => {
    const { client, settled } = fakeClient([[row()]]);
    const summary = await deliverNotifications({ client, sender: null, appUrl: "https://x.example" });
    expect(summary).toMatchObject({ skipped: 1 });
    expect(settled[0]).toMatchObject({ p_outcome: "skipped", p_error: "email is not set up" });
  });

  it("keeps claiming batches until the queue is empty or the time is up", async () => {
    const { client } = fakeClient([[row()], [row({ msg_id: 2 })], [row({ msg_id: 3 })]]);
    const { emailSender } = sender({ outcome: "accepted", providerMessageId: null });
    let clock = 0;
    const summary = await deliverNotifications({
      client,
      sender: emailSender,
      appUrl: "https://x.example",
      timeBudgetMs: 3,
      now: () => clock++,
    });
    expect(summary.claimed).toBe(2);
  });
});

describe("retryDelaySeconds", () => {
  it("waits 1, 4, 9 minutes and never more than an hour", () => {
    expect([1, 2, 3, 20].map(retryDelaySeconds)).toEqual([60, 240, 540, 3600]);
  });
});
