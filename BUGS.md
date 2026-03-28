# Bug Bounty Findings — Gmail Integration Feature

## Critical

### 1. SQL Injection via `syncIntervalMinutes` (dispatch-email-syncs.ts:26)
The `syncIntervalMinutes` column is a free-text `text` field in the DB schema (`email-connections.ts:38`), and its value is interpolated directly into a raw SQL expression:
```sql
${emailConnections.syncIntervalMinutes} || ' minutes')::interval
```
Although the Zod schema limits input to `["1","5","15","30","60"]`, the upsert in the OAuth callback (`callback/route.ts:64-91`) creates rows **without** validating `syncIntervalMinutes` (it uses the DB default). But if any other code path or direct DB edit sets an arbitrary string, it becomes SQL injection. The column type should be an integer or enum, not free text passed into raw SQL.

### 2. IDOR — Bulk update email contact settings has no ownership verification (email-contact-settings/route.ts:59-83)
The `PUT /api/email-contact-settings` bulk endpoint accepts an array of `contactIds` and blindly creates/updates `emailContactSettings` rows for them using the user's first connection. There is **no check** that the provided `contactIds` actually belong to contacts in the user's workspace. Any authenticated user can create sync settings for **any** contact ID in the system.

### 3. IDOR — Single contact settings update has no ownership verification (email-contact-settings/[contactId]/route.ts:45-60)
Same as above for `PUT /api/email-contact-settings/:contactId`. No verification that `contactId` belongs to a contact in the user's workspace or is associated with the user's connection.

### 4. Token revocation passes refresh token as URL query parameter (gmail.ts:386)
```ts
await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { ... });
```
The token is passed as a query parameter rather than in the POST body. This exposes the token in server logs, proxy logs, and potentially browser history. The Google revocation endpoint supports sending the token in the request body.

## High

### 5. OAuth state contains userId in plaintext — information leak (auth/gmail/route.ts:14-16)
The OAuth `state` parameter is just base64url-encoded JSON `{ userId, nonce }`. The `userId` is visible to anyone who can observe the redirect URL (browser extensions, network logs, referrer headers). The state should be an opaque server-side token or encrypted.

### 6. No workspace scoping on email-contact-settings GET endpoint (email-contact-settings/route.ts:10-33)
The `GET /api/email-contact-settings` endpoint returns settings for **all** of a user's connections across all workspaces, with no workspace filtering. This leaks cross-workspace data.

### 7. Race condition — duplicate sync jobs (dispatch-email-syncs.ts)
The dispatcher checks `lastSyncedAt` and enqueues jobs, but doesn't lock or mark connections as "syncing". If the dispatcher runs faster than the sync job completes, it will enqueue duplicate sync jobs for the same connection.

### 8. No rate limiting on manual sync trigger (email-connections/[id]/refresh/route.ts)
`POST /api/email-connections/:id/refresh` has no rate limiting or cooldown. A user can spam this endpoint and trigger unlimited Gmail API calls, potentially exhausting API quotas or causing rate limit errors from Google.

## Medium

### 9. Dead-code logic bug — name never updates (gmail.ts:320-321)
```ts
if (!existing || (!existing && addr.name)) {
```
The condition `(!existing && addr.name)` is redundant — if `!existing` is false, `(!existing && addr.name)` is always false. This means once a name is stored for an email, it is **never** updated even if a better name is found later. Should be:
```ts
if (!existing || (existing === "" && addr.name)) {
```

### 10. `userInfoRes` response not checked for errors (gmail.ts:86-91)
After exchanging the code for tokens, the `userInfoRes` fetch to Google's userinfo endpoint is not checked for `res.ok`. If it fails, `userInfo.email` will be `undefined`, leading to a connection with no email address stored.

### 11. `syncIntervalMinutes` stored as text, not integer (email-connections.ts:38)
The column is `text("sync_interval_minutes")` but represents a numeric value. This causes type confusion, makes SQL arithmetic error-prone, and relies on Postgres string-to-interval casting in the dispatch query.

### 12. `getMessageMetadata` builds URL manually, ignores the `params` variable (gmail.ts:225-230)
A `URLSearchParams` object is created on line 225-228 but never used. The URL is hardcoded on line 230. This is dead code that will cause confusion during maintenance.

### 13. Connection settings panel is read-only (my-email-contacts.tsx:322-326, 558-583)
The `ConnectionSettings` component receives `onUpdate` callback but never calls it and provides no way to edit settings. The `onUpdate` is passed as `() => {}` (noop). Users see their settings but cannot change them from the UI.

### 14. Import endpoint processes contacts sequentially with N+1 queries (email-connections/[id]/contacts/import/route.ts:53-133)
Each contact in the import array results in 2-3 separate DB queries (check existing, check workspace, upsert settings). For large imports this will be extremely slow and could timeout.

### 15. `fetchSentToContacts` makes up to 1000 sequential API calls (gmail.ts:288-331)
10 pages × 100 messages, each fetched individually with `getMessageMetadata`. Even with batching of 20, this is 50 sequential rounds of API calls with no caching. For users with many sent emails, this endpoint will be very slow or timeout.

## Low

### 16. Silently swallowed errors in frontend (my-email-contacts.tsx:54, 165)
Both `fetchConnections` and `fetchContacts` catch errors and ignore them (`// ignore`). The user gets no feedback if their connections or contacts fail to load — they just see an empty state.

### 17. `toggleSelectAll` logic bug with filtered results (my-email-contacts.tsx:254-261)
The "select all" checkbox compares `selected.size` against filtered importable contacts, but `selected` may contain emails from a previous filter. Toggling "select all" with a search filter active can leave stale selections from other filter states.

### 18. Email address matching is case-sensitive in sync worker (sync-email-interactions.ts:83, 146)
Contact emails are lowercased when building `emailToContact` map, but `parseEmailAddresses` also lowercases. However, the `contacts.email` field from the DB (`contactRows` query on line 75) is **not** lowercased, so if a contact's email was stored with mixed case, it won't match.

### 19. No pagination on contacts endpoint (email-connections/[id]/contacts/route.ts)
The `GET /api/email-connections/:id/contacts` endpoint fetches ALL Gmail sent contacts and ALL matching CRM contacts with no pagination. For users with thousands of email contacts, this will return a massive response.

### 20. `inArray` with empty array not guarded everywhere (email-contact-settings/route.ts:30)
If `connectionIds` is empty (which is guarded), but `inArray` with an empty array in some ORMs produces invalid SQL. The code does guard for `userConnections.length === 0` on line 21, but the pattern is inconsistent — in `contacts/route.ts:69` `existingIds` could be empty if `existingContacts` is empty, but it uses a ternary guard. One path may be missed in future changes.

### 21. OAuth callback does not verify workspace context (auth/gmail/callback/route.ts:61)
`getActiveWorkspaceId(request)` reads from cookies/headers, but during an OAuth redirect, the workspace cookie may not be reliably set (the user was redirected through Google). The connection could be created in the wrong workspace.

### 22. `providerMessageId` index is not unique (interactions.ts:21)
The dedup check (`sync-email-interactions.ts:125-128`) relies on querying `providerMessageId`, but the index is non-unique. Under concurrent sync jobs (see bug #7), two workers could both pass the dedup check and insert duplicate interactions.

### 23. Dynamic import of `inArray` in route handler (email-contact-settings/route.ts:26)
```ts
const { inArray } = await import("drizzle-orm");
```
`inArray` is dynamically imported despite `and` and `eq` being statically imported from the same module on line 5. This is unnecessary and adds latency to every request.
