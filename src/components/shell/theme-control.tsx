"use client";

import { useId } from "react";
import { THEME_COOKIE, THEMES, type Theme } from "@/lib/theme";

const LABELS: Record<Theme, string> = { light: "Light", dark: "Dark", auto: "System" };

/** Applies the theme now and remembers it for server rendering. Runs only from a user's choice. */
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Appearance control (account menu and sign-in footer). Applies the choice at once and remembers it in a cookie,
 * which the root layout reads so the next page renders in the same theme without a flash.
 */
export function ThemeControl({ current }: { current: Theme }) {
  const name = useId();
  return (
    <fieldset className="fieldset">
      <legend className="fieldset__legend">Appearance</legend>
      <div className="segmented">
        {THEMES.map((theme) => (
          <label className="segmented__option" key={theme}>
            <input
              defaultChecked={theme === current}
              name={name}
              onChange={() => applyTheme(theme)}
              type="radio"
              value={theme}
            />
            <span>{LABELS[theme]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
