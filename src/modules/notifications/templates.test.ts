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

  it("says assignment, not task, from version 2, while version 1 keeps its words", () => {
    const payload = { task_id: "t1", title: "Task 4", cohort_name: "2026 Intake B", due_at: "2026-10-02T15:00:00Z" };
    expect(renderNotification("task_published", 2, payload).title).toBe("New assignment: Task 4");
    expect(renderNotification("task_published", 2, payload).action).toBe("Open the assignment");
    expect(renderNotification("task_published", 1, payload).title).toBe("New task: Task 4");
    const reminder = { ...payload, message: "Please hand it in." };
    expect(renderNotification("task_reminder", 2, reminder).action).toBe("Open the assignment");
    expect(renderNotification("task_reminder", 1, reminder).action).toBe("Open the task");
    const item = { cohort_name: "2026 Intake B", item_key: "published_tasks", assigned_by_name: "Ayesha Patel" };
    expect(renderNotification("readiness_item_assigned", 2, item).title).toBe(
      "2026 Intake B: please publish an assignment",
    );
    expect(renderNotification("readiness_item_assigned", 1, item).title).toBe("2026 Intake B: please publish a task");
  });

  it("tells the learner about a series of sessions once, and about the rest of one being cancelled", () => {
    const series = renderNotification("session_series_scheduled", 1, {
      session_id: "s1",
      series_id: "x",
      title: "Weekly class",
      cohort_name: "2026 Intake B",
      starts_at: "2026-10-06T07:00:00Z",
      last_starts_at: "2026-11-10T07:00:00Z",
      duration_minutes: 120,
      mode: "online",
      repeat: "weekly",
      count: 6,
    });
    expect(series.title).toBe("New sessions: Weekly class");
    expect(series.summary).toBe(
      "6 sessions, every week from Tuesday 6 October 2026 to Tuesday 10 November 2026, each at 09:00 (SAST).",
    );
    const cancelled = renderNotification("session_series_cancelled", 1, {
      session_id: "s4",
      series_id: "x",
      title: "Weekly class",
      cohort_name: "2026 Intake B",
      starts_at: "2026-10-27T07:00:00Z",
      count: 3,
      cancel_reason: "The venue closed",
    });
    expect(cancelled.summary).toBe("3 sessions from Tuesday 27 October 2026 are cancelled.");
    const monthly = renderNotification("session_series_scheduled", 1, {
      session_id: "s1",
      series_id: "y",
      title: "Monthly review",
      cohort_name: "2026 Intake B",
      starts_at: "2027-01-31T07:00:00Z",
      last_starts_at: "2027-03-31T07:00:00Z",
      duration_minutes: 60,
      mode: "in_person",
      venue: "Room 4",
      repeat: "monthly",
      count: 3,
    });
    expect(monthly.summary).toBe(
      "3 sessions, every month from Sunday 31 January 2027 to Wednesday 31 March 2027, each at 09:00 (SAST).",
    );
    const changed = renderNotification("session_series_changed", 1, {
      session_id: "s1",
      series_id: "x",
      title: "Weekly class",
      cohort_name: "2026 Intake B",
      starts_at: "2027-02-03T08:00:00Z",
      duration_minutes: 90,
      mode: "online",
      repeat: "weekly",
      count: 6,
    });
    expect(changed.title).toBe("Sessions changed: Weekly class");
    expect(changed.paragraphs[1]).toBe(
      "The first is now on Wednesday 3 February 2027 at 10:00 (SAST), 1 hour 30 minutes, online in Teams; the others follow every week at the same time.",
    );
    expect(cancelled.paragraphs[1]).toBe('The reason given: "The venue closed"');
  });

  it("tells a moderator about their items, once per cycle, and about one reallocated to them", () => {
    const allocated = renderNotification("moderation_items_allocated", 1, {
      cycle_id: "c1",
      cycle_name: "Term 3 assignments",
      cohort_name: "2026 Intake B",
      count: 4,
    });
    expect(allocated.title).toBe("4 items to moderate: Term 3 assignments");
    expect(allocated.action).toBe("Open the cycle");
    const one = renderNotification("moderation_item_reallocated", 1, {
      cycle_id: "c1",
      cycle_name: "Term 3 assignments",
      cohort_name: "2026 Intake B",
      item_title: "Task 3: Workplace records portfolio",
    });
    expect(one.summary).toBe('Reallocated to you in "Term 3 assignments" (2026 Intake B).');
  });

  it("tells the assessor, the coordinator and then the moderator about a return and its re-mark", () => {
    const base = {
      cycle_name: "Term 3 assignments",
      cohort_name: "2026 Intake B",
      item_title: "Task 3: Workplace records portfolio",
      learner_name: "Lerato Mokoena",
      moderator_name: "Thabo Nkosi",
      due_on: "2026-10-06",
    };
    const returned = renderNotification("moderation_item_returned", 1, {
      ...base,
      corrections: "Mark AC 3.1 against the test sheet.",
    });
    expect(returned.title).toBe("Returned for re-marking: Lerato Mokoena, Task 3: Workplace records portfolio");
    expect(returned.summary).toBe("Due Tuesday 6 October 2026. Thabo Nkosi has set out what to correct.");
    expect(returned.paragraphs[1]).toBe("Required corrections: Mark AC 3.1 against the test sheet.");
    const logged = renderNotification("moderation_return_logged", 1, base);
    expect(logged.title).toBe("An item was returned for re-marking: Term 3 assignments");
    expect(logged.action).toBe("Open the cycle");
    const remarked = renderNotification("moderation_item_remarked", 1, base);
    expect(remarked.title).toBe("Re-marked, review again: Lerato Mokoena, Task 3: Workplace records portfolio");
    expect(remarked.action).toBe("Review the item");
    const signed = renderNotification("moderation_cycle_signed_off", 1, {
      cycle_id: "c1",
      cycle_name: "Term 3 assignments",
      cohort_name: "2026 Intake B",
      signed_off_by: "Thabo Nkosi",
      signed_off_at: "2026-09-29T12:05:00Z",
      released: 96,
      notified: 96,
    });
    expect(signed.title).toBe("Signed off: Term 3 assignments. 96 results released");
    expect(signed.summary).toBe(
      "2026 Intake B. Signed off by Thabo Nkosi on Tuesday 29 September 2026 at 14:05 (SAST).",
    );
  });

  it("tells the learner a result was corrected, and the coordinators about the correction", () => {
    const corrected = renderNotification("result_corrected", 1, {
      result_id: "r1",
      item_title: "Task 3",
      cohort_name: "2026 Intake B",
      released_at: "2026-09-29T12:05:00Z",
      appeal_deadline_at: "2026-10-06T22:00:00Z",
    });
    expect(corrected.title).toBe("Your result for Task 3 was corrected");
    expect(corrected.summary).toBe("You can appeal the corrected result until the end of Tuesday 6 October 2026.");
    const proposed = renderNotification("correction_proposed", 1, {
      correction_id: "c1",
      learner_name: "Lerato Mokoena",
      item_title: "Task 3",
      cohort_name: "2026 Intake B",
      proposed_by: "Ayesha Patel",
      current_outcome: "not_yet_competent",
      proposed_outcome: "competent",
    });
    expect(proposed.summary).toBe("Not yet competent to Competent. Proposed by Ayesha Patel.");
    const declined = renderNotification("correction_concluded", 1, {
      correction_id: "c1",
      learner_name: "Lerato Mokoena",
      item_title: "Task 3",
      cohort_name: "2026 Intake B",
      concluded_by: "Sipho Mahlangu",
      approved: false,
      reason: "The appendix does not cover AC 3.1.",
    });
    expect(declined.title).toBe("Correction declined: Lerato Mokoena, Task 3");
    expect(declined.paragraphs[0]).toMatch(/Their reason: "The appendix does not cover AC 3.1."$/);
  });

  it("tells administrators the credit reconciliation found differences, and that nothing changed", () => {
    const one = renderNotification("credit_reconciliation_differences", 1, {
      differences: 1,
      found_at: "2026-09-29T22:40:00Z",
    });
    expect(one.title).toBe("Credit reconciliation found 1 difference");
    expect(one.summary).toBe("The credit ledger and the award rule disagree. Nothing was changed.");
    expect(renderNotification("credit_reconciliation_differences", 1, { differences: 3 }).title).toBe(
      "Credit reconciliation found 3 differences",
    );
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

  it("tells a coordinator a stakeholder query is theirs (FR-704)", () => {
    const query = renderNotification("query_assigned", 1, {
      reference: "QRY-2026-0007",
      subject: "Placement dates",
      programme_title: "Certificate in Business Administration",
      cohort_name: "2026 Intake B",
      source_name: "Acme Logistics",
      due_on: "2026-10-30",
      note: "You know the employer.",
      assigned_by_name: "Ayesha Patel",
    });
    expect(query.title).toBe("Query QRY-2026-0007 is yours: Placement dates");
    expect(query.summary).toBe("Reply due by Friday 30 October 2026.");
    expect(query.paragraphs).toEqual([
      "Ayesha Patel routed query QRY-2026-0007 to you. It is from Acme Logistics, about Certificate in Business Administration, 2026 Intake B, and a reply is due by Friday 30 October 2026.",
      'Their note: "You know the employer."',
    ]);
  });
});
