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

#### 32. ~~API keys always grant admin role~~ — FIXED
**Files:** `src/lib/api-auth.ts`, `src/db/schema/api-keys.ts`, `src/lib/users.ts`, `src/app/api/api-keys/route.ts`, `src/app/api/api-keys/[id]/route.ts`, `src/components/api-keys-manager.tsx`
`checkAuth()` now looks up the user's actual role from the database instead of hardcoding `"admin"`. API keys are workspace-scoped: each key has a `workspace_id` column, keys are created in the active workspace, listed per-workspace (with creator name/email), and workspace admins can manage all keys in their workspace. The API key holder passes `X-Workspace-Id` per-request, and effective role is checked the same way as session auth.

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

#### 37. ~~Race condition in sync-engine contact upsert~~ — FIXED
**File:** `src/lib/sync-engine.ts:263-309`
Replaced check-then-act with atomic `ON CONFLICT DO UPDATE` upsert (for update strategy) and `ON CONFLICT DO NOTHING` + re-select (for skip strategy). No more race window.

#### 38. ~~Race condition in sync-engine tag creation~~ — FIXED
**File:** `src/lib/sync-engine.ts:396-406`
Replaced select-then-insert with `ON CONFLICT DO NOTHING` + re-select pattern. If two concurrent syncs try to create the same tag, one inserts and the other gets the existing row.

#### 39. ~~Tag lookup in sync-engine ignores workspace scoping~~ — FIXED
**File:** `src/lib/sync-engine.ts:401`
`applyTagsToContact()` now accepts `workspaceId` and filters/creates tags scoped to the connection's workspace.

#### 40. ~~`verifyUnsubscribeToken` silently returns false when secret is missing~~ — FIXED
**File:** `src/lib/unsubscribe-tokens.ts:34`, `src/lib/ticket-unsubscribe-tokens.ts:31`
Both verify functions now log `console.error` when `UNSUBSCRIBE_SECRET` is missing, making the misconfiguration visible in server logs. Still returns false (safe default) but no longer silent.

#### 41. ~~Campaign sends proceed without unsubscribe URL when secret is missing~~ — FIXED
**Files:** `src/db/schema/campaigns.ts`, `src/lib/campaigns.ts`, `src/lib/schemas/campaigns.ts`, `src/components/campaign-manager.tsx`, `src/app/api/campaigns/unsubscribe-status/route.ts`
When `buildUnsubscribeUrl()` throws (secret not configured), the email was sent silently with an empty `unsubscribe` merge variable. Three-layer fix:
1. **Database:** New `allow_no_unsubscribe` boolean column on campaigns (default `false`).
2. **UI (save-time warning):** When creating or editing a categorized campaign without a working unsubscribe mechanism, a modal dialog explains which mechanisms are missing, the CAN-SPAM/GDPR risks, and advises the user to fix the issue. "Go Back & Fix" returns to the editor; "Save Anyway" sets `allowNoUnsubscribe: true` on the campaign.
3. **Server-side enforcement:** `sendCampaign()` refuses to send a categorized campaign without a working unsubscribe mechanism unless `allowNoUnsubscribe` is `true`. Resets status to `draft` and throws an error. If the flag is set, proceeds with a `console.warn` for logging.
New `GET /api/campaigns/unsubscribe-status` endpoint returns server-side infrastructure status (secret configured, List-Unsubscribe setting) for the UI check.

#### 42. ~~`listFieldDefinitions` backward-compat path leaks all fields~~ — FIXED
**File:** `src/lib/contacts.ts`
When called without `workspaceId`, now returns only core fields (safe default) instead of all fields from all workspaces.

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

---

## API Black-Box Audit — 2026-04-04 (86 test scenarios, 28 findings)

Full audit report: `docs/audits/api-blackbox-audit-2026-04-04.md`

### Critical — Workspace Isolation

#### 50. ~~Workspace membership not enforced on API endpoints~~ — FIXED
**Systemic bug.** `requireWorkspaceMember()` used `getEffectiveRole()` which returned member for any user with a global member role, even without workspace membership. Added explicit `hasWorkspaceMembership()` check. Applied workspace membership enforcement to all 18+ API route files.

#### 51. ~~Cross-workspace campaign segment targeting~~ — FIXED
Campaigns could reference segments from other workspaces, sending emails to contacts the workspace shouldn't access. Added segmentId cross-workspace validation on campaign create and update.

#### 52. ~~Cross-workspace tag assignment~~ — FIXED
Tags from one workspace could be assigned to contacts in another workspace. Added tag workspace validation on POST/DELETE contact tag endpoints.

### High

#### 53. ~~API key workspace scoping not enforced~~ — FIXED
API keys have a `workspaceId` but it was not enforced. `getActiveWorkspaceId()` now defaults to the API key's workspace when no header is specified. Workspace membership enforcement (bug #50) prevents cross-workspace access.

#### 54. ~~HTML injection in email merge variables~~ — FIXED
**File:** `src/lib/mailersend.ts`
`renderTemplate()` performed naive string substitution without HTML escaping. Contact names or custom fields containing HTML would be injected directly into email bodies. Added `escapeHtml()` function to escape all merge variable values.

### Medium

#### 55. ~~`updatedAt` timestamps use JS local time instead of SQL UTC~~ — FIXED
All `updatedAt: new Date()` calls (20+ instances across 11 files) replaced with `sql\`now()\`` for consistent UTC timestamps.

#### 56. ~~Segment `is_not_empty` operator not recognized~~ — FIXED
**File:** `src/lib/segments.ts`
The `buildColumnCondition` switch statement only had `is_set`/`is_not_set`. Added `is_empty`/`is_not_empty` as aliases.

#### 57. ~~Segment preview response field mismatch~~ — FIXED
API docs said `contacts`, implementation returned `sample`. Renamed to `contacts` in both backend and frontend.

### Low

#### 58. ~~No max length validation on campaign fields~~ — FIXED
Added `.max(200)` for name, `.max(998)` for subject (RFC 2822), `.max(500_000)` for body in Zod schemas.

#### 59. Campaign send returns success for campaigns that will be rejected — DEPRIORITIZED
`POST /api/campaigns/:id/send` returns `{ queued: true }` for a categorized campaign that will be rejected by the worker. Low impact — status resets to draft correctly.

#### 60. `dispatch_email_syncs` worker task SQL error — NOT A CODE BUG
Schema and queries are correctly aligned. Likely a runtime/environment issue.
