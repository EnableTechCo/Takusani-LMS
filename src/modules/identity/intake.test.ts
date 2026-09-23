import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, readIntake } from "./intake";

describe("parseCsv", () => {
  it("reads quoted fields with commas, doubled quotes and line breaks, and CRLF or LF rows", () => {
    expect(parseCsv('a,b\r\n"Mokoena, Lerato","say ""hi"""\n"two\nlines",x')).toEqual([
      ["a", "b"],
      ["Mokoena, Lerato", 'say "hi"'],
      ["two\nlines", "x"],
    ]);
  });

  it("ignores a byte-order mark, and refuses a quote that never closes", () => {
    expect(parseCsv("﻿name\nx")).toEqual([["name"], ["x"]]);
    expect(parseCsv('name\n"open')).toBeNull();
  });
});

describe("readIntake", () => {
  it("maps the header by name in any order and common spellings, numbering rows as in the file", () => {
    const read = readIntake("Email Address,Learner No,Full Name\n\nlerato@example.org,KSI-1, Lerato Mokoena \n");
    expect(read).toEqual({
      ok: true,
      rows: [{ row: 3, full_name: "Lerato Mokoena", email: "lerato@example.org", learner_number: "KSI-1" }],
    });
  });

  it("names the required columns a file is missing, before any row is read (flow G, E1)", () => {
    expect(readIntake("name,phone\nLerato,0820000000")).toEqual({
      ok: false,
      problem: "missing_columns",
      detail: "email",
    });
  });

  it("refuses an empty file, or one with only a header", () => {
    expect(readIntake("")).toMatchObject({ problem: "empty" });
    expect(readIntake("full_name,email\n")).toMatchObject({ problem: "empty" });
  });

  it("refuses more than 5,000 rows", () => {
    const text = `full_name,email\n${"a,b@c.d\n".repeat(5001)}`;
    expect(readIntake(text)).toEqual({ ok: false, problem: "too_many_rows", detail: "5001" });
  });
});

describe("csvCell", () => {
  it("quotes when it must, and never lets a spreadsheet run a cell as a formula", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("Mokoena, Lerato")).toBe('"Mokoena, Lerato"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
  });
});
