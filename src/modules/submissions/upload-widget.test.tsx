// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@/components/ui/test-dom";

vi.mock("./actions", () => ({ authoriseUpload: vi.fn(), discardUpload: vi.fn(), finaliseUpload: vi.fn() }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabase: vi.fn() }));

const { UploadWidget } = await import("./upload-widget");

function bigFile(name: string) {
  const file = new File(["x"], name, { type: "application/pdf" });
  Object.defineProperty(file, "size", { value: 30 * 1024 * 1024 });
  return file;
}

function choose(file: File) {
  fireEvent.change(screen.getByLabelText("Add your work"), { target: { files: [file] } });
}

describe("UploadWidget announcements (A11Y-11)", () => {
  it("announces a file that is not accepted from one alert region, not from its row", () => {
    render(<UploadWidget already={[]} contextId="task" onChange={() => {}} requirements={[]} />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeEmptyDOMElement();

    choose(bigFile("portfolio.pdf"));
    expect(alert).toHaveTextContent("portfolio.pdf: Not accepted. This file is 30.0 MB.");
    expect(screen.getByRole("list", { name: "Files for Add your work" }).querySelector("[role]")).toBeNull();
  });

  it("announces the same refusal again when it happens again", () => {
    render(<UploadWidget already={[]} contextId="task" onChange={() => {}} requirements={[]} />);
    choose(bigFile("portfolio.pdf"));
    const first = screen.getByRole("alert").firstElementChild;
    choose(bigFile("portfolio.pdf"));
    expect(screen.getByRole("alert").firstElementChild).not.toBe(first);
  });

  it("does not announce a file that was already refused when the page loaded", () => {
    render(
      <UploadWidget
        already={[{ fileId: "f1", requirementId: null, filename: "old.pdf", bytes: 10, rejected: true }]}
        contextId="task"
        onChange={() => {}}
        requirements={[]}
      />,
    );
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
    expect(screen.getByText(/old\.pdf/)).toBeInTheDocument();
  });

  it("names its requirement on the file input", () => {
    render(
      <UploadWidget
        already={[]}
        contextId="task"
        onChange={() => {}}
        requirements={[{ id: "r1", title: "Filing index", guidance: null, mandatory: true } as never]}
      />,
    );
    expect(screen.getByLabelText("Add evidence for Filing index")).toHaveAttribute("type", "file");
  });
});
