# LMS Data Model

## Modelling principles

- PostgreSQL is authoritative for identity linkage, authorization scope, workflow state, exams, decisions, credits, notifications, and audits.
- File bytes live in private Storage; PostgreSQL stores immutable object keys, checksums, sizes, types, and ownership metadata.
- Historical submissions, decisions, configuration versions, and credit changes are append-only.
- Mutable workflow records carry a version number and explicit state.
- All timestamps are `timestamptz` in UTC. Local deadlines are derived using `Africa/Johannesburg`.
- No institution or tenant discriminator is present.

## Core relationships

```text
auth.users 1--1 profiles
profiles 1--* role_assignments *--1 roles
programmes 1--* qualifications 1--* units
programmes 1--* cohorts 1--* enrolments *--1 profiles
cohorts 1--* tasks 1--* submissions 1--* submission_versions 1--* files
cohorts 1--* exams 1--* exam_attempts 1--* exam_answers
submission_versions/exam_attempts 1--* assessment_instances 1--* decisions
cohorts 1--* moderation_cycles 1--* moderation_sample_items
released results 1--* appeals 1--* decisions
released decisions 1--* credit_ledger_entries
domain events 1--* audit_events
domain events 1--* outbox_messages 1--* notification_deliveries
```

## Entity catalogue

### Identity and authorization

| Entity | Key fields and constraints |
|---|---|
| `profiles` | Auth user ID PK; status; display/learner identifiers; deactivation timestamp |
| `roles` | Stable code: learner, facilitator, assessor, moderator, coordinator, administrator |
| `role_assignments` | User, role, scope type and scope key, effective range, assigned-by; unique active assignment |
| `api_credentials` | Credential ID, secret hash, scopes, status, expiry, previous/next rotation relationship |
| `api_access_events` | Append-only credential, route, filters, returned record IDs, outcome, request ID, timestamp |

Scope types are a constrained enumeration: global, programme, cohort, unit, assessment, or appeal. A check constraint requires the matching scope key and rejects irrelevant keys. Authorization helpers answer a specific capability question rather than exposing raw role rows.

### Programme and learning delivery

`programmes`, `qualifications`, `units`, `cohorts`, `enrolments`, `tasks`, `task_targets`, `rubrics`, `rubric_criteria`, `materials`, `quizzes`, `questions`, `sessions`, `attendance_records`, `logistics_items`, `notices`, and `stakeholder_queries` implement FR-201–FR-318 and FR-701–FR-708.

Material publication has draft, scheduled, published, and archived states. Teams URLs are validated values on sessions or material links; they do not create a Microsoft integration identity. Personal notes use a separate `learner_notes` table with policies permitting only the owning learner. No reporting or external view joins this table.

### Submissions and files

| Entity | Important fields |
|---|---|
| `submissions` | Learner, task, current status, next version number, latest accepted version |
| `submission_versions` | Submission, version number, submitted timestamp, late flag, supersedes version, immutable after acceptance |
| `evidence_requirements` | Unit/task requirement and validation rules |
| `submission_evidence` | Submission version, requirement, file metadata ID |
| `file_upload_intents` | Random object key, intended owner/context, max bytes, allowed types, expiry, consumed timestamp |
| `stored_files` | Bucket, immutable object key, checksum, size, detected media type, scan state, uploader, accepted timestamp |

Unique `(submission_id, version_number)` prevents duplicate versions. Upload finalisation locks the submission, consumes one valid intent, confirms the object path and declared metadata, and inserts a new version. Storage upload permissions allow creation only under an authorised random prefix and never permit overwrite or move.

### Exams

| Entity | Important fields and constraints |
|---|---|
| `exams` | Cohort/unit, open/close times, duration, attempt limit, published version |
| `exam_attempts` | Learner, exam, state, start/expiry/submission timestamps, version, editing lease ID, receipt ID |
| `exam_answers` | Attempt, question, payload, answer version, persisted timestamp; unique per attempt/question |
| `exam_integrity_events` | Attempt, event type, client timestamp, server timestamp, metadata; append-only |

A partial unique index permits only one active attempt per learner and exam. Answer writes require the expected attempt version. A trigger or revoked table privileges prevents updates once the attempt is submitted or expired. The database calculates effective expiry from stored timestamps; no client-supplied remaining time is trusted.

### Assessment and immutable decisions

`assessment_instances` link one submitted artefact to a learner, task/unit, cohort, current workflow state, assigned assessor, and current decision pointer. `marking_drafts` may be updated by the assigned assessor until finalisation. `decisions` is append-only and includes decision type, outcome, actor, justification, created timestamp, and `supersedes_decision_id`.

Database functions reject a moderation actor who matches the original assessor and reject an appeal reviewer who matches the original assessor. Foreign keys preserve the complete decision chain. Applications may change the current pointer only by inserting a valid successor in the same transaction.

### Moderation

| Entity | Purpose |
|---|---|
| `moderation_rules` | Versioned percentage, strata, mandatory-inclusion configuration, effective range |
| `moderation_cycles` | Cohort, rule version, state, opened/signed-off actors and timestamps |
| `moderation_populations` | Immutable eligible assessment IDs and selection-basis snapshot |
| `moderation_samples` | Seed, algorithm version, population digest, generated timestamp |
| `moderation_sample_items` | Sample, assessment, stratum, inclusion reason, allocated moderator, item state |
| `moderation_findings` | Append-only agreement/disagreement/return decisions and reasons |

Sample uniqueness is enforced by `(cycle_id, assessment_instance_id)`. The population digest detects later mutation. Sign-off requires no sample item in returned or pending state. Results reference the active hold/cycle so ordinary assessment code cannot release them independently.

### Appeals and credits

`appeals` store released result, type, grounds, lodged timestamp, deadline snapshot, state, admissibility, and reviewer. A partial unique index prevents duplicate open appeals of the same type for one result. `appeal_events` retain every transition. The concluding outcome is an immutable decision linked to the original.

`credit_ledger_entries` contain learner, unit, source decision, signed credit amount, entry type, reversal-of reference, and timestamp. A unique `(source_decision_id, entry_type)` prevents duplicate allocation. Totals are a view or transactionally maintained projection; they are never the authoritative record.

### Notifications, audit, and jobs

| Entity | Purpose |
|---|---|
| `notifications` | Learner-visible in-app item and independent read timestamp |
| `outbox_messages` | Committed domain event, message type/version, payload reference, deduplication key, state |
| `notification_deliveries` | Channel, provider reference, attempts, accepted/delivered/failed timestamps |
| `scheduled_runs` | Job name, scheduled instant, unique deduplication key, status |
| `audit_events` | Append-only actor, action, object, before/after references or safe diff, request ID, timestamp |
| `configuration_versions` | Versioned value, previous version, effective time, actor |

Outbox uniqueness is defined by the logical event, recipient, channel, and template version. Workers acknowledge a queue message only after the database delivery state commits.

## State models

| Aggregate | Valid sequence | Invalid examples |
|---|---|---|
| Submission | draft -> upload_pending -> submitted -> under_assessment -> returned -> resubmitted -> concluded | Editing an accepted version; skipping version allocation |
| Exam attempt | not_started -> active -> submitted or expired | Saving after terminal state; trusting client expiry |
| Assessment | queued -> marking -> finalised -> held or released -> superseded | Updating a final decision; releasing while held |
| Moderation cycle | planned -> population_frozen -> sampled -> in_review -> corrections_pending -> signed_off | Resampling an active frozen population; sign-off with returns open |
| Appeal | lodged -> admissibility_review -> admitted or inadmissible -> allocated -> under_review -> concluded | Reviewer is original assessor; appeal after deadline; appealing conclusion |
| Notification | pending -> queued -> accepted -> delivered or failed | Re-enqueueing with a different payload under the same deduplication key |
| Cohort | active -> completion_review -> archivable -> archived | Archive while moderation, appeal window, or appeal remains open |

Every transition checks actor capability, expected state/version, prerequisites, and idempotency in one transaction. It emits an audit event; user-visible transitions also create notification/outbox rows.

## Index strategy

- Role assignments: active assignments by user/role/scope and reverse lookups by scope.
- Enrolments: unique active learner/cohort; indexes for learner and cohort rosters.
- Tasks/materials/sessions: cohort or audience plus publication state/date.
- Submissions: task/learner, assessor queue by cohort/status, and late/outstanding dashboards.
- Exam attempts: learner/exam uniqueness, state/expiry for finalisation, receipt ID.
- Decisions: assessment plus created time, supersession chain, released result lookups.
- Moderation: cycle/state, sample allocation by moderator/state.
- Appeals: released result, learner/status, deadline, reviewer/status.
- Credits: learner/unit/timestamp and source-decision uniqueness.
- Audit/API events: event time plus object/actor/credential indexes; cursor pagination by `(created_at, id)`.
- Outbox/queue: state and next-attempt time; unique deduplication key.

Indexes are justified by documented queries and reviewed with `EXPLAIN (ANALYZE, BUFFERS)` on production-like data. Append-heavy tables are candidates for later time partitioning only after measured maintenance or query pain.

## Row-level security strategy

- Learners see their enrolments, published content, own submissions/exams/results/appeals/credits, and only their own notes.
- Facilitators see content and operational submission status only inside assigned scopes; they do not gain assessment authority implicitly.
- Assessors see assigned items and historical evidence needed to assess them, never unrelated cohorts.
- Moderators see allocated sample items and the supporting assessment chain, with assessor equality excluded.
- Coordinators operate programme/cohort workflows within assignment scope.
- Administrators manage identity, configuration, and credentials but academic-decision mutation remains restricted to domain functions.
- Department consumers never query base tables; the application queries a purpose-built released-record view.
- Worker access is server-only and restricted to outbox/queue/delivery functions.

Policies use stable helper functions based on the authenticated user ID and scoped assignments. Tests cover positive and negative combinations. Privileged keys are never present in the browser.

## Retention and deletion

Archiving makes cohort academic data read-only but accessible for authorised reporting and external records. Legal/policy owners must approve retention by record class. Deletion requests cannot remove records that must be retained for accreditation or legal obligations; the documented process distinguishes correction, access restriction, archival, anonymisation, and lawful deletion.

Storage objects are reconciled against `stored_files`. A lifecycle job may remove expired uncommitted uploads. Accepted evidence and submission versions are not overwritten. Backup and recovery must restore both metadata and object bodies and verify checksums.

## SRS data mapping

| SRS area | Principal entities |
|---|---|
| FR-101–FR-112 | profiles, role_assignments, configuration_versions, api_credentials, audit_events |
| FR-201–FR-212 | tasks, materials, quizzes, sessions, attendance_records, notices |
| FR-301–FR-318 | learner_notes, submissions, submission_versions, stored_files, exam_attempts, results |
| FR-401–FR-410 | assessment_instances, marking_drafts, decisions |
| FR-501–FR-511 | moderation_rules, cycles, populations, samples, sample_items, findings |
| FR-601–FR-613 | appeals, appeal_events, decisions |
| FR-701–FR-708 | programmes, cohorts, readiness items, logistics, reports |
| FR-801–FR-804 | credit_ledger_entries and credit projection |
| FR-901–FR-905 | exam_integrity_events and assessor judgement |
| FR-1001–FR-1007 | api_credentials, released-record view, api_access_events |

