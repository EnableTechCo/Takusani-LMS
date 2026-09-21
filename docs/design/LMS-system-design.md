# LMS System Design

## Executive summary

The recommended system is a single Next.js App Router application on Vercel with clear internal domain modules. Supabase Auth provides identity, PostgreSQL is the system of record, and private Supabase Storage contains uploaded files. PostgreSQL transactions and constraints protect academic invariants. A transactional outbox enqueued inside the same transaction isolates email, imports, and exports from academic commands, and database-side scheduling keeps exam expiry and moderation schedules independent of the web tier.

This architecture is deliberately small. Calculated demand peaks at roughly 30 autosave writes per second in the sensitivity case. It does not justify independently deployed business services, database distribution, or a streaming platform. The hard problems are authorization scope, irreversible workflow transitions, exam recovery, append-only evidence, and audit reconstruction.

The design was reviewed independently on 18 September 2026. The style was endorsed; the workflow model, exam protocol, Data API exposure, and asynchronous path were corrected. Every finding, its decision, and where it was applied is in the [fixes and decisions register](LMS-design-fixes-and-decisions.md).

## Requirements summary

The LMS supports learners, facilitators, assessors, moderators, coordinators, administrators, and a Department system. A person may hold multiple context-specific roles. The system distributes material, accepts versioned coursework and evidence, conducts browser exams, records assessment decisions, selects reproducible moderation samples, holds and releases results, processes one internal appeal level, tracks credits, issues notifications, produces reports, and exposes released learner records through a versioned API.

The governing invariants are:

1. An assessor cannot moderate the same assessment.
2. No one who took an assessment decision on a result may review its appeal.
3. Assessment, moderation, appeal, submission-version, and credit history is retained rather than overwritten.
4. In a moderated cohort every result is held until the cycle that sampled its population signs off.
5. The appeal window, and any remediation deadline, runs from release.
6. Exam expiry and locking are server-authoritative.
7. Personal notes and formative quiz data never enter assessment, reporting, moderation, or external-access paths.

## Scope and exclusions

The deployment serves one institution. Role assignments are scoped globally or by programme, cohort, or unit; allocation to a specific assessment, sample item, or appeal is held on that work item. There is no institutional routing, cross-institution identity, tenant provisioning, white labelling, tenant billing, or per-institution database strategy.

Deferred or excluded capabilities are plagiarism checking, native video conferencing, automatic Microsoft Teams attendance, certification, webcam or biometric proctoring, external or second-level appeals, and recognition of prior learning unless separately approved. Microsoft Teams is represented only by validated meeting and recording links. Attendance is recorded manually.

## Assumptions and open decisions

Working decisions are the basis for design and are applied throughout this package. Each still needs the named owner's confirmation; the register records the full list with status.

| Item | Working decision | Confirmation required |
|---|---|---|
| Appeal window | Seven calendar days; closes at the start of the eighth local day in Africa/Johannesburg; the learner is shown the last full day | Academic policy |
| Cohort moderation | `moderated` or `not_moderated` is a required cohort attribute; moderated cohorts hold every result (ADR-019) | Quality assurance policy |
| Moderation cycle scope | A cycle covers named assessable items or units, optionally a period; one non-terminal cycle per item | Quality assurance policy |
| Maximum hold | Configurable threshold that drives an alert; no value assumed | Quality assurance policy |
| Resubmissions | Moderated like any other decision, by the next cycle | Quality assurance policy |
| Sign-off authority | A moderator who took no assessment decision on any sampled result | Quality assurance policy |
| Unit competency roll-up | Credit when every required item for the unit has a released Competent decision; an item may serve several units (ADR-022) | Academic policy, with the AS-03 unit list |
| Appeals | One remark per result, ever; a view-script request does not extend the window; a downgrade to NYC carries remediation | Academic policy |
| Appeal reviewer fallback | SRS AS-02 ordering | Academic policy |
| Administrative correction | `correction` decision under dual control | Academic policy |
| Exam timing | Timer never pauses; `expires_at` is the earlier of start plus duration and window close; short acceptance grace; void-and-regrant after a sustained outage (ADR-023) | Academic policy |
| Account lockout | New sign-ins only, self-expiring (ADR-026) | Security owner |
| Platform plans and region | Supabase Pro with point-in-time recovery and Small compute; Vercel Pro; database and functions co-located in a European region (ADR-027) | Management, information officer |
| Availability | 99.9% monthly planning objective | Product owner |
| Recovery | RTO 4 hours; database RPO 15 minutes, which requires the point-in-time recovery add-on | Management |
| Retention | Five- and seven-year capacity scenarios only | Information officer/legal |
| Department authentication | Opaque 256-bit bearer secret, HMAC-verified, with rotation overlap | Department agreement |
| Storage recovery | External scheduled replication over the S3 endpoint, because database backup excludes stored objects | Operations |

## Capacity conclusions

Normal dynamic traffic is estimated at 1-5 requests per second at the timetable peak. One hundred exams generate about 10 autosave requests per second at a ten-second cadence; the 250-attempt scenario produces 25, or approximately 30 with synchronization allowance. Batched autosave keeps that one request per attempt per interval regardless of how many answers changed. A 1,000-recipient release burst needs only 1.1 notification jobs per second to drain within 15 minutes. The capacity analysis therefore supports one managed relational database, pooled connections, targeted indexes, and bounded workers. See [LMS-capacity-estimates.md](LMS-capacity-estimates.md).

## Recommended architecture

### Runtime structure

- **Server Components** render authenticated pages and query domain-facing read services directly, avoiding an unnecessary HTTP round trip through the same application.
- **Client Components** are restricted to interactions needing browser state or APIs: exam editing, IndexedDB recovery, integrity signals, file selection/progress, interactive quizzes, and rich note editing.
- **Server Actions** handle first-party form mutations whose consumer ships with the same application.
- **Route Handlers** expose machine contracts, autosave, file authorisation/finalisation, the Department API, provider callbacks, health endpoints, and the worker entry point.
- **Application services** validate, orchestrate, and present. They do not hold academic rules.
- **PostgreSQL functions** own state transitions and invariants: they take locks in the fixed order, validate actor and state, write immutable records, append audit and outbox entries, enqueue, and return a typed result.

Next.js documents Server Actions as mutation-oriented and notes that Server Components should not call local Route Handlers for server-side data because that adds a round trip: [Next.js backend-for-frontend guide](https://nextjs.org/docs/app/guides/backend-for-frontend).

### Where rules live

The Supabase Data API is reachable from every browser, so a rule that exists only in a Route Handler can be bypassed (ADR-024). State transitions, invariants, and the limits that protect the database therefore live in SQL. Authorization predicates are written once as SQL helpers and used by RLS, by command functions, and by the application's user-facing check. Each module owns one SQL schema; only a read-oriented `api` schema is exposed. Command functions run with the caller's session and take the actor from `auth.uid()`. A database test harness and a CI privilege check are deliverables that precede the first workflow function, and function signatures change additively so an application rollback never calls a missing signature.

### Module boundaries

Modules are layered; a module may call only modules in lower layers, through their published functions. There are no cycles.

| Layer | Module | Owns | May call |
|---|---|---|---|
| 0 | Audit and administration | Configuration versions, audit events, operational controls | none |
| 0 | Notifications | In-app records, templates, outbox, delivery attempts | Queue and email adapters |
| 1 | Identity and access | Profiles, account status, role assignments, authorization helpers | Layer 0 |
| 2 | Programmes and cohorts | Qualifications, units, requirement sets, cohorts, enrolments, readiness, archival | Layers 0-1 |
| 3 | Learning content | Materials, quizzes, sessions, Teams links, attendance | Layers 0-2 |
| 3 | Tasks and submissions | Tasks, evidence requirements, submission versions, file metadata | Layers 0-2, Storage adapter |
| 3 | Exams | Definitions, attempts, answers, expiry, integrity events | Layers 0-2 |
| 4 | Credits | Learner-unit outcomes, append-only ledger, totals | Layers 0-2 |
| 5 | Assessment | Assessable items, results, instances, marking drafts, decisions, corrections | Layers 0-4 |
| 6 | Moderation | Cohort moderation state, cycles, populations, samples, findings, sign-off | Layers 0-5 |
| 6 | Appeals | Admissibility, reviewer allocation, script views, outcomes | Layers 0-5; reads Moderation findings through a published view (FR-609) |
| 7 | Reporting | Bounded queries and asynchronous exports | Read-only projections of all modules |
| 7 | Department integration | Versioned records API, credentials, scopes, access log | Released-record projection only |

Assessment owns `results`, so release is an Assessment function that Moderation and Appeals call; Credits sits below Assessment so that release can re-evaluate a unit. Opening an assessment instance when work is submitted is an Assessment function called by Submissions and Exams through an explicit upward exception, recorded here because it is the only one. Archival preconditions are evaluated by Programmes through read-only published views of the higher layers. Identity never inspects workflow tables: the check that a user has open allocations is a published view supplied by Assessment, Moderation, and Appeals.

## Principal request and data flows

### Sign-in and authorization

Supabase Auth completes authentication and stores the session in secure cookies suitable for server rendering. The application resolves the local profile and active assignments. Commands run in the database with the caller's session; the actor is never a parameter. RLS independently constrains row visibility over the exposed schema. Privileged credentials are used only by the worker and by maintenance, in server-only adapters. Repeated failed sign-ins lock new password sign-ins for a configured period; they never affect a session already in progress, so an exam cannot be ended by someone guessing a learner's password (ADR-026).

### Coursework submission

1. The server verifies enrolment, task state, deadline policy, and version eligibility.
2. It allocates an immutable object key and an upload intent with its own expiry.
3. The browser uploads directly to private Storage with the resumable protocol and a signed upload token.
4. File finalisation confirms the object, reads its actual size and type from Storage, and checks them against the intent.
5. Submission consumes finalised intents, creates the next immutable version, opens the assessment instance on the learner's result, and appends audit and outbox records in one transaction.
6. The scan step computes the authoritative checksum and media type; notification work occurs asynchronously.

An uploaded object is not an accepted submission until step 5 commits. Abandoned intents are expired and their unreferenced objects are cleaned by a scheduled job.

### Exam lifecycle

Starting an attempt locks the enrolment, validates the window and allowance, creates or returns the active attempt, and snapshots `expires_at`, the acceptance limit `accept_until`, and the integrity configuration. `expires_at` is the earlier of start plus duration and the window close. The browser writes each edit to IndexedDB immediately. Every ten seconds, with jitter, it sends one batch of every answer changed since the last acknowledged save, each with a per-question sequence number; the server keeps an answer only if its sequence is newer. On reconnect the whole backlog goes in one request (ADR-023).

Editing is fenced by a lease. Acquiring the lease rotates a token held only in tab memory; a request with a stale token is refused. A refreshed or crashed tab acquires a new lease and receives the persisted answers, which is the recovery path required by NFR-07, and the older tab is fenced out.

The visible timer ends at `expires_at`. Saves and the final submit are accepted for a short grace after it, and answers received in that grace are flagged, so the final flush of a learner who used the full time is not lost to latency. A database schedule finalises attempts at `accept_until`, and every exam command also checks it, so correctness never depends on the scheduler. Expiry is an automatic submission (FR-313): it takes the persisted answers as final, issues a receipt, and opens the same assessment instance as a learner submission. Functions return a typed result rather than raising after a terminal transition, so a late save cannot roll back the expiry it triggered.

The timer runs continuously and is not paused while a learner is disconnected. "Restored at its recorded state" (FR-314, NFR-07) is read as restoring the true remaining time, consistent with SRS AS-07. After a sustained outage a coordinator may void the attempt and grant a new one; the voided attempt is retained. Integrity events are append-only advisory evidence and cannot set an academic outcome or end an attempt.

### Assessment, moderation, and release

Every learner and assessable item has one `results` row, which is what is held, released, appealed, credited, and served externally (ADR-021). Finalising an assessment appends an immutable decision and moves the result's current pointer. In a `not_moderated` cohort the result is released at once. In a `moderated` cohort it is always held and waits in a pending pool; the hold depends on the cohort's required moderation policy, not on a cycle existing, so there is no way to release by omission and no gap between cycles (ADR-019).

A moderation cycle has an explicit scope. At freeze it claims every pending held result in scope as its immutable population, and sampling happens in the same transaction, deterministically from the stored seed, strata, mandatory inclusions, and snapshot. A scheduled cycle does this automatically at its start time (FR-501). Results finalised after the freeze stay pending for the next cycle, so nothing is released unsampled and nothing is stranded. Finalisation takes a shared lock on the cohort's moderation state and freeze, sign-off, and cancel take it exclusively, so finalise cannot interleave with them.

Sign-off is blocked while returned items remain unresolved. It runs one set-based transaction that closes the cycle, releases exactly the claimed population, sets each appeal deadline and release sequence, resolves remediation deadlines from the release time, re-evaluates affected unit outcomes and appends credit entries, and creates notifications, audit events, and outbox messages. Email failure cannot roll back academic release. A hold delays a learner's remediation deadline rather than consuming it, exactly as BR-05 treats the appeal window.

### Appeal and credits

Lodging locks the result, compares the current time to the deadline snapshotted at release, requires grounds, and refuses a second remark on the same result, which would otherwise be a second level of appeal (FR-613). Reviewer allocation excludes every actor of an assessment decision on the result, computed from the decision chain rather than from a mutable pointer, and offers reviewers in the SRS AS-02 order. Conclusion appends an appeal decision superseding the current one; the amended result stays released and is never claimed by a moderation cycle.

Credit is awarded per unit, not per decision. A versioned requirement set, frozen per cohort, lists the items each unit requires. Each release or supersession locks the learner's unit outcome row, re-evaluates the unit, and appends an award or reversal when the award state changes (ADR-022). The lock is what prevents two concurrent releases from each missing the other and awarding nothing. Nothing updates a historical decision or ledger amount. A `correction` decision under dual control is the administrative remedy for a wrongly released outcome.

### Formative activity and engagement

Quizzes and material access are deliberately outside the academic consistency boundary. Quiz attempts are scored by functions against answer keys that learners cannot read, and have no path into results, decisions, or credits (FR-303). Opening a material item appends a coalesced access event for engagement reporting (FR-301). Neither is visible to assessors, moderators, or the Department.

### Calendar subscription

The in-app calendar is an authenticated view over sessions, exam windows, and task due dates. The external subscription (FR-304) is a token-authenticated iCalendar feed, because calendar clients cannot hold a session. It is a distinct, deliberately narrow trust boundary: schedule fields only, no results and no Teams join links, privately cached, revocable by the learner (ADR-020).

### Department API

The Department calls `/api/v1` with a scoped credential verified by HMAC. Failed authentication is limited separately from the credential's success budget. Change discovery is ordered by a release sequence assigned inside the release transaction, so a result decided weeks before its release is never missed. Every resource reads a released-record view from which drafts, held results, notes, deliberations, quiz data, and integrity events are structurally absent, and every request writes an access event with the returned record identifiers.

### Asynchronous work and scheduling

The domain function inserts the outbox row and enqueues the message in the same transaction; the queue lives in the same database, so a separate dispatcher would add a loss window and no isolation (ADR-025). A Vercel worker invoked by Vercel Cron performs provider calls and commits each delivery before archiving its message; queue visibility timeouts make duplicate or overlapping invocations harmless. Pure-database schedules (exam finalisation, scheduled cycle freeze, scheduled publication, intent expiry, purges, credit reconciliation) run on Supabase Cron and do not depend on Vercel.

## Workflow consistency and transaction boundaries

Lock order in every function: cohort moderation state, cycle, results in identifier order, learner-unit outcomes.

| Workflow | Atomic work |
|---|---|
| Start exam | Lock enrolment; validate window/allowance; create or return attempt with snapshots; audit |
| Acquire lease | Rotate lease token; return persisted answers |
| Autosave | One function: check state, lease, cadence, acceptance limit; upsert answers with newer sequence |
| Submit or expire exam | Lock attempt; persist final answers; set terminal state and receipt; open assessment instance; enqueue; audit |
| Void attempt | Mark voided; retain answers; restore allowance; audit |
| Finalise assessment | Shared lock on cohort moderation state; lock result; append decision; move pointer; hold, or release with deadlines, sequence, and unit re-evaluation; audit/outbox |
| Set moderation policy | Exclusive lock on cohort moderation state; version the policy; audit |
| Plan or cancel cycle | Exclusive lock; enforce one non-terminal cycle per item; audit |
| Freeze and sample | Exclusive lock; claim pending results in scope; persist population, digest, seed, selections, allocations; audit |
| Return for re-marking | Append finding; transition item; notify; audit |
| Reallocate | Lock result; check independence; move allocation; audit |
| Sign off moderation | Exclusive lock; verify no outstanding returns; release the population set-based; deadlines, sequences, credits, notifications, audit/outbox |
| Lodge appeal | Lock result; compare to deadline snapshot; enforce one remark per result; append appeal; notify; audit |
| Conclude appeal | Lock result; re-check reviewer independence; append superseding decision; re-evaluate unit; notify; audit |
| Correct result | Dual control; append correction decision; re-evaluate unit; notify; audit |
| Evaluate unit credit | Lock learner-unit outcome; evaluate frozen requirement set; append award or reversal with contributing decisions |
| Assign or change role | Lock the user's profile row; check overlap and open allocations; write assignment; audit previous value |

## Caching and rate control

Published reference definitions, non-personal notices, and material metadata may use browser directives, request memoisation, and bounded Next.js caching with explicit invalidation on publish/change. Exam state, authorization assignments, decisions, results, moderation, appeals, personal notes, credits, and audit data bypass application caches. The calendar feed is cached privately only.

Authentication endpoints use Supabase Auth controls. Application limits are selective: strict for invitation/reset/upload authorisation/report creation/Department access; generous burst limits for exam start and integrity events; and a per-attempt cadence check for autosave. Limits that protect the database are enforced inside the functions, because a Route Handler limit does not bind a caller using the Data API directly. Time-bucket rows are purged on schedule. Autosave is never subject to a restrictive global limit.

## Failure handling and graceful degradation

| Failure | Behaviour |
|---|---|
| Email provider down | Academic transaction succeeds; queue retries with backoff; failed jobs remain visible; in-app notification remains available |
| Vercel worker or cron failure | Queue persists; next run resumes; oldest-undelivered-outbox alert fires; database schedules are unaffected |
| Supabase Cron failure | Every exam command still enforces expiry; heartbeat and "expired active exam" alerts fire |
| Supabase unavailable | Writes fail closed; exam client retains edits in IndexedDB and shows persistence status; server timer remains authoritative on recovery |
| Vercel unavailable | No new server interaction; local unsaved exam edits remain; exams still finalise in the database; incident communication uses an independent channel |
| Browser disconnect/crash | New tab acquires the lease, receives persisted answers, merges newer local edits by sequence |
| Sustained outage during an exam | Attempt auto-submits with persisted answers; coordinator may void and regrant |
| Storage upload interrupted | Resumable upload continues; metadata is not committed until finalisation succeeds |
| Duplicate command | The permanent client identifier returns the prior resource and receipt without repeating side effects |
| Department overload or bad credentials | Credential-specific 429 with `Retry-After`; failed-authentication limits are separate, so invalid traffic cannot exhaust the Department's budget |
| Teams unavailable | LMS still shows schedule and link; meeting availability remains Microsoft's responsibility |
| Database restored to a point in time | Worker paused; pre-recovery-point outbox rows suppressed pending review; Storage reconciled against metadata |

Every remote call has a bounded timeout. Retries are limited, jittered, and restricted to idempotent operations. A distributed circuit-breaker platform is not warranted; persistent job state and dependency-health reporting provide reliable behaviour across stateless Vercel instances.

## Security and trust boundaries

The browser is untrusted, and it can reach the Supabase Data API directly. Only the `api` schema is exposed; command functions and key-bearing tables are not. Default execute privileges are revoked and every grant is explicit and checked in CI. Definer functions set an empty `search_path`. Append-only tables are protected by both revocation and triggers. Storage is private, download URLs are short lived and issued after a fresh authorization check, and paths are random immutable identifiers rather than user-controlled names.

The Department boundary and the calendar feed are separate from interactive user authorization, each with its own credential, limits, and minimised payload. POPIA-related controls include minimisation, purpose-limited views, access logging, encryption, retention enforcement, and breach evidence; lawful basis, cross-border hosting, and policy remain organisational responsibilities.

## Deployment and recovery

Local development, development, staging, and production use distinct Supabase projects and secrets. Vercel previews may use development or ephemeral non-production data but never production credentials. Vercel functions are pinned to the database's region, because each sequential database call otherwise pays an intercontinental round trip (ADR-027). Migrations move forward through CI after static checks, database tests, privilege enumeration, and staging validation. Destructive changes use expand-migrate-contract sequencing, and function signatures change additively. Rollback means reverting application code and applying an explicit forward repair migration, not silently reverting production data.

Supabase documents daily database backups and optional point-in-time recovery, while noting Storage objects are outside database backup: [Supabase database overview](https://supabase.com/docs/guides/database/overview). The 15-minute recovery point therefore depends on the point-in-time recovery add-on. A restore is in place and rewinds Storage metadata, the queue, and the outbox together, so the runbook pauses the worker, suppresses pre-recovery-point outbox rows pending review, and reconciles bucket listings against file metadata. Storage bodies are replicated by an external scheduled runner. Restore drills cover the database and Storage separately.

## Scaling path

1. Tune queries, indexes, payloads, and connection pooling.
2. Increase managed database compute when measured CPU/I/O warrants it.
3. Move heavy reports to asynchronous exports and maintain narrow read projections.
4. Partition only append-heavy audit or integrity tables if retention and maintenance measurements justify it.
5. Reconsider deployment boundaries only if a module demonstrates materially different scaling, availability, or ownership needs.

The architecture does not pre-build later rungs. Measurable triggers are in the capacity document.

## Rejected alternatives

- Independently deployed business services: unjustified team and scale cost; they would complicate transactions and operations.
- Document or wide-column primary storage: poor fit for relational permissions and audit invariants.
- Database sharding: calculated load is far below a single managed PostgreSQL system.
- Kafka or RabbitMQ: the required work is a modest task queue, not a replayable high-volume event platform.
- Native video and biometric proctoring: explicitly outside scope and materially increases privacy and operational risk.
- Direct Department access to Supabase APIs: cannot enforce the contract, minimisation, deprecation, and audit boundary safely.
- Route Handlers as the only enforcement point: the Data API bypasses them.

## Final recommendation

Proceed with the modular monolith and treat PostgreSQL as the consistency boundary. Work may start now on authentication, the schema-per-module and privilege regime with its CI check, direct uploads, the database test harness, and the platform spikes listed in the register. Do not write the finalise, freeze, sign-off, appeal-conclusion, correction, or credit functions until the working decisions on moderation scope, resubmissions, unit roll-up, and appeals are confirmed by their owners, because those functions encode them. Prototype and load-test the exam persistence path early from a South African client. Resolve retention, platform plan and region, and the Department agreement before production data is loaded.
