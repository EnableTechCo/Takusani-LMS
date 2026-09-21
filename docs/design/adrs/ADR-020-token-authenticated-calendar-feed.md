# ADR-020 Serve the external calendar subscription as a token-authenticated feed

## Status

Proposed

## Context

FR-304 requires an external calendar subscription. Calendar clients poll a URL and cannot present a Supabase session cookie, so the feed cannot use interactive authentication. Every other first-party read is session authenticated. Provider-side fetchers poll from shared addresses and keep polling a URL long after it is revoked.

## Decision

Issue each user one revocable 256-bit feed token, stored only as a SHA-256 hash. Serve an iCalendar document containing schedule fields only: sessions, exam windows, and task due dates with title, start, end, and a deep link into the LMS. Exclude results, feedback, notices, and Teams join links. Respond with `Cache-Control: private, max-age=900` and an `ETag`, never a shared-cache directive. Limit per token; count only unknown tokens, not known-revoked ones, against the per-IP limit. Update `last_used_at` only when it is more than an hour stale, so polling does not become a write load. Redact the token path segment in platform log drains. Invalidate tokens when a profile is deactivated.

## Alternatives considered

No external subscription; a one-off file download only; OAuth-based calendar integration per provider; including join links in the feed.

## Positive consequences

Works with every mainstream calendar client; a leaked URL discloses a timetable only; no provider-specific integration; polling adds reads, not writes.

## Negative consequences

Introduces a bearer-URL trust boundary; learners must return to the LMS to join a session; the token appears in platform request logs unless redaction is configured and tested.

## Risks

Tokens shared or logged by third-party calendar services. Mitigated by minimisation, rotation, and last-used visibility to the learner.

## Revisit trigger

Policy classifies the timetable itself as restricted, or feed polling exceeds the capacity estimate of about one request per second sustained or measurably adds database load despite conditional-request caching.
