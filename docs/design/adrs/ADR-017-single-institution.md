# ADR-017 Use a single-institution architecture

## Status

Proposed

## Context

The system is for one in-house institution and multi-institution operation is explicitly excluded.

## Decision

Model programme, cohort, unit, and assessment scope directly. Do not add institutional routing, control plane, per-institution configuration, or tenant discriminators.

## Alternatives considered

Shared multi-tenant schema; database per institution; white-label platform.

## Positive consequences

Simpler authorization, queries, operations, and data model aligned with actual requirements.

## Negative consequences

Supporting another independent institution later would require deliberate redesign and migration.

## Risks

Speculative abstractions could reintroduce complexity and ambiguous permissions.

## Revisit trigger

Revisit only through a new product decision that funds multi-institution governance, isolation, migration, billing, and operations.

