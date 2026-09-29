import { INSTITUTION } from "@/config/institution";
import { appealWindowDaysOf, formatLongDayOf, formatTime, lastFullDayBefore } from "@/lib/dates";

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
      `You can appeal this result until the end of ${lastDay}. The ${appealWindowDaysOf(releasedAt, text(payload, "appeal_deadline_at"))} days count from the day it was released, including weekends and public holidays.`,
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

/** Version 2 of taskPublished: an assignment, in the words people read (never edit version 1: messages were queued with it). */
function assignmentPublished(payload: Payload): Rendered {
  const title = text(payload, "title");
  const dueAt = text(payload, "due_at");
  const due = `${formatLongDayOf(dueAt)} at ${formatTime(dueAt)} (SAST)`;
  return {
    title: `New assignment: ${title}`,
    summary: `Due ${due}.`,
    paragraphs: [`A new assignment has been set for ${text(payload, "cohort_name")}: ${title}.`, `It is due ${due}.`],
    action: "Open the assignment",
  };
}

/** Version 2 of taskReminder: the same reminder, with the assignment named as one. */
function assignmentReminder(payload: Payload): Rendered {
  const rendered = taskReminder(payload);
  return { ...rendered, action: "Open the assignment" };
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

const CATEGORY_WORDS: Record<string, string> = {
  upheld: "Mark upheld",
  amended_up: "Mark changed: higher",
  amended_down: "Mark changed: lower",
};

const STAFF_CATEGORY_WORDS: Record<string, string> = {
  upheld: "Upheld",
  amended_up: "Amended upward",
  amended_down: "Amended downward",
};

/** The learner's appeal has been decided (FR-611). The outcome and reasons are behind sign-in; the reviewer is not named. */
function appealDecided(payload: Payload): Rendered {
  const reference = text(payload, "reference");
  const item = text(payload, "item_title");
  return {
    title: `Your appeal ${reference} has been decided`,
    summary: `${CATEGORY_WORDS[text(payload, "category")]}. The decision is final.`,
    paragraphs: [
      `A reviewer who did not mark your work has decided your appeal ${reference} about ${item}.`,
      `Sign in to see the outcome and the reviewer's reasons. This decision is final; there is no further appeal.`,
    ],
    action: "See the decision",
  };
}

/** Staff: an appeal they assessed or coordinate has been decided (FR-611). */
function appealConcluded(payload: Payload): Rendered {
  const reference = text(payload, "reference");
  const learner = text(payload, "learner_name");
  const item = text(payload, "item_title");
  const outcome = text(payload, "outcome") === "competent" ? "Competent" : "Not yet competent";
  const category = STAFF_CATEGORY_WORDS[text(payload, "category")];
  return {
    title: `Appeal ${reference} decided: ${category.toLowerCase()}`,
    summary: `${learner}, ${item} (${text(payload, "cohort_name")}): ${outcome}. Decided by ${text(payload, "reviewer_name")}.`,
    paragraphs: [
      `${text(payload, "reviewer_name")} has decided appeal ${reference}: ${learner}, ${item} (${text(payload, "cohort_name")}).`,
      `The outcome is now ${outcome} (${category.toLowerCase()}). It is released to the learner and is final. The earlier decision stays on record.`,
    ],
    action: "Open the appeal",
  };
}

/** New sign-ins to the account are paused after wrong passwords (FR-106, ADR-026). Nothing current is stopped. */
function signInLocked(payload: Payload): Rendered {
  const until = text(payload, "locked_until");
  const failures = Number(payload.failures);
  return {
    title: "Sign-in to your account is paused",
    summary: `After ${failures} wrong passwords, new sign-ins are paused until ${formatTime(until)} (SAST).`,
    paragraphs: [
      `Someone, perhaps you, entered the wrong password for your account ${failures} times. To protect it, new sign-ins are paused until ${formatLongDayOf(until)} at ${formatTime(until)} (SAST).`,
      `If you are already signed in, carry on: nothing you are doing is stopped, including an exam.`,
      `To sign in sooner, choose "Forgot your password?" on the sign-in page and set a new password. If this was not you, reset your password and tell your administrator.`,
    ],
    action: "Open your account",
  };
}

/** An administrator unlocked the account (FR-106). */
function signInUnlocked(payload: Payload): Rendered {
  const at = text(payload, "unlocked_at");
  return {
    title: "Sign-in to your account is open again",
    summary: `An administrator unlocked it on ${formatLongDayOf(at)} at ${formatTime(at)} (SAST).`,
    paragraphs: [
      `An administrator unlocked sign-in to your account on ${formatLongDayOf(at)} at ${formatTime(at)} (SAST). You can sign in again.`,
      `If you did not ask for this, tell your administrator.`,
    ],
    action: "Open your account",
  };
}

/** FR-106: an administrator sent a link to set a new password. */
function passwordResetSent(payload: Payload): Rendered {
  const at = text(payload, "sent_at");
  return {
    title: "An administrator sent you a password reset link",
    summary: `Sent on ${formatLongDayOf(at)} at ${formatTime(at)} (SAST). The link is in your email.`,
    paragraphs: [
      `An administrator sent you a link to set a new password, on ${formatLongDayOf(at)} at ${formatTime(at)} (SAST). Look for it in your email; it works once and expires in one hour.`,
      `If you did not ask for this, you can ignore the link and keep your password, and tell your administrator.`,
    ],
    action: "Open your account",
  };
}

/** The account was deactivated: an email-only message in practice, since the person can no longer sign in. */
function accountDeactivated(payload: Payload): Rendered {
  const at = text(payload, "deactivated_at");
  return {
    title: "Your account has been deactivated",
    summary: `Deactivated on ${formatLongDayOf(at)}. You can no longer sign in.`,
    paragraphs: [
      `An administrator deactivated your account on ${formatLongDayOf(at)} at ${formatTime(at)} (SAST). You can no longer sign in, and any session you had open has ended.`,
      `If you think this is a mistake, contact your administrator.`,
    ],
    action: "Go to the sign-in page",
  };
}

function accountReactivated(payload: Payload): Rendered {
  const at = text(payload, "reactivated_at");
  return {
    title: "Your account is active again",
    summary: `Reactivated on ${formatLongDayOf(at)}. You can sign in again.`,
    paragraphs: [
      `An administrator reactivated your account on ${formatLongDayOf(at)} at ${formatTime(at)} (SAST). You can sign in again.`,
    ],
    action: "Sign in",
  };
}

const ROLE_NAMES: Record<string, string> = {
  learner: "learner",
  facilitator: "facilitator",
  assessor: "assessor",
  moderator: "moderator",
  coordinator: "coordinator",
  administrator: "administrator",
};

/** FR-104: a role was given to the person (S3-07; also from a cohort's People page, S4-03). */
function roleAssigned(payload: Payload): Rendered {
  const role = ROLE_NAMES[text(payload, "role")] ?? text(payload, "role");
  const scope = text(payload, "scope_label");
  const until = typeof payload.until === "string" && payload.until ? payload.until : null;
  return {
    title: `You are now ${/^[aeiou]/.test(role) ? "an" : "a"} ${role}: ${scope}`,
    summary: until ? `Until the end of ${lastFullDayBefore(until, "long")}.` : "From now, with no end date.",
    paragraphs: [
      `You have been given the ${role} role for ${scope}${until ? `, until the end of ${lastFullDayBefore(until, "long")}` : ""}. What you can do in the LMS has changed to match.`,
    ],
    action: "Open the LMS",
  };
}

/** FR-104: a role of the person's ended. */
function roleEnded(payload: Payload): Rendered {
  const role = ROLE_NAMES[text(payload, "role")] ?? text(payload, "role");
  const scope = text(payload, "scope_label");
  const at = text(payload, "ended_at");
  return {
    title: `Your ${role} role has ended: ${scope}`,
    summary: `Ended on ${formatLongDayOf(at)}.`,
    paragraphs: [`Your ${role} role for ${scope} ended on ${formatLongDayOf(at)} at ${formatTime(at)} (SAST).`],
    action: "Open the LMS",
  };
}

/** F-06: a series of sessions, told once: how many, how often, from when to when (S6-series). */
const RHYTHMS: Record<string, string> = {
  daily: "every day",
  weekly: "every week",
  fortnightly: "every two weeks",
  monthly: "every month",
};

function sessionSeriesScheduled(payload: Payload): Rendered {
  const title = text(payload, "title");
  const count = typeof payload.count === "number" ? String(payload.count) : text(payload, "count");
  const rhythm = RHYTHMS[text(payload, "repeat")] ?? "every week";
  const first = text(payload, "starts_at");
  const last = text(payload, "last_starts_at");
  const span = `from ${formatLongDayOf(first)} to ${formatLongDayOf(last)}, each at ${formatTime(first)} (SAST)`;
  return {
    title: `New sessions: ${title}`,
    summary: `${count} sessions, ${rhythm} ${span}.`,
    paragraphs: [
      `${count} sessions have been scheduled for ${text(payload, "cohort_name")}: ${title}.`,
      `One ${rhythm}, ${span}${text(payload, "mode") === "online" ? ", online in Teams" : ""}.`,
    ],
    action: "Open your calendar",
  };
}

/** The rest of a series changed together: the new time or place of the first, and how many follow it. */
function sessionSeriesChanged(payload: Payload): Rendered {
  const title = text(payload, "title");
  const count = typeof payload.count === "number" ? String(payload.count) : text(payload, "count");
  const rhythm = RHYTHMS[text(payload, "repeat")] ?? "every week";
  const when = sessionWhen(payload);
  return {
    title: `Sessions changed: ${title}`,
    summary: `${count} sessions, now from ${when}.`,
    paragraphs: [
      `The time or place of ${count} sessions of ${title} (${text(payload, "cohort_name")}) has changed.`,
      `The first is now on ${when}; the others follow ${rhythm} at the same time.`,
    ],
    action: "Open your calendar",
  };
}

/** The rest of a series cancelled together, with the reason. */
function sessionSeriesCancelled(payload: Payload): Rendered {
  const title = text(payload, "title");
  const count = typeof payload.count === "number" ? String(payload.count) : text(payload, "count");
  const from = text(payload, "starts_at");
  return {
    title: `Sessions cancelled: ${title}`,
    summary: `${count} sessions from ${formatLongDayOf(from)} are cancelled.`,
    paragraphs: [
      `${count} sessions of ${title} (${text(payload, "cohort_name")}) are cancelled, from ${formatLongDayOf(from)} at ${formatTime(from)} (SAST).`,
      `The reason given: "${text(payload, "cancel_reason")}"`,
      "They stay on your calendar, marked cancelled.",
    ],
    action: "Open your calendar",
  };
}

const READINESS_ITEM_NAMES: Record<string, string> = {
  moderation_policy: "confirm the moderation policy",
  learners: "enrol the learners",
  facilitator: "assign a facilitator",
  assessor: "assign an assessor",
  moderator: "assign a moderator",
  materials: "publish the learning material",
  published_tasks: "publish a task",
  sessions: "schedule a session",
  logistics: "confirm the logistics",
};

/** Version 2 names the assignment as one; version 1 keeps its words for messages already queued. */
const READINESS_ITEM_NAMES_V2: Record<string, string> = {
  ...READINESS_ITEM_NAMES,
  published_tasks: "publish an assignment",
  logistics: "arrange the logistics",
};

/** FR-702: a coordinator assigned an open readiness item to the person (S4-03). */
function readinessItemAssigned(payload: Payload, names = READINESS_ITEM_NAMES): Rendered {
  const cohort = text(payload, "cohort_name");
  const item = names[text(payload, "item_key")] ?? "a readiness item";
  const due = typeof payload.due_on === "string" && payload.due_on ? payload.due_on : null;
  const note = typeof payload.note === "string" && payload.note ? payload.note : null;
  const by =
    typeof payload.assigned_by_name === "string" && payload.assigned_by_name
      ? payload.assigned_by_name
      : "A coordinator";
  const dueText = due ? `by ${formatLongDayOf(`${due}T12:00:00+02:00`)}` : null;
  return {
    title: `${cohort}: please ${item}`,
    summary: dueText ? `Due ${dueText}.` : `${by} asked you to.`,
    paragraphs: [
      `${by} asked you to ${item} for ${cohort}${dueText ? `, ${dueText}` : ""}, so the cohort is ready.`,
      ...(note ? [`Their note: "${note}"`] : []),
    ],
    action: "Open it in the LMS",
  };
}

/** A moderator's allocations in a frozen cycle, told once (S4-07, FR-504). */
function moderationItemsAllocated(payload: Payload): Rendered {
  const cycle = text(payload, "cycle_name");
  const count = typeof payload.count === "number" ? payload.count : Number(text(payload, "count"));
  const items = `${count} ${count === 1 ? "item" : "items"}`;
  return {
    title: `${items} to moderate: ${cycle}`,
    summary: `${text(payload, "cohort_name")}. The cycle is signed off once every item is concluded.`,
    paragraphs: [
      `The cycle "${cycle}" (${text(payload, "cohort_name")}) is frozen and sampled, and ${items} ${count === 1 ? "is" : "are"} yours to review.`,
      "You were given no item you assessed. Record a finding on each: agree, or disagree with reasons.",
    ],
    action: "Open the cycle",
  };
}

/** One item moved to a moderator by the coordinator (S4-07, FR-504). */
function moderationItemReallocated(payload: Payload): Rendered {
  const cycle = text(payload, "cycle_name");
  const item = text(payload, "item_title");
  return {
    title: `An item to moderate: ${item}`,
    summary: `Reallocated to you in "${cycle}" (${text(payload, "cohort_name")}).`,
    paragraphs: [
      `The coordinator reallocated a sampled ${item} in "${cycle}" (${text(payload, "cohort_name")}) to you.`,
      "You took no assessment decision on it, which is why it could come to you.",
    ],
    action: "Open the item",
  };
}

/** An assessor's item returned by a moderator, with the corrections and the deadline (S4-08, FR-509). */
function moderationItemReturned(payload: Payload): Rendered {
  const item = text(payload, "item_title");
  const learner = text(payload, "learner_name");
  const due = formatLongDayOf(`${text(payload, "due_on")}T12:00:00+02:00`);
  return {
    title: `Returned for re-marking: ${learner}, ${item}`,
    summary: `Due ${due}. ${text(payload, "moderator_name")} has set out what to correct.`,
    paragraphs: [
      `${text(payload, "moderator_name")}, moderating "${text(payload, "cycle_name")}" (${text(payload, "cohort_name")}), returned your decision on ${item} for ${learner}. Re-mark it by ${due}.`,
      `Required corrections: ${text(payload, "corrections")}`,
      "Your re-mark is a new decision; the original stays on record. The result stays held until the cycle is signed off.",
    ],
    action: "Open the item",
  };
}

/** A coordinator's note that a moderator returned an item in a cycle of theirs (S4-08, FR-509). */
function moderationReturnLogged(payload: Payload): Rendered {
  const item = text(payload, "item_title");
  const due = formatLongDayOf(`${text(payload, "due_on")}T12:00:00+02:00`);
  return {
    title: `An item was returned for re-marking: ${text(payload, "cycle_name")}`,
    summary: `${text(payload, "learner_name")}, ${item}. Due ${due}.`,
    paragraphs: [
      `${text(payload, "moderator_name")} returned ${item} for ${text(payload, "learner_name")} to its assessor in "${text(payload, "cycle_name")}" (${text(payload, "cohort_name")}), due ${due}.`,
      "The cycle cannot be signed off until the item is re-marked and reviewed again.",
    ],
    action: "Open the cycle",
  };
}

/** A moderator's returned item, re-marked and back for review (S4-08, FR-509). */
function moderationItemRemarked(payload: Payload): Rendered {
  const item = text(payload, "item_title");
  return {
    title: `Re-marked, review again: ${text(payload, "learner_name")}, ${item}`,
    summary: `"${text(payload, "cycle_name")}" (${text(payload, "cohort_name")}).`,
    paragraphs: [
      `The assessor re-marked ${item} for ${text(payload, "learner_name")} after your return. The revised decision is ready for your review; the original stays on record beside it.`,
    ],
    action: "Review the item",
  };
}

/** A coordinator's note that a cycle of theirs was signed off and its population released (S4-09, FR-511). */
function moderationCycleSignedOff(payload: Payload): Rendered {
  const released = typeof payload.released === "number" ? payload.released : Number(text(payload, "released"));
  const results = `${released} ${released === 1 ? "result" : "results"}`;
  const at = text(payload, "signed_off_at");
  return {
    title: `Signed off: ${text(payload, "cycle_name")}. ${results} released`,
    summary: `${text(payload, "cohort_name")}. Signed off by ${text(payload, "signed_off_by")} on ${formatLongDayOf(at)} at ${formatTime(at)} (SAST).`,
    paragraphs: [
      `${text(payload, "signed_off_by")} signed off "${text(payload, "cycle_name")}" (${text(payload, "cohort_name")}) on ${formatLongDayOf(at)} at ${formatTime(at)} (SAST). ${results} in its frozen population ${released === 1 ? "was" : "were"} released to learners, each told in the LMS.`,
      "Decisions finalised after the freeze were not released; they wait in the pending pool for the next cycle.",
    ],
    action: "Open the cycle",
  };
}

/** A coordinator's alert that a stakeholder query was routed to them (S6-03, FR-704). */
function queryAssigned(payload: Payload): Rendered {
  const reference = text(payload, "reference");
  const subject = text(payload, "subject");
  const about = [payload.programme_title, payload.cohort_name]
    .filter((part) => typeof part === "string" && part)
    .join(", ");
  const due = typeof payload.due_on === "string" && payload.due_on ? payload.due_on : null;
  const note = typeof payload.note === "string" && payload.note ? payload.note : null;
  const by =
    typeof payload.assigned_by_name === "string" && payload.assigned_by_name
      ? payload.assigned_by_name
      : "A coordinator";
  const dueText = due ? `by ${formatLongDayOf(`${due}T12:00:00+02:00`)}` : null;
  return {
    title: `Query ${reference} is yours: ${subject}`,
    summary: dueText ? `Reply due ${dueText}.` : `${by} routed it to you.`,
    paragraphs: [
      `${by} routed query ${reference} to you. It is from ${text(payload, "source_name")}${about ? `, about ${about}` : ""}${
        dueText ? `, and a reply is due ${dueText}` : ""
      }.`,
      ...(note ? [`Their note: "${note}"`] : []),
    ],
    action: "Open the query",
  };
}

const TEMPLATES: Record<string, Record<number, (payload: Payload) => Rendered>> = {
  password_reset_sent: { 1: passwordResetSent },
  role_assigned: { 1: roleAssigned },
  role_ended: { 1: roleEnded },
  readiness_item_assigned: {
    1: (payload) => readinessItemAssigned(payload),
    2: (payload) => readinessItemAssigned(payload, READINESS_ITEM_NAMES_V2),
  },
  query_assigned: { 1: queryAssigned },
  moderation_items_allocated: { 1: moderationItemsAllocated },
  moderation_item_reallocated: { 1: moderationItemReallocated },
  moderation_item_returned: { 1: moderationItemReturned },
  moderation_return_logged: { 1: moderationReturnLogged },
  moderation_item_remarked: { 1: moderationItemRemarked },
  moderation_cycle_signed_off: { 1: moderationCycleSignedOff },
  account_deactivated: { 1: accountDeactivated },
  account_reactivated: { 1: accountReactivated },
  sign_in_locked: { 1: signInLocked },
  sign_in_unlocked: { 1: signInUnlocked },
  appeal_decided: { 1: appealDecided },
  appeal_concluded: { 1: appealConcluded },
  appeal_admitted: { 1: appealAdmitted },
  appeal_inadmissible: { 1: appealInadmissible },
  appeal_review_allocated: { 1: appealReviewAllocated },
  appeal_received: { 1: appealReceived },
  appeal_lodged: { 1: appealLodged },
  result_released: { 1: resultReleased },
  task_published: { 1: taskPublished, 2: assignmentPublished },
  task_reminder: { 1: taskReminder, 2: assignmentReminder },
  notice: { 1: notice },
  session_scheduled: { 1: sessionScheduled },
  session_changed: { 1: sessionChanged },
  session_cancelled: { 1: sessionCancelled },
  session_series_scheduled: { 1: sessionSeriesScheduled },
  session_series_changed: { 1: sessionSeriesChanged },
  session_series_cancelled: { 1: sessionSeriesCancelled },
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
