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

### 5. OAuth state contains userId in plaintext — NEEDS INPUT
The OAuth `state` parameter is just base64url-encoded JSON `{ userId, nonce }`. The `userId` is visible to anyone who can observe the redirect URL (browser extensions, network logs, referrer headers). The state should be an opaque server-side token or encrypted. Requires design decision on approach (encrypt with EMAIL_ENCRYPTION_KEY? use opaque session-stored token?).

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

### 11. `syncIntervalMinutes` stored as text, not integer — NEEDS INPUT
The column is `text("sync_interval_minutes")` but represents a numeric value. Changing to integer requires a DB migration.

### 12. ~~`getMessageMetadata` builds URL manually, ignores the `params` variable~~ — FIXED
Removed the dead `URLSearchParams` variable.

### 13. Connection settings panel is read-only — NEEDS INPUT
The `ConnectionSettings` component receives `onUpdate` callback but never calls it and provides no way to edit settings. Needs UI design for the editing interface.

### 14. Import endpoint processes contacts sequentially with N+1 queries — NEEDS INPUT
Each contact in the import array results in 2-3 separate DB queries. Architectural optimization needed for batch processing.

### 15. `fetchSentToContacts` makes up to 1000 sequential API calls — NEEDS INPUT
Architectural change needed — could use Gmail batch API or implement caching.

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
