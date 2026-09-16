# ADR-001 Use a modular monolith

## Status

Proposed

## Context

One small team must deliver tightly coupled learning, assessment, moderation, appeal, and credit workflows for about 1,000 learners. Several commands require one ACID transaction.

## Decision

Deploy one Next.js application and enforce internal modules by business capability. Modules expose application services and owned data access rather than importing UI or table internals.

## Alternatives considered

A single unstructured monolith; independently deployed microservices.

## Positive consequences

One transaction can protect academic invariants; one deployment and observability surface; low operational cost; module seams preserve later extraction options.

## Negative consequences

All modules share a release cadence and deployment blast radius; boundary discipline requires code review and architecture tests.

## Risks

Convenience imports can erode ownership and create a big ball of mud.

## Revisit trigger

Extract a module only after it needs independent deployment or ownership, has a materially different scaling/availability profile, and can tolerate a network and consistency boundary.

