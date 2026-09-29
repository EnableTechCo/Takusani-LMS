// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/components/ui/test-dom";
import { ACTIVITY_KEY, SIGNED_OUT_KEY } from "@/modules/identity/idle";
import { IdleSignOut } from "./idle-sign-out";

const MINUTE = 60 * 1000;
const START = new Date("2026-10-12T08:00:00Z");
const assign = vi.fn();
const realLocation = window.location;

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(START);
  window.localStorage.clear();
  assign.mockReset();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...realLocation, assign, pathname: "/assess/instances/abc", search: "" },
  });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
});

describe("IdleSignOut (A11Y-07)", () => {
  it("asks two minutes before the limit, with Stay signed in focused", () => {
    render(<button type="button">Save draft</button>);
    render(<IdleSignOut idleMinutes={30} />);
    screen.getByRole("button", { name: "Save draft" }).focus();

    advance(28 * MINUTE - 1000);
    expect(screen.queryByRole("alertdialog")).toBeNull();

    advance(1000);
    const dialog = screen.getByRole("alertdialog", { name: "Do you want to stay signed in?" });
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAccessibleDescription(
      "You have not done anything for a while, so you will be signed out in 2 minutes. Your saved work is kept.",
    );
    expect(screen.getByRole("button", { name: "Stay signed in" })).toHaveFocus();
  });

  it("stays signed in when asked, returns focus, and can be asked again", () => {
    render(<button type="button">Save draft</button>);
    render(<IdleSignOut idleMinutes={30} />);
    screen.getByRole("button", { name: "Save draft" }).focus();

    for (let round = 0; round < 3; round += 1) {
      advance(28 * MINUTE);
      fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(screen.getByRole("button", { name: "Save draft" })).toHaveFocus();
    }
    expect(assign).not.toHaveBeenCalled();
  });

  it("treats Escape as staying signed in", () => {
    render(<IdleSignOut idleMinutes={30} />);
    advance(28 * MINUTE);
    const dialog = screen.getByRole("alertdialog");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("does not let a stray key dismiss the question once asked", () => {
    render(<IdleSignOut idleMinutes={30} />);
    advance(28 * MINUTE);
    fireEvent.keyDown(window, { key: "a" });
    advance(1000);
    expect(screen.getByRole("alertdialog")).toHaveAttribute("open");
  });

  it("signs out at the limit, says why, returns to the same page, and tells the other tabs", () => {
    render(<IdleSignOut idleMinutes={30} />);
    advance(30 * MINUTE);
    expect(assign).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith("/auth/sign-out?reason=idle&next=%2Fassess%2Finstances%2Fabc");
    expect(window.localStorage.getItem(SIGNED_OUT_KEY)).not.toBeNull();
  });

  it("counts activity in this tab", () => {
    render(<IdleSignOut idleMinutes={30} />);
    advance(20 * MINUTE);
    fireEvent.keyDown(window, { key: "a" });
    advance(20 * MINUTE);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it("counts activity in another tab, and closes the question when another tab stays signed in", () => {
    render(<IdleSignOut idleMinutes={30} />);
    advance(28 * MINUTE);
    expect(screen.getByRole("alertdialog")).toHaveAttribute("open");
    window.localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    advance(1000);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("follows another tab that signed out", () => {
    render(<IdleSignOut idleMinutes={30} />);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: SIGNED_OUT_KEY, newValue: "1" }));
    });
    expect(assign).toHaveBeenCalledOnce();
  });

  it("does nothing without a limit", () => {
    const { container } = render(<IdleSignOut idleMinutes={0} />);
    advance(600 * MINUTE);
    expect(container).toBeEmptyDOMElement();
    expect(assign).not.toHaveBeenCalled();
  });
});
