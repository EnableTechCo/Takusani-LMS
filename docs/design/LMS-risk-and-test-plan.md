# LMS Architecture Risk and Test Plan

## Risk register

| ID | Risk | Likelihood / impact | Mitigation and evidence | Owner |
|---|---|---|---|---|
| R-01 | Incorrect scoped authorization exposes another cohort's records | Medium / Critical | Application permission service, RLS, negative matrix tests, denial audit | Engineering/security |
| R-02 | Role or allocation changes allow self-moderation or appeal review | Medium / Critical | Independence computed from every assessment actor in the decision chain, checked at allocation and re-checked inside the finding, sign-off, and conclusion transactions | Engineering/QA |
| R-03 | Duplicate requests create repeated decisions, credits, or notifications | Medium / High | Permanent client identifier per command, natural uniqueness, idempotency record written inside the domain transaction, concurrency tests | Engineering |
| R-04 | Exam answers are lost during refresh, crash, disconnection, or at expiry | Medium / Critical | IndexedDB, persistence-state UI, batched sequenced autosave, fenced lease, acceptance grace, reconnect tests (ADR-023) | Engineering/QA |
| R-05 | Client timer differs from authoritative expiry | Medium / High | Store start/expiry, derive from server time, enforce on every command | Engineering |
| R-06 | Result releases before moderation completion | Low / Critical | Required cohort moderation policy; three release paths only; shared/exclusive lock on cohort moderation state | Engineering/QA |
| R-07 | Moderation sample cannot be reproduced | Medium / High | Frozen population, digest, rule/algorithm version, seed, deterministic tests | QA owner |
| R-08 | Appeal deadline is calculated from assessment time | Low / High | Database function requires released result and snapshots deadline from released_at | Engineering |
| R-09 | Private note leaks into report or Department response | Low / Critical | Separate table, owner-only policy, explicit views, schema-contract tests | Security/data owner |
| R-10 | Privileged Supabase key reaches browser bundle | Low / Critical | Server-only module, environment scoping, bundle/secret scan, rotation drill | Security/operations |
| R-11 | Uploaded object bypasses domain authorization | Medium / High | Context-bound upload intent, random path, Storage policy, finalisation check, no overwrite | Engineering/security |
| R-12 | Email failure rolls back or delays academic state | Medium / High | Transactional outbox and in-app record committed with domain event | Engineering/operations |
| R-13 | Queue retries duplicate an external side effect | Medium / High | Stable message/delivery key; provider idempotency key as a provider selection criterion; delivery state committed before the message is archived | Engineering |
| R-14 | Connection or Data API pool is exhausted at peak | Medium / High | Transaction-mode pooler without prepared statements for SQL paths; Data API pool monitored; bounded concurrency; pool-wait alert; peak test | Operations |
| R-15 | Storage is not recoverable with database metadata | Medium / Critical | Separate object inventory/recovery, checksums, restore drill before go-live | Management/operations |
| R-16 | Browser integrity monitoring is treated as proof of misconduct | Medium / High | Advisory-only schema/UI, no automatic outcome path, assessor judgement/audit | Academic governance |
| R-17 | Department receives excess or held data | Low / Critical | Purpose-built released-record view, scope tests, response schema snapshots | Integration/security |
| R-18 | Retention conflicts with POPIA or accreditation duties | Medium / High | Record-class schedule and legal approval before production | Information officer |
| R-19 | Scheduled work overlaps, is delivered twice, or is missed | Medium / Medium | Queue visibility timeouts for drain jobs; one-shot jobs unique by domain object; database schedules for expiry and cycles; heartbeats and alerts; every exam command enforces expiry itself (ADR-025) | Operations |
| R-20 | Large report degrades interactive exam traffic | Medium / High | Async export, query/time bounds, workload tests, separate worker concurrency | Engineering |
| R-21 | A result is released unmoderated, or stranded in hold, through omission or timing | Medium / Critical | Moderated cohorts always hold; pending pool claimed at freeze; sign-off releases exactly the population; monitor for holds against terminal cycles; archival blocked while anything is pending (ADR-019) | Engineering/QA owner |
| R-22 | Calendar feed URL leaks a learner's data | Medium / Medium | Schedule-only payload, hashed revocable token, limits, no join links or results (ADR-020) | Engineering/security |
| R-23 | Credit is awarded early, twice, or not at all under concurrent release | Medium / High | Frozen requirement set; locked `learner_unit_outcomes`; award-sequence uniqueness; reconciliation job; policy confirmation of the roll-up rule (ADR-022) | Academic policy/engineering |
| R-24 | Lockout is used to deny a learner service during an exam, or is bypassed by direct Auth calls | Medium / High | Lock affects new sign-ins only and self-expires; CAPTCHA and per-address limits cover direct calls; residual risk recorded (ADR-026) | Engineering/security |
| R-25 | A caller uses the Supabase Data API directly to bypass validation, limits, or authorization, forge an actor, or read answer keys | Medium / Critical | Unexposed command schemas; actor from `auth.uid()`; explicit grants with CI enumeration; limits inside functions; keys in tables with no learner policy (ADR-024) | Engineering/security |
| R-26 | A long moderation hold hides an NYC outcome past the point where remediation is useful | Medium / High | Remediation period resolved from release; held-age dashboard and alert; maximum hold agreed with the QA owner | QA owner |
| R-27 | Intercontinental latency breaks the autosave target | Medium / High | Functions pinned to the database region; one database round trip per save; latency spike from South African clients before build (ADR-027) | Engineering/operations |
| R-28 | An application rollback calls a database function whose signature has changed | Medium / High | Additive or versioned signatures; forward-only migrations; rollback rehearsal in staging | Engineering |
| R-29 | A point-in-time restore re-sends released-result mail and orphans objects uploaded after the recovery point | Low / High | Restore runbook: pause worker, suppress pre-recovery-point outbox rows, reconcile bucket listings with `stored_files` | Operations |
| R-30 | Business rules in SQL become an untested second application layer | Medium / High | Schema per module; placement rule; database test harness before the first workflow function (ADR-024) | Engineering |
| R-31 | A departing moderator, assessor, or reviewer blocks sign-off or an appeal | Medium / Medium | Reallocation commands; deactivation refused while allocations are open | Coordinator/engineering |

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

1. Concurrent exam starts return one active attempt, and 250 synchronized starts do not serialise on the exam row.
2. Concurrent autosave batches for one attempt keep, per question, the answer with the highest client sequence; several edits in one interval never conflict; a stale lease gets `409 lease_lost`.
3. Submit and autosave racing at expiry leave one terminal attempt; answers arriving by `accept_until` are kept and flagged, later ones are refused; a save that triggers finalisation does not roll it back.
4. Two assessment finalisations produce one current immutable decision.
5. Sample generation retries return the same sample, seed, and population digest.
6. Sign-off fails with any returned item open and leaves no partial release.
7. Sign-off retries do not duplicate release, credit, notification, or audit rows.
8. Appeal lodging one second before the exclusive deadline instant succeeds and at the instant fails; the date shown to the learner is the last full local day.
9. Appeal conclusion rejects the original assessor even if assignments changed after lodging.
10. Credit allocation and reversal retries create one ledger effect each.
11. Attempts to update/delete immutable tables fail for all application roles.
12. A forced exception midway through each critical function rolls back every state change and outbox entry.
13. In a moderated cohort a decision finalised with no cycle planned, between two cycles, or after a freeze is held and pending, and produces no release, appeal window, credit, or learner notification.
14. A scheduled cycle start and a manual sample command racing each other produce one sample with one seed.
15. An exam attempt expired by the scheduler has a receipt and exactly one assessment-queue entry, identical in shape to a learner submission.
16. Allocating as moderator or reviewer anyone who took an assessment decision on the result, including the second assessor after a re-mark or resubmission, is rejected and the response names the conflict.
17. For a unit with two required items, credit is awarded only after both Competent decisions are released, exactly once, including when the two releases commit concurrently; an appeal amending one to NYC appends a reversal; one item serving two units awards both.
18. Concurrent quiz submissions at the attempt limit create no attempt beyond the limit, and no quiz record is reachable from any assessment, decision, credit, or Department view.
19. A revoked, rotated, or deactivated-profile calendar token returns 404; the feed payload snapshot contains schedule fields only.
20. Reaching the failed sign-in threshold blocks new password sign-ins, leaves an existing session and an active exam attempt fully working, notifies the user, and clears on expiry, recovery, or an audited administrator unlock.
21. Ending a role assignment or deactivating a user with open allocations is refused until they are reallocated; reallocation preserves independence.
22. Finalise racing freeze, sign-off, and cancel: under every interleaving the result is either in the frozen population or pending, never held against a terminal cycle.
23. Sign-off releases exactly the frozen population, and results finalised after the freeze are claimed by the next cycle; a second non-terminal cycle over the same item is refused.
24. A second remark appeal on a result whose first remark concluded inside the window is refused; an appeal decision cannot be appealed.
25. Changing a unit's requirement set mid-cohort does not alter awards in the frozen cohort; every ledger entry lists its contributing decisions.
26. An NYC result held for longer than its remediation period still gives the learner the full period from release.
27. A correction requires two distinct authorised users, supersedes the decision, and appends compensating credit entries.
28. With only the publishable key and a learner token, direct Data API calls cannot execute any command function with a forged actor, read answer keys, write a score, or exceed the autosave cadence; the privilege enumeration matches the expected list.
29. A message sent inside a domain transaction that rolls back is absent from the queue; a committed one is always present.
30. An accommodation granted before the sitting extends that learner's duration and close time and is snapshotted on the attempt; granting or changing one after the attempt has started is refused; a paste event on an attempt that permits paste is not counted towards the integrity threshold.
31. Assigning the Moderator role to a user who has assessed work in the same cohort succeeds with an advisory naming the excluded results; allocating that user to one of those results is refused with the same conflict named.

## Idempotency tests

- Same client identifier and same request returns the same resource, state, and receipt without a second side effect, at any time after the original.
- Same key with a different request digest returns 422.
- Natural-key duplicates are safe without the general table.
- Worker redelivery before and after provider acceptance does not create duplicate learner notifications.
- Bulk import replays do not create duplicate profiles, enrolments, invitations, or audit events.
- Duplicate, overlapping, and missed scheduled invocations are harmless: drain jobs rely on queue visibility timeouts, and one-shot jobs are unique by their domain object.
- Idempotency expiration never allows replay of a domain command whose permanent uniqueness must remain.

## Exam recovery tests

| Scenario | Expected result |
|---|---|
| Refresh after local edit before autosave | IndexedDB restores local state marked not yet persisted |
| Browser crash after successful autosave | Server version restores; no loss |
| Offline edits then reconnect | Client reconciles by question/version and persists before submission |
| Newer answer already persisted | Server keeps the higher client sequence; the client adopts it |
| Device clock changed | Timer remains based on server expiry |
| Duplicate tab edits | The tab holding the current lease succeeds; the other gets `lease_lost` |
| Crash, then a new tab | New tab acquires the lease, receives persisted answers, replays newer local edits |
| Disconnect across expiry | Edits arriving by `accept_until` are kept and flagged; later ones are refused; the attempt auto-submits |
| Final flush at timer zero | Arrives inside the grace and is kept |
| Sustained outage | Attempt auto-submits; coordinator voids and regrants; voided attempt retained |
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
- Duplicate, missed, and overlapping Vercel Cron invocations; a missed Supabase Cron run.
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
- [ ] RLS and Storage-policy matrix passes; privilege enumeration for `anon` and `authenticated` matches the expected list.
- [ ] Working decisions in the fixes and decisions register are confirmed by their owners.
- [ ] Supabase and Vercel plans and the hosting region are approved; cross-border hosting is recorded in the POPIA assessment.
- [ ] Every cohort has an explicit moderation policy; held-result monitors are live.
- [ ] Critical functions pass rollback, concurrency, and idempotency tests.
- [ ] 250-attempt exam test meets acceptance criteria from a South African client.
- [ ] Database and Storage restore drill succeeds.
- [ ] Department contract, credentials, data-sharing agreement, and minimisation tests approved.
- [ ] Secrets rotated from setup values; privileged key absent from client output.
- [ ] Dashboards, alerts, runbooks, incident roles, and independent status channel tested.
- [ ] Retention jobs and legal holds validated on synthetic data.
- [ ] Accessibility, responsive UI, supported exam-browser, and learner guidance tests pass.

