import { describe, expect, it } from "vitest";
import { renderEmail, renderNotification } from "./templates";

const released = {
  result_id: "r1",
  item_title: "Task 3: Workplace records portfolio",
  cohort_name: "2026 Intake B",
  released_at: "2026-09-22T12:05:00Z",
  appeal_deadline_at: "2026-09-29T22:00:00Z",
};

describe("renderNotification", () => {
  it("tells the learner their result is ready and when the appeal window closes, never the outcome", () => {
    const rendered = renderNotification("result_released", 1, { ...released, outcome: "not_yet_competent" });
    expect(rendered.title).toBe("Your result for Task 3: Workplace records portfolio is ready");
    expect(rendered.summary).toBe("You can appeal until the end of Tuesday 29 September 2026.");
    expect(rendered.paragraphs[0]).toBe(
      "Your result for Task 3: Workplace records portfolio (2026 Intake B) was released on Tuesday 22 September 2026 at 14:05 (SAST).",
    );
    expect(rendered.paragraphs.join(" ")).not.toMatch(/competent/i);
  });

  it("names a new task and when it is due", () => {
    const rendered = renderNotification("task_published", 1, {
      task_id: "t1",
      title: "Task 4",
      cohort_name: "2026 Intake B",
      due_at: "2026-10-02T15:00:00Z",
    });
    expect(rendered.title).toBe("New task: Task 4");
    expect(rendered.summary).toBe("Due Friday 2 October 2026 at 17:00 (SAST).");
  });

  it("refuses an unknown template or a payload missing a fact, rather than sending a broken email", () => {
    expect(() => renderNotification("result_released", 2, released)).toThrow("no template");
    expect(() => renderNotification("result_released", 1, { ...released, item_title: "" })).toThrow("item_title");
  });
});

describe("renderEmail", () => {
  it("greets by name, ends with the link, and escapes what it puts in HTML", () => {
    const email = renderEmail(renderNotification("result_released", 1, { ...released, item_title: "A <b>&</b> B" }), {
      recipientName: "Lerato Mokoena",
      url: "https://lms.example/learn/results/r1",
    });
    expect(email.subject).toBe("Your result for A <b>&</b> B is ready");
    expect(email.text.startsWith("Hello Lerato Mokoena,")).toBe(true);
    expect(email.text).toContain("See your result: https://lms.example/learn/results/r1");
    expect(email.html).toContain("A &lt;b&gt;&amp;&lt;/b&gt; B");
    expect(email.html).not.toContain("<b>&</b>");
  });
});

describe("sign-in lock notices (S3-06, FR-106)", () => {
  it("say new sign-ins are paused until when, that nothing current is stopped, and how to get in sooner", () => {
    const locked = renderNotification("sign_in_locked", 1, { locked_until: "2026-09-28T13:15:00Z", failures: 5 });
    expect(locked.title).toBe("Sign-in to your account is paused");
    expect(locked.summary).toBe("After 5 wrong passwords, new sign-ins are paused until 15:15 (SAST).");
    expect(locked.paragraphs[1]).toContain("including an exam");
    expect(locked.paragraphs[2]).toContain("Forgot your password?");
  });

  it("say when an administrator opened it again", () => {
    const unlocked = renderNotification("sign_in_unlocked", 1, { unlocked_at: "2026-09-28T13:05:00Z" });
    expect(unlocked.summary).toBe("An administrator unlocked it on Monday 28 September 2026 at 15:05 (SAST).");
  });
});

describe("account notices (S3-08)", () => {
  it("tell the person a reset link was sent, and what to do if they did not ask", () => {
    const sent = renderNotification("password_reset_sent", 1, { sent_at: "2026-09-28T13:00:00Z" });
    expect(sent.title).toBe("An administrator sent you a password reset link");
    expect(sent.paragraphs[1]).toContain("If you did not ask for this");
  });

  it("say a deactivated account cannot sign in, and a reactivated one can", () => {
    expect(renderNotification("account_deactivated", 1, { deactivated_at: "2026-09-28T13:00:00Z" }).summary).toBe(
      "Deactivated on Monday 28 September 2026. You can no longer sign in.",
    );
    expect(renderNotification("account_reactivated", 1, { reactivated_at: "2026-09-28T13:00:00Z" }).title).toBe(
      "Your account is active again",
    );
  });

  it("tells a person about a role given or ended, and a readiness item assigned to them", () => {
    const assigned = renderNotification("role_assigned", 1, {
      role: "assessor",
      scope_label: "2027 Intake A",
      until: null,
    });
    expect(assigned.title).toBe("You are now an assessor: 2027 Intake A");
    expect(assigned.summary).toBe("From now, with no end date.");
    const ended = renderNotification("role_ended", 1, {
      role: "moderator",
      scope_label: "2027 Intake A",
      ended_at: "2026-10-05T08:00:00Z",
    });
    expect(ended.title).toBe("Your moderator role has ended: 2027 Intake A");
    const item = renderNotification("readiness_item_assigned", 1, {
      cohort_name: "2027 Intake A",
      item_key: "materials",
      due_on: "2026-10-09",
      note: "The unit 1 pack.",
      assigned_by_name: "Ayesha Patel",
    });
    expect(item.title).toBe("2027 Intake A: please publish the learning material");
    expect(item.summary).toBe("Due by Friday 9 October 2026.");
    expect(item.paragraphs.join(" ")).toContain('Their note: "The unit 1 pack."');
  });
});
