# ADR-023 Exam persistence protocol: batched sequenced autosave, fenced lease, and acceptance window

## Status

Proposed

## Context

NFR-07 requires an attempt to survive refresh, crash, and intermittent loss. The earlier contract sent one request per question against a single attempt version, so several edits in one interval produced false conflicts; the editing lease had no protocol; the recovery tab could not write; and a final save sent when the timer reached zero always arrived after `expires_at` and was rejected, losing the last seconds of work for learners who used the full time. A function that finalised expiry and then raised an error rolled its own finalisation back.

## Decision

1. Autosave is one batch request per interval carrying every changed answer, each with a per-question `client_seq`. The server keeps an answer only if its sequence is higher than the stored one. No attempt-level version is involved in autosave; the attempt version guards state transitions only.
2. The editing lease is a fencing token. Acquiring the lease rotates `lease_id` on the attempt; the token is held in tab memory, never in IndexedDB, which tabs share. A request with a stale lease gets `409 lease_lost`. A recovering tab acquires a new lease, which fences the old tab.
3. Each attempt snapshots `expires_at` and `accept_until = expires_at + grace`. The timer shown to the learner ends at `expires_at`. Saves and the final submit are accepted until `accept_until`, and answers received inside the grace window are flagged. Scheduled finalisation acts on `accept_until`. The client begins its final flush a few seconds before expiry.
4. `expires_at` is the earlier of start plus duration and the exam window close. The start response states this when the window shortens the attempt.
5. The timer is not paused by disconnection (CR-11). After a sustained outage a coordinator may void the attempt and grant a new one; the voided attempt and its answers are retained.
6. Workflow functions return a typed result and never raise after performing a terminal transition. Submit on an already submitted or expired attempt returns the original receipt.
7. Each autosave is exactly one database round trip: one function checks state, lease, cadence, and acceptance window, and upserts the batch.

## Alternatives considered

Per-question requests with an attempt version; pausing the timer on disconnect; a client-side expiry cut-off with no grace; a lease stored in IndexedDB.

## Positive consequences

No false conflicts; offline replay is one request; no work lost at expiry; crash recovery has a defined path; write volume matches the capacity estimate.

## Negative consequences

Per-answer last-writer-wins gives up cross-answer atomicity, which an exam does not need; the grace window is a policy value to agree and explain.

## Risks

A long grace window becomes extra time. Mitigated by a short configured value, flagging, and the visible timer ending at `expires_at`.

## Revisit trigger

Autosave p95 exceeds 500 ms at 250 attempts, or acknowledged-answer loss is observed in any exam recovery test.
