# Dev Log

Reverse-chronological log of development sessions. Each entry is self-contained.

---

## 2026-04-04 — Workspace-scoped API keys (bug #32)

**What:** Redesigned API key system to be workspace-scoped with proper role resolution, fixing the last high-severity security bug.

**Key changes:**
- `src/lib/api-auth.ts` — `checkAuth()` now looks up the user's actual role from DB instead of hardcoding `"admin"` for API key auth
- `src/db/schema/api-keys.ts` — new `workspace_id` FK column (NOT NULL, cascading delete)
- `src/lib/users.ts` — `createApiKey()` takes workspaceId, new `listApiKeysForWorkspace()` with JOIN for creator info, new `getApiKey()` for permission checks
- `src/app/api/api-keys/route.ts` — requires `X-Workspace-Id` header + workspace admin; lists keys for workspace only
- `src/app/api/api-keys/[id]/route.ts` — revocation checks workspace admin in the key's workspace
- `src/components/api-keys-manager.tsx` — uses `useWorkspaceFetch()`, shows creator name/email per key

**Decisions:**
- API key = user identity model (like GitHub PATs): key identifies who you are, workspace is per-request via `X-Workspace-Id` header, effective role checked same way as session auth. Rejected alternative of baking workspace into the key itself — stateless per-request model is simpler and consistent with the UI
- No "superkey" concept needed — global admins already have access to all workspaces through the effective role system, same as in the UI
- Workspace admins can see and revoke all keys in their workspace (not just their own) — needed for security auditing and key management when someone is unavailable
- Migration backfills existing keys to the global workspace

**Open items:**
- Bugs #43-49 (medium/low): N+1 queries, FK constraints, dead flags, pagination — need user input or architectural planning

---

## 2026-04-04 — Unsubscribe enforcement and medium bug fixes

**What:** Fixed medium severity bugs (#37-40, #42) and implemented full unsubscribe enforcement for categorized campaigns (bug #41) with three-layer protection: UI warning modal, database flag, and server-side send rejection.

**Key changes:**
- `src/lib/sync-engine.ts` — atomic upserts with `ON CONFLICT` to fix race conditions (#37, #38), workspace-scoped tag creation (#39)
- `src/lib/unsubscribe-tokens.ts`, `src/lib/ticket-unsubscribe-tokens.ts` — `console.error` when `UNSUBSCRIBE_SECRET` missing (#40)
- `src/lib/contacts.ts` — `listFieldDefinitions()` returns only core fields when no workspace (#42)
- `src/db/schema/campaigns.ts` — new `allow_no_unsubscribe` boolean column (default false)
- `src/lib/campaigns.ts` — `sendCampaign()` now refuses to send categorized campaigns without a working unsubscribe mechanism unless `allowNoUnsubscribe` is set; resets status to `draft` on rejection
- `src/components/campaign-manager.tsx` — warning modal on create/edit when category is set but no unsubscribe mechanism is available; user can "Go Back & Fix" or "Save Anyway" (sets the flag)
- `src/app/api/campaigns/unsubscribe-status/route.ts` — new endpoint returning infrastructure status (secret configured, List-Unsubscribe setting)
- `src/lib/schemas/campaigns.ts` — `allowNoUnsubscribe` added to create/update Zod schemas

**Decisions:**
- Unsubscribe warning at save-time (not send-time) so users can fix it in the editor and scheduled campaigns are covered
- `allowNoUnsubscribe` flag lives on the campaign record itself — no per-request override needed
- Flag is not reset when user adds `{{unsubscribe}}` later — harmless when mechanism is present, avoids complexity
- Server-side enforcement is the hard stop; UI modal is the user-friendly layer

**Open items:**
- Bug #32: API keys always grant admin role — needs scoped API key design
- Bugs #43-49 (medium/low): N+1 queries in sync engine, missing FK constraints, dead schema flags, pagination — need user input or architectural planning

---

## 2026-04-04 — Security audit and bug fixes (critical + high)

**What:** Conducted a full security audit of the codebase, documenting 26 new bugs (BUGS.md #24-49). Fixed all 5 critical and 6 of 7 high severity issues. #32 (API keys always grant admin) deferred for architectural planning.

**Key changes:**
- `src/lib/auth.ts` — removed `allowDangerousEmailAccountLinking` from Google OAuth (account takeover vector)
- `src/app/api/webhooks/mailersend/route.ts` — added HMAC-SHA256 signature verification, fixed workspace-scoped preference key in `handleWebhookUnsubscribe`
- `src/app/api/webhooks/tally/route.ts` — added HMAC-SHA256 signature verification, new contacts now linked to global workspace
- `src/app/api/contacts/[id]/route.ts` — workspace-scoped access control on GET and PUT via new `getContactForWorkspace()` helper
- `src/app/api/workspaces/[id]/route.ts` — membership check on GET, Zod validation + workspace-admin on PUT
- `src/app/api/workspaces/[id]/members/route.ts` — membership check on GET
- New `src/lib/credentials-encryption.ts` — AES-256-GCM encrypt/decrypt for connection credentials (Airtable/Notion API keys)
- New `src/lib/schemas/workspaces.ts` — Zod schema for workspace updates
- Decrypt credentials at all read points: connection routes, sync engine

**Decisions:**
- Webhook signing secrets fail-closed: if env var is missing, webhooks are rejected (not silently accepted)
- Credential encryption reuses `EMAIL_ENCRYPTION_KEY` rather than introducing a second key — simpler ops, same security level
- `getContactForWorkspace()` uses INNER JOIN on `contact_workspaces` — returns nothing if contact isn't linked to workspace. Global admins bypass via `getContact()` (no join)
- Workspace PUT downgraded from global-admin-only to workspace-admin — workspace self-management is the right model
- Backward compat for credential encryption: `decryptCredentials()` detects `_encrypted` marker key, falls through to plaintext for pre-encryption rows

**Open items:**
- Bug #32: API keys always grant admin role — needs scoped API key design
- Bugs #37-49 (medium/low): race conditions in sync engine, missing FK constraints, N+1 queries, dead schema flags — not yet addressed
