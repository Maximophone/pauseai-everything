# Bug Bounty Findings — Gmail Integration Feature

## Critical

### 1. ~~SQL Injection via `syncIntervalMinutes`~~ — FIXED
Used `make_interval(mins => ...)::int` and added allowlist filter to prevent malformed values from reaching SQL.

### 2. ~~IDOR — Bulk update email contact settings~~ — FIXED
Added workspace-scoped ownership verification: all `contactIds` must belong to the user's active workspace.

### 3. ~~IDOR — Single contact settings update~~ — FIXED
Added workspace-scoped ownership verification for single contact settings endpoint.

### 4. ~~Token revocation passes refresh token as URL query parameter~~ — FIXED
Moved token to POST request body instead of query parameter.

## High

### 5. ~~OAuth state contains userId in plaintext~~ — WONTFIX
The OAuth `state` parameter contains base64url-encoded `{ userId, workspaceId, nonce }`. These are random UUIDs (not secrets), CSRF protection is intact via cookie comparison, and keeping IDs visible aids debugging. Not a meaningful security risk.

### 6. ~~No workspace scoping on email-contact-settings GET endpoint~~ — FIXED
Added workspace filtering to the GET endpoint so it only returns settings for connections in the active workspace.

### 7. ~~Race condition — duplicate sync jobs~~ — FIXED
Added Graphile Worker `jobKey` + `jobKeyMode: "preserve_run_at"` to deduplicate sync jobs per connection.

### 8. ~~No rate limiting on manual sync trigger~~ — FIXED
Added 60-second cooldown between manual syncs, returning 429 if triggered too frequently.

## Medium

### 9. ~~Dead-code logic bug — name never updates~~ — FIXED
Fixed condition from `(!existing || (!existing && addr.name))` to `(!existing || (existing === "" && addr.name))`.

### 10. ~~`userInfoRes` response not checked for errors~~ — FIXED
Added `res.ok` check and email presence validation after fetching user info from Google.

### 11. ~~`syncIntervalMinutes` stored as text, not integer~~ — FIXED
Changed column from `text` to `integer` in schema, updated Zod schema to use numeric literals, simplified dispatch SQL (no more `::int` cast needed), and generated migration.

### 12. ~~`getMessageMetadata` builds URL manually, ignores the `params` variable~~ — FIXED
Removed the dead `URLSearchParams` variable.

### 13. ~~Connection settings panel is read-only~~ — FIXED
Added toggle buttons for boolean settings and a dropdown for sync interval. Wired up `onUpdate` to call the settings API and refresh the connection list.

### 14. ~~Import endpoint processes contacts sequentially with N+1 queries~~ — FIXED
Batch-loads existing contacts and workspace memberships upfront (2 queries total), then only does individual queries for new contact creation and workspace linking.

### 15. ~~`fetchSentToContacts` makes up to 1000 sequential API calls~~ — FIXED
Implemented Gmail batch API (`POST /batch/gmail/v1`) with `multipart/mixed` request/response parsing. Fetches up to 50 message metadata per single HTTP request instead of individual calls. Applied to both `fetchSentToContacts` and `fetchMessagesSince`.

## Low

### 16. ~~Silently swallowed errors in frontend~~ — FIXED
Added error states and user-visible error messages for both connection and contact fetch failures.

### 17. ~~`toggleSelectAll` logic bug with filtered results~~ — FIXED
Fixed to properly add/remove only filtered contacts from selection, preserving selections from other filter states. Also fixed the checkbox `checked` state to use `every()` check.

### 18. ~~Email address matching is case-sensitive in sync worker~~ — FIXED
Added `.toLowerCase().trim()` when building the email-to-contact map from DB records.

### 19. No pagination on contacts endpoint — NEEDS INPUT
The `GET /api/email-connections/:id/contacts` endpoint fetches ALL contacts with no pagination. Needs API design decision on pagination parameters.

### 20. `inArray` with empty array not guarded everywhere
Pattern is inconsistent across files. Low risk since current code paths are guarded, but could bite during future changes.

### 21. ~~OAuth callback does not verify workspace context~~ — FIXED
Encoded `workspaceId` in the OAuth state parameter during initiation and read it back in the callback, instead of relying on cookies surviving the redirect.

### 22. ~~`providerMessageId` dedup is fragile~~ — FIXED
Strengthened the dedup query to also match on `emailConnectionId`, reducing risk of false matches. Race condition mitigated by bug #7 fix (job deduplication).

### 23. ~~Dynamic import of `inArray` in route handler~~ — FIXED
Changed to static import alongside other drizzle-orm imports.

---

## Bug Bounty — 2026-04-04 (commit 6d4e747)

### Critical

#### 24. ~~`allowDangerousEmailAccountLinking` enables account takeover~~ — FIXED
**File:** `src/lib/auth.ts:21`
The Google OAuth provider was configured with `allowDangerousEmailAccountLinking: true`, allowing automatic account linking when a new Google sign-in matches an existing user's email. An attacker who controls a Google account with a victim's email could log in as the victim. Removed the flag.

#### 25. ~~Unauthenticated Mailersend webhook — campaign metric poisoning~~ — FIXED
**File:** `src/app/api/webhooks/mailersend/route.ts`
The POST endpoint had zero authentication. Anyone could forge delivery events, poison campaign metrics, or force-unsubscribe contacts. Added HMAC-SHA256 signature verification via `MAILERSEND_WEBHOOK_SIGNING_SECRET` env var.

#### 26. ~~Unauthenticated Tally webhook — contact injection~~ — FIXED
**File:** `src/app/api/webhooks/tally/route.ts`
The POST endpoint had no authentication. Anyone could create/update contacts with arbitrary data. Added HMAC-SHA256 signature verification via `TALLY_WEBHOOK_SIGNING_SECRET` env var. Also fixed new contacts being created without workspace association — they are now linked to the global workspace.

#### 27. ~~IDOR on `GET /api/contacts/:id` — cross-workspace contact access~~ — FIXED
**File:** `src/app/api/contacts/[id]/route.ts:17-31`
The endpoint only checked `requireAuth()`. Any logged-in user could read any contact by ID. Added workspace-scoped lookup via `getContactForWorkspace()` (INNER JOIN on `contact_workspaces`). Global admins bypass the check.

#### 28. ~~IDOR on `PUT /api/contacts/:id` — cross-workspace contact mutation~~ — FIXED
**File:** `src/app/api/contacts/[id]/route.ts:35-73`
Same pattern as #27 but for writes. Only checked `requireMember()` (global role). Added workspace-scoped verification and upgraded to `requireWorkspaceMember` (workspace-aware role check).

### High

#### 29. ~~Workspace ID is user-controlled and never validated for membership~~ — FIXED
**File:** `src/lib/workspace-context.ts:10-27`
Meta-bug: `getActiveWorkspaceId()` accepts workspace IDs from header/query/cookie without membership validation. Fixed by ensuring every endpoint that uses it also calls `requireWorkspaceMember`/`requireWorkspaceAdmin`. Individual fixes applied in #27, #28, #30, #31.

#### 30. ~~`GET /api/workspaces/:id` — any authenticated user can read any workspace~~ — FIXED
**File:** `src/app/api/workspaces/[id]/route.ts:8-18`
Only checked `checkAuth()`. Any authenticated user could read any workspace's details. Added `requireWorkspaceMember` check — only workspace members and global admins can view workspace details.

#### 31. ~~`GET /api/workspaces/:id/members` — member enumeration across workspaces~~ — FIXED
**File:** `src/app/api/workspaces/[id]/members/route.ts`
Only checked `checkAuth()`. Any authenticated user could list all members of any workspace. Added `requireWorkspaceMember` check.

#### 32. API keys always grant admin role
**File:** `src/lib/api-auth.ts:24`
`checkAuth()` returns `role: "admin"` for every valid API key, regardless of the key creator's actual role. Requires architectural planning for scoped API keys.

#### 33. ~~`PUT /api/workspaces/:id` accepts raw body without validation~~ — FIXED
**File:** `src/app/api/workspaces/[id]/route.ts:21-33`
Body was passed directly to `updateWorkspace()` without validation. Added `UpdateWorkspaceInput` Zod schema. Also downgraded from global-admin-only to workspace-admin (more appropriate for workspace self-management).

#### 34. ~~Plaintext Airtable/Notion credentials in database~~ — FIXED
**File:** `src/db/schema/connections.ts:17-19`
Connection credentials were stored as plaintext JSONB. Created `src/lib/credentials-encryption.ts` with `encryptCredentials`/`decryptCredentials` helpers using AES-256-GCM (same `EMAIL_ENCRYPTION_KEY`). Encrypt on create/update, decrypt on read. Backward compatible with any pre-encryption rows.

#### 35. ~~Mailersend webhook unsubscribe doesn't use workspace-scoped preference keys~~ — FIXED
**File:** `src/app/api/webhooks/mailersend/route.ts:119-149`
`handleWebhookUnsubscribe()` set `prefs[cat.name]` instead of the correct `prefs["workspaceId:categoryName"]` format. Now fetches the campaign's `workspaceId` and uses the correct namespaced key.

### Medium

#### 36. Tally webhook creates contacts without workspace association
**File:** `src/app/api/webhooks/tally/route.ts:183-189` — **FIXED as part of #26**

#### 37. Race condition in sync-engine contact upsert
**File:** `src/lib/sync-engine.ts:263-309`
Classic check-then-act: queries for existing contact by email, then either updates or inserts. Two concurrent syncs processing the same email will both see "not found", both try to insert, and one fails on the unique email constraint.

#### 38. Race condition in sync-engine tag creation
**File:** `src/lib/sync-engine.ts:396-406`
`applyTagsToContact()` does a select-then-insert for each tag without transactions. Concurrent syncs can both find a tag missing and both try to insert it, causing a unique constraint violation.

#### 39. Tag lookup in sync-engine ignores workspace scoping
**File:** `src/lib/sync-engine.ts:401`
`db.select().from(tags).where(eq(tags.name, trimmed))` looks up tags globally by name. Tags are supposed to be workspace-scoped. A sync in workspace A could match a tag from workspace B.

#### 40. `verifyUnsubscribeToken` silently returns false when secret is missing
**File:** `src/lib/unsubscribe-tokens.ts:34`
If `UNSUBSCRIBE_SECRET` is not set, `verifyUnsubscribeToken()` silently returns `false` for all tokens — contacts cannot unsubscribe.

#### 41. Campaign sends proceed without unsubscribe URL when secret is missing
**File:** `src/lib/campaigns.ts:197-202`
When `buildUnsubscribeUrl()` throws (secret not configured), the email is sent with an empty `unsubscribe` merge variable. Potential CAN-SPAM / GDPR compliance violation.

#### 42. `listFieldDefinitions` backward-compat path leaks all fields
**File:** `src/lib/contacts.ts`
When called without `workspaceId`, returns all field definitions from all workspaces.

#### 43. N+1 queries per record in sync-engine
**File:** `src/lib/sync-engine.ts:252-327`
For each record: 1 query to find existing contact, 1 insert/update, 1 workspace link insert, plus N queries per tag.

#### 44. `getContact()` and `findContactByEmail()` have no workspace scoping
**File:** `src/lib/contacts.ts`
These functions return any contact regardless of workspace. Used from API routes where workspace isolation should be enforced. Partially addressed by #27/#28 (route-level fix), but the functions themselves remain unscoped for sync engine use.

#### 45. Missing foreign key constraints on workspace references
**Files:** `src/db/schema/contacts.ts`, `src/db/schema/tags.ts`, `src/db/schema/connections.ts`, `src/db/schema/campaigns.ts`, `src/db/schema/segments.ts`
Multiple tables have `workspaceId` as a plain UUID without FK or `onDelete` cascade.

#### 46. Sync-engine `duplicateStrategy: "skip"` still updates workspace links
**File:** `src/lib/sync-engine.ts:269-278`
When `duplicateStrategy` is `"skip"` and a contact already exists, the code still inserts a workspace link — silently adding it to the syncing workspace.

### Low

#### 47. `crossWorkspace` flag on segments is never enforced
**File:** `src/db/schema/segments.ts:30`
Dead schema flag — no code reads or enforces it.

#### 48. Redundant `status` and `enabled` fields on sync configurations
**File:** `src/db/schema/connections.ts:70-72`
Both fields control activation. Can become contradictory.

#### 49. No pagination on `GET /api/email-connections/:id/contacts`
Carried forward from bug #19 — still not addressed.
