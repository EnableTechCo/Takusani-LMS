# Architecture Review, 18 September 2026

Two independent read-only reviews of the design package on branch `docs/srs-coverage-gaps`: a software-architecture review (fit, module boundaries, workflow state machines, ADR and cross-document consistency) and a backend review (schema, concurrency, Supabase/Vercel platform behaviour, API, async, capacity). This file merges them. Findings marked **V** were verified against the design text or official platform documentation by the reviewer; **I** marks an inference from platform knowledge that still needs a spike.

## Verdict

Both reviewers endorse the architectural style: one Next.js modular monolith, PostgreSQL as the single consistency boundary, functions for critical transitions, append-only history. Neither would reopen ADR-001, 003, 010, 011, or 017. The capacity arithmetic is correct.

The package is not ready for the core workflow to be implemented. Several stated mechanisms cannot work as written on the chosen platform, and the assessment, moderation, release, appeal, and credit lifecycle has concurrency holes that produce wrong academic outcomes rather than errors.

**Can start now:** authentication and RLS scaffolding, direct uploads, the exam-persistence spike, the platform spikes listed at the end.
**Must wait:** the finalise, sign-off, appeal-conclusion, and credit functions, until groups A to D below are resolved in the documents and a written state-transition table with a lock order exists.

## A. Moderation hold and release (Critical)

| # | Finding | Status |
|---|---|---|
| A1 | A decision finalised after the population freeze is held against the cycle but is not in its population. At sign-off it is either released without ever being sample-eligible, breaching FR-503 for NYC and first-time-assessor decisions, or stays held for ever. An assessor can avoid moderation by finalising after the freeze. | V |
| A2 | A moderation cycle has no scope (task, unit, or period) and nothing says which cycle a decision joins when two are open. | V |
| A3 | ADR-019 fails open: results are held only if someone created a planned cycle. A forgotten cycle, a late-planned cycle, or the gap between two cycles releases results unmoderated, and release is irreversible. The warning goes to the assessor, who cannot plan a cycle. | V |
| A4 | No `cancelled` cycle state, so a cycle planned on the wrong cohort can only be cleared by signing off an empty cycle. | V |
| A5 | No lock order exists although ADR-006 claims one. Finalise can race sign-off, freeze, or plan: a decision ends up held under a signed-off cycle, held outside the population digest, or released when it should have been held. | V |
| A6 | A hold hides an NYC outcome while the learner's absolute resubmission deadline runs, and can outlast it. | V |

**Recommended resolution.** Make `moderated` / `not_moderated` a required, audited attribute of the cohort set at creation. In a moderated cohort finalisation always holds; the decision attaches to the open cycle or to a pending marker, and the next cycle consumes pending decisions at freeze. Give cycles an explicit scope with at most one non-terminal cycle covering any assessment. Sign-off releases exactly the frozen population. Add `cancelled` (pre-freeze only). Define one lock hierarchy: cohort moderation state, then result or instance, then learner-unit credit status; finalise takes `FOR SHARE` on a cohort moderation-state row that always exists, while plan, freeze, sign-off, and cancel take `FOR UPDATE`. Store remediation as a duration and compute the deadline at release, as BR-05 does for appeals. Alert on "held result whose cycle is terminal" and make it an archival precondition. Supersede ADR-019.

## B. The result entity (High)

| # | Finding | Status |
|---|---|---|
| B1 | The thing that is held, released, and appealed is never defined. It appears as `results`, `released_results`, "released result", and `released_record_view`, and is in no entity catalogue. `decisions` is append-only, so `released_at`, the hold reference, and the appeal deadline have nowhere to live. | V |
| B2 | The "Assessment" state row mixes instance states with a decision property, and has no transition for held, returned, re-marked, held again, or for released to under appeal. Resubmissions create new instances, so NYC and the later Competent are not one chain and "current result for learner and task" is undefined. | V / I |
| B3 | Append-only enforcement is left as "a trigger or revoked privileges". Revocation does not bind `service_role` or `SECURITY DEFINER` functions, which are exactly the paths that write these tables. | V / I |

**Recommended resolution.** Add a `results` aggregate: one row per learner and assessable item with current decision pointer, state, nullable hold cycle, `released_at`, appeal-deadline snapshot, `release_seq`, and version. It is insert-only except for one `held` to `released` transition enforced by trigger. Split the state table into three machines: instance, result, decision chain. For append-only tables use both revocation and `BEFORE UPDATE OR DELETE OR TRUNCATE` triggers. Add `UNIQUE (supersedes_decision_id)` to prevent forked chains and a composite foreign key so the current pointer must belong to the same instance.

## C. Credits (High)

| # | Finding | Status |
|---|---|---|
| C1 | The partial unique index "for un-reversed award entries" is unimplementable: an index predicate sees only its own row, and marking an award as reversed means updating an append-only table. | V |
| C2 | `UNIQUE (source_decision_id, entry_type)` breaks if one task counts towards two units; the violation would abort the release, potentially a whole 1,000-result sign-off. | V |
| C3 | Write skew: two required decisions for the same learner and unit releasing concurrently each see the other as unreleased, both skip the award, and the learner never gets credit. No error is raised. | V |
| C4 | `unit_assessment_requirements` is unversioned and not frozen per cohort; the ledger records one source decision, not the set that justified the award, so awards cannot be reconstructed after a requirement change. | V |
| C5 | ADR-016 and the "Allocate credits" transaction still describe per-decision award; the roll-up has no ADR. | V |

**Recommended resolution.** Add a small mutable `learner_unit_outcomes (learner_id, unit_id)` row taken `FOR UPDATE` before evaluating the roll-up, holding current award state and a monotonic `award_seq`. Ledger uniqueness becomes `(learner_id, unit_id, award_seq, entry_type)`. Store contributing decision IDs and the requirement-set version on each entry. Freeze the requirement set per cohort at activation. Add a reconciliation job and a concurrent-release test. Write the ADR and supersede ADR-016's wording.

## D. Exam path (Critical / High)

| # | Finding | Status |
|---|---|---|
| D1 | **Lockout ends exams.** The lock blocks commands on existing sessions and only an administrator clears it. Failed sign-ins are unauthenticated, so anyone who knows a learner's email can lock them out mid-exam while the timer keeps running. | V |
| D2 | The Supabase password verification hook is available on Team and Enterprise plans only, not Pro. The server-mediated fallback does not count direct calls to the Auth endpoint, so it locks honest users and never the attacker. | V / I |
| D3 | No grace window at expiry: the final flush at timer zero always arrives after `expires_at` and is rejected, losing up to ten seconds of answers for learners who used the full time. | V |
| D4 | A function that finalises expiry and then raises an error to produce the 4xx rolls back the finalisation, receipt, and outbox. Submit after scheduler auto-expiry returns 422 rather than the receipt. | V / I |
| D5 | Autosave is one PUT per question, each carrying and advancing an attempt-level version, so three changed answers in one tick means three round trips or two false 409s. System design says "changed answers" (a batch). Reconnect replay of offline edits is throttled by the route's own limit. Capacity assumes one write per tick. | V |
| D6 | The editing lease is one sentence and one column: no request field, no acquire, takeover, or expiry. The crash-recovery tab has no lease and by the written rule cannot write. | V |
| D7 | Locking the `exams` row at start serialises 250 synchronized starts for no benefit. | V |
| D8 | No command exists for the "audited coordinator extension" the design relies on, and the learner who needs it after a sustained outage has already been auto-submitted. | V |

**Recommended resolution.** Lockout applies to new password sign-ins only, never invalidates an existing session, exempts exam commands, and self-expires (15 to 30 minutes) as well as being cleared by an administrator or by email recovery. Either budget for the Team plan, or record in an ADR that on Pro the FR-106 control is honest-client lockout plus per-IP limits plus CAPTCHA, with the residual risk stated. Define `accept_until = expires_at + grace` snapshotted on the attempt; the scheduler finalises on `accept_until`; the client starts its final flush a few seconds early. Functions return a typed result and never raise after a terminal transition. One batch route `PUT /api/exam-attempts/{id}/answers` with `{lease_id, answers[{question_id, client_seq, payload}]}`, per-answer last-writer-wins on `client_seq`, the lease as a fencing token held in tab memory, and the attempt version kept only for state transitions. Lock the enrolment row, not the exam. Add an audited "void attempt and grant a new attempt" command that retains the old attempt.

## E. Data API exposure and actor identity (Critical)

Every browser holds a publishable key and a user JWT and can call `/rest/v1/*` and `/rest/v1/rpc/*` directly, bypassing application authorization, Route Handler limits, and validation. The design does not say whether critical functions run under the user JWT or the service role, what grants apply, or which schemas are exposed. Default privileges make new functions executable by `anon` and `authenticated`. RLS filters rows, not columns, so quiz and exam answer keys on a learner-readable `questions` table are readable, and a quiz score written through "simple writes via RLS" is forgeable. **V / I**

**Recommended resolution.** User-initiated commands run with the user JWT and the actor is always `auth.uid()`, never a parameter. Worker functions are granted to `service_role` only. Command functions and key-bearing tables live in a schema PostgREST does not expose. Revoke default execute privileges. `SECURITY DEFINER` functions use `SET search_path = ''`. A CI test enumerates table and function privileges for `anon` and `authenticated`. Answer keys move to a table with no learner policy. Cadence and rate limits are enforced inside the functions. One SQL schema per module, with cross-module effects only through the callee's published functions, and a pgTAP harness as a deliverable before any workflow function.

## F. Async, scheduling, and recovery (High / Medium)

| # | Finding | Status |
|---|---|---|
| F1 | The outbox to queue "post-commit dispatcher" is undefined. If it is application code after the RPC returns, a timeout after commit leaves rows never enqueued while the queue-age alert stays green. The hop is unnecessary: pgmq is in the same database, so "queue outage" is not a distinct failure mode. | V |
| F2 | A transaction-scoped advisory lock cannot cover a batch that commits per message, and holding one transaction open across email calls rolls back delivery state for mail already sent. Session locks do not survive the transaction-mode pooler. | V |
| F3 | Vercel Cron issues GET, not POST; supplies no scheduled instant for `(job_name, scheduled_at)`; is best-effort with no retry; and per-minute schedules need the Pro plan. No document names the Vercel plan. | V |
| F4 | A 15-minute RPO requires the PITR add-on and at least Small compute. Restore is in place: it rewinds Storage metadata (orphaning newer objects), pgmq, the outbox (re-sending "result released" mail), and Auth. | V / I |
| F5 | Replicating 0.1 to 2 TB a year of Storage cannot run in a Vercel function and the architecture has no other compute. | V |
| F6 | Region is never decided. Supabase has no African region; functions near users with the database in Europe pay roughly 160 to 180 ms per sequential database call, which alone consumes the 500 ms autosave p95. | V / I |
| F7 | Sign-off of 1,000 results runs under PostgREST's 8-second statement timeout. | V |
| F8 | Rate-limit time-bucket tables are never purged. | V |

**Recommended resolution.** Either call `pgmq.send()` inside the domain transaction and keep the outbox as the delivery ledger, or drop pgmq and claim outbox rows with `SKIP LOCKED`. Alert on the oldest undelivered outbox row. Require a provider idempotency key. Remove the advisory lock and clock-keyed run uniqueness from drain jobs. Move pure-database jobs (exam expiry, scheduled cycle start, purges) to Supabase Cron so they do not depend on Vercel. Write ADRs for the Supabase plan, the Vercel plan, and the region; pin the function region to the database region; make autosave exactly one database round trip with local JWT verification. Set-based sign-off with deterministic lock order over a path with an explicit timeout, gated in CI. A restore runbook that pauses the worker and suppresses pre-recovery-point outbox rows. Name an external runner for Storage replication.

## G. API and integration (High / Medium)

| # | Finding | Status |
|---|---|---|
| G1 | Department cursor on `(updated_at, id)` permanently misses results that move from held to released, because the decision keeps its original timestamp. One cursor pages three nested arrays. There is no way to discover changes across learners. | V |
| G2 | A password hash on every Department request is the wrong primitive for a high-entropy secret, and with a fail-closed per-credential limiter lets anyone who knows the public prefix lock the Department out. | V |
| G3 | Signed upload URLs are valid for two hours with no per-URL size or type constraint. The client checksum cannot be verified at finalise because Storage exposes no content hash. Plain signed PUT is not resumable; TUS is recommended above 6 MB. | V / I |
| G4 | Calendar feed: the token in the path is recorded by platform request logs; caching is unspecified; counting 404s from revoked tokens against a fail-closed IP limit can throttle every Google Calendar subscriber; per-poll writes make the feed the largest steady write source. | V / I |
| G5 | Appeal deadline is ambiguous between an instant and the end of a calendar date; the UI shows a date. | V |
| G6 | Two overlapping idempotency mechanisms per route; "byte-equivalent" replay cannot hold after 24 hours; the record must be written inside the domain transaction; Server Actions cannot carry the header; error codes disagree. | V |
| G7 | No API contract for planning a cycle, concluding an appeal, returning an item, recording a finding, or admitting and allocating an appeal. | V |

**Recommended resolution.** A `release_seq` assigned at release and a `GET /api/v1/changes?since_seq=` endpoint; separately paginated sub-collections; `released_at` as the public timestamp. A 256-bit secret stored as `HMAC-SHA-256(pepper, secret)` with separate failed-auth and authenticated limiters. TUS with the signed upload token; intent expiry as the real control; size read from `storage.objects`; authoritative SHA-256 computed server-side in the scan step. `Cache-Control: private`; exclude known-revoked hashes from the IP counter; update `last_used_at` only when stale; redact the token in log drains. Define the deadline as the start of the eighth local day, exclusive, snapshotted at release. One idempotency mechanism per route with semantic equivalence.

## H. Appeals and assignments (High / Medium)

| # | Finding | Status |
|---|---|---|
| H1 | Uniqueness covers only open appeals, so a learner can lodge a second remark after the first concludes and still inside the window: a de facto second level of appeal, forbidden by FR-613. | V |
| H2 | "Original assessor" is unanchored. `assigned_assessor` is a mutable pointer, and after a re-mark or resubmission several people have assessed the work. | V |
| H3 | Whether an appeal outcome bypasses a later planned hold, and whether a downgrade to NYC reopens remediation, is unstated. | V |
| H4 | The module call graph has cycles and omits edges the text requires (Assessment to Credits, Appeals to Moderation for FR-609). | V |
| H5 | Per-item assignment lives in up to four places (`role_assignments`, `assigned_assessor`, `allocated_moderator`, `appeals.reviewer`); drift becomes an authorization bug. No transition reallocates a moderator, assessor, or reviewer, so deactivating an allocated moderator blocks sign-off for ever. | V / I |
| H6 | `role_assignments` "unique active assignment" over an effective range needs an exclusion constraint, not a partial index. Locking "the user's assignments" cannot lock rows that do not exist; two concurrent first assignments both pass. The quiz attempt limit cannot be a CHECK that reads another table. `not_started` is never created. | V |

**Recommended resolution.** One remark appeal per result, ever. Exclusion is "any actor of an assessment-type decision on this learner and item", computed from `decisions`. Appeal outcomes release immediately and bypass the hold. Keep `role_assignments` for capability scope only; per-item allocation lives in its aggregate and RLS helpers read that. Enforce FR-104 in the allocation commands. Add reallocation transitions and block deactivation of a user with open allocations. Lock the profile row for assignment changes. Make the module graph acyclic.

## I. Documentation quality (Medium / Low)

- CR-07 still says "cycle after eligible decisions exist" and contradicts CR-09 and ADR-019.
- The population freeze is described three ways across the documents; "active" and "opened" are not cycle states; the cycle sequence has no `in_review` to `signed_off` path.
- Upload finalisation is one step in two documents and two steps in the API.
- Scope types differ between the system design (`task`, no `global`) and the data model.
- The traceability BR-04 row says only sign-off releases; finalise and appeal conclusion also release.
- The 100 FR rows are identical within each group and cite test IDs defined nowhere. Only the "Requirement-specific coverage" rows carry evidence. The self-awarded 33/35 score should be removed.
- The ADR index says every revisit trigger is measurable; those in ADR-001, 002, 004, 005, 006, 012, 013, 016, and 018 are not.
- Decisions with no ADR: exam persistence protocol, timer during disconnection, unit roll-up, lockout, audit capture, scheduler choice, platform plans, region.
- Audit event volume is understated roughly fivefold given "every transition emits an audit event".

## Open questions for policy owners

1. What does a moderation cycle cover: whole cohort, per task or unit, or a period? What is the longest acceptable hold before a learner sees an outcome, especially NYC?
2. Must resubmission decisions (NYC to Competent) be moderated, and by which cycle?
3. Can one task evidence more than one unit? Can unit requirements change during a cohort?
4. After an appeal downgrades a result to NYC, does the learner get remediation and resubmission?
5. Is one remark per result the rule? Does a view-script request consume the seven-day window?
6. Who may sign off a cohort, and can a moderator who assessed some of its items do so?
7. After a sustained outage leads to auto-submit, is a fresh attempt permitted, and who authorises it?
8. Is there an administrative route to correct a wrongly released decision other than a learner appeal?
9. Does an exam started near the window close expire at start plus duration, or at window close?
10. Which Supabase plan (Pro with PITR, or Team) and which Vercel plan, and in which region?

## Platform spikes before build

1. Function exposure: create functions in `public` and a private schema, call both from a browser with only the publishable key and a learner JWT, and confirm the revoke recipe.
2. `pgmq.send()` inside a domain function with a forced rollback: confirm the message disappears atomically.
3. One-RPC autosave pinned to the database region, 250-client load test from a South African client; repeat with the function in Cape Town.
4. Set-based release of 1,000 results through PostgREST against the 8-second timeout.
5. 25 MB TUS upload with a signed token on an interrupted connection; record which integrity fields `storage.objects` exposes.
6. PITR restore of a throwaway project to ten minutes ago after uploads and queue sends; observe Storage metadata, pgmq, Auth, and downtime.
7. Per-minute Vercel Cron for 48 hours, logging missed and duplicate runs, against a pg_cron job doing the same sweep.

## Worth protecting

- PostgreSQL as the single consistency boundary; email cannot roll back an academic commit.
- Server-authoritative exam time, enforced on every command and not only by the scheduler.
- Structural, not procedural, exclusion of notes, quizzes, and integrity events; the Department reads only a purpose-built view.
- Reproducible sampling: frozen population, seed, rule and algorithm version, digest, first-time-assessor snapshot.
- An unusually concrete test plan, and a conflict register that records interpretive choices openly.
