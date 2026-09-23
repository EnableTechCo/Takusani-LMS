import { describe, expect, it } from "vitest";
import { formatBytes, uploadRefusalMessage } from "./rules";

describe("formatBytes", () => {
  it("reads as a person would say it, not in bytes", () => {
    expect(formatBytes(900)).toBe("900 bytes");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
});

describe("uploadRefusalMessage", () => {
  const file = { filename: "walkthrough.mov", bytes: 48 * 1024 * 1024 };

  it("names the real sizes and says what to do instead", () => {
    expect(uploadRefusalMessage("too_large", 25 * 1024 * 1024, file)).toBe(
      "This file is 48.0 MB. The limit is 25.0 MB. Save it as a PDF, or take photos at a lower quality.",
    );
  });

  it("says which kinds are accepted when the type is wrong", () => {
    expect(uploadRefusalMessage("type_not_allowed", null, file)).toContain("PDF, a Word or Excel file, or a photo");
  });

  it("never calls a paused or expired upload a failure", () => {
    expect(uploadRefusalMessage("expired", null, file)).toBe(
      "This upload took too long and has expired. Choose the file again. Nothing was submitted.",
    );
    expect(uploadRefusalMessage("anything-unexpected", null, file)).toBe(
      "This file could not be accepted. Choose it again.",
    );
  });
});
