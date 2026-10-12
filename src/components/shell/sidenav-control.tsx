"use client";

import { useId } from "react";
import { SIDENAV_COOKIE, SIDENAV_MODES, type SidenavMode } from "@/lib/sidenav";

const LABELS: Record<SidenavMode, string> = { collapsed: "Show on hover", pinned: "Always open" };

/** Applies the choice now and remembers it for server rendering. Runs only from a user's choice. */
function applyMode(mode: SidenavMode) {
  document.querySelector(".app-shell")?.setAttribute("data-sidenav", mode);
  document.cookie = `${SIDENAV_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Side menu control in the account menu, beside Appearance. Applies at once and remembers the choice in a cookie,
 * which the app layout reads so the next page renders the same way. Phones use the bottom tabs, so it has no effect
 * there.
 */
export function SidenavControl({ current }: { current: SidenavMode }) {
  const name = useId();
  return (
    <fieldset className="fieldset account__sidenav">
      <legend className="fieldset__legend">Side menu</legend>
      <div className="segmented">
        {SIDENAV_MODES.map((mode) => (
          <label className="segmented__option" key={mode}>
            <input
              defaultChecked={mode === current}
              name={name}
              onChange={() => applyMode(mode)}
              type="radio"
              value={mode}
            />
            <span>{LABELS[mode]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
