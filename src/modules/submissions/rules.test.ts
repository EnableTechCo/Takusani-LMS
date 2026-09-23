import { describe, expect, it } from "vitest";
import { audienceSchema, criteriaSchema, editTaskSchema, newTaskSchema, splitEmails } from "./rules";

const task = {
  cohortId: "10000000-0000-4000-8000-000000000010",
  title: " Task 3: Workplace records ",
  brief: " Write up the records. ",
  submissionType: "file_upload",
  dueAt: "2026-10-02T17:00",
  latePolicy: "accept_and_flag",
};

describe("newTaskSchema", () => {
  it("trims the title and the brief", () => {
    const parsed = newTaskSchema.parse(task);
    expect(parsed.title).toBe("Task 3: Workplace records");
    expect(parsed.brief).toBe("Write up the records.");
  });

  it("allows a draft with no due date, and refuses a half-written one", () => {
    expect(newTaskSchema.safeParse({ ...task, dueAt: "" }).success).toBe(true);
    expect(newTaskSchema.safeParse({ ...task, dueAt: "2026-10-02" }).success).toBe(false);
  });

  it("refuses a submission type we do not support", () => {
    expect(newTaskSchema.safeParse({ ...task, submissionType: "carrier_pigeon" }).success).toBe(false);
  });

  it("needs a cohort, which the edit form does not ask for", () => {
    expect(newTaskSchema.safeParse({ ...task, cohortId: "" }).success).toBe(false);
    expect(editTaskSchema.safeParse({ ...task, cohortId: undefined }).success).toBe(true);
  });
});

describe("criteriaSchema", () => {
  it("reads points as a number and leaves them out when blank", () => {
    const parsed = criteriaSchema.parse([
      { title: " Records are complete ", points: "10" },
      { title: "Retention rules applied", points: "" },
    ]);
    expect(parsed[0]).toEqual({ title: "Records are complete", points: 10 });
    expect(parsed[1].points).toBeUndefined();
  });

  it("needs a title on every row", () => {
    expect(criteriaSchema.safeParse([{ title: "" }]).success).toBe(false);
  });

  it("accepts an empty rubric: points and criteria are optional", () => {
    expect(criteriaSchema.parse([])).toEqual([]);
  });
});

describe("audienceSchema and splitEmails", () => {
  it("takes one address per line, ignoring case, blanks and repeats", () => {
    expect(splitEmails(" Lerato@takusani.test \n\n sipho@takusani.test\nLERATO@takusani.test ")).toEqual([
      "lerato@takusani.test",
      "sipho@takusani.test",
    ]);
  });

  it("needs at least one learner when the audience is named", () => {
    const refused = audienceSchema.safeParse({ audience: "named", emails: "  " });
    expect(refused.success).toBe(false);
    expect(refused.error?.issues[0].path).toEqual(["emails"]);
    expect(audienceSchema.parse({ audience: "cohort", emails: "" }).emails).toEqual([]);
  });
});
