# ADR-016 Use immutable decisions and an append-only credit ledger

## Status

Proposed

## Context

External audit must reconstruct original and revised assessment, moderation, appeal, and credit outcomes.

## Decision

Insert every final decision with a supersedes link. Record credits as signed ledger entries tied to released decisions; corrections append reversals/adjustments.

## Alternatives considered

Update current decision/credit total in place; database audit trigger only.

## Positive consequences

Complete domain history, deterministic reconstruction, duplicate prevention, and defensible appeals.

## Negative consequences

Queries need current projections and decision-chain handling; storage grows.

## Risks

A mutable projection can drift from the ledger if not updated transactionally and reconciled.

## Revisit trigger

The immutable source remains permanent; only projection and archival strategies may change.

