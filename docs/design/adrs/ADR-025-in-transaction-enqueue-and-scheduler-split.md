# ADR-025 Enqueue inside the domain transaction and split scheduling between the database and Vercel

## Status

Proposed. Refines ADR-008: the transactional outbox stands; the separate post-commit dispatcher is removed.

## Context

Supabase Queue is backed by the same PostgreSQL database as the outbox, so a "post-commit dispatcher" between them added a loss window and no isolation: a timeout after commit left outbox rows never enqueued while queue-age alerts stayed green. A transaction-scoped advisory lock cannot span a batch that commits per message, and session locks do not survive the transaction-mode pooler. Vercel Cron issues GET requests, is best effort with no retry, supplies no scheduled instant, and needs a paid plan for per-minute schedules. Exam expiry and scheduled moderation cycles are pure database work that should not depend on Vercel being reachable.

## Decision

1. The domain function inserts the outbox row and calls the queue send in the same transaction. `outbox_messages` and `notification_deliveries` remain the deduplication and delivery ledger.
2. Pure-database schedules run on Supabase Cron: exam finalisation at `accept_until`, scheduled cycle freeze, scheduled publication, expiry of upload intents, purging of idempotency and rate-bucket rows, and credit reconciliation.
3. Work that calls external providers runs in a Vercel worker invoked by Vercel Cron with GET and the cron secret. Overlap is made harmless by queue visibility timeouts, not by an advisory lock. Each message's delivery state commits before the message is archived.
4. One-shot jobs are made unique by their domain object, for example the cycle identifier, never by clock time.
5. Poison messages are retired by the queue's read count, not an application counter. Email sends carry a provider idempotency key derived from the outbox deduplication key; support for such a key is a provider selection criterion.
6. Alerts watch the oldest undelivered outbox row as well as queue age.

## Alternatives considered

Keep a dispatcher and add a sweeper; drop the queue and claim outbox rows with `SKIP LOCKED`; run every schedule on Vercel Cron.

## Positive consequences

No committed event can be lost before enqueue; expiry and cycle schedules survive a Vercel outage; duplicate or missed cron deliveries are harmless.

## Negative consequences

Two schedulers to observe; the queue send inside the transaction couples domain functions to the queue extension.

## Risks

Supabase Cron jobs fail silently. Mitigated by `scheduled_runs` heartbeats and the "expired active exam" and "unfrozen due cycle" alerts.

## Revisit trigger

Queue send inside a transaction measurably extends critical-function latency beyond its budget, or the platform spike shows rollback does not remove the message.
