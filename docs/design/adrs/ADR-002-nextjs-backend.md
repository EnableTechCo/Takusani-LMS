# ADR-002 Use Next.js as frontend and application backend

## Status

Proposed

## Context

The fixed stack is TypeScript, Node.js, Next.js App Router, and Vercel. The system needs browser UI, authenticated commands, an external API, and scheduled worker endpoints.

## Decision

Use Server Components for server-rendered reads, Client Components for browser-only interactions, Server Actions for first-party form commands, and Route Handlers for stable machine interfaces and jobs.

## Alternatives considered

Separate frontend and API deployments; browser access directly to all Supabase tables.

## Positive consequences

One language and deployment, shared validation/types, fewer network hops, and a smaller operations burden.

## Negative consequences

Vercel function duration/statelessness constrains long work; careless code can mix UI and domain logic.

## Risks

Business rules may drift into React components, and local Route Handler calls from Server Components add needless round trips.

## Revisit trigger

Add a separate backend only when measured long-running compute, protocol needs, or independent ownership cannot be met by bounded workers and database functions.

