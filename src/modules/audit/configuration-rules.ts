import { formatLongDayOf, formatTime } from "@/lib/dates";

/** Versioned configuration (S3-09; FR-108, FR-109, NFR-09): the words for values, versions and refusals. */

export interface Choice {
  value: string;
  label: string;
}

export interface SettingShape {
  value_type: string;
  unit_label: string | null;
  choices: Choice[] | null;
}

/** "7 days", "15%", "25 MB", or a choice's label. */
export function valueText(setting: SettingShape, value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (setting.value_type === "choice") {
    return setting.choices?.find((choice) => choice.value === value)?.label ?? String(value);
  }
  if (setting.unit_label === "%") return `${value}%`;
  return setting.unit_label ? `${value} ${setting.unit_label}` : String(value);
}

/**
 * When a version applies: "From the start" for the first values, "Start of Thursday 1 October 2026" for a change
 * dated to a day, or the day and time for an immediate change.
 */
export function effectiveText(iso: string | null): string {
  if (!iso) return "From the start";
  const time = formatTime(iso);
  return time === "00:00" ? `Start of ${formatLongDayOf(iso)}` : `${formatLongDayOf(iso)} at ${time} (SAST)`;
}

/** The same, inside a sentence: "from the start of Thursday 1 October 2026". */
export function fromText(iso: string | null): string {
  if (!iso) return "from the start";
  const time = formatTime(iso);
  return time === "00:00"
    ? `from the start of ${formatLongDayOf(iso)}`
    : `from ${formatLongDayOf(iso)} at ${time} (SAST)`;
}

export const VERSION_STATE_LABELS: Record<string, string> = {
  in_force: "In force",
  scheduled: "Scheduled",
  superseded: "Superseded",
  cancelled: "Cancelled before it took effect",
};

export const CONFIG_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was recorded.",
  forbidden: "Only an administrator changes configuration. Nothing was recorded.",
  not_found: "This setting does not exist.",
  invalid_value: "Enter a value in the allowed range.",
  invalid_date: "Choose today or a later day. A change cannot take effect in the past.",
  reason_required: "Enter the reason. Auditors read it, and a version cannot be recorded without one.",
  reason_too_long: "The reason is longer than 1000 characters. Shorten it and try again.",
  unchanged: "That is the value already in force. Nothing was recorded.",
  change_already_scheduled: "A change to this setting is already scheduled. Cancel it first to record a different one.",
  already_in_force: "That change has already taken effect, so it cannot be cancelled. Record a new value instead.",
  already_cancelled: "That change was already cancelled.",
  error: "The change could not be recorded. Try again.",
};

/** The allowed range, for the help text: "A whole number from 5 to 100." */
export function rangeText(min: number | null, max: number | null, unit: string | null): string {
  if (min === null || max === null) return "";
  return `A whole number from ${min} to ${max}${unit && unit !== "%" ? ` (${unit})` : ""}.`;
}
