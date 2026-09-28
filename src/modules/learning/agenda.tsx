import { Icon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/link";
import { Tag } from "@/components/ui/status";
import { formatLongDayOf, formatTime, sastDaysFromToday } from "@/lib/dates";
import { durationText } from "@/modules/notifications/templates";
import { joinWindow } from "./sessions-rules";

/**
 * The learner's agenda (L-07, FR-305): sessions and due dates by South African day, soonest first. A session gives
 * its Teams link on the calendar itself; a cancelled one stays, marked, with the reason.
 */

export interface AgendaSession {
  kind: "session";
  id: string;
  at: string;
  title: string;
  durationMinutes: number;
  mode: string;
  teamsUrl: string | null;
  venue: string | null;
  state: string;
  cancelReason: string | null;
  facilitator: string;
}

export interface AgendaDue {
  kind: "due";
  id: string;
  at: string;
  title: string;
  handedIn: boolean;
}

export type AgendaItem = AgendaSession | AgendaDue;

function dayHeading(iso: string, now: Date): string {
  const day = formatLongDayOf(iso);
  const offset = sastDaysFromToday(iso, now);
  return offset === 0 ? `Today, ${day}` : offset === 1 ? `Tomorrow, ${day}` : day;
}

function SessionMeta({ item, now }: { item: AgendaSession; now: Date }) {
  if (item.state === "cancelled") {
    return (
      <span className="agenda__meta">
        <Tag tone="caution">Cancelled</Tag>
        <span>{item.cancelReason}</span>
      </span>
    );
  }
  const place = item.mode === "online" ? "online" : item.venue;
  const window = joinWindow(item.at, item.durationMinutes, now);
  return (
    <span className="agenda__meta">
      <span>
        {item.facilitator} · {durationText(item.durationMinutes)} · {place}
      </span>
      {item.mode === "online" && item.teamsUrl ? (
        <>
          <a className="link link--standalone" href={item.teamsUrl} rel="noopener noreferrer" target="_blank">
            <Icon className="icon icon--sm" name="video" />
            Join in Teams<span className="u-visually-hidden"> (opens Microsoft Teams)</span>
          </a>
          {window.state === "early" ? <span>You can join from {formatTime(window.opensAt.toISOString())}.</span> : null}
          {window.state === "open" ? <Tag tone="positive">On now</Tag> : null}
        </>
      ) : null}
    </span>
  );
}

export function Agenda({ items, now, label }: { items: AgendaItem[]; now: Date; label: string }) {
  const days: { heading: string; items: AgendaItem[] }[] = [];
  for (const item of [...items].sort((a, b) => a.at.localeCompare(b.at))) {
    const heading = dayHeading(item.at, now);
    const last = days[days.length - 1];
    if (last?.heading === heading) last.items.push(item);
    else days.push({ heading, items: [item] });
  }
  return (
    <div aria-label={label} className="agenda" role="region">
      {days.map((day, index) => (
        <section aria-labelledby={`${label.replace(/\W+/g, "-")}-${index}`} key={day.heading}>
          <h3 className="agenda__day-title" id={`${label.replace(/\W+/g, "-")}-${index}`}>
            {day.heading}
          </h3>
          {day.items.map((item) =>
            item.kind === "session" ? (
              <div className="agenda__item" id={`session-${item.id}`} key={`s-${item.id}`}>
                <span className="agenda__time">{formatTime(item.at)}</span>
                <span className="agenda__title">{item.state === "cancelled" ? <s>{item.title}</s> : item.title}</span>
                <SessionMeta item={item} now={now} />
              </div>
            ) : (
              <div className="agenda__item" key={`d-${item.id}`}>
                <span className="agenda__time">{formatTime(item.at)}</span>
                <span className="agenda__title">
                  <TextLink href={`/learn/tasks/${item.id}`}>{item.title}</TextLink> is due
                </span>
                <span className="agenda__meta">
                  {item.handedIn ? (
                    <Tag shape="check" tone="positive">
                      Handed in
                    </Tag>
                  ) : (
                    <Tag>Not handed in yet</Tag>
                  )}
                </span>
              </div>
            ),
          )}
        </section>
      ))}
    </div>
  );
}

/** The learner's sessions and task due dates as agenda items. */
export function agendaItems(
  sessions: {
    id: string;
    title: string;
    starts_at: string;
    duration_minutes: number;
    mode: string;
    teams_url: string | null;
    venue: string | null;
    state: string;
    cancel_reason: string | null;
    facilitator_name: string;
  }[],
  tasks: { id: string; title: string; due_at: string | null; latest_version: number | null }[],
  now: Date,
): AgendaItem[] {
  return [
    ...sessions.map((session): AgendaSession => ({
      kind: "session",
      id: session.id,
      at: session.starts_at,
      title: session.title,
      durationMinutes: session.duration_minutes,
      mode: session.mode,
      teamsUrl: session.teams_url,
      venue: session.venue,
      state: session.state,
      cancelReason: session.cancel_reason,
      facilitator: session.facilitator_name,
    })),
    ...tasks
      .filter((task) => task.due_at && new Date(task.due_at).getTime() > now.getTime())
      .map((task): AgendaDue => ({
        kind: "due",
        id: task.id,
        at: task.due_at!,
        title: task.title,
        handedIn: task.latest_version !== null,
      })),
  ];
}
