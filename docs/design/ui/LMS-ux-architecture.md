# LMS UX Architecture

| Document | UX-LMS-001 |
|---|---|
| Version | 0.1 (for review) |
| Date | 21 September 2026 |
| Owner | ArchitectUX (structure and behaviour). Visual styling is owned by the UI Designer's design system. |
| Inputs | SRS-LMS-001 v1.0; `LMS-system-design.md`; `LMS-api-design.md`; `LMS-data-model.md`; `LMS-design-fixes-and-decisions.md` section 1 (P-01 to P-21) |
| Scope | Information architecture, navigation, screen inventory, flows, state vocabulary, exam mode behaviour, responsive behaviour, microcopy rules, accessibility requirements. No colours, fonts, or application code. |

**Conventions used in this document**

- `FR-nnn`, `BR-nn`, `NFR-nn`, `AS-nn` refer to the SRS. `P-nn` refers to the working decisions in the fixes and decisions register. `ADR-nnn` refers to the architecture decision records.
- "(assumption)" marks anything the SRS and architecture do not state. Every assumption is either low risk or repeated in section 12 for the product owner.
- Routes are Next.js App Router paths. `[param]` is a dynamic segment. `(group)` is a route group that does not appear in the URL.
- Status tags are described by **tone** only (`neutral`, `info`, `positive`, `caution`, `critical`). The UI Designer maps tones to the pastel tag styles.
- Learner numbers: the SRS user-class table says about 100 learners; the architecture package adopted 1,000 registered learners (traceability CR-01). This document designs lists, filters, and bulk actions for 1,000.
- All example people, programmes, and the institution name are fictional. Dates are real 2026 calendar dates in Africa/Johannesburg (SAST, UTC+2, no daylight saving).

**Shared example data (use in every prototype so screens agree with each other)**

| Item | Value |
|---|---|
| Institution | Khanya Skills Institute (fictional) |
| Programme | Certificate in Business Administration, NQF Level 4, 140 credits (fictional unit list) |
| Cohorts | "2026 Intake B" (`moderated`), "2026 Intake C" (`moderated`), "2026 Short Course 2" (`not_moderated`, used only to show immediate release). Corrected 21 September 2026: Intake C was first listed as `not_moderated`, which contradicted Thandiwe moderating it, because a cohort that is not moderated has no held results, cycles, or sign-off (ADR-019). |
| Intake C moderation cycle | "Unit 3 portfolios", assessor Nomvula Mahlangu, frozen Friday 18 September 2026, population 64, sample 18, signed off Monday 28 September 2026 at 10:40. Thandiwe cannot sign off Intake B's "Term 3 tasks" because she assessed sampled results there (P-05). |
| Learners | Lerato Mokoena, Sipho Zulu, Ayesha Patel, Johan Botha, Naledi Khoza |
| Facilitator | Pieter van Wyk |
| Assessors | Thandiwe Nkosi (assesses Intake B, moderates Intake C); Bongani Sithole (Intake B); Nomvula Mahlangu (Intake C only) |
| Moderator | Anil Naidoo (Intake B) |
| Coordinator | Zanele Dlamini |
| System Administrator | Sibusiso Khumalo |
| Task | "Task 3: Workplace records portfolio", Unit 3 (8 credits), due Friday 4 September 2026 at 17:00; Lerato's version 2 submitted at 17:42 (late); decided 10 September; cycle "Term 3 tasks" frozen 14 September |
| Moderation sign-off / release | Tuesday 22 September 2026 at 14:05 |
| Appeal window for that release | Last full day Tuesday 29 September 2026; closes at 00:00 on Wednesday 30 September 2026 (P-11). Thursday 24 September (Heritage Day) counts; the window is calendar days. |
| Resubmission period | 14 days from release, so end of day Tuesday 6 October 2026 (end-of-day rule is an assumption, by analogy with P-11) |
| Exam | "Unit 5 summative exam", window Wednesday 14 October 2026, 09:00 to 12:00, duration 2 hours, 1 attempt |

---

## 1. Design principles

Each principle is derived from a named constraint. They are ordered by how often they settle a design argument.

| # | Principle | Derived from | What it means in practice |
|---|---|---|---|
| 1 | **Released is the only result a learner ever sees.** | BR-04, FR-408, FR-804, FR-1004; data model RLS: "a held result is invisible to its learner" | The learner UI has no screen, tag, count, credit, or notification that changes when a decision is made but held. Learners get one honest waiting state ("Being assessed") with an explanation of moderation. Staff screens always show "decided" and "released" as two separate facts with two separate timestamps. |
| 2 | **Clocks that start on release are on the page, not behind a click.** | SRS 5.3, BR-05, FR-316, FR-317, FR-603, FR-607, P-11 | The appeal closing day and any resubmission deadline are in the first screenful of the result view, the marked-script view, the dashboard card, and the release notification. They are written as a last full day ("until the end of Tuesday 29 September 2026"), never as a midnight timestamp. |
| 3 | **Tell the truth about saving.** | NFR-07, FR-314, FR-315, AS-07, ADR-023; API: "local IndexedDB writes are not reported as saved to the server" | Exam answers, uploads, and marking drafts show exactly where the data is: on this device, on the server, or submitted and locked. The UI never shows "Saved" for a local write and never shows "Failed" while the outcome of a retriable command is still unknown. |
| 4 | **The route is the hat.** | SRS 5.3, FR-102, BR-01, NFR-03, FR-504 | Navigation shows only the workspaces for roles the user holds. There is no session-wide "act as" mode, because separation of duties is per assessment instance: the same person can assess and moderate inside one cohort, on different items. The acting role is whatever workspace route the user is on, and conflicts are refused per item, by name. |
| 5 | **Append-only made visible: history everywhere, consequences before commit.** | BR-03, NFR-02, NFR-05, NFR-09, FR-109, FR-310, FR-410, SRS 2.4 "audit defensibility" | There is no "edit" on a decision, a submitted version, a sample, or a configuration value; the action is "record a new ...", and the prior record stays on screen in a history list. Every irreversible command (finalise, freeze and sample, sign-off, lodge remark, submit exam) has a confirmation that states the consequence in one sentence before it commits. |
| 6 | **Deterrence with dignity.** | SRS 2.4 "deterrence plus an audit trail, not prevention"; FR-407, FR-903, FR-905 | Integrity messages state what was recorded and who will look at it. They never accuse, never threaten to end the attempt (no integrity signal may do that), and never show the threshold. The pre-flight screen says plainly what is and is not monitored. |
| 7 | **Phone first, thin connection first, except the exam.** | SRS 2.2 (varying technical confidence, variable connectivity), NFR-10, SRS 2.3, system design "Client Components are restricted" | Every screen except exam mode is specified at 320 px first. Pages are Server Components that work before scripts load; uploads are resumable; no function depends on hover or drag. The exam is the one place the UI refuses a device, and it refuses before the clock starts. |

---

## 2. Personas-lite

Grounded in SRS 2.2. One paragraph each: context of use, device, anxiety, and what "done" looks like.

**Learner: Lerato Mokoena.** Works part time and studies from home in Soweto on a mid-range Android phone with prepaid data; uses a shared laptop at the training centre for exams. Connectivity drops without warning and load-shedding is a fact of planning. Moderate technical confidence: comfortable with WhatsApp, less so with file formats and browser settings. Anxious about three things: "Did my upload actually go through?", "Will the exam throw me out if my connection dips?", and "What did I get, and what can I do about it?". Done means: a receipt she can screenshot, a result she understands without asking anyone, and a clear next step with a date.

**Facilitator: Pieter van Wyk.** Delivers sessions in Microsoft Teams and sets tasks; works on a laptop between sessions and checks his phone in the evening. Anxious about learners silently falling behind and about a task going out with the wrong due date. Done means: one glance tells him who has not submitted Task 3, and two taps send those learners a reminder that is logged against their record (FR-210, FR-212).

**Assessor: Thandiwe Nkosi.** Marks in long sittings on a laptop with a second monitor when she has one; occasionally reviews evidence on a tablet. She assesses Intake B and moderates Intake C, so she lives in two workspaces. Accountable under external audit (SRS 2.2), so her anxiety is defensibility: "Can I show why I decided this, and did I look at everything, including the integrity log?". Done means: every criterion scored, justification written, decision finalised, and an unambiguous statement of whether the learner can see it yet (FR-408, FR-409).

**Moderator: Anil Naidoo.** Reviews a sample in a fixed window before a release date; laptop. Must be demonstrably independent of the assessor on each item (SRS 2.2, BR-01). Anxious about reviewing something he should not have been given, about missing part of the evidence, and about signing off while a returned item is still open. Done means: every allocated item concluded, observations written for the coordinator, and a sign-off that tells him exactly how many results it releases (FR-507 to FR-511).

**Coordinator: Zanele Dlamini.** Runs the programme from a laptop in the office and a phone everywhere else: setup, notices, logistics, queries, appeals. Anxious about deadlines she does not control: a cohort held too long (P-03), an appeal sitting unallocated inside a seven-day culture of urgency, a venue without catering. Done means: no red items on the cohort overview, every appeal with an owner, and a report she can export for the quality-assurance meeting (FR-701 to FR-708, FR-605, FR-608).

**System Administrator: Sibusiso Khumalo.** Desktop, methodical, works from tickets. Anxious about irreversible mistakes with audit consequences: a role change that breaks separation of duties, a configuration change that silently alters a live cohort, a leaked Department credential. Done means: the change is made, the previous value is visibly retained, and the system told him precisely why anything was refused (FR-103 to FR-112).

**Department of Education.** A machine consumer with no UI (SRS 2.2). Its only footprint in the interface is the credential and access-log screens used by the System Administrator (FR-110).

---

## 3. Global shell and navigation

### 3.1 Three shells

| Shell | Route group | Used for | Chrome |
|---|---|---|---|
| `AuthShell` | `app/(auth)/` | Sign-in, password reset, invitation acceptance | Institution name, one centred form column, help link. No navigation. |
| `AppShell` | `app/(app)/` | Everything else except sitting an exam | Top bar, side navigation (or bottom tabs), page header, main, optional aside |
| `ExamShell` | `app/(exam)/` | `/exam/[attemptId]` and its receipt only | Exam bar only. No navigation, no notifications, no search, no account menu (FR-901). Specified in section 8. |

Keeping exam mode in its own route group means its layout cannot inherit navigation by accident, and the restricted mode in FR-901 is structural rather than a set of hidden elements.

### 3.2 AppShell regions

```text
Desktop (>= 1024 px)
+----------------------------------------------------------------------------+
| TopBar:  [Institution]   [Context selector]      [Search] [Bell] [Account] |
+-------------+--------------------------------------------------------------+
| SideNav     | PageHeader: breadcrumb, title, status tag, primary action     |
| (256 px)    +-----------------------------------------------+--------------+
| workspace   | Main (reading measure max 720 px for prose;   | Aside        |
| groups      | data views may use full width up to 1200 px)  | (optional,   |
|             |                                               | 320-400 px)  |
+-------------+-----------------------------------------------+--------------+

Tablet (768-1023 px): SideNav collapses to a 72 px rail (icon plus short label);
Aside drops below Main.

Phone (< 768 px)
+--------------------------------------+
| TopBar: [Workspace/Context] [Bell] [Account] |
+--------------------------------------+
| PageHeader (title, status, overflow) |
| Main (single column, 16 px gutters)  |
| Sticky action bar when a primary     |
| action exists                        |
+--------------------------------------+
| BottomTabs (max 5)                   |
+--------------------------------------+
```

| Region | Rules |
|---|---|
| `TopBar` | Fixed height. Never contains page actions. On phones, search moves inside the "More" tab. |
| `SideNav` | One group per workspace the user holds (section 3.3). A user with one role sees a flat list with no group heading. Counts (for example "To mark 12") appear beside items; counts are never shown for anything a learner must not infer (principle 1). |
| `PageHeader` | Breadcrumb (desktop only), H1, one status tag, at most one primary action and an overflow menu. For cohort-scoped pages it carries the cohort name and the moderation policy tag. |
| `Main` | First focusable region after the skip link. One H1 per page. |
| `Aside` | Context that supports the main task without being the task: history, audit trail, notification evidence. Collapses below `Main` under 1024 px. |
| `BottomTabs` | Phone only. Up to four destinations plus "More". Hidden when the on-screen keyboard is open and on any screen with a sticky action bar that would stack with it (the action bar takes priority). |
| Skip link | "Skip to main content", first in tab order on every shell including `ExamShell`. |
| Appearance | The account menu contains an Appearance control with Light, Dark, and System. Structure only: the design system supplies both themes. |

### 3.3 Multi-role navigation: unified navigation with route-scoped workspaces

**Decision.** One navigation, grouped into workspaces. No global role switcher and no session-level "acting as" state.

| Workspace | Route prefix | Shown when the user holds | Label in navigation |
|---|---|---|---|
| Learn | `/learn` | Learner | Learning |
| Teach | `/teach` | Facilitator | Teaching |
| Assess | `/assess` | Assessor | Assessing |
| Moderate | `/moderate` | Moderator | Moderating |
| Appeal reviews | `/review` | Any user with a current or past appeal-reviewer allocation (allocation-based, not a role; BR-02, AS-02) | Appeal reviews |
| Coordinate | `/coordinate` | Coordinator | Coordinating |
| Admin | `/admin` | System Administrator | Administration |

**Why not a role switcher.**

1. **BR-01 is per assessment instance, not per user or per cohort.** FR-504 only makes sense if the same person can be an assessor and a moderator in the same cohort, on different items. A switcher that puts Thandiwe "in Moderator mode" implies a separation that the rules do not draw, and would make her believe the mode is what protects independence. What actually protects it is the allocation check on each item. The UI should teach the real rule.
2. **A sticky mode hides work.** In Assessor mode, Thandiwe would not see that three sample items in Intake C are waiting for her, or that a moderator returned one of her items. Deadlines on returned items (FR-509) block a whole cohort's release (FR-510). Hidden work here has a cost to 100 or more learners.
3. **Deep links must work without a mode.** Notifications and emails link to `/assess/instances/[id]` or `/moderate/cycles/[id]/items/[id]`. With a switcher the link either silently flips the mode (confusing) or fails (worse). With route-scoped workspaces, the link is the context.
4. **Audit.** `audit_events` records the acting role and scope. Deriving it from the command's route and the allocation is unambiguous; deriving it from a user-set mode invites "I was in the wrong mode" disputes.
5. **SRS 5.3 is satisfied structurally.** A workspace group that the user does not hold is never rendered, its routes return 404 (the API convention for "not visible within the caller's scope"), and role checks live in each workspace's `layout.tsx` as well as in RLS.

**Costs of this choice and how they are handled.**

| Cost | Mitigation |
|---|---|
| Six workspaces do not fit a phone tab bar | On phones the `TopBar` shows a workspace picker (a sheet listing the held workspaces with their counts). `BottomTabs` shows the current workspace's destinations. This is navigation, not a mode: nothing is stored server-side, deep links ignore it, and the staff home (`/home`) shows work from all workspaces. The picker is not rendered for single-role users. |
| A multi-role user may forget which hat a page belongs to | Every staff `PageHeader` carries a persistent workspace label ("Assessing", "Moderating") above the H1, and the confirmation dialog for any decision names the capacity: "You are finalising this decision as the assessor." |
| Learner who is also staff (rare) | The Learning group is listed first and behaves exactly as it does for any learner. Staff counts never include learner data. |

**Landing rules after sign-in.** Learner only: `/learn`. Any staff role: `/home`, a cross-workspace work list ("My work") with rows tagged by workspace and cohort: items to mark, items returned to me, sample items to review, cycles I can sign off, appeals to review, appeals to administer, open checklist items. A deep link that triggered sign-in wins over both.

**Navigation items per workspace (desktop order).**

| Workspace | Items | Phone tabs |
|---|---|---|
| Learning | Home, Tasks, Exams, Materials, Calendar, Results, Credits, Notes | Home, Tasks, Materials, Results, More |
| Teaching | Overview, Tasks, Materials, Quizzes, Sessions, Submissions | Overview, Tasks, Sessions, Submissions, More |
| Assessing | Queue, Returned to me, Cohort release status | Queue, Returned, Status |
| Moderating | Cycles, My sample items | Cycles, Items |
| Appeal reviews | Reviews | Reviews |
| Coordinating | Overview, Cohorts, Appeals, Notices, Queries, Logistics, Reports | Overview, Cohorts, Appeals, Notices, More |
| Administration | Accounts, Imports, Configuration, Department integration, Audit log, Cohort archive | Accounts, Configuration, Audit, More |

### 3.4 Cohort and programme context selector

| Aspect | Rule |
|---|---|
| Learner | No selector when the learner has one active enrolment (the normal case). With more than one, a programme selector appears in the `TopBar`; the dashboard shows all enrolments stacked, newest first. |
| Coordinator | Cohort is the object of work, so it is in the path: `/coordinate/cohorts/[cohortId]/...`. The `TopBar` selector is a shortcut that swaps `[cohortId]` and keeps the sub-page. |
| Teach, Assess, Moderate | Queues default to "All my cohorts" and accept `?cohort=[cohortId]`. The selector lists only cohorts where the user holds that workspace's role, so Thandiwe sees Intake B under Assessing and Intake C under Moderating. If a user holds both roles in one cohort, that cohort appears in both lists; the items differ (FR-504). |
| Persistence | The last selection per workspace is kept in a cookie so Server Components can read it. It is a convenience filter, never an authorization input. |
| Labelling | Each option shows cohort name, programme, status (Active, Archived), and moderation policy tag (Moderated, Not moderated) because the policy changes what "finalise" does (FR-408). |
| Archived cohorts | Listed under a separate "Archived" heading. Every page inside an archived cohort shows a read-only banner and renders no mutating action (FR-112). |

### 3.5 Notification centre (NFR-11)

| Element | Behaviour |
|---|---|
| Bell in `TopBar` | Unread count. Opens a popover (desktop) or navigates to `/notifications` (phone). Not rendered in `ExamShell`. |
| `/notifications` | Reverse-chronological list with filters: All, Results, Deadlines, Appeals, Notices, Work for me (staff). Each row: title, one-line summary, time in SAST, workspace tag for multi-role users, link to the object. |
| Delivery evidence | Every row expands to show "How you were told": in-app created at, first opened by you at, and for each email delivery its state and time, mapped from `notification_deliveries` (section 7.7). This is the learner-facing proof required by NFR-11. |
| On the result itself | The released result view repeats the evidence in one line: "You were notified in the LMS on 22 September 2026 at 14:05 and by email at 14:06 (delivered)." |
| Failed email | The row shows "Email could not be delivered" and a link to check the address in `/account`. The in-app record still stands as the notification of record. |
| Mandatory notifications | Result released, appeal outcome, inadmissibility, returned item, and account security notices cannot be switched off (NFR-11, FR-106, FR-509, FR-605, FR-611). Preferences in `/account` cover only non-mandatory categories (assumption). |
| Held results | No notification of any kind is created for the learner when a decision is finalised and held (principle 1). |
| Staff view of evidence | The coordinator's appeal detail shows the same delivery timeline for the release notification, so a dispute about "I was never told" is answered from one screen (FR-604, FR-605). |

### 3.6 Global search

Search is scoped to what the current user could already reach by navigation, and it never indexes anything whose existence is itself sensitive.

| Role | Searches | Never returns |
|---|---|---|
| Learner | Published materials and recordings (FR-301), own tasks, own sessions, own exams by title | Notes (searched only inside `/learn/notes`, so private notes never mix into a shared result list; FR-306, FR-307), results, appeal content |
| Facilitator | Own tasks, materials, quizzes, sessions; learners in assigned cohorts by name or learner number | Outcomes, marks, integrity logs |
| Assessor, Moderator | Learners and items inside their allocation only | Anything outside scope; an out-of-scope hit is simply absent (FR-401) |
| Coordinator | Cohorts, learners, appeals by reference, queries, notices, sessions within scope | Appeal deliberation text |
| System Administrator | Accounts by name, email, or learner number; configuration keys; import batches | Academic records |

Results are grouped by type, with at most five per group and a "See all" link. On phones, search lives under the "More" tab. Search input is a GET form (`/search?q=`), so it works without client script.

### 3.7 Account menu

| Item | Content |
|---|---|
| Identity block | Name, email, and a read-only list of roles held with their scopes ("Assessor: 2026 Intake B", "Moderator: 2026 Intake C"). This is the user's own answer to "what can I do here?" (FR-102). |
| Profile | `/account`: contact details the user may change (assumption: email change requires administrator action because it is the identity key for imports). |
| Password and security | Change password; list of recent sign-ins (assumption). |
| Notification preferences | Non-mandatory categories only (section 3.5). |
| Calendar subscription | Learners only; links to `/learn/calendar/subscribe` (FR-304). |
| Appearance | Light, Dark, System. |
| Help | One consistent location on every page (WCAG 3.2.6): how-to pages and the coordinator's contact details. |
| Sign out | Ends the session. Disabled inside `ExamShell`, which has no account menu at all. |

---

## 4. Sitemap per role

Every node carries the FR identifiers it serves. "(assumption)" marks a route with no direct FR. Screen identifiers (for example `L-03`) refer to the inventory in section 5.

### 4.1 Shared and unauthenticated

```text
/sign-in                                   G-01  FR-101; lockout messaging FR-106
/forgot-password                           G-02  FR-101, FR-106
/reset-password                            G-02  FR-101, FR-106
/accept-invite                             G-03  FR-103 (assumption: invitation sets the first password)
/home                                      G-04  FR-102 (staff cross-workspace work list); links into FR-401, FR-409, FR-504, FR-608, FR-609
/notifications                             G-05  NFR-11; surfaces FR-203, FR-207, FR-212, FR-509, FR-511, FR-604, FR-605, FR-611, FR-106
/account                                   G-06  FR-102 (roles held, read-only)
/search                                    G-07  FR-301 (learner material search) and scoped staff search
(not-found / no-access / archived banner)  G-08  FR-401 (deny and log out-of-scope access), FR-112 (read-only)
```

### 4.2 Learner (`/learn`, `/exam`)

```text
/learn                                     L-01  FR-304 (what is due), FR-305, FR-316 (result card with appeal closing day), FR-317, FR-318 (credit summary)
├── /learn/tasks                           L-02  FR-308, FR-309
│   └── /learn/tasks/[taskId]              L-03  FR-308, FR-309, FR-310, FR-311; shows FR-201 brief and rubric; FR-317 when resubmission is open
│       └── /learn/tasks/[taskId]/submit   L-03  FR-308, FR-309, FR-310, FR-311
├── /learn/exams                           L-10  FR-312, FR-304
│   └── /learn/exams/[examId]              L-11  FR-312 (pre-flight, window and enrolment check, denial with reason), FR-901 (what restricted mode does)
├── /exam/[attemptId]                      L-12  FR-313, FR-314, FR-315, FR-901, FR-902, FR-903, FR-904, FR-905 (ExamShell)
│   └── /exam/[attemptId]/receipt          L-13  FR-315
├── /learn/materials                       L-04  FR-301, FR-204 (published or released on schedule), FR-208 (recordings)
│   └── /learn/materials/[materialId]      L-05  FR-301 (access logged), FR-306 (attach a note)
├── /learn/quizzes/[quizId]                L-06  FR-302, FR-303 (labelled as practice; does not count), FR-205 (attempt limit shown)
│   └── /learn/quizzes/[quizId]/attempts/[attemptId]   L-06  FR-302
├── /learn/calendar                        L-07  FR-304, FR-305, FR-203, FR-207
│   └── /learn/calendar/subscribe          L-08  FR-304 (external subscription; issue, rotate, revoke feed token)
├── /learn/results                         L-14  FR-316
│   └── /learn/results/[resultId]          L-15  FR-316, FR-317, FR-603, NFR-11; decision history per BR-03, FR-803 effect explained
│       └── /learn/results/[resultId]/appeal/new   L-16  FR-601, FR-602, FR-603, FR-604, AS-04
├── /learn/appeals                         L-17  FR-612
│   └── /learn/appeals/[appealId]          L-17  FR-612, FR-613 (states that the outcome is final; no further appeal control exists), FR-605 (inadmissible reason)
│       └── /learn/appeals/[appealId]/script   L-18  FR-606, FR-607
├── /learn/credits                         L-19  FR-318, FR-801, FR-802, FR-803, FR-804
└── /learn/notes                           L-09  FR-306, FR-307 ("Only you can see your notes")
    └── /learn/notes/[noteId]              L-09  FR-306
```

### 4.3 Facilitator (`/teach`)

```text
/teach                                     F-01  FR-210 (summary of outstanding work per task)
├── /teach/tasks                           F-02  FR-201, FR-202
│   ├── /teach/tasks/new                   F-03  FR-201, FR-202
│   └── /teach/tasks/[taskId]/edit         F-03  FR-201, FR-202, FR-203 (publish step states who is notified and what goes on calendars)
├── /teach/exams/[examId]/edit             F-11  FR-201 (assumption: an exam is a task whose submission type is "online exam"; see section 12, Q9), FR-312 inputs
├── /teach/materials                       F-04  FR-204, FR-208
│   ├── /teach/materials/new               F-04  FR-204, FR-208
│   └── /teach/materials/[materialId]/edit F-04  FR-204
├── /teach/quizzes                         F-05  FR-205
│   ├── /teach/quizzes/[quizId]/edit       F-05  FR-205
│   └── /teach/question-bank               F-05  FR-205
├── /teach/sessions                        F-06  FR-206, FR-207
│   ├── /teach/sessions/new                F-06  FR-206 (Teams link format validated on entry)
│   ├── /teach/sessions/[sessionId]        F-06  FR-206, FR-207 (reschedule, cancel, who is notified)
│   └── /teach/sessions/[sessionId]/register   F-07  FR-209
└── /teach/submissions                     F-08  FR-210, FR-211
    ├── /teach/submissions/learners/[learnerId]   F-09  FR-210 (drill-down to history)
    └── /teach/submissions/reminders/new   F-10  FR-212
```

### 4.4 Assessor (`/assess`)

```text
/assess                                    A-01  FR-401, FR-905 (flagged attempts ordered and highlighted)
├── /assess/instances/[instanceId]         A-02  FR-402, FR-403, FR-404, FR-405, FR-406, FR-407, FR-408, FR-410
├── /assess/returned                       A-04  FR-410, FR-509
└── /assess/cohorts                        A-03  FR-409
```

### 4.5 Moderator (`/moderate`) and appeal reviewer (`/review`)

```text
/moderate                                  M-01  FR-504 (only items this moderator may review are listed)
└── /moderate/cycles/[cycleId]             M-02  FR-508 (cohort-level observations), FR-510 (progress and outstanding returns)
    ├── /moderate/cycles/[cycleId]/items/[itemId]   M-03  FR-507, FR-508, FR-509
    └── /moderate/cycles/[cycleId]/sign-off         M-04  FR-510, FR-511

/review/appeals                            R-01  FR-609
└── /review/appeals/[appealId]             R-02  FR-609, FR-610, FR-611
```

### 4.6 Coordinator (`/coordinate`)

```text
/coordinate                                C-01  FR-702 (open readiness items), FR-604 (appeals awaiting action), P-03 hold-age alert, FR-707 (variance flags)
├── /coordinate/cohorts                    C-02  FR-701
│   ├── /coordinate/cohorts/new            C-03  FR-701; moderation policy is required (P-01, BR-04)
│   └── /coordinate/cohorts/[cohortId]     C-02  FR-701 (overview)
│       ├── /setup                         C-03  FR-701; moderation policy change (P-01)
│       ├── /people                        C-04  FR-701, FR-104, FR-105
│       ├── /readiness                     C-05  FR-702
│       ├── /moderation                    C-06  FR-501, FR-506; plan, cancel, freeze and sample; pending pool
│       │   ├── /cycles/new                C-06  FR-501 (manual or scheduled start)
│       │   └── /cycles/[cycleId]          C-07  FR-502, FR-503, FR-504, FR-505 (seed, rule version, strata, inclusion reasons, allocations, reallocation)
│       └── /exams/[examId]/attempts       C-08  FR-314, NFR-07, P-13 (void and regrant after a sustained outage)
├── /coordinate/appeals                    C-12  FR-604
│   └── /coordinate/appeals/[appealId]     C-12  FR-605, FR-606 (grant view-script), FR-608
├── /coordinate/notices                    C-09  FR-703
│   └── /coordinate/notices/new            C-09  FR-703
├── /coordinate/queries                    C-10  FR-704
│   └── /coordinate/queries/[queryId]      C-10  FR-704
├── /coordinate/sessions/[sessionId]/logistics   C-11  FR-705, FR-706, FR-707
├── /coordinate/reports                    C-13  FR-708
│   └── /coordinate/reports/[reportType]   C-13  FR-708
└── /coordinate/corrections                C-14  BR-03, P-12 (dual-control correction; no FR)
```

### 4.7 System Administrator (`/admin`)

```text
/admin                                     X-01  FR-103, FR-106 (locked accounts needing attention)
├── /admin/accounts                        X-02  FR-103, FR-106
│   ├── /admin/accounts/new                X-02  FR-103
│   └── /admin/accounts/[profileId]        X-03  FR-103 (edit, deactivate, reactivate), FR-106 (reset, unlock), FR-107 (change history)
│       └── /admin/accounts/[profileId]/roles   X-04  FR-102, FR-104, FR-105, FR-107
├── /admin/imports                         X-05  FR-103
│   ├── /admin/imports/new                 X-05  FR-103
│   └── /admin/imports/[batchId]           X-05  FR-103
├── /admin/configuration                   X-06  FR-108
│   └── /admin/configuration/[key]         X-06  FR-108, FR-109, NFR-09
├── /admin/integration                     X-07  FR-110, FR-1002 (rejected requests visible)
│   └── /admin/integration/access-log      X-08  FR-110, FR-1006
├── /admin/audit                           X-09  FR-107, NFR-02
└── /admin/cohorts                         X-10  FR-111, FR-112
```

### 4.8 FR coverage check

Every FR with a human-facing surface appears below with the screen that is its primary home.

| FR | Primary screen | FR | Primary screen | FR | Primary screen |
|---|---|---|---|---|---|
| FR-101 | G-01 | FR-301 | L-04, L-05 | FR-507 | M-03 |
| FR-102 | X-04, G-06 | FR-302 | L-06 | FR-508 | M-03, M-02 |
| FR-103 | X-02, X-03, X-05 | FR-303 | L-06 (label only) | FR-509 | M-03, A-04 |
| FR-104 | X-04, C-04, C-07 | FR-304 | L-07, L-08 | FR-510 | M-04 |
| FR-105 | X-04, C-04 | FR-305 | L-07, L-01 | FR-511 | M-04 |
| FR-106 | X-03, G-01, G-02 | FR-306 | L-09 | FR-601 | L-16 |
| FR-107 | X-09, X-03 | FR-307 | L-09 (label only) | FR-602 | L-16 |
| FR-108 | X-06 | FR-308 | L-03 | FR-603 | L-15, L-16 |
| FR-109 | X-06 | FR-309 | L-03 | FR-604 | L-16, C-12 |
| FR-110 | X-07, X-08 | FR-310 | L-03, A-02 | FR-605 | C-12, L-17 |
| FR-111 | X-10 | FR-311 | L-03 | FR-606 | L-18, C-12 |
| FR-112 | X-10, G-08 | FR-312 | L-11 | FR-607 | L-18 |
| FR-201 | F-03 | FR-313 | L-12 | FR-608 | C-12 |
| FR-202 | F-03 | FR-314 | L-12, C-08 | FR-609 | R-02 |
| FR-203 | F-03, G-05, L-07 | FR-315 | L-12, L-13 | FR-610 | R-02 |
| FR-204 | F-04 | FR-316 | L-15 | FR-611 | R-02, G-05 |
| FR-205 | F-05 | FR-317 | L-15, L-03 | FR-612 | L-17 |
| FR-206 | F-06 | FR-318 | L-19 | FR-613 | L-17 (absence of control plus statement) |
| FR-207 | F-06, G-05 | FR-401 | A-01, G-08 | FR-701 | C-03, C-04 |
| FR-208 | F-04, L-04 | FR-402 | A-02 | FR-702 | C-05 |
| FR-209 | F-07 | FR-403 | A-02 | FR-703 | C-09 |
| FR-210 | F-08, F-09 | FR-404 | A-02 | FR-704 | C-10 |
| FR-211 | F-08 | FR-405 | A-02 | FR-705 | C-11 |
| FR-212 | F-10, F-08 | FR-406 | A-02 | FR-706 | C-11 |
| FR-501 | C-06 | FR-407 | A-02 (advisory label; no auto-outcome control) | FR-707 | C-11, C-01 |
| FR-502 | C-07 | FR-408 | A-02 | FR-708 | C-13 |
| FR-503 | C-07 | FR-409 | A-03 | FR-801 | L-19 |
| FR-504 | C-07, M-01 | FR-410 | A-02, A-04 | FR-802 | L-19 |
| FR-505 | C-07 | FR-901 | L-11, L-12 | FR-803 | L-19, L-15 |
| FR-506 | C-06 | FR-902 | L-12 (detection), A-02 (log) | FR-804 | L-19 |
| FR-1002 | X-07 (indirect) | FR-903 | L-12 | FR-904 | L-12 |
| FR-1006 | X-08 (indirect) | FR-905 | A-01, A-02 | | |

### 4.9 FRs with no user interface

| FR | Why there is no screen | Where a trace of it is still visible |
|---|---|---|
| FR-1001 | Machine API and published OpenAPI document | None in the LMS UI |
| FR-1003 | Response content of the machine API | None |
| FR-1004 | Structural exclusion in the released-record view | None. The learner notes screen and the pre-flight screen state in plain words that notes and integrity logs are not shared. |
| FR-1005 | Rate limiting of the machine API | Throttled requests appear in the access log (X-08) |
| FR-1007 | Published compatibility and deprecation policy (a document, not a screen) | None |
| FR-1002, FR-1006 | Machine authentication and access logging | Read-only evidence in X-07 and X-08 under FR-110 |

FRs that are rules rather than screens, but which the UI must make visible: FR-303 and FR-307 (one-line reassurance labels), FR-407 (the integrity panel is advisory and has no control that sets an outcome), FR-613 (no further-appeal control exists, and the outcome page says the decision is final), FR-502, FR-503, FR-505 (read-only sample record for audit), FR-801 to FR-804 (all expressed through the credits record), FR-902 and FR-904 (logged silently; surfaced through the FR-903 warning and the FR-406 log).

---

## 5. Screen inventory

Priority: **P0** must be prototyped (18 screens, chosen to prove the design across all six roles and both hard problems: the exam and the hold/release model). **P1** is needed for a usable first release. **P2** follows the established patterns and needs no separate design exploration.

### 5.1 Inventory

#### Global

| ID | Screen | Route | Roles | Purpose | Primary action | Key data shown | FRs | Pri |
|---|---|---|---|---|---|---|---|---|
| G-01 | Sign in | `/sign-in` | All | Authenticate before anything else | Sign in | Email, password, reset link, paused-sign-in message, help contact | FR-101, FR-106 | **P0** |
| G-02 | Forgot and reset password | `/forgot-password`, `/reset-password` | All | Self-service recovery | Send reset link; set new password | Neutral confirmation that does not reveal whether the account exists | FR-101, FR-106 | P1 |
| G-03 | Accept invitation | `/accept-invite` | All | First sign-in after account creation or import (assumption) | Set password | Name, roles granted, programme | FR-103 | P2 |
| G-04 | My work (staff home) | `/home` | All staff | One list of work across every workspace the user holds | Open item | Row per work item: type, learner or cohort, due date, workspace tag | FR-102, FR-401, FR-409, FR-504, FR-609 | P1 |
| G-05 | Notification centre | `/notifications` | All | Show what the user was told and when | Open linked object | Title, time, delivery evidence per channel, read state | NFR-11, FR-203, FR-207, FR-511, FR-604, FR-611 | **P0** |
| G-06 | Account | `/account` | All | Own details, roles held, preferences, appearance | Save | Roles with scopes (read-only), password, preferences | FR-102 | P2 |
| G-07 | Search results | `/search` | All | Find within own scope | Open result | Grouped results | FR-301 | P2 |
| G-08 | System states | n/a | All | Not found, no access, archived read-only banner, session expired, offline | Go back; sign in again | Plain reason and next step | FR-401, FR-112 | P2 |

#### Learner

| ID | Screen | Route | Roles | Purpose | Primary action | Key data shown | FRs | Pri |
|---|---|---|---|---|---|---|---|---|
| L-01 | Learner home | `/learn` | Learner | Answer "what needs me now?" in one screen | Open the most urgent item | New results with appeal closing day; due and overdue tasks; today's sessions with Join; next exam window; credit progress | FR-304, FR-305, FR-316, FR-317, FR-318 | **P0** |
| L-02 | Tasks | `/learn/tasks` | Learner | All tasks with status | Open task | Title, due date, status tag, late tag | FR-308, FR-309 | P1 |
| L-03 | Task detail and submission | `/learn/tasks/[taskId]`, `.../submit` | Learner | Read the brief, upload evidence, submit a version, see every version | Submit version N | Brief, criteria, due date, evidence requirements, upload progress, version history with timestamps and late flags, receipt | FR-308, FR-309, FR-310, FR-311, FR-317 | **P0** |
| L-04 | Materials | `/learn/materials` | Learner | Browse and search material and recordings by module | Open item | Module, title, type, size for downloads | FR-301, FR-208 | P1 |
| L-05 | Material viewer | `/learn/materials/[materialId]` | Learner | Read or download; attach a note | Download or open link | Title, description, file or link, related notes | FR-301, FR-306 | P2 |
| L-06 | Quiz | `/learn/quizzes/[quizId]` | Learner | Practise and get instant feedback | Start attempt; submit | "Practice: does not count towards your result", attempts used of limit, score, per-question feedback | FR-302, FR-303, FR-205 | P1 |
| L-07 | Calendar | `/learn/calendar` | Learner | Sessions, exam windows, due dates in list and month views | Join session | Agenda list (default on phone), month grid (desktop), Teams join link at session time | FR-304, FR-305, FR-203, FR-207 | P1 |
| L-08 | Calendar subscription | `/learn/calendar/subscribe` | Learner | Subscribe from a phone calendar | Create link; copy; rotate; revoke | Feed URL shown once, what the feed contains and omits | FR-304 | P2 |
| L-09 | Notes | `/learn/notes`, `/[noteId]` | Learner | Private notes, searchable, optionally linked to material or session | New note | Note list, search, link target, "Only you can see your notes" | FR-306, FR-307 | P2 |
| L-10 | Exams | `/learn/exams` | Learner | Upcoming and past exams | Open pre-flight | Window, duration, attempts, status | FR-312, FR-304 | P2 |
| L-11 | Exam pre-flight and start | `/learn/exams/[examId]` | Learner | Check device and window, explain rules, start | Start exam | Window, duration, shortened-time notice, device checks, what is recorded, denial reason | FR-312, FR-901 | **P0** |
| L-12 | Exam mode | `/exam/[attemptId]` | Learner | Sit the exam in restricted mode | Review and submit | Question, navigator, timer, save status, connection status, integrity warning, takeover screen | FR-313, FR-314, FR-315, FR-901 to FR-905 | **P0** |
| L-13 | Exam receipt | `/exam/[attemptId]/receipt` | Learner | Confirm the attempt is locked and received | Return to LMS | Receipt ID, submitted time, how it was submitted, answered count, recorded events count | FR-315 | P1 (its state is included in the L-12 prototype) |
| L-14 | Results | `/learn/results` | Learner | List of released results | Open result | Item, outcome, released date, appeal closing day or "closed on" | FR-316 | P1 |
| L-15 | Released result | `/learn/results/[resultId]` | Learner | Understand outcome, marks, feedback, appeal deadline, remediation | Lodge appeal, or Resubmit when NYC | Outcome, marks per criterion, feedback, appeal closing day, remediation actions and resubmission deadline, how you were notified, decision history | FR-316, FR-317, FR-603, NFR-11 | **P0** |
| L-16 | Lodge appeal | `/learn/results/[resultId]/appeal/new` | Learner | Choose appeal type, state grounds, confirm | Lodge appeal | Type choice, remark warning (AS-04), one-remark rule, grounds, window remaining, confirmation with turnaround | FR-601, FR-602, FR-603, FR-604 | **P0** |
| L-17 | Appeals tracker | `/learn/appeals`, `/[appealId]` | Learner | Track status, read outcome and reasons | View outcome | Timeline of states, inadmissible reason, outcome, reasons, "This decision is final" | FR-612, FR-613, FR-605 | P1 |
| L-18 | Marked script | `/learn/appeals/[appealId]/script` | Learner | See own submission beside marks per criterion and feedback | Request a remark (if still open) | Submission, criterion marks, feedback, remaining appeal window | FR-606, FR-607 | P1 |
| L-19 | Credits record | `/learn/credits` | Learner | See credits earned and outstanding | Open unit | Total earned of required, per-unit status, outstanding units, ledger history including adjustments | FR-318, FR-801 to FR-804 | **P0** |

#### Facilitator

| ID | Screen | Route | Roles | Purpose | Primary action | Key data shown | FRs | Pri |
|---|---|---|---|---|---|---|---|---|
| F-01 | Teaching overview | `/teach` | Facilitator | Today's sessions and tasks with outstanding work | Open submissions | Per task: submitted, outstanding, late counts | FR-210 | P2 |
| F-02 | Tasks | `/teach/tasks` | Facilitator | Drafts and published tasks | New task | Title, state (Draft, Published), due date, audience | FR-201, FR-202 | P2 |
| F-03 | Task editor | `/teach/tasks/new`, `/[taskId]/edit` | Facilitator | Build brief, rubric, due date, submission type, audience; save draft; publish | Publish | Form sections, draft state, publish confirmation naming recipients and calendar effect | FR-201, FR-202, FR-203 | P1 |
| F-04 | Materials manager | `/teach/materials`, `/new`, `/[materialId]/edit` | Facilitator | Upload or link material and recordings, tag to module, set visibility, publish or schedule | Publish or schedule | State (Draft, Scheduled, Published, Archived), module, release time | FR-204, FR-208 | P1 |
| F-05 | Quiz builder and question bank | `/teach/quizzes/[quizId]/edit`, `/teach/question-bank` | Facilitator | Compose quiz, scoring, feedback, attempt limit | Publish quiz | Questions, keys, feedback, attempt limit | FR-205 | P2 |
| F-06 | Sessions | `/teach/sessions`, `/new`, `/[sessionId]` | Facilitator | Schedule with Teams link; reschedule or cancel | Save session | Date, time, duration, audience, link validity, who will be notified | FR-206, FR-207 | P1 |
| F-07 | Register | `/teach/sessions/[sessionId]/register` | Facilitator | Mark present or absent; amend with logged reason | Save register | Roster, present or absent, amendment log | FR-209 | P1 |
| F-08 | Submission dashboard | `/teach/submissions` | Facilitator | See at a glance who has not submitted | Send reminder to selected | Per task and learner: Submitted, Outstanding, Late; filters; export; selection | FR-210, FR-211, FR-212 | **P0** |
| F-09 | Learner submission history | `/teach/submissions/learners/[learnerId]` | Facilitator | Drill-down for one learner | Send reminder | All tasks, versions, timestamps, late flags, reminders sent | FR-210 | P1 |
| F-10 | Send reminder | `/teach/submissions/reminders/new` | Facilitator | Compose reminder to selected learners | Send | Recipients, task, message preview, "logged against each learner" | FR-212 | P1 |
| F-11 | Exam setup | `/teach/exams/[examId]/edit` | Facilitator | Window, duration, attempt limit, questions (assumption) | Publish exam | Window, duration, attempts, question manifest | FR-201, FR-312 | P2 |

#### Assessor

| ID | Screen | Route | Roles | Purpose | Primary action | Key data shown | FRs | Pri |
|---|---|---|---|---|---|---|---|---|
| A-01 | Marking queue | `/assess` | Assessor | Work list within assigned cohorts | Open next | Learner, item, version, submitted, late, integrity flag, state | FR-401, FR-905 | P1 |
| A-02 | Marking workspace | `/assess/instances/[instanceId]` | Assessor | Review evidence, score rubric, judge integrity log, decide | Finalise decision | Submission and evidence viewer, version history, rubric scoring, feedback, integrity log and judgement, outcome, justification, remediation, held or released state | FR-402 to FR-408, FR-410 | **P0** |
| A-03 | Cohort release status | `/assess/cohorts` | Assessor | Which cohorts are held, what is outstanding with the moderator, what is released | Open outstanding item | Per cohort and cycle: decided, held, sampled, returned to me, released | FR-409 | P1 |
| A-04 | Returned to me | `/assess/returned` | Assessor | Items a moderator returned, with corrections and deadline | Re-mark | Moderator's required corrections, deadline, original decision | FR-410, FR-509 | P1 |

#### Moderator and appeal reviewer

| ID | Screen | Route | Roles | Purpose | Primary action | Key data shown | FRs | Pri |
|---|---|---|---|---|---|---|---|---|
| M-01 | Moderation home | `/moderate` | Moderator | Cycles and items allocated to me | Open cycle | Cycle, cohort, my items done of total, returns outstanding | FR-504 | P1 |
| M-02 | Cycle overview | `/moderate/cycles/[cycleId]` | Moderator | Progress, item list, cohort-level observations | Open next item | Items by state, inclusion reason, observations editor, sign-off readiness | FR-508, FR-510 | P1 |
| M-03 | Sample item review | `/moderate/cycles/[cycleId]/items/[itemId]` | Moderator | Review everything about one decision in one view and record a finding | Record finding | Submission, evidence, rubric, assessor's marks, decision and justification, inclusion reason, finding form, return form | FR-507, FR-508, FR-509 | **P0** |
| M-04 | Cycle sign-off | `/moderate/cycles/[cycleId]/sign-off` | Moderator | Sign off, or see exactly what blocks it | Sign off and release | Outstanding returns list, unconcluded items, eligibility to sign, release count, statement | FR-510, FR-511 | **P0** |
| R-01 | Appeal reviews | `/review/appeals` | Allocated reviewer | Remark requests allocated to me | Open review | Appeal reference, learner, item, allocated date, target date | FR-609 | P1 |
| R-02 | Appeal review workspace | `/review/appeals/[appealId]` | Allocated reviewer | Review grounds and the full record; record outcome | Record outcome | Grounds, submission, marks, decision chain, moderation findings, outcome form (upheld, amended up, amended down), remediation when the amended outcome is NYC | FR-609, FR-610, FR-611 | P1 |

#### Coordinator

| ID | Screen | Route | Roles | Purpose | Primary action | Key data shown | FRs | Pri |
|---|---|---|---|---|---|---|---|---|
| C-01 | Coordinator overview | `/coordinate` | Coordinator | What needs attention across cohorts | Open item | Appeals awaiting action, held results by age (P-03), open readiness items, headcount variances, undelivered notices | FR-604, FR-702, FR-707 | P1 |
| C-02 | Cohorts and cohort overview | `/coordinate/cohorts`, `/[cohortId]` | Coordinator | List and summary | New cohort | Dates, policy, enrolment count, readiness, moderation state | FR-701 | P2 |
| C-03 | Cohort setup | `/coordinate/cohorts/new`, `/[cohortId]/setup` | Coordinator | Create cohort: dates, moderation policy, people | Create cohort; save | Programme, dates, required moderation policy with consequences, policy version history, enrolment and role summary | FR-701, FR-104, BR-04 | **P0** |
| C-04 | People | `/coordinate/cohorts/[cohortId]/people` | Coordinator | Enrol learners; assign and end facilitator, assessor, moderator roles | Add person | Roster by role, open allocations per person, conflict panel | FR-701, FR-104, FR-105 | P1 |
| C-05 | Readiness checklist | `/coordinate/cohorts/[cohortId]/readiness` | Coordinator | Track and assign open items | Assign item | Category, state, assignee, due date; includes "moderation policy confirmed" | FR-702 | P1 |
| C-06 | Moderation planning | `/coordinate/cohorts/[cohortId]/moderation`, `/cycles/new` | Coordinator | Plan, schedule, cancel, freeze and sample; watch the pending pool | Plan cycle; Freeze and sample | Pending pool by item, cycles by state, scope picker, scheduled start, hold age | FR-501, FR-506 | **P0** |
| C-07 | Cycle detail and sample record | `/coordinate/cohorts/[cohortId]/moderation/cycles/[cycleId]` | Coordinator | Audit view of the sample; allocations and reallocation | Reallocate item | Seed, rule version, population count and digest, strata counts, inclusion reasons, moderator allocations with exclusions, returns | FR-502 to FR-505 | P1 |
| C-08 | Exam attempts administration | `/coordinate/cohorts/[cohortId]/exams/[examId]/attempts` | Coordinator | See attempts; void and regrant after a sustained outage | Void attempt | Attempt state, submission kind, last save time, answers received in grace, void reason | FR-314, NFR-07 | P1 |
| C-09 | Notices | `/coordinate/notices`, `/new` | Coordinator | Send now or schedule to cohort, role group, or all; see delivery log | Send notice | Audience, schedule, delivery counts by state | FR-703 | P1 |
| C-10 | Stakeholder queries | `/coordinate/queries`, `/[queryId]` | Coordinator | Log, route, track to closure | Log query | Source, programme, owner, status, history | FR-704 | P2 |
| C-11 | Session logistics | `/coordinate/sessions/[sessionId]/logistics` | Coordinator | Venue, catering headcount, dietary, equipment; mark arranged; reconcile variance | Mark arranged | Default headcount and its source, confirmed headcount, captured attendance, variance flag | FR-705, FR-706, FR-707 | P2 |
| C-12 | Appeals administration | `/coordinate/appeals`, `/[appealId]` | Coordinator | Decide admissibility; grant script view; allocate reviewer | Admit; Allocate reviewer | Queue by state and age; grounds; release and notification evidence; candidate reviewers by AS-02 tier; excluded users with reasons | FR-604, FR-605, FR-606, FR-608 | **P0** |
| C-13 | Reports | `/coordinate/reports`, `/[reportType]` | Coordinator | Run and export scoped reports | Export | Report types in FR-708, scope (programme, cohort, date range), asynchronous export status | FR-708 | P1 |
| C-14 | Result corrections | `/coordinate/corrections` | Coordinator plus a second authorised user | Propose and approve a correction under dual control | Propose; Approve | Current decision, proposed decision, proposer, approver, reason | BR-03, P-12 | P2 |

#### System Administrator

| ID | Screen | Route | Roles | Purpose | Primary action | Key data shown | FRs | Pri |
|---|---|---|---|---|---|---|---|---|
| X-01 | Administration overview | `/admin` | Administrator | Items needing attention | Open item | Locked accounts, imports in progress, scheduled configuration changes, credential expiry | FR-103, FR-106 | P2 |
| X-02 | Accounts | `/admin/accounts`, `/new` | Administrator | Find, create accounts | New account | Name, email, status, roles, last sign-in | FR-103, FR-106 | P1 |
| X-03 | Account detail | `/admin/accounts/[profileId]` | Administrator | Edit, deactivate, reactivate, reset password, unlock | Save; Unlock; Send reset | Status, paused-sign-in state, change history | FR-103, FR-106, FR-107 | P1 |
| X-04 | Roles and allocations | `/admin/accounts/[profileId]/roles` | Administrator | Assign, change, end roles; see and move allocations; see named conflicts | Add role | Role assignments with scope and dates, open allocations, conflict panel, change history | FR-102, FR-104, FR-105, FR-107 | **P0** |
| X-05 | Bulk import | `/admin/imports`, `/new`, `/[batchId]` | Administrator | Import an intake; fix invalid rows; safe replay | Import valid rows | Row counts by outcome, error report, invitation progress, duplicate-file notice | FR-103 | P1 |
| X-06 | Configuration | `/admin/configuration`, `/[key]` | Administrator | Change settings with effective date; read version history | Record new value | Current value, effective from, actor, scheduled change, full history, what the change does not affect | FR-108, FR-109, NFR-09 | **P0** |
| X-07 | Department integration | `/admin/integration` | Administrator | Issue, rotate, revoke credentials | Issue credential | Credential ID, scopes, status, expiry, rotation overlap, last used, rejected request count | FR-110, FR-1002 | P1 |
| X-08 | API access log | `/admin/integration/access-log` | Administrator | Review what the Department read | Filter; export | Time, credential, route, status, record count, request ID | FR-110, FR-1006 | P2 |
| X-09 | Audit log | `/admin/audit` | Administrator | Reconstruct who changed what | Filter | Actor, acting role and scope, action, object, before and after, time | FR-107, NFR-02 | P1 |
| X-10 | Cohort archive | `/admin/cohorts` | Administrator | Archive when preconditions hold; otherwise see what blocks it | Archive cohort | Preconditions checklist: moderation signed off, no pending or held results, all appeal windows closed, no open appeal | FR-111, FR-112 | P2 |

### 5.2 P0 screen specifications

Each specification lists content blocks in reading order, the states that the prototype must show, and the Client Component islands (everything else renders on the server).

#### P0-01 Sign in (`/sign-in`, G-01)

| Aspect | Specification |
|---|---|
| Blocks | Institution name; H1 "Sign in"; email; password with show/hide; "Sign in"; "Forgot your password?"; help contact; appearance control in footer. |
| Behaviour | Works as a plain form post. Password managers and paste are allowed (WCAG 3.3.8). After sign-in: deep link, else `/learn` for learner-only users, else `/home`. |
| States | Default. Wrong details: one neutral message, "The email or password is not correct", never which one. Sign-in paused (ADR-026): "Too many attempts. Sign-in with a password is paused for a short time. You can reset your password now, or ask your administrator to unlock your account." (shown generically so it does not confirm that an account exists). Challenge shown after repeated failures, with a non-visual alternative. Deactivated account: same neutral message plus help contact. Session expired return: banner "You were signed out for security. Sign in to carry on where you left off." |
| Client islands | Show/hide password only. |
| FRs | FR-101, FR-106 |

#### P0-02 Notification centre (`/notifications`, G-05)

| Aspect | Specification |
|---|---|
| Blocks | H1; filter chips; list grouped by day; each row expandable to "How you were told". |
| Example row | "Your result for Task 3 is ready. Tuesday 22 September 2026, 14:05." Expanded: "In the LMS: 22 Sep 2026, 14:05. First opened by you: 22 Sep 2026, 18:40. Email to l.mokoena@example.org: delivered 22 Sep 2026, 14:06." |
| States | Empty; unread and read; email failed; email still sending; multi-role view with workspace tags; mandatory category note in preferences link. |
| Client islands | Row expand and mark-as-read (progressive enhancement; each row also links to a detail URL). |
| FRs | NFR-11, FR-203, FR-207, FR-511, FR-604, FR-611 |

#### P0-03 Learner home (`/learn`, L-01)

| Aspect | Specification |
|---|---|
| Block order | 1. "New results" cards, only when a released result has an open appeal window or an open resubmission: item, outcome, "You can appeal until the end of Tuesday 29 September 2026". 2. "Do next": overdue, then due within 7 days, each with due date and status. 3. "Today": sessions with Join button active from 10 minutes before start (assumption) and exam windows. 4. "Being assessed": submitted items awaiting a result, with the moderation explainer link. 5. Credit progress: "32 of 140 credits earned". |
| Rules | Nothing on this screen changes when a held decision is made (principle 1). Block 1 disappears when the appeal window and resubmission deadline have both passed; the result remains under Results. |
| States | New learner with nothing due; busy week; NYC with resubmission open; exam open now ("Open now, closes 12:00", with "Use a laptop or desktop computer" on phones); archived cohort (read-only banner). |
| Client islands | None required. |
| FRs | FR-304, FR-305, FR-316, FR-317, FR-318 |

#### P0-04 Task detail and submission (`/learn/tasks/[taskId]`, `.../submit`, L-03)

| Aspect | Specification |
|---|---|
| Blocks (detail) | Status tag and due date line ("Due Friday 4 September 2026 at 17:00 (SAST), in 3 days"); brief; assessment criteria or rubric (read-only); evidence requirements checklist; "Submit your work" or "Submit a new version"; version history. |
| Version history | One row per version, newest first: "Version 2, submitted Friday 4 September 2026 at 17:42, Late" with files, sizes, and receipt ID. A superseded version shows "Replaced by version 2"; it is never removed (FR-310). |
| Blocks (submit) | Step 1 Add files, one slot per evidence requirement, each with accepted types and size limit stated before selection (FR-311). Step 2 Review: "This will be version 2. Version 1 stays on record." and the late notice when applicable. Step 3 Receipt. |
| Upload row states | Waiting; Uploading 42%; Paused, no connection; Resuming; Uploaded; Checking file; Rejected with guidance; Expired, choose the file again. |
| Late flag | Before submission: a caution notice, "The due date has passed. You can still submit. Your work will be marked as late." followed by the configured late-policy sentence (FR-108, FR-309). After: "Late" tag on the version. Tone is `caution`, not `critical`. |
| States | Not started; upload in progress; interrupted and resumed; submitted on time; submitted late; being assessed; result ready (links to L-15); NYC with resubmission open, showing remediation actions and the deadline above the submit button (FR-317); conflict (submitted from another device). |
| Client islands | Upload widget (resumable uploads, progress, resume after reload). Everything else is server-rendered. |
| FRs | FR-308, FR-309, FR-310, FR-311, FR-317 |

#### P0-05 Exam pre-flight and start (`/learn/exams/[examId]`, L-11)

| Aspect | Specification |
|---|---|
| Blocks | Exam title and unit; window and duration in a sentence; shortened-time notice when the window close shortens the attempt; attempts used of allowed; "Check this device" list; "What happens in exam mode" (what is switched off, FR-901); "What is recorded" (left the window, switched tab, left fullscreen; not camera, microphone, or screen); acknowledgement checkbox (assumption); Start exam. |
| Device checks | Desktop or laptop browser; fullscreen available; page visibility available; this device can keep a safety copy (IndexedDB write test); connection to the LMS (good, slow, none). Each shows Pass, Problem, or Checking, with a one-line fix. |
| Denials (FR-312) | Not yet open: "This exam opens on Wednesday 14 October 2026 at 09:00." Closed: "This exam closed on ... at 12:00." Not enrolled. No attempts left. Unsupported device: the mobile gate in section 9.4. |
| States | Before window; open and all checks pass; open with a failing check (Start disabled, reason named); shortened time; resume (an active attempt exists: "You have an exam in progress. Time left 01:12. Resume exam"). |
| Client islands | Device check and Start button. |
| FRs | FR-312, FR-901 |

#### P0-06 Exam mode (`/exam/[attemptId]`, L-12)

Fully specified in section 8. Prototype states: answering; saved on this device only; saved; offline banner; integrity warning overlay; takeover (`lease_lost`); 5-minute warning; time up and sending; submitted receipt; closed with partial answers.

#### P0-07 Released result (`/learn/results/[resultId]`, L-15)

| Aspect | Specification |
|---|---|
| First screenful, in order | 1. Item title and unit. 2. Outcome as text: "Competent" or "Not yet competent". 3. Appeal line (SRS 5.3): "You can appeal this result until the end of **Tuesday 29 September 2026**. 7 days left." with Lodge an appeal. 4. When NYC: "What to do next" with remediation actions and "Resubmit by the end of **Tuesday 6 October 2026**" with Resubmit (FR-317). |
| Below | Marks per criterion where applicable (criterion, mark, maximum, assessor comment); overall feedback; assessor name and "Released on 22 September 2026 at 14:05"; "How you were told" line (NFR-11); decision history when more than one decision exists (BR-03): "Released 22 Sep 2026: Not yet competent. Appeal decision 5 Oct 2026: Competent (current)." |
| Appeal line variants | Open; last day ("Today is the last day to appeal"); closed: "The time to appeal closed at the end of Tuesday 29 September 2026." (FR-603); appeal lodged: link to tracker; remark already used: "A remark has already been decided for this result. That decision is final." (FR-613). |
| Rules | The decided date is never shown to a learner. Only released dates appear. Marks never appear without the outcome text. |
| States | Competent; NYC with remediation; NYC on last appeal day; window closed; amended on appeal (up and down); corrected (P-12). |
| Client islands | None. |
| FRs | FR-316, FR-317, FR-603, NFR-11 |

#### P0-08 Lodge appeal (`/learn/results/[resultId]/appeal/new`, L-16)

| Aspect | Specification |
|---|---|
| Blocks | Result summary with appeal closing day repeated; type choice as two radio cards; grounds textarea; review; confirmation. |
| Type cards | "See my marked script": "See your work next to the marks for each criterion and the assessor's feedback. This does not change your mark and does not give you more time to ask for a remark." "Ask for a remark": "Someone who did not mark your work will mark it again. **Your mark can go up, stay the same, or go down.** You can ask for a remark once per result. The reviewer's decision is final." (AS-04, P-08, BR-02) |
| Grounds | Label: "Why do you think the mark does not match the work you submitted?" Required (FR-602). Minimum 50 characters (assumption) with a live, polite character count. Hint with two short examples. |
| Remark confirmation | Review step with a required checkbox: "I understand my mark can go down as well as up." |
| After lodging | "We have received your appeal. Reference AP-2026-0142. Lodged Wednesday 23 September 2026 at 09:12. Your coordinator will check it first. You should hear from us within 5 working days." Turnaround value is configuration-driven (assumption: not in FR-108; wording is a template). (FR-604) |
| States | Default; window closed on arrival (form replaced with the FR-603 message); window closes while the form is open (server refuses; the typed grounds are kept on screen so they can be copied; message names the closing day); remark unavailable because one was already admitted (only the script option is offered); duplicate open appeal of the same type (link to it); network retry (same `client_appeal_id`, so no duplicate). |
| Client islands | Character counter only. |
| FRs | FR-601, FR-602, FR-603, FR-604 |

#### P0-09 Credits record (`/learn/credits`, L-19)

| Aspect | Specification |
|---|---|
| Blocks | Summary sentence: "You have earned 32 of 140 credits. 108 credits are still outstanding." Progress element with text equivalent. Units list grouped Earned / Outstanding. Credit history (ledger) list. |
| Unit row | Unit title, credit value, state: "Earned on 22 Sep 2026" / "In progress: 1 of 2 required assessments competent" / "Not started". Expanding shows the required assessable items and each one's released outcome (P-07). |
| Held results | A required item whose result is not released shows "Being assessed". It contributes nothing and hints at nothing (FR-804). |
| History | Append-only entries: "+8 credits, Unit 3, 22 Sep 2026, award" and, after an appeal, "-8 credits, Unit 3, 5 Oct 2026, reversal after appeal decision". Totals are never silently rewritten (FR-803). |
| Out of scope note | "This page is a record of credits. It is not a certificate or a statement of results." (SRS section 8) |
| States | Nothing earned yet; partially earned unit; reversal present; archived cohort. |
| FRs | FR-318, FR-801, FR-802, FR-803, FR-804 |

#### P0-10 Facilitator submission dashboard (`/teach/submissions`, F-08)

| Aspect | Specification |
|---|---|
| Blocks | Cohort and task filters; status filter chips with counts ("Outstanding 23", "Submitted 71", "Late 6"); search by learner; table; selection bar; Export. |
| Default view | One task selected (the task with the nearest due date), learners as rows, sorted Outstanding first. This answers "who has not submitted" without interaction (SRS 2.2). |
| Columns | Learner; status; submitted at; version; late; last reminder sent. Priority on narrow screens: learner, status, late. |
| Matrix view | Desktop only (at least 1024 px): learners by tasks grid with a status mark per cell and a text alternative per cell. |
| Actions | Select rows (checkboxes; "Select all outstanding"), then "Send reminder" opens F-10 with recipients filled in. Row click opens F-09. Export produces CSV for the current filter (FR-211); large exports are asynchronous and arrive as a notification. |
| Boundaries | No outcomes, marks, or integrity data appear here: facilitators see operational status only (data model RLS). |
| States | Before due date; after due date; all submitted; filtered empty; reminder sent confirmation ("Reminder sent to 23 learners and logged on each learner's record"). |
| Client islands | Row selection and filter chips (the filters also work as GET parameters). |
| FRs | FR-210, FR-211, FR-212 |

#### P0-11 Assessor marking workspace (`/assess/instances/[instanceId]`, A-02)

| Aspect | Specification |
|---|---|
| Layout at 1280 px and above | Two panes. Left (flexible): evidence viewer with file tabs and a version switcher. Right (420 to 480 px): tabbed panel: Rubric, Feedback, Integrity (exams only), History. A sticky decision bar spans the bottom. |
| Header | Learner name and number; item; "Version 2 of 2, submitted 4 Sep 2026 at 17:42, Late"; cohort with policy tag; instance state tag; result state tag (section 7.3). |
| Evidence and versions | Files listed against evidence requirements (FR-402). Version switcher shows every version; earlier versions open read-only with a banner "You are viewing version 1. The version being assessed is version 2." (FR-310) |
| Rubric | One row per criterion: descriptor, level selector or mark input, comment. Running total where marks apply. Draft saves automatically to `marking_drafts`; indicator "Draft saved 10:42" (FR-403). |
| Integrity | Event list with times and types, the attempt's threshold snapshot, "Flagged: more events than the threshold" when applicable, answers received in grace. Judgement control: "Are these events material to this assessment?" Not material / Material, with reasons (FR-406). A fixed note: "This log is advisory. It cannot set the outcome." There is no control that derives an outcome from the log (FR-407). A judgement is required before finalising when the attempt is flagged (assumption). |
| Decision bar | Outcome: Competent / Not yet competent; justification (required, FR-404). When NYC: remediation actions (required) and resubmission period in days after release (required, FR-405). Helper text: in a moderated cohort "The deadline date is set when the result is released"; in an unmoderated cohort "If you finalise today the learner must resubmit by the end of Thursday 24 September 2026". Buttons: Save draft; Finalise decision. |
| Finalise confirmation | Moderated cohort: "This decision will be **held**. Lerato will not see it until moderation of this cohort is signed off. You cannot edit it afterwards; a moderator can return it for re-marking." Unmoderated: "This **releases** the result to Lerato now and starts the 7-day appeal window. You cannot edit it afterwards." (FR-408) |
| After finalise | Banner: "Decided 10 Sep 2026 at 11:20. Held for moderation." or "Decided and released 10 Sep 2026 at 11:20. Appeal window closes at the end of 17 Sep 2026." The form becomes a read-only record. |
| Re-mark mode (FR-410) | Banner with the moderator's required corrections and deadline. The original decision is shown read-only beside the new form. Button: "Finalise re-mark". Confirmation: "This records a new decision. The original stays on record." The result stays held. |
| States | To mark; draft in progress; flagged exam; held; released; returned for re-mark; no longer allocated to you (403 after reallocation: read-only with explanation); stale version (409: reload with the draft preserved). |
| Narrow screens | Below 1280 px the panes stack: a sticky section switcher (Evidence, Rubric, Feedback, Integrity, History) above the content, decision bar still sticky. Below 768 px the decision bar collapses to one button that opens the decision sheet. |
| Client islands | Evidence viewer, rubric form with draft autosave, decision sheet. |
| FRs | FR-402 to FR-408, FR-410 |

#### P0-12 Moderator sample item review (`/moderate/cycles/[cycleId]/items/[itemId]`, M-03)

| Aspect | Specification |
|---|---|
| The FR-507 rule | Submission, evidence, rubric, assessor's marks, and assessor's decision are on **one route with no navigation between them**. At 1280 px and above all five are visible at once: left pane evidence viewer (submission and evidence files); right pane a single scroll with, in order, the decision summary (outcome, justification, assessor, decided date), then the rubric with the assessor's mark and comment beside every descriptor. |
| Header | "Item 7 of 22"; learner; item; inclusion reason tag: "Included because: Not yet competent" / "First-time assessor" / "Random within stratum: Assessor T. Nkosi, Competent, Unit 3" (FR-502, FR-503); previous and next item. |
| Independence line | "You did not assess this work. Assessor: Thandiwe Nkosi." If the server ever returns `separation_of_duties_conflict` on opening or recording, the page is replaced by the conflict panel (section 10.5) and no evidence is shown. |
| Finding form | Agree / Disagree, reasons required for both (FR-508). Choosing Disagree reveals "Return to assessor": required corrections and a deadline date (FR-509), with the note "The assessor and the coordinator are notified. This cohort cannot be signed off until the item is re-marked and you have reviewed it again." |
| After a re-mark | The item returns with state "Re-marked, review again". Both decisions are shown, newest first, with the superseded one labelled "Original decision (replaced)". Findings history lists every finding (append-only). |
| Integrity | For exam items the integrity log and the assessor's judgement are shown read-only under the decision summary (assumption: part of "evidence" for FR-507). |
| States | To review; agreed; returned, waiting for assessor; re-marked, review again; reallocated away from you (read-only). |
| Narrow screens | Same stacking rule as P0-11. The decision summary stays pinned as a collapsed one-line bar ("Assessor decided: Not yet competent, 61 of 100") so marks and decision remain in view while scrolling evidence. |
| Client islands | Evidence viewer, finding form. |
| FRs | FR-507, FR-508, FR-509 |

#### P0-13 Cycle sign-off (`/moderate/cycles/[cycleId]/sign-off`, M-04)

| Aspect | Specification |
|---|---|
| Blocks | Cycle summary (scope, population 96 results, sample 22 items, frozen on date); checklist; outstanding list; eligibility line; statement; Sign off and release. |
| Checklist | "All sample items concluded: 19 of 22". "No returned items outstanding: 3 outstanding". "Cohort observations recorded: yes" (optional, FR-508). |
| Outstanding list (FR-510) | One row per blocking item: learner, item, assessor, returned on, due date, overdue tag, state ("Waiting for assessor" / "Re-marked, waiting for your review"), link. The button is disabled and the reason is stated in text next to it, not only through the disabled state. The server's `details` list is rendered the same way if sign-off is refused after a race. |
| Eligibility (P-05) | "You can sign off this cycle: you took no assessment decision on any sampled result." Otherwise: "You cannot sign off this cycle because you assessed 2 of the sampled results. Anil Naidoo can sign off." |
| Confirmation | "Signing off releases **96 results** to learners in 2026 Intake B now. Each learner is notified. Each learner's 7 days to appeal start now and end at the end of Tuesday 29 September 2026. This cannot be undone." Required sign-off statement text box. (FR-511, BR-04, BR-05) |
| After | "Signed off on 22 Sep 2026 at 14:05. 96 results released. 96 notifications created." Results finalised after the freeze are called out: "11 newer decisions are waiting for the next cycle." (P-06) |
| States | Blocked with outstanding returns; ready; not eligible; signed off; stale (409: another moderator acted; reload). |
| FRs | FR-510, FR-511 |

#### P0-14 Cohort setup (`/coordinate/cohorts/new`, `/[cohortId]/setup`, C-03)

| Aspect | Specification |
|---|---|
| Create flow | One page with sections (not a multi-page wizard, so it can be saved and resumed): Details (programme, cohort name, start and end dates); Moderation policy; People (learners enrolled count with link to import or add; facilitators, assessors, moderators); Review. |
| Moderation policy (P-01, BR-04) | Required radio group with **no default**. "Moderated: every result in this cohort is held until a moderator signs off a moderation cycle. Learners see nothing until then." "Not moderated: each result is released to the learner as soon as the assessor finalises it." Below: "You can change this later only while no results are waiting or held." |
| Changing policy later | Shows the policy version history (version, value, actor, date). A refused change names the blocker: "You cannot change to Not moderated: 14 results are waiting for moderation and 96 are held in cycle 'Term 3 tasks'." |
| People section | Adding a moderator who is also an assessor in the cohort is allowed and shows an advisory: "Thandiwe Nkosi also assesses in this cohort. She will never be given items she assessed (BR-01)." Ending a role with open allocations is refused with the conflict panel (FR-105). |
| Readiness link | Saving creates the readiness item "Moderation policy confirmed" as done (FR-702). |
| States | New; saved draft (assumption); active; policy change refused; archived read-only. |
| FRs | FR-701, FR-104, FR-105, BR-04 |

#### P0-15 Moderation planning (`/coordinate/cohorts/[cohortId]/moderation`, C-06)

| Aspect | Specification |
|---|---|
| Blocks | Pending pool ("Decided and waiting for a cycle"): per assessable item, the count of held results not yet claimed and the age of the oldest, with the P-03 alert when it exceeds the configured threshold. Cycles list by state. Plan a cycle. |
| Plan form (P-02) | Name; scope: pick assessable items or whole units, optional period; start: "When I choose" or "Automatically on" date and time (FR-501); sampling rule version in force (read-only, from FR-108); moderators available, with a warning if any item in scope has no eligible moderator because every moderator assessed it. |
| Scope conflict | "Task 3 is already in cycle 'Term 3 tasks', which is not finished. An item can be in one open cycle at a time." |
| Freeze and sample | Confirmation: "This locks the 96 results that are waiting now and draws the sample. It cannot be undone or redrawn. Decisions finalised after this moment wait for the next cycle." (FR-506). Result panel: population 96; sample 22; percentage rule 15%; mandatory inclusions: 6 NYC, 4 first-time assessor; strata table; seed and rule version with Copy; link to C-07 (FR-502, FR-503, FR-505). |
| Cancel | Only while Planned: "Cancel this cycle. Results stay waiting." After freeze the action is absent and the page says why. |
| States | No cycles and empty pool; pool with ageing alert; planned manual; planned scheduled; sampled; in review; waiting for re-marks; signed off; cancelled. |
| FRs | FR-501, FR-506 (and read-only FR-502, FR-503, FR-505) |

#### P0-16 Appeals administration (`/coordinate/appeals`, `/[appealId]`, C-12)

| Aspect | Specification |
|---|---|
| Queue | Columns: reference, learner, item, type, state, lodged, age in days, owner. Default filter "Needs my action" (Lodged, Being checked, Admitted and unallocated). Age is prominent because there is no statutory clock on the institution but there is a promise in the receipt (FR-604). |
| Detail header | Learner, item, type, lodged time, deadline snapshot ("Lodged inside the window: released 22 Sep 2026 14:05, window to end of 29 Sep 2026"), release notification evidence (NFR-11). |
| Grounds | The learner's text, verbatim. |
| Admissibility (FR-605) | Admit / Record as inadmissible with a required reason; preview of the learner notification. For a script request, Admit is labelled "Grant script view" (FR-606). |
| Reviewer allocation (FR-608, AS-02, P-10) | Candidate list in three labelled tiers: 1. Independent qualified internal reviewers. 2. Cohort moderator. 3. Qualified assessors from other cohorts ("allocated to this appeal only"). Each candidate: name, roles, open review count. **Excluded people are shown, disabled, under "Cannot review this appeal", each with the reason**: "Thandiwe Nkosi: made the original assessment decision on 6 Aug 2026." "Bongani Sithole: assessed the resubmission (version 2) on 3 Sep 2026." Informational notes that do not exclude are shown too: "Anil Naidoo moderated this item on 18 Sep 2026 (agreed)." |
| Refusal | If the server answers `separation_of_duties_conflict` (stale list or direct request), the conflict panel names the decision, the role, and the allocation from `details.conflicts[]`, and the list reloads. |
| States | New appeal; inadmissible recorded; script granted and first viewed (view log shown); remark admitted and unallocated; allocated; under review; concluded; no eligible reviewer in any tier (blocking notice with "Assign a qualified assessor from another cohort" link to C-04). |
| FRs | FR-604, FR-605, FR-606, FR-608 |

#### P0-17 Roles and allocations (`/admin/accounts/[profileId]/roles`, X-04)

| Aspect | Specification |
|---|---|
| Blocks | Person header (name, status); Role assignments table (role, scope type and name, effective from and to, assigned by); Add role; Open allocations table (what this person is currently allocated to: marking items, sample items, appeal reviews, with counts and links); Change history (FR-107). |
| Add role form | Role; scope type (Global, Programme, Cohort, Unit); scope; effective from; optional end. Pre-check advisory when the person already holds the opposite role in the same scope. |
| Named conflict (FR-104) | Blocking panel, prototype content: H2 "This would break separation of duties". "Thandiwe Nkosi cannot be the moderator for this item because she assessed it." Then a definition list from `details.conflicts[]`: Decision: "Assessment decision on Task 3, Lerato Mokoena, 10 Sep 2026"; Role: "Assessor"; Allocation: "Sample item 7, cycle 'Term 3 tasks', 2026 Intake B". Actions: "Choose another moderator"; "View the decision". No retry button (`retryable: false`). |
| Open allocations (FR-105) | Ending or narrowing a role, or deactivating, is refused with `open_allocations`: "Thandiwe still has work that depends on this role." List from `details.allocations[]`: "12 items to mark in 2026 Intake B", "1 item returned for re-marking, due 25 Sep 2026", each with "Reallocate". When the list is empty the end-role action succeeds. |
| Where the two errors arise | The architecture enforces separation of duties in the allocation commands and `open_allocations` on role changes (API design). This screen shows both, because an administrator meets both here: the first when reallocating work from this page, the second when ending a role. The same conflict panel component is used on C-04, C-07, and C-12. See section 12, Q4. |
| States | Single-role user; multi-role user; add role with advisory; named separation-of-duties conflict; open-allocations refusal; role ended; change history. |
| FRs | FR-102, FR-104, FR-105, FR-107 |

#### P0-18 Configuration with version history (`/admin/configuration`, `/[key]`, X-06)

| Aspect | Specification |
|---|---|
| Index | Groups matching FR-108: Moderation sampling (rule, percentage, strata, mandatory inclusions); Exam integrity (event threshold, return grace seconds, acceptance grace seconds); Appeal window (days); Late submission policy; Credit values per unit; File upload limits (types, maximum size). Each row: current value, effective from, last changed by, "Scheduled change" tag when a future version exists. |
| Detail | Current value block; "Record a new value" form: new value, effective from (now or a future date and time), reason (required; assumption); before and after review; confirm. There is no edit or delete of any version. |
| History (FR-109, NFR-09) | Table, newest first: version, value, effective from, effective to, changed by, reason, recorded at. Superseded rows are labelled "Superseded", never removed. A scheduled version can be cancelled before it takes effect, which is itself recorded (assumption). |
| What a change does not affect | A fixed explanatory block per key, because values are snapshotted: "Exams already started keep the integrity settings they started with." "Results already released keep the appeal closing day they were given." "Credits already awarded keep the credit value in force at award." "Samples already drawn keep their rule version." |
| AS-01 note | On the sampling percentage: "This value is supplied in writing by the quality-assurance authority. Record the reference in the reason." |
| States | Index; detail with history; scheduled change pending; validation error (out-of-range value); stale version (409). |
| FRs | FR-108, FR-109, NFR-09 |

---

## 6. Key flows

Notation: **D** is a decision point, **E** is an error or edge state. API routes are from `LMS-api-design.md`. Error codes in `code style` that are not in the API design are proposed names, marked "(assumed code)" in section 10.4.

### 6.1 Flow A: submit coursework, including an interrupted upload and a late submission

Actor: Lerato, on her phone, prepaid data. Serves FR-308 to FR-311.

1. From `/learn` she opens "Task 3: Workplace records portfolio" (`/learn/tasks/[taskId]`). The page shows the brief, criteria, due date line, evidence requirements, and status "Not started".
2. She selects "Submit your work" (`.../submit`).
   - **D1 Is the due date in the past?** Yes: the caution notice from P0-04 appears above the file slots, with the late-policy sentence. She can continue (FR-309). No: if the due time is within 30 minutes, a countdown line appears: "Due in 12 minutes. Work submitted after 17:00 is marked as late."
3. For each evidence requirement she selects a file using a button (drag and drop is an optional extra on desktop). The slot states the accepted types and the size limit before she chooses.
   - **E1 Wrong type or too large** (checked in the browser first, then by the server when the upload is authorised): the slot shows "This file is 48 MB. The limit is 25 MB. Try saving it as a PDF, or take photos at a lower quality." The file is not uploaded (FR-311).
   - **E2 Upload limit reached** (429, 30 per hour): "You have uploaded a lot of files in the last hour. You can upload again after 14:35." The time comes from `Retry-After`.
4. The total size is shown before upload starts: "About 18 MB will be uploaded." (relevant on prepaid data).
5. Upload begins (resumable protocol). Each file row shows percentage and "Keep this page open while your files upload."
   - **E3 Connection lost mid-upload**: the row changes to "Paused, no connection. We will carry on automatically when you are back online." On reconnect: "Resuming" and the percentage continues from where it stopped, not from zero.
   - **E4 She closes the browser or the phone restarts**: on returning to the task, a notice appears: "You have an unfinished upload: Portfolio.pdf (62%). Resume / Remove." The browser asks her to pick the same file again only if it cannot regain access to it (platform limitation); the uploaded part is kept.
   - **E5 Upload took too long** (intent expired): "This upload took too long and has expired. Please choose the file again." Nothing was submitted.
6. Each completed file is finalised (`POST /api/files/{intent_id}/finalise`) and shows "Uploaded".
   - **E6 Finalise mismatch** (size or type differs from what was declared): "This file could not be accepted. Choose it again." with the reference.
7. Review step: files listed against requirements; "This will be version 1." On a later submission: "This will be version 2. Version 1 stays on record." (FR-310).
   - **D2 Mandatory evidence missing?** Submit stays disabled and the missing requirement is named in text (assumption; section 12, Q10).
8. She selects "Submit version 1" (`POST /api/submissions` with `client_submission_id` and the expected version).
   - **E7 Network fails after sending**: the button changes to "Checking whether your work went through..." and the same command is retried with the same identifier. The UI never says "failed" while the outcome is unknown (principle 3). A repeat returns the original receipt.
   - **E8 Version conflict (409)**: "You already submitted version 2 from another device at 16:52. View it, or submit another version."
   - **E9 Due time passed while she was uploading**: the server decides lateness. The receipt says "Late"; the review step had warned her (step 2).
9. Receipt (same route, final step; also reachable later from the version history): "We have received your work. Version 1. Friday 4 September 2026 at 16:48 (SAST). On time. Receipt SUB-2026-004812." Files and sizes listed. "Your files are being checked" while the scan runs. A notification and an email copy are created (assumption).
10. Task status becomes "Submitted", then "Being assessed" once the instance is queued. It stays "Being assessed" through marking, hold, moderation, and any re-mark (section 7.1).
    - **E10 Scan rejects a file later** (assumption): notification "One of your files for Task 3 could not be opened. Please submit a new version." The version stays on record, labelled "File problem".

### 6.2 Flow B: sit an exam end to end

Actor: Lerato, shared laptop at the training centre. Serves FR-312 to FR-315, FR-901 to FR-905, NFR-07, P-13, ADR-023.

**Before the clock starts**

1. From `/learn` or the calendar she opens "Unit 5 summative exam" (`/learn/exams/[examId]`).
   - **E1 On a phone or tablet**: the mobile gate (section 9.4) replaces the Start area. Everything else on the page remains readable, so she can prepare.
   - **E2 Outside the window, not enrolled, or no attempts left** (FR-312): Start is replaced by the reason with dates (P0-05).
2. The device check runs automatically. **D1 All checks pass?** No: Start is disabled and the failing check names a fix ("Fullscreen is blocked in this browser. Try Chrome, Edge, or Firefox on a laptop or desktop computer.").
   - **D2 Window close shortens the attempt?** "This exam closes at 12:00. If you start now you will have 1 hour 25 minutes, not 2 hours."
3. She reads "What happens in exam mode" and "What is recorded", ticks the acknowledgement, and selects "Start exam".
4. **Order of operations (important):** the click handler first requests fullscreen. Only when the browser confirms fullscreen does the client call `POST /api/exams/{exam_id}/attempts`. A learner who cannot enter fullscreen has therefore not started the clock.
   - **E3 Fullscreen refused or dismissed**: "Your browser did not go fullscreen, so the exam has not started and no time has been used. Select Start exam to try again."
   - **E4 Start request fails** (network): fullscreen exits, "The exam has not started. Check your connection and try again." A retry with the same `client_attempt_id` returns the same attempt if the first call did succeed, and the screen then shows the true remaining time.
5. The response supplies `expires_at`, server time, grace, the question manifest, and the integrity policy. The client computes its clock offset from server time; the device clock is never trusted.

**During the exam**

6. `ExamShell` renders one question per page with the navigator, timer, and save status (section 8).
7. Every edit is written to IndexedDB at once: status "Saved on this device". About every ten seconds the changed answers go to `PUT /api/exam-attempts/{id}/answers`; on acknowledgement: "Saved 10:42".
8. **Integrity event** (she Alt-Tabs, a pop-up takes focus, or she presses Esc):
   1. The event is logged with a timestamp (FR-902) and sent in the next batch.
   2. On return, an overlay covers the questions: "You left the exam window at 10:42. This has been recorded (2 so far). Your assessor will see the record and decide whether it matters. Please stay in the exam window until you submit." Button: "Return to the exam" (the click re-requests fullscreen, which browsers only allow from a user action) (FR-903).
   3. **D3 Back within the configured grace period?** Either way the attempt continues (FR-904, FR-407). A later return is logged as a different event type; the learner wording is the same.
   4. **D4 Event count now above the threshold?** The overlay adds once: "Your attempt has been marked so that your assessor looks at this record. This does not decide your result." (FR-905). The threshold number is never shown.
   5. The timer keeps running throughout and the overlay says so: "The timer is still running."
9. **Connection loss**:
   1. A save fails or the browser reports offline. Status becomes "Not saved to the server. Your answers are being kept on this device." An offline banner appears under the exam bar: "No connection. Carry on answering. The timer is still running."
   2. She keeps answering; every edit goes to IndexedDB. Questions changed since the last acknowledged save carry a small "on this device only" marker in the navigator.
   3. On reconnect the whole backlog is sent in one request. Status: "Saved 10:51". The banner is replaced for five seconds by "Back online. All answers saved." (announced politely).
   4. **E5 Browser crash or accidental refresh**: reopening `/exam/[attemptId]` shows the resume interstitial: "Your exam is still running. Time left 01:12:40. Resume exam." The click requests fullscreen and calls `POST .../lease`; the server returns persisted answers; newer local edits are merged by sequence number. "We restored your answers. Last saved at 10:42." (FR-314, NFR-07). The timer shows true remaining time; it did not pause (P-13).
   5. **E6 This device cannot keep a safety copy** (IndexedDB unavailable or full): persistent critical notice: "This device cannot keep a safety copy of your answers. Your answers are only safe when you see 'Saved'. Do not close this window. Tell your invigilator or coordinator." (The pre-flight check normally prevents this.)
10. **Second tab**: she opens the exam link in another tab.
    1. The new tab shows the resume interstitial with an extra line: "If the exam is open in another tab or window, that one will stop working."
    2. On "Resume exam" the new tab acquires the lease. The old tab's next save returns `409 lease_lost`.
    3. The old tab replaces the exam with a takeover screen: "This exam is now open in another tab or window. You can only work in one place at a time. Answers saved before 10:42 are safe." Actions: "Continue here instead" (acquires a new lease and fences the other tab) and "Close this tab". No answers are shown on the takeover screen. `lease_lost` is not retryable, so there is no "Try again".
11. **Low-time warnings**: at 15, 5, and 1 minute remaining (assumption) the timer changes state and a polite announcement is made. No modal; nothing steals focus.

**The end of the attempt**

12. **D5 She submits before time**: "Review and submit" shows the summary: answered 38 of 40, 2 unanswered (linked), 3 marked to come back to. Confirmation dialog: "Submit your exam? You cannot change your answers after this." (WCAG 3.3.4). `POST .../submit` carries the final batch and `client_submission_id`.
    - **E7 Offline at submit**: "We cannot reach the server. Your answers are kept on this device. We will keep trying until the exam closes. Do not close this window." Automatic retry with backoff; the same identifier makes a duplicate impossible.
13. **D6 Timer reaches zero**:
    1. A few seconds before zero the client starts its final flush in the background.
    2. At zero all inputs become read-only and an overlay shows: "Time is up. Sending your answers..."
    3. The client calls submit. The server accepts it until `accept_until`; answers that arrive in that grace window are kept and flagged for the assessor as "received in grace". The grace is never advertised as extra time and the visible timer never counts it.
    4. **E8 Offline at zero**: "Time is up. We could not reach the server. Answers saved before 11:28:40 are already safe. Keep this window open; we are still trying to send the rest."
    5. **E9 Still offline when the grace ends**: the server finalises the attempt from the persisted answers (automatic submission, FR-313). When the connection returns, the save call comes back as the typed `closed` result with the receipt, and the screen shows: "The exam has closed. Your answers up to 11:28:40 were submitted automatically. Anything typed after that stayed on this device and could not be sent. If you lost your connection for a long time, tell your coordinator what happened." The coordinator may void and regrant (C-08, P-13); the UI does not promise it.
14. **Receipt** (`/exam/[attemptId]/receipt`), fullscreen exits: "Your exam has been submitted and locked. Receipt EX-2026-000931. Submitted Wednesday 14 October 2026 at 10:58 (SAST)." or "Submitted automatically when time ran out at 11:30." Answered count; "3 moments when you left the exam window were recorded. If something outside your control caused them, tell your coordinator."; what happens next ("You will be notified when your result is ready."). Button: "Back to the LMS" (FR-315).
15. Any later visit to `/exam/[attemptId]` redirects to the receipt. A repeat submit returns the original receipt.
16. **E10 Voided attempt** (coordinator, after a sustained outage): the exam list shows "This attempt was cancelled by your coordinator on 14 October 2026. You have a new attempt." with the reason if the coordinator chose to share it (assumption). The voided attempt remains listed for transparency.

### 6.3 Flow C: assess, then held or released

Actor: Thandiwe. Serves FR-401 to FR-408.

1. `/assess` lists her queue for Intake B: flagged exam attempts first, then oldest submitted. Each row shows version, late tag, and integrity flag (FR-401, FR-905).
   - **E1 She follows a link to work outside her scope**: not-found page, "This item is not in your allocation." The attempt is logged (FR-401). Nothing about the item is revealed.
2. She opens an item (`/assess/instances/[instanceId]`). Instance state becomes "Marking". The workspace shows evidence, version history, and the integrity tab for exams (FR-402).
3. She scores each criterion and writes feedback. The draft saves automatically; she may leave and return (FR-403).
   - **E2 Two tabs editing the same draft** (409 on version): "This draft was changed in another tab at 10:40. Reload to see the latest." Her unsaved text in this tab is kept on screen so it can be copied.
4. **D1 Exam item with integrity events?** She reads the log and records a judgement, Material or Not material, with reasons (FR-406). The UI offers no link between this judgement and the outcome control (FR-407).
5. She selects an outcome and writes the justification (FR-404).
   - **D2 Not yet competent?** Remediation actions and the resubmission period (in days after release) become required (FR-405).
6. "Finalise decision" opens the confirmation that states the consequence for this cohort (P0-11).
7. `POST /api/assessment-instances/{id}/decisions`.
   - **D3 Cohort policy** (decided by the server, FR-408): `moderated` gives `held`; `not_moderated` gives `released` with `released_at` and the appeal closing day.
   - **E3 Validation refused** (missing criterion, missing remediation): the error summary at the top links to each field.
   - **E4 No longer the allocated assessor** (403 after reallocation): "This item was reallocated to Bongani Sithole on 9 Sep 2026. Your draft is kept for reference but cannot be finalised."
8. Result banner and queue update:
   - Held: "Decided. Held for moderation. The learner cannot see this yet." The item moves to `/assess/cohorts` under Intake B, "Waiting for a moderation cycle" (FR-409).
   - Released: "Decided and released. The learner has been notified. Appeal window closes at the end of 17 Sep 2026."
9. The learner sees nothing new in the held case. In the released case they receive the notification and the result view.

### 6.4 Flow D: moderation cycle, from plan to release

Actors: Zanele (coordinator), Anil (moderator), Thandiwe and Bongani (assessors). Serves FR-501 to FR-511, FR-409, FR-410, P-01 to P-06.

1. **Plan.** On `/coordinate/cohorts/[cohortId]/moderation` Zanele sees the pending pool: "Task 3: 96 decided and waiting; oldest 4 days." She selects "Plan a cycle", names it "Term 3 tasks", picks Task 3 as scope, and chooses "Automatically on Monday 14 September 2026 at 09:00" (FR-501).
   - **E1 Scope overlap**: "Task 3 is already in cycle '...', which is not finished." (422, named.)
   - **E2 Wrongly planned**: "Cancel cycle" is available only while Planned. Results stay in the pool.
   - **E3 An item in scope has no eligible moderator** (every moderator in the cohort assessed it): warning at planning time and a blocking notice after sampling, with a link to assign another moderator (C-04).
2. **Freeze and sample.** At the scheduled time the system freezes and samples with a server-generated seed; or Zanele selects "Freeze and sample" and confirms (P0-15). One transaction: the 96 pending results are claimed as the population, the sample is drawn, and moderators are allocated with exclusions (FR-502 to FR-506).
   - The cycle page now shows the sample record: population 96, sample 22, strata counts, mandatory inclusions, seed, rule version, digest (FR-505). Items Anil assessed (none here) would be allocated to another moderator and listed as such (FR-504).
   - Decisions finalised after this moment appear in the pending pool under "Waiting for the next cycle" (P-06).
   - Assessors see Intake B as "Held: in moderation, 22 items sampled, 0 returned to you" (FR-409). Learners see no change.
3. **Review.** Anil opens `/moderate/cycles/[cycleId]`, then item 1 (P0-12). For each item he records Agree or Disagree with reasons (FR-508).
   - **E4 Conflict on open** (should not occur, shown if it does): the conflict panel replaces the item; the coordinator is prompted to reallocate.
4. **Return.** On item 7 he disagrees and returns it: required corrections, deadline Thursday 17 September 2026. Thandiwe and Zanele are notified (FR-509). Cycle state becomes "Waiting for re-marks (1 outstanding)".
5. **Re-mark.** Thandiwe sees the item under "Returned to me" with the corrections and deadline. She re-marks in the workspace's re-mark mode and finalises; a new decision supersedes the original, which stays on record; the result stays held (FR-410, BR-03).
   - **E5 Deadline passes**: the item shows "Overdue" to Thandiwe, Anil, and Zanele. Nothing is released automatically. Zanele may reallocate the assessor.
6. **Review again.** The item returns to Anil as "Re-marked, review again". He agrees. Item concluded.
7. **Observations.** Anil records cohort-level observations for the coordinator (FR-508); Zanele reads them on the cycle detail.
8. **Sign-off attempt while blocked.** Anil opens the sign-off page while two other returns are still open. The button is disabled; the outstanding list names both items, their assessors, and their due dates (FR-510).
   - **E6 Race**: if he submits just as a new return is recorded by another moderator, the server refuses with the outstanding items in `details`; the list re-renders from that payload.
   - **E7 Not eligible to sign** (P-05): the page says why and names who can sign.
9. **Sign-off.** When all items are concluded he enters the sign-off statement and confirms the consequence dialog (P0-13). `POST /api/moderation-cycles/{id}/sign-off`.
10. **Release.** One transaction releases the 96 results, sets each appeal closing day, resolves each remediation deadline from the release time, evaluates credits, and creates notifications (FR-511, FR-801).
    - Anil sees "96 results released. 96 notifications created."
    - Zanele's overview drops the hold-age alert. Thandiwe's status page shows Intake B, Task 3 as "Released 22 Sep 2026" (FR-409).
    - Each learner receives "Your result for Task 3 is ready" in the LMS and by email; the dashboard shows the new result card with the appeal closing day.
    - **E8 Email provider down**: release is unaffected; the in-app notification exists; email states show "Sending" and later "Delivered" or "Could not be delivered" (NFR-11).

### 6.5 Flow E: result release, view, lodge appeal, track, outcome

Actor: Lerato. Serves FR-316, FR-317, FR-601 to FR-607, FR-610 to FR-613, BR-05, AS-04, P-08, P-11.

1. Tuesday 22 September 2026, 14:05: notification "Your result for Task 3 is ready." The email contains the item name, the appeal closing day, and a link, but not the outcome (assumption: outcome stays behind sign-in for privacy).
2. She opens `/learn/results/[resultId]`. First screenful: "Not yet competent", "You can appeal this result until the end of Tuesday 29 September 2026", "What to do next" with remediation actions and "Resubmit by the end of Tuesday 6 October 2026" (FR-316, FR-317, SRS 5.3).
3. **D1 What does she want?**
   - Resubmit: goes to the task (Flow A). Resubmitting does not remove the right to appeal while the window is open (assumption).
   - Understand the mark first: "Lodge an appeal", type "See my marked script".
   - Challenge the mark: type "Ask for a remark".
4. **Script request.** She states her grounds and lodges. Receipt with reference and expected turnaround (FR-604). Tracker state: "Received".
5. Zanele grants it (Flow F, step 3). Lerato is notified; tracker state "Granted: view your marked script".
6. She opens `/learn/appeals/[appealId]/script`: her submission beside the mark and comment for each criterion, plus overall feedback; the view is logged (FR-606). A fixed line at the top: "You can still ask for a remark until the end of Tuesday 29 September 2026. 3 days left. Viewing your script does not give you more time." with the button "Ask for a remark" (FR-607, P-08).
   - **E1 Window already closed when she views the script**: the line reads "The time to ask for a remark closed at the end of Tuesday 29 September 2026." No button (FR-603).
7. **Remark request.** She selects "Ask for a remark". The type card carries the AS-04 warning; the review step requires the checkbox "I understand my mark can go down as well as up."; she states her grounds and lodges.
   - **E2 Window closes between opening the form and lodging**: the server compares against the stored instant and refuses; the page keeps her text and shows the FR-603 message.
   - **E3 A remark was already admitted for this result**: the remark card is replaced with "A remark has already been requested for this result. Only one remark is allowed." (P-08, FR-613).
8. **Track** (`/learn/appeals/[appealId]`, FR-612). A vertical timeline in plain words: Received, Being checked, Accepted (or Not accepted, with the coordinator's reason, FR-605), With a reviewer, Being reviewed, Decided. Each step shows its date. The reviewer is described as "a reviewer who did not mark your work" (section 12, Q7).
9. **Outcome.** Notification "Your appeal has been decided." The tracker shows the outcome in words: "Mark upheld", "Mark changed: higher", or "Mark changed: lower", then the new marks and outcome where changed, then the reviewer's reasons (FR-610, FR-612). Fixed closing line: "This decision is final. There is no further appeal." There is no appeal control on an appeal outcome anywhere in the UI (FR-613).
   - **D2 Outcome changed?** The result view shows the decision history with the appeal decision as current (BR-03). The credits record shows a new ledger entry, an award or a reversal, never a rewritten total (FR-803).
   - **D3 Amended to Not yet competent?** The result view shows remediation actions and a new resubmission deadline (P-09).
10. After the window: the result view and results list show "The time to appeal closed at the end of Tuesday 29 September 2026." (FR-603).

### 6.6 Flow F: coordinator allocates an appeal reviewer when the obvious choice is excluded

Actor: Zanele. Serves FR-604, FR-605, FR-608, BR-02, AS-02, P-10. The appeal concerns "Task 2: Meeting minutes": Thandiwe made the original decision (6 Aug 2026); Bongani assessed the resubmission (3 Sep 2026); Anil moderated it (18 Sep 2026, agreed); released 22 Sep 2026.

1. Notification "New appeal: Lerato Mokoena, Task 2, remark request." `/coordinate/appeals` lists it under "Needs my action" (FR-604).
2. She opens the appeal: grounds, release time, notification evidence, and "Lodged inside the window" with the dates.
3. **D1 Admissible?**
   - No: "Record as inadmissible", reason required; the learner notification is previewed; on confirm the learner is notified and the tracker shows the reason (FR-605).
   - Yes: "Admit". For a script request the action is "Grant script view" and the flow ends here.
4. The reviewer panel opens. Zanele expects to pick Thandiwe, the unit's subject expert. The list shows instead:
   - Tier 1, independent qualified internal reviewers: "No one available for this unit."
   - Tier 2, cohort moderator: **Anil Naidoo**, selectable, with the note "Moderated this item on 18 Sep 2026 (agreed). He did not assess it, so he may review." (AS-02)
   - Tier 3, qualified assessors from other cohorts: **Nomvula Mahlangu**, selectable, "Will be allocated to this appeal only."
   - Cannot review this appeal: "Thandiwe Nkosi: made the original assessment decision on 6 Aug 2026." "Bongani Sithole: assessed the resubmission (version 2) on 3 Sep 2026." Both rows are disabled and their reasons are always visible, not in a tooltip.
5. A helper line explains the ordering: "People are listed in the order set by the appeals policy. Choose from the first group that has someone available."
   - **D2 She wants to skip a tier** (pick Nomvula while Anil is available): allowed by the UI with a required reason (assumption; the API offers candidates in order but does not state that a higher tier must be exhausted).
6. She selects Anil and confirms: "Allocate this remark to Anil Naidoo? He will be notified."  `POST /api/appeals/{id}/reviewer`.
   - **E1 `separation_of_duties_conflict`** (the list was stale, for example a re-mark was recorded a moment ago): the conflict panel names the decision, role, and allocation; the list reloads. No retry button.
   - **E2 No eligible reviewer in any tier**: blocking notice: "No one can review this appeal yet. Everyone qualified has assessed this work. Give a qualified assessor from another cohort access (People), then return here." The appeal stays "Accepted, not yet allocated" and ages visibly on the overview.
7. State becomes "With a reviewer". Anil finds it under "Appeal reviews" with grounds, submission, marks, decision chain, and moderation findings (FR-609).
   - **E3 Anil becomes unavailable**: "Reallocate reviewer" repeats steps 4 to 6; his role cannot be ended while the allocation is open (`open_allocations`, FR-105).
8. Anil records the outcome with reasons (FR-610). Lerato, Thandiwe, Bongani, and Zanele are notified (FR-611).

### 6.7 Flow G: administrator bulk import with 10% invalid rows, then a replay

Actor: Sibusiso. Serves FR-103, FR-107. Based on the test-plan scenario: 1,000 learners, 100-row batches, 10% invalid, replay of the same file.

1. `/admin/imports/new`. The page offers the CSV template, lists required columns, and states the rules ("One row per learner. Email must be unique. Cohort must already exist.").
2. He chooses the target cohort "2026 Intake B" and uploads `intake-b-2026.csv` (1,000 rows).
   - **E1 Wrong file type, empty file, or missing required columns**: refused before any row is read, naming the missing columns.
   - **E2 Same file as a previous import** (digest match): "This exact file was already imported on 14 Sep 2026 by Sibusiso Khumalo (batch IMP-0031). Nothing has been imported again. View that import." No second batch is created (replay safety).
3. **Validation (dry run).** Progress "Checking rows: 600 of 1,000". Nothing is created yet. He may leave; a notification arrives when it completes.
4. **Validation result**: "900 rows are ready to import. 100 rows have problems." Tabs: Ready (900), Problems (100), Already exist (0). The Problems table shows row number, the value, and a specific reason: "Row 214: email is missing." "Row 377: this email appears twice in the file (also row 12)." "Row 640: ID number is not 13 digits." "Download problem rows (CSV)" produces a file with an added `problem` column that can be fixed and re-uploaded on its own.
   - **D1 What next?** "Import the 900 valid rows" (primary), or "Cancel and fix the file first". Either is safe.
5. He selects "Import the 900 valid rows". Confirmation: "This creates 900 accounts, enrols them in 2026 Intake B, and sends each person an invitation email."
6. **Import.** Progress by chunk: "Imported 400 of 900". Each 100-row chunk commits together.
   - **E3 A chunk fails** (temporary fault): "Rows 401 to 500 could not be imported. Nothing in that group was created. Try that group again." Retry is safe; rows already imported are skipped.
   - **E4 He closes the browser**: the import continues on the server; the batch page shows live state on return.
7. **Completion**: "900 learners imported and enrolled. 100 rows not imported (download). Invitations: 340 of 900 sent; the rest are being sent in the background." Every created account and enrolment is in the audit log with actor and batch reference (FR-107).
8. **Replay.** He re-uploads the original file by mistake: the E2 notice appears and nothing changes.
9. **Corrected rows.** He fixes the 100 rows and uploads `intake-b-2026-fixes.csv` (a new digest). Validation: "96 ready. 1 has a problem. 3 already exist." Rows that match an existing learner by normalised identity key are reported as "Already exists, will be skipped", so a file that mixes old and new rows cannot create duplicates.
10. The imports list shows both batches with state, counts, who ran them, and when.

---

## 7. State and feedback catalogue

Rules for every table in this section:

- The "Data-model state" column uses the names in the state models table of `LMS-data-model.md`. "Derived" means the label is computed from other facts and is not a stored state.
- A label is always text. Tone supports it; it never replaces it (WCAG 1.4.1).
- "Not shown" means the role has no access to the object at all (RLS), not that the label is hidden.

### 7.1 Submission (coursework)

`submissions` has no workflow status of its own; the version carries upload state, and everything after acceptance is read from the assessment instance and the result.

| Data-model state | Learner sees | Tone | Facilitator sees | Assessor sees |
|---|---|---|---|---|
| Derived: task published, no version, before due | Not started | neutral | Outstanding | Not shown |
| Derived: no version, after due | Overdue. You can still submit | caution | Outstanding (overdue) | Not shown |
| Version `upload_pending` | Upload in progress / Paused / Expired | info | Outstanding | Not shown |
| Version `finalised` (files uploaded, not yet submitted) | Ready to submit | info | Outstanding | Not shown |
| Version `submitted`, on time | Submitted, version N | positive | Submitted | To mark |
| Version `submitted`, late flag | Submitted, version N, Late | caution | Late | To mark, Late |
| Instance `queued`, `marking`, `finalised` with result `held`, `returned`, or re-marked | **Being assessed** | info | Submitted (no assessment detail) | See 7.3 |
| Result `released` | Result ready | positive | Submitted | Decided, released |
| Result released NYC, resubmission period open | Resubmission open, due end of [day] | caution | Outstanding (resubmission) | Waiting for resubmission |
| Earlier version after a newer one exists | Replaced by version N (kept on record) | neutral | In history | In version history |

### 7.2 Exam attempt

An attempt row exists only once started.

| Data-model state | Learner sees | Tone | Assessor sees | Coordinator sees |
|---|---|---|---|---|
| Derived: no attempt, before window | Opens [day] at [time] | neutral | Not shown | Not started |
| Derived: no attempt, window open | Open now. Closes at [time] | info | Not shown | Not started |
| Derived: no attempt, window closed | Closed. Not attempted | neutral | Not shown | Not attempted |
| `active` | In progress. Time left [hh:mm] (with Resume) | info | Not shown | In progress, last save [time] |
| `submitted` | Submitted [time] | positive | To mark | Submitted by learner |
| `expired` (`submission_kind = auto_expired`) | Submitted automatically when time ran out | positive | To mark, "Auto-submitted"; answers received in grace are marked | Auto-submitted, last save [time] |
| `voided` | Attempt cancelled by your coordinator. New attempt available | neutral | Voided (read-only, not assessable) | Voided by [name], reason |
| `flagged_for_review` marker | Nothing beyond the in-exam message (section 8.5) | n/a | "Integrity events to review" tag; sorted first (FR-905) | Flagged |

### 7.3 Result, and the difference between "decided" and "released"

| Term | Meaning | Who sees it |
|---|---|---|
| **Decided** | An assessor has finalised a decision (`decisions` row appended; instance `finalised`). It may still be returned and superseded by a re-mark. It awards nothing, starts no clock, and is absent from the Department API. | Staff only |
| **Held** | The decided result belongs to a `moderated` cohort and is waiting for sign-off (`results.state = held`). | Staff only |
| **Released** | `results.state = released`: visible to the learner, appeal window and remediation deadline started, credit evaluated, visible to the Department. Happens once per result. | Everyone with access |

Staff screens always show both facts when both exist: "Decided 10 Sep 2026. Released 22 Sep 2026." Learner screens show only "Released on".

| Data-model state | Learner sees | Assessor sees | Moderator sees | Coordinator sees |
|---|---|---|---|---|
| No result row yet (instance `queued` or `marking`) | Being assessed | To mark / Marking, draft saved [time] | Not shown | Waiting for assessor |
| `held`, `hold_cycle_id` null (pending pool) | **Being assessed** | Decided. Held: waiting for a moderation cycle | Not shown | Decided and waiting for a cycle (age shown) |
| `held`, claimed by a cycle, not sampled | **Being assessed** | Decided. Held: in moderation (not sampled) | Not shown (not in the sample) | Held in cycle [name] |
| `held`, sampled, under review | **Being assessed** | Decided. Held: sampled, with moderator | To review / In review | Held in cycle [name], sampled |
| `held`, instance `returned` | **Being assessed** | Returned to you. Re-mark by [date] | Returned, waiting for assessor | Returned, due [date] |
| `held`, re-marked | **Being assessed** | Re-marked. Held: with moderator | Re-marked, review again | Re-marked, with moderator |
| `released` | Outcome, marks, feedback, appeal closing day | Decided [date]. Released [date] | Agreed / concluded (read-only) | Released [date]; appeal window to end of [day] |
| `released`, superseded by an appeal decision | Outcome with "Changed after appeal on [date]" and decision history | Amended on appeal [date] (original retained) | Read-only | Amended on appeal |
| `released`, superseded by a correction | Outcome with "Corrected on [date]" and decision history | Corrected [date] | Read-only | Corrected under dual control |
| `released` NYC, then resubmission assessed and released | Latest outcome as current; earlier outcome in history | Chain of decisions on one result | Read-only | Chain of decisions |

**What the learner sees while a result is held.** One label, "Being assessed", from the moment the work is accepted until release. The task page and the dashboard's "Being assessed" block carry this explanation:

> "We have your work. In this programme, results are checked by a second person (a moderator) before anyone sees them, and everyone's results for the same task are released together. You will get a message here and by email when your result is ready. Your 7 days to appeal, and any time you are given to resubmit, only start on the day your result is released."

Reasons for one label rather than a "Marked, in quality check" sub-state:

1. The data model makes a held result invisible to its learner, so there is nothing for the learner UI to read (RLS strategy).
2. A sub-state would move backwards when an item is returned for re-marking, which invites the inference "my work was sampled and something was wrong with it".
3. Because every NYC decision is sampled (FR-503), any visible difference in timing or wording between sampled and unsampled items would leak a hint of the outcome.

The explanation addresses the need to know that something is happening. Whether to add an expected date is section 12, Q2.

### 7.4 Moderation cycle

| Data-model state | Coordinator sees | Moderator sees | Assessor sees (FR-409) | Learner sees |
|---|---|---|---|---|
| `planned` (manual) | Planned. Start when you choose | Not shown | Held: waiting for a moderation cycle | Being assessed |
| `planned` (scheduled) | Planned. Starts [day] at [time] | Not shown | Held: moderation starts [date] | Being assessed |
| `cancelled` | Cancelled by [name] on [date]. Results still waiting | Not shown | Held: waiting for a moderation cycle | Being assessed |
| `frozen_and_sampled` | Sampled. Ready for review (N items) | To review: N items | Held: in moderation, N of yours sampled | Being assessed |
| `in_review` | In review (14 of 22 done) | In review (your items: 9 of 12 done) | Held: in moderation | Being assessed |
| `corrections_pending` | Waiting for re-marks (3 outstanding) | Waiting for re-marks (3 outstanding) | Held: N items returned to you | Being assessed |
| `signed_off` | Signed off by [name] on [date]. N results released | Signed off. N results released | Released [date] | Result ready |

### 7.5 Sample item

| Data-model state | Moderator sees | Assessor sees | Coordinator sees |
|---|---|---|---|
| `allocated` | To review | Sampled, with moderator | Allocated to [moderator] |
| `in_review` | In review | Sampled, with moderator | In review |
| `agreed` | Agreed | Moderator agreed | Agreed |
| `returned` | Returned to assessor, due [date] (Overdue when late) | Returned to you. Re-mark by [date] | Returned, due [date] |
| `remarked` | Re-marked. Review again | Re-marked, with moderator | Re-marked |
| `reallocated` | Reallocated to [name] (read-only for the previous moderator) | Sampled, with moderator | Reallocated from [name] to [name], reason |
| Derived: no eligible moderator | Not shown | Sampled, waiting for a moderator | Needs a moderator (blocks sign-off) |

Disagreement is a finding, not an item state. Whether an item can be concluded with a recorded disagreement and no return is section 12, Q3.

### 7.6 Appeal

| Data-model state | Learner sees | Tone | Coordinator sees | Reviewer sees |
|---|---|---|---|---|
| `lodged` | Received | info | New. Needs admissibility check | Not shown |
| `admissibility_review` | Being checked | info | Being checked | Not shown |
| `inadmissible` | Not accepted, with reason | neutral | Inadmissible: [reason] | Not shown |
| `admitted` (script request) | Granted: view your marked script | positive | Script view granted; first viewed [time] (logged) | Not shown |
| `admitted` (remark) | Accepted | info | Accepted. Needs a reviewer | Not shown |
| `allocated` | With a reviewer | info | Allocated to [name] | To review |
| `under_review` | Being reviewed | info | Under review by [name] | In review |
| `concluded`, `upheld` | Decided: mark upheld | neutral | Concluded: upheld | Concluded |
| `concluded`, `amended_up` | Decided: mark changed (higher) | positive | Concluded: amended upward | Concluded |
| `concluded`, `amended_down` | Decided: mark changed (lower) | caution | Concluded: amended downward | Concluded |
| Derived: window closed, no appeal | The time to appeal closed at the end of [day] | neutral | n/a | n/a |

Assumption: a script request has no allocation or review stage; it is complete when granted.

### 7.7 Notification

| Data-model state | Recipient sees (per channel) | Coordinator sees in delivery logs (FR-703) |
|---|---|---|
| In-app record created | "In the LMS: [time]" | Created |
| In-app read timestamp set | "First opened by you: [time]" | Opened [time] |
| `pending`, `queued` | Email: sending | Queued |
| `accepted` | Email: sent [time] | Accepted by mail provider |
| `delivered` | Email: delivered [time] | Delivered |
| `failed` | Email: could not be delivered. Check your email address | Failed, with provider reason |

The in-app record is the notification of record for NFR-11; email states are supporting evidence.

### 7.8 Cohort

| Data-model state | Label | What changes in the UI |
|---|---|---|
| `active` | Active | All functions available |
| `completion_review` | Completion review | Coordinator overview shows the archival preconditions checklist |
| `archivable` | Ready to archive | Administrator sees "Archive cohort" enabled (FR-111) |
| `archived` | Archived (read-only) | Read-only banner on every cohort page; no mutating controls rendered; reports and records remain readable (FR-112) |
| Attribute `moderation_policy` | Moderated / Not moderated | Tag beside the cohort name wherever a decision can be finalised or released |

If archival preconditions fail, X-10 lists each unmet condition with counts: "3 results are still held", "Appeal windows still open until the end of 29 Sep 2026", "1 appeal is not concluded".

### 7.9 Feedback patterns

| Pattern | Use for | Behaviour |
|---|---|---|
| Inline field error | Validation (400, field-level 422) | Text under the field, linked with `aria-describedby`; error summary at the top of the form on submit, focus moved to it |
| Status line | Autosave, upload progress, draft saved | Persistent text in a fixed place; `role="status"`; never a toast |
| Toast | Low-stakes confirmation only ("Reminder sent") | Polite live region; never for errors, never for anything the user must act on; does not time out while focused or hovered |
| Page banner | State that colours the whole page (held, archived, offline, returned) | In the page flow under the header; not dismissible while true |
| Consequence dialog | Irreversible commands | States the effect in one sentence with the number of people affected; default focus on the cancel action |
| Conflict panel | Named domain refusals (`separation_of_duties_conflict`, `open_allocations`, outstanding returns) | Section 10.5 |
| Receipt | Submission, exam, appeal | Own step or page with reference, time in SAST, and what happens next; reachable again later |

---

## 8. Exam mode UX specification

Applies to `/exam/[attemptId]` in `ExamShell`. Serves FR-313 to FR-315, FR-901 to FR-905, NFR-07.

### 8.1 Layout

```text
+--------------------------------------------------------------------------------+
| ExamBar: Unit 5 summative exam | Question 7 of 40 | [Save status] | Time left 01:12:40 |
+--------------------------------------------------------------------------------+
| (Offline banner, only when offline)                                            |
+----------------------+---------------------------------------------------------+
| Navigator (240 px,   | Question 7                                  [4 marks]   |
| collapsible)         | Question text                                           |
|  1  2  3  4  5       |                                                         |
|  6 [7] 8  9 10       | Answer area (options, or text box with word count)      |
|  ...                 |                                                         |
| Key: Answered,       |                                                         |
| Not answered,        |                                                         |
| Come back to,        |                                                         |
| On this device only  |                                                         |
+----------------------+---------------------------------------------------------+
| ActionBar: [Previous]  [Mark to come back to]          [Next] / [Review and submit] |
+--------------------------------------------------------------------------------+
```

| Element | Rule |
|---|---|
| Minimum viewport | 1024 by 600 CSS px (assumption; section 9.4). The layout still reflows to 320 px wide without loss at 400% zoom, because a zoomed desktop browser reports a narrow viewport (WCAG 1.4.10). The mobile gate therefore tests the device, not only the width. |
| One question per page | Reduces scrolling and cognitive load, gives each answer a clear save state, and makes recovery messages specific. |
| ExamBar | Fixed. No logo link, no navigation, no notifications, no account menu. Skip links come first in tab order: to the question, to the navigator, to the action bar. |
| Navigator | Button per question with an accessible name that includes its state ("Question 7, not answered, current"). State is shown by text or shape in addition to tone. Collapsible to give the question more room. |
| "Mark to come back to" | The learner's own marker. The word "flag" is reserved for integrity and is never used for this. |
| Review page | List of all questions with state; unanswered and marked questions first; "Submit exam". |
| Focus | On question change, focus moves to the question heading. Overlays trap focus and return it on close. |
| Keyboard | Everything is operable by keyboard. Shortcuts use modifier keys only: Alt+N next, Alt+P previous (assumption); no single-character shortcuts (WCAG 2.1.4). |

### 8.2 What is disabled (FR-901) and what is not

| Disabled inside the exam view | Learner message when attempted |
|---|---|
| In-app navigation (no shell; browser Back is intercepted with a confirmation) | "Leaving this page will not stop the timer. Stay in the exam until you submit." |
| Right-click context menu | None (silently suppressed) |
| Copy and cut from question text and answers | "Copying is switched off during this exam." |
| Paste into answers | "Pasting is switched off during this exam." |
| Print (Ctrl+P and print styles render a blank notice) | "Printing is switched off during this exam." |
| Text selection in question text (assumption) | None |

| Deliberately not disabled | Reason |
|---|---|
| Typing, undo and redo, arrow-key navigation, spellcheck | Needed to answer |
| Browser zoom and text resizing | WCAG 1.4.4; blocking it would exclude low-vision learners |
| Screen reader reading commands and the virtual cursor | Assistive technology reads through the accessibility tree, not the clipboard |
| Esc and Alt+Tab | Browsers do not allow them to be blocked; they are detected and logged instead (FR-902) |

The messages are shown as a brief status line near the answer area, not as a modal, and are not integrity events.

### 8.3 Timer

| Aspect | Behaviour |
|---|---|
| Source of truth | `expires_at` from the server, with a clock offset calculated from the server time in each response. The device clock is never used. Re-synchronised on every save acknowledgement. |
| Display | "Time left 01:12:40". Below one hour, "Time left 12:40". The learner may hide the seconds (assumption), not the timer. |
| Never pauses | Stated on the pre-flight screen, the integrity overlay, and the offline banner (P-13). |
| Low-time warnings | At 15, 5, and 1 minute (assumption): the timer gains a text prefix ("5 minutes left"), and one polite live-region announcement is made. No modal, no sound by default, no focus change. |
| Screen readers | The ticking value is not a live region. Only threshold announcements are. A "Read time left" button (Alt+T) reads the current value on demand. |
| Zero | Inputs become read-only; overlay "Time is up. Sending your answers..."; see Flow B step 13. |
| Shortened attempt | When the window close limits the attempt, the ExamBar shows "Exam closes at 12:00" beside the timer. |

### 8.4 Persistence indicator

Three primary states, mapped to the API's local, persisted, and submitted distinction. Wording is fixed; do not shorten "Saved on this device" to "Saved".

| State | Wording | When | Announcement (`role="status"`, polite) |
|---|---|---|---|
| Local | "Saved on this device" | Edit written to IndexedDB, not yet acknowledged by the server | Not announced (too frequent) |
| Persisted | "Saved 10:42" | Server acknowledged the latest change | Not announced, unless recovering from a problem state |
| Submitted | "Submitted and locked" | Attempt terminal | Announced once |
| Problem: offline | "Not saved to the server. Your answers are being kept on this device." | Save failed or offline for more than one interval | Announced once on entering the state |
| Problem: recovered | "Back online. All answers saved." | Backlog acknowledged | Announced once |
| Problem: no safety copy | "This device cannot keep a safety copy. Only 'Saved' answers are safe." | IndexedDB unavailable or full | Announced assertively once |

A "Saving..." state is shown only if a request is outstanding for more than two seconds, to avoid flicker every ten seconds. The navigator marks each question whose latest edit is on this device only.

### 8.5 Integrity event warnings (FR-903)

Wording rules: say what happened, that it was recorded, and who will look at it; do not guess at intent; do not threaten an outcome the system cannot impose (FR-407: no integrity signal ends or decides an attempt); do not show the threshold.

| Event | Overlay text |
|---|---|
| Focus loss, tab or window switch | "You left the exam window at 10:42. This has been recorded (2 so far). Your assessor will see the record and decide whether it matters. Please stay in the exam window until you submit. The timer is still running." |
| Fullscreen exit | "The exam left fullscreen at 10:42. This has been recorded (3 so far). Select 'Return to the exam' to go back to fullscreen. The timer is still running." |
| Threshold exceeded (added once) | "Your attempt has been marked so that your assessor looks at this record. This does not decide your result." |
| Return after the grace period | Same text as above. The distinct event type is for the assessor's log, not for the learner. |

| Behaviour | Rule |
|---|---|
| Overlay | Covers the question and answers until the learner returns to fullscreen (assumption: content is hidden while not in fullscreen). One button: "Return to the exam". Focus is trapped; on close, focus returns to where it was. |
| Announcement | The overlay is an alert dialog, so it is announced immediately. |
| Accidental events | The pre-flight page advises closing other applications and turning off notifications. The receipt invites the learner to tell the coordinator about events outside their control. |
| Assessor view | Timeline with event type, time, duration away, the threshold snapshot, and the judgement control (FR-406). |

### 8.6 Offline banner

- Appears under the ExamBar after one failed save interval or a browser offline event: "No connection. Carry on answering. Your answers are being kept on this device. The timer is still running."
- Not dismissible while offline. Does not cover the question. Does not block input.
- On recovery it is replaced for five seconds by "Back online. All answers saved."
- If offline when fewer than five minutes remain, add: "If you are still offline when time runs out, the answers already saved to the server are the ones that count."

### 8.7 Submit confirmation and receipt

| Step | Content |
|---|---|
| Review and submit | Summary counts; links to unanswered and marked questions; save status must be "Saved" or the page explains what is still only on this device. |
| Confirmation dialog | "Submit your exam? You have answered 38 of 40 questions. You cannot change your answers after this." Buttons: "Go back" (default focus), "Submit exam". |
| Receipt | Receipt ID; submitted time in SAST; how it was submitted (by you, or automatically when time ran out); answered count; count of recorded events with the neutral sentence from Flow B step 14; what happens next; "Back to the LMS". Fullscreen exits on arrival. The receipt is also listed under Exams afterwards (FR-315). |

### 8.8 Accessibility tensions and recommended accommodations

| Tension | Risk | Recommendation |
|---|---|---|
| Fullscreen and screen readers | Fullscreen itself does not break screen readers, but focus can be lost on entering and leaving, and overlays can be missed | Move focus to the question heading on entering fullscreen; implement overlays as alert dialogs; test with NVDA and JAWS on Windows (the likely laptop platform) and VoiceOver on macOS before go-live |
| Focus-loss detection and assistive technology | Screen magnifiers, on-screen keyboards, speech-recognition toolbars, and some screen reader dialogs take focus and are logged as integrity events | Provide a per-learner accommodation flag, set by the coordinator before the attempt, that is snapshotted onto the attempt and shown to the assessor at the top of the integrity log: "This learner uses assistive software that can cause focus-loss events." Events are still logged (the audit trail stays complete) and the judgement stays with the assessor (FR-406, FR-407). (assumption; section 12, Q5) |
| Disabled copy and paste | Speech-to-text tools and some switch-access software insert text through the clipboard; blocking paste blocks them | The same accommodation allows paste for that learner's attempt, recorded in the attempt's integrity configuration snapshot so that the assessor can see it |
| Server-authoritative timer and WCAG 2.2.1 | Learners who need more time cannot extend a limit themselves | Handled by the "essential" exception plus an accommodation made before the sitting; see section 11.2 |
| Disabled text selection | Some learners select text to keep their place while reading | Provide a built-in reading ruler or line focus toggle rather than enabling selection (assumption, P2) |
| Timer anxiety | A ticking seconds display raises anxiety for some learners | Allow hiding the seconds; warnings still fire |
| Low technical confidence | First contact with restricted mode should not be the summative exam | Offer a practice run in the same `ExamShell` with sample questions, no attempt record, and no integrity logging (assumption; section 12, Q6) |

---

## 9. Responsive strategy

### 9.1 Breakpoints

Mobile first: base styles target 320 px; each breakpoint is a `min-width`.

| Token | Min width | Typical device | Shell | Columns |
|---|---|---|---|---|
| `base` | 320 px | Phones | TopBar plus BottomTabs; sticky action bar | 1 column, 16 px gutters |
| `md` | 768 px | Large phones in landscape, tablets | TopBar plus 72 px rail | 1 to 2 columns, 24 px gutters |
| `lg` | 1024 px | Laptops | TopBar plus 256 px SideNav | Main plus optional Aside; minimum for exam mode |
| `xl` | 1280 px | Desktops, external monitors | As `lg` | Two-pane workspaces side by side (marking, moderation, appeal review) |
| `2xl` | 1440 px | Wide monitors | As `lg`; content capped at 1200 px (workspaces may use full width) | Three regions where useful (navigator, evidence, rubric) |

Supporting rules: no horizontal scrolling at 320 px except inside a data table that has been explicitly allowed to scroll (9.3); layouts respond to the container where a component is reused in panes (container queries), so the rubric panel behaves the same in a 420 px pane and on a 420 px phone; both orientations are supported everywhere except exam mode, which does not restrict orientation either but requires the minimum viewport (WCAG 1.3.4).

Performance budget for learner routes (assumption, to be validated on a mid-range Android device over a throttled 3G profile from South Africa): first load under 170 KB of compressed JavaScript, usable content from server-rendered HTML before hydration, no web-font dependency for first paint, and images never required to complete a task.

### 9.2 How screens collapse

| Screen type | `xl` and up | `lg` | `md` | `base` |
|---|---|---|---|---|
| Two-pane workspaces (A-02, M-03, R-02) | Evidence and panel side by side | Stacked with a sticky section switcher; decision bar sticky | Same as `lg` | Section switcher becomes a segmented control; decision bar becomes one button that opens a full-height sheet; evidence opens in the device's viewer when the inline viewer is impractical |
| Dashboards (L-01, C-01, G-04) | 2 to 3 column card grid | 2 columns | 2 columns | Single column in strict priority order (section 5.2) |
| Data tables (F-08, A-01, C-12, X-02, X-09) | Full table | Full table, lower-priority columns hidden | Table with priority-1 and priority-2 columns | Card list (9.3) |
| Forms (F-03, C-03, X-06) | Single column, max 720 px, help text beside fields | Help text below fields | Same | Same; sticky primary action; sections become collapsible with completion state |
| Matrix (F-08 matrix view) | Available | Available | Hidden; per-task list only | Hidden; per-task list only |
| Calendar (L-07) | Month grid plus agenda | Month grid plus agenda | Agenda default, month optional | Agenda only by default; month as a compact date picker |
| Result view (L-15) | Main plus Aside (history, how you were told) | Same | Aside below Main | Single column; outcome, appeal line, and next step always above the first scroll on a 360 by 640 viewport |
| Dialogs | Centred dialog | Centred | Centred | Full-width bottom sheet; consequence dialogs remain true modal dialogs |

### 9.3 Tables to cards

1. Every table column is assigned a priority in the screen specification: P1 always visible, P2 from `md`, P3 from `lg`.
2. Below `md`, a table with more than three P1 columns renders as a list of cards. Tables with three or fewer short columns stay as tables.
3. Card anatomy, in order: title line (the row's identifier, for example the learner's name), one status tag, up to three label and value pairs from the P1 and P2 columns, one primary action as a full-width button or the whole card as a link, and an overflow menu for the rest.
4. Sorting and filtering move into a "Sort and filter" sheet. Active filters are shown as removable chips above the list.
5. Bulk selection on phones uses an explicit "Select" button that switches the list into selection mode with checkboxes; there is no long-press dependency. A sticky bar shows the count and the bulk action ("Send reminder to 23").
6. Tables that are inherently two-dimensional and audited as such (sample strata counts in C-07, configuration history in X-06, audit log in X-09) may scroll horizontally inside a focusable, labelled region, with the first column sticky (WCAG 1.4.10 exception for data tables).
7. Pagination, not infinite scroll, for every list over 50 rows, so position survives a reload on a poor connection and the footer remains reachable.
8. Numbers, dates, and status tags never truncate. Names and titles wrap to two lines, then truncate with the full value available to assistive technology.

### 9.4 The mobile gate for exams (NFR-10, SRS 2.3)

Sitting an exam is the only function refused on a phone or tablet. Everything around it (seeing the window, reading the rules, receiving the result) works on mobile.

| Aspect | Rule |
|---|---|
| Where the gate appears | On the pre-flight page (L-11) in place of the Start area, and on `/exam/[attemptId]` if opened directly. Never on the dashboard or calendar, which still show the exam. |
| Test (all must pass) | Fullscreen API available and enabled; Page Visibility API available; IndexedDB writable; viewport at least 1024 by 600 CSS px (assumption); primary input is not touch-only (`pointer: coarse` with no hover) (assumption: a tablet with a keyboard is still refused, because SRS 2.3 says desktop or laptop). The server also validates the capability summary sent with the start request. |
| Wording | "You need a laptop or desktop computer to sit this exam. Phones and tablets cannot be used, because the exam needs a full-screen mode that they do not support properly. This exam is open from 09:00 to 12:00 on Wednesday 14 October 2026. If you do not have a computer you can use, speak to your coordinator before the exam day." |
| Timing | The gate runs before any attempt is created, so a refused device never consumes an attempt or starts a timer (Flow B step 4). |
| Early warning | From seven days before an exam window, the learner dashboard on a phone shows: "You will need a laptop or desktop computer for this exam. Check your device now." The link opens the device check, which can be run at any time before the window (assumption). |
| Resume | An in-progress attempt opened on a phone shows the gate plus the true time left, so the learner knows to get back to a computer quickly. |
| Zoomed desktop | A desktop browser at 400% zoom reports a narrow viewport. The gate therefore relies on the device signals first; if only the width test fails on a device with fine pointer and hover, the learner sees a warning, not a refusal. |

---

## 10. Content and microcopy guidelines

### 10.1 Plain language

| Rule | Example |
|---|---|
| Write for a reader with Grade 8 to 9 English reading level for whom English may be a second or third language (assumption: English-only interface at launch; all strings externalised for later translation; section 12, Q8) | "Your work is late" not "Submission received post-deadline" |
| One idea per sentence; aim for under 20 words | "You can still submit. Your work will be marked as late." |
| Address the learner as "you"; the institution is "we" | "We have received your work." |
| Use the domain's own terms once, explained once, then consistently: Competent, Not yet competent, moderator, appeal, remark, credits | "checked by a second person (a moderator)" |
| Name the next step and its date in every state that has one | "Resubmit by the end of Tuesday 6 October 2026." |
| No idioms, no humour in errors, no blame | Not "Oops!", not "You failed to..." |
| Buttons are verb plus object and match the page title they lead to | "Lodge appeal", "Submit version 2", "Sign off and release" |
| Never expose internal state names, codes, or identifiers as the message; show the request reference only under "Details for support" | Not "lease_lost" |
| Staff copy may be denser but follows the same rules; legal or audit consequences are stated, not implied | "This cannot be undone or redrawn." |

### 10.2 Dates, times, and deadlines

| Rule | Format or example |
|---|---|
| Every time is shown in South African time, whatever the device's time zone. If the device zone differs, a one-line notice appears once per session: "Times are shown in South African time (SAST)." | Storage is UTC; display is Africa/Johannesburg |
| Deadlines use weekday, day, month, year, and 24-hour time | "Friday 4 September 2026 at 17:00 (SAST)" |
| "(SAST)" appears once per deadline sentence, not on every time in a table; table headers carry it instead | Column header "Submitted (SAST)" |
| Compact format for tables and logs | "22 Sep 2026, 14:05" |
| Relative time only in addition to the absolute time, never alone, and never for anything older than seven days | "Due Friday 4 September 2026 at 17:00, in 3 days" |
| End-of-day deadlines are written as the last full day, never as midnight | "until the end of Tuesday 29 September 2026", not "until 30 September 2026 00:00" (P-11) |
| Countdown in days for the appeal window counts full local days remaining and says "Today is the last day" on the final day | "7 days left", "1 day left", "Today is the last day to appeal" |
| Calendar days are stated when it matters | "7 days, including weekends and public holidays" (shown in the appeal help text) |
| Durations in words | "2 hours", "1 hour 25 minutes" |
| Never display "00:00" or "24:00" | Use "start of day" or "end of day" wording |
| Working-day promises (turnaround) are labelled as such | "within 5 working days" |
| Numbers | Space-free thousands below 10 000; decimal comma or point follows the design system's locale decision (assumption: en-ZA) |

### 10.3 Competent and Not yet competent

| Rule | Rationale or example |
|---|---|
| Use the exact terms "Competent" and "Not yet competent". Expand the abbreviation: learners never see "NYC". | Staff tables may use "NYC" where space is tight, with an expansion available to assistive technology |
| Never use fail, failed, failure, unsuccessful, rejected, or pass rate in learner-facing text | "Not yet" is the programme's stance: remediation and resubmission follow (SRS 1.3) |
| "Not yet competent" is always followed immediately by the next step and its date | "Not yet competent. Here is what to do next." |
| Tone is `caution`, never `critical`. No cross icons, no alarm styling. "Competent" is `positive` and calm: no celebration effects. | Both outcomes are professional judgements, not prizes or punishments |
| Feedback is introduced as the assessor's professional view | "Feedback from your assessor, Thandiwe Nkosi" |
| Avoid sympathy phrases and hedging | Not "Unfortunately...", not "Sadly..." |
| For Competent, state what it means for credits truthfully | "Competent. This counts towards Unit 3. Unit 3 needs one more assessment before its 8 credits are awarded." (P-07) |
| A downward remark outcome is stated plainly with reasons and the final-decision sentence | "Mark changed: lower. The reviewer's reasons are below. This decision is final." |
| Marks never appear without the outcome in words next to them | A number alone invites a pass or fail reading |

### 10.4 Error messages and the API error envelope

Envelope: `error.code`, `error.message`, `error.request_id`, `error.retryable`, `error.details`.

**Message pattern.** What happened, in plain words. What it means for the user's data. What to do next. Then, collapsed under "Details for support": the reference (`request_id`) and the time.

**Mapping rules.**

| Envelope field | UI rule |
|---|---|
| `code` | Selects the UI's own message and treatment. The UI owns the wording for every known code. |
| `message` | Shown only as a fallback for a code the UI does not know, prefixed by a generic lead-in. Never shown raw for known codes, so wording can be reviewed for tone. |
| `retryable: true` | Show "Try again". For idempotent commands (those carrying a client identifier) retry automatically with backoff first, and say so: "Trying again...". |
| `retryable: false` | Never show "Try again". Show the alternative action instead. |
| `details` | Rendered as structured content (lists of named items), never as raw JSON. |
| `request_id` | Shown as "Reference" with a copy button under "Details for support". |

**By status.**

| Status | Treatment | Example wording |
|---|---|---|
| 400 | Inline field errors plus error summary | "Enter a due date." |
| 401 | Re-authentication dialog that preserves the page state; in exam mode, silent session refresh is attempted first (assumption), because an expired session must not cost exam time | "You were signed out for security. Sign in to carry on. Your work on this page has been kept." |
| 403 | Read-only explanation in place of the action | "This item was reallocated to Bongani Sithole. You can no longer finalise it." |
| 404 | Not-found page that does not confirm the object exists | "We cannot find that page, or it is not part of your work." |
| 409 | "Something changed" pattern: keep the user's unsaved input visible, offer reload | "This was changed in another tab at 10:40. Reload to see the latest. Your text is kept below so you can copy it." |
| 422 | Domain refusal: conflict panel or inline notice; no retry | See the code table below |
| 429 | Wait notice with the time from `Retry-After` | "You have done this many times in a short while. You can try again after 14:35." |
| 503 | Banner with automatic retry for safe commands | "The LMS is having trouble right now. Your work is safe. Trying again..." |
| 200 replay | Treated as success; show the original receipt | "We already have this. Here is your receipt." |

**By code.** Codes in the first group are defined in the API design. The second group are proposed names for refusals the API design describes without naming (assumed codes; confirm with the backend team).

| Code | Where | UI treatment | Learner or staff wording |
|---|---|---|---|
| `lease_lost` (409, not retryable) | Exam | Takeover screen (Flow B step 10) | "This exam is now open in another tab or window. You can only work in one place at a time." |
| `separation_of_duties_conflict` (422) | Allocation of moderator or reviewer | Conflict panel listing `details.conflicts[]` (decision, role, allocation) | "Thandiwe Nkosi cannot be the moderator for this item because she assessed it." |
| `open_allocations` (422) | Ending or narrowing a role; deactivation | Conflict panel listing `details.allocations[]` with "Reallocate" links | "Thandiwe still has work that depends on this role." |
| `idempotency_key_mismatch`, `idempotency_key_reused` (422) | Any command | Generic fault (a defect, not a user error); logged to monitoring | "Something went wrong on our side. Your work has not been lost. Reload the page and try again." |
| `closed` (typed result, not an error) | Exam save or submit after the attempt is terminal | Receipt, with the "exam has closed" explanation when answers were left unsent | Flow B step 13 |
| `appeal_window_closed` (assumed) | Lodge appeal | Form replaced by notice | "The time to appeal closed at the end of Tuesday 29 September 2026." |
| `remark_already_used` (assumed) | Lodge appeal | Remark option removed | "Only one remark is allowed for each result." |
| `outstanding_returns` (assumed) | Sign-off | Outstanding list from `details` | "3 returned items are still open. They are listed below." |
| `cycle_scope_overlap` (assumed) | Plan cycle | Inline notice naming the other cycle | "Task 3 is already in a cycle that is not finished." |
| `results_pending_or_held` (assumed) | Change moderation policy | Inline notice with counts | "14 results are waiting and 96 are held." |
| `exam_window_closed`, `exam_not_open`, `attempt_limit_reached`, `unsupported_device` (assumed) | Start exam | Start area replaced by reason (FR-312) | "This exam opens on Wednesday 14 October 2026 at 09:00." |
| `file_type_not_allowed`, `file_too_large`, `upload_intent_expired` (assumed) | Upload | Inline in the file slot, with guidance (FR-311) | "This file is 48 MB. The limit is 25 MB." |
| `import_duplicate_file` (assumed) | Bulk import | Notice linking to the earlier batch | "This exact file was already imported on 14 Sep 2026." |
| `archive_preconditions_unmet` (assumed) | Archive cohort | Checklist of unmet conditions | "3 results are still held." |

### 10.5 The conflict panel (shared component)

Used wherever the domain refuses a command and names the reason (FR-104, FR-105, FR-510, FR-608).

1. Heading that names the rule: "This would break separation of duties" or "This person still has open work".
2. One sentence naming the person and the reason.
3. A definition list or table built from `details`: each conflicting decision, role, and allocation, each linked to its record where the viewer has access.
4. The alternative actions ("Choose another moderator", "Reallocate", "View the decision").
5. No retry button. Focus moves to the panel heading; the panel is announced as an alert.

---

## 11. Accessibility requirements

Target: **WCAG 2.2 level AA** for every screen, including exam mode. The criteria below are those with specific consequences for this system; the rest of AA applies as normal.

### 11.1 Criteria that matter most here

| Criterion | Why it matters here | Requirement |
|---|---|---|
| 1.3.1 Info and Relationships; 1.3.5 Identify Input Purpose | Rubrics, version histories, and ledgers are tabular; sign-in and account forms | Real tables with header cells and captions; rubric rows group the criterion, mark, and comment with a shared label; `autocomplete` on identity fields |
| 1.4.1 Use of Color; 1.4.11 Non-text Contrast | Muted pastel status tags carry critical meaning (Late, Held, Not yet competent) | Every tag has a text label; navigator states in exam mode use text or shape plus tone; tag boundaries and focus indicators meet 3:1 (the UI Designer must verify the pastel palette against this in both themes) |
| 1.4.4 Resize Text; 1.4.10 Reflow; 1.4.12 Text Spacing | Low-vision learners on laptops at 200 to 400% zoom, including in the exam | No loss of content or function at 320 CSS px wide; exam mode reflows (navigator collapses) and does not mistake zoom for a phone (9.4) |
| 1.3.4 Orientation | Phones in either orientation | No orientation lock anywhere |
| 2.1.1 Keyboard; 2.1.2 No Keyboard Trap; 2.1.4 Character Key Shortcuts | Exam mode, rubric scoring, evidence viewer | Everything is operable by keyboard; overlays trap focus only while open; shortcuts use modifiers |
| **2.2.1 Timing Adjustable** | Server-authoritative exam timer that cannot be extended by the learner | Section 11.2 |
| 2.2.1 for sessions | Marking and appeal forms are long; sessions expire | Warn at least two minutes before session expiry with an option to extend; drafts are saved server-side so expiry never loses work; an active exam attempt silently refreshes the session (assumption) |
| 2.2.2 Pause, Stop, Hide | Timer and live status text | The timer's seconds can be hidden; nothing else moves or blinks |
| 2.4.3 Focus Order; 2.4.7 Focus Visible; **2.4.11 Focus Not Obscured** | Sticky ExamBar, ActionBar, BottomTabs, and sticky decision bars can cover the focused element | Sticky regions reserve scroll padding so a focused control is never fully hidden; tested on every P0 screen |
| Focus management (2.4.3, 3.2.1, 3.2.2) | Server-rendered navigation, dialogs, overlays, step changes | On route change, focus moves to the H1. On a step change within a flow, to the step heading. On error, to the error summary. On dialog close, back to the trigger. The integrity overlay and the takeover screen take focus on opening. Changing a select or radio never navigates or submits. |
| 2.5.7 Dragging Movements | File upload, quiz question ordering | Every drag interaction has a button alternative: "Choose file"; "Move up" and "Move down" |
| **2.5.8 Target Size (Minimum)** | Phone use by learners; dense staff tables | AA minimum is 24 by 24 CSS px; this system requires 44 by 44 CSS px for primary actions, navigation, the exam navigator, and anything in a sticky bar, and at least 24 by 24 with 8 px spacing for inline table actions |
| 3.2.3 Consistent Navigation; 3.2.4 Consistent Identification; 3.2.6 Consistent Help | Multi-role users move across workspaces | Same order of shell regions everywhere; the same label for the same thing (section 7); Help in the same place on every page. In exam mode, help is a fixed line: "Problem? Tell your invigilator or coordinator." |
| 3.3.1 Error Identification; 3.3.3 Error Suggestion | File validation, imports, forms | Errors are text, name the field or row, and suggest a fix (FR-311) |
| **3.3.4 Error Prevention (Legal, Financial, Data)** | Exam submission, appeal lodging, decisions, sign-off are test responses or binding records that cannot be reversed | Each has a review step and an explicit confirmation stating the consequence (principle 5) |
| 3.3.7 Redundant Entry | Appeal form, import re-upload, re-mark | Result details are carried into the appeal; the target cohort is remembered for a corrected import file; a re-mark starts from the previous scores |
| 3.3.8 Accessible Authentication (Minimum) | Sign-in, including the challenge shown after failures (ADR-026) | Paste and password managers allowed; no memory or transcription test; any challenge has a non-cognitive alternative |
| **4.1.3 Status Messages** | Autosave, upload progress, draft saved, filter result counts, toasts | Section 11.3 |
| 1.2.x Time-based media | Lecture recordings are uploaded or linked (FR-208) | The LMS player (if any) exposes captions when a caption file is supplied; the upload form asks for one and records when none is given (assumption). Content accuracy is the facilitator's responsibility. |

### 11.2 Timing Adjustable (2.2.1) against a server-authoritative exam timer

1. **Position.** The exam time limit is an essential part of the activity: extending it on request would invalidate the assessment. WCAG 2.2.1 allows this under its "essential" exception. The exception is relied on only for the exam timer and the exam window; it is not relied on for session timeouts or any other timer in the system.
2. **What the learner is told, and when.** Duration, window, and "the timer does not pause" are stated on the pre-flight page before the attempt is created, together with how to request more time in advance.
3. **Accommodation before the sitting.** Additional time is granted per learner by the coordinator before the attempt starts, as a duration adjustment that the server folds into `expires_at` at start and snapshots with the attempt (assumption: requires a small addition to the exam model; section 12, Q5). The learner's pre-flight page then states their own duration ("You have 2 hours 30 minutes"). Nothing is adjustable once the attempt is active, which keeps the timer server-authoritative.
4. **Warnings without interruption.** Threshold warnings at 15, 5, and 1 minute are polite status messages, not dialogs that would themselves consume time.
5. **No hidden time limits.** The acceptance grace is a transport tolerance, not time the learner can use; it is not presented as a limit and needs no adjustment mechanism.
6. **Remedy for failure, not for pace.** A sustained outage is handled by void and regrant (P-13), which is an administrative remedy and not a timing adjustment.

### 11.3 Status messages (4.1.3)

| Message | Role and politeness | Frequency rule |
|---|---|---|
| Exam save status | `role="status"`, polite | Announce only transitions into or out of a problem state, and "Submitted and locked"; never the ten-second "Saved" tick |
| Exam low-time thresholds | `role="status"`, polite | Once each |
| Integrity overlay, takeover screen, "cannot keep a safety copy" | `role="alertdialog"` or `role="alert"` | Immediately |
| Upload progress | `role="status"` plus a progress element with a text value | At 25% steps, on pause, on resume, on completion |
| Draft saved (marking, forms) | `role="status"`, polite | On first save and after recovery from an error; otherwise silent with visible text |
| Filter and search result counts | `role="status"`, polite | After results update: "23 learners shown" |
| Toast confirmations | `role="status"`, polite | Once; content also remains available on the page where it matters |
| Form error summary | `role="alert"`, receives focus | On submit |

### 11.4 Verification

- Automated checks (axe or equivalent) in CI on every P0 route, in both themes.
- Manual keyboard-only pass and screen reader pass (NVDA with Firefox or Chrome, JAWS with Chrome or Edge, VoiceOver with Safari, TalkBack with Chrome) on all P0 screens before release.
- Exam mode is tested end to end with a screen reader, at 400% zoom, and with Windows High Contrast, including the integrity overlay, the takeover screen, offline recovery, and time up.
- Usability testing with at least five learners of lower technical confidence on their own phones, covering Flow A and the result view, and on a shared laptop covering Flow B (assumption: recruitment through the institution).

---

## 12. Open UX questions for the product owner

| # | Question | Why it matters | Recommended default |
|---|---|---|---|
| Q1 | While a result is held, may the learner be shown a second waiting state ("Marked, in quality check")? | It shows progress, but it moves backwards on a return, and because all NYC decisions are sampled (FR-503) any visible difference risks hinting at the outcome. The data model also hides held results from the learner. | No. One state, "Being assessed", with the moderation explanation (section 7.3). |
| Q2 | May learners be shown an expected release date for a moderated cohort? | It reduces anxiety, but there is no agreed maximum hold (P-03) and a missed date damages trust. | Not until P-03 is settled. Then show "We expect to release results by [date]", set by the coordinator on the cycle, with a notice if it moves. |
| Q3 | Can a moderator conclude an item with a recorded disagreement and no return? | The sample-item state model has no such terminal state, but FR-508 and FR-509 are separate requirements. It changes the finding form and the sign-off rule. | No. A disagreement requires a return; persistent disagreement after a re-mark is escalated through cohort observations (FR-508). |
| Q4 | When a person who assesses in a cohort is also given the Moderator role there, should the role assignment be blocked or only advised? | FR-104 speaks of rejecting the role assignment; the architecture (and FR-504) enforce per item at allocation, which is what BR-01 actually requires. | **Decided 21 September 2026 (product owner): adopted.** Advise at role assignment; block at allocation with the named conflict panel. The same panel is used in both places. Register U-01. |
| Q5 | Are per-learner exam accommodations in scope: additional time set before the sitting, permitted paste, and an assistive-technology note on the integrity log? | Needed to defend the 2.2.1 "essential" exception and to avoid penalising assistive technology users through integrity flags. It is a small model change (duration adjustment and flags snapshotted on the attempt). | **Decided 21 September 2026 (product owner): adopted.** Set by the coordinator before the attempt, audited, visible to the assessor. Register U-02; data model `exam_accommodations`. |
| Q6 | May we provide a practice run of exam mode with sample questions, no attempt record, and no integrity logging? | Learners have varying technical confidence (SRS 2.2); the first experience of fullscreen restrictions should not be a summative exam. It also lets learners test their device days ahead. | Yes, P1, reusing `ExamShell` with fixed sample content. |
| Q7 | Is the appeal reviewer's name shown to the learner? | Transparency about independence (BR-02) against the risk of direct contact or pressure on the reviewer. | Show the description "a reviewer who did not mark your work" to the learner; names are visible to staff and in the audit trail. |
| Q8 | Is the interface English only at launch? | Plain-language rules assume second- or third-language English readers; translation affects layout (longer strings) and testing. | English only, plain language, all strings externalised so isiZulu, Sesotho, Afrikaans, or others can be added without redesign. |
| Q9 | Who sets up an exam, and under which requirement? No FR describes exam authoring, but the data model has exams with a window, duration, and attempt limit. | A screen is needed (F-11) and its owner determines where it sits in navigation. | The facilitator, under FR-201, as a task whose submission type is "online exam", with window, duration, attempt limit, and questions. |
| Q10 | Does missing mandatory evidence block a coursework submission, and does a resubmission remain possible while an appeal on the same result is open? | Both change Flow A and the result view's actions. The SRS is silent. | Block submission until every mandatory evidence requirement has a file; allow resubmission and appeal in parallel, because the appeal window is short and the resubmission deadline is independent. |

---

## 13. Handoff notes

### 13.1 For the UI Designer

| Topic | Decision the design system must support |
|---|---|
| Shells | Three: `AuthShell`, `AppShell`, `ExamShell`. `ExamShell` shares tokens but none of the navigation components. |
| Navigation | Unified SideNav grouped by workspace (up to seven groups, flat for single-role users); 72 px rail at `md`; BottomTabs (max five) plus a workspace picker sheet at `base`. |
| Breakpoints | 320 base, 768 `md`, 1024 `lg`, 1280 `xl`, 1440 `2xl`. Two-pane workspaces only from `xl`. Content cap 1200 px; prose measure 720 px. |
| Status tags | Five tones: `neutral`, `info`, `positive`, `caution`, `critical`. "Late", "Held", "Not yet competent", "Returned", and "Amended: lower" are `caution`. `critical` is reserved for system faults and the "cannot keep a safety copy" state. All tags carry text. |
| Components needed beyond the basics | Status line (autosave), upload row with seven states, version history list, decision history list, conflict panel, consequence dialog, receipt block, delivery-evidence disclosure, deadline line (appeal and resubmission), timeline (appeal tracker), evidence viewer frame, rubric row, sticky decision bar and decision sheet, exam bar, question navigator with four states, integrity overlay, takeover screen, offline banner, mobile gate, read-only (archived) banner, tier-grouped candidate list with disabled rows and visible reasons. |
| Target sizes | 44 by 44 CSS px for primary, navigation, sticky-bar, and exam navigator targets; 24 by 24 minimum elsewhere. |
| Sticky regions | TopBar, BottomTabs, sticky action or decision bar, ExamBar, exam ActionBar. All must leave focused elements visible (2.4.11). |
| Themes | Light, dark, and system, selectable from the account menu and the sign-in footer. Exam mode follows the same setting. |
| Disabled rows with reasons | Excluded reviewers and blocked actions show their reason as visible text, not a tooltip. |

### 13.2 For prototype builders

- Build the 18 P0 screens in section 5.2 using the shared example data at the top of this document, so that names, dates, and counts agree across screens.
- Each P0 specification lists the states to show. Where a screen has a blocking state (sign-off blocked, named conflict, window closed, offline), that state is as important as the default.
- The exam prototype must demonstrate the state sequence in section 8 without a backend: local save, acknowledged save, offline and recovery, integrity overlay, `lease_lost` takeover, five-minute warning, time up, receipt.
