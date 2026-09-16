# LMS Architecture Documentation

## Design status

Status: **Proposed for architecture review**  
Date: 16 September 2026  
Scope: one in-house institution, approximately 1,000 registered learners

This package defines the production architecture for the Learning Management System before implementation. It is grounded in `LMS-SRS-v1.0.docx`, the supplied use-case catalogue, and the confirmed constraints in the architecture brief. It contains no application implementation, database migration, or infrastructure provisioning.

## Recommended reading order

1. [System design](LMS-system-design.md) - decisions, flows, failure behaviour, and final recommendation.
2. [Architecture diagrams](LMS-architecture.html) - context, trust boundaries, workflows, and deployment.
3. [Data model](LMS-data-model.md) - entities, constraints, state models, indexes, and row security.
4. [API design](LMS-api-design.md) - application and Department-facing contracts.
5. [Security and operations](LMS-security-and-operations.md) - access control, POPIA safeguards, deployment, observability, backup, and recovery.
6. [Capacity estimates](LMS-capacity-estimates.md) - formulas, baseline, sensitivity cases, and scaling triggers.
7. [Requirements traceability](LMS-requirements-traceability.md) - source conflicts and requirement-to-design coverage.
8. [Risk and test plan](LMS-risk-and-test-plan.md) - production risks, validation, load tests, and go-live gates.
9. [Architecture decisions](adrs/README.md) - the decision record set.

## Recommended architecture

The LMS is one Next.js App Router modular monolith deployed to Vercel. Supabase Auth establishes identity; Supabase PostgreSQL is authoritative for permissions, workflow state, exams, decisions, credits, audit data, and outbox records; private Supabase Storage holds file bodies; and Supabase Queue buffers asynchronous work. Academic changes remain local PostgreSQL transactions. A bounded scheduled Vercel worker drains queued work idempotently.

## Key assumptions

- The 1,000-learner target supersedes the earlier 100-learner estimate in the SRS.
- Baseline exam concurrency is 100; 250 is the temporary sensitivity scenario.
- Exam answers are written to IndexedDB immediately and autosaved to the server every 10 seconds with jitter.
- The seven-day appeal period means calendar days in `Africa/Johannesburg` until policy confirms otherwise; stored timestamps are UTC.
- The proposed recovery objectives are a four-hour RTO and a 15-minute database RPO, subject to the selected Supabase plan and restore testing.
- Records retention is not yet approved. Capacity is shown for five- and seven-year scenarios, not as a policy decision.

## Outstanding decisions

| Decision | Recommendation | Owner needed |
|---|---|---|
| Moderation-cycle trigger | Coordinator explicitly opens or schedules a cycle after eligible decisions exist | Quality assurance owner |
| Appeal day convention | Calendar days, with a visible closing timestamp | Academic policy owner |
| Records and file retention | Adopt a documented schedule by record class | Information officer and legal counsel |
| Department credential standard | Start with scoped opaque credentials; adopt OAuth or mutual TLS only if mandated | Department integration owner |
| Storage recovery objective | Contract and test a recovery process separate from database backup | Operations and management |
| Availability target | Use 99.9% monthly for planning until formally approved | Product and operations owners |

## Source priority and conflicts

The governing order is confirmed architecture constraints, SRS, use-case catalogue, then labelled assumptions. The traceability document records all known conflicts, including deferred plagiarism checking, manual Teams attendance, logistics scope, differing learner counts, and use-case identifiers referenced by the SRS but absent from the supplied catalogue.

## Official technical references

- [Next.js backend-for-frontend guidance](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side)
- [Supabase database overview and backup boundaries](https://supabase.com/docs/guides/database/overview)
- [Supabase Queues](https://supabase.com/docs/guides/queues/quickstart)
- [Supabase private Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Vercel environments](https://vercel.com/docs/deployments/environments)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

