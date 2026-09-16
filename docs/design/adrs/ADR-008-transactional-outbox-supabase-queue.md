# ADR-008 Use a transactional outbox and Supabase Queue

## Status

Proposed

## Context

Academic commits must not wait for email, reports, imports, or external retries. Lost or duplicated background work must be visible and recoverable.

## Decision

Insert an outbox row in the academic transaction, dispatch durable messages to Supabase Queue, and process them with bounded idempotent Vercel workers.

## Alternatives considered

Send email inline; poll domain tables without outbox; introduce a separate broker platform.

## Positive consequences

No dual-write gap, failure isolation, durable backlog, retry visibility, and low operational overhead.

## Negative consequences

At-least-once processing requires deduplication and monitoring; delivery is eventually consistent.

## Risks

Dispatcher or worker stalls may hide in queue age if alerts are absent.

## Revisit trigger

Adopt a different workflow engine only when multi-step, long-running orchestration with compensation becomes common and cannot be represented safely as explicit states and jobs.

