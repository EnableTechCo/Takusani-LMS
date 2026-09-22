import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Shared set-up for component tests that run in jsdom (each such file starts with `// @vitest-environment jsdom`).
 * jsdom has no <dialog> behaviour, so showModal and close are stubbed to toggle the `open` attribute, which is all the
 * components rely on; the browser's own behaviour is checked in the gallery (/components).
 */
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

afterEach(() => cleanup());
