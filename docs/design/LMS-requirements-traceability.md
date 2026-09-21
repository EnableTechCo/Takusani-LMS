# LMS Requirements Traceability

## Purpose

This document maps every identified business rule, functional requirement, non-functional requirement, and supplied use case to design elements and validation. Detailed requirement wording remains in the SRS; this matrix does not replace it.

## Source priority

1. Confirmed architecture constraints.
2. LMS SRS version 1.0.
3. Supplied use-case catalogue.
4. Labelled architecture assumptions.

## Requirements conflict register

| ID | Conflict or gap | Authoritative resolution | Architectural effect |
|---|---|---|---|
| CR-01 | SRS user class says around 100 learners; architecture brief sets 1,000 registered learners | Use 1,000 | Capacity, storage, imports, and release burst use 1,000 |
| CR-02 | UC-L03, UC-A02, and UC-S02 include plagiarism checking; SRS section 8 defers it | Deferred | No provider or workflow dependency; only a neutral future extension point |
| CR-03 | UC-F04 says the system records attendance after a Teams lecture; SRS interface says no Teams attendance read | SRS requires manual FR-209 capture | Teams is a validated link only; attendance changes are manually captured and audited |
| CR-04 | Catalogue Q6 questions logistics scope; SRS FR-705–FR-707 requires it | Include logistics | Coordinator module stores logistics and headcount reconciliation |
| CR-05 | SRS traces to UC-SA01–UC-SA06, UC-A06, UC-M05–UC-M06, UC-C07, UC-L10–UC-L13, and UC-F08, which are absent from the supplied catalogue | Requirements remain authoritative; record missing catalogue definitions | Test cases derive from the FR wording and business rules; catalogue should be reconciled before baseline approval |
| CR-06 | Catalogue calls the external actor Higher Education Body; SRS calls it Department of Education | Use Department-facing terminology | Versioned Department API and data-sharing agreement |
| CR-07 | Catalogue says sampling may trigger on each decision or schedule; architecture needs a stable population | Scoped cycles, planned manually or scheduled; each freezes its own population once (refined by CR-09) | The deterministic sample over a frozen population is immutable; later decisions wait for the next cycle |
| CR-08 | Seven-day appeal period does not say business or calendar days | Assume calendar days pending policy | UTC storage and Africa/Johannesburg deadline display; policy decision remains open |
| CR-09 | BR-04 releases on decision unless the cohort is under moderation, and FR-506 holds at sample generation; decisions made before a cycle exists, between cycles, or after a freeze would be released unsampled or stranded | "Under moderation" is a required cohort attribute, not the existence of a cycle | ADR-019: moderated cohorts always hold; a cycle claims pending results in its scope at freeze; sign-off releases exactly that population; scheduled cycles sample automatically to satisfy FR-501 |
| CR-10 | FR-801 awards credit per unit but decisions are per assessable item; the SRS does not say how several items roll up to a unit outcome, or whether one item may serve several units | Award when every item required for the unit has a released Competent decision, pending policy; many-to-many allowed | ADR-022: versioned requirement set frozen per cohort; locked `learner_unit_outcomes`; ledger unique on award sequence; same derivation feeds FR-1003 |
| CR-11 | FR-314 restores the timer "at its recorded state", which could mean paused during disconnection; AS-07 says sustained loss is not handled | Timer keeps running from server `expires_at` | ADR-023: no pause; short acceptance grace after expiry; coordinator may void and regrant after a sustained outage |
| CR-12 | FR-106 assumes lockout after failed sign-ins; Supabase Auth provides rate limiting, not per-account lockout, and its password hook is Team/Enterprise only; a lock that blocks sessions would let a third party end an exam | Lock new sign-ins only; self-expiring; administrator unlock retained | ADR-026; server-mediated counting with CAPTCHA on Pro; residual risk recorded |
| CR-13 | FR-208 allows recording upload while NFR-01 states no media is streamed from the LMS | Prefer links; permit bounded uploads served as downloads from Storage | Capacity note for recordings; upload limit is configuration under FR-108 |
| CR-14 | FR-405 sets an absolute resubmission deadline at decision time, but under BR-04 the learner cannot see an NYC outcome until sign-off, which may be after that deadline | Remediation is a period resolved from release, as BR-05 treats the appeal window | `results` remediation period and derived deadline |
| CR-15 | FR-613 forbids appealing an appeal outcome, but a second remark lodged after the first concludes and inside the seven days has the same effect | One remark appeal per result, ever; a view-script request does not extend the window | Full unique index; appeal decisions not appealable by construction |
| CR-16 | BR-01, BR-02, and FR-608 refer to "the original assessor", but after a re-mark or resubmission several people have assessed the work | Exclude every actor of an assessment-type decision on the result | Computed from `decisions`, never from a mutable pointer |
| CR-17 | The SRS does not say when an attempt started near the window close expires | The earlier of start plus duration and window close, stated at start | ADR-023 |
| CR-18 | The SRS gives no administrative route to correct a wrongly released outcome; in an unmoderated cohort release is immediate | `correction` decision under dual control, original retained (BR-03) | Correction route; compensating ledger entries |
| CR-19 | FR-511 says sign-off releases "every result in the cohort", which would release decisions that were never eligible for the sample | Sign-off releases exactly the frozen population; later decisions wait for the next cycle | ADR-019; archival requires no pending or held result |

## Business rules

| Rule | Design enforcement | Data/API | Tests |
|---|---|---|---|
| BR-01 separation of duties | Allocation and reallocation commands exclude every assessment actor on the result; re-checked in the finding and sign-off transactions | decisions, assessment_instances, moderation_sample_items | MOD-IND-01/02 |
| BR-02 independent appeal review | Every assessment actor on the result excluded at allocation and re-checked on conclusion; one remark per result | appeals, decisions, results | APPEAL-IND-01/02 |
| BR-03 decision immutability | Insert-only decisions with supersedes link; update/delete revoked | decisions, credit_ledger_entries | IMM-01–04 |
| BR-04 release gating | Required cohort moderation policy; moderated results always held; three release paths only: finalisation in an unmoderated cohort, sign-off of a frozen population, and appeal or correction of an already released result | cohort_moderation_state, moderation_cycles, results | MOD-REL-01–06 |
| BR-05 appeal window | Exclusive deadline instant snapshotted on the result at release; lodging compares after locking the result | results, appeals | APPEAL-TIME-01–04 |

## Functional requirements

The matrix below is an ownership map: it shows which component, data family, and interface family carries each requirement, and its rows are deliberately uniform within a group. It is not evidence that a requirement is met. Evidence is in "Requirement-specific coverage" below and in the numbered tests of the risk and test plan. The identifiers in the Validation column are test-case names reserved for the implementation test suite, one per requirement; they are not yet written.

| Requirement | Component | Principal data | Interface | Security/consistency control | Validation |
|---|---|---|---|---|---|
| FR-101 | Identity and administration | profiles, role_assignments, configuration_versions, api_credentials, audit_events | Auth/admin commands; /api/v1 credential administration | Scoped authorization, RLS, immutable audit | IAM/RLS-101 |
| FR-102 | Identity and administration | profiles, role_assignments, configuration_versions, api_credentials, audit_events | Auth/admin commands; /api/v1 credential administration | Scoped authorization, RLS, immutable audit | IAM/RLS-102 |
| FR-103 | Identity and administration | profiles, role_assignments, configuration_versions, api_credentials, audit_events | Auth/admin commands; /api/v1 credential administration | Scoped authorization, RLS, immutable audit | IAM/RLS-103 |
| FR-104 | Identity and administration | profiles, role_assignments, configuration_versions, api_credentials, audit_events | Auth/admin commands; /api/v1 credential administration | Scoped authorization, RLS, immutable audit | IAM/RLS-104 |
| FR-105 | Identity and administration | profiles, role_assignments, configuration_versions, api_credentials, audit_events | Auth/admin commands; /api/v1 credential administration | Scoped authorization, RLS, immutable audit | IAM/RLS-105 |
| FR-106 | Identity and administration | profiles, role_assignments, configuration_versions, api_credentials, audit_events | Auth/admin commands; /api/v1 credential administration | Scoped authorization, RLS, immutable audit | IAM/RLS-106 |
| FR-107 | Identity and administration | profiles, role_assignments, configuration_versions, api_credentials, audit_events | Auth/admin commands; /api/v1 credential administration | Scoped authorization, RLS, immutable audit | IAM/RLS-107 |
| FR-108 | Identity and administration | profiles, role_assignments, configuration_versions, api_credentials, audit_events | Auth/admin commands; /api/v1 credential administration | Scoped authorization, RLS, immutable audit | IAM/RLS-108 |
| FR-109 | Identity and administration | profiles, role_assignments, configuration_versions, api_credentials, audit_events | Auth/admin commands; /api/v1 credential administration | Scoped authorization, RLS, immutable audit | IAM/RLS-109 |
| FR-110 | Identity and administration | profiles, role_assignments, configuration_versions, api_credentials, audit_events | Auth/admin commands; /api/v1 credential administration | Scoped authorization, RLS, immutable audit | IAM/RLS-110 |
| FR-111 | Identity and administration | profiles, role_assignments, configuration_versions, api_credentials, audit_events | Auth/admin commands; /api/v1 credential administration | Scoped authorization, RLS, immutable audit | IAM/RLS-111 |
| FR-112 | Identity and administration | profiles, role_assignments, configuration_versions, api_credentials, audit_events | Auth/admin commands; /api/v1 credential administration | Scoped authorization, RLS, immutable audit | IAM/RLS-112 |
| FR-201 | Learning delivery | tasks, materials, quizzes, sessions, attendance_records, notices | Task/material/session Server Actions and upload routes | Audience scope, publication states, delivery log | LEARN-201 |
| FR-202 | Learning delivery | tasks, materials, quizzes, sessions, attendance_records, notices | Task/material/session Server Actions and upload routes | Audience scope, publication states, delivery log | LEARN-202 |
| FR-203 | Learning delivery | tasks, materials, quizzes, sessions, attendance_records, notices | Task/material/session Server Actions and upload routes | Audience scope, publication states, delivery log | LEARN-203 |
| FR-204 | Learning delivery | tasks, materials, quizzes, sessions, attendance_records, notices | Task/material/session Server Actions and upload routes | Audience scope, publication states, delivery log | LEARN-204 |
| FR-205 | Learning delivery | tasks, materials, quizzes, sessions, attendance_records, notices | Task/material/session Server Actions and upload routes | Audience scope, publication states, delivery log | LEARN-205 |
| FR-206 | Learning delivery | tasks, materials, quizzes, sessions, attendance_records, notices | Task/material/session Server Actions and upload routes | Audience scope, publication states, delivery log | LEARN-206 |
| FR-207 | Learning delivery | tasks, materials, quizzes, sessions, attendance_records, notices | Task/material/session Server Actions and upload routes | Audience scope, publication states, delivery log | LEARN-207 |
| FR-208 | Learning delivery | tasks, materials, quizzes, sessions, attendance_records, notices | Task/material/session Server Actions and upload routes | Audience scope, publication states, delivery log | LEARN-208 |
| FR-209 | Learning delivery | tasks, materials, quizzes, sessions, attendance_records, notices | Task/material/session Server Actions and upload routes | Audience scope, publication states, delivery log | LEARN-209 |
| FR-210 | Learning delivery | tasks, materials, quizzes, sessions, attendance_records, notices | Task/material/session Server Actions and upload routes | Audience scope, publication states, delivery log | LEARN-210 |
| FR-211 | Learning delivery | tasks, materials, quizzes, sessions, attendance_records, notices | Task/material/session Server Actions and upload routes | Audience scope, publication states, delivery log | LEARN-211 |
| FR-212 | Learning delivery | tasks, materials, quizzes, sessions, attendance_records, notices | Task/material/session Server Actions and upload routes | Audience scope, publication states, delivery log | LEARN-212 |
| FR-301 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-301 |
| FR-302 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-302 |
| FR-303 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-303 |
| FR-304 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-304 |
| FR-305 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-305 |
| FR-306 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-306 |
| FR-307 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-307 |
| FR-308 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-308 |
| FR-309 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-309 |
| FR-310 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-310 |
| FR-311 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-311 |
| FR-312 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-312 |
| FR-313 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-313 |
| FR-314 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-314 |
| FR-315 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-315 |
| FR-316 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-316 |
| FR-317 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-317 |
| FR-318 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-318 |
| FR-401 | Assessment | assessment_instances, marking_drafts, decisions | Assessment queue and decision command | Assignment scope, append-only decisions, audit | ASSESS-401 |
| FR-402 | Assessment | assessment_instances, marking_drafts, decisions | Assessment queue and decision command | Assignment scope, append-only decisions, audit | ASSESS-402 |
| FR-403 | Assessment | assessment_instances, marking_drafts, decisions | Assessment queue and decision command | Assignment scope, append-only decisions, audit | ASSESS-403 |
| FR-404 | Assessment | assessment_instances, marking_drafts, decisions | Assessment queue and decision command | Assignment scope, append-only decisions, audit | ASSESS-404 |
| FR-405 | Assessment | assessment_instances, marking_drafts, decisions | Assessment queue and decision command | Assignment scope, append-only decisions, audit | ASSESS-405 |
| FR-406 | Assessment | assessment_instances, marking_drafts, decisions | Assessment queue and decision command | Assignment scope, append-only decisions, audit | ASSESS-406 |
| FR-407 | Assessment | assessment_instances, marking_drafts, decisions | Assessment queue and decision command | Assignment scope, append-only decisions, audit | ASSESS-407 |
| FR-408 | Assessment | assessment_instances, marking_drafts, decisions | Assessment queue and decision command | Assignment scope, append-only decisions, audit | ASSESS-408 |
| FR-409 | Assessment | assessment_instances, marking_drafts, decisions | Assessment queue and decision command | Assignment scope, append-only decisions, audit | ASSESS-409 |
| FR-410 | Assessment | assessment_instances, marking_drafts, decisions | Assessment queue and decision command | Assignment scope, append-only decisions, audit | ASSESS-410 |
| FR-501 | Moderation | moderation_rules, cycles, populations, samples, findings | Sample, finding, return, sign-off commands | Deterministic sampling, independence, release hold | MOD-501 |
| FR-502 | Moderation | moderation_rules, cycles, populations, samples, findings | Sample, finding, return, sign-off commands | Deterministic sampling, independence, release hold | MOD-502 |
| FR-503 | Moderation | moderation_rules, cycles, populations, samples, findings | Sample, finding, return, sign-off commands | Deterministic sampling, independence, release hold | MOD-503 |
| FR-504 | Moderation | moderation_rules, cycles, populations, samples, findings | Sample, finding, return, sign-off commands | Deterministic sampling, independence, release hold | MOD-504 |
| FR-505 | Moderation | moderation_rules, cycles, populations, samples, findings | Sample, finding, return, sign-off commands | Deterministic sampling, independence, release hold | MOD-505 |
| FR-506 | Moderation | moderation_rules, cycles, populations, samples, findings | Sample, finding, return, sign-off commands | Deterministic sampling, independence, release hold | MOD-506 |
| FR-507 | Moderation | moderation_rules, cycles, populations, samples, findings | Sample, finding, return, sign-off commands | Deterministic sampling, independence, release hold | MOD-507 |
| FR-508 | Moderation | moderation_rules, cycles, populations, samples, findings | Sample, finding, return, sign-off commands | Deterministic sampling, independence, release hold | MOD-508 |
| FR-509 | Moderation | moderation_rules, cycles, populations, samples, findings | Sample, finding, return, sign-off commands | Deterministic sampling, independence, release hold | MOD-509 |
| FR-510 | Moderation | moderation_rules, cycles, populations, samples, findings | Sample, finding, return, sign-off commands | Deterministic sampling, independence, release hold | MOD-510 |
| FR-511 | Moderation | moderation_rules, cycles, populations, samples, findings | Sample, finding, return, sign-off commands | Deterministic sampling, independence, release hold | MOD-511 |
| FR-601 | Appeals | appeals, appeal_events, decisions | Appeal lodge/admit/allocate/conclude routes | Release-based deadline, reviewer independence, immutable outcome | APPEAL-601 |
| FR-602 | Appeals | appeals, appeal_events, decisions | Appeal lodge/admit/allocate/conclude routes | Release-based deadline, reviewer independence, immutable outcome | APPEAL-602 |
| FR-603 | Appeals | appeals, appeal_events, decisions | Appeal lodge/admit/allocate/conclude routes | Release-based deadline, reviewer independence, immutable outcome | APPEAL-603 |
| FR-604 | Appeals | appeals, appeal_events, decisions | Appeal lodge/admit/allocate/conclude routes | Release-based deadline, reviewer independence, immutable outcome | APPEAL-604 |
| FR-605 | Appeals | appeals, appeal_events, decisions | Appeal lodge/admit/allocate/conclude routes | Release-based deadline, reviewer independence, immutable outcome | APPEAL-605 |
| FR-606 | Appeals | appeals, appeal_events, decisions | Appeal lodge/admit/allocate/conclude routes | Release-based deadline, reviewer independence, immutable outcome | APPEAL-606 |
| FR-607 | Appeals | appeals, appeal_events, decisions | Appeal lodge/admit/allocate/conclude routes | Release-based deadline, reviewer independence, immutable outcome | APPEAL-607 |
| FR-608 | Appeals | appeals, appeal_events, decisions | Appeal lodge/admit/allocate/conclude routes | Release-based deadline, reviewer independence, immutable outcome | APPEAL-608 |
| FR-609 | Appeals | appeals, appeal_events, decisions | Appeal lodge/admit/allocate/conclude routes | Release-based deadline, reviewer independence, immutable outcome | APPEAL-609 |
| FR-610 | Appeals | appeals, appeal_events, decisions | Appeal lodge/admit/allocate/conclude routes | Release-based deadline, reviewer independence, immutable outcome | APPEAL-610 |
| FR-611 | Appeals | appeals, appeal_events, decisions | Appeal lodge/admit/allocate/conclude routes | Release-based deadline, reviewer independence, immutable outcome | APPEAL-611 |
| FR-612 | Appeals | appeals, appeal_events, decisions | Appeal lodge/admit/allocate/conclude routes | Release-based deadline, reviewer independence, immutable outcome | APPEAL-612 |
| FR-613 | Appeals | appeals, appeal_events, decisions | Appeal lodge/admit/allocate/conclude routes | Release-based deadline, reviewer independence, immutable outcome | APPEAL-613 |
| FR-701 | Programme coordination | programmes, cohorts, readiness, logistics, reports | Programme/readiness/notice/report commands | Scoped coordinator access, bounded exports | COORD-701 |
| FR-702 | Programme coordination | programmes, cohorts, readiness, logistics, reports | Programme/readiness/notice/report commands | Scoped coordinator access, bounded exports | COORD-702 |
| FR-703 | Programme coordination | programmes, cohorts, readiness, logistics, reports | Programme/readiness/notice/report commands | Scoped coordinator access, bounded exports | COORD-703 |
| FR-704 | Programme coordination | programmes, cohorts, readiness, logistics, reports | Programme/readiness/notice/report commands | Scoped coordinator access, bounded exports | COORD-704 |
| FR-705 | Programme coordination | programmes, cohorts, readiness, logistics, reports | Programme/readiness/notice/report commands | Scoped coordinator access, bounded exports | COORD-705 |
| FR-706 | Programme coordination | programmes, cohorts, readiness, logistics, reports | Programme/readiness/notice/report commands | Scoped coordinator access, bounded exports | COORD-706 |
| FR-707 | Programme coordination | programmes, cohorts, readiness, logistics, reports | Programme/readiness/notice/report commands | Scoped coordinator access, bounded exports | COORD-707 |
| FR-708 | Programme coordination | programmes, cohorts, readiness, logistics, reports | Programme/readiness/notice/report commands | Scoped coordinator access, bounded exports | COORD-708 |
| FR-801 | Credits | credit_ledger_entries, credit projection | Transactional release/appeal functions | Append-only ledger, unique source decision | CREDIT-801 |
| FR-802 | Credits | credit_ledger_entries, credit projection | Transactional release/appeal functions | Append-only ledger, unique source decision | CREDIT-802 |
| FR-803 | Credits | credit_ledger_entries, credit projection | Transactional release/appeal functions | Append-only ledger, unique source decision | CREDIT-803 |
| FR-804 | Credits | credit_ledger_entries, credit projection | Transactional release/appeal functions | Append-only ledger, unique source decision | CREDIT-804 |
| FR-901 | Exam integrity | exam_integrity_events, assessor_judgements | Integrity batch and assessment view | Advisory-only flags, payload/rate limits | INTEGRITY-901 |
| FR-902 | Exam integrity | exam_integrity_events, assessor_judgements | Integrity batch and assessment view | Advisory-only flags, payload/rate limits | INTEGRITY-902 |
| FR-903 | Exam integrity | exam_integrity_events, assessor_judgements | Integrity batch and assessment view | Advisory-only flags, payload/rate limits | INTEGRITY-903 |
| FR-904 | Exam integrity | exam_integrity_events, assessor_judgements | Integrity batch and assessment view | Advisory-only flags, payload/rate limits | INTEGRITY-904 |
| FR-905 | Exam integrity | exam_integrity_events, assessor_judgements | Integrity batch and assessment view | Advisory-only flags, payload/rate limits | INTEGRITY-905 |
| FR-1001 | Department integration | released_record_view, api_credentials, api_access_events | GET /api/v1/learners/{id}/records | Scopes, minimisation, throttling, append-only access log | DEPT-1001 |
| FR-1002 | Department integration | released_record_view, api_credentials, api_access_events | GET /api/v1/learners/{id}/records | Scopes, minimisation, throttling, append-only access log | DEPT-1002 |
| FR-1003 | Department integration | released_record_view, api_credentials, api_access_events | GET /api/v1/learners/{id}/records | Scopes, minimisation, throttling, append-only access log | DEPT-1003 |
| FR-1004 | Department integration | released_record_view, api_credentials, api_access_events | GET /api/v1/learners/{id}/records | Scopes, minimisation, throttling, append-only access log | DEPT-1004 |
| FR-1005 | Department integration | released_record_view, api_credentials, api_access_events | GET /api/v1/learners/{id}/records | Scopes, minimisation, throttling, append-only access log | DEPT-1005 |
| FR-1006 | Department integration | released_record_view, api_credentials, api_access_events | GET /api/v1/learners/{id}/records | Scopes, minimisation, throttling, append-only access log | DEPT-1006 |
| FR-1007 | Department integration | released_record_view, api_credentials, api_access_events | GET /api/v1/learners/{id}/records | Scopes, minimisation, throttling, append-only access log | DEPT-1007 |

### Requirement-specific coverage

The matrix above traces each requirement to its owning component. The requirements below need a design element of their own that the component-level row does not make visible. They were identified by reading each SRS requirement against the design text rather than against the matrix.

| Requirement | What it specifically needs | Design element | Validation |
|---|---|---|---|
| FR-103 | Bulk intake import with replay safety | `import_batches`, `import_rows`; capacity scenario 5 | Bulk import load test; idempotency replay test |
| FR-104 | Reject a conflicting allocation and name the conflict | Allocation commands; `422 separation_of_duties_conflict` with `conflicts[]`; allocation lives only on the work item | Transaction test 16 |
| FR-105 | Reject a role change that breaches BR-01/BR-02 on active work | Role change and deactivation refused while open allocations exist; reallocation commands | Transaction tests 9 and 21 |
| FR-106 | Lock on failed sign-ins; administrator unlock and reset; notify | `sign_in_failures`; sign-in-only, self-expiring lock (ADR-026); unlock route | Transaction test 20 |
| FR-204 | Tag material to a module | `modules` | LEARN-204 |
| FR-205, FR-302 | Quiz attempts, scoring, feedback, attempt limit | `quiz_attempts`, `quiz_responses`; unique attempt number with limit check | LEARN-205; concurrent attempt-limit test |
| FR-208 | Recording by upload or link | Recordings bucket with configured size limit; link validation; CR-13 | LEARN-208 |
| FR-301 | Log every material access for engagement reporting | `material_access_events`, coalesced and off the render path | LEARNER-301; logging-failure does not block access |
| FR-303 | Quiz results excluded from the competency decision | No foreign key from quiz records to assessments, decisions, or credits; absent from released-record view | Schema-contract test |
| FR-304 | External calendar subscription | Token-authenticated iCalendar feed (ADR-020) | CAL-304 token rotation, revocation, minimisation snapshot |
| FR-313 | Automatic submission on expiry | Expiry path issues receipt and opens the assessment instance (`auto_expired`); acts on `accept_until` | Transaction tests 3 and 15; exam recovery tests |
| FR-314, NFR-07 | Autosave and restore without loss | Batched sequenced autosave, fenced lease, acceptance grace (ADR-023) | Exam recovery tests |
| FR-406 | Record whether an integrity flag is material | `assessor_judgements` | INTEGRITY-406 |
| FR-501 | Automatic sample selection | Supabase Cron invokes freeze-and-sample at the cycle's start time; CR-09 | Transaction test 14 |
| FR-503 | Include first-time assessors | Derivation at population freeze, stored in the selection-basis snapshot | MOD-REP reproduction after assessor gains history |
| FR-506, FR-408, FR-511 | Hold applies to every decision in a moderated cohort; sign-off releases the sampled population | Cohort moderation policy, pending pool, scoped cycles (ADR-019); CR-19 | Transaction tests 13, 22, 23 |
| FR-508 | Cohort-level observations to the coordinator | `moderation_observations` | MOD-508 |
| FR-608 | Reviewer selection with AS-02 fallback order | Tiered eligibility query; out-of-cohort reviewer allocated to the one appeal | APPEAL-IND fallback tiers |
| FR-609 | Reviewer sees moderation findings | Published Moderation view read by Appeals | APPEAL-609 |
| FR-613 | No appeal of an appeal | One remark per result; appeal decisions not appealable (CR-15) | Transaction test 24 |
| FR-702 | Assignable readiness items | `readiness_items`, including "moderation cycle planned" | COORD-702 |
| FR-801–FR-804, FR-1003 | Credit and competency by unit | Frozen requirement set; locked `learner_unit_outcomes`; award-sequence uniqueness; reconciliation (ADR-022) | Transaction tests 17 and 25 |
| FR-316, FR-601, FR-603 | Appeal closing date | Exclusive instant on `results`; learner shown the last full day | Transaction test 8 |
| FR-405, FR-317 | Remediation deadline | Period resolved from release (CR-14) | Transaction test 26 |
| FR-904 | Grace period on return | Integrity configuration snapshot on the attempt; distinct event type after grace | INTEGRITY-904 |
| FR-905 | Flag when events exceed threshold | `flagged_for_review` derived from snapshotted threshold; advisory only | INTEGRITY-905; outcome-unchanged test |
| FR-1001 | Documented API | OpenAPI description published with the policy | API contract tests |
| FR-1003, FR-1006 | No released record missed by the consumer | `release_seq` change feed; separately paginated collections | API contract test on held-then-released |
| FR-1002, FR-1005 | Credential check and throttle | HMAC verification; separate failed-authentication limits | API contract tests |
| SRS section 8 | Plagiarism integration point on the submission record | `submission_checks`, empty at launch | Schema review |

## Non-functional requirements

| NFR | Architecture response | Validation |
|---|---|---|
| NFR-01 | 1,000 registered learners; 100 concurrent exam baseline; 250 sensitivity; direct file transfer | LOAD-01–06 |
| NFR-02 | Append-only decisions, configuration, audit, and external-access events | IMM-01–04, AUDIT-01–03 |
| NFR-03 | Scoped roles and transaction-time separation checks | RLS matrix, MOD-IND, APPEAL-IND |
| NFR-04 | Classification, minimised released-record view, lawful-sharing gate, retention decisions | SEC-POPIA-01–08 |
| NFR-05 | Immutable submission versions and decision chains | IMM-01–04 |
| NFR-06 | Frozen population, rule version, seed, algorithm version, population digest | MOD-REP-01–03 |
| NFR-07 | IndexedDB local capture, ten-second versioned autosave, reconnect reconciliation, server timer | EXAM-REC-01–10 |
| NFR-08 | /api/v1, additive evolution, prior-version notice window, Sunset/Deprecation headers | API-VER-01–04 |
| NFR-09 | Effective-dated configuration versions with prior link and actor | CFG-01–03 |
| NFR-10 | Responsive browser UI; exam capability/device gate | UI-01–04 |
| NFR-11 | In-app notification, outbox, provider acceptance evidence, learner history | NOTIFY-01–07 |

## Use-case coverage

### Supplied catalogue

| Actor group | Use cases | Covered design areas |
|---|---|---|
| Learner | UC-L01–UC-L09 | Exams, files, submissions, material, quizzes, Teams links, notes, calendar, released results |
| Facilitator | UC-F01–UC-F07 | Tasks, material, quizzes, sessions, attendance/submission dashboards, reminders |
| Assessor | UC-A01–UC-A05 | Scoped queues, marking, immutable decisions, moderation correction loop |
| Moderator | UC-M01–UC-M04 | Allocation, review, findings, return for remarking |
| Coordinator | UC-C01–UC-C06 | Cohorts/roles, readiness, notices, stakeholder queries, logistics, reports |
| External/System | UC-E01, UC-S01–UC-S03 | Department API, moderation sampling, deferred plagiarism conflict, advisory exam events |

### SRS-only referenced use cases

UC-SA01–UC-SA06, UC-F08, UC-A06, UC-M05–UC-M06, UC-C07, UC-L10–UC-L13, and the SRS meaning of UC-S02/UC-S03 are covered through their authoritative FRs. They remain catalogue-maintenance gaps, not architecture omissions.

## Reverse traceability by component

| Component | Requirement ranges |
|---|---|
| Identity and administration | BR-01, BR-02, FR-101–FR-112, NFR-03, NFR-09 |
| Programmes/cohorts and learning | FR-201–FR-212, FR-301–FR-307, FR-701–FR-708, NFR-10 |
| Submissions and Storage | FR-308–FR-311, NFR-05 |
| Exams and integrity | FR-312–FR-315, FR-901–FR-905, NFR-01, NFR-07 |
| Assessment | BR-03, BR-04, FR-401–FR-410 |
| Moderation | BR-01, BR-04, FR-501–FR-511, NFR-06 |
| Appeals | BR-02, BR-03, BR-05, FR-601–FR-613 |
| Credits | FR-318, FR-801–FR-804 |
| Notifications | FR-203, FR-207, FR-212, FR-509, FR-511, FR-604–FR-611, FR-703, NFR-11 |
| Department integration | FR-1001–FR-1007, NFR-02, NFR-04, NFR-08 |
| Audit/operations | FR-107, FR-109–FR-112, NFR-02, NFR-09 |

## Coverage statement

The matrix contains all five business rules, every functional requirement from FR-101 through FR-1007 (100 rows), and NFR-01 through NFR-11. No supplied use case is omitted. Requirements whose source use-case definitions are missing are explicitly identified in CR-05.

A requirement-by-requirement review against SRS version 1.0 found that component-level tracing had hidden requirements with no specific design element. Those are now listed under "Requirement-specific coverage". The independent architecture review of 18 September 2026 then found defects in how several of them, and parts of the original design, were met; the corrections are recorded in ADR-019 to ADR-027 and indexed in the [fixes and decisions register](LMS-design-fixes-and-decisions.md). CR-09 through CR-19 record the SRS ambiguities the two reviews exposed. SRS assumptions AS-01 through AS-07 are inputs rather than requirements: AS-02, AS-03, and AS-04 shape the appeal and credit design, and AS-06 is a go-live gate.

