# LMS Design Fixes and Decisions Register

## Purpose

This register records every change made to the architecture package after its first issue on 16 September 2026, why it was made, what was decided, and whether the decision is settled. It has two sources:

- **Coverage pass.** A requirement-by-requirement reading of SRS version 1.0 against the design, which found requirements the component-level traceability matrix had hidden.
- **Independent review.** A software-architecture review and a backend review on 18 September 2026, merged in [reviews/2026-09-18-architecture-review.md](reviews/2026-09-18-architecture-review.md). Groups A to I below are that document's; its findings in groups E and I were unnumbered and are numbered here.

The design documents now state the corrected design directly. This register is the index from a finding to its decision and to the place it was applied.

## How to read the status column

| Status | Meaning |
|---|---|
| **Decided** | An engineering decision within the architecture's remit. Applied. Reopen only with new evidence. |
| **Working decision** | Applied as the design basis so work can continue, but it encodes a policy, cost, or legal choice that belongs to a named owner. Listed in section 1 for confirmation. |
| **Open** | Not decided. The design shows the options or a placeholder. |
| **Deferred** | A recommendation accepted in principle and not yet carried out. Listed in section 4. |
| **Declined** | A recommendation considered and not adopted, with the reason. |

## 1. Decisions needed from owners

These are the working and open decisions. Each is applied in the documents as shown, so confirming one changes nothing and rejecting one identifies exactly what must be revised. The "Blocks" column says what should not be built until the owner answers.

| ID | Question | Working decision applied | Owner | Blocks |
|---|---|---|---|---|
| P-01 | Is moderation a property of the cohort, and may it change mid-cohort? | Required `moderated` / `not_moderated` attribute set at creation; change is versioned and refused while results are pending or held | Quality assurance | Finalise, freeze, sign-off functions |
| P-02 | What does a moderation cycle cover? | Named assessable items or units, optionally a period; one non-terminal cycle per item | Quality assurance | Freeze and sign-off functions |
| P-03 | What is the longest acceptable hold before a learner sees an outcome, especially NYC? | No value assumed; a configurable threshold drives a dashboard and alert | Quality assurance | Go-live, not build |
| P-04 | Must resubmission decisions (NYC to Competent) be moderated? | Yes, by the next cycle, like any decision in a moderated cohort | Quality assurance | Finalise function |
| P-05 | Who may sign off a cycle? | A moderator who took no assessment decision on any sampled result | Quality assurance | Sign-off function |
| P-06 | Does sign-off release the whole cohort (FR-511 wording) or the sampled population? | The frozen population only; later decisions wait for the next cycle (CR-19) | Quality assurance | Sign-off function |
| P-07 | How do several assessments roll up to one unit's credit, and may one task serve several units? | Credit when every required item has a released Competent decision; many-to-many allowed; requirement set frozen per cohort | Academic policy, with the AS-03 unit list | Credit functions |
| P-08 | Is one remark appeal per result the rule? Does a view-script request extend the window? | One remark per result, ever; no extension | Academic policy | Appeal functions |
| P-09 | After an appeal downgrades a result to NYC, does the learner get remediation and resubmission? | Yes, like any NYC decision | Academic policy | Appeal conclusion function |
| P-10 | Is the appeal reviewer fallback order in SRS AS-02 confirmed? | AS-02 order applied | Academic policy | Reviewer allocation |
| P-11 | Is the seven-day window calendar days, and is the last day inclusive? | Calendar days; closes at the start of the eighth local day; learner shown the last full day | Academic policy | Release functions |
| P-12 | Is there an administrative route to correct a wrongly released outcome? | `correction` decision under dual control, original retained | Academic policy | Correction route only |
| P-13 | Exam timing: does the timer pause on disconnect; when does a late-started attempt expire; how long is the acceptance grace; who may void and regrant? | Never pauses; earlier of start plus duration and window close; short configurable grace, flagged; coordinator voids and regrants | Academic policy | Exam functions; grace value before go-live |
| P-14 | Which Supabase plan? | Pro with point-in-time recovery and Small compute; Team only if the Auth lockout hook is wanted | Management | Recovery objective, lockout mechanism |
| P-15 | Which Vercel plan? | Pro, which per-minute cron requires | Management | Worker schedule |
| P-16 | Where is the system hosted? | Database and functions co-located in the European region with the lowest measured latency from South Africa | Management, information officer | Latency spike; POPIA cross-border assessment |
| P-17 | Is the residual risk of lockout on the Pro plan accepted? | Yes: honest-client counting, CAPTCHA, per-address limits; direct Auth calls are limited but not counted | Security owner | Nothing; recorded risk |
| P-18 | Records and file retention by record class | None assumed; five- and seven-year capacity scenarios only | Information officer, legal | Production data |
| P-19 | Storage recovery objective | None assumed; external scheduled replication designed | Operations, management | Go-live |
| P-20 | Availability target | 99.9% monthly for planning | Product, operations | Nothing |
| P-21 | Department credential standard | Opaque 256-bit bearer secret, HMAC-verified, rotation overlap; OAuth or mutual TLS only if mandated | Department integration owner | Department API build |

## 2. Fix register: independent review

Severity is the reviewers'. "Applied in" names the primary location; related text in other documents was aligned.

### A. Moderation hold and release

| ID | Finding | Sev. | Decision | Status | Applied in |
|---|---|---|---|---|---|
| A1 | Decisions finalised after the population freeze are released unsampled or stranded | Critical | Moderated results wait in a pending pool; a cycle claims pending results in scope at freeze; sign-off releases exactly that population; later results go to the next cycle | Working (P-04, P-06) | ADR-019; data model "Moderation"; API sign-off |
| A2 | A cycle has no scope and two open cycles are ambiguous | Critical | Explicit scope; exclusion rule allows one non-terminal cycle per item | Working (P-02) | ADR-019; `moderation_cycle_scope` |
| A3 | Hold fails open when no cycle was planned, was planned late, or between cycles | High | Hold depends on a required cohort attribute, not on a cycle existing | Working (P-01) | ADR-019; `cohort_moderation_state` |
| A4 | No way to cancel a wrongly planned cycle | High | `cancelled` state, allowed only before freeze | Decided | Data model state models; API moderation table |
| A5 | No lock order; finalise races freeze, sign-off, and plan | High | Fixed lock order; finalise takes a shared lock on cohort moderation state, the others exclusive | Decided | Data model "Lock order"; ADR-019; tests 22-23 |
| A6 | A hold hides an NYC outcome while the resubmission deadline runs | High | Remediation stored as a period and resolved from release (CR-14) | Decided | Data model `results`; test 26 |

### B. The result entity

| ID | Finding | Sev. | Decision | Status | Applied in |
|---|---|---|---|---|---|
| B1 | "The result" has four names and no definition; release data has nowhere to live | High | First-class `results` aggregate, one per learner and assessable item, with release sequence | Decided | ADR-021; data model |
| B2 | State table mixes instance, result, and decision states; resubmissions break the chain | High | Three separate state machines; every instance for a learner and item shares one result | Decided | Data model state models |
| B3 | Append-only enforcement left as "trigger or revoked privileges" | Medium-High | Both, including revocation from `service_role` and a truncate trigger; forked chains prevented by `UNIQUE (supersedes_decision_id)` | Decided | Data model "Append-only enforcement"; ADR-024 |

### C. Credits

| ID | Finding | Sev. | Decision | Status | Applied in |
|---|---|---|---|---|---|
| C1 | "Un-reversed award" partial index cannot exist on an append-only table | High | Removed; uniqueness on `(learner, unit, award_seq, entry_type)` | Decided | ADR-022; data model |
| C2 | Per-decision uniqueness breaks when one item serves two units | High | Awards keyed per learner and unit, not per decision | Working (P-07) | ADR-022 |
| C3 | Concurrent releases can each miss the other and award nothing | High | `learner_unit_outcomes` row locked during evaluation | Decided | ADR-022; tests 17 |
| C4 | Requirement sets unversioned; awards not reconstructable | High | Versioned set frozen per cohort; ledger stores contributing decisions and set version; reconciliation job | Decided | ADR-022; test 25 |
| C5 | ADR-016 still described per-decision award; roll-up had no ADR | Medium | ADR-022 written; ADR-016 status names it | Decided | ADR-016, ADR-022 |

### D. Exam path

| ID | Finding | Sev. | Decision | Status | Applied in |
|---|---|---|---|---|---|
| D1 | Lockout blocks existing sessions, so a third party can end a learner's exam | Critical | Lock applies to new password sign-ins only; never to sessions or exam commands; self-expiring | Decided | ADR-026; security document; test 20 |
| D2 | Auth password hook is Team/Enterprise only; fallback does not count direct calls | Critical | Server-mediated counting with CAPTCHA on Pro; residual risk recorded; hook if Team is chosen | Working (P-14, P-17) | ADR-026, ADR-027 |
| D3 | Final flush at timer zero is always rejected | High | `accept_until = expires_at + grace`; answers in grace kept and flagged | Working (P-13, grace value) | ADR-023; API exams |
| D4 | A function that finalises then raises rolls back its own finalisation | High | Typed results; never raise after a terminal transition; submit after auto-expiry returns the receipt | Decided | ADR-023; API "Errors and status codes" |
| D5 | Per-question autosave against an attempt version causes false conflicts and throttles replay | High | One batch per interval; per-answer `client_seq`; no attempt version in autosave | Decided | ADR-023; API `PUT .../answers` |
| D6 | Editing lease named but not designed; recovery tab cannot write | High | Lease is a fencing token rotated on acquire, held in tab memory | Decided | ADR-023; API `POST .../lease` |
| D7 | Locking the exam row serialises synchronized starts | Medium | Lock the enrolment row; insert on conflict | Decided | Data model "Exams"; test 1 |
| D8 | The "coordinator extension" has no command and comes too late | Medium | Void-and-regrant command; voided attempt retained | Working (P-13) | API `POST .../void` |

### E. Data API exposure and actor identity

| ID | Finding | Sev. | Decision | Status | Applied in |
|---|---|---|---|---|---|
| E1 | Browsers can call the Data API directly, bypassing Route Handlers | Critical | Only a read-oriented `api` schema exposed; commands in unexposed module schemas | Decided | ADR-024; security document |
| E2 | Actor identity undefined; an actor parameter would be forgeable | Critical | Commands run with the caller's session; actor is always `auth.uid()`; worker functions to `service_role` only | Decided | ADR-024 |
| E3 | Default grants make new functions callable by anyone | Critical | Default execute revoked; explicit grants; CI privilege enumeration; empty `search_path` | Decided | ADR-024; CI gates; test 28 |
| E4 | Answer keys readable and scores forgeable through RLS-only access | Critical | Keys in tables with no learner policy; scores computed by functions | Decided | Data model `question_keys` |
| E5 | Route Handler rate limits are bypassable | High | Limits that protect the database enforced inside functions | Decided | ADR-024; security rate table |
| E6 | Rules live in SQL but the design is organised around TypeScript modules | Medium | Schema per module; placement rule; predicates written once; database test harness first; additive signatures | Decided | ADR-024; system design "Where rules live" |
| E7 | Audit rows written by a second client call are not atomic | Medium | Audited tables written only through functions or audit triggers | Decided | ADR-024 |

### F. Async, scheduling, and recovery

| ID | Finding | Sev. | Decision | Status | Applied in |
|---|---|---|---|---|---|
| F1 | Post-commit dispatcher undefined and unnecessary | High | Enqueue inside the domain transaction; outbox remains the delivery ledger; alert on oldest undelivered outbox row | Decided; spike X-2 confirmed 23 Sep 2026 | ADR-025 |
| F2 | Transaction-scoped advisory lock cannot cover a per-message batch; session locks do not survive the pooler | High | No advisory lock; visibility timeouts make overlap harmless | Decided | ADR-025; API operational routes |
| F3 | Vercel Cron is GET, best effort, no scheduled instant, paid for per-minute | High | GET with cron secret; one-shot jobs unique by domain object; database schedules on Supabase Cron | Decided; plan is P-15 | ADR-025 |
| F4 | 15-minute RPO needs a paid add-on; in-place restore rewinds Storage metadata, queue, outbox, Auth | Medium | Add-on in the planning basis; restore runbook pauses worker, suppresses old outbox rows, reconciles Storage | Working (P-14) | ADR-027; security "Backup, restore" |
| F5 | Storage replication has nowhere to run | Medium | External scheduled runner over the S3 endpoint | Working (P-19) | ADR-027 |
| F6 | No region decided; latency alone can consume the autosave target | Medium | Functions pinned to the database region; one round trip per autosave; local token verification | Working (P-16), pending spike X-3 | ADR-027; ADR-023 |
| F7 | Sign-off runs under the Data API's 8-second timeout | Medium | Set-based release over the SQL path with explicit timeout; CI gate of two seconds for 1,000 results | Decided | API sign-off; CI gates |
| F8 | Rate-bucket rows never purged | Low | Purge on a database schedule | Decided | Data model `rate_buckets` |

### G. API and integration

| ID | Finding | Sev. | Decision | Status | Applied in |
|---|---|---|---|---|---|
| G1 | Department cursor misses held-then-released results; one cursor for three arrays; no change discovery | High | `release_seq` change feed; separately paginated collections; `released_at` as public timestamp | Decided | API "Department-facing API"; ADR-021 |
| G2 | Password hash per request is the wrong primitive and a lockout vector | Medium | 256-bit secret, HMAC-SHA-256 with pepper, separate failed-authentication limits | Working (P-21) | API; security document |
| G3 | Signed upload URL, checksum, and resume claims do not match Storage behaviour | Medium | Resumable upload with signed token; intent expiry as the control; size from Storage; server-computed SHA-256 in the scan step | Decided, pending spike X-5 | Data model "Submissions and files"; API |
| G4 | Calendar feed: token in logs, unspecified caching, revoked-token 404s throttling shared fetchers, per-poll writes | Medium | Private caching; revoked tokens not counted; coarse `last_used_at`; log redaction | Decided | ADR-020 |
| G5 | Appeal deadline ambiguous between instant and date | Medium | Exclusive instant at the start of the eighth local day; snapshotted at release | Working (P-11) | Data model `results`; test 8 |
| G6 | Two idempotency mechanisms per route; byte-equivalent replay impossible | Low-Medium | One permanent client identifier; header is an alias; semantic equivalence; record written in-transaction | Decided | API "Idempotency" |
| G7 | No contract for planning a cycle, findings, returns, admissibility, conclusion | Medium | Routes added | Decided | API moderation and appeals tables |

### H. Appeals and assignments

| ID | Finding | Sev. | Decision | Status | Applied in |
|---|---|---|---|---|---|
| H1 | A second remark after the first concludes is a second level of appeal | High | One admitted remark per result, ever; appeal decisions not appealable (CR-15) | Working (P-08) | Data model "Appeals"; test 24 |
| H2 | "Original assessor" unanchored after re-marks and resubmissions | High | Every actor of an assessment-type decision on the result, computed from `decisions` (CR-16) | Decided | Data model "Identity"; test 16 |
| H3 | Appeal outcome versus later hold, and downgrade to NYC, unstated | Medium | Appeal and correction decisions release immediately and are never claimed by a cycle; downgrade carries remediation | Decided; remediation is P-09 | ADR-019; API conclusion |
| H4 | Module call graph has cycles and missing edges | Medium | Layered acyclic graph; one recorded upward exception; Appeals reads Moderation findings through a published view | Decided | System design "Module boundaries" |
| H5 | Allocation stored in up to four places; no reallocation; a departure blocks sign-off | Medium | `role_assignments` is capability scope only; allocation lives on the work item; reallocation commands; deactivation refused while allocations are open | Decided | Data model "Identity"; API allocation; test 21 |
| H6 | Constraints that do not enforce their invariant | Medium | Exclusion constraint for assignment ranges; lock the profile row; attempt limit snapshotted onto the attempt; `not_started` removed | Decided | Data model |

### I. Documentation quality

| ID | Finding | Decision | Status | Applied in |
|---|---|---|---|---|
| I1 | CR-07 contradicted CR-09 | CR-07 restated; CR-09 rewritten | Decided | Traceability |
| I2 | Freeze described three ways; invalid cycle state names; missing transitions | One transaction for freeze and sample; state sequence corrected | Decided | Data model state models |
| I3 | Upload finalisation: one step in two documents, two in the API | Two steps everywhere | Decided | System design; data model; API |
| I4 | Scope types differ between documents | Global, programme, cohort, unit only | Decided | System design; data model |
| I5 | BR-04 row said only sign-off releases | Three release paths named | Decided | Traceability |
| I6 | Matrix rows identical; test identifiers undefined; self-awarded score | Matrix labelled an ownership map; evidence is the specific-coverage table and numbered tests; score table removed | Decided; full per-FR coverage Deferred (R-3) | Traceability; system design |
| I7 | Nine ADR revisit triggers are not measurable | New ADRs carry measurable triggers; older ones to be restated at approval | Deferred (R-2) | ADR index |
| I8 | Significant decisions with no ADR | ADR-021 to ADR-027 written; audit capture and scheduler choice folded into ADR-024 and ADR-025 | Decided | ADR set |
| I9 | Audit volume understated about fivefold | Row corrected to 60,000-250,000 a year | Decided | Capacity |

### Recommendations declined

| Recommendation | Reason |
|---|---|
| Remove ADR-010 (no Kafka/RabbitMQ) and ADR-011 (no sharding) as unnecessary | Kept. They are cheap, and they stop the question being reopened later without the capacity evidence. |
| Drop Supabase Queue and claim outbox rows with `SKIP LOCKED` | Not adopted. In-transaction enqueue removes the same loss window while keeping visibility timeouts, read counts, and archive. Reconsider if spike X-2 fails. |
| Move the calendar token to a query parameter | Not adopted. Platform logs record the query string too; redaction is required either way. |

## 3. Fix register: SRS coverage pass

Requirements that had no specific design element, or an incomplete one. Several of the first-pass answers were later corrected by the review; the final position is shown.

| ID | Requirement | Gap | Final design | Status |
|---|---|---|---|---|
| S-01 | FR-301 | No record of material access | `material_access_events`, coalesced, engagement reporting only | Decided |
| S-02 | FR-205, FR-302, FR-303 | No quiz attempt or result entity | `quiz_attempts`, `quiz_responses`, `question_keys`; structurally unlinked from results and credits | Decided |
| S-03 | FR-304 | External calendar subscription not designed | Token-authenticated iCalendar feed (ADR-020, corrected by G4) | Decided |
| S-04 | FR-106 | Lockout assumed a Supabase feature that does not exist | ADR-026 (corrected by D1, D2) | Working (P-14, P-17) |
| S-05 | FR-104, FR-105 | Conflict not rejected or named at assignment time | Enforced in allocation commands, which name the conflict; role change refused while allocations are open (corrected by H5) | Decided |
| S-06 | FR-501, FR-506, FR-408, BR-04 | Results could be released before sampling | ADR-019 (first draft corrected by A1-A5) | Working (P-01, P-02) |
| S-07 | FR-801, FR-1003 | Credit per unit versus decisions per item | ADR-022 (first draft corrected by C1-C4) | Working (P-07) |
| S-08 | FR-313 | Expiry did not clearly enter assessment | Expiry is an automatic submission with a receipt | Decided |
| S-09 | FR-406 | `assessor_judgements` referenced but undefined | Entity added | Decided |
| S-10 | FR-904, FR-905 | Grace period and threshold unspecified | Integrity configuration snapshotted on the attempt; advisory flag only | Decided |
| S-11 | FR-508 | No cohort-level observations | `moderation_observations` | Decided |
| S-12 | FR-503 | "First-time assessor" undefined | Derived at freeze and stored in the selection-basis snapshot | Decided |
| S-13 | FR-702 | Readiness items not an entity | `readiness_items`, including "moderation policy confirmed" | Decided |
| S-14 | FR-103 | No import entities | `import_batches`, `import_rows` | Decided |
| S-15 | FR-204 | No module to tag material to | `modules` | Decided |
| S-16 | FR-1001 | "Documented" API had no artefact | OpenAPI description published with the policy | Decided |
| S-17 | SRS AS-02 | Reviewer fallback order absent | Tiered eligibility in AS-02 order | Working (P-10) |
| S-18 | SRS section 8 | Plagiarism integration point not shown | `submission_checks`, empty at launch | Decided |
| S-19 | FR-208, NFR-01 | Recording uploads absent from capacity | Capacity note; links preferred (CR-13) | Decided |
| S-20 | FR-314, NFR-07 | "Timer at its recorded state" ambiguous | Timer never pauses (CR-11; ADR-023) | Working (P-13) |

## 3a. Decisions from the UI design work

Raised by the UX architecture ([ui/LMS-ux-architecture.md](ui/LMS-ux-architecture.md), section 12) and decided by the product owner. The remaining UX questions in that section keep the architect's recommended default until answered.

| ID | Question | Decision | Status | Applied in |
|---|---|---|---|---|
| U-01 | FR-104 speaks of rejecting a conflicting role assignment, but BR-01 applies per assessment instance and the architecture enforces it at allocation. Block or advise at role assignment? | Advise at role assignment, block at allocation. The assignment succeeds and returns an advisory naming the results the user will be excluded from; allocation refuses with the named conflict. One panel serves both (CR-20). | Decided by product owner, 21 September 2026 | Data model "Identity"; API role assignments; UX spec Q4 |
| U-02 | Are per-learner exam accommodations in scope? | Yes. Before the sitting a coordinator may grant additional time, permit paste, and note assistive technology in use. The start function folds the time into the learner's duration and close time and snapshots the accommodation on the attempt, visible to the assessor beside the integrity log. Nothing changes once the attempt is active. This supports the WCAG 2.2.1 "essential" exception for the exam timer and stops assistive technology being misread as an integrity event. | Decided by product owner, 21 September 2026 | Data model `exam_accommodations`; API accommodations route and exam start; UX spec Q5 |

U-02 adds a category of restricted personal information. The reason is stored as a category, not a medical detail, and its handling belongs in the POPIA assessment alongside integrity-event collection.

## 4. Deferred work

| ID | Item | Why deferred | When |
|---|---|---|---|
| R-1 | Redraw `LMS-architecture.html` for the calendar feed, `results`, cohort moderation policy and pending pool, Supabase Cron, in-transaction enqueue, and the exam lease and grace | Hand-positioned diagrams; better redrawn once working decisions are confirmed | Before architecture approval |
| R-2 | Restate the revisit triggers of ADR-001, 002, 004, 005, 006, 012, 013, 016, and 018 with a metric and threshold | Editing nine records piecemeal would blur the decision history | At architecture approval |
| R-3 | Extend requirement-specific coverage to every functional requirement, and write the reserved test cases | The ownership matrix is now labelled honestly; per-FR evidence belongs with test design | Test design |
| R-4 | Price the Storage high case, replication, and the plan add-ons | Needs the retention decision (P-18) and plan decision (P-14, P-15) | With ADR-027 approval |
| R-5 | Reconcile the use-case catalogue with the SRS (CR-05) | Catalogue maintenance, not architecture | Before requirements baseline |

## 5. Platform spikes before build

Each settles an assumption the corrected design depends on. A failed spike reopens the named decision.

| ID | Experiment | Settles | Reopens if it fails | Result |
|---|---|---|---|---|
| X-1 | Create functions in `public` and in an unexposed schema; call both from a browser with only the publishable key and a learner token; confirm the revoke recipe | E1-E3 | ADR-024 | **Confirmed 23 Sep 2026.** Unexposed schemas (`public`, `identity`, `audit`, GraphQL) refuse every call with `406 PGRST106`, even for a function granted to `anon`; a new `api` function without an explicit grant refuses with `42501`. Local and staging. Kept as a CI check: `scripts/check-data-api-exposure.mjs`. |
| X-2 | Send a queue message inside a domain function and force a rollback; confirm the message is gone; confirm read count and visibility timeout are reachable | F1 | ADR-025 | **Confirmed 23 Sep 2026.** A message sent before a domain function fails is rolled back with its outbox row; `read_ct` rises per read, the visibility timeout hides a message from a second reader, `set_vt` and `archive` work (pgmq 1.5.1, also available on staging). Kept as `supabase/tests/database/0007_queue_in_transaction.test.sql`. |
| X-3 | One-function autosave pinned to the database region; 250-client load test from a South African client; repeat with the function in Cape Town | F6, D5 | ADR-027, ADR-023 | Not run yet |
| X-4 | Set-based release of 1,000 results; measure against the two-second gate | F7 | API sign-off path | Not run yet |
| X-5 | 25 MB resumable upload with a signed token on an interrupted connection; record which integrity fields Storage metadata exposes | G3 | Upload handshake | Not run yet |
| X-6 | Point-in-time restore of a throwaway project to ten minutes ago after uploads and queue sends; observe Storage metadata, queue, Auth, downtime | F4 | Restore runbook, RTO | Not run yet |
| X-7 | Per-minute Vercel Cron for 48 hours logging missed and duplicate runs, beside a Supabase Cron job doing the same sweep | F3 | ADR-025 | Not run yet |

## 6. What can start, and what waits

**Can start now:** authentication and session handling; the schema-per-module and privilege regime with its CI check (ADR-024); the database test harness; direct resumable uploads; the exam persistence protocol (ADR-023), apart from the grace value; the platform spikes.

**Waits for owner confirmation:** the finalise, freeze, sign-off, appeal, correction, and credit functions, which encode P-01, P-02, P-04 to P-09, and P-11. They are the functions whose mistakes cannot be undone, because a release cannot be recalled.

**Before production data:** P-14 to P-16 (plans and region), P-18 (retention), P-19 (Storage recovery), the Department agreement, and the POPIA cross-border assessment.
