# ADR-027 Platform plans and hosting region

## Status

Proposed. Open: requires a management decision on cost and a privacy decision on cross-border hosting. The recommendation below is the planning basis until then.

## Context

Several objectives in this package depend on plan features that no record named. A 15-minute database recovery point needs point-in-time recovery, an add-on that requires at least Small compute; daily backups alone give a recovery point of up to 24 hours. Per-minute Vercel Cron needs a paid Vercel plan. The Auth password verification hook needs the Supabase Team plan. Supabase offers no African region, so learner traffic from South Africa crosses to another continent for every database call; a function placed near learners with the database in Europe pays that distance on every sequential call, which alone can consume the 500 ms autosave target. Storage replication of up to 2 TB a year cannot run inside a Vercel function.

## Decision

1. Supabase: Pro plan with the point-in-time recovery add-on and at least Small compute. Move to Team only if the lockout hook (ADR-026) or organisational controls justify it.
2. Vercel: Pro plan.
3. Region: place the Supabase project in the European region with the lowest measured latency from South Africa, and pin Vercel functions to the same region rather than to a region near learners. Static assets remain on the edge network.
4. Storage replication and restore verification run on an external scheduled runner, such as a CI schedule, over the Storage S3 endpoint to a second bucket.
5. Hosting personal information outside South Africa is recorded in the POPIA cross-border assessment before production.

## Alternatives considered

Supabase Pro without point-in-time recovery, accepting a 24-hour recovery point; functions in Cape Town with the database in Europe; self-hosted PostgreSQL in South Africa.

## Positive consequences

The recovery, scheduling, and latency targets become achievable and costed; one database round trip per autosave stays inside the budget.

## Negative consequences

Recurring cost for the add-ons; every dynamic request pays intercontinental latency once; cross-border transfer obligations apply.

## Risks

Measured latency from learners' networks is worse than assumed. Mitigated by the latency spike before build and by the one-round-trip rule for autosave.

## Revisit trigger

Supabase offers an African region, or the autosave p95 from South African clients exceeds 500 ms in the pre-build spike.
