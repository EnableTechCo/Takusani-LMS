# LMS Architecture Risk and Test Plan

## Risk register

| ID | Risk | Likelihood / impact | Mitigation and evidence | Owner |
|---|---|---|---|---|
| R-01 | Incorrect scoped authorization exposes another cohort's records | Medium / Critical | Application permission service, RLS, negative matrix tests, denial audit | Engineering/security |
| R-02 | Role changes allow self-moderation or appeal review | Medium / Critical | Transaction-time identity checks in addition to assignment UI validation | Engineering/QA |
| R-03 | Duplicate requests create repeated decisions, credits, or notifications | Medium / High | Natural uniqueness, idempotency records, response replay, concurrency tests | Engineering |
| R-04 | Exam answers are lost during refresh, crash, or disconnection | Medium / Critical | IndexedDB, persistence-state UI, versioned autosave, reconnect tests | Engineering/QA |
| R-05 | Client timer differs from authoritative expiry | Medium / High | Store start/expiry, derive from server time, enforce on every command | Engineering |
| R-06 | Result releases before moderation completion | Low / Critical | Hold relationship and one sign-off/release function with locked preconditions | Engineering/QA |
| R-07 | Moderation sample cannot be reproduced | Medium / High | Frozen population, digest, rule/algorithm version, seed, deterministic tests | QA owner |
| R-08 | Appeal deadline is calculated from assessment time | Low / High | Database function requires released result and snapshots deadline from released_at | Engineering |
| R-09 | Private note leaks into report or Department response | Low / Critical | Separate table, owner-only policy, explicit views, schema-contract tests | Security/data owner |
| R-10 | Privileged Supabase key reaches browser bundle | Low / Critical | Server-only module, environment scoping, bundle/secret scan, rotation drill | Security/operations |
| R-11 | Uploaded object bypasses domain authorization | Medium / High | Context-bound upload intent, random path, Storage policy, finalisation check, no overwrite | Engineering/security |
| R-12 | Email failure rolls back or delays academic state | Medium / High | Transactional outbox and in-app record committed with domain event | Engineering/operations |
| R-13 | Queue retries duplicate an external side effect | Medium / High | Stable message/delivery key, provider key where supported, post-commit ack | Engineering |
| R-14 | Serverless connection burst exhausts PostgreSQL | Medium / High | Provider pooler, bounded concurrency, pool-wait alert, peak test | Operations |
| R-15 | Storage is not recoverable with database metadata | Medium / Critical | Separate object inventory/recovery, checksums, restore drill before go-live | Management/operations |
| R-16 | Browser integrity monitoring is treated as proof of misconduct | Medium / High | Advisory-only schema/UI, no automatic outcome path, assessor judgement/audit | Academic governance |
| R-17 | Department receives excess or held data | Low / Critical | Purpose-built released-record view, scope tests, response schema snapshots | Integration/security |
| R-18 | Retention conflicts with POPIA or accreditation duties | Medium / High | Record-class schedule and legal approval before production | Information officer |
| R-19 | Scheduled work overlaps or is delivered twice | Medium / Medium | Unique scheduled run, PostgreSQL advisory lock, idempotent job functions | Operations |
| R-20 | Large report degrades interactive exam traffic | Medium / High | Async export, query/time bounds, workload tests, separate worker concurrency | Engineering |

## Test environments and data

Use disposable development databases for schema and RLS tests, staging for end-to-end and failure exercises, and production only for controlled smoke tests. Synthetic fixtures include users with multiple roles across different cohorts, first-time assessors, NYC decisions, open/closed appeal windows, archived cohorts, and intentionally conflicting assignments. No production personal data is copied to lower environments.

## Authorization and RLS matrix

For every protected table/view and Storage bucket, test direct SELECT/INSERT/UPDATE/DELETE or equivalent API actions as:

- Anonymous user.
- Learner owning and not owning the row.
- Facilitator assigned and unassigned to cohort/unit.
- Assessor assigned to the item, assigned elsewhere, and also a moderator elsewhere.
- Moderator allocated to sample, unallocated, and original assessor.
- Coordinator inside and outside scope.
- Administrator with and without the specific administrative capability.
- Department credential with each scope and an expired/revoked credential.
- Server worker role through only its allowed functions.

Mandatory negative cases include cross-cohort reads, URL/ID enumeration, own-assessment moderation, original-assessor appeal review, personal-note access, held-result access, draft marks, direct queue access, privileged file paths, and browser use of server credentials.

## Transaction and immutability tests

1. Concurrent exam starts return one active attempt and one receipt.
2. Concurrent autosaves with the same expected version produce one success and one 409, never silent overwrite.
3. Submit and autosave racing at expiry leave one terminal attempt and no post-terminal answer.
4. Two assessment finalisations produce one current immutable decision.
5. Sample generation retries return the same sample, seed, and population digest.
6. Sign-off fails with any returned item open and leaves no partial release.
7. Sign-off retries do not duplicate release, credit, notification, or audit rows.
8. Appeal lodging at the exact deadline is tested against the documented inclusive/exclusive policy.
9. Appeal conclusion rejects the original assessor even if assignments changed after lodging.
10. Credit allocation and reversal retries create one ledger effect each.
11. Attempts to update/delete immutable tables fail for all application roles.
12. A forced exception midway through each critical function rolls back every state change and outbox entry.

## Idempotency tests

- Same key and same request returns byte-equivalent status/body without a second side effect.
- Same key with a different request digest returns 422.
- Natural-key duplicates are safe without the general table.
- Worker redelivery before and after provider acceptance does not create duplicate learner notifications.
- Bulk import replays do not create duplicate profiles, enrolments, invitations, or audit events.
- Scheduled job duplicate delivery and overlapping invocation are contained by unique run and advisory lock.
- Idempotency expiration never allows replay of a domain command whose permanent uniqueness must remain.

## Exam recovery tests

| Scenario | Expected result |
|---|---|
| Refresh after local edit before autosave | IndexedDB restores local state marked not yet persisted |
| Browser crash after successful autosave | Server version restores; no loss |
| Offline edits then reconnect | Client reconciles by question/version and persists before submission |
| Server rejects stale version | Client presents conflict and reload/merge path; no blind overwrite |
| Device clock changed | Timer remains based on server expiry |
| Duplicate tab edits | Only current version succeeds; stale tab is blocked |
| Disconnect across expiry | Server records terminal expiry; local edits after expiry are not accepted |
| Submit response lost | Retry returns original immutable receipt |
| Scheduler delayed | Any subsequent command finalises expiry; cron later becomes a no-op |
| Integrity event flood | Events are batched/bounded; autosave remains healthy; outcome unchanged |

## Load and performance plan

### Normal workload

Run a mixed workload at 5 and 50 requests/second to establish generous headroom. Include dashboards, material reads, searches, notes, task publication, and scoped queues. Measure p50/p95/p99, database CPU/I/O, connection wait, slow queries, and error rate.

### Exam baseline and sensitivity

- 100 then 250 concurrent attempts.
- Ramp synchronized starts over 60 seconds.
- Ten-second autosave with realistic jitter and changed-answer payloads.
- Inject 5% reconnect/replay clients and 2% duplicate tabs.
- Synchronized final submissions over 60 seconds.
- Acceptance: autosave success at least 99.9%, p95 at most 500 ms, no lost acknowledged answer, no duplicate terminal transition, database/pool below sustained saturation.

### Release and notification burst

Release 1,000 results in one cohort operation. Verify the database transaction completes without waiting for email, unique credit/notification rows equal expected recipients, and the queue drains within 15 minutes while the provider is healthy. Repeat with the email provider returning 429/5xx and verify bounded backoff and visible lag.

### Bulk import

Validate and import 1,000 learners in 100-row batches. Include 10% invalid rows and a replay of the same file. Verify transactional batch outcomes, deduplication, paced invitations, and actionable error report.

### Files and reports

Run 100 concurrent 25 MB direct uploads with interruption/resume. Verify Vercel does not carry file bodies. Generate representative high-range reports while exams run; reports must not breach exam latency targets.

## Failure-injection scenarios

- Email provider timeout, throttling, and prolonged outage.
- Worker termination after provider acceptance but before queue acknowledgment.
- Duplicate Vercel Cron event and overlapping invocation.
- Supabase database connection refusal and mid-transaction termination.
- Storage upload failure, missing object, checksum mismatch, and orphaned intent.
- Vercel deployment during active exams.
- Queue visibility timeout shorter than a deliberately slow job.
- Department client retry storm and invalid credential enumeration.
- Misconfigured RLS policy caught by deny-by-default smoke tests.
- Restore with a missing Storage object to verify reconciliation reporting.

## Backup and restore validation

Quarterly, restore the database into an isolated project and verify schema version, row counts, foreign keys, immutable decision chains, moderation reproduction, credit totals, recent outbox/audit records, and RLS. Restore a representative Storage inventory separately, verify checksums, and reconcile every accepted file reference. Record measured RPO/RTO and remediate gaps against the provisional objectives.

## API contract tests

- Validate every request and response against versioned schemas.
- Verify stable error envelope and request ID on all error paths.
- Test cursor stability during concurrent inserts.
- Confirm page limit maximum and unbounded filter rejection.
- Verify v1 additive compatibility and deprecation headers in a simulated v2 rollout.
- Snapshot Department responses to prove excluded fields cannot appear.
- Confirm credential rotation overlap, expiry, revocation, scope, and throttling.

## Observability acceptance

Before go-live, dashboards display all defined golden signals, exam persistence, queue lag, provider health, database saturation, security denials, and Department access. Every page-level alert must have an owner, threshold, runbook, and tested notification path. Generate a synthetic request and demonstrate correlation from web log through database audit, queue message, worker attempt, and delivery record without exposing sensitive payloads.

## Architecture/document consistency checks

- All five BRs, 100 FRs, 11 NFRs, and supplied use cases appear in traceability.
- No institution discriminator or tenant abstraction appears in the data model.
- No excluded infrastructure dependency appears in runtime diagrams.
- Route names, entities, states, and transaction boundaries match across documents.
- Every diagram component maps to a requirement or operational control.
- Official technical URLs resolve and claims are phrased as documented facts or recommendations.
- Every SVG panel renders without overlap, clipped text, or unreadable arrows at desktop and narrow viewport widths.

## Go-live checklist

- [ ] Architecture and all ADRs approved.
- [ ] Appeal-day, moderation-trigger, retention, sharing, availability, and recovery decisions signed off.
- [ ] Production Supabase and Vercel environments isolated from previews.
- [ ] RLS and Storage-policy matrix passes.
- [ ] Critical functions pass rollback, concurrency, and idempotency tests.
- [ ] 250-attempt exam test meets acceptance criteria.
- [ ] Database and Storage restore drill succeeds.
- [ ] Department contract, credentials, data-sharing agreement, and minimisation tests approved.
- [ ] Secrets rotated from setup values; privileged key absent from client output.
- [ ] Dashboards, alerts, runbooks, incident roles, and independent status channel tested.
- [ ] Retention jobs and legal holds validated on synthetic data.
- [ ] Accessibility, responsive UI, supported exam-browser, and learner guidance tests pass.

