# ADR-004 Use Supabase client plus PostgreSQL functions and limited direct SQL

## Status

Proposed

## Context

Routine scoped reads differ from critical commands that must update several tables atomically. The team is small and should not carry unnecessary abstraction.

## Decision

Use the Supabase server/client libraries with RLS for ordinary access, narrowly granted PostgreSQL RPC functions for critical workflows, and direct SQL connections only for migrations, maintenance, and bounded worker transactions. Do not add an ORM initially.

## Alternatives considered

ORM for all access; Data API only; direct SQL everywhere.

## Positive consequences

Simple ordinary access, precise transactions where needed, minimal dependencies, and native use of PostgreSQL features.

## Negative consequences

SQL and TypeScript types require an explicit generation/review workflow; logic is split between application services and database functions.

## Risks

Functions can become an undocumented second application layer.

## Revisit trigger

Adopt an ORM only if repetitive query construction and schema/type drift measurably reduce delivery quality without hiding required PostgreSQL behaviour.

