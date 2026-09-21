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
| Calendar feed URL leaked or guessed | 256-bit token stored as a hash, schedule-only payload with no results or join links, private caching only, per-token limit, per-IP limit on unknown tokens, token path redacted in log drains, learner-initiated rotation, invalidation on deactivation |
| Password guessing against one account | Supabase Auth rate limits, CAPTCHA, per-profile failure counting with a self-expiring sign-in lock; uniform failure response |
| Lockout used to deny service during an exam | Lock affects new sign-ins only; existing sessions and exam commands are never blocked (ADR-026) |
| Direct Data API calls bypass Route Handlers | Only the `api` schema exposed; command functions in unexposed schemas; actor from `auth.uid()`; explicit grants checked in CI; limits enforced inside functions (ADR-024) |
| Forged actor on a command | No function accepts an actor parameter; worker functions granted to `service_role` only |
| Learner reads answer keys or writes a score | Keys in tables with no learner policy; scores computed by functions only |
| Result released unmoderated, or stranded in hold | Required cohort moderation policy; pending pool claimed at freeze; shared/exclusive lock on cohort moderation state; held-against-terminal-cycle monitor (ADR-019) |
| Credit missed or duplicated under concurrency | Learner-unit outcome row locked during evaluation; ledger uniqueness on award sequence; reconciliation job (ADR-022) |
| Invalid Department requests exhaust its budget | HMAC verification; failed-authentication limits separate from the success budget |
| Administrative misuse | Least privilege, immutable changes, dual review for sensitive configuration where feasible |
| Duplicate/replayed commands | Natural uniqueness, idempotency digest/response, row locks, immutable receipts |
| Browser exam bypass | Advisory logging only; no claim of secure proctoring; human academic judgement |
| Injection and unsafe content | Typed validation, parameterized access/RPC, output encoding, content-disposition, malware extension point |
| Dependency compromise | Lockfiles, automated vulnerability scanning, update cadence, minimal packages, secret scanning |

## Authentication and session handling

Supabase Auth performs sign-in, recovery, invitation, and session issuance. Next.js server rendering uses cookie-backed sessions and validates the user server-side; the [Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side) documents this model. Authentication rate controls are configured and monitored in Supabase; current platform behaviour is documented at [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

FR-106 requires an account to lock after failed sign-in attempts and an administrator to unlock it. Failed sign-ins are unauthenticated, so a lock that blocked existing sessions would let anyone who knows a learner's email address end that learner's exam. Lockout therefore blocks new password sign-ins only, never an existing session or an exam command, and it expires by itself after a configured period as well as being cleared by an administrator or by email recovery (ADR-026).

Supabase Auth's built-in protection is request rate limiting, not per-account lockout. Its [password verification hook](https://supabase.com/docs/guides/auth/auth-hooks/password-verification-hook) can count failures inside Auth, but it is offered on the Team and Enterprise plans only. On the recommended Pro plan (ADR-027), password sign-in goes through a server-side handler that counts failures in `sign_in_failures`, with CAPTCHA on the sign-in form. A caller using the Auth endpoint directly is limited by Supabase's per-address limits but is not counted; that residual risk is accepted and recorded. The locked response is indistinguishable from an ordinary failed sign-in, the user is notified, and lock, unlock, and expiry are audited.

Accounts are active or deactivated; a sign-in lock is a separate, temporary condition. Deactivation immediately blocks application commands even if an Auth token has not expired, only an administrator can apply it, and it is refused while the user holds open allocations that must first be reallocated. Role changes are effective-dated and audited. Password resets and invitations notify the affected user without revealing whether an arbitrary email exists.

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

The Supabase Data API is reachable from every browser with the publishable key and the user's token, so it is treated as a public surface (ADR-024). Only the read-oriented `api` schema is exposed. Tables and command functions live in unexposed module schemas. Default execute privileges are revoked from `PUBLIC`, `anon`, and `authenticated`, every grant is explicit, and a CI check enumerates table and function privileges for those roles and fails on anything unexpected. User-initiated commands run with the caller's session and take the actor from `auth.uid()`; no function accepts an actor parameter. Worker functions are granted to `service_role` only and are called from server-only adapters. Definer functions set an empty `search_path` and qualify every name.

RLS is enabled on every table and view reachable through the Data API. Policies use `auth.uid()` and stable authorization helpers, and the same helpers are used by command functions and by the application's user-facing check, so a rule is written once. RLS filters rows, not columns: answer keys and scoring rules sit in tables with no learner policy. Append-only tables are protected by revocation, including from `service_role`, and by triggers that raise on update, delete, and truncate.

Private Storage buckets cover submissions/evidence, learning material, recordings, report exports, and temporary uploads. Bucket-level file limits and allowed types provide a first gate; `storage.objects` policies restrict object creation and reads. The [Supabase Storage access-control guide](https://supabase.com/docs/guides/storage/security/access-control) describes the RLS model.

Signed download URLs are short lived and issued only after a fresh authorization check. Highly sensitive downloads favour authenticated requests or very short-lived links. Signed upload URLs behave differently: Supabase issues them with a fixed lifetime of about two hours and no per-URL size or type limit, so the upload intent's own expiry and limits, checked at finalisation against the object's actual Storage metadata, are the control. Uploads use the resumable protocol with the signed upload token. Storage exposes no content hash, so the client checksum is recorded as declared and the authoritative SHA-256 and media type are computed server-side in the scan step. Accepted academic objects use immutable random paths and never allow upsert. File scanning is a post-upload state machine (`pending`, `clean`, `rejected`, `failed`) that can be connected to a future scanning service without changing submission history.

## Rate limiting and abuse protection

| Surface | Initial control |
|---|---|
| Sign-in/recovery | Supabase Auth controls plus monitoring and end-user IP forwarding when configured |
| Invitations/bulk import | Administrator-only command, batch validation, paced invitation queue |
| Upload authorisation | Per-user/context hourly limit and byte/file-count policy |
| Exam start | Per learner/exam burst control; institution-wide synchronized start allowed |
| Autosave | One batch per 10-second interval; cadence checked inside the function from the attempt's last save; sustained ceiling one/second; batch bounded by question count so reconnect replay is never throttled |
| Integrity events | Batched client events, payload cap, generous attempt-specific control |
| Reports/search | Page/query bounds; asynchronous export; per-user concurrency cap |
| Calendar feed | 60/hour per token with private conditional-request caching; per-IP limit on unknown tokens only, never on known-revoked ones |
| Material access logging | Coalesced per learner/item/interval and written off the render path; a logging failure never blocks material access |
| Department API | Per credential 60/minute, burst 20, adjustable from evidence; failed authentication limited separately per address and credential ID |

Controls are implemented with platform capabilities or atomic PostgreSQL time-bucket functions, called from inside the command function wherever the limit protects the database, because a Route Handler limit does not bind a direct Data API caller. Bucket rows are purged by a database schedule. Failures on ordinary read limits may fail open with telemetry; privileged, upload, and Department controls fail closed.

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
- Oldest undelivered outbox row, or queue oldest message, above five minutes for 15 minutes; any failed academic notification job older than one hour.
- Active exam attempt more than two minutes past `accept_until`, or a missed Supabase Cron heartbeat.
- Any result held against a terminal moderation cycle (should be impossible; page immediately).
- Any held result older than the configured maximum hold; any due scheduled cycle not frozen.
- Credit reconciliation difference between ledger and rule.
- Any unexpected grant found by the privilege check in production.
- Department authentication failure spike or sustained 429 above 5%.
- No successful backup/restore-verification signal within its scheduled window.

Each alert has an owner and runbook. Resource warnings that do not yet harm users create tickets rather than pages. Distributed tracing is optional initially because business logic is one deployable; request IDs and structured spans are sufficient until independently deployed components exist.

## Asynchronous processing

The same transaction that changes academic state inserts the in-app notification and outbox rows and sends the queue message. Supabase describes its queue as pull-based and backed by Postgres at [Queues quickstart](https://supabase.com/docs/guides/queues/quickstart); because it shares the database, enqueueing inside the transaction is atomic and a separate post-commit dispatcher would only add a window in which a committed event is never enqueued (ADR-025). A queue outage is therefore not a distinct failure from a database outage.

Work that calls external providers runs in a Vercel worker. Vercel Cron invokes it with an HTTP GET carrying the cron secret. Vercel documents that cron delivery is best effort, may be duplicated, and is not retried: [Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs). The worker reads a bounded batch with a visibility timeout, and for each message commits the delivery state and then archives it. Overlapping or duplicate invocations are made harmless by the visibility timeout. No advisory lock is used: a transaction-scoped lock cannot span per-message commits, holding one transaction open across provider calls would roll back the record of mail already sent, and session locks do not survive the transaction-mode pooler. Email sends carry a provider idempotency key derived from the outbox deduplication key; support for one is a provider selection criterion.

Pure-database schedules run on Supabase Cron so that they do not depend on Vercel: exam finalisation at `accept_until`, scheduled cycle freeze and sampling, scheduled publication, upload-intent expiry, purging of idempotency and rate-bucket rows, and credit reconciliation. One-shot jobs are made unique by their domain object, never by clock time. Each job records a heartbeat in `scheduled_runs`.

Retries use exponential backoff with jitter. Poison messages are retired by the queue's read count. Permanent failures remain queryable with a redacted reason and manual replay control. Queue depth and oldest age drive scaling; job batches remain below the configured function duration documented by [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration).

## Deployment environments and secrets

| Environment | Vercel | Supabase | Data rule |
|---|---|---|---|
| Local | Local dev | Local or development project | Synthetic seed only |
| Development | Development deployment | Development project | Synthetic/test data |
| Preview | Branch preview | Development or isolated branch project | Never production credentials/data |
| Staging | Custom/staging deployment | Staging project | Sanitized representative data |
| Production | Production deployment | Production project | Approved live data |

Vercel documents separate Local, Preview, and Production environments and environment-specific variables at [Vercel environments](https://vercel.com/docs/deployments/environments) and [environment variables](https://vercel.com/docs/environment-variables). Secrets are scoped to the minimum environment; production secrets cannot be inherited by previews. Rotation procedures cover Supabase privileged credentials, email keys, cron secret, and Department credential peppers.

The planning basis is Supabase Pro with the point-in-time recovery add-on and at least Small compute, and Vercel Pro, which per-minute cron requires (ADR-027). Supabase has no African region. Vercel functions are pinned to the Supabase project's region rather than placed near learners, because each sequential database call otherwise pays an intercontinental round trip; static assets stay on the edge network. Hosting personal information outside South Africa is an input to the POPIA cross-border assessment.

CI gates include type/lint/test checks, dependency and secret scanning, migration linting, database function tests (pgTAP or equivalent) and RLS tests against a disposable database, enumeration of table and function privileges for `anon` and `authenticated`, a performance gate releasing 1,000 results within two seconds, API contract tests, architecture-document link checks, and a staging smoke test. Database changes are versioned and forward-only, and function signatures change additively or by versioned name so an application rollback never calls a missing signature. Seed data never contains production personal information.

## Backup, restore, and recovery

### Database

- A 15-minute recovery point requires the point-in-time recovery add-on, which requires at least Small compute; daily backups alone give a recovery point of up to 24 hours. This is a costed decision in ADR-027.
- A restore is in place and the project is unavailable while it runs. It rewinds Storage metadata, the queue, the outbox, and Auth together with the academic data. The runbook pauses the worker, marks outbox rows older than the recovery point as suppressed pending review so that "result released" mail is not sent twice, reconciles bucket listings against `stored_files` to recover objects uploaded after the recovery point, and reviews sign-ins created in the lost interval.
- Monitor provider backup success and maintain schema/migration history independently.
- Run quarterly restore drills to an isolated project and validate row counts, decision chains, credit totals, RLS, and recent audit events.
- Proposed objectives: RPO 15 minutes and RTO 4 hours, pending plan verification and measured drills.

### Storage

Supabase states database backups do not include Storage objects. Replication of up to 2 TB a year cannot run inside a Vercel function, so an external scheduled runner, such as a CI schedule, copies new objects over the Storage S3 endpoint to a second bucket, retains the server-computed checksums, and is itself monitored. Test restoring objects plus metadata references. Storage RPO remains a management decision; no production launch occurs without an approved objective and a demonstrated recovery route.

### Incident degradation

- Email outage: keep in-app notification; queue email retry.
- Vercel worker or cron outage: academic commits continue and messages wait in the queue; exam finalisation and scheduled cycles continue on Supabase Cron.
- Supabase outage: fail writes closed; preserve local exam edits; show accurate unsaved state.
- Vercel outage: use independent status/communication channel; resume idempotently.
- Storage interruption: retry direct upload; do not accept submission metadata prematurely.
- Department integration fault: fail only the external request and protect interactive workloads.

Incident records include impact, data-integrity assessment, recovery evidence, communications, POPIA escalation decision, and corrective actions.

## POPIA and governance confirmations

Before production, confirm the responsible party/operator arrangements, lawful basis for each processing purpose, Department data-sharing agreement, data-subject access/correction process, retention/destruction schedule, cross-border hosting implications, breach response, administrator oversight, and whether integrity-event collection is proportionate. Data minimisation is enforced technically, but these governance decisions remain external to software architecture.

