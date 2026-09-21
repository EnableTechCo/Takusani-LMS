# Architecture Decision Records

## Status

All records are proposed for architecture review. Approval should include product, engineering, security/privacy, academic quality, and operations owners where relevant.

## Index

- [ADR-001 Use a modular monolith](ADR-001-modular-monolith.md)
- [ADR-002 Use Next.js as frontend and application backend](ADR-002-nextjs-backend.md)
- [ADR-003 Use Supabase PostgreSQL as the system of record](ADR-003-supabase-postgresql-system-of-record.md)
- [ADR-004 Use Supabase client plus PostgreSQL functions and limited direct SQL](ADR-004-database-access-strategy.md)
- [ADR-005 Use application authorization plus RLS](ADR-005-rls-and-application-authorization.md)
- [ADR-006 Use PostgreSQL functions for critical transactions](ADR-006-postgres-functions-critical-transactions.md)
- [ADR-007 Upload files directly to private Storage](ADR-007-direct-storage-uploads.md)
- [ADR-008 Use a transactional outbox and Supabase Queue](ADR-008-transactional-outbox-supabase-queue.md)
- [ADR-009 Use edge and database-native caching and throttling controls](ADR-009-database-native-caching-and-throttling.md)
- [ADR-010 Do not use Kafka or RabbitMQ](ADR-010-no-kafka-rabbitmq.md)
- [ADR-011 Do not shard the database](ADR-011-no-database-sharding.md)
- [ADR-012 Apply selective rate limiting](ADR-012-selective-rate-limiting.md)
- [ADR-013 Use domain uniqueness first and idempotency records selectively](ADR-013-idempotency-strategy.md)
- [ADR-014 Treat browser exam integrity as advisory](ADR-014-browser-exam-integrity.md)
- [ADR-015 Expose a dedicated Department API boundary](ADR-015-department-api-boundary.md)
- [ADR-016 Use immutable decisions and an append-only credit ledger](ADR-016-immutable-decisions-credit-ledger.md)
- [ADR-017 Use a single-institution architecture](ADR-017-single-institution.md)
- [ADR-018 Separate development staging and production environments](ADR-018-environment-separation.md)
- [ADR-019 Hold results by cohort moderation policy and moderate them in scoped cycles](ADR-019-cohort-moderation-policy-and-scoped-cycles.md)
- [ADR-020 Serve the external calendar subscription as a token-authenticated feed](ADR-020-token-authenticated-calendar-feed.md)
- [ADR-021 Model the result as a first-class aggregate with a release sequence](ADR-021-results-aggregate-and-release-sequence.md)
- [ADR-022 Award credit per unit through a serialised learner-unit outcome](ADR-022-unit-credit-roll-up.md)
- [ADR-023 Exam persistence protocol](ADR-023-exam-persistence-protocol.md)
- [ADR-024 Treat the Supabase Data API as a public surface](ADR-024-data-api-exposure-and-actor-identity.md)
- [ADR-025 Enqueue inside the domain transaction and split scheduling](ADR-025-in-transaction-enqueue-and-scheduler-split.md)
- [ADR-026 Limit account lockout to new password sign-ins](ADR-026-account-lockout-scope.md)
- [ADR-027 Platform plans and hosting region](ADR-027-platform-plans-and-hosting-region.md)

ADR-019 to ADR-027 follow the requirements-coverage pass and the 18 September 2026 architecture review. The [fixes and decisions register](../LMS-design-fixes-and-decisions.md) maps every review finding to its decision and to the record that carries it.

## Record policy

ADRs are immutable decision history. Superseded decisions receive a new ADR and the older record is marked superseded rather than rewritten. A record that is refined rather than replaced names the refining record in its status line. New records carry a measurable revisit trigger. The review found that the triggers in ADR-001, 002, 004, 005, 006, 012, 013, 016, and 018 are not yet measurable; they are to be restated with a metric and threshold at architecture approval rather than edited piecemeal.

