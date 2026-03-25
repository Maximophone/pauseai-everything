# PauseAI Everything App

CRM and operations platform for PauseAI Global. Built with Next.js 16 (App Router), PostgreSQL, Drizzle ORM, Graphile Worker. Supports multi-tenancy via workspaces (Global + chapter workspaces).

## Quick Reference

- **API docs:** See [docs/api-reference.md](docs/api-reference.md) for all endpoints, request/response schemas, and auth requirements
- **DB schemas:** `src/db/schema/*.ts` (Drizzle ORM, PostgreSQL)
- **API validation schemas:** `src/lib/schemas/*.ts` (Zod — source of truth for request validation)
- **Route handlers:** `src/app/api/**/route.ts`
- **Business logic:** `src/lib/*.ts`
- **Connectors:** `src/lib/connectors/` (Airtable, Notion, Demo)
- **Sync engine:** `src/lib/sync-engine.ts`
- **Background workers:** `src/worker/` (Graphile Worker)
- **UI components:** `src/components/` (React + shadcn/ui)
- **Workspace design:** See [docs/workspaces.md](docs/workspaces.md) for the multi-tenancy specification

## Workspaces (Multi-Tenancy)

The app supports multiple workspaces: one **global** workspace (PauseAI Global) and **chapter** workspaces (e.g., Pause IA France). Key concepts:

- **Workspace context:** Determined by cookie (`pauseai_workspace`), header (`X-Workspace-Id`), or query param. Server components use `getServerWorkspaceId()`, client components use `useWorkspace()` / `useWorkspaceFetch()`.
- **Contacts:** Exist once globally, linked to workspaces via `contact_workspaces` junction table. A workspace only sees its own contacts.
- **Effective role:** `max(global role, workspace role)` — computed by `useEffectiveRole()` (client) or `getEffectiveRole()` (server). A user with global "member" role but workspace "admin" role is an admin in that workspace.
- **Workspace-scoped entities:** Tags, segments, campaigns, communication categories, connections, custom fields (scope: core/global_internal/workspace), user memberships, automations (scripts + rules).
- **Workspace provider:** `src/components/workspace-provider.tsx` — provides `activeWorkspace`, `useWorkspaceId()`, `useWorkspaceFetch()` (auto-injects `X-Workspace-Id` header).
- **Server-side workspace:** `src/lib/workspace-server.ts` — `getServerWorkspaceId()` reads from cookies, `isServerWorkspaceGlobal()`.
- **API workspace context:** `src/lib/workspace-context.ts` — `getActiveWorkspaceId(request)` reads from header/query/cookie.

## Auth

- Google OAuth via NextAuth (`src/lib/auth.ts`)
- Dev login with Credentials provider (development only) — preset users + custom email form with workspace selector
- API keys: `Authorization: Bearer pai_<key>` (`src/lib/api-auth.ts`)
- Admin role from `ADMIN_EMAILS` env var
- Two-layer roles: global role (users table) + workspace role (user_workspaces table)

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
- Client-side API calls MUST use `useWorkspaceFetch()` to include workspace context header
- Communication preference keys are namespaced: `workspaceId:categoryName`
- Segment tag conditions use operator `has`/`not_has` (not `eq`)
- Workspace switching triggers `window.location.reload()` — don't use refs to detect changes; check entity workspace ownership after fetch instead
- Connections UI lives at `/dashboard/connections` (top-level sidebar, admin-only), not under Settings
- When using `stripNulls()` in API routes, extract nullable fields that carry meaning (like `segmentId`, `categoryId`) before stripping
