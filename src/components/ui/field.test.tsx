// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "./test-dom";
import { SelectField, TextField } from "./field";

describe("TextField", () => {
  it("links the help and the error to the control, and marks it invalid", () => {
    render(<TextField error="Enter your reasons." help="Refer to the criteria." label="Grounds" name="grounds" />);
    const input = screen.getByLabelText("Grounds");
    expect(input).toHaveAttribute("id", "field-grounds");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Refer to the criteria. Enter your reasons.");
    expect(input).toBeRequired();
  });

  it("puts help before the control and the error after it", () => {
    const { container } = render(<TextField error="Too short." help="At least 12." label="Password" name="p" />);
    const order = [...container.querySelectorAll(".field > *")].map((node) => node.className || node.tagName);
    expect(order).toEqual(["field__label", "field__help", "input", "field__error"]);
  });

  it("says optional in words and does not require the field", () => {
    render(<TextField label="Learner number" name="learnerNumber" optional />);
    expect(screen.getByText("(optional)")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).not.toBeRequired();
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
  });
});

describe("SelectField", () => {
  const options = [
    { value: "learner", label: "Learner" },
    { value: "assessor", label: "Assessor" },
  ];

  it("starts on an unselectable prompt", () => {
    render(<SelectField label="Role" name="role" options={options} placeholder="Choose a role" />);
    const select = screen.getByLabelText<HTMLSelectElement>("Role");
    expect(select.value).toBe("");
    expect(screen.getByRole("option", { name: "Choose a role" })).toBeDisabled();
  });

  it("keeps the choice after a refused submit re-renders it", () => {
    const { rerender } = render(<SelectField label="Role" name="role" options={options} placeholder="Choose" />);
    rerender(<SelectField defaultValue="assessor" label="Role" name="role" options={options} placeholder="Choose" />);
    expect(screen.getByLabelText<HTMLSelectElement>("Role").value).toBe("assessor");
  });
});
