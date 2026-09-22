import { describe, expect, it } from "vitest";
import { enrolSchema, isUuid, newCohortSchema, newProgrammeSchema } from "./rules";

describe("newProgrammeSchema", () => {
  it("upper-cases the code and reads the NQF level as a number", () => {
    expect(newProgrammeSchema.parse({ code: " cba-nqf4 ", title: " Business ", nqfLevel: "4" })).toEqual({
      code: "CBA-NQF4",
      title: "Business",
      nqfLevel: 4,
    });
  });

  it("allows no NQF level and refuses one outside 1 to 10", () => {
    expect(newProgrammeSchema.parse({ code: "AB", title: "T", nqfLevel: "" }).nqfLevel).toBeUndefined();
    expect(newProgrammeSchema.safeParse({ code: "AB", title: "T", nqfLevel: "11" }).success).toBe(false);
  });

  it("refuses codes the database would refuse", () => {
    expect(newProgrammeSchema.safeParse({ code: "A", title: "T" }).success).toBe(false);
    expect(newProgrammeSchema.safeParse({ code: "has space", title: "T" }).success).toBe(false);
  });
});

describe("newCohortSchema", () => {
  const cohort = {
    programmeId: "10000000-0000-4000-8000-000000000001",
    name: "2027 Intake A",
    startsOn: "2027-02-01",
    endsOn: "2027-12-15",
  };

  it("accepts a cohort with a programme, a name and dates in order", () => {
    expect(newCohortSchema.safeParse(cohort).success).toBe(true);
  });

  it("refuses an end date before the start date, on the end date field", () => {
    const result = newCohortSchema.safeParse({ ...cohort, endsOn: "2027-01-01" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["endsOn"]);
  });

  it("needs a programme", () => {
    expect(newCohortSchema.safeParse({ ...cohort, programmeId: "" }).success).toBe(false);
  });
});

describe("enrolSchema and isUuid", () => {
  it("normalises the learner email", () => {
    expect(enrolSchema.parse({ email: " Learner@Takusani.TEST " }).email).toBe("learner@takusani.test");
  });

  it("recognises cohort ids", () => {
    expect(isUuid("10000000-0000-4000-8000-000000000010")).toBe(true);
    expect(isUuid("example")).toBe(false);
  });
});
