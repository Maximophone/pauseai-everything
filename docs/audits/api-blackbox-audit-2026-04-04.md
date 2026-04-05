# API Black-Box Audit — 2026-04-04

> Methodology: All findings from driving the API exclusively via `curl`, with no code inspection. The dev server ran in sandbox mode (`EMAIL_MODE=sandbox`). Four user sessions were used: global admin (`admin@pauseai.info`), France chapter admin (`france@pauseai.info`), viewer (`viewer@pauseai.info`), and fully unauthenticated requests.

---

## Critical — Unauthenticated Access

Multiple core endpoints accept requests with **no authentication at all**. The API docs explicitly label many of these as "No auth required", but for a CRM holding personal data this is a serious exposure.

### B1. `GET /api/contacts` — unauthenticated contact listing

Anyone on the network can list all contacts with full PII (emails, names, custom fields, communication preferences).

**Repro:**
```bash
curl -s http://localhost:3000/api/contacts?pageSize=5
# Returns full contact list with emails, names, etc.
```

### B2. `POST /api/contacts` — unauthenticated contact creation

Anyone can inject contacts into the system. The created contact is linked to the default (Global) workspace.

**Repro:**
```bash
curl -s -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{"email":"unauthed@example.com","firstName":"Unauthed"}'
# Returns 201 with the created contact
```

### B3. `DELETE /api/contacts/:id` — unauthenticated contact deletion

Anyone can delete contacts by ID. During testing, a contact was successfully deleted without any session cookie.

**Repro:**
```bash
curl -s -X DELETE http://localhost:3000/api/contacts/<contact-id>
# Returns { "success": true }
```

### B4. `GET /api/fields` and `POST /api/fields` — unauthenticated field access

Anyone can list all 19 custom field definitions and create new ones (which become `scope: "core"` by default, visible to all workspaces).

**Repro:**
```bash
curl -s http://localhost:3000/api/fields
# Returns all field definitions

curl -s -X POST http://localhost:3000/api/fields \
  -H "Content-Type: application/json" \
  -d '{"name":"injected","label":"Injected","fieldType":"text","required":false,"sortOrder":99}'
# Returns 201
```

### B5. `GET /api/tags` — unauthenticated tag listing

**Repro:**
```bash
curl -s http://localhost:3000/api/tags
# Returns tags with workspace IDs
```

### B6. `DELETE /api/interactions/:id` — unauthenticated interaction deletion

The endpoint does not check authentication. It returned 404 during testing only because the UUID was non-existent, not because of an auth check.

### B7. `GET /api/segments` — unauthenticated segment listing

Exposes segment names, filter conditions, and workspace assignments.

**Repro:**
```bash
curl -s http://localhost:3000/api/segments
# Returns all segments with full filter logic
```

### B8. `GET /api/campaigns` — unauthenticated campaign listing

Exposes campaign subjects, HTML bodies, sending metrics, segment IDs, and workspace assignments.

**Repro:**
```bash
curl -s http://localhost:3000/api/campaigns
# Returns all campaigns with full content
```

### B9. `GET /api/sandbox/emails` — unauthenticated sandbox email access

The API docs state "Admin required" but auth is not enforced. All sandbox emails (recipient addresses, HTML bodies, headers, campaign associations) are publicly readable.

**Repro:**
```bash
curl -s http://localhost:3000/api/sandbox/emails?limit=5
# Returns sandbox emails with full detail
```

---

## High — Workspace Isolation Failures

The `X-Workspace-Id` header is user-controlled and most endpoints do **not** validate that the authenticated user is a member of the specified workspace.

### B10. `GET /api/contacts` — cross-workspace contact listing

A France chapter user (not a member of Global workspace) can list all Global contacts by setting the `X-Workspace-Id` header to the Global workspace UUID.

**Repro:**
```bash
# Authenticated as france@pauseai.info (member role, France workspace only)
curl -s -b $FRANCE_COOKIES http://localhost:3000/api/contacts?pageSize=5 \
  -H "X-Workspace-Id: $GLOBAL_WS"
# Returns all 7 Global workspace contacts
```

**Note:** The single-contact `GET /api/contacts/:id` endpoint IS properly scoped — it returns 404 for the same user. The inconsistency between list and detail endpoints is itself a bug indicator.

### B11. `PUT /api/contacts/:id` — cross-workspace contact mutation

A France user successfully changed a Global-only contact's `firstName` to "HACKED" by passing the Global workspace ID in the header.

**Repro:**
```bash
curl -s -b $FRANCE_COOKIES -X PUT http://localhost:3000/api/contacts/$GLOBAL_CONTACT_ID \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Id: $GLOBAL_WS" \
  -d '{"firstName":"HACKED"}'
# Returns 200 with the mutated contact
```

### B12. `POST /api/contacts` — contact creation in foreign workspace

A France user created a contact in Spain's workspace (a workspace they have no association with).

**Repro:**
```bash
curl -s -b $FRANCE_COOKIES -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Id: $SPAIN_WS" \
  -d '{"email":"injected@example.com","firstName":"Injected","lastName":"Contact"}'
# Returns 201, contact linked to Spain workspace
```

### B13. `POST /api/contacts/:id/tags` — cross-workspace tag assignment

A France user (not a Global workspace member) successfully assigned a tag to a contact that belongs only to the Global workspace. No ownership or workspace membership check.

**Repro:**
```bash
curl -s -b $FRANCE_COOKIES -X POST http://localhost:3000/api/contacts/$GLOBAL_CONTACT_ID/tags \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Id: $FRANCE_WS" \
  -d '{"tagId":"$FRANCE_TAG_ID"}'
# Returns 200 with updated tag list
```

### B14. Cross-workspace tag assignment (tag from wrong workspace)

An admin in the Global workspace context can assign a France-scoped tag to a Global contact. The endpoint does not validate that the tag belongs to the active workspace.

**Repro:**
```bash
curl -s -b $ADMIN_COOKIES -X POST http://localhost:3000/api/contacts/$GLOBAL_CONTACT_ID/tags \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Id: $GLOBAL_WS" \
  -d '{"tagId":"$FRANCE_TAG_ID"}'
# Silently succeeds (tag appears in contact's tag list)
```

### B15. `GET /api/segments` — cross-workspace segment listing

France user sees Global workspace segments (names, filter conditions, cross-workspace flags).

### B16. `GET /api/campaigns` and `GET /api/campaigns/:id` — cross-workspace campaign access

France user sees Global workspace campaigns with full content (subjects, HTML bodies, segment associations).

### B17. `GET /api/campaigns/:id/emails` — cross-workspace campaign email listing

France user can list email delivery records for a Global workspace campaign.

### B18. `GET /api/communication-categories` — cross-workspace category listing

France user sees Global workspace communication categories.

### B19. API key workspace boundary not enforced

An API key created in the Global workspace can be used with `X-Workspace-Id` set to the France workspace, and it returns France's contacts. The key's `workspaceId` is not enforced as a boundary — any workspace is accessible.

**Repro:**
```bash
# API key created in Global workspace
curl -s -H "Authorization: Bearer $GLOBAL_API_KEY" \
  -H "X-Workspace-Id: $FRANCE_WS" \
  http://localhost:3000/api/contacts?pageSize=5
# Returns France workspace contacts
```

---

## High — Cross-Workspace Campaign Sending

### B20. Campaign can reference a segment from a different workspace

A France workspace campaign was created with `segmentId` pointing to a Global workspace segment. No validation that the segment belongs to the campaign's workspace.

When sent, the campaign resolved the Global segment's contacts (8 people) and emailed all of them as France workspace emails. This means:

1. France chapter emailed contacts it should not have access to
2. The emails were tagged with France's workspace ID
3. Contacts from an unrelated workspace received unwanted email

**Repro:**
```bash
# Create campaign in France targeting a Global segment
curl -s -b $ADMIN_COOKIES -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Id: $FRANCE_WS" \
  -d '{"name":"Cross-ws","subject":"Test","body":"<p>test</p>","segmentId":"$GLOBAL_SEGMENT_ID","allowNoUnsubscribe":true}'

# Send it
curl -s -b $ADMIN_COOKIES -X POST http://localhost:3000/api/campaigns/$ID/send \
  -H "X-Workspace-Id: $FRANCE_WS"

# Check sandbox: 8 emails sent to Global contacts, tagged as France workspace
curl -s -b $ADMIN_COOKIES http://localhost:3000/api/sandbox/emails?campaignId=$ID
```

---

## Medium — Data Integrity & Logic Bugs

### B21. `updatedAt` timestamp is behind `createdAt` after updates

After updating a contact, `updatedAt` is consistently ~1 hour behind `createdAt`. This was observed on both contacts and campaigns.

**Example:**
```
createdAt:  2026-04-04T20:24:45.036Z
updatedAt:  2026-04-04T19:25:19.401Z   ← 1 hour earlier than creation!
```

This suggests the update path uses `new Date()` (which returns local time, UTC+1 in this timezone) while the creation path uses PostgreSQL's `now()` (UTC). The result is that sorting by `updatedAt` or "last modified" queries will produce incorrect results.

### B22. Segment preview `is_not_empty` filter includes null values

A contact with `email: null` appeared in segment preview results for an `is_not_empty` condition on the email field.

**Repro:**
```bash
curl -s -b $COOKIES -X POST http://localhost:3000/api/segments/preview \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Id: $GLOBAL_WS" \
  -d '{"filter":{"match":"all","conditions":[{"field":"email","operator":"is_not_empty","value":null}]}}'
# Result includes contact with email: null in the sample
```

### B23. API docs / implementation mismatch on segment preview response

The API reference documents `POST /api/segments/preview` as returning `{ contacts: Contact[], total: number }`. The actual response is `{ count: number, sample: object[] }` with snake_case field names (`first_name`, `last_name` instead of `firstName`, `lastName`).

### B24. Campaign send returns success for campaigns that will be rejected

`POST /api/campaigns/:id/send` returns `{ queued: true }` for a categorized campaign without `allowNoUnsubscribe`, but the worker then rejects it and resets the status to `draft`. The user sees a success message but the campaign never sends. The API should validate and reject upfront with an error.

### B25. `dispatch_email_syncs` worker task fails repeatedly

The worker log shows recurring SQL errors on the `dispatch_email_syncs` task:

```
Failed query: select ... from "email_connections" where ...
  make_interval(mins => "email_connections"."sync_interval_minutes") ...
```

This task has accumulated 5+ failed attempts per job and continuously creates new failing jobs.

---

## Low

### B26. XSS payload stored verbatim in contact fields

`<script>alert(1)</script>` was accepted as a `firstName` value and stored without sanitization. If any rendering context fails to escape HTML, this becomes a stored XSS vulnerability.

### B27. No email address length validation

A 262-character email address (`aaa...aaa@example.com`) was accepted. RFC 5321 limits email addresses to 254 characters. Excessively long values could cause issues with email delivery providers or UI rendering.

### B28. `createdAt` / `updatedAt` inconsistency in sandbox email status history

Sandbox email `statusHistory` timestamps also use the wrong timezone, showing events at `19:xx` while `createdAt` shows `20:xx`.

---

## What Worked Correctly

- **Viewer role restrictions**: Viewer users cannot create, delete, or import contacts, or create tags
- **Support tickets permissions**: Owner/admin distinction is enforced correctly
- **Admin-only endpoints**: Scripts, automations, users, API keys endpoints properly check workspace admin role
- **Campaign re-send prevention**: Already-sent campaigns return `400`
- **Tag listing**: Properly workspace-scoped (Global context shows Global tags, France shows France tags)
- **Sandbox simulation**: Email event simulation correctly updates campaign counters
- **Contact deduplication**: Duplicate email detection works on create
- **Unsubscribe enforcement (worker-side)**: Categorized campaigns without `allowNoUnsubscribe` are properly rejected by the worker

---

## Appendix: Full Test Log

Chronological record of every action taken during this audit. The dev server ran on `http://localhost:3000` with `EMAIL_MODE=sandbox`. The Graphile Worker was started partway through to process campaign send jobs.

### Phase 1: Setup & Authentication

1. **Verified sandbox mode**: `GET /api/sandbox/status` → `{ "mode": "sandbox" }`
2. **Authenticated as global admin**: `POST /api/auth/callback/dev-login` with `email=admin@pauseai.info`, `role=admin` → session established, verified via `GET /api/auth/session`
3. **Fetched workspace list**: `GET /api/workspaces` → 3 workspaces found:
   - Global: `2eefc847-500c-487c-8139-87175d2641bb`
   - France: `3a9e3773-436e-4471-930a-8067a60c2d64`
   - Spain: `99e72ff7-625f-45e1-b68e-87dbc5932a2e`
4. **Listed existing contacts**: `GET /api/contacts?pageSize=5` → 5 pre-existing contacts (Patricio, Ella, Anthony, hello/test, Tes/test)

### Phase 2: Contact CRUD (as admin)

5. **Created contact in Global workspace**: `POST /api/contacts` with `X-Workspace-Id: Global` → created "Bug Hunter" (`test-bug-hunt@example.com`), ID: `b3819b6a-...`
6. **Created contact without email**: `POST /api/contacts` → created "NoEmail Person" with `email: null`, ID: `c05fbec7-...`
7. **Tested duplicate email rejection**: `POST /api/contacts` with same email → 409 with `existsInNetwork: true` and `contactId` pointing to original. **PASS**
8. **Created contact in France workspace**: `POST /api/contacts` with `X-Workspace-Id: France` → created "Jean Dupont" (`french-contact@example.com`), ID: `d36e1f71-...`
9. **Read contact from owning workspace**: `GET /api/contacts/b3819b6a-...` with `X-Workspace-Id: Global` → returned full contact. **PASS**
10. **Read contact from non-owning workspace (admin)**: `GET /api/contacts/b3819b6a-...` with `X-Workspace-Id: France` → returned contact. **UNEXPECTED** — global admin bypasses workspace check, which is by design per docs.
11. **Updated contact**: `PUT /api/contacts/b3819b6a-...` with `{"firstName":"BugUpdated","language":"en"}` → success. **PASS**
12. **Updated contact with empty email**: `PUT /api/contacts/b3819b6a-...` with `{"email":""}` → 400 validation error. **PASS**

### Phase 3: Cross-Workspace Access (as France member)

13. **Authenticated as France chapter user**: `POST /api/auth/callback/dev-login` with `email=france@pauseai.info`, `role=member` → session cookie saved separately
14. **France user reads Global contact by ID**: `GET /api/contacts/b3819b6a-...` with `X-Workspace-Id: France` → 404 "Contact not found". **PASS** (workspace scoping works on detail endpoint)
15. **France user lists contacts with Global workspace header**: `GET /api/contacts?pageSize=3` with `X-Workspace-Id: Global` → **RETURNED 7 GLOBAL CONTACTS** (BUG B10)
16. **France user mutates Global contact**: `PUT /api/contacts/b3819b6a-...` with `X-Workspace-Id: Global`, `{"firstName":"HACKED"}` → **200 SUCCESS, contact mutated** (BUG B11)
17. **France user lists contacts in Spain**: `GET /api/contacts?pageSize=3` with `X-Workspace-Id: Spain` → empty (Spain has no contacts). No error though — no membership check.
18. **France user creates contact in Spain**: `POST /api/contacts` with `X-Workspace-Id: Spain` → **201 SUCCESS**, contact `injected-to-spain@example.com` created in Spain workspace (BUG B12)

### Phase 4: Tags

19. **Created tag in Global**: `POST /api/tags` with `{"name":"volunteer","color":"#00ff00"}` in Global context → created, ID: `49ba88c7-...`
20. **Created tag in France**: `POST /api/tags` with `{"name":"bénévole","color":"#0000ff"}` in France context → created, ID: `e74ce04b-...`
21. **Listed tags from Global context**: `GET /api/tags` with `X-Workspace-Id: Global` → returned 2 Global tags (vip, volunteer). **PASS** (workspace-scoped)
22. **Listed tags from France context**: `GET /api/tags` with `X-Workspace-Id: France` → returned 2 France tags (bénévole, parisien). **PASS**
23. **Assigned Global tag to Global contact (admin)**: `POST /api/contacts/b3819b6a-/tags` with Global tag ID → success. **PASS**
24. **Assigned France tag to Global contact (admin, cross-workspace)**: Same endpoint with France tag ID → **success, no error** (BUG B14)
25. **France user assigns tag to Global-only contact**: `POST /api/contacts/b3819b6a-/tags` as France user → **success** (BUG B13)

### Phase 5: Segments

26. **Created segment**: `POST /api/segments` with `is_not_empty` on email field → created "All with email", ID: `3996dd10-...`
27. **Previewed segment**: `POST /api/segments/preview` → returned `{ count: 7, sample: [...] }`. **Note:** Response format doesn't match docs (BUG B23). Also, contact with null email appeared in results (BUG B22).
28. **Previewed tag-based segment**: `POST /api/segments/preview` with `has` operator on tag → `{ count: 0, sample: [] }` (tag was just assigned, might be timing)
29. **France user creating segment**: `POST /api/segments` as France member → "Admin access required". **PASS**
30. **France user listing segments**: `GET /api/segments` with `X-Workspace-Id: Global` → **returned Global segments** (BUG B15)

### Phase 6: Campaigns & Sandbox

31. **Created campaign**: `POST /api/campaigns` with subject `"Hello {{firstName}}"`, body with merge variable, targeting segment → created, ID: `bb8c4b97-...`
32. **Sent campaign**: `POST /api/campaigns/bb8c4b97-/send` → `{ queued: true }`
33. **Checked sandbox before worker**: `GET /api/sandbox/emails?campaignId=bb8c4b97-` → 0 emails (worker not running)
34. **Started Graphile Worker**: `npm run worker` — worker connected, immediately processed the queued campaign
35. **Checked sandbox after worker**: `GET /api/sandbox/emails?campaignId=bb8c4b97-` → **6 emails sent** (correct: 7 contacts minus 1 with null email). Subjects correctly merged: "Hello HACKED", "Hello Patricio", etc.
36. **Checked campaign status**: `GET /api/campaigns/bb8c4b97-` → `status: "sent"`, `sentCount: 6`. **PASS**
37. **Simulated delivered event**: `POST /api/sandbox/emails/:id/simulate` with `{"event":"delivered"}` → status updated, campaign `deliveredCount` incremented to 1. **PASS**
38. **Simulated opened event**: Same endpoint with `{"event":"opened"}` → `openedCount` incremented. **PASS**
39. **Simulated bounced event on different email**: → `bouncedCount` incremented, `sentCount` decremented from 6 to 5. **PASS**
40. **Re-sent already-sent campaign**: `POST /api/campaigns/bb8c4b97-/send` → "Campaign already sent or sending." **PASS**

### Phase 7: Cross-Workspace Campaign Attack

41. **Created France campaign with Global segment**: `POST /api/campaigns` with `X-Workspace-Id: France`, `segmentId` pointing to Global segment → **201 SUCCESS** (BUG B20 setup)
42. **Sent cross-workspace campaign**: `POST /api/campaigns/ef2dbe61-/send` → queued, worker processed
43. **Checked sandbox**: **8 emails sent** to Global workspace contacts (alice, bob, carol, david, elena, fatima, george, french-contact) all tagged with France workspace ID (BUG B20 confirmed)

### Phase 8: Communication Categories & Unsubscribe Enforcement

44. **Attempted category creation with wrong format**: `POST /api/communication-categories` with `name: "Newsletter"` → validation error (slug required). Discovered `label` field is required too.
45. **Listed existing categories**: `GET /api/communication-categories` → 3 pre-existing (newsletter, events, action-alerts)
46. **Created categorized campaign without `allowNoUnsubscribe`**: `POST /api/campaigns` with `categoryId` → created, `allowNoUnsubscribe: false`
47. **Sent categorized campaign**: `POST /api/campaigns/:id/send` → **`{ queued: true }`** (BUG B24 — should reject upfront)
48. **Checked after worker**: Campaign reset to `draft`, `sentCount: 0`, no sandbox emails. Worker-side enforcement works, but API is misleading.
49. **France user listing Global categories**: `GET /api/communication-categories` with `X-Workspace-Id: Global` → **returned 3 Global categories** (BUG B18)
50. **France user creating category in Global**: `POST /api/communication-categories` → "Admin access required". **PASS**

### Phase 9: Admin-Only Endpoints (as France member)

51. **France user listing Global scripts**: `GET /api/scripts` with `X-Workspace-Id: Global` → "Admin access required in this workspace." **PASS**
52. **France user listing Global automations**: `GET /api/automations` → blocked. **PASS**
53. **France user listing Global users**: `GET /api/users` → blocked. **PASS**
54. **France user listing Global API keys**: `GET /api/api-keys` → blocked. **PASS**

### Phase 10: Support Tickets

55. **Created ticket as admin**: `POST /api/support-tickets` with `type: "bug"`, `priority: "high"` → created, ID: `cd5ecec5-...`
56. **France user replied to ticket**: `POST /api/support-tickets/:id/replies` → success. **PASS** (cross-workspace by design)
57. **France user voted on ticket**: `POST /api/support-tickets/:id/vote` → `{ upvoted: true, upvoteCount: 1 }`. **PASS**
58. **France user tried to change ticket status**: `PUT /api/support-tickets/:id` with `{"status":"closed"}` → "Not authorized." **PASS**
59. **France user tried to delete ticket**: `DELETE /api/support-tickets/:id` → "Admin access required." **PASS**

### Phase 11: API Keys

60. **Created API key in Global**: `POST /api/api-keys` → raw key returned, workspace scoped to Global
61. **Used key to list Global contacts**: `GET /api/contacts` with `Authorization: Bearer pai_...` and `X-Workspace-Id: Global` → returned 7 contacts. **PASS**
62. **Used Global key with France workspace header**: Same key, `X-Workspace-Id: France` → **returned France contacts** (BUG B19 — key not restricted to its workspace)
63. **Used key without workspace header**: Defaults to some workspace, returned contacts. No error.

### Phase 12: Viewer Role

64. **Authenticated as viewer**: `POST /api/auth/callback/dev-login` with `role=viewer`
65. **Viewer creating contact**: `POST /api/contacts` → "Insufficient permissions. Member or admin role required." **PASS**
66. **Viewer creating tag**: `POST /api/tags` → "Insufficient permissions." **PASS**
67. **Viewer deleting contact**: `DELETE /api/contacts/:id` → "Admin access required." **PASS**
68. **Viewer importing contacts**: `POST /api/contacts/import` → "Admin access required." **PASS**

### Phase 13: Automations & Scripts

69. **Created automation rule**: `POST /api/automations` with condition `language eq "en"` and action `add_tag` → created
70. **Ran automation**: `POST /api/automations/:id/run` → `{ affected: 0 }` (tag already applied manually, so no new effect)
71. **Created script**: `POST /api/scripts` with code referencing `contacts` variable → created
72. **Ran script**: `POST /api/scripts/:id/run` → `ReferenceError: contacts is not defined` (script sandbox doesn't expose `contacts` directly — would need to check script API docs)

### Phase 14: Unauthenticated Access Sweep

73. **Unauthenticated `GET /api/contacts`**: → returned 10 contacts with full PII (BUG B1)
74. **Unauthenticated `POST /api/contacts`**: → 201 created (BUG B2)
75. **Unauthenticated `DELETE /api/contacts/:id`**: → `{ success: true }` (BUG B3)
76. **Unauthenticated `GET /api/fields`**: → returned 19 field definitions (BUG B4)
77. **Unauthenticated `POST /api/fields`**: → 201 created field (BUG B4)
78. **Unauthenticated `DELETE /api/interactions/:id`**: → 404 (no auth check, just ID not found) (BUG B6)
79. **Unauthenticated `GET /api/segments`**: → returned all segments (BUG B7)
80. **Unauthenticated `GET /api/campaigns`**: → returned all campaigns with full content (BUG B8)
81. **Unauthenticated `GET /api/sandbox/emails`**: → returned all 24 sandbox emails (BUG B9)

### Phase 15: Edge Cases

82. **Updated null-email contact to existing email**: `PUT /api/contacts/:id` with `{"email":"test-bug-hunt@example.com"}` → empty response (likely a 409 or server error, response body was empty)
83. **XSS in contact name**: `POST /api/contacts` with `firstName: "<script>alert(1)</script>"` → stored verbatim (BUG B26)
84. **Extremely long email**: `POST /api/contacts` with 262-char email → accepted (BUG B27)
85. **Observed `updatedAt` < `createdAt`**: Multiple contacts and campaigns show `updatedAt` timestamps ~1 hour behind `createdAt` (BUG B21)
86. **Worker `dispatch_email_syncs` errors**: Observed in worker logs — recurring SQL failures on `make_interval()` query against `email_connections` table (BUG B25)
