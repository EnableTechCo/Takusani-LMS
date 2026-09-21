# LMS API Design

## Contract conventions

First-party browser commands are authenticated with the Supabase session cookie and protected against cross-site request forgery through same-site cookies, origin checks, and framework protections. The Department API uses a separate machine credential. JSON uses `snake_case`, identifiers are opaque UUIDs, and timestamps are RFC 3339 UTC.

### Two surfaces, one rule set

Route Handlers and Server Actions are the application's contract. The Supabase Data API is also reachable from every browser with the publishable key and the user's token, so it is treated as a public surface (ADR-024): only the read-oriented `api` schema is exposed, command functions live in unexposed schemas and run with the caller's session so the actor is always `auth.uid()`, and limits that protect the database are enforced inside the functions. A Route Handler adds validation, friendly errors, and coarse limits; it is never the only thing standing between a caller and an invariant.

### Idempotency

Every unsafe retriable command carries one permanent client-generated identifier in its body (`client_submission_id`, `client_attempt_id`, `client_appeal_id`, `command_id`). It is unique per actor and logical operation and is stored with the domain record, so a retry at any time returns the same resource and receipt. `Idempotency-Key` is accepted as an alias for the same value, not as a second mechanism; a request carrying both with different values is rejected with `422 idempotency_key_mismatch`. Server Actions pass the identifier as a field. Where no domain record can hold the identifier, an `idempotency_records` row is written inside the domain transaction and kept for 24 hours. A replay is semantically equivalent (same identifiers, state, and receipt), not byte-equivalent, because a response rebuilt after 24 hours reflects current state. Reuse with a different request digest returns `422 idempotency_key_reused`.

### Errors and status codes

```json
{
  "error": {
    "code": "lease_lost",
    "message": "This exam is being edited in another tab.",
    "request_id": "req_01J...",
    "retryable": false,
    "details": { "current_lease_acquired_at": "2026-09-18T09:20:11Z" }
  }
}
```

| Situation | Status |
|---|---|
| Malformed request | 400 |
| Unauthenticated | 401 |
| Authenticated but not permitted | 403 |
| Not visible within the caller's scope | 404 |
| Expected version, lease, or state no longer current; a retry with fresh state may succeed | 409 |
| Well-formed but the domain refuses it permanently (window closed, separation of duties, limit reached) | 422 |
| Throttled, with `Retry-After` | 429 |
| Temporary dependency failure | 503 |
| Repeat of a command that already succeeded | 200 with the original resource and receipt |

Workflow functions return a typed result that the handler maps to a status. They never raise after performing a terminal transition, because the error would roll the transition back.

## Identity and role administration

### `POST /api/admin/role-assignments`

- **Authentication:** System Administrator, or Coordinator within programme/cohort scope (FR-701).
- **Request:** user ID, role, scope type and key, effective range, `command_id`, expected version when changing or ending an assignment.
- **Validation:** ending or narrowing an assignment is rejected while the user holds an open allocation that depends on it (FR-105): `422 open_allocations` with `details.allocations[]`.
- **Transaction:** lock the user's `profiles` row; check overlap and open allocations; insert or end-date the assignment; append the audit event with previous value (FR-107).

Role assignments express capability scope. Separation of duties is enforced in the allocation commands below, where a conflict can actually arise (FR-104).

### Allocation and reallocation

`POST /api/assessment-instances/{id}/assessor`, `POST /api/moderation-sample-items/{id}/moderator`, and `POST /api/appeals/{id}/reviewer` allocate or reallocate. Each requires the target user to hold the role in a covering scope, locks the result, and rejects a moderator or reviewer who is the actor of any assessment-type decision on that result: `422 separation_of_duties_conflict` with `details.conflicts[]` naming the decision, the role, and the allocation (FR-104, FR-504, FR-608). Reviewer candidates are offered in the SRS AS-02 order.

### `POST /api/admin/accounts/{profile_id}/unlock`, `/password-reset`, and `/deactivate`

System Administrator with recent authentication. Unlock clears `sign_in_failures`; password reset triggers the Supabase Auth recovery flow; both notify the user and are audited (FR-106). Lockout blocks new password sign-ins only and expires by itself (ADR-026). Deactivation blocks existing sessions and is rejected while the user holds open allocations.

## Learner calendar feed

### `POST /api/calendar/feed-token` and `DELETE /api/calendar/feed-token`

Learner session. Issues, rotates, or revokes the single active 256-bit feed token. The secret is shown once and only its SHA-256 hash is stored.

### `GET /api/calendar/feeds/{feed_token}.ics`

- **Authentication:** the opaque token in the path, because calendar clients cannot present a session cookie (FR-304, ADR-020).
- **Response:** an iCalendar document of the owner's sessions, exam windows, and task due dates: title, start, end, and a deep link into the LMS. No results, marks, feedback, notices, other learners' data, or Teams join links.
- **Caching:** `Cache-Control: private, max-age=900` and `ETag`. Never a shared-cache directive, which would serve a revoked feed from the edge.
- **Rate:** 60/hour per token. Unknown tokens return 404 and count against a per-IP limit; known-revoked tokens return 404 without counting, because provider fetchers poll revoked URLs indefinitely from shared addresses.
- **Writes:** `last_used_at` is updated only when more than an hour stale.
- **Logging:** the token path segment is redacted in platform log drains, and this is tested.

## Coursework submission

### `POST /api/files/upload-authorisations`

- **Authentication:** interactive user session.
- **Authorization:** actor may upload to the declared material, submission, evidence, or administrative context.
- **Request:** context type/ID, original filename, declared media type, size, declared SHA-256, `client_upload_id`.
- **Response:** upload intent ID, immutable object key, resumable upload endpoint and signed upload token, intent expiry, maximum bytes.
- **Validation:** context-specific type/size policy, safe extension, no executable content, available submission state.
- **Rate:** 30/hour per user, enforced in the function; administrative bulk uploads use a separate command.

Uploads use the resumable (TUS) protocol with the signed upload token, because typical files exceed the size at which Supabase recommends resumable upload and NFR conditions include interrupted connections. A Supabase signed upload URL carries no per-URL size or type limit and outlives a short expiry, so the intent's expiry, checked at finalisation, is the control.

### `POST /api/files/{intent_id}/finalise`

Confirms the object exists under the intent's key, reads its actual size and type from Storage metadata, checks them against the intent and its expiry, and marks the intent finalised. It does not verify content: Storage exposes no content hash, so the declared checksum is recorded as declared and the authoritative SHA-256 and media-type detection come from the asynchronous scan step.

### `POST /api/submissions`

- **Authentication:** learner session.
- **Authorization:** active enrolment; published target task; submission window/policy permits the action.
- **Request:** `task_id`, finalised `upload_intent_ids[]`, `client_submission_id`, expected current submission version.
- **Response:** submission ID, new version, accepted timestamp, late flag, receipt ID, processing state.
- **Rate:** 10/minute per learner with a burst of 5.
- **Transaction:** lock the submission; calculate lateness and next version; consume finalised intents; insert the immutable version; open the assessment instance on the learner's result; append audit/outbox rows.

## Exams

### `POST /api/exams/{exam_id}/attempts`

- **Authentication:** learner session with recent authentication if policy requires.
- **Authorization:** enrolment, published exam, supported device, open window, attempt allowance.
- **Request:** `client_attempt_id` and browser capability summary; no client timer value.
- **Response:** attempt ID, `lease_id`, server time, `started_at`, `expires_at`, grace seconds, question manifest, integrity policy, and a notice when the window close shortens the attempt.
- **Rate:** burst 3 and 10/hour per learner/exam; synchronized starts across the institution are expected.
- **Transaction:** lock the enrolment row, not the exam; `INSERT ... ON CONFLICT` against the one-active-attempt index; snapshot `expires_at`, `accept_until`, and integrity configuration; append the audit event. A retry returns the existing attempt.

### `POST /api/exam-attempts/{attempt_id}/lease`

Owning learner. Rotates `lease_id` and returns it with all persisted answers and their `client_seq`. The token is kept in tab memory only. A refreshed or recovering tab calls this first, which fences any older tab.

### `PUT /api/exam-attempts/{attempt_id}/answers`

- **Request:** `lease_id` and `answers[]`, each with `question_id`, `client_seq`, and payload. The client sends every answer changed since the last acknowledged save, once per ten seconds with jitter, and the whole offline backlog in one request on reconnect.
- **Response:** per answer, persisted `client_seq` and timestamp; server time; `expires_at`.
- **Semantics:** per-answer last-writer-wins: an answer is kept only if its `client_seq` exceeds the stored one. There is no attempt-level version in autosave, so several edits in one interval cannot conflict with each other. A repeat of the same sequence is acknowledged without a write.
- **Errors:** `409 lease_lost` for a stale lease; a typed `closed` result with the receipt once the attempt is terminal or `accept_until` has passed.
- **Rate:** cadence is checked inside the function from the attempt's last-save time: nominal one request per ten seconds, short bursts allowed, sustained above one per second rejected. Batch size is bounded by the question count, so reconnect replay is never throttled. No global limit.
- **Cost:** exactly one database round trip; the session token is verified locally.

Local IndexedDB writes are not reported as saved to the server. The UI labels answers as local, persisted, or submitted/locked.

### `POST /api/exam-attempts/{attempt_id}/submit`

- **Request:** `lease_id`, final changed-answer batch, `client_submission_id`.
- **Response:** submitted timestamp, immutable receipt ID.
- **Semantics:** accepted until `accept_until`; answers received after `expires_at` are flagged as received in grace. The client begins its final flush a few seconds before expiry. Submitting an attempt that is already submitted or was auto-expired returns 200 with the original receipt.
- **Transaction:** lock attempt; persist the valid final batch; mark submitted; open the assessment instance on the learner's result; audit/outbox.

### `POST /api/exam-attempts/{attempt_id}/void`

Coordinator in scope, with a reason. Marks the attempt voided, retains it and its answers, restores one attempt allowance, and is audited. This is the remedy after a sustained outage; the timer itself is never paused.

### `POST /api/exam-attempts/{attempt_id}/integrity-events`

Batched, payload-capped, append-only. Never changes attempt state.

## Assessment

### `POST /api/assessment-instances/{id}/decisions`

- **Authentication:** the allocated assessor.
- **Request:** outcome, criterion scores, feedback, justification, remediation actions and resubmission period when NYC, expected instance version, `command_id`.
- **Response:** decision ID, result state (`held` or `released`), and when released, `released_at` and the appeal closing date.
- **Transaction:** take `FOR SHARE` on `cohort_moderation_state`; lock the result; validate marking; append the decision; move the current pointer. In a `moderated` cohort the result is held pending the next cycle. In a `not_moderated` cohort it is released: set `released_at`, `appeal_deadline_at`, and `release_seq`, resolve the remediation deadline, lock and re-evaluate `learner_unit_outcomes`, and append credit if the award state changes. Notifications, audit, and outbox in the same transaction.

A re-mark of a returned item uses the same route and supersedes the prior decision on a result that stays held.

### `POST /api/results/{result_id}/corrections`

Administrative correction of a released outcome. Requires two distinct authorised users (proposer and approver), appends a `correction` decision superseding the current one, re-evaluates credit, and notifies the learner.

## Moderation

| Route | Purpose | Notes |
|---|---|---|
| `POST /api/cohorts/{id}/moderation-policy` | Set or change `moderated` / `not_moderated` | Coordinator; versioned and audited; changing to `not_moderated` is rejected while results are pending or held |
| `POST /api/cohorts/{id}/moderation-cycles` | Plan a cycle with scope and optional scheduled start | Rejected if any item in scope is covered by another non-terminal cycle |
| `POST /api/moderation-cycles/{id}/cancel` | Cancel before freeze | Pending results stay pending |
| `POST /api/moderation-cycles/{id}/samples` | Freeze and sample | See below |
| `POST /api/moderation-sample-items/{id}/findings` | Record agreement or disagreement with reasons | Allocated moderator; append-only |
| `POST /api/moderation-sample-items/{id}/return` | Return for re-marking with corrections and deadline | Notifies assessor and coordinator (FR-509) |
| `POST /api/moderation-cycles/{id}/observations` | Cohort-level observations | FR-508 |
| `POST /api/moderation-cycles/{id}/sign-off` | Release the population | See below |

### `POST /api/moderation-cycles/{cycle_id}/samples`

- **Authentication:** Coordinator in scope. For a scheduled cycle Supabase Cron invokes the same function at the start time with a server-generated seed, so no human command is needed (FR-501); the two are idempotent against each other.
- **Request:** expected cycle version; optional supplied seed.
- **Response:** sample ID, population digest/count, seed, algorithm/rule version, strata counts, inclusion counts.
- **Transaction:** `FOR UPDATE` on `cohort_moderation_state` and the cycle; claim every pending held result in scope by setting `hold_cycle_id`; persist the immutable population and digest; select deterministically; allocate moderators with exclusions; persist sample/audit.

### `POST /api/moderation-cycles/{cycle_id}/sign-off`

- **Authentication:** a moderator with sign-off capability who took no assessment decision on any sampled result.
- **Request:** expected cycle version, sign-off statement.
- **Response:** signed-off timestamp, released result count, notification count. A signed-off cycle returns the original response.
- **Validation:** every sample item concluded; no return outstanding (FR-510), with the outstanding items listed in `details`.
- **Transaction:** `FOR UPDATE` on `cohort_moderation_state` and the cycle; lock the population's results in identifier order; release exactly that population with set-based statements; set appeal deadlines and `release_seq`; resolve remediation deadlines; re-evaluate affected `learner_unit_outcomes` and append credits; notifications, audit, and outbox. It runs over the SQL path with an explicit statement timeout rather than the Data API's default, and releasing 1,000 results within two seconds is a CI performance gate.

## Appeals

| Route | Purpose |
|---|---|
| `POST /api/appeals` | Lodge |
| `POST /api/appeals/{id}/admissibility` | Coordinator admits or records inadmissible with reason; notifies the learner (FR-605) |
| `POST /api/appeals/{id}/reviewer` | Allocate or reallocate the reviewer (above) |
| `POST /api/appeals/{id}/script-views` | Logs a granted script view (FR-606) |
| `POST /api/appeals/{id}/conclusion` | Reviewer records the outcome |

### `POST /api/appeals`

- **Request:** result ID, type (`view_script` or `remark`), grounds, `client_appeal_id`.
- **Response:** appeal ID, lodged timestamp, deadline snapshot, state, expected turnaround message.
- **Validation:** the result is released and belongs to the learner; `now()` is before the result's `appeal_deadline_at`, compared after locking the result; grounds present; the current decision is not an appeal decision; no admitted remark appeal exists for this result (FR-613).
- **Rate:** 10/day per learner.

### `POST /api/appeals/{id}/conclusion`

- **Authentication:** the allocated reviewer, re-checked inside the transaction against every assessment actor on the result.
- **Request:** outcome (`upheld`, `amended_up`, `amended_down`), reasons, remediation when the amended outcome is NYC, `command_id`.
- **Transaction:** lock the result; append the appeal decision superseding the current one; move the pointer and take a new `release_seq`; the amended result stays released and is never claimed by a moderation cycle; re-evaluate `learner_unit_outcomes` and append award or reversal; notify learner, assessors, and coordinator (FR-611).

## Department-facing API

### Authentication and scopes

`Authorization: Bearer <credential_id>.<secret>`. The secret is 256 random bits generated by the LMS. The server stores `HMAC-SHA-256(pepper, secret)` and compares in constant time. A password hash is the wrong primitive for a high-entropy secret and would let anyone who knows a credential ID burn server time before authentication. Failed authentication is limited per address and per credential ID in a bucket separate from the credential's success budget, so invalid requests cannot lock the Department out. Old and new credentials overlap during a controlled rotation window. Scopes are `learners:read`, `enrolments:read`, `results:read`, and `credits:read`, further restricted to the agreed programme/record set.

### Resources

| Route | Purpose |
|---|---|
| `GET /api/v1/changes?since_seq=&limit=` | Ordered feed of learner-record changes by `release_seq`; the way to discover what changed across learners |
| `GET /api/v1/learners?cursor=&limit=` | Learner identity and enrolment within scope |
| `GET /api/v1/learners/{id}` | One learner's identity and enrolments |
| `GET /api/v1/learners/{id}/results?cursor=` | Released results and competency outcomes by unit |
| `GET /api/v1/learners/{id}/credits?cursor=` | Credit ledger entries and totals |

Each collection is paginated separately with `limit` (default 50, maximum 200) and an opaque cursor. Ordering for change discovery is `release_seq`, assigned inside the release transaction, never the decision timestamp: a result decided on 1 September and released on 20 September would otherwise be invisible to a consumer polling from yesterday. `release_seq` values become visible in commit order, not numeric order, so consumers re-read with a documented overlap and de-duplicate by identifier. The public `updated_at` of a result is its `released_at` or supersession time.

Every resource reads a purpose-built released-record view whose shape cannot represent drafts, held results, notes, appeal deliberations, quiz data, or integrity events. Each request logs credential, route, normalized filters, scope decision, status, and returned record IDs.

- **Rate:** initial 60 requests/minute, burst 20 per credential; adjustable after observed traffic. 429 with `Retry-After`, limit, remaining, and reset headers.
- **Published contract:** an OpenAPI description versioned with the code and issued to the Department with the compatibility and deprecation policy (FR-1001, FR-1007). Contract tests validate every response against it.
- **Versioning:** additive changes remain in v1; breaking changes create `/api/v2`. The preceding version is maintained for a contractually published notice period, with `Deprecation` and `Sunset` headers and direct owner notification.

## Operational routes

- `GET /api/health/live` checks only process execution.
- `GET /api/health/ready` checks required configuration and a bounded database probe.
- `GET /api/internal/jobs/outbox-drain` is invoked by Vercel Cron, which issues GET, and authenticates with the cron secret. It reads a bounded batch with a visibility timeout, commits each message's delivery state before archiving it, and relies on visibility timeouts, not an advisory lock, to make overlapping or duplicate invocations harmless (ADR-025).
- `POST /api/providers/email/events` verifies provider signatures and updates delivery evidence idempotently.

Exam finalisation, scheduled cycle freeze, scheduled publication, intent expiry, purges, and credit reconciliation are database jobs on Supabase Cron and have no HTTP route.

## Database access choice

Routine reads use the Supabase client with the user's session against the `api` schema and RLS. Every audited write and every formal command calls a function in an unexposed module schema, which runs with the caller's session and takes the actor from `auth.uid()`. Direct PostgreSQL connections through the transaction-mode pooler, with prepared statements disabled, are reserved for migrations, maintenance, sign-off, and worker operations. Session-level state, including session advisory locks, does not survive that pooler and is not used. No browser receives privileged credentials.

## API observability

Every request receives a request ID propagated to structured logs, database audit/outbox events, queue messages, and provider calls. Metrics include rate, p50/p95/p99 latency, status class, validation failures, authorization denials, idempotent replays, lease losses, answers received in grace, rate-limit rejections, and Department records returned. Logs exclude tokens, feed-token paths, answer content, uploaded bodies, personal notes, and appeal deliberation.
