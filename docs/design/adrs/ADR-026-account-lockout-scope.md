# ADR-026 Limit account lockout to new password sign-ins

## Status

Proposed

## Context

FR-106 requires an account to lock after failed sign-in attempts and an administrator to unlock it. Failed sign-ins are unauthenticated, so a lock that blocks an existing session lets anyone who knows a learner's email address end that learner's exam while the timer runs. Supabase Auth provides request rate limiting, not per-account lockout. Its password verification hook, which could count failures inside Auth, is offered on the Team and Enterprise plans only. A server-side sign-in handler counts only the attempts that pass through it; a caller using the Auth endpoint directly is limited by Supabase's own rate limits but never increments the counter.

## Decision

1. A lock blocks new password sign-ins only. It never invalidates an existing session and never blocks exam-attempt commands.
2. A lock expires by itself after a configured period, and is also cleared by an administrator (FR-106) or by a successful email recovery.
3. Deactivation remains the control that blocks existing sessions, and only an administrator can apply it.
4. On a plan with the password verification hook, the hook counts failures and rejects attempts on a locked profile. Without it, sign-in goes through a server handler that counts failures, with CAPTCHA on the sign-in form and Supabase's per-address limits as the control against direct calls. The residual risk of that fallback, that direct calls are rate limited but not counted, is accepted and recorded.
5. The locked response is indistinguishable from a failed sign-in. Lock, unlock, and expiry are audited and the user is notified.

## Alternatives considered

Lock blocks all commands until an administrator unlocks; no lockout, rate limiting only; mandatory multi-factor authentication instead of lockout.

## Positive consequences

Lockout cannot be used to deny service to a learner in an exam; FR-106 is met; no administrator needs to be on call during exams.

## Negative consequences

A stolen active session is not ended by lockout; on the fallback path lockout is weaker than the requirement implies.

## Risks

Targeted nuisance locking of staff accounts. Mitigated by self-expiry and recovery.

## Revisit trigger

The selected plan provides the hook, or monitoring shows sustained password guessing that per-address limits do not contain.
