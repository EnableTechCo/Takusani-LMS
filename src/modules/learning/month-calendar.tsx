import Link from "next/link";
import { ButtonLink } from "@/components/ui/link";
import { formatTime } from "@/lib/dates";
import type { AgendaItem } from "./agenda";
import { monthGrid, monthTitle, shiftMonth } from "./month";

/**
 * L-07 month grid (design system 14): for orientation. Each event says what it is in words as well as by shape and
 * colour; below 768px only its marker shows, and the agenda beside it carries the detail.
 */
export function MonthCalendar({ month, items, today }: { month: string; items: AgendaItem[]; today: string }) {
  const title = monthTitle(month);
  const days = monthGrid(month, items, today);
  return (
    <div className="calendar">
      <div className="calendar__toolbar">
        <h2 className="calendar__month">{title}</h2>
        <nav aria-label="Months" className="cluster">
          <ButtonLink href={`/learn/calendar?month=${shiftMonth(month, -1)}`} icon="caret-left" variant="ghost">
            <span className="u-visually-hidden">Previous month</span>
          </ButtonLink>
          <ButtonLink href="/learn/calendar" variant="secondary">
            Today
          </ButtonLink>
          <ButtonLink href={`/learn/calendar?month=${shiftMonth(month, 1)}`} icon="caret-right" variant="ghost">
            <span className="u-visually-hidden">Next month</span>
          </ButtonLink>
        </nav>
      </div>
      <div className="calendar__grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday) => (
          <div aria-hidden="true" className="calendar__weekday" key={weekday}>
            {weekday}
          </div>
        ))}
      </div>
      <div aria-label={title} className="calendar__grid" role="list">
        {days.map((day) => (
          <div
            className={[
              "calendar__day",
              day.inMonth ? null : "calendar__day--outside",
              day.today ? "calendar__day--today" : null,
            ]
              .filter(Boolean)
              .join(" ")}
            key={day.date}
            role="listitem"
          >
            <span className="calendar__date">
              {day.today ? <span className="u-visually-hidden">Today, </span> : null}
              {day.day}
            </span>
            {day.items.map((item) =>
              item.kind === "due" ? (
                <Link
                  className="calendar__event calendar__event--due"
                  href={`/learn/tasks/${item.id}`}
                  key={`d-${item.id}`}
                >
                  <span className="u-visually-hidden">Due: </span>
                  <span className="calendar__event-text">
                    {formatTime(item.at)} {item.title}
                  </span>
                </Link>
              ) : (
                <span className="calendar__event calendar__event--session" key={`s-${item.id}`}>
                  <span className="u-visually-hidden">
                    {item.state === "cancelled" ? "Cancelled session: " : "Session: "}
                  </span>
                  <span className="calendar__event-text">
                    {item.state === "cancelled" ? <s>{item.title}</s> : `${formatTime(item.at)} ${item.title}`}
                  </span>
                </span>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
