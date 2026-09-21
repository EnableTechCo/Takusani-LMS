# ADR-022 Award credit per unit through a serialised learner-unit outcome

## Status

Proposed. Refines the award keying in ADR-016; the immutable decisions and append-only ledger of ADR-016 stand.

## Context

FR-801 awards credit per unit, while decisions are recorded per assessable item and a unit may require several items. Keying awards on the source decision breaks when one item counts towards two units. A partial unique index on "un-reversed" awards cannot exist, because reversal is a fact about another row and the ledger is never updated. Two required decisions for the same learner and unit releasing concurrently can each see the other as unreleased, so neither awards and no error is raised.

## Decision

`unit_assessment_requirements` lists the assessable items required per unit as a versioned set, frozen per cohort at activation. `learner_unit_outcomes` holds one mutable row per learner and unit with the derived unit outcome, award state, and a monotonic `award_seq`. Every release or supersession that touches a required item upserts and locks that row `FOR UPDATE`, re-evaluates the unit, and appends an `award` or `reversal` ledger entry when the award state changes. Ledger uniqueness is `(learner_id, unit_id, award_seq, entry_type)`. Each entry stores the contributing decision identifiers, the requirement-set version, and the credit value in force. A scheduled reconciliation compares ledger and rule and alerts on any difference. The derived unit outcome also serves "competency outcomes by unit" in the Department API.

## Alternatives considered

One award per Competent decision; serializable isolation for release transactions; computing credit totals only at read time.

## Positive consequences

Exactly one award per learner and unit under concurrency; multi-unit items work; every award is reconstructable for audit; the ledger stays append-only.

## Negative consequences

One more mutable projection row and a lock on every release; requirement sets need lifecycle management.

## Risks

A requirement set changed mid-cohort produces unequal awards. Mitigated by the per-cohort freeze; a change is a new version applied only by an audited re-evaluation.

## Revisit trigger

Policy confirms every unit has exactly one summative assessment, in which case the requirement set collapses to one row per unit and the mechanism is retained unchanged.
