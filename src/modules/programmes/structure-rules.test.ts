import { describe, expect, it } from "vitest";
import { importDoneText, importPreviewText, qualificationTotal, readUnitList, rowProblemText } from "./structure-rules";

describe("reading a unit list", () => {
  it("reads the template's columns, with the line each unit is on", () => {
    const read = readUnitList(
      "qualification_code,qualification_title,unit_code,unit_title,credits\r\n" +
        "Q-CBA4,National Certificate: Business Administration Services,U3,Keep workplace records,12\r\n" +
        "\r\n" +
        'Q-CBA4,,U4,"Handle correspondence, letters and email",8\r\n',
    );
    expect(read).toEqual({
      ok: true,
      rows: [
        {
          row: 2,
          qualification_code: "Q-CBA4",
          qualification_title: "National Certificate: Business Administration Services",
          unit_code: "U3",
          unit_title: "Keep workplace records",
          credits: "12",
        },
        {
          row: 4,
          qualification_code: "Q-CBA4",
          qualification_title: "",
          unit_code: "U4",
          unit_title: "Handle correspondence, letters and email",
          credits: "8",
        },
      ],
    });
  });

  it("accepts the headings people use, in any order, and needs no qualification title column", () => {
    const read = readUnitList("Credits,Unit Standard ID,Unit Name,Qualification\n10,119465,Write texts,Q-1\n");
    expect(read.ok && read.rows[0]).toEqual({
      row: 2,
      qualification_code: "Q-1",
      qualification_title: "",
      unit_code: "119465",
      unit_title: "Write texts",
      credits: "10",
    });
  });

  it("says why a file cannot be read at all", () => {
    expect(readUnitList("")).toEqual({ ok: false, problem: "empty" });
    expect(readUnitList("qualification_code,unit_code,unit_title,credits\n")).toEqual({ ok: false, problem: "empty" });
    expect(readUnitList("unit_code,unit_title\nU3,Records\n")).toEqual({
      ok: false,
      problem: "missing_columns",
      detail: "qualification_code, credits",
    });
    expect(readUnitList('qualification_code,unit_code,unit_title,credits\nQ,"U3,Records,1')).toMatchObject({
      ok: false,
      problem: "unreadable",
    });
  });
});

describe("unit list wording", () => {
  it("names each line's problem, pointing a duplicate at the line it repeats", () => {
    expect(rowProblemText({ problem: "invalid_credits" })).toBe("Credits must be a whole number from 0 to 1000.");
    expect(rowProblemText({ problem: "duplicate_unit", first_row: 3 })).toBe(
      "This unit is already listed above, under the same qualification. (line 3)",
    );
    expect(rowProblemText({ problem: "something_new" })).toBe("This line has a problem.");
  });

  it("says what an import will add and leave alone", () => {
    expect(importPreviewText({ newQualifications: 1, newUnits: 3, skipped: 1 })).toBe(
      "3 units to add, in 1 new qualification. 1 unit is already in the programme and will be left as it is.",
    );
    expect(importPreviewText({ newQualifications: 0, newUnits: 1, skipped: 0 })).toBe("1 unit to add.");
    expect(importPreviewText({ newQualifications: 0, newUnits: 0, skipped: 2 })).toBe(
      "Nothing new to add. 2 units are already in the programme and will be left as they are.",
    );
  });

  it("says what an import added and left alone, once it is done", () => {
    expect(importDoneText({ newQualifications: 1, newUnits: 3, skipped: 1 })).toBe(
      "3 units added, in 1 new qualification. 1 unit was already in the programme and was left as it was.",
    );
    expect(importDoneText({ newQualifications: 0, newUnits: 0, skipped: 2 })).toBe(
      "Nothing new was added. 2 units were already in the programme and were left as they were.",
    );
  });

  it("totals a qualification from its units, every unit being compulsory", () => {
    const unit = (credits: number | null) => ({
      unit_id: String(credits),
      code: "U",
      title: "Unit",
      credits,
      scheduled: null,
      in_use: false,
    });
    expect(
      qualificationTotal({ qualification_id: "q", code: "Q", title: "Q", units: [unit(12), unit(8), unit(null)] }),
    ).toBe(20);
  });
});
