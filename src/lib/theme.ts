/** Appearance choices (tokens.css): "auto" follows the operating system. Light is the default. */
export const THEMES = ["light", "dark", "auto"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "theme";

export function parseTheme(value: string | undefined): Theme {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : "light";
}
