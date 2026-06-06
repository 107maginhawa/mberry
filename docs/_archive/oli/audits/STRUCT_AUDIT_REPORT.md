# Structure Audit Report

**Project:** Memberry Healthcare Association Management Platform
**Date:** 2026-05-30
**Auditor:** oli-structure-audit v1 (automated)
**Stack:** Bun monorepo — Hono API + Vite/React frontend + TanStack Router
**Scope:** services/api-ts/src, apps/memberry/src, apps/admin/src, packages/sdk-ts/src, packages/ui/src
**Prior run:** 2026-05-27 (delta below)

---

## Delta Since 2026-05-27

**Structural Health: 7.4 → 8.8 (+1.4).** All P0 and all P1 findings resolved.

| ID | Sev | Status | Note |
|----|-----|--------|------|
| SA-DUP-001 | P0 | ✅ RESOLVED | `dues/jobs/reminderProcessor.test.ts` deleted; canonical copy in `association:member/jobs/` retained |
| SA-DUP-002 | P0 | ✅ RESOLVED | `dues/jobs/webhookRetryProcessor.test.ts` deleted |
| SA-CIRC-001 | P1 | ✅ RESOLVED | `EmailConfig` extracted to `core/email-types.ts`; `config.ts` no longer imports `core/email` |
| SA-CIRC-002 | P1 | ✅ RESOLVED | `config.ts` imports none of billing/logger — 3-node cycle broken |
| SA-CIRC-003 | P1 | ✅ RESOLVED | `types/app.ts` no longer imports `core/auth`; edge is now one-way (auth → app) |
| SA-CIRC-004 | P1 | ✅ RESOLVED | Shared types extracted to `membership/import-types.ts`; `csvImport` no longer imports `importMembers` |
| SA-ARCH-001 | P2 | ✅ RESOLVED | Root `ARCHITECTURE.md` has 0 `apps/account` references (2-app layout) |
| SA-CONFIG-001 | P2 | ✅ RESOLVED | `services/api-ts/.env` now matched by `.gitignore` (`git check-ignore` confirms) |
| SA-SIZE-007 | P2 | ✆ NEW | `core/domain-event-consumers.ts` at 1125 LOC (cross-module event registration) |

HEAD SHA `dff13f3e` matches the codebase-map SHA — file-level graph is current.

---

## Executive Summary

**Structural Health: 8.8 / 10**

| Dimension | Score | Weight | Notes |
|-----------|-------|--------|-------|
| Folder structure compliance | 9.0 | 25% | Standard monorepo layout. ARCHITECTURE.md now current (2-app). |
| Dependency graph health | 8.5 | 30% | All 4 circular deps resolved. Only expected core hubs remain. |
| File organization quality | 8.5 | 25% | Duplicates resolved. Naming + colocation clean. A few large files. |
| Config hygiene | 9.5 | 20% | No secrets in git. `.env` explicitly ignored. Per-workspace config. |

**Findings by severity:**

| Severity | Count | Δ |
|----------|-------|---|
| P0 | 0 | −1 |
| P1 | 0 | −4 |
| P2 | 9 | ±0 (−2 resolved, +1 new) |
| P3 | 3 | −1 |
| **Total** | **12** | **−7** |

---

## 1. Scaffold Compliance

**Status: PASS**

| Directory | Expected | Exists |
|-----------|----------|--------|
| docs/product/ | Y | Y |
| docs/product/modules/ | Y | Y (22 modules) |
| docs/audits/ | Y | Y |
| services/api-ts/src/core/ | Y | Y |
| services/api-ts/src/handlers/ | Y | Y (26 dirs) |
| services/api-ts/src/generated/ | Y | Y |
| services/api-ts/src/types/ | Y | Y |
| services/api-ts/src/utils/ | Y | Y |

No missing scaffold directories.

---

## 2. ARCHITECTURE.md Convention Compliance

| ID | Severity | Finding |
|----|----------|---------|
| SA-ARCH-002 | P3 | **Module structure section generic.** ARCHITECTURE.md "Module Structure" describes the pattern but doesn't list the 26 actual handler directories or their relationships. |

`SA-ARCH-001` (stale `apps/account` reference) — **RESOLVED** since prior run.

---

## 3. Duplicate Detection

### Identical Content

No diverged or identical cross-directory duplicates. **CLEAN.**

`SA-DUP-001`/`SA-DUP-002` (test-file copies in `dues/jobs/`) — **RESOLVED**: the `dues/jobs/` copies were deleted; canonical copies remain in `association:member/jobs/`.

### Same-Name Files (expected in monorepo)

20+ files share names across `apps/memberry/src/routes/` and `services/api-ts/src/handlers/` (e.g., `cancelEvent.ts`, `auth.ts`). **Expected** — frontend route files and backend handlers share domain names. **No action.**

---

## 4. Dead File Detection

**Method:** Import graph across `services/api-ts/src/` (excluding generated/, seed/, *.test.ts, *.d.ts).

No unreferenced source files detected.

> Dynamic imports (`import()`) and framework entry points (app.ts, index.ts) excluded from candidates.

---

## 5. Circular Dependency Scan

**0 production cycles. 2 test-only self-references.**

| ID | Severity | Cycle | Impact |
|----|----------|-------|--------|
| SA-CIRC-005 | P3 | `test-utils/factories` → `test-utils/factories` | Self-reference (re-export). Test-only. |
| SA-CIRC-006 | P3 | `tests/helpers/api-available` → `tests/helpers/api-available` | Self-reference. Test-only. |

All 4 production/handler cycles from the prior run (SA-CIRC-001..004) — **RESOLVED**. Shared types were extracted into dedicated modules (`core/email-types.ts`, `membership/import-types.ts`) and config/auth edges were made one-way.

---

## 6. Naming Convention Enforcement

**Convention:** camelCase handler files, kebab-case frontend components, $param TanStack dynamic segments.

| Scope | Convention | Violations | Status |
|-------|-----------|------------|--------|
| Backend handlers | camelCase | 0 | CLEAN |
| Frontend routes | TanStack ($param, _layout) | 0 | CLEAN |
| Frontend components | kebab-case | 0 | CLEAN |
| Schema files | camelCase.schema.ts | 0 | CLEAN |
| Repo files | camelCase.repo.ts | 0 | CLEAN |
| Test files | camelCase.test.ts | 0 | CLEAN |

No violations.

---

## 7. Colocation Audit

Test files colocated with handlers. Consistent across all 26 handler directories.

| Pattern | Convention | Status |
|---------|-----------|--------|
| Test colocation | handler.test.ts next to handler.ts | Consistent |
| Schema colocation | In `repos/` subdirectory | Consistent |
| Job colocation | In `jobs/` subdirectory | Consistent |
| Utils colocation | In `utils/` subdirectory | Consistent |

No inconsistencies.

---

## 8. Barrel File Health

**~30 barrel files (index.ts/index.tsx).**

| Category | Count | Status |
|----------|-------|--------|
| Route index files (TanStack Router) | 20 | Expected — framework convention |
| Job registry barrels (handlers/*/jobs/index.ts) | 9 | Expected — job registration pattern |
| App entry (services/api-ts/src/index.ts) | 1 | Expected |

No barrel-chain depth issues, no circular barrels, no unused re-exports. **CLEAN.**

---

## 9. Config Sprawl

**14 config files across 6 workspaces.**

| Category | Files | Status |
|----------|-------|--------|
| .env.example | 3 (root, admin, memberry) | Expected |
| .env (actual) | 1 (services/api-ts/.env) | Git-ignored — CLEAN |
| tsconfig.json | 5 | Per-workspace, extends shared |
| eslint.config.js | 4 | Per-workspace, extends shared |

No conflicting values across environments. No orphan configs.

`SA-CONFIG-001` (`.env` not explicitly ignored) — **RESOLVED**: `git check-ignore services/api-ts/.env` now matches.

---

## 10. Fan-In / Fan-Out Analysis

### Fan-In (most imported — fragile hubs)

| File | Fan-In | Threshold | Status |
|------|--------|-----------|--------|
| @/core/database | 595 | 20 | HUB — expected for DB access |
| @/core/errors | 591 | 20 | HUB — expected for error module |
| @/types/app | 467 | 20 | HUB — expected for type definitions |
| @/utils/audit | 230 | 20 | HUB — cross-cutting concern |
| @/utils/officer-check | 111 | 20 | HUB — auth utility |

| ID | Severity | Finding |
|----|----------|---------|
| SA-FAN-001 | P2 | **`@/utils/audit` at 230 fan-in** (was 182) is a fragile hub. Signature changes cascade across 230 files. Consider interface stability guarantees. |
| SA-FAN-002 | P2 | **`@/utils/officer-check` at 111 fan-in** (was 98) — signature changes cascade widely. |

> Core modules (database, errors, types) at 460–600 fan-in are expected for a monolith API — stable interfaces unlikely to change.

### Fan-Out (most imports)

| File | Fan-Out | Threshold | Status |
|------|---------|-----------|--------|
| handlers/person/accountDeletionCascade.ts | 21 | 15 | HIGH — expected for cascade delete |

| ID | Severity | Finding |
|----|----------|---------|
| SA-FAN-003 | P2 | **accountDeletionCascade.ts (21 imports)** exceeds threshold. Imports 10+ handler repos to cascade deletion. Architecturally correct but a maintenance risk. Consider a domain-event-driven cascade. |

---

## 11. Filesystem Hygiene

### Build Artifacts in Git

No build artifacts tracked. `.env`, `node_modules/`, `dist/`, `.next/`, `.turbo/` all gitignored. **CLEAN.**

### Deep Nesting (>6 path segments)

| ID | Severity | Finding |
|----|----------|---------|
| SA-NEST-001 | P2 | **~50 files in apps/memberry/src/routes/ exceed 6 segments.** Example: `_authenticated/org/$orgSlug/officer/communications/templates/index.tsx` (8 segments). **Expected** for TanStack file-based routing — path depth mirrors URL. No action. |

### Large Source Files (>500 LOC, non-generated, non-test)

| ID | Severity | File | LOC | Notes |
|----|----------|------|-----|-------|
| SA-SIZE-001 | P2 | handlers/billing/handleStripeWebhook.ts | 974 | Grew from 732. Webhook handler with many event types. Split by event type. |
| SA-SIZE-007 | P2 | core/domain-event-consumers.ts | 1125 | NEW. Cross-module event registration. Thin glue, but consider grouping consumers by bounded context. |
| SA-SIZE-002 | P2 | core/email.ts | 633 | Email service + template rendering. Consider extracting template engine. |
| SA-SIZE-003 | P2 | core/jobs.ts | 617 | Job scheduler + job type definitions. Consider splitting job types. |
| SA-SIZE-004 | P2 | core/billing.ts | 549 | Stripe integration. Consider extracting invoice helpers. |
| SA-SIZE-006 | P3 | core/auth.ts | 646 | Grew from 537. Better-Auth config. Complex but stable. |
| SA-SIZE-005 | P3 | test-utils/factories.ts | 661 | Test factory definitions. Large but single-purpose (test-only). |

> Seed files (`seed/layer-5-gap-fill.ts` 1312, `seed/layer-4-cross-module.ts` 954) and large `*.test.ts` files are excluded — seed and test scaffolding are not production components. 7 generated files exceed 500 LOC (types.gen.ts at ~50k) — excluded.

### Empty Directories

None found. **CLEAN.**

---

## Finding Summary

| ID | Sev | Category | Description |
|----|-----|----------|-------------|
| SA-FAN-001 | P2 | Fan-in | @/utils/audit 230 consumers (fragile hub) |
| SA-FAN-002 | P2 | Fan-in | @/utils/officer-check 111 consumers |
| SA-FAN-003 | P2 | Fan-out | accountDeletionCascade.ts 21 imports |
| SA-NEST-001 | P2 | Nesting | ~50 route files >6 segments (expected, TanStack) |
| SA-SIZE-001 | P2 | File size | handleStripeWebhook.ts 974 LOC |
| SA-SIZE-007 | P2 | File size | core/domain-event-consumers.ts 1125 LOC (new) |
| SA-SIZE-002 | P2 | File size | core/email.ts 633 LOC |
| SA-SIZE-003 | P2 | File size | core/jobs.ts 617 LOC |
| SA-SIZE-004 | P2 | File size | core/billing.ts 549 LOC |
| SA-ARCH-002 | P3 | Architecture | Module structure section generic |
| SA-SIZE-006 | P3 | File size | core/auth.ts 646 LOC (stable) |
| SA-SIZE-005 | P3 | File size | test-utils/factories.ts 661 LOC (test-only) |

---

## Stabilization Plan

### Immediate (P0/P1)
None. All critical and high findings from the prior run are resolved.

### When Touching (P2)
1. **Split large core files** — handleStripeWebhook.ts (974), domain-event-consumers.ts (1125), email.ts, jobs.ts, billing.ts when next modifying.
2. **Stabilize hub interfaces** — `@/utils/audit` (230) and `@/utils/officer-check` (111): freeze signatures or version on change.
3. **Reconsider accountDeletionCascade.ts** — domain-event-driven cascade instead of 21 direct repo imports.

### Track (P3)
4. List handler directories in ARCHITECTURE.md module-structure section.
5. Log file-size observations on auth.ts / factories.ts. No action needed.

---

## What's Next

**0 P0 + 0 P1.** Structure is clean for new development work.

Run `/oli-check --discovery` for full code-quality assessment, or `/oli-check --compliance` to re-verify the compliance score.

---

*Generated by oli-structure-audit v1. Point-in-time filesystem and import-graph analysis at HEAD `dff13f3e`. Stack: Bun monorepo (Hono + Vite/React/TanStack). Import graph built from services/api-ts/src/ (excluding generated, seed, test, .d.ts files).*
