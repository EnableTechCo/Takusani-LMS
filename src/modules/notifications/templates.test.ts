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
