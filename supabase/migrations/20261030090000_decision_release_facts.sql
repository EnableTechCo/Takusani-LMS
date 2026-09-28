-- Correcting the S4-11 account of release facts (20261029090000).
--
-- That migration said results.released_at is the result's first release and is written once. It is not: since S2-08
-- (20261001090000) the release guard moves released_at, release_seq, the appeal deadline and the resubmission deadline
-- to now() whenever a released result's current decision changes. So the result's release facts are always those of
-- the decision the learner is reading, with its own seven-day appeal window (FR-601, FR-511; product owner,
-- 28 Sep 2026), and the learner's result views were already right.
--
-- What the result cannot keep is the release of a decision that was later replaced. That is what
-- assessment.decision_releases is for, and its trigger records it correctly. The derivation written for its backfill
-- assumed the wrong model, though: for a chain with more than one released decision it gave the earlier ones the
-- later release time. The backfill ran with nothing to backfill on every environment (staging had no decisions), so
-- no row is wrong; the function is dropped so it is not reused.

comment on table assessment.decision_releases is
  'When each decision reached its learner. The result''s released_at and release_seq are those of its current '
  'decision (the release guard moves them when the current decision changes); this keeps the release of every '
  'decision, including ones later replaced. Written by results_record_decision_release; append-only.';

drop function assessment.derived_decision_releases();
