// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "./test-dom";
import { OfflineBanner } from "./offline-banner";

afterEach(() => vi.restoreAllMocks());

function goOffline(offline: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(!offline);
  act(() => {
    window.dispatchEvent(new Event(offline ? "offline" : "online"));
  });
}

describe("OfflineBanner", () => {
  it("shows nothing while online, and an alert saying how old the page is when the connection drops", () => {
    const renderedAt = new Date(Date.now() - 60_000).toISOString();
    render(<OfflineBanner renderedAt={renderedAt} />);
    expect(screen.queryByRole("alert")).toBeNull();

    goOffline(true);
    expect(screen.getByRole("alert")).toHaveTextContent("No connection");
    expect(screen.getByRole("alert")).toHaveTextContent("You are seeing this page as it was at");

    goOffline(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
