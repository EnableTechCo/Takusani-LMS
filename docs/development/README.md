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

### Deployment as code

After CI passes on `main`, `deploy.yml` deploys **staging, then production** (ADR-018), using `deploy-environment.yml` for each:

1. Check the environment has every secret and variable it needs.
2. Check `vercel.json`'s function region matches the Supabase project's region (`scripts/deploy-region.mjs`, ADR-027).
3. Apply database migrations (`supabase db push`).
4. Push project settings from `supabase/config.toml` (`supabase config push`), after printing `supabase config diff` to the log. This is how the hosted projects get the security settings: only the `api` schema exposed, no public sign-up, 12-character passwords, email confirmation, secure password change. Only the site URL differs per environment; it is added at deploy time from the `SITE_URL` variable.
5. Build and deploy to Vercel, then smoke-test `/api/health/ready`.

Production starts only after staging passes, and then waits for approval on the `production` environment.

`vercel.json` also turns off Vercel's own Git deployments for `main`, so the workflow above is the only route to production. Pull request previews still deploy automatically.

The function region is `lhr1` (London), matching Supabase `eu-west-2`. That is the planning default for decision P-16 (ADR-027), pending the latency spike. To change it, create the Supabase projects in the chosen region and change `regions` in `vercel.json`; the deploy stops if the two disagree.

### One-time setup

Deployment stays off until the repository variable `CD_ENABLED` is `true`. Before turning it on:

| Where | What | Why |
|---|---|---|
| Supabase | Create two projects, staging and production, in the region that matches `vercel.json` (`eu-west-2` for `lhr1`). Production on a plan with point-in-time recovery | ADR-018, ADR-027, P-14 |
| Vercel | A second Vercel project for staging (deployed only by the workflow, not connected to Git). In each Vercel project set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the Production environment | The app reads them at build time |
| GitHub | Environments `staging` and `production`, each with secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, optionally `VERCEL_AUTOMATION_BYPASS_SECRET`, and variable `SITE_URL` (for example `https://lms.example.org`) | Same names in both; the environment decides which project is used |
| GitHub | `production` environment requires a reviewer | A person approves each production deploy |
| GitHub | Protect `main`: require a pull request and both CI jobs ("Web application", "Database boundaries") to pass | Merges to `main` deploy once CD is on |
