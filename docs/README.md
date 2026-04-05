# Documentation Structure

This folder contains all project documentation, organized into categories.

## Actively maintained docs

These reflect the current state of the system and are kept up to date as features change. Most are **served on the frontend** at `/dashboard/docs` (configured in `src/lib/docs-manifest.ts`).

| File | Description | On frontend? |
|------|-------------|:------------:|
| `architecture.md` | System design, data model, tables, key patterns | Yes |
| `api-reference.md` | Full REST API reference — auto-generated from Zod schemas (`npm run docs:api`) | Yes |
| `development.md` | Local dev setup, env vars, sandbox mode, workflow guides | Yes |
| `deployment.md` | Production deployment on Railway, env vars, service config | Yes |
| `features.md` | Feature descriptions — what's built, what's planned | Yes |
| `build-plan.md` | 12-phase build progression with completion status | Yes |
| `future-features.md` | Ideas and backlog items not yet planned | Yes |
| `user-guide/` | End-user documentation (contacts, email, settings, etc.) | Yes |

## `specs/` — Historical design specifications

Design documents written **before or during** feature implementation. These capture the original intent and design thinking, but **may not reflect the current state** of the software — the implementation may have departed from the spec.

These are valuable for understanding *why* things were built a certain way, but for *how* things work now, refer to the actively maintained docs above.

| File | Description |
|------|-------------|
| `specs/workspaces.md` | Multi-tenancy (workspaces) design specification |
| `specs/gmail-integration.md` | Personal email integration (Gmail) design |
| `specs/crm-research-brief.md` | Initial CRM research and requirements gathering |

**New feature specs should always be placed in `specs/`.** When a spec leads to implementation, the actively maintained docs (architecture, features, development) should be updated to reflect what was actually built.

## `audits/` — Audits and reports

One-off assessments, security audits, and investigative reports. These are point-in-time snapshots and are not updated after the fact (though findings may be tracked in `BUGS.md`).

| File | Description |
|------|-------------|
| `audits/api-blackbox-audit-2026-04-04.md` | API security black-box audit (86 scenarios, 28 findings) |

## Root-level docs (outside `docs/`)

| File | Description |
|------|-------------|
| `CLAUDE.md` | Project instructions for AI assistants (Claude Code) |
| `DEVLOG.md` | Reverse-chronological development session log |
| `BUGS.md` | Bug tracker — audit findings and fix status |
| `README.md` | Project overview and quick start |
