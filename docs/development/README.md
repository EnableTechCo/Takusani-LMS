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

### Environments

**This repository's current setup is the staging environment.** The existing Vercel project (`enable-tech/takusani-lms`) and the Supabase project created for it are staging. A separate production environment will be added later.

### Deployment as code

**Staging (now).** When a pull request merges to `main`, Vercel's Git integration deploys it to the staging site straight away, as it does for pull request previews. Separately, once CI passes on `main`, `deploy.yml` runs `deploy-environment.yml` for staging:

1. Check the environment has every secret and variable it needs.
2. Check `vercel.json`'s function region matches the Supabase project's region (`scripts/deploy-region.mjs`, ADR-027).
3. Apply database migrations (`supabase db push`).
4. Push project settings from `supabase/config.toml` (`supabase config push`), after printing `supabase config diff` to the log. This is how the hosted project gets the security settings: only the `api` schema exposed, no public sign-up, 12-character passwords, email confirmation, secure password change. Only the site URL differs per environment; it is added at deploy time from the `SITE_URL` variable.
5. Smoke-test `/api/health/ready` on the staging site, allowing up to two minutes for Vercel's build to finish.

Because Vercel deploys on merge and migrations run after CI, the new code can be live on staging for a few minutes before its migration is applied, and Vercel deploys even if CI fails on `main`. That is acceptable for staging. Write migrations so the previous code keeps working (expand, then migrate, then contract; see the security and operations document), which keeps that window harmless.

**Production (later)** does not use Vercel's Git integration. The workflow builds and deploys it itself (`deploy_app: true`) after migrations, so the order is always migrations first.

The function region is `lhr1` (London), matching Supabase `eu-west-2`. That is the planning default for decision P-16 (ADR-027), pending the latency spike. To change it, create the Supabase project in the chosen region and change `regions` in `vercel.json`; the deploy stops if the two disagree.

### Setting up staging (now)

Deployment stays off until the repository variable `CD_ENABLED` is `true`. Before turning it on:

| Where | What |
|---|---|
| Supabase | Create the staging project in `eu-west-2` (or change `vercel.json` to match its region) |
| Vercel | In the existing project, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the Production target (the staging site) |
| GitHub | Create an environment named `staging` with secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`, optionally `VERCEL_AUTOMATION_BYPASS_SECRET`, and variable `SITE_URL` (the staging site's address). No Vercel token is needed: Vercel deploys staging itself |

`main` is protected: changes arrive by pull request, and both CI jobs ("Web application", "Database boundaries") must pass, for administrators too.

### Adding production (later)

1. Create a production Supabase project in the same region as staging, on a plan with point-in-time recovery (ADR-027, P-14), and a separate production Vercel project that is not connected to Git.
2. Create the `production` GitHub environment with the same secret and variable names as `staging` plus `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` for the production Vercel project, and require a reviewer on it. GitHub environment names are not case-sensitive, so this is the same environment as the `Production` one Vercel created for its deployments; that is fine.
3. Set the repository variable `PRODUCTION_ENABLED=true`. Production then deploys after staging passes, and waits for the reviewer.
