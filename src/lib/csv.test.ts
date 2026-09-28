import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("quotes when it must, and never lets a spreadsheet run a cell as a formula", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("Mokoena, Lerato")).toBe('"Mokoena, Lerato"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
  });
});

describe("toCsv", () => {
  it("writes a header and rows with CRLF, leaving empty cells empty", () => {
    expect(
      toCsv(
        ["name", "version"],
        [
          ["Lerato", 2],
          ["Zola", null],
        ],
      ),
    ).toBe("name,version\r\nLerato,2\r\nZola,\r\n");
  });
});
