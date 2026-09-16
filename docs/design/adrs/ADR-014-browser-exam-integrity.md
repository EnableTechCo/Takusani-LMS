# ADR-014 Treat browser exam integrity as advisory

## Status

Proposed

## Context

Fullscreen, focus, tab, copy, and print events are observable but cannot prove behaviour outside the browser.

## Decision

Record bounded integrity events, warn learners, flag thresholds for human review, and prohibit automatic academic outcomes from these signals.

## Alternatives considered

No signals; webcam/biometric or locked-down native proctoring.

## Positive consequences

Provides deterrence and review evidence without overstating assurance or expanding biometric scope.

## Negative consequences

Cannot prevent second devices, virtual machines, screenshots, or photography; may create false positives.

## Risks

Staff may over-interpret events unless UI and policy remain explicit.

## Revisit trigger

Any stronger proctoring requires a separate legal, privacy, accessibility, procurement, and security decision.

