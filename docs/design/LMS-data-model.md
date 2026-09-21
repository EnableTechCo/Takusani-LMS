# LMS Data Model

## Modelling principles

- PostgreSQL is authoritative for identity linkage, authorization scope, workflow state, exams, decisions, results, credits, notifications, and audits.
- File bytes live in private Storage; PostgreSQL stores immutable object keys, sizes, types, declared and computed checksums, and ownership metadata.
- Historical submissions, decisions, configuration versions, and credit changes are append-only.
- Mutable workflow records carry a version number and explicit state. The deliberately mutable rows in the academic core are few and named: `results`, `learner_unit_outcomes`, `cohort_moderation_state`, `moderation_cycles`, and `exam_attempts`.
- All timestamps are `timestamptz` in UTC. Local deadlines are derived using `Africa/Johannesburg`, which has no daylight saving, so interval arithmetic is safe.
- No institution or tenant discriminator is present.
- Each module owns one SQL schema. Tables and command functions live in unexposed module schemas; only the read-oriented `api` schema is exposed to the Supabase Data API (ADR-024).

### Append-only enforcement

Append-only tables (`decisions`, `credit_ledger_entries`, `submission_versions`, `moderation_populations`, `moderation_findings`, `moderation_observations`, `appeal_events`, `exam_integrity_events`, `assessor_judgements`, `material_access_events`, `audit_events`, `api_access_events`, `configuration_versions`) are protected twice: `UPDATE`, `DELETE`, and `TRUNCATE` are revoked from `anon`, `authenticated`, and `service_role`, and `BEFORE UPDATE OR DELETE` and `BEFORE TRUNCATE` triggers raise. Revocation alone does not bind the roles and definer functions that actually write these tables.

### Lock order

Every workflow function acquires locks in this order and never in another: `cohort_moderation_state`, then `moderation_cycles`, then `results` (in ascending identifier order when several), then `learner_unit_outcomes`. Exam functions lock only the attempt. Identity functions lock only the `profiles` row of the user whose assignments change.

## Core relationships

```text
auth.users 1--1 profiles
profiles 1--* role_assignments *--1 roles
programmes 1--* qualifications 1--* units
units *--* assessable items through unit_assessment_requirements (versioned set, frozen per cohort)
programmes 1--* cohorts 1--1 cohort_moderation_state
cohorts 1--* enrolments *--1 profiles
cohorts 1--* tasks 1--* submissions 1--* submission_versions 1--* files
cohorts 1--* exams 1--* exam_attempts 1--* exam_answers
(learner, assessable item) 1--1 results
results 1--* assessment_instances 1--* decisions
cohorts 1--* moderation_cycles 1--1 moderation_populations 1--* moderation_sample_items
results 1--* appeals 1--* decisions
(learner, unit) 1--1 learner_unit_outcomes 1--* credit_ledger_entries
domain events 1--* audit_events
domain events 1--* outbox_messages 1--* notification_deliveries
```

An assessable item is a task or an exam. `assessable_items` gives both one identifier so results, requirements, and cycle scope can refer to either.

## Entity catalogue

### Identity and authorization

| Entity | Key fields and constraints |
|---|---|
| `profiles` | Auth user ID PK; status (active, deactivated); display/learner identifiers; deactivation timestamp |
| `roles` | Stable code: learner, facilitator, assessor, moderator, coordinator, administrator |
| `role_assignments` | User, role, scope type and scope key, effective range, assigned-by; no overlapping assignment of the same role and scope |
| `sign_in_failures` | Profile, consecutive failure count, window start, `locked_until`; reset on success, expiry, recovery, or administrator unlock (FR-106, ADR-026) |
| `import_batches` | Intake file digest, uploader, state, row counts, error-report reference; unique digest per intake prevents replay (FR-103) |
| `import_rows` | Batch, row number, normalised identity key, validation outcome, resulting profile/enrolment reference |
| `calendar_feed_tokens` | Owner profile, SHA-256 token hash, created/rotated/revoked timestamps, coarse `last_used_at`; one active token per user (FR-304) |
| `api_credentials` | Credential ID, HMAC of the secret, scopes, status, expiry, previous/next rotation relationship |
| `api_access_events` | Append-only credential, route, filters, returned record IDs, outcome, request ID, timestamp |

Scope types are a constrained enumeration: global, programme, cohort, or unit. A check constraint requires the matching scope key and rejects irrelevant keys. `role_assignments` expresses capability scope only: what a person may be allocated to. Allocation to a specific piece of work lives in exactly one place, the owning aggregate: `assessment_instances.assessor_id`, `moderation_sample_items.moderator_id`, and `appeals.reviewer_id`. RLS helpers read those columns, so there is no second copy to drift. Authorization helpers answer a specific capability question rather than exposing raw role rows.

Non-overlap of assignments is an exclusion constraint over `(user, role, scope type, scope key)` and the effective `tstzrange`; a partial unique index cannot express a time range. Assignment changes lock the user's `profiles` row first, because rows that do not yet exist cannot be locked and two concurrent first assignments would otherwise both pass their checks.

Separation of duties is enforced where the conflict can actually arise, in the allocation commands. Assigning a role whose scope overlaps work the user has already assessed is permitted, because BR-01 applies per assessment instance, but the assignment response carries an advisory listing the results that user will be excluded from, shown with the same named-conflict panel as a refusal (decision U-01). Allocating a moderator to a sample item, or a reviewer to an appeal, rejects any user who is the actor of an assessment-type decision on that result, and names the conflicting decision and allocation (FR-104, FR-504, FR-608). Ending or narrowing a role assignment, or deactivating a user, is rejected while that user holds an open allocation, until the work is reallocated (FR-105). Reallocation commands exist for assessor, moderator, and reviewer so that a departure cannot block sign-off.

"Original assessor" is never read from a mutable pointer. It is computed as every actor of an assessment-type decision on the result, across re-marks and resubmissions.

Lockout blocks new password sign-ins only. It never affects an existing session or an exam command, and it expires by itself (ADR-026). Deactivation is the control that blocks an existing session.

### Programme and learning delivery

`programmes`, `qualifications`, `units`, `modules`, `cohorts`, `enrolments`, `tasks`, `task_targets`, `rubrics`, `rubric_criteria`, `materials`, `material_access_events`, `quizzes`, `questions`, `question_keys`, `quiz_attempts`, `quiz_responses`, `sessions`, `attendance_records`, `logistics_items`, `readiness_items`, `notices`, and `stakeholder_queries` implement FR-201–FR-318 and FR-701–FR-708.

`units` carry the configured credit value used by FR-801; the value is a versioned configuration item, and the value in force at award is snapshotted onto the ledger entry. `modules` are programme-defined groupings, optionally linked to a unit, to which material is tagged (FR-204). `readiness_items` hold the checklist category, state, assignee, and due date for FR-702, including "moderation policy confirmed".

`material_access_events` is an append-only record of learner, material, and server timestamp written when a learner opens a material item (FR-301). It feeds engagement reporting only, is coalesced to at most one event per learner, item, and short interval, and never appears in assessment or Department views.

Answer keys, scoring rules, and automatic feedback live in `question_keys`, which has no learner policy; RLS filters rows, not columns, so a key on the learner-readable `questions` table would be readable (ADR-024). `quiz_attempts` store learner, quiz, attempt number, the attempt limit snapshotted at creation, score, and submitted timestamp; `quiz_responses` store per-question answers and the feedback shown (FR-205, FR-302). Attempts are created and scored only by functions; learners have no write path to a score. Unique `(quiz_id, learner_id, attempt_number)` plus `CHECK (attempt_number <= attempt_limit_snapshot)` enforces the limit under concurrency. Quiz records are formative: no foreign key links them to results, decisions, or the credit ledger, and no external view can reference them, so FR-303 is structural rather than procedural.

Material publication has draft, scheduled, published, and archived states. Teams URLs are validated values on sessions or material links; they do not create a Microsoft integration identity. Personal notes use a separate `learner_notes` table with policies permitting only the owning learner. No reporting or external view joins this table.

### Submissions and files

| Entity | Important fields |
|---|---|
| `submissions` | Learner, task, next version number, latest accepted version |
| `submission_versions` | Submission, version number, submitted timestamp, late flag, supersedes version, immutable after acceptance |
| `evidence_requirements` | Unit/task requirement and validation rules |
| `submission_evidence` | Submission version, requirement, file metadata ID |
| `file_upload_intents` | Random object key, intended owner/context, max bytes, allowed types, declared checksum, intent expiry, finalised and consumed timestamps |
| `stored_files` | Bucket, immutable object key, actual size read from Storage, detected media type, declared checksum, server-computed SHA-256, scan state, uploader, accepted timestamp |
| `submission_checks` | Submission version, check type, provider reference, state; empty at launch |

`submissions` holds no workflow status of its own; where a submission stands in assessment is read from its result, so the two cannot disagree.

Unique `(submission_id, version_number)` prevents duplicate versions. Upload is two steps. File finalisation confirms the object exists under the intent's key, reads its actual size from Storage metadata, checks it against the intent's limits and expiry, and marks the intent finalised. Submission then locks the submission, consumes finalised intents, and inserts the new version. Supabase signed upload URLs carry no per-URL size or type limit and outlive a short expiry, so the intent's own expiry, checked at finalisation, is the real control. Storage exposes no content hash, so the client's checksum is recorded as declared; the authoritative SHA-256 and media-type detection are computed server-side in the post-upload scan step. Storage upload permissions allow creation only under an authorised random prefix and never permit overwrite or move.

`submission_checks` is the deferred plagiarism integration point required by SRS section 8. Because it hangs off the immutable version rather than the assessment workflow, a provider can be added later without altering submission history.

### Exams

| Entity | Important fields and constraints |
|---|---|
| `exams` | Cohort/unit, open/close times, duration, attempt limit, published version |
| `exam_attempts` | Learner, exam, state, `started_at`, `expires_at`, `accept_until`, submission kind and timestamp, state version, `lease_id`, receipt ID, integrity configuration snapshot, void reference |
| `exam_accommodations` | Learner, exam (or all exams in a cohort), additional time, paste permitted flag, assistive-technology note, reason category, granted-by, granted timestamp; versioned, audited, and only changeable before the attempt starts |
| `exam_answers` | Attempt, question, payload, `client_seq`, persisted timestamp, received-in-grace flag; unique per attempt/question |
| `exam_integrity_events` | Attempt, event type, client timestamp, server timestamp, metadata; append-only |
| `assessor_judgements` | Attempt, assessor, material/not-material judgement on the integrity log, reasons, timestamp; append-only (FR-406) |

A partial unique index permits only one active attempt per learner and exam, and starting an attempt is `INSERT ... ON CONFLICT` against it after locking the enrolment row. The exam row is not locked, so synchronized starts do not serialise. An attempt row exists only once started; there is no stored `not_started` state.

A coordinator may grant a learner an accommodation before the sitting: additional time, permission to paste (some speech-to-text and switch-access tools insert text through the clipboard), and a note that assistive technology is in use. The start function folds the additional time into that learner's duration and extends their close time by the same amount, then snapshots the accommodation on the attempt with the integrity configuration, so the assessor sees it beside the integrity log and focus or paste events from assistive technology are not misread. Nothing is adjustable once the attempt is active, which keeps the timer server-authoritative; this pre-sitting adjustment is what supports the WCAG 2.2.1 "essential" exception for a timer the learner cannot extend. The accommodation's reason is a category, not a medical detail, and the record is restricted personal information: visible to the coordinator who grants it and, as a flag only, to the assessor.

`expires_at` is the earlier of start plus the learner's duration and the learner's close time. `accept_until` is `expires_at` plus the configured grace. Both are snapshotted at start. An answer is kept only when its `client_seq` exceeds the stored one and the request carries the current `lease_id` and arrives by `accept_until` (ADR-023). Once the attempt is terminal a trigger rejects answer writes. No client-supplied remaining time is trusted.

Expiry is an automatic submission, not an abandonment (FR-313). It runs the same transition as a learner submission: lock the attempt, take the persisted answers as final, record `submission_kind = auto_expired`, issue a receipt, and open the assessment instance. `submitted` and `expired` differ only in who initiated the transition. `voided` is reached only by an audited coordinator command that retains the attempt and its answers and restores one attempt allowance.

Each attempt snapshots the integrity configuration in force at start: the event threshold and the grace period for returning to the exam (FR-108). A return inside that period is logged and the attempt continues (FR-904); a later return is logged as a distinct event type and the attempt still continues, because no integrity signal may end or decide an attempt (FR-407). When the event count exceeds the threshold the attempt is marked `flagged_for_review`, which only orders and highlights it for the assessor (FR-905).

### Assessment, results, and immutable decisions

| Entity | Important fields and constraints |
|---|---|
| `assessable_items` | One identifier for a task or an exam; cohort; unit links through `unit_assessment_requirements` |
| `results` | Learner, assessable item (unique together), current decision ID, state (`held`, `released`), nullable `hold_cycle_id`, `released_at`, `appeal_deadline_at`, remediation period and derived deadline, `release_seq`, version |
| `assessment_instances` | Result, the submitted artefact (submission version or exam attempt), state, `assessor_id`, version |
| `marking_drafts` | Instance, criterion scores, feedback; mutable by the allocated assessor until finalisation |
| `decisions` | Result, instance where applicable, type (assessment, moderation, appeal, correction), outcome, actor, justification, created timestamp, `supersedes_decision_id`; append-only |

`results` is the single definition of what is held, released, appealed, credited, and served externally (ADR-021). Every instance for the same learner and item, including a resubmission after NYC, belongs to the same result, so NYC and the later Competent are one decision chain and "the current outcome" is one lookup. The row is written only by workflow functions. `held` to `released` happens once and sets `released_at`, `appeal_deadline_at`, and `release_seq` together; a trigger rejects any other change to those columns. A superseding decision moves the pointer and takes a new `release_seq`.

`appeal_deadline_at` is an exclusive instant: the start of the eighth local day after release, `((released_at AT TIME ZONE 'Africa/Johannesburg')::date + 8) AT TIME ZONE 'Africa/Johannesburg'`, with seven read from the configuration version in force. The learner sees the last full day on which they may lodge, and lodging compares `now()` to the stored instant after locking the result. A remediation deadline is stored as a period and resolved from `released_at` at release, so a hold delays it rather than consuming it.

`UNIQUE (supersedes_decision_id)` prevents a forked chain; a partial unique index allows one root decision per result; a composite foreign key requires `results.current_decision_id` to belong to the same result. A `correction` decision is an administrative supersession that requires two distinct authorised users and appends compensating credit entries; it exists because a wrong outcome in an unmoderated cohort is released at once and would otherwise be correctable only if the learner appealed.

### Moderation

| Entity | Purpose |
|---|---|
| `cohort_moderation_state` | One row per cohort, always present: `moderation_policy` (`moderated`, `not_moderated`), policy version, actor, timestamps; the lock target for finalise, plan, freeze, sign-off, and cancel |
| `moderation_rules` | Versioned percentage, strata, mandatory-inclusion configuration, effective range |
| `moderation_cycles` | Cohort, scope (assessable items or units, optional period), rule version, state, scheduled start, actors and timestamps |
| `moderation_cycle_scope` | Cycle, assessable item; an exclusion rule allows at most one non-terminal cycle per item |
| `moderation_populations` | Immutable set of result IDs claimed at freeze, with the selection-basis snapshot |
| `moderation_samples` | Seed, algorithm version, population digest, generated timestamp |
| `moderation_sample_items` | Sample, result, stratum, inclusion reason, `moderator_id`, item state |
| `moderation_findings` | Append-only agreement/disagreement/return decisions and reasons |
| `moderation_observations` | Append-only cohort-level observations from a moderator to the coordinator, per cycle (FR-508) |

In a `moderated` cohort, finalisation always creates or leaves the result `held` with no cycle, forming a pending pool; it releases only in a `not_moderated` cohort (BR-04, FR-408, ADR-019). The hold therefore depends on a required attribute, not on anyone remembering to create a cycle, and there is no gap between cycles. At freeze, a cycle claims every pending held result in its scope by setting `hold_cycle_id`; that set is the population, recorded immutably with its digest. Freeze and sample generation are one transaction (FR-506). Results finalised after the freeze stay pending for the next cycle, so nothing is released unsampled and nothing is stranded. Sign-off releases exactly the claimed population. Appeal and correction decisions release immediately and are never claimed.

A scheduled cycle freezes and samples automatically at its start time through Supabase Cron calling the same function as the manual command (FR-501). A first-time assessor (FR-503) is derived at freeze as an assessor with no decision in any previously signed-off cycle; the result of that derivation is stored in the selection-basis snapshot so the mandatory inclusion stays reproducible after the assessor gains history.

Sample uniqueness is enforced by `(cycle_id, result_id)`. The population digest detects later mutation. Sign-off requires every sample item concluded and no return outstanding, and its signer must not have assessed any sampled item. A sample item whose moderator leaves is reallocated, never abandoned. Invariant, monitored and enforced at archival: no result is `held` against a terminal cycle, and no cohort is archived while any result is pending or held.

### Appeals and credits

`appeals` store the result, type, grounds, lodged timestamp, the deadline snapshot copied from the result, state, admissibility, and `reviewer_id`. `appeal_events` retain every transition, including logged script views (FR-606). The concluding outcome is an immutable `appeal` decision superseding the current one. Appeal-type decisions are not appealable by construction, and a full unique index allows one admitted remark appeal per result, ever, so a concluded remark cannot be followed by another inside the window (FR-613). A view-script request does not extend the window (FR-607). A partial unique index still prevents duplicate open appeals of one type.

The reviewer selection list follows the SRS AS-02 ordering: an independent qualified internal reviewer first; failing that, the cohort moderator provided they took no assessment decision on the result; failing that, a qualified assessor from another cohort, who is allocated to this appeal only. Every actor of an assessment decision on the result is excluded at every tier. An appeal that amends the outcome to NYC carries remediation and a resubmission period like any NYC decision, pending policy confirmation.

`unit_assessment_requirements` lists, as a versioned set frozen per cohort at activation, the assessable items required for each unit; one item may count towards several units. `learner_unit_outcomes` holds one mutable row per learner and unit with the derived unit outcome, award state, and a monotonic `award_seq`. Every release or supersession touching a required item locks that row `FOR UPDATE`, re-evaluates the unit, and appends a ledger entry when the award state changes. Without that lock, two required decisions releasing concurrently would each see the other as unreleased and the learner would silently receive no credit (ADR-022).

`credit_ledger_entries` contain learner, unit, `award_seq`, entry type (`award`, `reversal`), signed credit amount, the credit value and requirement-set version in force, the contributing decision IDs, and timestamp. Unique `(learner_id, unit_id, award_seq, entry_type)` prevents duplicate allocation without ever updating a ledger row. Totals and outstanding units (FR-318, FR-802) are a projection from the ledger and `learner_unit_outcomes`; held and draft outcomes cannot contribute because only released decisions are evaluated (FR-804). The derived unit outcome also serves "competency outcomes by unit" in the Department API (FR-1003). A scheduled reconciliation compares ledger and rule.

### Notifications, audit, and jobs

| Entity | Purpose |
|---|---|
| `notifications` | Learner-visible in-app item and independent read timestamp |
| `outbox_messages` | Committed domain event, message type/version, payload reference, deduplication key, state, next-attempt time |
| `notification_deliveries` | Channel, provider reference and idempotency key, attempts, accepted/delivered/failed timestamps |
| `scheduled_runs` | Job name, domain object or scheduled instant, status, heartbeat |
| `rate_buckets` | Subject, surface, window start, count; purged on schedule |
| `idempotency_records` | Actor, route, client identifier, request digest, stored response reference; written inside the domain transaction; purged after 24 hours |
| `audit_events` | Append-only actor, acting role/scope, action, object and version, before/after references or safe diff, request ID, timestamp |
| `configuration_versions` | Versioned value, previous version, effective time, actor |

The domain function inserts the outbox row and sends the queue message in the same transaction; there is no separate dispatcher to fail between them (ADR-025). Outbox uniqueness is defined by the logical event, recipient, channel, and template version. Workers archive a queue message only after the delivery state commits, and retire poison messages by the queue's read count. Audited tables are written only by functions that append the audit event in the same transaction, or carry an audit trigger (ADR-024).

## State models

| Aggregate | Valid sequence | Invalid examples |
|---|---|---|
| Submission version | upload_pending -> finalised -> submitted (immutable) | Editing an accepted version; skipping version allocation |
| Exam attempt | active -> submitted or expired; active or terminal -> voided by coordinator command | Saving after `accept_until`; trusting client expiry; an integrity event ending an attempt; a stale lease writing |
| Quiz attempt | in_progress -> submitted | Exceeding the attempt limit; a learner writing a score |
| Assessment instance | queued -> marking -> finalised; finalised -> returned -> marking -> finalised (re-mark, new decision) | Marking by a non-allocated assessor; finalising twice from one version |
| Result | (created at first finalisation) held -> released; released -> released with a new current decision on appeal, correction, or resubmission | Releasing a held result outside sign-off; releasing twice; held against a terminal cycle |
| Decision chain | root -> superseded by successor -> ... | Updating a decision; two successors of one decision; appealing an appeal decision |
| Moderation cycle | planned -> frozen_and_sampled -> in_review <-> corrections_pending -> signed_off; planned -> cancelled | Resampling a frozen population; sign-off with returns open; cancelling after freeze; two non-terminal cycles over one item |
| Sample item | allocated -> in_review -> agreed, or returned -> remarked -> in_review; allocated or in_review -> reallocated | Moderator who assessed the result; abandoning an item when its moderator leaves |
| Appeal | lodged -> admissibility_review -> admitted or inadmissible -> allocated -> under_review -> concluded | Reviewer took an assessment decision on the result; appeal at or after the deadline instant; second remark appeal on one result |
| Notification | pending -> queued -> accepted -> delivered or failed | Re-enqueueing with a different payload under the same deduplication key |
| Cohort | active -> completion_review -> archivable -> archived | Archive while any result is pending or held, an appeal window is open, or an appeal is unresolved |

Every transition checks actor capability, expected state/version, prerequisites, and idempotency in one transaction. It emits an audit event; user-visible transitions also create notification/outbox rows. A function returns a typed result and never raises after performing a terminal transition, because the error would roll the transition back.

## Index strategy

- Role assignments: exclusion constraint on role/scope/range; lookups by user and by scope.
- Enrolments: unique active learner/cohort; indexes for learner and cohort rosters.
- Tasks/materials/sessions: cohort or audience plus publication state/date.
- Submissions: task/learner; late/outstanding dashboards.
- Exam attempts: learner/exam active uniqueness, state plus `accept_until` for finalisation, receipt ID.
- Results: unique learner/item; cohort plus state plus `hold_cycle_id` for the pending pool and sign-off; unique `release_seq`.
- Assessment instances: assessor queue by cohort/state.
- Decisions: result plus created time; unique `supersedes_decision_id`.
- Moderation: cycle/state, sample allocation by moderator/state, scope exclusion.
- Appeals: result, learner/status, reviewer/status; one admitted remark per result.
- Credits: learner/unit/`award_seq` uniqueness; learner/unit/timestamp.
- Audit/API events: event time plus object/actor/credential indexes; cursor pagination by `(created_at, id)`.
- Outbox/queue: state and next-attempt time; unique deduplication key.
- Quiz attempts: unique quiz/learner/attempt number; learner history by quiz.
- Material access events: material plus time and learner plus time for engagement reports.
- Calendar feed tokens: unique token hash; one active token per owner.

Indexes are justified by documented queries and reviewed with `EXPLAIN (ANALYZE, BUFFERS)` on production-like data. Append-heavy tables are candidates for later time partitioning only after measured maintenance or query pain.

## Row-level security strategy

- Learners see their enrolments, published content, own submissions/exams/released results/appeals/credits, own quiz attempts, and only their own notes. A held result is invisible to its learner.
- Facilitators see content and operational submission status only inside assigned scopes; they do not gain assessment authority implicitly.
- Facilitators and coordinators read quiz results and material access events only as scoped engagement reporting; assessors and moderators have no policy granting access to either.
- Assessors see items allocated to them and the historical evidence needed to assess them, never unrelated cohorts.
- Moderators see allocated sample items and the supporting decision chain, with assessment actors excluded.
- Coordinators operate programme/cohort workflows within assignment scope.
- Administrators manage identity, configuration, and credentials, but academic-decision mutation remains restricted to domain functions.
- Department consumers never query base tables; the application queries a purpose-built released-record view.
- The calendar feed is served by a server-only function that resolves a token hash to its owner and returns schedule fields only.
- Worker access is server-only and restricted to outbox/queue/delivery functions granted to `service_role`.

RLS is defence in depth over the `api` schema. Policies use stable helper functions based on `auth.uid()`; the same helpers are called by command functions and by the application's user-facing check, so an authorization rule is written once (ADR-024). A CI check enumerates table and function privileges for `anon` and `authenticated` and fails on any unexpected grant. Tests cover positive and negative combinations. Privileged keys are never present in the browser.

## Retention and deletion

Archiving makes cohort academic data read-only but accessible for authorised reporting and external records. Legal/policy owners must approve retention by record class. Deletion requests cannot remove records that must be retained for accreditation or legal obligations; the documented process distinguishes correction, access restriction, archival, anonymisation, and lawful deletion.

Storage objects are reconciled against `stored_files`. A scheduled job removes uncommitted uploads whose intent expired more than 24 hours ago, which exceeds the lifetime of any signed or resumable upload. Accepted evidence and submission versions are not overwritten. Backup and recovery must restore both metadata and object bodies and verify the server-computed checksums. A point-in-time database restore rewinds Storage metadata, the queue, and the outbox together; the restore runbook reconciles bucket listings against `stored_files` and suppresses pre-recovery-point outbox rows pending review so that released-result mail is not sent twice.

## SRS data mapping

| SRS area | Principal entities |
|---|---|
| FR-101–FR-112 | profiles, role_assignments, sign_in_failures, import_batches, import_rows, configuration_versions, api_credentials, audit_events |
| FR-201–FR-212 | tasks, modules, materials, quizzes, questions, question_keys, sessions, attendance_records, notices |
| FR-301–FR-318 | material_access_events, quiz_attempts, quiz_responses, calendar_feed_tokens, learner_notes, submissions, submission_versions, stored_files, exam_attempts, exam_answers, results, learner_unit_outcomes |
| FR-401–FR-410 | assessable_items, results, assessment_instances, marking_drafts, decisions, assessor_judgements |
| FR-501–FR-511 | cohort_moderation_state, moderation_rules, cycles, cycle scope, populations, samples, sample_items, findings, observations |
| FR-601–FR-613 | appeals, appeal_events, decisions, results |
| FR-701–FR-708 | programmes, cohorts, readiness_items, logistics_items, stakeholder_queries, reports |
| FR-801–FR-804 | unit_assessment_requirements, learner_unit_outcomes, credit_ledger_entries |
| FR-901–FR-905 | exam_integrity_events, attempt integrity-configuration snapshot, assessor_judgements |
| FR-1001–FR-1007 | api_credentials, released-record view keyed by `release_seq`, api_access_events |
