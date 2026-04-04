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

## Step 3: Update documentation

Scan ALL markdown files in the repository (outside node_modules) for anything that's now stale or incomplete given the changes in this session. Think about it from two angles:

**Developer-facing docs** — Would a new developer reading these docs get an accurate picture of how the system works? Check things like:
- Architecture descriptions
- API endpoint documentation
- Environment variable references
- Setup instructions
- Code conventions and patterns
- The CLAUDE.md project instructions

**User-facing docs** — Would a user reading these docs understand how to use the features that were changed? Check things like:
- Feature descriptions
- User guides
- API reference (request/response schemas, auth requirements)

Don't mechanically check every file — use your judgment about which docs are likely affected by the session's changes. Read them and fix what's wrong. If nothing needs updating, say so and move on.

## Step 4: Update BUGS.md if relevant

If bugs were found or fixed in this session, make sure BUGS.md reflects the current state.

## Step 5: Commit and push

Commit all documentation changes (devlog + any doc updates) in a single commit. Use the message format: `docs: wrapup — <short description>`. Push to the current branch.

## Important

- The devlog is append-only and self-contained. Missing entries are fine — just write the next one.
- Don't fabricate information. If you're unsure what happened, say so and note what you can confirm from git history.
- Keep entries scannable. Someone should be able to skim the devlog and understand the project's trajectory.
