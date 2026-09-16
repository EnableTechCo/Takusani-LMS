# LMS Security and Operations

## Security objectives and data classification

| Class | Examples | Required handling |
|---|---|---|
| Restricted academic | Exam answers, submissions, decisions, moderation, appeals, credits | Least privilege, immutable history, encryption, audited access, no public caching |
| Restricted personal | Identity, contact details, notes, attendance, integrity events | Purpose limitation, minimisation, row security, retention controls |
| Confidential operational | Credentials, role assignments, configuration, audit details | Server-only access, change audit, secret rotation |
| Internal | Draft material, readiness, reports | Scoped access and normal audit |
| Published to an enrolled audience | Learning material metadata, notices | Audience checks; cache only when content contains no personal data |

Technical controls support but do not establish POPIA compliance. Lawful basis, operator contracts, retention schedules, access/correction processes, incident notification, and Department sharing require approval from accountable organisational roles.

## Threat model

| Threat | Principal controls |
|---|---|
| Cross-cohort or cross-role access | Scoped assignments, application authorization, RLS, negative-policy tests, audit denials |
| Assessor moderates own work | Database function/constraint checks actor IDs at allocation and decision time |
| Original assessor reviews appeal | Eligibility query plus transaction-time exclusion |
| Learner changes another attempt | Owner RLS, opaque IDs, active-state/version checks |
| File path or signed URL misuse | Server-issued random paths, private bucket, short expiry, context-bound intent, no overwrite |
| Privileged key leakage | Server-only environment variable, build/output scanning, no client imports, rotation runbook |
| Department overreach | Separate credentials/scopes, released-record view, filters, limits, complete access audit |
| Administrative misuse | Least privilege, immutable changes, dual review for sensitive configuration where feasible |
| Duplicate/replayed commands | Natural uniqueness, idempotency digest/response, row locks, immutable receipts |
| Browser exam bypass | Advisory logging only; no claim of secure proctoring; human academic judgement |
| Injection and unsafe content | Typed validation, parameterized access/RPC, output encoding, content-disposition, malware extension point |
| Dependency compromise | Lockfiles, automated vulnerability scanning, update cadence, minimal packages, secret scanning |

## Authentication and session handling

Supabase Auth performs sign-in, recovery, invitation, and session issuance. Next.js server rendering uses cookie-backed sessions and validates the user server-side; the [Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side) documents this model. Authentication rate controls are configured and monitored in Supabase; current platform behaviour is documented at [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

Accounts have active, deactivated, and locked operational states. Deactivation immediately blocks application commands even if an Auth token has not expired. Role changes are effective-dated and audited. Password resets and invitations notify the affected user without revealing whether an arbitrary email exists.

## Authorization and role matrix

| Capability | Learner | Facilitator | Assessor | Moderator | Coordinator | Administrator | Department |
|---|---:|---:|---:|---:|---:|---:|---:|
| View enrolled published material | Own | Assigned | As needed | As needed | Scoped | Support only | No |
| Manage material/tasks/sessions | No | Assigned | No | No | Scoped | Configuration only | No |
| Submit coursework/exam | Own | No | No | No | No | No | No |
| View submission operational status | Own | Assigned cohort | Assigned assessment | Allocated sample | Scoped | Support-audited | No |
| Mark and decide | No | No | Assigned | No | No | No | No |
| Moderate | No | No | No | Allocated and independent | Oversight | No | No |
| Lodge/view appeal | Own | No | Excluded from own review | Qualified reviewer if independent | Admit/allocate | Support only | No |
| Release held cohort results | No | No | No | Sign-off | Oversight | No | No |
| Manage roles/configuration | No | No | No | No | Limited programme setup | Yes | No |
| Read released statutory records | Own | No | Scoped | Scoped | Scoped | Audited support | Credential scope |
| View personal notes | Own only | No | No | No | No | No | No |

Possessing multiple roles grants the union only within each assignment's scope. A user who assesses one cohort and moderates another passes checks for the second but not the first. System administrators do not automatically acquire academic decision authority.

## RLS and Storage controls

RLS is enabled on every application table exposed through the Supabase Data API. Policies use authenticated user ID and stable authorization helpers. Service operations bypassing user RLS are isolated in server-only adapters and still call functions that validate workflow state and record the initiating actor.

Private Storage buckets cover submissions/evidence, learning material, recordings, report exports, and temporary uploads. Bucket-level file limits and allowed types provide a first gate; `storage.objects` policies restrict object creation and reads. The [Supabase Storage access-control guide](https://supabase.com/docs/guides/storage/security/access-control) describes the RLS model.

Signed URLs are short lived and issued only after a fresh authorization check. Highly sensitive downloads favour authenticated requests or very short-lived links. Accepted academic objects use immutable random paths and never allow upsert. File scanning is a post-upload state machine (`pending`, `clean`, `rejected`, `failed`) that can be connected to a future scanning service without changing submission history.

## Rate limiting and abuse protection

| Surface | Initial control |
|---|---|
| Sign-in/recovery | Supabase Auth controls plus monitoring and end-user IP forwarding when configured |
| Invitations/bulk import | Administrator-only command, batch validation, paced invitation queue |
| Upload authorisation | Per-user/context hourly limit and byte/file-count policy |
| Exam start | Per learner/exam burst control; institution-wide synchronized start allowed |
| Autosave | Expected 10-second cadence; per-attempt burst 10 and sustained ceiling one/second |
| Integrity events | Batched client events, payload cap, generous attempt-specific control |
| Reports/search | Page/query bounds; asynchronous export; per-user concurrency cap |
| Department API | Per credential 60/minute, burst 20, adjustable from evidence |

Controls are implemented with platform capabilities or atomic PostgreSQL time-bucket functions. Failures on ordinary read limits may fail open with telemetry; privileged, upload, and Department controls fail closed.

## Audit strategy

Significant account, role, configuration, file, assessment, moderation, appeal, release, credit, external access, and administrative actions append an audit event. Events contain actor, acting role/scope, action, aggregate identifier/version, request ID, outcome, safe before/after references, timestamp, and origin metadata. They do not copy complete files, answers, tokens, notes, or sensitive deliberation.

Application roles cannot update or delete audit rows. Retention and archival are policy-driven. API access logs additionally store the credential, requested scope and filters, and returned record identifiers so disclosure can be reconstructed.

## Logging, metrics, and alerts

Structured logs include timestamp, severity, environment, module, route template, request/trace ID, safe actor/reference IDs, result code, latency, and error category. Telemetry is emitted asynchronously and must never block the request path.

Never log passwords, tokens, secrets, raw exam answers, full uploads, personal note content, complete appeal deliberations, or unnecessary personal attributes.

### Dashboards

- Web/API: request rate, error rate, p50/p95/p99 duration, function saturation.
- Database: CPU/I/O, connections and pool wait, slow queries, lock waits, storage growth.
- Exams: active attempts, autosave success/failure, conflict rate, age since last persisted save, expiry-finalisation lag.
- Queue: depth, oldest-message age, retries, failed jobs, worker duration.
- Integrations: email acceptance/failure, Teams-link validation errors, Department rate/errors/records returned.
- Security: sign-in failures, authorization denials, role changes, unusual downloads, credential failures.

### Initial alert thresholds

- Core API 5xx above 2% for five minutes or p95 above two seconds for ten minutes.
- Exam autosave failure above 1% for two minutes or p95 above 500 ms at exam peak.
- Database connection pool above 80% or wait above 100 ms for five minutes.
- Queue oldest message above five minutes for 15 minutes; any failed academic notification job older than one hour.
- Expired active exam older than two minutes.
- Department authentication failure spike or sustained 429 above 5%.
- No successful backup/restore-verification signal within its scheduled window.

Each alert has an owner and runbook. Resource warnings that do not yet harm users create tickets rather than pages. Distributed tracing is optional initially because business logic is one deployable; request IDs and structured spans are sufficient until independently deployed components exist.

## Asynchronous processing

The same transaction that changes academic state inserts in-app notification and outbox rows. A post-commit dispatcher places durable messages in Supabase Queue. Supabase describes its queue as pull-based and backed by Postgres at [Queues quickstart](https://supabase.com/docs/guides/queues/quickstart).

A Vercel Cron invocation calls a protected Route Handler that acquires a transaction-scoped advisory lock, records a unique `(job_name, scheduled_at)` run, reads a bounded message batch using a visibility timeout, processes idempotently, and archives/acknowledges only after delivery state commits. Vercel documents that Cron invokes production functions and may deliver duplicate events, so idempotency is mandatory: [Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

Retries use exponential backoff with jitter and a finite attempt count. Permanent failures remain queryable with a redacted reason and manual replay control. Queue depth and oldest age drive scaling; job batches remain below the configured function duration documented by [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration).

## Deployment environments and secrets

| Environment | Vercel | Supabase | Data rule |
|---|---|---|---|
| Local | Local dev | Local or development project | Synthetic seed only |
| Development | Development deployment | Development project | Synthetic/test data |
| Preview | Branch preview | Development or isolated branch project | Never production credentials/data |
| Staging | Custom/staging deployment | Staging project | Sanitized representative data |
| Production | Production deployment | Production project | Approved live data |

Vercel documents separate Local, Preview, and Production environments and environment-specific variables at [Vercel environments](https://vercel.com/docs/deployments/environments) and [environment variables](https://vercel.com/docs/environment-variables). Secrets are scoped to the minimum environment; production secrets cannot be inherited by previews. Rotation procedures cover Supabase privileged credentials, email keys, cron secret, and Department credential peppers.

CI gates include type/lint/test checks, dependency and secret scanning, migration linting, schema/RLS tests against a disposable database, API contract tests, architecture-document link checks, and a staging smoke test. Database changes are versioned and forward-only. Seed data never contains production personal information.

## Backup, restore, and recovery

### Database

- Select a Supabase plan supporting the agreed recovery point.
- Monitor provider backup success and maintain schema/migration history independently.
- Run quarterly restore drills to an isolated project and validate row counts, decision chains, credit totals, RLS, and recent audit events.
- Proposed objectives: RPO 15 minutes and RTO 4 hours, pending plan verification and measured drills.

### Storage

Supabase states database backups do not include Storage objects. Define a separate scheduled inventory/export or replication process, retain checksums, and test restoring objects plus metadata references. Storage RPO remains a management decision; no production launch occurs without an approved objective and a demonstrated recovery route.

### Incident degradation

- Email outage: keep in-app notification; queue email retry.
- Queue outage: academic commits continue through outbox; dispatcher catches up.
- Supabase outage: fail writes closed; preserve local exam edits; show accurate unsaved state.
- Vercel outage: use independent status/communication channel; resume idempotently.
- Storage interruption: retry direct upload; do not accept submission metadata prematurely.
- Department integration fault: fail only the external request and protect interactive workloads.

Incident records include impact, data-integrity assessment, recovery evidence, communications, POPIA escalation decision, and corrective actions.

## POPIA and governance confirmations

Before production, confirm the responsible party/operator arrangements, lawful basis for each processing purpose, Department data-sharing agreement, data-subject access/correction process, retention/destruction schedule, cross-border hosting implications, breach response, administrator oversight, and whether integrity-event collection is proportionate. Data minimisation is enforced technically, but these governance decisions remain external to software architecture.

