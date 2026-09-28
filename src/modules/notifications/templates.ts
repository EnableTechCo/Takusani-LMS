import { INSTITUTION } from "@/config/institution";
import { formatLongDayOf, formatTime, lastFullDayBefore } from "@/lib/dates";

/**
 * What each notification says (S2-10). The database stores the facts (payload) and the template version; the words
 * live here, so the in-app item and the email say the same thing. A change of wording that must not apply to
 * messages already queued gets a new template version, not an edit of this one.
 *
 * A result email names the item and the appeal closing day and links to the result, but never the outcome: that
 * stays behind sign-in (UX architecture, the release walkthrough).
 */

export interface Rendered {
  /** The in-app title and the email subject, for example "Your result for Task 3 is ready". */
  title: string;
  /** One line under the title, for example "You can appeal until the end of Tuesday 29 September 2026." */
  summary: string;
  /** The email's paragraphs, in order, before the link. */
  paragraphs: string[];
  /** The link's words. */
  action: string;
}

type Payload = Record<string, unknown>;

const text = (payload: Payload, key: string): string => {
  const value = payload[key];
  if (typeof value !== "string" || value === "") throw new Error(`notification payload is missing "${key}"`);
  return value;
};

function resultReleased(payload: Payload): Rendered {
  const item = text(payload, "item_title");
  const releasedAt = text(payload, "released_at");
  const lastDay = lastFullDayBefore(text(payload, "appeal_deadline_at"), "long");
  return {
    title: `Your result for ${item} is ready`,
    summary: `You can appeal until the end of ${lastDay}.`,
    paragraphs: [
      `Your result for ${item} (${text(payload, "cohort_name")}) was released on ${formatLongDayOf(releasedAt)} at ${formatTime(releasedAt)} (SAST).`,
      `Sign in to see your outcome, your marks and your assessor's feedback.`,
      `You can appeal this result until the end of ${lastDay}. The 7 days count from the day it was released, including weekends and public holidays.`,
    ],
    action: "See your result",
  };
}

function taskPublished(payload: Payload): Rendered {
  const title = text(payload, "title");
  const dueAt = text(payload, "due_at");
  const due = `${formatLongDayOf(dueAt)} at ${formatTime(dueAt)} (SAST)`;
  return {
    title: `New task: ${title}`,
    summary: `Due ${due}.`,
    paragraphs: [`A new task has been set for ${text(payload, "cohort_name")}: ${title}.`, `It is due ${due}.`],
    action: "Open the task",
  };
}

/** A facilitator's reminder about a task not yet handed in (FR-212): their message, and when it is or was due. */
function taskReminder(payload: Payload): Rendered {
  const title = text(payload, "title");
  const message = text(payload, "message");
  const dueAt = typeof payload.due_at === "string" ? payload.due_at : null;
  const due = dueAt
    ? new Date(dueAt).getTime() > Date.now()
      ? `It is due ${formatLongDayOf(dueAt)} at ${formatTime(dueAt)} (SAST).`
      : `It was due ${formatLongDayOf(dueAt)} at ${formatTime(dueAt)} (SAST).`
    : "";
  return {
    title: `Reminder: ${title}`,
    summary: message,
    paragraphs: [
      `A reminder about ${title} (${text(payload, "cohort_name")}), which you have not handed in yet.`,
      message,
      due,
    ].filter(Boolean),
    action: "Open the task",
  };
}

/** A coordinator's notice (FR-703): who sent it, its title, and the message itself. */
function notice(payload: Payload): Rendered {
  const body = text(payload, "body");
  const summary = body.length > 160 ? `${body.slice(0, 157).trimEnd()}...` : body;
  return {
    title: `Notice from ${text(payload, "sender_name")}: ${text(payload, "title")}`,
    summary,
    paragraphs: body
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    action: "Open your notifications",
  };
}

/** "2 hours", "1 hour 30 minutes", "45 minutes". */
export function durationText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const h = hours === 0 ? "" : hours === 1 ? "1 hour" : `${hours} hours`;
  const m = rest === 0 ? "" : rest === 1 ? "1 minute" : `${rest} minutes`;
  return [h, m].filter(Boolean).join(" ");
}

/** When and where, in one line: "Tuesday 29 September 2026 at 09:00 (SAST), 2 hours, online in Teams". */
function sessionWhen(payload: Payload): string {
  const startsAt = text(payload, "starts_at");
  const minutes = Number(payload.duration_minutes);
  const place = payload.mode === "online" ? "online in Teams" : `at ${text(payload, "venue")}`;
  return `${formatLongDayOf(startsAt)} at ${formatTime(startsAt)} (SAST), ${durationText(minutes)}, ${place}`;
}

function sessionScheduled(payload: Payload): Rendered {
  const title = text(payload, "title");
  const when = sessionWhen(payload);
  return {
    title: `New session: ${title}`,
    summary: `${when}.`,
    paragraphs: [`A session has been scheduled for ${text(payload, "cohort_name")}: ${title}.`, `It is on ${when}.`],
    action: "Open your calendar",
  };
}

function sessionChanged(payload: Payload): Rendered {
  const title = text(payload, "title");
  const when = sessionWhen(payload);
  return {
    title: `Session changed: ${title}`,
    summary: `Now ${when}.`,
    paragraphs: [`The time or place of ${title} has changed.`, `It is now on ${when}.`],
    action: "Open your calendar",
  };
}

function sessionCancelled(payload: Payload): Rendered {
  const title = text(payload, "title");
  const startsAt = text(payload, "starts_at");
  const reason = text(payload, "cancel_reason");
  return {
    title: `Session cancelled: ${title}`,
    summary: `It was on ${formatLongDayOf(startsAt)} at ${formatTime(startsAt)} (SAST). ${reason}`,
    paragraphs: [
      `${title}, on ${formatLongDayOf(startsAt)} at ${formatTime(startsAt)} (SAST), has been cancelled.`,
      `The reason given: ${reason}`,
    ],
    action: "Open your calendar",
  };
}

const APPEAL_ASKED: Record<string, string> = {
  view_script: "to see your work with the marks",
  remark: "for your work to be marked again",
};

/** The learner's receipt for an appeal (FR-604): the reference, when it was lodged, and the promised turnaround. */
function appealReceived(payload: Payload): Rendered {
  const reference = text(payload, "reference");
  const item = text(payload, "item_title");
  const lodgedAt = text(payload, "lodged_at");
  const days = Number(payload.turnaround_working_days);
  const within = days === 1 ? "within 1 working day" : `within ${days} working days`;
  return {
    title: `We have received your appeal ${reference}`,
    summary: `About ${item}. You should hear from us ${within}.`,
    paragraphs: [
      `We received your appeal ${reference} about ${item} on ${formatLongDayOf(lodgedAt)} at ${formatTime(lodgedAt)} (SAST). It was lodged in time.`,
      `You asked ${APPEAL_ASKED[text(payload, "type")]}. Your coordinator checks the appeal first. You should hear from us ${within}.`,
      `Keep the reference ${reference} in case you need to ask about your appeal.`,
    ],
    action: "See your appeal",
  };
}

/** A coordinator's alert that a learner in their cohort has lodged an appeal, which needs their check. */
function appealLodged(payload: Payload): Rendered {
  const reference = text(payload, "reference");
  const learner = text(payload, "learner_name");
  const item = text(payload, "item_title");
  const remark = text(payload, "type") === "remark";
  const asked = remark ? `for a re-mark of ${item}` : `to see the marked work for ${item}`;
  return {
    title: `New appeal ${reference} from ${learner}`,
    summary: `${learner} asked ${asked} (${text(payload, "cohort_name")}). It needs your check.`,
    paragraphs: [
      `${learner} lodged appeal ${reference} about ${item} (${text(payload, "cohort_name")}) on ${formatLongDayOf(text(payload, "lodged_at"))} at ${formatTime(text(payload, "lodged_at"))} (SAST).`,
      `They asked ${remark ? "for a re-mark" : "to see the marked work"}. The appeal needs your check before anything else happens.`,
    ],
    action: "Open the appeal",
  };
}

/** The appeal was accepted (FR-605): for a re-mark, a reviewer who did not mark the work marks it again. */
function appealAdmitted(payload: Payload): Rendered {
  const reference = text(payload, "reference");
  const item = text(payload, "item_title");
  if (text(payload, "type") === "view_script") {
    return {
      title: `Your request to see your marked work was accepted`,
      summary: `Appeal ${reference} about ${item}.`,
      paragraphs: [
        `Your request ${reference} to see your marked work for ${item} was accepted.`,
        `You will see your work next to the marks for each criterion and the assessor's feedback on your appeal's page. Seeing it does not give you more time to ask for a re-mark.`,
      ],
      action: "See your appeal",
    };
  }
  const days = Number(payload.turnaround_working_days);
  return {
    title: `Your appeal ${reference} was accepted`,
    summary: `A reviewer who did not mark your work will mark ${item} again.`,
    paragraphs: [
      `Your appeal ${reference} about ${item} was accepted.`,
      `A reviewer who did not mark your work will mark it again. The mark can stay the same, go up or go down. That decision is final.`,
      `You should hear from us within ${days === 1 ? "1 working day" : `${days} working days`} of lodging your appeal.`,
    ],
    action: "See your appeal",
  };
}

/** The appeal was not accepted (FR-605): the coordinator's reason, word for word. */
function appealInadmissible(payload: Payload): Rendered {
  const reference = text(payload, "reference");
  const reason = text(payload, "reason");
  return {
    title: `Your appeal ${reference} was not accepted`,
    summary: reason.length > 160 ? `${reason.slice(0, 157).trimEnd()}...` : reason,
    paragraphs: [
      `Your appeal ${reference} about ${text(payload, "item_title")} was checked and could not be accepted.`,
      `The reason given: ${reason}`,
      `If you have a question about this, ask your coordinator.`,
    ],
    action: "See your appeal",
  };
}

/** A reviewer has been allocated a re-mark (FR-608). Staff see the learner's name (UX Q7). */
function appealReviewAllocated(payload: Payload): Rendered {
  const reference = text(payload, "reference");
  const item = text(payload, "item_title");
  const learner = text(payload, "learner_name");
  return {
    title: `Appeal ${reference} to review: ${learner}`,
    summary: `A re-mark of ${item} (${text(payload, "cohort_name")}). Your decision is final.`,
    paragraphs: [
      `You have been allocated appeal ${reference}: ${learner} asked for ${item} (${text(payload, "cohort_name")}) to be marked again.`,
      `You took no assessment decision on this work, which is why you were chosen. Your decision is final and can move the mark up or down.`,
    ],
    action: "Open the review",
  };
}

const TEMPLATES: Record<string, Record<number, (payload: Payload) => Rendered>> = {
  appeal_admitted: { 1: appealAdmitted },
  appeal_inadmissible: { 1: appealInadmissible },
  appeal_review_allocated: { 1: appealReviewAllocated },
  appeal_received: { 1: appealReceived },
  appeal_lodged: { 1: appealLodged },
  result_released: { 1: resultReleased },
  task_published: { 1: taskPublished },
  task_reminder: { 1: taskReminder },
  notice: { 1: notice },
  session_scheduled: { 1: sessionScheduled },
  session_changed: { 1: sessionChanged },
  session_cancelled: { 1: sessionCancelled },
};

export function renderNotification(eventType: string, templateVersion: number, payload: Payload): Rendered {
  const template = TEMPLATES[eventType]?.[templateVersion];
  if (!template) throw new Error(`no template for ${eventType} version ${templateVersion}`);
  return template(payload);
}

export interface Email {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The email for one notification: plain text first, and a simple HTML copy of the same words. */
export function renderEmail(rendered: Rendered, { recipientName, url }: { recipientName: string; url: string }): Email {
  const greeting = `Hello ${recipientName},`;
  const signOff = INSTITUTION.name;
  const footer = "You are receiving this because you are enrolled. Times are South African time (SAST).";
  return {
    subject: rendered.title,
    text: [greeting, ...rendered.paragraphs, `${rendered.action}: ${url}`, signOff, footer].join("\n\n"),
    html: [
      `<p>${escapeHtml(greeting)}</p>`,
      ...rendered.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
      `<p><a href="${escapeHtml(url)}">${escapeHtml(rendered.action)}</a></p>`,
      `<p>${escapeHtml(signOff)}</p>`,
      `<p style="color:#6b6b6b;font-size:12px">${escapeHtml(footer)}</p>`,
    ].join("\n"),
  };
}
