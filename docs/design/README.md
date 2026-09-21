# LMS Architecture Documentation

## Design status

Status: **Proposed for architecture review, revised after independent review**  
Date: 18 September 2026 (first issued 16 September 2026)  
Scope: one in-house institution, approximately 1,000 registered learners

This package defines the production architecture for the Learning Management System before implementation. It is grounded in `LMS-SRS-v1.0.docx`, the supplied use-case catalogue, and the confirmed constraints in the architecture brief. It contains no application implementation, database migration, or infrastructure provisioning.

Since first issue the package has had a requirement-by-requirement coverage pass against the SRS and an independent software-architecture and backend review. The [fixes and decisions register](LMS-design-fixes-and-decisions.md) lists every finding, the decision taken, its status, and where it was applied.

## Recommended reading order

1. [System design](LMS-system-design.md) - decisions, flows, failure behaviour, and final recommendation.
2. [Fixes and decisions register](LMS-design-fixes-and-decisions.md) - what changed after review, which decisions are settled, and which await an owner.
3. [Architecture diagrams](LMS-architecture.html) - context, trust boundaries, workflows, and deployment. The diagrams predate the review; see the note below.
4. [Data model](LMS-data-model.md) - entities, constraints, state models, lock order, indexes, and row security.
5. [API design](LMS-api-design.md) - application and Department-facing contracts.
6. [Security and operations](LMS-security-and-operations.md) - access control, POPIA safeguards, deployment, observability, backup, and recovery.
7. [Capacity estimates](LMS-capacity-estimates.md) - formulas, baseline, sensitivity cases, and scaling triggers.
8. [Requirements traceability](LMS-requirements-traceability.md) - source conflicts and requirement-to-design coverage.
9. [Risk and test plan](LMS-risk-and-test-plan.md) - production risks, validation, load tests, and go-live gates.
10. [Architecture decisions](adrs/README.md) - the decision record set, ADR-001 to ADR-027.
11. [Architecture review, 18 September 2026](reviews/2026-09-18-architecture-review.md) - the merged findings as reported.
12. [UI design](ui/README.md) - UX architecture, design system, and static HTML prototypes of the 18 priority screens.

## Recommended architecture

The LMS is one Next.js App Router modular monolith deployed to Vercel. Supabase Auth establishes identity; Supabase PostgreSQL is authoritative for permissions, workflow state, exams, decisions, results, credits, audit data, and outbox records; private Supabase Storage holds file bodies. Academic changes are local PostgreSQL transactions in functions that live in unexposed schemas, run with the caller's session, and take locks in one fixed order. Asynchronous messages are enqueued inside the same transaction. Exam expiry and moderation schedules run in the database; a Vercel worker handles provider calls.

## Key assumptions

- The 1,000-learner target supersedes the earlier 100-learner estimate in the SRS.
- Baseline exam concurrency is 100; 250 is the temporary sensitivity scenario.
- Exam answers are written to IndexedDB immediately and autosaved to the server as one batch every 10 seconds with jitter.
- The seven-day appeal period means calendar days in `Africa/Johannesburg` until policy confirms otherwise; stored timestamps are UTC and the deadline is an exclusive instant at the start of the eighth local day.
- Every cohort is explicitly `moderated` or `not_moderated`; a moderated cohort holds every result until the cycle that sampled it signs off.
- The proposed recovery objectives are a four-hour RTO and a 15-minute database RPO, which requires the Supabase point-in-time recovery add-on and restore testing.
- Supabase has no African region; the database and the functions are co-located in a European region, which is a cross-border hosting decision under POPIA.
- Records retention is not yet approved. Capacity is shown for five- and seven-year scenarios, not as a policy decision.

## Outstanding decisions

The register is the authoritative list, with a recommendation and an owner for each. In summary:

| Area | Decisions awaiting an owner |
|---|---|
| Quality assurance | Moderation cycle scope; maximum hold; whether resubmissions are moderated; who may sign off |
| Academic policy | Appeal day convention; one remark per result; appeal downgrade to NYC; unit roll-up rule; reviewer fallback order; exam timing and grace; administrative correction |
| Management and operations | Supabase and Vercel plans; hosting region; availability target; Storage recovery objective |
| Information officer and legal | Records retention; cross-border hosting; Department data-sharing agreement |
| Department integration | Credential standard |

## Diagrams

`LMS-architecture.html` has not been redrawn since the review. It does not yet show the calendar-feed consumer, the `results` aggregate, the cohort moderation policy and pending pool, Supabase Cron, or in-transaction enqueue, and its exam panel predates the lease and grace window. Where a diagram and a document disagree, the document governs until the diagrams are reissued.

## Source priority and conflicts

The governing order is confirmed architecture constraints, SRS, use-case catalogue, then labelled assumptions. The traceability document records all known conflicts (CR-01 to CR-19), including deferred plagiarism checking, manual Teams attendance, logistics scope, differing learner counts, use-case identifiers referenced by the SRS but absent from the supplied catalogue, and the SRS ambiguities on release gating, unit credit, repeat appeals, and deadlines that the reviews exposed.

## Official technical references

- [Next.js backend-for-frontend guidance](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side)
- [Supabase Auth password verification hook](https://supabase.com/docs/guides/auth/auth-hooks/password-verification-hook)
- [Supabase database overview and backup boundaries](https://supabase.com/docs/guides/database/overview)
- [Supabase Queues](https://supabase.com/docs/guides/queues/quickstart)
- [Supabase private Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Vercel environments](https://vercel.com/docs/deployments/environments)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
