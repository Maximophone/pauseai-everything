# End-of-session wrapup

You are wrapping up a development session. Your job is to make sure everything that happened is properly recorded and that all documentation is accurate. This is a quality gate — nothing ships with stale docs.

## Step 1: Understand what happened

Run `git log` to see all commits since the last DEVLOG.md entry (check the date of the topmost entry). Also run `git diff` against the base branch if relevant. Build a clear picture of what was done, what decisions were made, and what's left open.

## Step 2: Write the devlog entry

Add a new entry at the top of `DEVLOG.md` (below the header). Format:

```
## YYYY-MM-DD — Short title describing the session

**What:** 1-2 sentence summary of what was accomplished.

**Key changes:**
- Bullet list of significant files/modules changed and why

**Decisions:**
- Any architectural or design decisions made and the reasoning
- Only include decisions that future-you would want to know about

**Open items:**
- Anything deferred, blocked, or left for next session
```

All sections except **What** are optional — skip them if there's nothing meaningful to say. Keep it concise. The devlog is for the development team, not for users.

If multiple days have passed since the last entry, use git history to reconstruct what happened and write separate entries for each day if the work clearly clusters by date. If it's ambiguous, one combined entry is fine.

## Step 3: Update documentation — THOROUGH SCAN REQUIRED

This step is critical. Stale docs are worse than no docs.

### 3a. Enumerate all documentation files

Use `Glob` to find ALL `.md` files in the repository (excluding `node_modules/`). This typically includes:
- `CLAUDE.md` — project instructions for AI assistants
- `DEVLOG.md` — dev log (handled in Step 2)
- `BUGS.md` — bug tracker
- `docs/architecture.md` — system architecture
- `docs/features.md` — feature descriptions
- `docs/development.md` — dev setup and workflow
- `docs/deployment.md` — production deployment
- `docs/api-reference.md` — API endpoint docs
- `docs/specs/workspaces.md` — multi-tenancy spec (historical design spec)
- `docs/specs/gmail-integration.md` — email integration design (historical design spec)
- `docs/specs/crm-research-brief.md` — initial CRM research (historical)
- `docs/audits/` — security audits and reports
- `docs/build-plan.md` — project phases
- Any other docs that may have been added

### 3b. Triage each file

For every doc file found, quickly read it and decide:
- **Needs update** — the session's changes introduced new concepts, env vars, tables, endpoints, or features that should be reflected here
- **No update needed** — the session's changes don't affect this document

Output a triage list showing your assessment for each file BEFORE making edits, e.g.:
```
Doc triage:
- CLAUDE.md — NEEDS UPDATE (new env var, new module references)
- docs/architecture.md — NEEDS UPDATE (new table, new interception layer)
- docs/features.md — NEEDS UPDATE (new feature section needed)
- docs/development.md — NEEDS UPDATE (new env var for dev workflow)
- docs/deployment.md — NEEDS UPDATE (new production env var)
- docs/api-reference.md — NEEDS UPDATE (new API endpoints)
- docs/specs/workspaces.md — no update needed (historical spec)
- docs/specs/gmail-integration.md — no update needed (historical spec)
- docs/build-plan.md — no update needed
- BUGS.md — no update needed
```

### 3c. Update each flagged file

For each file that needs updates, read it fully and make the necessary changes. Think about it from two angles:

**Developer-facing docs** — Would a new developer reading these docs get an accurate picture of how the system works? Check:
- Architecture descriptions (new tables, modules, data flows)
- API endpoint documentation (new routes, request/response schemas)
- Environment variable references (new env vars, changed defaults)
- Setup instructions (new steps needed for dev workflow)
- Code conventions and patterns (new patterns introduced)
- The CLAUDE.md project instructions (new module references, conventions)

**User-facing docs** — Would a user reading these docs understand how to use the features that were changed? Check:
- Feature descriptions and how-to guides
- UI changes (new pages, banners, navigation items)
- Configuration options

### Common mistakes to avoid
- Adding a new env var but only documenting it in one place (it should be in development.md, deployment.md, CLAUDE.md, and architecture.md as appropriate)
- Adding a new feature but not updating features.md
- Adding new DB tables but not updating architecture.md
- Adding new API endpoints but not updating api-reference.md
- Changing a default behavior (like email mode defaulting to sandbox) without making it prominent in development docs

## Step 4: Update BUGS.md if relevant

If bugs were found or fixed in this session, make sure BUGS.md reflects the current state.

## Step 5: Commit and push

Commit all documentation changes (devlog + any doc updates) in a single commit. Use the message format: `docs: wrapup — <short description>`. Push to the current branch.

## Important

- The devlog is append-only and self-contained. Missing entries are fine — just write the next one.
- Don't fabricate information. If you're unsure what happened, say so and note what you can confirm from git history.
- Keep entries scannable. Someone should be able to skim the devlog and understand the project's trajectory.
