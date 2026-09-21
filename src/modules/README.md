# Application modules

Create each vertical module beneath this path when its first slice is implemented. A module owns its domain types, application commands and queries, and infrastructure adapters. Modules import one another only through public entry points.

- TypeScript owns boundary validation, orchestration, presentation, and provider adapters.
- PostgreSQL owns authorisation predicates, transitions, invariants, locks, immutable history, and atomic audit/outbox writes.
- Cross-module database effects call the callee module's published PostgreSQL functions.
- Browser-only state is limited to interaction state and the documented IndexedDB exam-recovery buffer.

The canonical boundaries are listed in manifest.ts; empty directory trees are intentionally avoided.
