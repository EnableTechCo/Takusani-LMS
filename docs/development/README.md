# Development guide

## Prerequisites

- Node.js 22 (see `.nvmrc`; `engines` allows 22 to 24)
- npm 11 or newer
- Docker Desktop for the local Supabase stack
- Supabase CLI, installed as a development dependency

## Start locally

1. Copy .env.example to .env.local.
2. Run npm install.
3. Run npm run db:start and copy the local publishable key to .env.local.
4. To preview the navigation before real sign-in exists, set `LMS_DEV_ROLES` in .env.local, for example `learner,assessor,moderator`. It is ignored in production builds, which always get no roles.
5. Run npm run dev.
6. Open http://localhost:3000.

## Where things go

- **Routes** follow the sitemap in `docs/design/ui/LMS-ux-architecture.md` section 4: `/learn`, `/teach`, `/assess`, `/moderate`, `/review`, `/coordinate`, `/admin`, plus `/home`, `/notifications` and `/sign-in`. A workspace the person does not hold returns 404.
- **Navigation** is built from the person's roles in `src/modules/identity/navigation.ts`. There is no role switcher.
- **Styling** uses the design tokens only. `src/styles/tokens.css` is a copy of `docs/design/ui/prototype/assets/tokens.css`; change the prototype file first, then copy it. A unit test fails if they differ.
- **Server-only code** starts with `import "server-only";` so the build fails if a Client Component imports it. Anything that touches cookies, secrets or privileged keys is server-only.
- **API errors** use `errorResponse()` in `src/lib/http/error-response.ts`: `{ "error": { code, message, request_id, retryable, details } }` with lower snake_case codes.
- **Database changes** start from `supabase/templates`. Every grant to `anon` or `authenticated` is added to the allow-list in `supabase/tests/database/0002_privilege_allowlist.test.sql` in the same pull request, or CI fails.

## Health checks

- `GET /api/health/live`: the process is running.
- `GET /api/health/ready`: configuration is present and the database answers `api.health_check()` within two seconds; otherwise 503 with `dependency_unavailable`.

## Required checks

Run npm run ci for the application checks. With Docker running, also run npm run db:lint and npm run db:test.

## CI/CD setup

CI validates linting, types, unit tests, the production build, database linting, and pgTAP tests on pull requests and pushes to main. The Supabase and Vercel CLI versions are pinned in the workflows; update them deliberately.

Production delivery is intentionally disabled until infrastructure exists. Configure a protected GitHub environment named production, set the repository variable CD_ENABLED=true, and add:

- SUPABASE_ACCESS_TOKEN
- SUPABASE_DB_PASSWORD
- SUPABASE_PROJECT_ID
- VERCEL_TOKEN
- VERCEL_ORG_ID
- VERCEL_PROJECT_ID

Delivery applies committed Supabase migrations before deploying the same commit to Vercel. Development, staging, and production use separate Supabase projects and environment-scoped secrets.

## Settings the repository cannot enforce

These live in GitHub, Supabase and Vercel. Check each one before the first production deploy and after creating any new project.

| Where | Setting | Why |
|---|---|---|
| GitHub | Protect `main`: require a pull request and both CI jobs ("Web application", "Database boundaries") to pass | Merges to `main` deploy once CD is enabled |
| GitHub | Production environment requires a reviewer | A person approves each production deploy |
| Supabase, every hosted project | API settings: exposed schemas = `api` only (remove `public` and `graphql_public`) | `supabase/config.toml` sets this for the local stack only; ADR-024 |
| Supabase, every hosted project | Auth: public sign-up off; minimum password length 12; email confirmation on; secure password change on | Accounts come from invitation and import (FR-103); matches `config.toml` |
| Supabase | Plan with point-in-time recovery for production | 15-minute recovery point (ADR-027, P-14) |
| Vercel | Function region pinned to the Supabase project's region | Each database call otherwise crosses continents (ADR-027) |
| Vercel and Supabase | A staging project and deployment that `main` reaches before production | ADR-018: staging validation before production |
