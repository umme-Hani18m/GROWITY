# GROWITY

**Live website:** https://growity2-2dups5xe.manus.space/en

GROWITY is a multilingual web application with dedicated experiences for children, parents, NGOs, and staff. The application includes informational pages, role-based workspaces, support/reporting flows, document workflows, and policy/resource pages.

## Tech stack

- Next.js 16 and React 19
- TypeScript
- Tailwind CSS 4
- `next-intl` for English and Hindi localization
- Supabase (`@supabase/supabase-js` and `@supabase/ssr`) for backend services
- Zod for environment/configuration validation

## Getting started

### Requirements

- Node.js compatible with the versions required by the installed Next.js release
- pnpm (the package manager is pinned in `package.json`)

### Install and run

```bash
pnpm install
cp .env.example .env.local
```

Edit `.env.local` with the values for your own Supabase project and any providers you configure. **Never commit `.env.local` or real credentials.** The values in `.env.example` are placeholders and are not usable credentials.

Start the development server:

```bash
pnpm dev
```

Run checks:

```bash
pnpm typecheck
pnpm build
```

## Environment variables

See [`.env.example`](.env.example) for the configuration variable names. Server-only values (such as the Supabase service-role key, Turnstile secret, PIN pepper, rate-limit HMAC secret, and email provider key) must remain server-side. Do not prefix secrets with `NEXT_PUBLIC_`.

## Supabase database

The ordered SQL migration instructions, safety notes, and verification queries are documented in [`supabase/MIGRATION_RUNBOOK.md`](supabase/MIGRATION_RUNBOOK.md).

Read the runbook before applying migrations. Do not run demo seed or cleanup scripts against a production project. Use a separate development/demo Supabase project for test data.

## Security notes

- Keep this repository private until you have reviewed the complete commit history and confirmed no credentials or personal data are present.
- `.env.local` and other `.env*` files are ignored by Git; `.env.example` is intentionally tracked and contains placeholders only.
- Supabase local CLI metadata under `supabase/.temp/` is excluded.
- Never publish service-role keys, database connection strings, provider secrets, real user records, or generated demo passwords.
- A public repository exposes source code and database schema. Review migrations, policies, sample data, and documentation before changing repository visibility.

## Project structure

- `src/app/` — application routes and server actions
- `src/components/` — reusable UI and form components
- `src/lib/` — authentication, validation, rate limiting, audit, and Supabase helpers
- `src/i18n/` and `messages/` — localization
- `supabase/migrations/` — database migrations
- `supabase/demo/` — explicitly marked demo data scripts

## Deployment

The currently deployed website is available at:

https://growity2-2dups5xe.manus.space/en

Deployment configuration and environment variables are managed by the hosting/provider environment; do not place production secrets in this repository.
