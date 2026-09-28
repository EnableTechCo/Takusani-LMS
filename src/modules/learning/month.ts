/**
 * The month grid of the learner's calendar (L-07, FR-304): weeks from Monday, days in South African time, and each
 * day's sessions and due dates. South Africa keeps one offset all year, so a month's bounds are fixed instants.
 */

const ZONE = "Africa/Johannesburg";

/** "2026-10" for an instant, in SAST. */
export function sastMonthOf(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit" }).format(date);
}

/** "2026-10-05" for an instant, in SAST. */
export function sastDateOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date(iso));
}

/** A valid "YYYY-MM", or null. */
export function parseMonth(value: string | undefined): string | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100 ? value : null;
}

/** The month before or after. */
export function shiftMonth(month: string, by: number): string {
  const [year, index] = [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + by];
  const shifted = new Date(Date.UTC(year, index, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The first instant of the month, in SAST. */
export function monthStart(month: string): Date {
  return new Date(`${month}-01T00:00:00+02:00`);
}

/** "October 2026". */
export function monthTitle(month: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
}

export interface GridDay<Item> {
  date: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  items: Item[];
}

/** Whole weeks, Monday to Sunday, covering the month; each day with its items, earliest first. */
export function monthGrid<Item extends { at: string }>(month: string, items: Item[], today: string): GridDay<Item>[] {
  const first = new Date(`${month}-01T12:00:00Z`);
  const lead = (first.getUTCDay() + 6) % 7; // days before the 1st back to Monday
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;

  const byDate = new Map<string, Item[]>();
  for (const item of [...items].sort((a, b) => a.at.localeCompare(b.at))) {
    const date = sastDateOf(item.at);
    byDate.set(date, [...(byDate.get(date) ?? []), item]);
  }

  return Array.from({ length: cells }, (_, index) => {
    const date = new Date(first.getTime() + (index - lead) * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      day: date.getUTCDate(),
      inMonth: key.slice(0, 7) === month,
      today: key === today,
      items: byDate.get(key) ?? [],
    };
  });
}
