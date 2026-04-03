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

## Bug Bounty — 2026-04-03 (commit 6d4e747)

### Critical

#### 24. `allowDangerousEmailAccountLinking` enables account takeover
**File:** `src/lib/auth.ts:21`
The Google OAuth provider is configured with `allowDangerousEmailAccountLinking: true`. This NextAuth setting automatically links accounts when a new Google sign-in matches an existing user's email. Since the app uses invite-only access (existing email in `users` table), an attacker who controls a Google account with a victim's email address can log in as that victim, inheriting their role and permissions. The invite-only gate is fully bypassed.

#### 25. Unauthenticated Mailersend webhook — campaign metric poisoning
**File:** `src/app/api/webhooks/mailersend/route.ts`
The POST endpoint has **zero authentication** — no signature validation, no shared secret, no IP allowlist. Anyone who knows the URL can:
- Update email delivery statuses (mark emails as bounced, opened, clicked)
- Trigger `recalculateCampaignCounts()` with forged data
- Trigger `handleWebhookUnsubscribe()` to unsubscribe arbitrary contacts from categories
Mailersend provides HMAC webhook signatures that should be verified.

#### 26. Unauthenticated Tally webhook — contact injection
**File:** `src/app/api/webhooks/tally/route.ts`
The POST endpoint has no authentication. Anyone can forge a Tally form submission to:
- Create new contacts with arbitrary data (including custom fields like `lifecycle_stage`, `source`)
- Update existing contacts by email (merges custom fields, overwrites names)
- Log fake `form_submission` interactions
- Contacts are created **without any workspace association** (no `workspaceId` passed to `createContact`)
Tally provides webhook signing that should be verified.

#### 27. IDOR on `GET /api/contacts/:id` — cross-workspace contact access
**File:** `src/app/api/contacts/[id]/route.ts:17-31`
The endpoint only checks `requireAuth()` (any authenticated user). It does **not** verify the contact belongs to the requester's active workspace. Any logged-in user can read any contact in the entire system by ID.

#### 28. IDOR on `PUT /api/contacts/:id` — cross-workspace contact mutation
**File:** `src/app/api/contacts/[id]/route.ts:35-73`
Same pattern as #27 but for writes. Only checks `requireMember()` (global role). Any member can update any contact's email, name, custom fields, communication preferences, and `globallyUnsubscribed` flag — regardless of workspace.

### High

#### 29. Workspace ID is user-controlled and never validated for membership
**File:** `src/lib/workspace-context.ts:10-27`
`getActiveWorkspaceId()` accepts workspace IDs from header, query param, or cookie with **no validation** that the user is actually a member of that workspace. `requireWorkspaceMember()` checks the effective role but global admins bypass all checks (`authResult.role === "admin"` → return null). For non-admin users, `getEffectiveRole()` returns `"viewer"` for unknown workspaces, which blocks write access but still allows the workspace context to be set for read operations that only call `getActiveWorkspaceId()` without a subsequent role check.

#### 30. `GET /api/workspaces/:id` — any authenticated user can read any workspace
**File:** `src/app/api/workspaces/[id]/route.ts:8-18`
Only checks `checkAuth()` (is user logged in?). No membership verification. Any authenticated user can enumerate workspace details (name, slug, type, language) for any workspace ID.

#### 31. `GET /api/workspaces/:id/members` — member enumeration across workspaces
**File:** `src/app/api/workspaces/[id]/members/route.ts`
Only checks `checkAuth()`. Any authenticated user can list all members of any workspace, discovering who belongs where and their roles.

#### 32. API keys always grant admin role
**File:** `src/lib/api-auth.ts:24`
`checkAuth()` returns `role: "admin"` for every valid API key, regardless of the key creator's actual role. A viewer-level user who creates an API key gets admin access through it. If any API key is leaked, the attacker has full admin access to the entire system.

#### 33. `PUT /api/workspaces/:id` accepts raw body without validation
**File:** `src/app/api/workspaces/[id]/route.ts:21-33`
The body is passed directly to `updateWorkspace(id, body)` without `validateBody()` or any Zod schema. An admin could inject arbitrary fields into the `set()` call. While Drizzle should ignore unknown columns, this violates the codebase convention and could become dangerous if the schema grows.

#### 34. Plaintext Airtable/Notion credentials in database
**File:** `src/db/schema/connections.ts:17-19`
Connection credentials (`credentials: jsonb("credentials")`) are stored as plaintext JSONB. The encryption module (`src/lib/encryption.ts`) exists and is used for Gmail OAuth tokens, but Airtable API keys and Notion tokens are stored unencrypted. A database breach exposes all third-party API keys.

#### 35. Mailersend webhook unsubscribe doesn't use workspace-scoped preference keys
**File:** `src/app/api/webhooks/mailersend/route.ts:119-149`
`handleWebhookUnsubscribe()` sets `prefs[cat.name] = "unsubscribed"` using just the category name, but the app convention is `"workspaceId:categoryName"` for preference keys (documented in CLAUDE.md). This means webhook-triggered unsubscribes set the wrong key and likely don't take effect — or worse, collide with a different workspace's category of the same name.

### Medium

#### 36. Tally webhook creates contacts without workspace association
**File:** `src/app/api/webhooks/tally/route.ts:183-189`
`createContact()` is called without a `workspaceId`, so new contacts are created with no workspace link. They exist in the database but are invisible to all workspaces — orphaned records that consume storage and could cause confusion in global queries.

#### 37. Race condition in sync-engine contact upsert
**File:** `src/lib/sync-engine.ts:263-309`
Classic check-then-act: queries for existing contact by email, then either updates or inserts. Two concurrent syncs processing the same email will both see "not found", both try to insert, and one fails on the unique email constraint. The error is caught and logged as "errored" but the contact is silently dropped.

#### 38. Race condition in sync-engine tag creation
**File:** `src/lib/sync-engine.ts:396-406`
`applyTagsToContact()` does a select-then-insert for each tag without transactions. Concurrent syncs can both find a tag missing and both try to insert it, causing a unique constraint violation. This error propagates and can fail the entire record processing.

#### 39. Tag lookup in sync-engine ignores workspace scoping
**File:** `src/lib/sync-engine.ts:401`
`db.select().from(tags).where(eq(tags.name, trimmed))` looks up tags globally by name. Tags are supposed to be workspace-scoped. A sync in workspace A could match (and reuse) a tag from workspace B, or create a workspace-less tag that collides with workspace-scoped ones.

#### 40. `verifyUnsubscribeToken` silently returns false when secret is missing
**File:** `src/lib/unsubscribe-tokens.ts:34`
If `UNSUBSCRIBE_SECRET` is not set, `verifyUnsubscribeToken()` silently returns `false` for all tokens. This is safe (denies unsubscribes) but means contacts **cannot unsubscribe** when the secret is misconfigured. Meanwhile, `generateUnsubscribeToken()` throws — so the system can generate emails with unsubscribe links that can never work if the secret is later removed or changed.

#### 41. Campaign sends proceed without unsubscribe URL when secret is missing
**File:** `src/lib/campaigns.ts:197-202`
When `buildUnsubscribeUrl()` throws (secret not configured), the error is caught and the email is sent with an empty `unsubscribe` merge variable. This means campaigns can be sent without valid unsubscribe links — potential CAN-SPAM / GDPR compliance violation.

#### 42. `listFieldDefinitions` backward-compat path leaks all fields
**File:** `src/lib/contacts.ts`
When called without `workspaceId`, returns all field definitions from all workspaces including `global_internal` and workspace-scoped fields. If any code path invokes this without workspace context, it leaks field metadata across workspace boundaries.

#### 43. N+1 queries per record in sync-engine
**File:** `src/lib/sync-engine.ts:252-327`
For each record in a sync run: 1 query to find existing contact, 1 insert/update, 1 workspace link insert, plus N queries per tag (find + create + link). A sync of 1000 records with 3 tags each = ~7000+ database round trips.

#### 44. `getContact()` and `findContactByEmail()` have no workspace scoping
**File:** `src/lib/contacts.ts`
These functions return any contact regardless of workspace. They're used by the sync engine (acceptable for syncing), but also called from API routes like `GET /api/contacts/:id` where workspace isolation should be enforced (see bug #27).

#### 45. Missing foreign key constraints on workspace references
**Files:** `src/db/schema/contacts.ts`, `src/db/schema/tags.ts`, `src/db/schema/connections.ts`, `src/db/schema/campaigns.ts`, `src/db/schema/segments.ts`
Multiple tables have `workspaceId` as a plain UUID column without a foreign key `references()` to `workspaces.id`. No `onDelete` cascade. Deleting a workspace leaves orphaned contacts, tags, connections, campaigns, and segments. The only entity with proper FK is `syncConfigurations.connectionId`.

#### 46. Sync-engine `duplicateStrategy: "skip"` still updates workspace links
**File:** `src/lib/sync-engine.ts:269-278`
When `duplicateStrategy` is `"skip"` and a contact already exists, the code still inserts a workspace link. If the existing contact belongs to a different workspace, the "skip" strategy silently adds it to the syncing workspace — this may not match user expectations of what "skip duplicates" means.

### Low

#### 47. `crossWorkspace` flag on segments is never enforced
**File:** `src/db/schema/segments.ts:30`
The schema has `crossWorkspace: boolean("cross_workspace").default(false)` but no code reads or enforces this flag. Dead schema that could mislead future development.

#### 48. Redundant `status` and `enabled` fields on sync configurations
**File:** `src/db/schema/connections.ts:70-72`
Both `status` (active/paused/error) and `enabled` (true/false) exist. The dispatch query checks both. They can become contradictory (enabled=false, status="active"). One field should be the source of truth.

#### 49. No pagination on `GET /api/email-connections/:id/contacts`
Carried forward from bug #19 — still not addressed. All contacts returned in a single response.
