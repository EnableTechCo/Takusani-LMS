# ADR-021 Model the result as a first-class aggregate with a release sequence

## Status

Proposed

## Context

BR-04, BR-05, FR-316, FR-804, the appeal workflow, the credit rule, and the Department view all act on "the result", but the design named it four ways and defined it nowhere. `decisions` is append-only, so release time, hold reference, and appeal deadline cannot live there. The Department cursor ordered by decision time would permanently miss a result that moves from held to released weeks after it was decided.

## Decision

Add `results`: one row per learner and assessable item. It carries the current decision pointer, state (`held`, `released`), nullable `hold_cycle_id`, `released_at`, `appeal_deadline_at`, `release_seq`, and a version. Every assessment instance for that learner and item, including resubmissions, points at the same result, so the current outcome is always one lookup. The row is written only by workflow functions. The `held` to `released` transition happens once and sets `released_at`, `appeal_deadline_at`, and `release_seq` together; a trigger rejects any other change to those columns. A later superseding decision moves the current pointer and takes a new `release_seq`. `release_seq` is drawn from a sequence inside the release transaction and is the ordering key for every external change feed.

## Alternatives considered

Release columns on `decisions`; an append-only `result_releases` table with a derived current view; leaving the result implicit in each function.

## Positive consequences

One definition for hold, release, appeal, and credit; one place to lock; external consumers cannot miss late releases; the three state machines (instance, result, decision chain) separate cleanly.

## Negative consequences

One deliberately mutable row in an otherwise append-only area; it must be protected by trigger and privilege rather than convention.

## Risks

The pointer drifts from the decision chain. Mitigated by a composite foreign key tying the pointer to the same result, `UNIQUE (supersedes_decision_id)` to prevent forked chains, and a reconciliation query in the restore drill.

## Revisit trigger

An audit finding requires full release history per result beyond what `decisions`, `audit_events`, and `release_seq` reconstruct.
