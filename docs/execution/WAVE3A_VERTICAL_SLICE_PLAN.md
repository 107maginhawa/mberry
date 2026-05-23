# Wave 3a Vertical Slice Plan — Trust Directory Core

Status: IMPLEMENTED | Generated: 2026-05-23

## Summary

| Metric | Count |
|--------|-------|
| Total slices | 7 |
| Alpha slices | 7 |
| Tests passing | 29 |

## Slices (all COMPLETE)

| Slice | Name | Risk | Size | Status |
|-------|------|------|------|--------|
| VS-3a-01 | Schema + Privacy Extension | P0 | small | DONE |
| VS-3a-02 | Auto-Populate Job | P1 | medium | DONE |
| VS-3a-03 | Privacy Settings UI | P2 | small | DONE |
| VS-3a-04 | Trust Directory Search | P1 | large | DONE |
| VS-3a-05 | Member Profile Page | P2 | medium | DONE |
| VS-3a-06 | Public Verify Page | P2 | medium | DONE |
| VS-3a-07 | TypeSpec Codegen | P3 | small | DONE |

## Files Created/Modified

### Backend
- `services/api-ts/src/handlers/person/repos/privacy-settings.schema.ts` — 3 new boolean columns
- `services/api-ts/src/handlers/person/getMyPrivacySettings.ts` — defaults for new fields
- `services/api-ts/src/handlers/person/updateMyPrivacySettings.ts` — handle new fields
- `services/api-ts/src/handlers/person/getPrivacySettings.ts` — defaults for new fields
- `services/api-ts/src/handlers/person/updatePrivacySettings.ts` — handle new fields
- `services/api-ts/src/generated/migrations/0044_wave3a_trust_privacy.sql` — migration
- `services/api-ts/src/handlers/association:member/jobs/directoryAutoPopulate.ts` — NEW
- `services/api-ts/src/handlers/association:member/jobs/directoryAutoPopulate.test.ts` — NEW (5 tests)
- `services/api-ts/src/handlers/association:member/jobs/index.ts` — register job
- `services/api-ts/src/handlers/association:member/createMembership.ts` — trigger job
- `services/api-ts/src/handlers/association:member/addRosterMember.ts` — trigger job
- `services/api-ts/src/handlers/association:member/searchDirectory.ts` — trust-enriched search
- `services/api-ts/src/handlers/association:member/repos/directory.repo.ts` — searchWithFilters
- `services/api-ts/src/handlers/association:member/utils/trust-signals.ts` — NEW
- `services/api-ts/src/handlers/association:member/lookupCredentialPublic.ts` — NEW
- `services/api-ts/src/handlers/association:member/directory.test.ts` — updated (17 tests)
- `services/api-ts/src/app.ts` — public lookup route + path allowlist

### TypeSpec
- `specs/api/src/modules/person-custom.tsp` — 3 new privacy fields in models

### Frontend
- `apps/memberry/src/routes/_authenticated/my/settings.tsx` — 7 privacy toggles
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/directory.tsx` — NEW
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/directory/$personId.tsx` — NEW
- `apps/memberry/src/features/directory/components/trust-directory.tsx` — NEW
- `apps/memberry/src/features/directory/components/trust-card.tsx` — NEW
- `apps/memberry/src/features/directory/components/directory-filters.tsx` — NEW
- `apps/memberry/src/features/directory/components/member-profile.tsx` — NEW
- `apps/memberry/src/routes/verify/$token.tsx` — enhanced with trust summary
