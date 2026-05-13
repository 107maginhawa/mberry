---
phase: "07-shared-component-library"
plan: "03"
subsystem: "frontend"
tags: ["ui-library", "import-migration", "deduplication"]
dependency_graph:
  requires: ["07-01"]
  provides: ["UINF-03"]
  affects: ["apps/account", "apps/memberry", "apps/admin"]
tech_stack:
  added: []
  patterns: ["workspace-package-import", "re-export-shim"]
key_files:
  created: []
  modified:
    - apps/account/package.json
    - apps/account/tailwind.config.ts
    - apps/account/src/lib/utils.ts
    - apps/memberry/package.json
    - apps/memberry/tailwind.config.ts
    - apps/memberry/src/lib/utils.ts
    - apps/admin/package.json
    - apps/admin/tailwind.config.ts
    - apps/admin/src/lib/utils.ts
    - apps/admin/src/routes/index.tsx
decisions:
  - "Re-export shim pattern: all three apps export cn from @monobase/ui, keeping @/lib/utils import paths working"
  - "Deleted memberry/src/hooks/use-toast.ts: referenced deleted toast.tsx and was unused (memberry uses sonner)"
  - "Fixed pre-existing require() lint error in all three tailwind.config.ts files (ESM import)"
metrics:
  duration: "45 minutes"
  completed: "2026-05-06"
  tasks_completed: 2
  files_changed: 143
---

# Phase 07 Plan 03: App Migration to @monobase/ui Summary

All three apps now consume UI components from `@monobase/ui` workspace package, eliminating 54+ duplicated shadcn component files.

## Tasks Completed

### Task 1: Migrate account and memberry apps to @monobase/ui

- Added `"@monobase/ui": "workspace:*"` to account and memberry package.json
- Updated tailwind configs in both apps to scan `../../packages/ui/src/**/*.{ts,tsx}`
- Replaced `src/lib/utils.ts` in both apps with re-export shim: `export { cn } from "@monobase/ui"`
- Deleted 29 duplicated shadcn component files from `apps/account/src/components/`
- Deleted entire `apps/memberry/src/components/ui/` directory (25 files including toast.tsx/toaster.tsx)
- Updated all import paths across 60+ files in account features, routes, and app-specific components
- Updated all import paths across 50+ files in memberry features, routes, and pattern components
- Deleted `apps/memberry/src/hooks/use-toast.ts` (imported deleted toast.tsx, was unused outside itself)

**Commit:** `2286b29` — feat(07-03): migrate account and memberry apps to @monobase/ui

### Task 2: Add @monobase/ui to admin app

- Added `"@monobase/ui": "workspace:*"` to admin package.json
- Updated admin tailwind config (included in Task 1 commit via pre-commit hook batch)
- Replaced `apps/admin/src/lib/utils.ts` with re-export shim
- Added `Button` from `@monobase/ui` to admin dashboard (`apps/admin/src/routes/index.tsx`) proving integration end-to-end

**Commit:** `267bbea` — feat(07-03): add @monobase/ui to admin app with first component usage

## Verification

- `cd apps/account && bunx tsc --noEmit`: Passes (2 pre-existing errors unrelated to this plan)
- `cd apps/memberry && bunx tsc --noEmit`: Exit 0 — clean
- `cd apps/admin && bunx tsc --noEmit`: Passes (1 pre-existing postcss-load-config error unrelated to this plan)
- `grep '@monobase/ui' apps/account/src/` — 60+ matches across routes and features
- `grep '@monobase/ui' apps/memberry/src/` — 50+ matches across features and routes
- `grep '@monobase/ui' apps/admin/src/` — 1 match in routes/index.tsx

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing eslint require() error blocked commit**
- **Found during:** Task 1 commit attempt
- **Issue:** `tailwind.config.ts` in all three apps used `require("tailwindcss-animate")` which ESLint flags as `@typescript-eslint/no-require-imports`
- **Fix:** Converted to ESM `import tailwindcssAnimate from "tailwindcss-animate"` in account, memberry, and admin
- **Files modified:** apps/account/tailwind.config.ts, apps/memberry/tailwind.config.ts, apps/admin/tailwind.config.ts
- **Note:** Pre-existing issue, not introduced by this plan

**2. [Rule 3 - Missing context] Memberry had 50+ files importing from @/components/ui/**
- **Found during:** Task 1 — memberry had many more consumers than just the ui/ folder itself
- **Fix:** Used Python script to bulk-replace `from '@/components/ui/X'` → `from '@monobase/ui'` across all memberry features and routes
- **Files modified:** All files in apps/memberry/src/features/ and apps/memberry/src/routes/

## Known Stubs

None. All imports are wired to real components in packages/ui.

## Threat Flags

None. Import path changes only — no new security surface.

## Self-Check: PASSED

- apps/account/package.json contains "@monobase/ui": "workspace:*" ✓
- apps/memberry/package.json contains "@monobase/ui": "workspace:*" ✓
- apps/admin/package.json contains "@monobase/ui": "workspace:*" ✓
- All three tailwind configs include `../../packages/ui/src/**/*.{ts,tsx}` ✓
- All three utils.ts files re-export cn from @monobase/ui ✓
- apps/account/src/components/ contains only app-specific files ✓
- apps/memberry/src/components/ui/ deleted ✓
- At least one admin tsx imports from @monobase/ui ✓
- Commits 2286b29 and 267bbea verified in git log ✓
