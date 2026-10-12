// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/components/ui/test-dom";
import { parseSidenavMode } from "@/lib/sidenav";
import { HistoryButtons } from "./history-buttons";
import { SidenavControl } from "./sidenav-control";

const back = vi.fn();
const forward = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back, forward }) }));

/** A stand-in for the browser's Navigation API: an event target with canGoBack and canGoForward. */
class FakeNavigation extends EventTarget {
  canGoBack = false;
  canGoForward = false;
  /** Moves, then lets the buttons read the change on the next task, as they do in the browser. */
  move(canGoBack: boolean, canGoForward: boolean) {
    this.canGoBack = canGoBack;
    this.canGoForward = canGoForward;
    this.dispatchEvent(new Event("currententrychange"));
    vi.runAllTimers();
  }
}

let navigation: FakeNavigation;

beforeEach(() => {
  vi.useFakeTimers();
  back.mockReset();
  forward.mockReset();
  navigation = new FakeNavigation();
  Object.defineProperty(window, "navigation", { configurable: true, value: navigation });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, "navigation");
  document.cookie = "sidenav=; max-age=0; path=/";
});

describe("HistoryButtons", () => {
  it("are disabled when there is nowhere to go, and follow the browser's history as it moves", () => {
    render(<HistoryButtons />);
    const backButton = screen.getByRole("button", { name: "Back" });
    const forwardButton = screen.getByRole("button", { name: "Forward" });
    expect(backButton).toHaveProperty("disabled", true);
    expect(forwardButton).toHaveProperty("disabled", true);

    act(() => navigation.move(true, false));
    expect(backButton).toHaveProperty("disabled", false);
    expect(forwardButton).toHaveProperty("disabled", true);

    act(() => navigation.move(true, true));
    expect(forwardButton).toHaveProperty("disabled", false);
  });

  it("go back and forward through the router", () => {
    navigation.canGoBack = true;
    navigation.canGoForward = true;
    render(<HistoryButtons />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(forward).toHaveBeenCalledTimes(1);
  });

  it("without the Navigation API, offer Back when the tab has history", () => {
    Reflect.deleteProperty(window, "navigation");
    window.history.pushState({}, "", "/learn/tasks");
    render(<HistoryButtons />);
    expect(screen.getByRole("button", { name: "Back" })).toHaveProperty("disabled", false);
  });
});

describe("Side menu preference", () => {
  it("is collapsed unless the person pinned it", () => {
    expect(parseSidenavMode(undefined)).toBe("collapsed");
    expect(parseSidenavMode("nonsense")).toBe("collapsed");
    expect(parseSidenavMode("pinned")).toBe("pinned");
  });

  it("applies a choice to the shell at once and remembers it", () => {
    render(
      <div className="app-shell" data-sidenav="collapsed">
        <SidenavControl current="collapsed" />
      </div>,
    );
    expect(screen.getByRole("radio", { name: "Show on hover" })).toHaveProperty("checked", true);
    fireEvent.click(screen.getByRole("radio", { name: "Always open" }));
    expect(document.querySelector(".app-shell")?.getAttribute("data-sidenav")).toBe("pinned");
    expect(document.cookie).toContain("sidenav=pinned");
  });
});
