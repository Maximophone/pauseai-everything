# Dev Log

Reverse-chronological log of development sessions. Each entry is self-contained.

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
