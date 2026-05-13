---
phase: 15-domain-remediation
plan: "00b"
type: tdd
wave: 0.5
depends_on:
  - "00a"
files_modified:
  - apps/memberry/src/features/dues/components/dues-config-form.tsx
autonomous: true
requirements:
  - CODEX-P1-2
must_haves:
  truths:
    - "New org without existing config can save dues configuration"
    - "Existing org config updates via PATCH"
  artifacts:
    - path: "apps/memberry/src/features/dues/components/dues-config-form.tsx"
      provides: "Dues config form with create-vs-update dispatch logic"
---

<objective>
Fix 404 error when saving dues config for the first time. The form always calls updateDuesConfig (PATCH) even for orgs that have no existing config. Backend PATCH returns 404 for missing configs.

Add create-vs-update dispatch: check if config exists, call createDuesConfig (POST) for first-time setup, updateDuesConfig (PATCH) for subsequent edits.
</objective>

<context>
@.planning/phases/15-domain-remediation/15-CONTEXT.md
@.planning/phases/15-domain-remediation/15-PATTERNS.md

The form component uses a single `updateDuesConfig` mutation for all saves. Orgs setting up dues for the first time hit a 404 because no config record exists yet. The fix requires detecting whether the config query returned data (existing config) or empty/404 (no config), then dispatching to the correct mutation.

Key files:
- `apps/memberry/src/features/dues/components/dues-config-form.tsx` - Form component that always PATCHes
- `services/api-ts/src/handlers/dues/getDuesConfig.ts` - GET handler that returns 404 when no config exists
- `services/api-ts/src/handlers/association:member/getDuesConfig.ts` - Alternative GET endpoint
</context>

<tasks>
1. **RED**: Write a test asserting that when no existing config is loaded (query returns null/404), the form calls createDuesConfig (POST). When config exists, it calls updateDuesConfig (PATCH).
2. **GREEN**: Add conditional dispatch in `onSubmit`:
   - Detect config existence from the query result (e.g., `existingConfig` state or query data check).
   - If no config: call `createDuesConfig` mutation (POST).
   - If config exists: call `updateDuesConfig` mutation (PATCH).
3. **VERIFY**: New org can create config from scratch. Existing org can update config. Both paths show success feedback and persist on reload.
</tasks>
