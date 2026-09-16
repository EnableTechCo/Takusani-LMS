# LMS System Design

## Executive summary

The recommended system is a single Next.js App Router application on Vercel with clear internal domain modules. Supabase Auth provides identity, PostgreSQL is the system of record, and private Supabase Storage contains uploaded files. PostgreSQL transactions and constraints protect academic invariants. Supabase Queue and a transactional outbox isolate email, scheduled work, imports, and exports from academic commands.

This architecture is deliberately small. Calculated demand peaks at roughly 30 autosave writes per second in the sensitivity case. It does not justify independently deployed business services, database distribution, or a streaming platform. The hard problems are authorization scope, irreversible workflow transitions, exam recovery, append-only evidence, and audit reconstruction.

## Requirements summary

The LMS supports learners, facilitators, assessors, moderators, coordinators, administrators, and a Department system. A person may hold multiple context-specific roles. The system distributes material, accepts versioned coursework and evidence, conducts browser exams, records assessment decisions, selects reproducible moderation samples, holds and releases results, processes one internal appeal level, tracks credits, issues notifications, produces reports, and exposes released learner records through a versioned API.

The governing invariants are:

1. An assessor cannot moderate the same assessment.
2. The original assessor cannot independently review its appeal.
3. Assessment, moderation, appeal, submission-version, and credit history is retained rather than overwritten.
4. Results under moderation remain held until sign-off.
5. The appeal window starts from release.
6. Exam expiry and locking are server-authoritative.
7. Personal notes never enter assessment, reporting, moderation, or external-access paths.

## Scope and exclusions

The deployment serves one institution. Roles are scoped by programme, cohort, unit, task, assessment, or appeal as required. There is no institutional routing, cross-institution identity, tenant provisioning, white labelling, tenant billing, or per-institution database strategy.

Deferred or excluded capabilities are plagiarism checking, native video conferencing, automatic Microsoft Teams attendance, certification, webcam or biometric proctoring, external or second-level appeals, and recognition of prior learning unless separately approved. Microsoft Teams is represented only by validated meeting and recording links. Attendance is recorded manually.

## Assumptions and open decisions

| Item | Working decision | Confirmation required |
|---|---|---|
| Appeal window | Seven calendar days, shown in Africa/Johannesburg | Academic policy |
| Moderation trigger | Explicitly opened or scheduled cycle after eligible decisions exist | Quality assurance policy |
| Availability | 99.9% monthly planning objective | Product owner |
| Recovery | RTO 4 hours; database RPO 15 minutes | Management and selected Supabase plan |
| Retention | Five- and seven-year capacity scenarios only | Information officer/legal |
| Department authentication | Scoped opaque bearer credential with rotation overlap | Department agreement |
| Storage recovery | Separate export/replication procedure because database backup excludes stored objects | Operations |

## Capacity conclusions

Normal dynamic traffic is estimated at 1-5 requests per second at the timetable peak. One hundred exams generate about 10 autosave writes per second at a ten-second cadence; the 250-attempt scenario produces 25, or approximately 30 with synchronization allowance. A 1,000-recipient release burst needs only 1.1 notification jobs per second to drain within 15 minutes. The capacity analysis therefore supports one managed relational database, pooled connections, targeted indexes, and bounded workers. See [LMS-capacity-estimates.md](LMS-capacity-estimates.md).

## Recommended architecture

### Runtime structure

- **Server Components** render authenticated pages and query domain-facing read services directly, avoiding an unnecessary HTTP round trip through the same application.
- **Client Components** are restricted to interactions needing browser state or APIs: exam editing, IndexedDB recovery, integrity signals, file selection/progress, interactive quizzes, and rich note editing.
- **Server Actions** handle first-party form mutations whose consumer ships with the same application.
- **Route Handlers** expose machine contracts, autosave, file authorisation/finalisation, the Department API, provider callbacks, health endpoints, and scheduled worker entry points.
- **Application services** orchestrate formal workflows. Domain modules expose commands and queries; UI code does not contain academic rules.
- **PostgreSQL functions** own critical multi-row transitions, lock affected rows, validate actor and state, write immutable records, append audit/outbox entries, and return the committed result.

Next.js documents Server Actions as mutation-oriented and notes that Server Components should not call local Route Handlers for server-side data because that adds a round trip: [Next.js backend-for-frontend guide](https://nextjs.org/docs/app/guides/backend-for-frontend).

### Module boundaries

| Module | Owns | May call synchronously |
|---|---|---|
| Identity and access | Profiles, account status, scoped assignments, authorization checks | Programmes/cohorts, audit |
| Programmes and cohorts | Qualifications, units, cohorts, enrolments, readiness, archival | Identity, learning, audit |
| Learning content | Materials, quizzes, sessions, Teams links, attendance | Programmes, notifications, audit |
| Tasks and submissions | Tasks, evidence requirements, submission versions, file metadata | Programmes, Storage adapter, assessment, notifications |
| Exams | Definitions, attempts, answers, expiry, integrity events | Programmes, assessment, audit |
| Assessment | Rubrics, marking drafts, immutable decisions, remediation | Submissions/exams, moderation, notifications, audit |
| Moderation | Cycles, snapshots, samples, findings, returns, sign-off | Assessment, notifications, credits, audit |
| Appeals | Admissions, reviewer assignment, view-script access, outcomes | Assessment, credits, notifications, audit |
| Credits | Append-only ledger and derived totals | Assessment/appeals, reporting |
| Notifications | In-app records, templates, outbox, delivery attempts | Queue/email adapter |
| Reporting | Bounded queries and asynchronous exports | Read-only module projections |
| Department integration | Versioned records API, credentials, scopes, access log | Released-record projection only |
| Audit and administration | Configuration versions, audit events, operational controls | Read-only references to all modules |

Modules do not modify another module's tables directly from UI code. Cross-module commands go through an application service or an owning PostgreSQL function. Reporting and Department access use explicit read models, never broad joins over private operational tables.

## Principal request and data flows

### Sign-in and authorization

Supabase Auth completes authentication and stores the session in secure cookies suitable for server rendering. The application resolves the local profile and active scoped assignments. Every command performs application authorization before invoking a narrowly granted database operation; RLS independently constrains row visibility. Administrative use of privileged credentials occurs only in server-only adapters.

### Coursework submission

1. The server verifies enrolment, task state, deadline policy, and version eligibility.
2. It allocates an immutable object key and upload intent.
3. The browser uploads directly to private Storage using a short-lived signed upload URL.
4. The browser submits the object checksum and metadata for finalisation.
5. A database function verifies the intent, creates the next submission version, appends audit/outbox records, and consumes the idempotency key.
6. Notification work occurs asynchronously.

An uploaded object is not an accepted submission until metadata finalisation commits. Abandoned upload intents are expired and their unreferenced objects are cleaned by a scheduled job.

### Exam lifecycle

The start command locks the exam/enrolment relationship, validates the open window and attempt allowance, creates or returns the active attempt, and stores `started_at`, `expires_at`, and a concurrency version. The browser writes each edit to IndexedDB immediately. Every ten seconds, with jitter, it sends changed answers and the expected version. The server rejects writes after expiry/submission, compares versions, performs idempotent upserts, and advances the version.

On reconnect, the client compares local and persisted versions per answer, never the timer. The timer is derived from server time and `expires_at`. Submission atomically locks the attempt, records the final answer set/version, creates an assessment-queue entry, writes audit/outbox rows, and returns the receipt. A scheduled database function finalises overdue attempts using row locks and `SKIP LOCKED`; every exam command also checks expiry, so correctness never depends solely on the scheduler.

One tab obtains the current editing lease identifier. A second tab may read but cannot overwrite a newer version; it receives a conflict response and must reload the persisted state. Integrity events are append-only advisory evidence and cannot set an academic outcome.

### Assessment, moderation, and release

Finalising an assessment inserts an immutable decision and either releases it or associates it with a moderation hold. Opening a moderation cycle freezes the eligible-population snapshot and configuration version. Sample generation is deterministic from the stored seed, strata, mandatory inclusions, and snapshot. Sign-off is blocked while returned items remain unresolved.

Sign-off runs one transaction that closes the moderation cycle, releases eligible results, computes appeal deadlines, appends credit entries, creates learner-visible notifications, audit events, and outbox rows. Email failure cannot roll back academic release.

### Appeal and credits

The appeal command locks the released result, calculates the deadline from `released_at`, prevents duplicates of the same active appeal type, and records grounds. Allocation excludes the original assessor through both query eligibility and a database constraint/function check. Concluding a remark appends the outcome and, if necessary, a superseding academic decision plus compensating credit-ledger entries. Nothing updates a historical decision or ledger amount.

### Department API

The Department calls `/api/v1` with a scoped credential. The route validates the credential hash, status, expiry, and scope; applies a credential-specific database-backed limit; queries only a released-record view; and writes an access event with request metadata and returned record identifiers. Drafts, held results, notes, deliberations, and integrity events are structurally absent from that view.

## Workflow consistency and transaction boundaries

| Workflow | Atomic work |
|---|---|
| Start exam | Validate eligibility/window; create or return attempt; audit |
| Autosave | Check state/expiry/version; upsert changed answers; advance version |
| Submit exam | Lock attempt; persist final answers; set submitted; enqueue assessment and notification; audit |
| Finalise assessment | Validate marking/remediation; append decision; derive hold/release; audit/outbox |
| Generate sample | Lock cycle; freeze population; persist seed/rule/selections; hold cohort; audit |
| Return for remarking | Append moderation finding; transition item; notify; audit |
| Sign off moderation | Verify no outstanding returns; close cycle; release results; create appeal windows, credits, notifications, audit/outbox |
| Lodge appeal | Validate release/deadline/type; append appeal; notify; audit |
| Conclude appeal | Verify reviewer independence; append outcome/superseding decision; adjust credits; notify; audit |
| Allocate credits | Insert unique ledger event for the released decision; update derived projection in the same transaction |

## Caching and rate control

Published reference definitions, non-personal notices, and material metadata may use browser directives, request memoisation, and bounded Next.js caching with explicit invalidation on publish/change. Exam state, authorization assignments, decisions, moderation, release, appeals, personal notes, credits, and audit data bypass application caches.

Authentication endpoints use Supabase Auth controls. Application limits are selective: strict for invitation/reset/upload authorisation/report creation/Department access; generous burst limits for exam start and integrity events; and a per-attempt minimum interval plus payload/version validation for autosave. Limits use PostgreSQL functions and time buckets where required. Autosave is never subject to a restrictive global limit.

## Failure handling and graceful degradation

| Failure | Behaviour |
|---|---|
| Email provider down | Academic transaction succeeds; queue retries with backoff; failed jobs remain visible; in-app notification remains available |
| Worker or cron failure | Queue persists; next run resumes; oldest-message alert fires |
| Supabase unavailable | Writes fail closed; exam client retains edits in IndexedDB and shows persistence status; server timer remains authoritative on recovery |
| Vercel unavailable | No new server interaction; local unsaved exam edits remain; incident communication uses an independent channel |
| Browser disconnect/crash | IndexedDB restores local edits; client reconciles with server versions and expiry |
| Storage upload interrupted | Client retries the direct upload; metadata is not committed until checksum/finalisation succeeds |
| Duplicate command | Natural uniqueness or idempotency record returns the prior result without repeating side effects |
| Department overload | Credential-specific 429 with `Retry-After`; learner application traffic remains isolated |
| Teams unavailable | LMS still shows schedule and link; meeting availability remains Microsoft's responsibility |

Every remote call has a bounded timeout. Retries are limited, jittered, and restricted to idempotent operations. A distributed circuit-breaker platform is not warranted; persistent job state and dependency-health reporting provide reliable behaviour across stateless Vercel instances.

## Security and trust boundaries

The browser is untrusted. Publishable credentials may be present there, but privileged credentials never are. The application boundary performs command validation and authorization. Database RLS is defence in depth, while transactional functions run with the least privileges necessary and fixed `search_path`. Storage is private, signed URLs are short lived, and paths are random immutable identifiers rather than user-controlled names.

The Department boundary is separate from interactive user authorization. Credentials, scopes, limits, and audits are independent. POPIA-related controls include minimisation, purpose-limited views, access logging, encryption, retention enforcement, and breach evidence; lawful basis and policy remain organisational responsibilities.

## Deployment and recovery

Local development, development, staging, and production use distinct Supabase projects and secrets. Vercel previews may use development or ephemeral non-production data but never production credentials. Migrations move forward through CI after static checks, schema/RLS tests, and staging validation. Destructive changes use expand-migrate-contract sequencing. Rollback means reverting application code and applying an explicit forward repair migration, not silently reverting production data.

Supabase documents daily database backups and optional point-in-time recovery, while noting Storage objects are outside database backup: [Supabase database overview](https://supabase.com/docs/guides/database/overview). Restore drills must therefore cover the database and Storage separately, then reconcile object metadata and checksums.

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

## Final recommendation

Proceed with the modular monolith and treat PostgreSQL as the consistency boundary. Implement the most critical database functions and RLS policies before building feature UI. Prototype and load-test the exam persistence path early, then prove moderation/release/appeal invariants with transaction and concurrency tests. Resolve retention, appeal-day, moderation-trigger, and Department-authentication policy before production data is loaded.

## Design quality score

| Dimension | Score / 5 | Evidence or improvement needed |
|---|---:|---|
| Distributed-systems fundamentals | 5 | Consistency boundary, failure states, queue semantics, and duplicate handling are explicit |
| Building-block depth | 5 | Database, Storage, queue, caching, rate control, and workers include stress behaviour |
| Requirements and scope | 5 | Complete identified requirement groups, conflicts, and exclusions are traced |
| Trade-offs | 5 | Major decisions record benefits, costs, and revisit triggers in ADRs |
| Capacity grounding | 4 | Workload formulas are explicit; actual file sizes, retention, and programme activity still need measurement |
| Failure and recovery | 4 | Degradation and tests are defined; storage recovery tooling and provider runbooks remain to be proven |
| Adaptability | 5 | Scaling triggers and stable module seams are explicit without premature distribution |
| **Total** | **33 / 35** |  |

The weakest dimensions are capacity evidence and recovery proof. Production measurements, an approved retention schedule, and a successful database-plus-Storage restore exercise would raise both to 5.

