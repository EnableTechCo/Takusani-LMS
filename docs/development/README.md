# Development guide

## Prerequisites

- Node.js 22
- npm 11 or newer
- Docker Desktop for the local Supabase stack
- Supabase CLI, installed as a development dependency

## Start locally

1. Copy .env.example to .env.local.
2. Run npm install.
3. Run npm run db:start and copy the local publishable key to .env.local.
4. Run npm run dev.
5. Open http://localhost:3000.

## Required checks

Run npm run ci for the application checks. With Docker running, also run npm run db:lint and npm run db:test.

## CI/CD setup

CI validates linting, types, unit tests, the production build, database linting, and pgTAP tests on pull requests and pushes to main.

Production delivery is intentionally disabled until infrastructure exists. Configure a protected GitHub environment named production, set the repository variable CD_ENABLED=true, and add:

- SUPABASE_ACCESS_TOKEN
- SUPABASE_DB_PASSWORD
- SUPABASE_PROJECT_ID
- VERCEL_TOKEN
- VERCEL_ORG_ID
- VERCEL_PROJECT_ID

Protect main, require both CI jobs, and require approval on the production environment. Delivery applies committed Supabase migrations before deploying the same commit to Vercel. Development, staging, and production use separate Supabase projects and environment-scoped secrets.
