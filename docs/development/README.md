# Development guide

## Prerequisites

- Node.js 22 (see `.nvmrc`; `engines` allows 22 to 24)
- npm 11 or newer
- Docker Desktop for the local Supabase stack
- Supabase CLI, installed as a development dependency

## Start locally

1. Copy .env.example to .env.local.
2. Run npm install.
3. Run npm run db:start (Docker must be running). Copy the local publishable key and secret key it prints into .env.local.
4. Run npm run dev.
5. Open http://localhost:3000. Use the same host throughout: invitation and reset emails link to localhost (`site_url` in supabase/config.toml), and a session cookie belongs to one host.

## Signing in and accounts

Accounts are created by an administrator; there is no public sign-up (FR-103). Sign-in is Supabase Auth with email and password, and what a person sees comes from their role assignments in the database (`identity.role_assignments`, read through `api.my_access()`).

**Local test accounts.** `supabase db reset` loads `supabase/seed.sql`, which creates one account per actor. They all use the password `takusani-local-password`, which exists only in local databases.

| Email | Roles | Lands on |
|---|---|---|
| learner@takusani.test | Learner | /learn |
| facilitator@takusani.test | Facilitator | /home |
| assessor@takusani.test | Assessor | /home |
| moderator@takusani.test | Moderator | /home |
| coordinator@takusani.test | Coordinator | /home |
| admin@takusani.test | Administrator (can create accounts) | /home |
| staff@takusani.test | Facilitator, assessor, moderator, coordinator | /home |

**Creating an account.** Sign in as the administrator, open Administration, then Accounts, then New account. The person gets an invitation email and chooses their own password at `/accept-invite`. Locally, emails go to Mailpit at http://127.0.0.1:54324, not to real inboxes. Roles apply to the whole institution until cohort setup adds scoped roles.

**Forgot password.** `/forgot-password` emails a reset link; the reply is the same whether or not the account exists.

**How the pieces fit.** `src/proxy.ts` refreshes the session and sends signed-out visitors to `/sign-in`. `/auth/confirm` verifies invitation and reset links (templates in `supabase/email`). The app layout reads the person's access once per request (`src/modules/identity/session.ts`), and each workspace layout returns 404 unless the person holds that workspace. The database checks again: administrator-only functions refuse anyone else, and every account and role change is written to `audit.events` in the same transaction.

**Staging accounts.** Once the identity migration is on staging, `npm run accounts:staging` creates the same seven accounts there. It reads `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_SECRET_KEY` and `STAGING_TEST_ACCOUNT_PASSWORD` from .env.local and is safe to run again.

**Email on staging.** Supabase's built-in email service only delivers to members of the Supabase organisation and allows a handful of emails an hour. Real invitations and password resets on staging need custom SMTP (Dashboard, Authentication, Emails, SMTP settings). On the free plan Supabase also refuses our email templates (`supabase/email`) until custom SMTP is set, so the deploy leaves them out; after configuring SMTP, set the repository variable `CUSTOM_SMTP_ENABLED` to `true` and the next deploy pushes them.

## Environment variables

Copy `.env.example` to `.env.local`; never commit `.env.local` or a real secret. The application requires
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; creating accounts also needs
`SUPABASE_SECRET_KEY`. Without the two public values the site still loads, but sign-in says it is not available and
`/api/health/ready` reports not ready.

The template also covers:

- `SUPABASE_SECRET_KEY` is a dedicated `sb_secret_...` key, used today only by account creation (the Auth admin API,
  `src/lib/supabase/admin.ts`) and later by trusted workers. Create it under Supabase **Settings > API Keys**. It
  must never be exposed to browser code. Locally, use the secret key `npx supabase status` prints.
- `CRON_SECRET` authenticates Vercel Cron requests. Generate an independent random value of at least 16 characters.
- `NEXT_PUBLIC_APP_URL` is `http://localhost:3000` locally and `https://takusani-lms.vercel.app` on staging. The
  staging URL is live and redirects unauthenticated visits to `/sign-in`.

Local development uses:

```dotenv
# .env.local (Development)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The deployment credentials `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`, `VERCEL_TOKEN`,
`VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` do not belong in `.env.local`. They are GitHub Actions secrets scoped to the
deployment environment. GitHub shows their names but never reveals their values after they are saved.

## Where things go

- **Routes** follow the sitemap in `docs/design/ui/LMS-ux-architecture.md` section 4: `/learn`, `/teach`, `/assess`, `/moderate`, `/review`, `/coordinate`, `/admin`, plus `/home`, `/notifications` and `/sign-in`. A workspace the person does not hold returns 404.
- **Navigation**: which destinations exist and who sees them is in `src/modules/identity/navigation.ts`; how they look (icons, phone bottom tabs) is in `src/components/shell/nav-presentation.ts`. Tests check that every destination has a page and an icon. There is no role switcher.
- **Layers**: `src/modules/*` holds each module's rules, commands and queries and never imports from `src/components` or `src/app`; `src/lib` and `src/config` import neither. ESLint enforces both. Pages in `src/app` compose modules and components.
- **Institution details** (name, help contact) are read from `src/config/institution.ts` until configuration (X-06) stores them.
- **Styling** uses the design tokens only. `src/styles/tokens.css` is a copy of `docs/design/ui/prototype/assets/tokens.css`; change the prototype file first, then copy it. A unit test fails if they differ.
- **Server-only code** starts with `import "server-only";` so the build fails if a Client Component imports it. Anything that touches cookies, secrets or privileged keys is server-only.
- **API errors** use `errorResponse()` in `src/lib/http/error-response.ts`: `{ "error": { code, message, request_id, retryable, details } }` with lower snake_case codes.
- **Database changes** start from `supabase/templates` and follow "Database changes" below. Every grant to `anon` or `authenticated` is added to the allow-list in `supabase/tests/database/0002_privilege_allowlist.test.sql` in the same pull request, or CI fails.

## Screens

Every screen in the UX architecture's inventory (`docs/design/ui/LMS-ux-architecture.md`, section 5.1) has its route, and each route renders a **skeleton**: the real page frame, headings, form labels and primary actions, with each piece of content drawn as a dashed, labelled block that says what will go there. The header shows the screen ID (for example `L-03`) and its requirements. A feature ticket replaces a screen's blocks with real components and data; the prototype (`docs/design/ui/prototype`) shows what the finished P0 screens look like.

- Skeleton parts are in `src/components/skeleton`: `Screen` (page frame, optional aside), `Block` (a labelled placeholder), `Blocks` (side by side), `Form` (real labels, no values, disabled actions), `Workspace` (marking, moderation and appeal review: evidence, panel and decision bar) and `CohortNav`. Primary actions are disabled buttons; links between screens work, using `example` for IDs.
- Styling comes from the prototype's component layer, `src/styles/ui.css`, an exact copy of `docs/design/ui/prototype/assets/ui.css` (a test fails if they drift; change the prototype first). Skeleton blocks are styled in `src/styles/skeleton.css`, which goes away once no screen uses them.
- Shells: `AppShell` for workspace pages, `src/app/(auth)` for sign-in and account recovery, `src/app/(exam)` for the exam, which has no navigation (FR-901).
- Each workspace folder returns 404 unless the person holds that workspace; a test checks that every navigation link has a page.
- Which workspaces you see depends on who you sign in as. Sign in as staff@takusani.test to see four workspaces at once.

## Database changes

The same convention as BluBook: migrations run locally before the pull request, and reach the hosted database after merge.

1. Start from current `main` on a new branch.
2. Create the migration with `supabase migration new <lower_snake_case_name>`, starting from `supabase/templates`.
3. Run `npm run db:check` with the local stack running. In order, it:
   - checks migration names, that no migration already on `main` was changed, and that yours sorts after them;
   - checks for schema drift: anything changed in local Studio or by hand SQL that no migration captures;
   - rebuilds the database from migrations (`supabase db reset`), runs the database lint and pgTAP tests;
   - regenerates `src/types/database.ts` from the `api` schema.
4. Commit the migration, the regenerated types and the code together in one pull request, and fill in the Database section of the pull request template.
5. CI checks the same rules again (except drift, which only exists on a developer's machine): names, immutability and order against the base branch, a fresh database built from every migration, lint, pgTAP tests, and that the committed types match the schema.
6. After merge, the deploy workflow applies the migration to staging (`supabase db push`), the job BluBook did by hand.

Rules:

- Never edit, rename or delete a migration once it is on `main`. Fix forward with a new migration.
- Never change a hosted database from the Supabase dashboard.
- Vercel can deploy the code a few minutes before its migration is applied, so the code already on `main` must keep working against the new schema: add first, switch over, remove later.

## Health checks

- `GET /api/health/live`: the process is running.
- `GET /api/health/ready`: configuration is present and the database answers `api.health_check()` within two seconds; otherwise 503 with `dependency_unavailable`.

## Required checks

Run npm run ci for the application checks. With Docker running, also run npm run db:check.

Code is formatted by Prettier (`.prettierrc.json`, 120 columns, Tailwind classes sorted). Run `npm run format` before committing, or turn on format-on-save in your editor; CI fails on unformatted files. Docs, SQL, generated types and `src/styles/tokens.css` (a copy of the prototype's tokens) are not formatted. The repository uses LF line endings on every platform (`.gitattributes`); on Windows, a clone made before this rule may need `git rm --cached -r . && git reset --hard` once.

## CI/CD setup

CI validates formatting, linting, types, unit tests, the production build, database linting, and pgTAP tests on pull requests and pushes to main. The Supabase and Vercel CLI versions are pinned in the workflows; update them deliberately.

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

The function region is `cdg1` (Paris), matching the staging Supabase project "Takusani - LMS" (`mfgaoqabgboegovodklq`) in `eu-west-3`. This settles the region for decision P-16 in practice (ADR-027); production must be created in the same region. To change region, create the Supabase project in the new region and change `regions` in `vercel.json`; the deploy stops if the two disagree.

### Setting up staging (now)

Deployment stays off until the repository variable `CD_ENABLED` is `true`. Before turning it on:

| Where | What |
|---|---|
| Supabase | Done: the staging project is "Takusani - LMS" (`mfgaoqabgboegovodklq`, `eu-west-3`). Its ref goes in the `SUPABASE_PROJECT_ID` secret |
| Vercel | In the existing project, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the Production target (the staging site). Add `SUPABASE_SECRET_KEY`, `CRON_SECRET`, and `NEXT_PUBLIC_APP_URL` when their corresponding server features are implemented |
| GitHub | Create an environment named `staging` with secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`, optionally `VERCEL_AUTOMATION_BYPASS_SECRET`, and variable `SITE_URL=https://takusani-lms.vercel.app`. No Vercel token is needed: Vercel deploys staging itself |

`main` is protected: changes arrive by pull request, and both CI jobs ("Web application", "Database boundaries") must pass, for administrators too.

### Adding production (later)

1. Create a production Supabase project in the same region as staging, on a plan with point-in-time recovery (ADR-027, P-14), and a separate production Vercel project that is not connected to Git.
2. Create the `production` GitHub environment with the same secret and variable names as `staging` plus `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` for the production Vercel project, and require a reviewer on it. GitHub environment names are not case-sensitive, so this is the same environment as the `Production` one Vercel created for its deployments; that is fine.
3. Set the repository variable `PRODUCTION_ENABLED=true`. Production then deploys after staging passes, and waits for the reviewer.
