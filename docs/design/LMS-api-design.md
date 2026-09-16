# LMS API Design

## Contract conventions

First-party browser commands are authenticated with the Supabase session cookie and protected against cross-site request forgery through same-site cookies, origin checks, and framework protections. The Department API uses a separate machine credential. JSON uses `snake_case`, identifiers are opaque UUIDs, and timestamps are RFC 3339 UTC.

Unsafe retriable commands accept:

```http
Idempotency-Key: 86c3de13-752b-4f90-a610-1b8fa94390b8
```

The key is scoped to actor, route, and logical operation. The server stores a request digest and response for 24 hours when natural domain uniqueness is insufficient. Reuse with a different body returns `422 idempotency_key_reused`.

All errors use:

```json
{
  "error": {
    "code": "state_conflict",
    "message": "The exam attempt has already been submitted.",
    "request_id": "req_01J...",
    "retryable": false,
    "details": { "current_state": "submitted" }
  }
}
```

Common status codes are 400 validation, 401 unauthenticated, 403 unauthorized, 404 unavailable within the caller's scope, 409 version/state conflict, 422 valid syntax but invalid domain operation, 429 throttled with `Retry-After`, and 503 temporary dependency failure.

## Coursework submission

### `POST /api/submissions`

- **Authentication:** learner session.
- **Authorization:** active enrolment; published target task; submission window/policy permits the action.
- **Request:** `task_id`, `upload_intent_ids[]`, optional `client_submission_id`, expected current submission version.
- **Response:** submission ID, new version, accepted timestamp, late flag, receipt ID, processing state.
- **Validation:** every upload intent belongs to the actor/context, is unexpired/unconsumed, and matches accepted Storage metadata.
- **Idempotency:** `client_submission_id` unique per learner/task, plus `Idempotency-Key` response replay.
- **Rate:** 10/minute per learner with a burst of 5; ordinary resubmission is far below this.
- **Transaction:** lock learner/task submission; calculate lateness and next version; consume upload intents; insert immutable version; append audit/outbox rows.

```json
{
  "task_id": "tsk_...",
  "upload_intent_ids": ["upl_..."],
  "client_submission_id": "f289...",
  "expected_version": 1
}
```

## File upload authorisation

### `POST /api/files/upload-authorisations`

- **Authentication:** interactive user session.
- **Authorization:** actor may upload to the declared material, submission, evidence, or administrative context.
- **Request:** context type/ID, original filename, declared media type, size, checksum algorithm/value.
- **Response:** upload intent, immutable object key, signed upload URL, expiry, required headers, maximum bytes.
- **Validation:** context-specific type/size policy, safe extension, no executable content, available submission state.
- **Idempotency:** client upload ID unique within actor/context.
- **Rate:** 30 authorisations/hour per user with administrative bulk overrides through a separate command.
- **Transaction:** create the upload intent only; accepted academic metadata is written after Storage upload finalisation.

The browser uploads directly to private Supabase Storage. The application never returns a service credential. Supabase documents private bucket access controls and signed URLs at [Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## Exam start

### `POST /api/exams/{exam_id}/attempts`

- **Authentication:** learner session with recent authentication if policy requires.
- **Authorization:** enrolment, published exam, supported device, open window, attempt allowance.
- **Request:** client attempt ID and browser capability summary; no client timer value.
- **Response:** attempt ID, server time, `started_at`, `expires_at`, current version, question manifest, integrity policy.
- **Idempotency:** unique learner/exam/active attempt and client attempt ID; retries return the existing attempt.
- **Rate:** burst 3 and 10/hour per learner/exam; broad institution capacity must allow synchronized starts.
- **Transaction:** row-lock exam/enrolment; validate window/allowance; create or return attempt; append audit event.

## Exam autosave

### `PUT /api/exam-attempts/{attempt_id}/answers/{question_id}`

- **Authentication:** owning learner session.
- **Authorization:** active attempt, question belongs to published exam version.
- **Request:** answer payload, `expected_attempt_version`, client edit sequence, client-captured timestamp.
- **Response:** persisted answer version, new attempt version, persisted timestamp, server time, expiry.
- **Validation:** bounded payload; answer schema matches question type; server state is active and unexpired.
- **Idempotency:** same client edit sequence and payload returns the persisted result; stale expected version returns 409 with current version metadata.
- **Rate:** nominal one changed-answer request per 10 seconds; allow a burst of 10 and reject sustained frequency above one/second per attempt. No restrictive global limit.
- **Transaction:** lock attempt; enforce server expiry/version; upsert one answer; advance attempt version.

Local IndexedDB writes are not reported as saved to the server. The UI labels answers as local, persisted, or submitted/locked.

## Exam submission

### `POST /api/exam-attempts/{attempt_id}/submit`

- **Authentication:** owning learner session.
- **Request:** expected attempt version, final changed-answer batch, client submission ID.
- **Response:** submitted timestamp, immutable receipt ID, final persisted version.
- **Idempotency:** receipt and client submission ID return the same success on retry.
- **Errors:** 409 for version conflict with unpersisted changes; 422 when not active; an already submitted attempt returns its original receipt.
- **Rate:** burst 3 per attempt; institution-wide synchronized submissions are permitted.
- **Transaction:** lock attempt; enforce expiry; persist valid final batch; mark submitted; create assessment-queue item; audit/outbox.

## Assessment finalisation

### `POST /api/assessments/{assessment_id}/decisions`

- **Authentication:** assigned assessor.
- **Authorization:** active scoped assignment; actor is not acting as moderator for this assessment.
- **Request:** outcome, criterion scores, feedback, justification, remediation and deadline when NYC, expected assessment version.
- **Response:** immutable decision ID, state (`held` or `released`), release timestamp/appeal deadline when applicable.
- **Idempotency:** unique finalisation command ID and decision source version.
- **Transaction:** validate marking; append decision; set current pointer; hold/release; append credit if released; create notifications/audit/outbox.

## Moderation sample generation

### `POST /api/moderation-cycles/{cycle_id}/samples`

- **Authentication:** coordinator or authorized QA role.
- **Request:** expected cycle version; optional supplied seed or server-generated seed request.
- **Response:** sample ID, population digest/count, seed, algorithm/rule version, strata counts, inclusion counts.
- **Idempotency:** one active sample per frozen cycle; repeat returns it.
- **Rate:** one command per cycle; administrative limit 10/hour.
- **Transaction:** lock cycle; freeze eligible population; hold cohort results; select deterministically; validate moderator exclusions; persist sample/audit.

## Moderation sign-off

### `POST /api/moderation-cycles/{cycle_id}/sign-off`

- **Authentication:** assigned moderator with sign-off capability.
- **Request:** expected cycle version, sign-off statement.
- **Response:** signed-off timestamp, released result count, notification count.
- **Idempotency:** signed-off cycle returns the original result.
- **Validation:** all sampled items concluded; no returned item outstanding; actor independence satisfied.
- **Transaction:** close cycle, release results, set appeal deadlines, append credits, notifications, audit, and outbox.

## Appeal lodging

### `POST /api/appeals`

- **Authentication:** learner session.
- **Request:** released result ID, type (`view_script` or `remark`), grounds, client appeal ID.
- **Response:** appeal ID, lodged timestamp, deadline snapshot, state, expected turnaround message.
- **Idempotency:** unique client appeal ID plus partial uniqueness for an open type/result.
- **Validation:** released result belongs to learner; server time is within the release-based window; grounds required.
- **Rate:** 10/day per learner.
- **Transaction:** lock released result; calculate/validate deadline; append appeal and status event; notify coordinator/learner; audit/outbox.

## Department-facing API

### Authentication and scopes

Use `Authorization: Bearer <opaque-secret>`. Store only a modern password-hash of the secret with a public credential ID prefix. Permit overlapping old/new credentials during a controlled rotation window. Supported scopes are `learners:read`, `enrolments:read`, `results:read`, and `credits:read`; credentials are further restricted to the agreed programme/record set.

### `GET /api/v1/learners/{learner_id}/records`

Query parameters: `include=enrolments,results,credits`, `updated_after`, `limit` (default 50, maximum 200), and opaque `cursor` ordered by `(updated_at, id)`.

```json
{
  "data": {
    "learner": { "id": "lrn_...", "department_reference": "..." },
    "enrolments": [],
    "released_results": [],
    "credits": []
  },
  "next_cursor": null,
  "request_id": "req_..."
}
```

The query reads a purpose-built released-record view. The shape cannot represent drafts, held results, notes, appeal deliberations, or integrity events. Each request logs credential, route, normalized filters, purpose/scope decision, status, and returned record IDs.

- **Rate:** initial 60 requests/minute, burst 20 per credential; adjustable after observed traffic.
- **Throttling response:** 429 with `Retry-After`, limit, remaining, and reset headers.
- **Versioning:** additive changes remain in v1; breaking changes create `/api/v2`. Maintain the preceding version for a contractually published notice period.
- **Deprecation:** `Deprecation` and `Sunset` headers plus direct owner notification.

## Additional operational routes

- `GET /api/health/live` checks only process execution.
- `GET /api/health/ready` checks required configuration and a bounded database probe.
- `POST /api/internal/jobs/outbox-drain` accepts only authenticated scheduler calls, acquires a transaction-scoped advisory lock, and processes a bounded batch.
- `POST /api/providers/email/events` verifies provider signatures and updates delivery evidence idempotently.
- `POST /api/files/{intent_id}/finalise` confirms Storage metadata/checksum and marks an upload eligible for domain submission.

## Database access choice

Routine reads and simple writes use the Supabase JavaScript client with the user's session and RLS. Formal commands call narrowly granted PostgreSQL functions. Direct PostgreSQL connections are reserved for migrations, maintenance, and worker operations needing transaction control, using the provider pooler appropriate for serverless traffic. No browser receives privileged credentials.

## API observability

Every request receives a request ID propagated to structured logs, database audit/outbox events, queue messages, and provider calls. Metrics include rate, p50/p95/p99 latency, status class, validation failures, authorization denials, idempotency replays/conflicts, autosave version conflicts, rate-limit rejections, and Department records returned. Logs exclude tokens, answer content, uploaded bodies, personal notes, and appeal deliberation.

