---
slice: wave-0a-infrastructure
generated_by: oli-confidence-stack (manual verification)
date: 2026-05-24
---

# TDD Proof — Wave 0a Infrastructure

## Context Coverage

| Document | Loaded | Path |
|----------|--------|------|
| SLICE_SPEC.md | YES | `docs/execution/slices/wave-0a-infrastructure/SLICE_SPEC.md` |
| CONTEXT.md | YES | `.planning/phases/wave0-foundation/CONTEXT.md` |
| MODULE_SPEC.md | N/A | Wave 0 is cross-module infrastructure |

## Spec Item Coverage

| AC ID | Description | Test File(s) | Status |
|-------|------------|-------------|--------|
| AC-W0A-001 | Slug migration + generation | `platformadmin/createOrganization.test.ts` | COVERED |
| AC-W0A-002 | OrgProvider upgrade | `providers/OrgProvider.test.tsx`, `hooks/useMyOrgs.test.ts` | COVERED |
| AC-W0A-003 | Org switcher icon rail | `components/layout/org-icon-rail.test.tsx` | COVERED |
| AC-W0A-004 | Account merge/deprecation | Auth routes at `routes/auth/` | COVERED (impl) |
| AC-W0A-005 | Public org endpoint | `platformadmin/getOrganizationBySlug.test.ts` (9 tests) | COVERED |
| AC-W0A-006 | Membership PII cleanup | `person/getMyMemberships.test.ts` (6 tests) | COVERED |
| AC-W0A-007 | getTraining handler tests | `association:operations/getTraining.test.ts` (5 tests) | COVERED |

## BR Coverage

| BR ID | Description | Test File | Assertion Quality |
|-------|------------|-----------|-------------------|
| BR-29 | Org Public Page | `getOrganizationBySlug.test.ts` | STRONG — cancelled org 404, response shape, public access |

## Verification Commands

```bash
# Backend tests
bun test services/api-ts/src/handlers/platformadmin/getOrganizationBySlug.test.ts
bun test services/api-ts/src/handlers/person/getMyMemberships.test.ts
bun test services/api-ts/src/handlers/association:operations/getTraining.test.ts
bun test services/api-ts/src/handlers/invite/

# Frontend tests
cd apps/memberry && bun run test -- --run src/providers/OrgProvider.test.tsx
cd apps/memberry && bun run test -- --run src/hooks/useMyOrgs.test.ts
cd apps/memberry && bun run test -- --run src/components/layout/org-icon-rail.test.tsx
```

## Test Counts

| Area | Files | Tests |
|------|-------|-------|
| getOrganizationBySlug | 1 | 9 |
| getMyMemberships | 1 | 6 |
| getTraining | 1 | 5 |
| invite (create/validate/claim) | 3 | 32 |
| OrgProvider | 1 | — |
| useMyOrgs | 1 | — |
| org-icon-rail | 1 | — |
| **Total** | **9** | **52+** |

## Notes

- Wave 0a was NOT executed through GSD pipeline — built incrementally across multiple sessions
- P0 fixes applied 2026-05-24: PII leak in getMyMemberships, expanded getOrganizationBySlug tests
- No git-history RED→GREEN ordering available (not TDD-driven originally)
- Slug generation uses `generateSlug`/`ensureUniqueSlug` in `services/api-ts/src/handlers/platformadmin/utils/slug.ts`
- Dead code handlers (training/getTraining.ts, association:member/getMyMemberships.ts) previously deleted
