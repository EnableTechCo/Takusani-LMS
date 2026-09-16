# ADR-007 Upload files directly to private Storage

## Status

Proposed

## Context

Submissions and evidence may be large, while Vercel functions are unnecessary data proxies.

## Decision

Issue context-bound, short-lived signed upload URLs for random immutable keys. The browser uploads directly to private Supabase Storage, then calls a metadata finalisation command.

## Alternatives considered

Proxy bytes through Next.js; public buckets; overwrite-in-place paths.

## Positive consequences

Lower Vercel bandwidth/duration, better large-file resilience, private access, immutable submission versions.

## Negative consequences

Two-phase upload/finalisation creates orphan handling and more client states.

## Risks

A signed upload alone does not prove an academic submission; path or upsert mistakes could replace evidence.

## Revisit trigger

Proxy only for content transformation or a security control that cannot be applied after direct upload.

