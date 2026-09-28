import { describe, expect, it } from "vitest";
import { describeContent, materialState } from "./materials-rules";

const now = new Date("2026-09-28T10:00:00+02:00");

describe("materialState", () => {
  it("says Scheduled for published material whose release time is still to come", () => {
    expect(materialState("published", "2026-09-29T08:00:00+02:00", now)).toBe("Scheduled");
    expect(materialState("published", "2026-09-28T09:59:00+02:00", now)).toBe("Published");
  });

  it("says Draft and Archived as they are", () => {
    expect(materialState("draft", null, now)).toBe("Draft");
    expect(materialState("archived", "2026-09-01T08:00:00+02:00", now)).toBe("Archived");
  });
});

describe("describeContent", () => {
  it("names the kind of file and its size, or the site a link goes to", () => {
    expect(describeContent({ kind: "file", file_media_type: "application/pdf", file_bytes: 1_258_291 })).toBe(
      "PDF, 1.2 MB",
    );
    expect(
      describeContent({
        kind: "file",
        file_media_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        file_bytes: null,
      }),
    ).toBe("PowerPoint");
    expect(describeContent({ kind: "link", link_host: "learn.microsoft.com" })).toBe("Link to learn.microsoft.com");
    expect(describeContent({ kind: null })).toBe("No content yet");
  });
});
