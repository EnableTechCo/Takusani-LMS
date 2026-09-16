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
| CR-07 | Catalogue says sampling may trigger on each decision or schedule; architecture needs a stable population | Recommend an explicit opened/scheduled cycle after eligible decisions exist | Population freezes once, then the deterministic sample is immutable |
| CR-08 | Seven-day appeal period does not say business or calendar days | Assume calendar days pending policy | UTC storage and Africa/Johannesburg deadline display; policy decision remains open |

## Business rules

| Rule | Design enforcement | Data/API | Tests |
|---|---|---|---|
| BR-01 separation of duties | Allocation query plus transaction-time database check | role_assignments, assessment_instances, moderation_sample_items | MOD-IND-01/02 |
| BR-02 independent appeal review | Original assessor excluded and rechecked on conclusion | appeals, assessment_instances, decision function | APPEAL-IND-01/02 |
| BR-03 decision immutability | Insert-only decisions with supersedes link; update/delete revoked | decisions, credit_ledger_entries | IMM-01–04 |
| BR-04 release gating | Moderation hold referenced by result; only sign-off function releases | moderation_cycles, released_results | MOD-REL-01–04 |
| BR-05 appeal window | Deadline calculated from committed released_at | appeals and lodge command | APPEAL-TIME-01–04 |

## Functional requirements

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
| FR-301 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-301 |
| FR-302 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-302 |
| FR-303 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-303 |
| FR-304 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-304 |
| FR-305 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-305 |
| FR-306 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-306 |
| FR-307 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-307 |
| FR-308 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-308 |
| FR-309 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-309 |
| FR-310 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-310 |
| FR-311 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-311 |
| FR-312 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-312 |
| FR-313 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-313 |
| FR-314 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-314 |
| FR-315 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-315 |
| FR-316 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-316 |
| FR-317 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-317 |
| FR-318 | Learner functions | learner_notes, submissions, stored_files, exam_attempts, released_results | Submission, file, exam, calendar, result routes | Owner RLS, private notes isolation, server exam state | LEARNER/EXAM-318 |
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

