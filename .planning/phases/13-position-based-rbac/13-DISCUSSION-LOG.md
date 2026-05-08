# Phase 13: Position-Based RBAC - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 13-position-based-rbac
**Areas discussed:** Permission matrix, Guard design, Sidebar filtering, Position matching

---

## All Areas

| Option | Description | Selected |
|--------|-------------|----------|
| Permission matrix | Which positions can access which endpoints | ✓ |
| Guard design | How requirePosition() should work | ✓ |
| Sidebar filtering | How officer sidebar filters nav by position | ✓ |
| Position matching | Match by title string vs position ID vs enum | ✓ |

**User's choice:** "your call" — delegated all decisions to Claude
**Notes:** User selected all areas but deferred all decisions. Claude made implementation choices based on existing codebase patterns and domain knowledge.

---

## Claude's Discretion

All four areas were delegated:
- **Permission matrix** — Defined President-superset, Treasurer-finance, Secretary-admin, Society Officer-events mapping based on Philippine dental association officer responsibilities
- **Guard design** — Extended `requireOfficerTerm` pattern with `requirePosition(allowedTitles[])`, multi-position OR logic
- **Sidebar filtering** — Data-level filtering via config object, AppSidebar stays generic
- **Position matching** — Title string matching (case-insensitive) for v1, deferred capabilities JSONB

## Deferred Ideas

- Custom position titles per organization
- Granular per-endpoint permissions
- Position hierarchy inheritance
