/**
 * Words the LMS cannot avoid, explained in plain language where they appear (UX architecture, principle 2: say it
 * in words a learner understands). Page leads and empty states are read through `Glossed`, which marks the first
 * use of each term with its meaning; the navigation carries the meaning as a title.
 */
export interface GlossaryTerm {
  /** How the term is written, for example "cohort" or "NQF level". */
  term: string;
  /** Matches the term and its plural or inflections, without the word boundaries, for example "cohorts?". */
  pattern: string;
  meaning: string;
}

export const GLOSSARY: readonly GlossaryTerm[] = [
  {
    term: "assignment",
    pattern: "assignments?",
    meaning: "Work set by a facilitator for learners to hand in by a date and have marked.",
  },
  {
    term: "cohort",
    pattern: "cohorts?",
    meaning: "A group of learners who start a programme together and are taught, assessed and moderated as one.",
  },
  {
    term: "programme",
    pattern: "programmes?",
    meaning: "A course of study leading to a qualification, made up of units and modules.",
  },
  {
    term: "NQF level",
    pattern: "NQF(?: level)?",
    meaning: "Where a qualification sits on South Africa's National Qualifications Framework, from level 1 to 10.",
  },
  {
    term: "facilitator",
    pattern: "facilitators?",
    meaning: "The person who teaches a cohort: sets its assignments, materials and sessions.",
  },
  {
    term: "assessor",
    pattern: "assessors?",
    meaning: "The person who marks assignments and decides each result.",
  },
  {
    term: "moderator",
    pattern: "moderators?",
    meaning: "A second person who checks a sample of marked work before results are released.",
  },
  {
    term: "coordinator",
    pattern: "coordinators?",
    meaning: "The person who runs the programme's cohorts, appeals, notices and logistics.",
  },
  {
    term: "moderation",
    pattern: "moderat(?:ion|ed|ing)",
    meaning: "A check of a sample of marked work by a second person before the results are released.",
  },
  {
    term: "appeal",
    pattern: "appeals?",
    meaning: "A learner's request to have a result looked at again, made within the appeal window.",
  },
  {
    term: "re-mark",
    pattern: "re-marks?",
    meaning: "Marking the same work again, by someone who did not mark it before.",
  },
  {
    term: "rubric",
    pattern: "rubrics?",
    meaning: "The list of things the work is marked against, each with its marks.",
  },
  {
    term: "criteria",
    pattern: "criteri(?:a|on)",
    meaning: "The things the work is marked against, each with its marks.",
  },
  {
    term: "not yet competent",
    pattern: "not yet competent",
    meaning: "The work does not meet the standard yet. It can usually be improved and handed in again.",
  },
  {
    term: "competent",
    pattern: "competent",
    meaning: "The work meets the standard.",
  },
  {
    term: "resubmission",
    pattern: "resubmi(?:ssions?|t|tted|tting)",
    meaning: "Handing in improved work after a not-yet-competent result, within the time allowed.",
  },
  {
    term: "register",
    pattern: "registers?",
    meaning: "The attendance list for a session: who was present.",
  },
  {
    term: "readiness",
    pattern: "readiness",
    meaning: "The checklist a cohort must complete before it can start.",
  },
  {
    term: "logistics",
    pattern: "logistics",
    meaning: "The venue, catering and equipment for a session held in person.",
  },
  {
    term: "held",
    pattern: "held",
    meaning: "A result decided but not shown to the learner yet, usually while moderation is under way.",
  },
  {
    term: "released",
    pattern: "released?",
    meaning: "A result the learner can now see.",
  },
  {
    term: "SAST",
    pattern: "SAST",
    meaning: "South African Standard Time, two hours ahead of UTC all year.",
  },
  {
    term: "enrolment",
    pattern: "enrol(?:ments?|led)",
    meaning: "A learner's place in a cohort.",
  },
  {
    term: "intake",
    pattern: "intakes?",
    meaning: "A cohort's starting group of learners, often imported from a file.",
  },
  {
    term: "evidence",
    pattern: "evidence",
    meaning: "The files a learner hands in for an assignment.",
  },
  {
    term: "version",
    pattern: "versions?",
    meaning: "Each hand-in of an assignment is kept as a numbered version; nothing is overwritten.",
  },
  {
    term: "allocation",
    pattern: "allocat(?:ions?|ed)",
    meaning: "Which person is given which work to mark or review.",
  },
  {
    term: "admissible",
    pattern: "(?:in)?admissib(?:le|ility)",
    meaning: "Whether an appeal is accepted for review.",
  },
  {
    term: "query",
    pattern: "quer(?:y|ies)",
    meaning: "A question or request from outside the teaching team, such as an employer or funder.",
  },
  {
    term: "notice",
    pattern: "notices?",
    meaning: "A message a coordinator sends to a cohort, a role or everyone.",
  },
];

/** The meaning of a navigation label, for example "Cohorts", when it is a glossary term. */
export function navigationMeaning(label: string): string | undefined {
  const lower = label.toLowerCase();
  return GLOSSARY.find((entry) => new RegExp(`^${entry.pattern}$`, "i").test(lower))?.meaning;
}
