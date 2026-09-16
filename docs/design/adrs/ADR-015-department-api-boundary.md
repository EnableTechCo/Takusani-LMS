# ADR-015 Expose a dedicated Department API boundary

## Status

Proposed

## Context

The LMS owns a versioned external contract and must minimise data, rotate credentials, throttle access, and audit disclosures.

## Decision

Expose `/api/v1` Route Handlers backed only by released-record views. Authenticate scoped opaque credentials stored as hashes and record returned record IDs.

## Alternatives considered

Raw Supabase Data API; portal-only access; scheduled file export.

## Positive consequences

Stable contract, explicit minimisation, independent security controls, deprecation policy, and complete access evidence.

## Negative consequences

The team owns compatibility, credential operations, and consumer support.

## Risks

View or scope regression could disclose held/private fields.

## Revisit trigger

Adopt OAuth, mutual TLS, or scheduled export when the Department publishes a mandatory standard or operational pattern.

