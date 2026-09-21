# ADR-019 Hold results by cohort moderation policy and moderate them in scoped cycles

## Status

Proposed. An earlier uncommitted draft of this record held results "from the planned cycle". The 18 September 2026 architecture review showed that draft failed open, so it was corrected before it entered the decision history.

## Context

BR-04 releases a result on the assessor's decision unless the cohort is under moderation, and FR-506 places the hold when a sample is generated. If the hold depends on a cycle row existing, a forgotten cycle, a late-planned cycle, or the gap between two cycles releases results unmoderated, and a released result cannot be recalled without breaching BR-03 and BR-05. A population that freezes once also strands every decision finalised after the freeze: it is held but can never be sampled.

## Decision

1. Every cohort carries a required, versioned, audited `moderation_policy` of `moderated` or `not_moderated`, set at cohort creation. It is stored on a `cohort_moderation_state` row that always exists, so there is always something to lock.
2. In a `moderated` cohort, finalisation always creates the result in `held` state. The result joins a pending pool (`hold_cycle_id` is null). In a `not_moderated` cohort, finalisation releases.
3. A moderation cycle has an explicit scope: a set of assessable items or units, optionally bounded by a period. At most one non-terminal cycle may cover any assessable item. At freeze the cycle claims every pending held result inside its scope; that set is the immutable population.
4. Sign-off releases exactly the frozen population. Results finalised after the freeze stay pending and are claimed by the next cycle. A cohort cannot be archived while any result is pending or held.
5. A cycle may be `cancelled` only before its freeze. A scheduled cycle freezes and samples automatically at its start time (FR-501); the manual command is idempotent against the scheduled run.
6. Lock order for every workflow function: `cohort_moderation_state`, then cycle, then result, then learner-unit outcome. Finalisation takes `FOR SHARE` on `cohort_moderation_state`; plan, freeze, sign-off, cancel, and policy change take `FOR UPDATE`.
7. Appeal and correction decisions release immediately and are never claimed by a cycle.
8. A remediation deadline is stored as a period and computed from `released_at`, as BR-05 does for the appeal window, so a hold delays the deadline rather than consuming it.

## Alternatives considered

Hold only from sample generation; hold from the existence of a planned cycle; sample and hold on every recorded decision; allow withdrawal of released results.

## Positive consequences

BR-04 cannot be bypassed by omission or timing; FR-503 holds for every NYC and first-time-assessor decision; populations are stable and reproducible; finalise cannot race freeze or sign-off.

## Negative consequences

Learners in a moderated cohort see no outcome, including NYC, until their cycle signs off; a moderated cohort needs a closing cycle before archival; changing a cohort's policy is a controlled, audited event.

## Risks

Long holds delay remediation. Mitigated by period-based deadlines, a held-result age dashboard, and an alert when any held result exceeds the configured maximum hold.

## Revisit trigger

The 90th-percentile age of held results exceeds the configured maximum hold in two consecutive cycles, or quality-assurance policy mandates per-decision sampling.
