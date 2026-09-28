import { describe, expect, it } from "vitest";
import { detectMediaType, scanVerdict } from "./file-scan-rules";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);
const zipWith = (entry: string) =>
  new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, ...text(`[Content_Types].xml ${entry}`)]);

describe("detectMediaType", () => {
  it("reads images and PDFs from their signatures", () => {
    expect(detectMediaType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(detectMediaType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectMediaType(text("%PDF-1.7\n"))).toBe("application/pdf");
    expect(detectMediaType(text("\n\n%PDF-1.4"))).toBe("application/pdf");
  });

  it("tells Word, Excel and PowerPoint apart by the archive's entries", () => {
    expect(detectMediaType(zipWith("word/document.xml"))).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(detectMediaType(zipWith("xl/workbook.xml"))).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(detectMediaType(zipWith("ppt/presentation.xml"))).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(detectMediaType(zipWith("something/else.txt"))).toBe("application/zip");
  });

  it("does not trust a name: an executable, text or an empty file is none of the accepted types", () => {
    expect(detectMediaType(bytes(0x4d, 0x5a, 0x90, 0x00))).toBe("application/octet-stream");
    expect(detectMediaType(text("just some notes"))).toBe("application/octet-stream");
    expect(detectMediaType(new Uint8Array())).toBe("application/octet-stream");
  });
});

describe("scanVerdict", () => {
  const sha = "a".repeat(64);
  const clean = {
    length: 10,
    recordedBytes: 10,
    sha256: sha,
    declaredSha256: sha,
    detectedMediaType: "application/pdf",
    allowedMediaTypes: ["application/pdf", "image/png"],
  };

  it("is clean when size, checksum and type all hold", () => {
    expect(scanVerdict(clean)).toEqual({ outcome: "clean", reason: null });
    expect(scanVerdict({ ...clean, declaredSha256: null })).toEqual({ outcome: "clean", reason: null });
    expect(scanVerdict({ ...clean, declaredSha256: sha.toUpperCase() }).outcome).toBe("clean");
  });

  it("rejects, with the reason, a different size, checksum or type", () => {
    expect(scanVerdict({ ...clean, length: 9 }).reason).toBe("size_mismatch");
    expect(scanVerdict({ ...clean, declaredSha256: "b".repeat(64) }).reason).toBe("checksum_mismatch");
    expect(scanVerdict({ ...clean, detectedMediaType: "application/octet-stream" })).toEqual({
      outcome: "rejected",
      reason: "type_mismatch",
    });
  });
});
