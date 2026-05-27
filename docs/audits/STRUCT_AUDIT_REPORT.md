# Structure Audit Report

**Project:** Memberry Healthcare Association Management Platform
**Date:** 2026-05-27
**Auditor:** oli-structure-audit v1 (automated)
**Stack:** Bun monorepo — Hono API + Vite/React frontend + TanStack Router
**Scope:** services/api-ts/src, apps/memberry/src, apps/admin/src, packages/sdk-ts/src

---

## Executive Summary

**Structural Health: 7.4 / 10**

| Dimension | Score | Weight | Notes |
|-----------|-------|--------|-------|
| Folder structure compliance | 8.0 | 25% | Standard monorepo layout. ARCHITECTURE.md stale. |
| Dependency graph health | 6.5 | 30% | 6 circular deps (3 real, 3 self-ref). Core modules tightly coupled. |
| File organization quality | 8.0 | 25% | Naming clean. Colocation consistent. 2 identical duplicates. |
| Config hygiene | 9.0 | 20% | No secrets in git. Standard per-workspace config. |

**Findings by severity:**

| Severity | Count |
|----------|-------|
| P0 | 1 |
| P1 | 5 |
| P2 | 9 |
| P3 | 4 |
| **Total** | **19** |

---

## 1. Scaffold Compliance

**Status: PASS (with gaps)**

| Directory | Expected | Exists |
|-----------|----------|--------|
| docs/product/ | Y | Y |
| docs/product/modules/ | Y | Y (19 modules) |
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
| SA-ARCH-001 | P2 | **Stale `apps/account` reference.** ARCHITECTURE.md line 42 declares `apps/account/` (auth, profile, settings, port 3002). This app was merged into `apps/memberry`. Line 181 references `cd apps/account && bun run test:e2e`. Both are stale. |
| SA-ARCH-002 | P3 | **Module structure section generic.** ARCHITECTURE.md "Module Structure" describes the pattern but doesn't list the 26 actual handler directories or their relationships. |

---

## 3. Duplicate Detection

### Identical Content (P0 divergence risk)

| ID | Severity | File A | File B | LOC |
|----|----------|--------|--------|-----|
| SA-DUP-001 | P0 | `handlers/association:member/jobs/reminderProcessor.test.ts` | `handlers/dues/jobs/reminderProcessor.test.ts` | ~100 |
| SA-DUP-002 | P0 | `handlers/association:member/jobs/webhookRetryProcessor.test.ts` | `handlers/dues/jobs/webhookRetryProcessor.test.ts` | ~80 |

> **Risk:** Identical today, but if one copy is updated and the other isn't, tests diverge silently. The `dues/jobs/` copies appear to be remnants from before Wave 4 consolidation. **Fix:** Delete the `dues/jobs/` copies (the canonical location is `association:member/jobs/`).

### Same-Name Files (expected in monorepo)

20+ files share names across `apps/memberry/src/routes/` and `services/api-ts/src/handlers/` (e.g., `cancelEvent.ts`, `auth.ts`). These are **expected** — frontend route files and backend handlers naturally share domain names. **No action needed.**

---

## 4. Dead File Detection

**Method:** Import graph analysis across `services/api-ts/src/` (excluding generated/, seed/, *.test.ts, *.d.ts)

No unreferenced source files detected. The Wave 4 dead code removal (dues.repo.ts) already cleaned the primary dead files.

> **Note:** Dynamic imports (`import()`) and framework entry points (app.ts, index.ts) were excluded from dead file candidates.

---

## 5. Circular Dependency Scan

**6 cycles found (3 production, 1 handler, 2 test-only)**

| ID | Severity | Cycle | Impact |
|----|----------|-------|--------|
| SA-CIRC-001 | P1 | `core/config` → `core/email` → `core/config` | Type-only cycle (import type). Low runtime risk but blocks tree-shaking. |
| SA-CIRC-002 | P1 | `core/config` → `core/billing` → `core/logger` → `core/config` | 3-node cycle through core modules. Higher risk — billing and logger initialization depends on config load order. |
| SA-CIRC-003 | P1 | `types/app` → `core/auth` → `types/app` | Type definition cycle. Auth types reference app context, app context references auth types. |
| SA-CIRC-004 | P1 | `handlers/membership/importMembers` → `handlers/membership/csvImport` → `handlers/membership/importMembers` | Business logic cycle within same module. |
| SA-CIRC-005 | P3 | `test-utils/factories` → `test-utils/factories` | Self-reference (likely re-export). Test-only. |
| SA-CIRC-006 | P3 | `tests/helpers/api-available` → `tests/helpers/api-available` | Self-reference. Test-only. |

**Fix guidance:**
- SA-CIRC-001: Extract `EmailConfig` type into `core/types.ts` or `types/email.ts`
- SA-CIRC-002: Extract billing config type from config.ts; have billing import type-only
- SA-CIRC-003: Move auth-related types from `types/app` into `types/auth` or vice versa
- SA-CIRC-004: Extract shared CSV types/utils into `handlers/membership/utils/csv-types.ts`

---

## 6. Naming Convention Enforcement

**Convention detected:** camelCase for handler files, kebab-case for frontend components, $param for TanStack Router dynamic segments.

| Scope | Convention | Violations | Status |
|-------|-----------|------------|--------|
| Backend handlers | camelCase | 0 | CLEAN |
| Frontend routes | TanStack Router convention ($param, _layout) | 0 | CLEAN |
| Frontend components | kebab-case | 0 | CLEAN |
| Schema files | camelCase.schema.ts | 0 | CLEAN |
| Repo files | camelCase.repo.ts | 0 | CLEAN |
| Test files | camelCase.test.ts | 0 | CLEAN |

No naming violations found.

---

## 7. Colocation Audit

Test files are colocated with handlers (same directory). Consistent across all 26 handler directories.

| Pattern | Convention | Status |
|---------|-----------|--------|
| Test colocation | Colocated (handler.test.ts next to handler.ts) | Consistent |
| Schema colocation | In `repos/` subdirectory | Consistent |
| Job colocation | In `jobs/` subdirectory | Consistent |
| Utils colocation | In `utils/` subdirectory (where present) | Consistent |

No colocation inconsistencies found.

---

## 8. Barrel File Health

**30 barrel files (index.ts/index.tsx) found.**

| Category | Count | Status |
|----------|-------|--------|
| Route index files (TanStack Router) | 20 | Expected -- framework convention |
| Job registry barrels (handlers/*/jobs/index.ts) | 9 | Expected -- job registration pattern |
| App entry (services/api-ts/src/index.ts) | 1 | Expected |

| ID | Severity | Finding |
|----|----------|---------|
| SA-BARREL-001 | P3 | No barrel chain depth issues detected. All barrels are single-level re-exports. |

No circular barrels. No unused re-exports detected. **CLEAN.**

---

## 9. Config Sprawl

**14 config files across 6 workspaces.**

| Category | Files | Status |
|----------|-------|--------|
| .env.example | 3 (root, admin, memberry) | Expected |
| .env (actual) | 1 (services/api-ts/.env) | **Not tracked in git** -- CLEAN |
| tsconfig.json | 5 | Per-workspace, extends shared config |
| eslint.config.js | 4 | Per-workspace, extends shared config |

| ID | Severity | Finding |
|----|----------|---------|
| SA-CONFIG-001 | P2 | `services/api-ts/.env` exists on disk but is not in `.gitignore` explicitly -- verify it's covered by a parent gitignore pattern. Currently not tracked (good) but could be accidentally staged. |

No conflicting config values detected across environments. No orphan config files.

---

## 10. Fan-In / Fan-Out Analysis

### Fan-In (most imported -- fragile hubs)

| File | Fan-In | Threshold | Status |
|------|--------|-----------|--------|
| @/core/errors | 553 | 20 | **HUB** -- expected for error module |
| @/core/database | 499 | 20 | **HUB** -- expected for DB access |
| @/types/app | 451 | 20 | **HUB** -- expected for type definitions |
| @/generated/openapi/validators | 339 | 20 | **HUB** -- generated, expected |
| @/test-utils/make-ctx | 333 | 20 | **HUB** -- test-only, expected |
| @/utils/audit | 182 | 20 | **HUB** -- cross-cutting concern |
| @/utils/officer-check | 98 | 20 | HUB -- auth utility |

| ID | Severity | Finding |
|----|----------|---------|
| SA-FAN-001 | P2 | **`@/utils/audit` at 182 fan-in** is a fragile hub. Changes to audit utility signature will cascade across 182 files. Consider interface stability guarantees or versioning. |
| SA-FAN-002 | P2 | **`@/utils/officer-check` at 98 fan-in** -- any signature change cascades widely. |

> **Note:** Core modules (errors, database, types) at 400-550 fan-in are expected for a monolith API. These are stable interfaces unlikely to change. Test utilities (make-ctx, factories) are test-only and don't affect production.

### Fan-Out (most imports)

| File | Fan-Out | Threshold | Status |
|------|---------|-----------|--------|
| handlers/person/accountDeletionCascade.ts | 21 | 15 | **HIGH** -- expected for cascade delete |

| ID | Severity | Finding |
|----|----------|---------|
| SA-FAN-003 | P2 | **accountDeletionCascade.ts (21 imports)** exceeds threshold. This file imports from 10+ handler repos to cascade deletion. Architecturally correct (account deletion must touch everything) but a maintenance risk. Consider: domain event-driven cascade instead of direct imports. |

---

## 11. Filesystem Hygiene

### Build Artifacts in Git

No build artifacts tracked. `.env`, `node_modules/`, `dist/`, `.next/`, `.turbo/` all properly gitignored. **CLEAN.**

### Deep Nesting (>6 path segments)

| ID | Severity | Finding |
|----|----------|---------|
| SA-NEST-001 | P2 | **~50 files in apps/memberry/src/routes/ exceed 6 segments.** Example: `_authenticated/org/$orgSlug/officer/communications/templates/index.tsx` (8 segments). This is **expected** for TanStack Router file-based routing — path depth mirrors URL structure. No action needed. |

### Large Source Files (>500 LOC, non-generated)

| ID | Severity | File | LOC | Notes |
|----|----------|------|-----|-------|
| SA-SIZE-001 | P2 | handleStripeWebhook.ts | 732 | Webhook handler with many event types. Consider splitting by event type. |
| SA-SIZE-002 | P2 | core/email.ts | 663 | Email service with template rendering. Consider extracting template engine. |
| SA-SIZE-003 | P2 | core/jobs.ts | 617 | Job scheduler + all job type definitions. Consider splitting job types. |
| SA-SIZE-004 | P2 | core/billing.ts | 562 | Stripe integration. Consider extracting invoice helpers. |
| SA-SIZE-005 | P3 | test-utils/factories.ts | 652 | Test factory definitions. Large but single-purpose. |
| SA-SIZE-006 | P3 | core/auth.ts | 537 | Better-Auth configuration. Complex but stable. |

> **Note:** 7 generated files exceed 500 LOC (types.gen.ts at 50,704 LOC). These are excluded — generated files are not actionable.

### Empty Directories

None found. **CLEAN.**

---

## Finding Summary

| ID | Sev | Category | Description |
|----|-----|----------|-------------|
| SA-DUP-001 | P0 | Duplicates | reminderProcessor.test.ts identical in 2 locations |
| SA-DUP-002 | P0 | Duplicates | webhookRetryProcessor.test.ts identical in 2 locations |
| SA-CIRC-001 | P1 | Circular deps | core/config ↔ core/email type cycle |
| SA-CIRC-002 | P1 | Circular deps | core/config → billing → logger → config |
| SA-CIRC-003 | P1 | Circular deps | types/app ↔ core/auth type cycle |
| SA-CIRC-004 | P1 | Circular deps | membership/importMembers ↔ csvImport |
| SA-CONFIG-001 | P2 | Config | .env not explicitly in .gitignore |
| SA-ARCH-001 | P2 | Architecture | ARCHITECTURE.md references deleted apps/account |
| SA-FAN-001 | P2 | Fan-in | @/utils/audit 182 consumers (fragile hub) |
| SA-FAN-002 | P2 | Fan-in | @/utils/officer-check 98 consumers |
| SA-FAN-003 | P2 | Fan-out | accountDeletionCascade.ts 21 imports |
| SA-NEST-001 | P2 | Nesting | ~50 route files >6 segments (expected, TanStack) |
| SA-SIZE-001 | P2 | File size | handleStripeWebhook.ts 732 LOC |
| SA-SIZE-002 | P2 | File size | core/email.ts 663 LOC |
| SA-SIZE-003 | P2 | File size | core/jobs.ts 617 LOC |
| SA-SIZE-004 | P2 | File size | core/billing.ts 562 LOC |
| SA-ARCH-002 | P3 | Architecture | Module structure section generic |
| SA-SIZE-005 | P3 | File size | test-utils/factories.ts 652 LOC (test-only) |
| SA-SIZE-006 | P3 | File size | core/auth.ts 537 LOC (stable) |

---

## Stabilization Plan

### Immediate (P0)
1. **Delete duplicate test files in `dues/jobs/`** — canonical copies are in `association:member/jobs/`. (~5 min)

### Soon (P1)
2. **Break circular dependency cycles** — extract shared types into dedicated files. 4 cycles, ~2h total.

### When Touching (P2)
3. **Update ARCHITECTURE.md** — remove apps/account references, update to 2-app architecture.
4. **Consider splitting large core files** — handleStripeWebhook.ts, email.ts, jobs.ts, billing.ts when modifying.
5. **Add .env to explicit .gitignore** in services/api-ts/.

### Track (P3)
6. Log file size observations. No action needed.

---

## What's Next

**1 P0 + 4 P1 found.** Fix duplicate files (P0, 5 min) and circular deps (P1, ~2h) before new development work.

After structural fixes: run `/oli-audit-codebase` for full code quality assessment, or `/oli-audit-compliance` to re-verify compliance score.

---

*Generated by oli-structure-audit v1. Point-in-time filesystem and import graph analysis. Stack: Bun monorepo (Hono + Vite/React/TanStack). Import graph built from services/api-ts/src/ (excluding generated, seed, test, .d.ts files).*
