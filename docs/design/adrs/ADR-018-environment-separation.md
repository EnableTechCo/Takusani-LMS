# ADR-018 Separate development staging and production environments

## Status

Proposed

## Context

Preview code and test data must not reach production personal or academic records.

## Decision

Use distinct Supabase projects and environment-scoped Vercel secrets for development, staging, and production. Previews use non-production data only.

## Alternatives considered

One shared database with environment flags; previews connected to production read-only.

## Positive consequences

Clear blast-radius and data separation, safe migrations/tests, and simpler incident reasoning.

## Negative consequences

More projects, secrets, seed data, and migration promotion work.

## Risks

Manual configuration drift can make staging unrepresentative.

## Revisit trigger

Automate environment creation and drift checks as the project grows; never collapse production isolation.

