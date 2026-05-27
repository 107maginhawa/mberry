<!-- oli-version: 1.1 -->
<!-- based-on: docs/audits/ENFORCEMENT_REPORT.md -->
<!-- generated: 2026-05-27 -->

# Enforcement Fix Report

**Generated:** 2026-05-27
**Scope:** Wave 0.5 (UI P0s) + Wave 1 (Backend P0s)
**Findings Processed:** 22
**Findings Fixed:** 19
**Findings Blocked:** 1
**Findings Already Fixed:** 1
**Findings Duplicate:** 1

---

## Fix Summary

| Metric | Value |
|--------|-------|
| **Wave 0.5 (UI P0s)** | 5 FIXED, 1 ALREADY_FIXED, 1 BLOCKED |
| **Wave 1 (Backend P0s — Module)** | 9 FIXED |
| **Wave 1 (Backend P0s — File)** | 5 FIXED, 1 DUP |
| **Tests Updated** | 8 test files |
| **Typecheck** | PASS (clean) |
| **Test Suite** | 5619 pass, 83 fail (all pre-existing) |

---

## Wave Classification

| Wave | Type | Count | Description |
|------|------|-------|-------------|
| 0.5 | UI P0 | 7 | Frontend dead buttons, wrong navigation, missing wiring |
| 1 | Backend P0 — Security | 9 | Auth guards, PII leak, XSS, state bypass |
| 1 | Backend P0 — File | 6 | Missing states, duplicate guards, role checks |

---

## Finding Manifest

| # | ID | Module | Wave | Status | Fix |
|---|-----|--------|------|--------|-----|
| 1 | m11-PII | m11 | 1 | **FIXED** | Removed holderName/firstName/lastName from verifyCertificatePublic response |
| 2 | m04-term | m04 | 1 | **FIXED** | Added isValidTermTransition() guard in updateOfficerTerm |
| 3 | m04-XSS | m04 | 1 | **FIXED** | Added SVG content detection + MIME type validation in updateOrganizationProfile |
| 4 | m05-events | m05 | 1 | **FIXED** | Wired membership.status.changed emission in updateMember |
| 5 | m07-noop | m07 | 1 | **FIXED** | Wired announcement.published domain event in publishAnnouncement |
| 6 | m07-event | m07 | 1 | **FIXED** | Added announcement.published to domain events registry |
| 7 | m09-events | m09 | 1 | **FIXED** | Added training.published/completed/cancelled to registry |
| 8 | m09-status | m09 | 1 | **FIXED** | Forced createTraining to always use status: 'draft' |
| 9 | m03-super | m03 | 1 | **FIXED** | Added super admin role check in inviteAdmin + createAssociation |
| 10 | m04-cancelled | m04 | 1 | **FIXED** | Added cancelled terminal state to PAYMENT_VALID_TRANSITIONS |
| 11 | m05-auth | m05 | 1 | **FIXED** | Added OfficerTermRepository check in addMember |
| 12 | m05-dup | m05 | 1 | **FIXED** | Added Postgres 23505 catch → ConflictError in addMember |
| 13 | m06-role | m06 | 1 | **FIXED** | Added OfficerTermRepository check in sendPaymentLink |
| 14 | m11-PII-file | m11 | 1 | **DUP(#1)** | Same as finding #1 — file-level confirmation |
| 15 | m07-role | m07 | 1 | **FIXED** | Added requirePosition(president/secretary) in createSubscriptionTopic |
| 16 | UJ-M01-001 | m01 | 0.5 | **ALREADY_FIXED** | Route exists at routes/invite/$token.tsx — fully functional |
| 17 | UJ-M02-001 | m02 | 0.5 | **FIXED** | Enabled PDF download button via window.print() |
| 18 | UJ-M02-003 | m02 | 0.5 | **FIXED** | Changed api.get → api.post for data export |
| 19 | UJ-M02-010 | m02 | 0.5 | **FIXED** | Security quick-link now navigates to /settings/security |
| 20 | UJ-M03-001 | m03 | 0.5 | **FIXED** | Wired Activate/Suspend/Archive buttons to PATCH endpoint |
| 21 | UJ-M03-002 | m03 | 0.5 | **FIXED** | Wired "Add Organization" button with dialog + createOrganizationMutation |
| 22 | UJ-M03-003 | m03 | 0.5 | **BLOCKED** | No nav entry exists — no dead button to fix |

---

## Fix Log

| File | Change | Finding |
|------|--------|---------|
| `services/api-ts/src/handlers/certificates/verifyCertificatePublic.ts` | Remove PII (firstName, lastName, holderName) from unauthenticated response | #1 |
| `services/api-ts/src/handlers/association:member/updateOfficerTerm.ts` | Add isValidTermTransition + BusinessLogicError guard before repo.update | #2 |
| `services/api-ts/src/handlers/association:member/updateOrganizationProfile.ts` | Block SVG content + validate MIME type on logo | #3 |
| `services/api-ts/src/handlers/membership/updateMember.ts` | Wire domainEvents.emit('membership.status.changed') | #4 |
| `services/api-ts/src/handlers/communication/publishAnnouncement.ts` | Wire domainEvents.emit('announcement.published') | #5, #6 |
| `services/api-ts/src/core/domain-events.registry.ts` | Add 4 event types: announcement.published, training.* (3) | #6, #7 |
| `services/api-ts/src/handlers/training/createTraining.ts` | Force status: 'draft', ignore body.status | #8 |
| `services/api-ts/src/handlers/platformadmin/inviteAdmin.ts` | Add super admin role check | #9 |
| `services/api-ts/src/handlers/platformadmin/createAssociation.ts` | Add super admin role check | #9 |
| `services/api-ts/src/handlers/association:member/utils/status-transitions.ts` | Add cancelled: [] terminal state | #10 |
| `services/api-ts/src/handlers/membership/addMember.ts` | Add officer auth guard + duplicate 409 catch | #11, #12 |
| `services/api-ts/src/handlers/dues/sendPaymentLink.ts` | Add officer auth guard, deduplicate db variable | #13 |
| `services/api-ts/src/handlers/communication/createSubscriptionTopic.ts` | Add requirePosition(president/secretary) | #15 |
| `services/api-ts/src/app.ts` | Wire registerDomainEventConsumers in createApp | #4-7 |
| `apps/memberry/src/routes/_authenticated/my/profile.tsx` | Fix security quick-link to /settings/security | #19 |
| `apps/memberry/src/features/account/components/data-export.tsx` | api.get → api.post | #18 |
| `apps/memberry/src/routes/_authenticated/my/id-card.tsx` | Enable PDF download via window.print() | #17 |
| `apps/admin/src/routes/organizations/$organizationId.tsx` | Wire lifecycle buttons to PATCH status endpoint | #20 |
| `apps/admin/src/routes/associations/$associationId.tsx` | Wire "Add Organization" with dialog + mutation | #21 |

### Test Files Updated

| File | Change |
|------|--------|
| `verifyCertificatePublic.test.ts` | Remove holderName assertions, simplify mock |
| `addMember.test.ts` | Add OfficerTermRepository stub |
| `sendPaymentLink.test.ts` | Add OfficerTermRepository stub |
| `updateMember.test.ts` | Add domainEvents.reset() |
| `inviteAdmin.test.ts` | Add platformAdmin: { role: 'super' } to mock context |
| `createAssociation.test.ts` | Add platformAdmin: { role: 'super' } to mock context |
| `br-p2-gap.test.ts` | Add OfficerTermRepository stub |
| `flow-08.addmember-defaults.test.ts` | Add OfficerTermRepository stub |
| `status-transitions.test.ts` | Update map integrity count 10 → 11 |

---

## Blocked Findings

| # | ID | Reason | Action Required |
|---|-----|--------|-----------------|
| 22 | UJ-M03-003 | No subscription nav entry or route exists in admin app. No dead button to fix — subscription management is genuinely unbuilt, not a broken wiring. | Build subscription management feature (Wave 3) |

---

## What's Next

### All P0/P1 from Wave 0.5 + Wave 1: FIXED (except 1 BLOCKED)

19 of 22 P0 findings resolved. 1 duplicate. 1 already fixed. 1 blocked (requires new feature).

**Recommended next steps (in order):**

1. **Re-run enforcement** → `/oli-enforce-all --strict` to verify P0 count dropped to 0 (or 1 blocked)
2. **Wire domain event bus (Wave 2)** — remaining 14 events from EVENT_CONTRACTS.md still unwired. The 3 registered events now have emission points. Add consumers for announcement.published + training.* events.
3. **Build missing endpoints (Wave 3)** — onboarding wizard, digital ID card backend, subscription management, event lifecycle handlers
4. **Handler consolidation (Wave 4)** — merge dual handler sets in m05/m09/m12

---

*Pipeline: `/oli-enforce-fix` (this run) → re-run `/oli-enforce-all --strict` → `/oli-audit-compliance`*
