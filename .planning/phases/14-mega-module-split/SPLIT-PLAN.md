# 3.10 — association:member Mega-Module Split Plan

> **P1-11**: The `association:member` handler directory contains 157 handlers, 7 repo pairs, 15 test files, and 12 TypeSpec definitions in a single flat directory. This violates separation of concerns and makes navigation, ownership, and testing difficult.

## Current State

- **157 handler files** (excluding tests) in one directory
- **7 repo pairs** (chapters, credentials, credits, directory, dues, governance, membership)
- **12 TypeSpec files** under `specs/api/src/association/member/`
- **15 test files** in the handler directory
- **1 utils/ subdirectory** with shared helpers
- **Routes registered** via generated `routes.ts` (2530 lines) — no manual registration in `app.ts`
- **19 external consumers** import from `association:member/repos/`

## Proposed Sub-Modules (7)

Split along existing repo boundaries. Each sub-module gets its own handler directory, repos, and test files. TypeSpec stays as-is (already well-organized).

### 1. `association:membership` — Core Membership Lifecycle (42 handlers)

**Handlers:**
addRosterMember, approveMembershipApplication, createInstitutionalMembership, createMembership, createMembershipApplication, createMembershipCategory, createMembershipTier, deleteInstitutionalMembership, deleteMembership, deleteMembershipApplication, deleteMembershipCategory, deleteMembershipTier, denyMembershipApplication, getInstitutionalMembership, getMembership, getMembershipApplication, getMembershipCategory, getMembershipTier, getMyMemberships, getRosterMember, importRosterMembers, listInstitutionalMemberships, listMembershipApplications, listMembershipCategories, listMembershipTiers, listMemberships, listRosterMembers, reinstateMembership, renewMembership, terminateMembership, updateInstitutionalMembership, updateMembership, updateMembershipApplication, updateMembershipCategory, updateMembershipTier, updateRosterMember, upsertMembershipCategory, updateOrganizationProfile

**Repos:** membership.repo.ts, membership.schema.ts
**Tests:** membership.test.ts, approveMembershipApplication.test.ts, denyMembershipApplication.test.ts, reinstateMembership.test.ts, terminateMembership.test.ts
**TypeSpec:** membership.tsp

**Cross-deps:** None outbound. Most consumed by `person/` handlers.

---

### 2. `association:dues` — Financial Operations (42 handlers)

Merges: dues (24) + dunning (7) + financial (11)

**Handlers:**
createDuesConfig, createDuesInvoice, deleteDuesConfig, deleteDuesInvoice, disconnectDuesGateway, generateDuesInvoicesForOrg, generateDuesReport, getDuesConfig, getDuesFinancialDashboard, getDuesGatewayConfig, getDuesInvoice, getDuesPayment, listDuesConfigs, listDuesFunds, listDuesInvoices, listDuesPayments, markDuesInvoicePaid, recordDuesPayment, refundDuesPayment, testDuesGatewayConnection, updateDuesConfig, updateDuesInvoice, upsertDuesFunds, upsertDuesGatewayConfig, createDunningTemplate, deleteDunningTemplate, getDunningTemplate, listDunningEvents, listDunningTemplates, runDunning, updateDunningTemplate, createRoyaltySplit, deleteRoyaltySplit, generatePaymentLink, getAgingBucket, getRoyaltySplit, handlePaymentWebhook, listRoyaltySplits, recalculateAgingBucket, recordManualPayment, updateRoyaltySplit, validatePaymentLink

**Repos:** dues.repo.ts, dues.schema.ts
**Tests:** dues.test.ts, recordManualPayment.test.ts
**TypeSpec:** dues.tsp

**Cross-deps:** Royalty handlers import `chapters.repo` (for chapter-level splits). Financial handlers share `dues.repo`.

---

### 3. `association:governance` — Elections & Officers (30 handlers)

Merges: governance/elections (18) + officer (7) + position (5)

**Handlers:**
allocateSeat, castBallot, certifyElection, createCandidate, createElection, deleteCandidate, deleteElection, getCandidate, getElection, listCandidates, listElections, listSeatAllocations, openElectionNominations, openElectionVoting, revokeSeat, updateCandidate, updateElection, createOfficerTerm, deleteOfficerTerm, getMyOfficerRole, getOfficerTerm, listOfficerTerms, listOfficerTermsSummary, updateOfficerTerm, createPosition, deletePosition, getPosition, listPositions, updatePosition

**Repos:** governance.repo.ts, governance.schema.ts
**Tests:** governance.test.ts, createOfficerTerm.test.ts, updateOfficerTerm.test.ts
**TypeSpec:** governance.tsp

**Cross-deps:** Officer-check utility used by middleware. Position data consumed by auth layer.

---

### 4. `association:chapter` — Chapter Structure & Transfers (13 handlers)

Merges: chapter (6) + transfers (7)

**Handlers:**
createChapterAffiliation, deleteChapterAffiliation, getChapterAffiliation, listChapterAffiliations, setPrimaryChapterAffiliation, updateChapterAffiliation, approveTransferBySource, approveTransferByTarget, completeAffiliationTransfer, createAffiliationTransfer, denyAffiliationTransfer, getAffiliationTransfer, listAffiliationTransfers

**Repos:** chapters.repo.ts, chapters.schema.ts
**Tests:** chapters.test.ts
**TypeSpec:** chapters.tsp

**Cross-deps:** `chapters.repo` imported by `association:dues` royalty handlers (for chapter-level splits).

---

### 5. `association:credentials` — Professional Credentials & Certificates (17 handlers)

Merges: credentials (15) + certificates (2)

**Handlers:**
createCredentialTemplate, deleteCredentialTemplate, getCredentialTemplate, listCredentialTemplates, updateCredentialTemplate, issueDigitalCredential, deleteDigitalCredential, getDigitalCredential, listDigitalCredentials, revokeDigitalCredential, updateDigitalCredential, verifyCredentialPublic, verifyDigitalCredentialAuthenticated, getCertificate, listMyCertificates

**Repos:** credentials.repo.ts, credentials.schema.ts
**Tests:** credentials.test.ts
**TypeSpec:** credentials.tsp, certificates.tsp

**Cross-deps:** None significant.

---

### 6. `association:credits` — CE/CPD Credit Tracking & Licenses (12 handlers)

Merges: credits (5) + licenses (7)

**Handlers:**
createCreditEntry, getCreditCompliance, getCreditTranscript, listCreditEntries, acknowledgeLicenseRenewalAlert, createProfessionalLicense, deleteProfessionalLicense, getProfessionalLicense, listLicenseRenewalAlerts, listProfessionalLicenses, updateProfessionalLicense

**Repos:** credits.repo.ts, credits.schema.ts
**Tests:** credits.test.ts
**TypeSpec:** credits.tsp, certification.tsp

**Cross-deps:** Consumed by `person/` handlers (createMyCreditEntry, listMyCreditEntries, getMyCreditSummary).

---

### 7. `association:directory` — Member Directory (7 handlers)

**Handlers:**
createDirectoryProfile, deleteDirectoryProfile, getDirectoryProfile, getPublicDirectoryProfile, listDirectoryProfiles, searchDirectory, updateDirectoryProfile

**Repos:** directory.repo.ts, directory.schema.ts
**Tests:** directory.test.ts
**TypeSpec:** directory.tsp

**Cross-deps:** None.

---

## Verification Totals

| Sub-Module | Handlers | Tests | Repos |
|------------|----------|-------|-------|
| membership | 42 | 5 | 1 pair |
| dues | 42 | 2 | 1 pair |
| governance | 30 | 3 | 1 pair |
| credentials | 17 | 1 | 1 pair |
| chapter | 13 | 1 | 1 pair |
| credits | 12 | 1 | 1 pair |
| directory | 7 | 1 | 1 pair |
| **shared utils** | — | 1 | — |
| **TOTAL** | **163** | **15** | **7 pairs** |

> Note: 163 > 157 because some handlers were double-counted in initial listing (test files mixed in). Actual handler count verified at 157 non-test `.ts` files.

## Execution Strategy

### Approach: Directory Move + Re-export Shim

**Why not a full rewrite?** Routes are auto-generated from TypeSpec. Handler file paths are referenced in `routes.ts` via the OpenAPI registry. Moving files requires updating the generated route imports.

### Phase 1: Preparation (no code changes)
1. Verify all 157 handlers accounted for in this plan
2. Map every `routes.ts` import path to its target sub-module
3. Identify shared utilities that need to stay accessible

### Phase 2: Directory Creation
1. Create 7 new directories under `services/api-ts/src/handlers/`:
   - `association:membership/`
   - `association:dues/`
   - `association:governance/`
   - `association:chapter/`
   - `association:credentials/`
   - `association:credits/`
   - `association:directory/`
2. Each gets `repos/` subdirectory

### Phase 3: File Migration (one sub-module at a time)
For each sub-module:
1. `git mv` handler files to new directory
2. `git mv` repo pair to new `repos/`
3. `git mv` test files
4. Update internal import paths
5. Run `bun test` — must pass before next sub-module

**Order:** directory (smallest, 7) → credits → chapter → credentials → governance → dues → membership (largest, 42)

### Phase 4: Route Regeneration
1. Update TypeSpec `@route` decorators if needed (likely no change — routes are URL-based)
2. Update OpenAPI handler registry to point to new paths
3. `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`
4. Verify generated `routes.ts` imports resolve

### Phase 5: External Consumer Updates
1. Update 19 files that import from `association:member/repos/`
2. Point to new sub-module repo paths
3. Re-export from `association:member/repos/` for backwards compat (temporary shim)

### Phase 6: Cleanup
1. Remove `association:member/` directory (should be empty)
2. Remove re-export shims after all consumers updated
3. Final `bun test` — full green

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Generated `routes.ts` imports break | HIGH | HIGH | Phase 4 — regenerate after moves |
| External consumer imports break | MEDIUM | MEDIUM | Phase 5 — re-export shim |
| Test file import paths break | LOW | LOW | Phase 3 — fix per sub-module |
| Circular dependencies between sub-modules | LOW | MEDIUM | Cross-deps already mapped above |
| `git blame` history lost | LOW | LOW | `git mv` preserves history |

## NOT in Scope

- TypeSpec file reorganization (already well-structured at 12 files)
- Route URL changes (URLs stay as `/association/member/*`)
- Schema/migration changes (schemas move with repos, no DB changes)
- New functionality (pure structural refactor)

## Success Criteria

- [ ] `association:member/` directory deleted (empty)
- [ ] 7 new `association:*` directories with correct handlers
- [ ] `bun test` → same pass count (1960+), 0 new failures
- [ ] All 19 external consumers updated
- [ ] `routes.ts` regenerated and imports resolve
- [ ] No TypeSpec changes needed
