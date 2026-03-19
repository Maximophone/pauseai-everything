# PauseAI Everything App

CRM and operations platform for PauseAI Global. Built with Next.js 16 (App Router), PostgreSQL, Drizzle ORM, Graphile Worker.

## Quick Reference

- **API docs:** See [docs/api-reference.md](docs/api-reference.md) for all endpoints, request/response schemas, and auth requirements
- **DB schemas:** `src/db/schema/*.ts` (Drizzle ORM, PostgreSQL)
- **API validation schemas:** `src/lib/schemas/*.ts` (Zod — source of truth for request validation)
- **Route handlers:** `src/app/api/**/route.ts`
- **Business logic:** `src/lib/*.ts`
- **Background workers:** `src/worker/` (Graphile Worker)
- **UI components:** `src/components/` (React + shadcn/ui)

## Auth

- Google OAuth via NextAuth (`src/lib/auth.ts`)
- API keys: `Authorization: Bearer pai_<key>` (`src/lib/api-auth.ts`)
- Admin role from `ADMIN_EMAILS` env var

## Key Commands

- `npm run dev` — dev server with Turbopack
- `npm run test` — run tests (Vitest)
- `npm run build` — production build
- `npm run worker` — background job worker
- `npm run db:migrate` — run migrations
- `npm run db:seed` — seed default field definitions
- `npm run docs:api` — regenerate API docs from Zod schemas

## Conventions

- All API validation uses Zod schemas in `src/lib/schemas/`
- Error format: `{ error: string, details?: string[] }`
- Route handlers use `validateBody()` from `src/lib/api-validate.ts`
- Tests required for all backend features (`src/lib/__tests__/`)
