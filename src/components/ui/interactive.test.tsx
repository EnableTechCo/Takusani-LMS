// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "./test-dom";
import { Button } from "./button";
import { ConsequenceDialog, Dialog } from "./dialog";
import { ErrorSummary } from "./form-feedback";
import { Menu, MenuLink } from "./menu";
import { Tabs } from "./tabs";
import { ToastProvider, useToast } from "./toast";

describe("Button", () => {
  it("keeps focus and ignores presses while its command runs, announcing the running label", async () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Saving, please wait" onClick={onClick}>
        Save draft
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving, please wait" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("ErrorSummary", () => {
  it("takes focus and links each error to its field", () => {
    render(<ErrorSummary errors={{ email: "Enter an email address." }} labels={{ email: "Email address" }} />);
    const summary = screen.getByRole("alert");
    expect(summary).toHaveFocus();
    expect(screen.getByRole("link", { name: "Email address: Enter an email address." })).toHaveAttribute(
      "href",
      "#field-email",
    );
    expect(summary).toHaveTextContent("There is a problem");
  });

  it("counts several errors in words", () => {
    render(<ErrorSummary errors={{ a: "One.", b: "Two." }} labels={{}} />);
    expect(screen.getByText("There are 2 things to fix")).toBeInTheDocument();
  });
});

describe("ConsequenceDialog", () => {
  function renderDialog(onConfirm = vi.fn()) {
    render(
      <ConsequenceDialog
        acknowledgement="I did not assess any item that I moderated."
        cancelLabel="Not yet"
        confirmLabel="Sign off and release 96 results"
        consequence="96 learners will see their results straight away."
        onConfirm={onConfirm}
        title="Sign off Term 3 tasks?"
        trigger={{ label: "Sign off" }}
      />,
    );
    return onConfirm;
  }

  it("opens with focus on the safe action and the confirm button held until acknowledged", async () => {
    const user = userEvent.setup();
    const onConfirm = renderDialog();
    await user.click(screen.getByRole("button", { name: "Sign off" }));
    const dialog = screen.getByRole("dialog", { name: "Sign off Term 3 tasks?" });
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Not yet" })).toHaveFocus();
    const confirm = screen.getByRole("button", { name: "Sign off and release 96 results" });
    expect(confirm).toBeDisabled();
    await user.click(screen.getByLabelText("I did not assess any item that I moderated."));
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(dialog).not.toHaveAttribute("open");
  });

  it("does not close on a backdrop click, closes on Escape, and returns focus to its button", async () => {
    const user = userEvent.setup();
    renderDialog();
    const trigger = screen.getByRole("button", { name: "Sign off" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(dialog).toHaveAttribute("open");
    await user.keyboard("{Escape}");
    expect(dialog).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });

  it("asks for the acknowledgement again each time it opens", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Sign off" }));
    await user.click(screen.getByRole("checkbox"));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Sign off" }));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });
});

describe("Dialog", () => {
  it("closes on a backdrop click", async () => {
    const user = userEvent.setup();
    render(
      <Dialog title="Your workspaces" trigger={{ label: "Workspaces" }}>
        <p>Learning</p>
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Workspaces" }));
    const dialog = screen.getByRole("dialog", { name: "Your workspaces" });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.click(dialog);
    expect(dialog).not.toHaveAttribute("open");
  });

  it("keeps Tab inside", async () => {
    const user = userEvent.setup();
    render(
      <Dialog footer={(close) => <Button onClick={close}>Done</Button>} title="Filter" trigger={{ label: "Filter" }}>
        <p>Options</p>
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Filter" }));
    const close = screen.getByRole("button", { name: "Close" });
    const done = screen.getByRole("button", { name: "Done" });
    // jsdom has no layout, so every element looks hidden to the trap; give them a parent to count as visible.
    for (const item of [close, done]) Object.defineProperty(item, "offsetParent", { get: () => document.body });
    done.focus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(done).toHaveFocus();
  });
});

describe("Tabs", () => {
  it("moves with the arrow keys, Home and End, and keeps only the selected tab in the Tab order", async () => {
    const user = userEvent.setup();
    render(
      <Tabs
        label="Marking panel"
        tabs={[
          { id: "rubric", label: "Rubric", content: <p>Rubric rows</p> },
          { id: "feedback", label: "Feedback", content: <p>Feedback text</p> },
          { id: "history", label: "History", count: 2, content: <p>Versions</p> },
        ]}
      />,
    );
    await user.tab();
    expect(screen.getByRole("tab", { name: "Rubric" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Feedback" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Feedback text");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "History 2" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Rubric" })).toHaveFocus();
    expect(screen.getAllByRole("tab").map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
  });
});

describe("Menu", () => {
  function renderMenu() {
    render(
      <div>
        <p>Outside</p>
        <Menu label="More actions">
          <MenuLink href="/export">Export CSV</MenuLink>
        </Menu>
      </div>,
    );
    const button = screen.getByLabelText("More actions");
    return { button, details: button.closest("details") as HTMLDetailsElement };
  }

  it("closes on Escape and returns focus to its button", async () => {
    const user = userEvent.setup();
    const { button, details } = renderMenu();
    await user.click(button);
    expect(details.open).toBe(true);
    screen.getByRole("link", { name: "Export CSV" }).focus();
    await user.keyboard("{Escape}");
    expect(details.open).toBe(false);
    expect(button).toHaveFocus();
  });

  it("closes on a click outside it", async () => {
    const user = userEvent.setup();
    const { button, details } = renderMenu();
    await user.click(button);
    await user.click(screen.getByText("Outside"));
    expect(details.open).toBe(false);
  });
});

describe("Toast", () => {
  function Trigger() {
    const toast = useToast();
    return <button onClick={() => toast.show({ title: "Reminder sent", meta: "10:14" })}>Send</button>;
  }

  it("announces through a polite region that is there from the start, and leaves after 6 seconds", () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <Trigger />
        </ToastProvider>,
      );
      const region = screen.getByRole("status");
      expect(region).toHaveAttribute("aria-live", "polite");
      expect(region).toBeEmptyDOMElement();
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      expect(region).toHaveTextContent("Reminder sent");
      act(() => vi.advanceTimersByTime(5900));
      expect(region).toHaveTextContent("Reminder sent");
      act(() => vi.advanceTimersByTime(200));
      expect(region).toBeEmptyDOMElement();
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits while the pointer is over it", () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <Trigger />
        </ToastProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      const toast = screen.getByText("Reminder sent").closest(".toast") as HTMLElement;
      fireEvent.mouseEnter(toast);
      act(() => vi.advanceTimersByTime(10_000));
      expect(screen.getByRole("status")).toHaveTextContent("Reminder sent");
      fireEvent.mouseLeave(toast);
      act(() => vi.advanceTimersByTime(6_000));
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    } finally {
      vi.useRealTimers();
    }
  });
});
