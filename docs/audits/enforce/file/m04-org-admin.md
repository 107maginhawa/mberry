# Per-File Spec Traceability: M04 Organization Admin

**Module**: `services/api-ts/src/handlers/association:member/`
**Spec Sources**: `docs/product/modules/m04-org-admin/MODULE_SPEC.md`, `API_CONTRACTS.md`
**Cross-references**: `DOMAIN_MODEL.md`, `WORKFLOW_MAP.md`, `ROLE_PERMISSION_MATRIX.md`, `MODULE_MAP.md`
**Audit Date**: 2026-05-27
**Total Files**: 157+ (largest handler directory in codebase)
**Prior Findings Preserved**: Yes (EF-M04-a1a1a1a1 through EF-M04-f2f2f2f2 from prior module-level audit)

---

## 1. File Classification Table

### 1.1 Schema/Entity Files (12 files)

| File | Classification | Domain Entity | Spec Reference | Status |
|------|---------------|---------------|----------------|--------|
| `repos/governance.schema.ts` | entity | Position, OfficerTerm, TransitionChecklist, DisciplinaryAction | MODULE_SPEC s7 Entity: Position/OfficerTerm/DisciplinaryAction/TransitionChecklist | PASS |
| `repos/membership.schema.ts` | entity | MembershipTier, MembershipCategory, Membership, MembershipApplication | DOMAIN_MODEL s2 Membership | PASS |
| `repos/chapters.schema.ts` | entity | ChapterAffiliation, AffiliationTransfer, RoyaltySplit | DOMAIN_MODEL s2 Membership (chapter_affiliation, affiliation_transfer, royalty_split) | PASS |
| `repos/credentials.schema.ts` | entity | ProfessionalLicense, LicenseRenewalAlert, CredentialTemplate, DigitalCredential | DOMAIN_MODEL s2 (professional_license, credential_template, digital_credential) | PASS |
| `repos/credits.schema.ts` | entity | CreditEntry, OrgCpdConfig | DOMAIN_MODEL s2 (credit_entry) | PASS |
| `repos/directory.schema.ts` | entity | DirectoryProfile | DOMAIN_MODEL s2 (directory_profile) | PASS |
| `repos/dues-payments.schema.ts` | entity | DuesOrgConfig, DuesCategoryOverride, DuesFund, DuesPayment, DuesFundAllocation, DuesReminderSchedule, DuesGatewayConfig, WebhookRetryLog | DOMAIN_MODEL s3c (Dues Payment System) | PASS |
| `repos/dues.schema.ts` | entity | DuesConfig (legacy), DuesInvoice (legacy), AgingBucket, DuesReminderLog | DOMAIN_MODEL s3b (Dues Legacy Config) | PASS |
| `repos/dunning.schema.ts` | entity | DunningTemplate, DunningEvent | DOMAIN_MODEL s3d (Dunning) | PASS |
| `repos/special-assessments.schema.ts` | entity | SpecialAssessment, SpecialAssessmentPayment | (mega-module internal) | PASS |
| `repos/status-history.schema.ts` | entity | MembershipStatusHistory | DOMAIN_MODEL s2 (membership_status_history) | PASS |
| `repos/dues-payment-status-history.schema.ts` | entity | DuesPaymentStatusHistory | DOMAIN_MODEL s3c | PASS |

### 1.2 Repository Files (13 files)

| File | Classification | Domain Scope | Status |
|------|---------------|-------------|--------|
| `repos/governance.repo.ts` | repository | Position, OfficerTerm, TransitionChecklist, DisciplinaryAction CRUD | PASS |
| `repos/membership.repo.ts` | repository | Membership, MembershipTier, MembershipCategory, MembershipApplication | PASS |
| `repos/chapters.repo.ts` | repository | ChapterAffiliation, AffiliationTransfer, RoyaltySplit | PASS |
| `repos/credentials.repo.ts` | repository | ProfessionalLicense, CredentialTemplate, DigitalCredential | PASS |
| `repos/credits.repo.ts` | repository | CreditEntry, OrgCpdConfig | PASS |
| `repos/directory.repo.ts` | repository | DirectoryProfile | PASS |
| `repos/dues-payments.repo.ts` | repository | DuesPayment, DuesOrgConfig, related | PASS |
| `repos/dues.repo.ts` | repository | DuesConfig (legacy), DuesInvoice, AgingBucket | PASS |
| `repos/dunning.repo.ts` | repository | DunningTemplate, DunningEvent | PASS |
| `repos/special-assessments.repo.ts` | repository | SpecialAssessment, SpecialAssessmentPayment | PASS |
| `repos/compliance.repo.ts` | repository | Compliance reporting | PASS |
| `repos/dues-payments.repo.test.ts` | test | DuesPayment repo unit tests | PASS |
| `repos/dues-schema.test.ts` | test | Dues schema validation tests | PASS |

### 1.3 Utility/Service Files (27 files)

| File | Classification | Purpose | Status |
|------|---------------|---------|--------|
| `utils/status-transitions.ts` | service | Invoice, Payment, Membership, License, Term transition maps | WARN (EF-M04-fe01) |
| `utils/status-transitions.test.ts` | test | Status transition validation (comprehensive, all 5 machines) | PASS |
| `utils/compute-membership-status.ts` | service | Computed membership status from dues_expiry_date (BR-01) | PASS |
| `utils/compute-membership-status.test.ts` | test | Membership status computation tests | PASS |
| `utils/credential-token.ts` | service | Credential verification token generation | PASS |
| `utils/credit-cycle.ts` | service | CPD credit cycle calculations | PASS |
| `utils/credit-cycle.test.ts` | test | Credit cycle tests | PASS |
| `utils/dunning-escalation.ts` | service | Dunning escalation logic | PASS |
| `utils/expiry-extension.ts` | service | Membership expiry extension calculations | PASS |
| `utils/expiry-extension.test.ts` | test | Expiry extension tests | PASS |
| `utils/fund-math.ts` | service | Fund allocation arithmetic | PASS |
| `utils/fund-math.test.ts` | test | Fund math tests | PASS |
| `utils/gateway-adapter.ts` | service | Payment gateway abstraction | PASS |
| `utils/gateway-adapter.test.ts` | test | Gateway adapter tests | PASS |
| `utils/membership-lifecycle.ts` | service | Membership lifecycle operations | PASS |
| `utils/payment-token.ts` | service | Payment token generation | PASS |
| `utils/paymongo.adapter.ts` | service | PayMongo gateway adapter (PH-specific) | PASS |
| `utils/receipt-number.ts` | service | Receipt number generation | PASS |
| `utils/receipt-number.test.ts` | test | Receipt number tests | PASS |
| `utils/refund-validation.ts` | service | Refund validation logic | PASS |
| `utils/refund-validation.test.ts` | test | Refund validation tests | PASS |
| `utils/reminder-schedule.ts` | service | Dues reminder scheduling | PASS |
| `utils/reminder-schedule.test.ts` | test | Reminder schedule tests | PASS |
| `utils/settle-payment.ts` | service | Payment settlement logic | PASS |
| `utils/settle-payment.test.ts` | test | Payment settlement tests | PASS |
| `utils/transcript-template.ts` | service | Credit transcript PDF template | PASS |
| `utils/transcript-template.test.ts` | test | Transcript template tests | PASS |

### 1.4 Job/Background Service Files (13 files)

| File | Classification | Purpose | Status |
|------|---------------|---------|--------|
| `jobs/index.ts` | service | Job registration (dues.reminderProcessor, etc.) | PASS |
| `jobs/index.test.ts` | test | Job registration tests | PASS |
| `jobs/complianceThreshold.ts` | service | CPD compliance threshold notifications | PASS |
| `jobs/complianceThreshold.test.ts` | test | Compliance threshold tests | PASS |
| `jobs/creditIssue.ts` | service | Credit issuance job | PASS |
| `jobs/creditIssue.test.ts` | test | Credit issuance tests | PASS |
| `jobs/directoryAutoPopulate.ts` | service | Auto-populate directory profile on membership creation | WARN (cross-import) |
| `jobs/directoryAutoPopulate.test.ts` | test | Directory auto-populate unit tests | PASS |
| `jobs/directoryAutoPopulate.integration.test.ts` | test | Directory auto-populate integration tests | PASS |
| `jobs/reminderProcessor.ts` | service | Daily dues reminder processing | PASS |
| `jobs/reminderProcessor.test.ts` | test | Reminder processor tests | PASS |
| `jobs/webhookRetryProcessor.ts` | service | Payment webhook retry logic | PASS |
| `jobs/webhookRetryProcessor.test.ts` | test | Webhook retry tests | PASS |

### 1.5 Handler/Controller Files (~107 files)

#### Governance (M04-core)

| File | Classification | Spec Trace | Status |
|------|---------------|-----------|--------|
| `createOfficerTerm.ts` | controller | API_CONTRACTS 2.3; BR-09, M4-R1, M4-R2 | WARN (EF-M04-fe02, EF-M04-fe05) |
| `createOfficerTerm.test.ts` | test | AC-M04-002 | PASS |
| `deleteOfficerTerm.ts` | controller | API_CONTRACTS 2.3 DELETE | PASS |
| `listOfficerTerms.ts` | controller | (list variant) | WARN (EF-M04-fe03) |
| `updateOfficerTerm.ts` | controller | (update variant) | PASS |
| `getOfficerTerm.ts` | controller | (get variant) | PASS |
| `getMyOfficerRole.ts` | controller | (self-check) | PASS |
| `createPosition.ts` | controller | MODULE_SPEC s7 Entity: Position | PASS |
| `deletePosition.ts` | controller | (CRUD) | PASS |
| `listPositions.ts` | controller | (CRUD) | PASS |
| `getPosition.ts` | controller | (CRUD) | PASS |
| `updatePosition.ts` | controller | (CRUD) | PASS |
| `createDisciplinaryAction.ts` | controller | API_CONTRACTS 2.5; M4-R4, M4-R6 | PASS |
| `createTransitionChecklist.ts` | controller | API_CONTRACTS 2.4; M4-R3 | PASS |
| `getOrganizationProfile.ts` | controller | API_CONTRACTS 2.1 GET | WARN (EF-M04-fe04) |
| `updateOrganizationProfile.ts` | controller | API_CONTRACTS 2.1 PUT; M4-R5, BR-31 | WARN (EF-M04-fe04) |
| `ac-m04.org-admin.test.ts` | test | AC-M04-001 through AC-M04-007 | PASS |
| `officer-admin.test.ts` | test | Officer admin tests | PASS |
| `governance.test.ts` | test | Governance unit tests | PASS |

#### Membership CRUD

| File | Classification | Status |
|------|---------------|--------|
| `createMembership.ts` | controller | PASS |
| `createMembership.test.ts` | test | PASS |
| `updateMembership.ts` | controller | PASS |
| `deleteMembership.ts` | controller | PASS |
| `getMembership.ts` | controller | PASS |
| `listMemberships.ts` | controller | PASS |
| `renewMembership.ts` | controller | PASS |
| `reinstateMembership.ts` | controller | PASS |
| `reinstateMembership.test.ts` | test | PASS |
| `resignMembership.ts` | controller | PASS |
| `resignMembership.test.ts` | test | PASS |
| `terminateMembership.ts` | controller | PASS |
| `terminateMembership.test.ts` | test | PASS |
| `deceaseMembership.ts` | controller | PASS |
| `deceaseMembership.test.ts` | test | PASS |
| `createInstitutionalMembership.ts` | controller | PASS |
| `deleteInstitutionalMembership.ts` | controller | PASS |
| `updateInstitutionalMembership.ts` | controller | PASS |
| `membership.test.ts` | test | PASS |

#### Membership Tiers/Categories

| File | Classification | Status |
|------|---------------|--------|
| `createMembershipTier.ts` | controller | PASS |
| `deleteMembershipTier.ts` | controller | PASS |
| `getMembershipTier.ts` | controller | PASS |
| `createMembershipCategory.ts` | controller | PASS |
| `deleteMembershipCategory.ts` | controller | PASS |
| `getMembershipCategory.ts` | controller | PASS |
| `upsertMembershipCategory.ts` | controller | PASS |

#### Membership Applications

| File | Classification | Status |
|------|---------------|--------|
| `createMembershipApplication.ts` | controller | PASS |
| `deleteMembershipApplication.ts` | controller | PASS |
| `listMembershipApplications.ts` | controller | WARN (EF-M04-fe03) |
| `approveMembershipApplication.ts` | controller | PASS |
| `approveMembershipApplication.test.ts` | test | PASS |
| `bulkApproveMembershipApplications.ts` | controller | PASS |
| `bulkApproveMembershipApplications.test.ts` | test | PASS |
| `denyMembershipApplication.ts` | controller | PASS |
| `denyMembershipApplication.test.ts` | test | PASS |

#### Chapters/Affiliations

| File | Classification | Status |
|------|---------------|--------|
| `createChapterAffiliation.ts` | controller | PASS |
| `deleteChapterAffiliation.ts` | controller | PASS |
| `getChapterAffiliation.ts` | controller | PASS |
| `updateChapterAffiliation.ts` | controller | PASS |
| `setPrimaryChapterAffiliation.ts` | controller | PASS |
| `createAffiliationTransfer.ts` | controller | PASS |
| `approveTransferBySource.ts` | controller | PASS |
| `approveTransferByTarget.ts` | controller | PASS |
| `completeAffiliationTransfer.ts` | controller | PASS |
| `denyAffiliationTransfer.ts` | controller | PASS |
| `getAffiliationTransfer.ts` | controller | PASS |
| `chapters.test.ts` | test | PASS |
| `transfer-lifecycle.test.ts` | test | PASS |

#### Royalty Splits

| File | Classification | Status |
|------|---------------|--------|
| `createRoyaltySplit.ts` | controller | PASS |
| `deleteRoyaltySplit.ts` | controller | PASS |
| `listRoyaltySplits.ts` | controller | PASS |
| `getRoyaltySplit.ts` | controller | PASS |
| `updateRoyaltySplit.ts` | controller | PASS |

#### Credentials/Licenses

| File | Classification | Status |
|------|---------------|--------|
| `createCredentialTemplate.ts` | controller | PASS |
| `deleteCredentialTemplate.ts` | controller | PASS |
| `getCredentialTemplate.ts` | controller | PASS |
| `updateCredentialTemplate.ts` | controller | PASS |
| `issueDigitalCredential.ts` | controller | PASS |
| `deleteDigitalCredential.ts` | controller | PASS |
| `getDigitalCredential.ts` | controller | PASS |
| `updateDigitalCredential.ts` | controller | PASS |
| `revokeDigitalCredential.ts` | controller | PASS |
| `verifyDigitalCredentialAuthenticated.ts` | controller | PASS |
| `verifyCredentialPublic.ts` | controller | PASS |
| `lookupCredentialPublic.ts` | controller | WARN (EF-M04-fe03) |
| `verifyCertificatePublic.ts` | controller | PASS |
| `getCertificate.ts` | controller | PASS |
| `bulkIssueCertificates.ts` | controller | PASS |
| `createProfessionalLicense.ts` | controller | PASS |
| `deleteProfessionalLicense.ts` | controller | PASS |
| `getProfessionalLicense.ts` | controller | PASS |
| `listProfessionalLicenses.ts` | controller | PASS |
| `updateProfessionalLicense.ts` | controller | PASS |
| `acknowledgeLicenseRenewalAlert.ts` | controller | PASS |
| `credentials.test.ts` | test | PASS |
| `lookupCredentialPublic.test.ts` | test | PASS |

#### Credits/CPD

| File | Classification | Status |
|------|---------------|--------|
| `createCreditEntry.ts` | controller | PASS |
| `getCreditTranscript.ts` | controller | PASS |
| `getCreditTranscriptPdf.ts` | controller | PASS |
| `getCreditTranscriptPdf.test.ts` | test | PASS |
| `getCreditCompliance.ts` | controller | WARN (EF-M04-fe06) |
| `getComplianceReport.ts` | controller | PASS |
| `getComplianceReport.test.ts` | test | PASS |
| `getOrgCpdConfig.ts` | controller | PASS |
| `updateCpdConfig.ts` | controller | PASS |
| `updateCpdConfig.test.ts` | test | PASS |
| `getCpdConfig.ts` | controller | PASS |
| `getCpdConfig.test.ts` | test | PASS |
| `refreshCompliance.ts` | controller | PASS |
| `refreshCompliance.test.ts` | test | PASS |
| `awardManualCredit.ts` | controller | PASS |
| `awardManualCredit.test.ts` | test | PASS |
| `voidCreditEntry.ts` | controller | PASS |
| `voidCreditEntry.test.ts` | test | PASS |
| `credits.test.ts` | test | PASS |

#### Directory

| File | Classification | Status |
|------|---------------|--------|
| `createDirectoryProfile.ts` | controller | PASS |
| `deleteDirectoryProfile.ts` | controller | PASS |
| `getDirectoryProfile.ts` | controller | PASS |
| `getPublicDirectoryProfile.ts` | controller | PASS |
| `updateDirectoryProfile.ts` | controller | PASS |
| `publishMyDirectoryProfile.ts` | controller | WARN (EF-M04-fe03) |
| `searchDirectory.ts` | controller | PASS |
| `directory.test.ts` | test | PASS |

#### Dues (Legacy + V2)

| File | Classification | Status |
|------|---------------|--------|
| `createDuesConfig.ts` | controller | PASS |
| `deleteDuesConfig.ts` | controller | PASS |
| `getDuesConfig.ts` | controller | PASS |
| `getDuesConfig.test.ts` | test | PASS |
| `updateDuesConfig.ts` | controller | PASS |
| `createDuesInvoice.ts` | controller | WARN (EF-M04-fe03) |
| `deleteDuesInvoice.ts` | controller | PASS |
| `getDuesInvoice.ts` | controller | WARN (EF-M04-fe03) |
| `getDuesInvoice.test.ts` | test | PASS |
| `updateDuesInvoice.ts` | controller | PASS |
| `listDuesInvoices.ts` | controller | WARN (EF-M04-fe03) |
| `generateDuesInvoicesForOrg.ts` | controller | PASS |
| `generateDuesInvoicesForOrg.test.ts` | test | PASS |
| `markDuesInvoicePaid.ts` | controller | PASS |
| `markDuesInvoicePaid.test.ts` | test | PASS |
| `getDuesPayment.ts` | controller | PASS |
| `getDuesPayment.test.ts` | test | PASS |
| `recordDuesPayment.ts` | controller | PASS |
| `recordDuesPayment.test.ts` | test | PASS |
| `recordManualPayment.ts` | controller | PASS |
| `recordManualPayment.test.ts` | test | PASS |
| `refundDuesPayment.ts` | controller | PASS |
| `refundDuesPayment.test.ts` | test | PASS |
| `bulkRecordPayments.ts` | controller | PASS |
| `bulkRecordPayments.test.ts` | test | PASS |
| `confirmPaymentProof.ts` | controller | PASS |
| `rejectPaymentProof.ts` | controller | PASS |
| `submitPaymentProof.ts` | controller | PASS |
| `validatePaymentLink.ts` | controller | PASS |
| `generatePaymentLink.ts` | controller | PASS |
| `generatePaymentReceipt.ts` | controller | PASS |
| `generatePaymentReceipt.test.ts` | test | PASS |
| `initiateOnlinePayment.ts` | controller | PASS |
| `initiateOnlinePayment.test.ts` | test | PASS |
| `handlePaymentWebhook.ts` | controller | PASS |
| `getDuesDashboard.ts` | controller | PASS |
| `getDuesDashboard.test.ts` | test | PASS |
| `getDuesFinancialDashboard.ts` | controller | PASS |
| `getDuesFinancialDashboard.test.ts` | test | PASS |
| `getDuesMemberSummary.ts` | controller | PASS |
| `getDuesMemberSummary.test.ts` | test | PASS |
| `getDuesMetrics.ts` | controller | PASS |
| `getDuesMetrics.test.ts` | test | PASS |
| `getDuesGatewayConfig.ts` | controller | PASS |
| `upsertDuesGatewayConfig.ts` | controller | PASS |
| `disconnectDuesGateway.ts` | controller | PASS |
| `testDuesGatewayConnection.ts` | controller | PASS |
| `upsertDuesFunds.ts` | controller | PASS |
| `generateDuesReport.ts` | controller | PASS |
| `getAgingBucket.ts` | controller | PASS |
| `recalculateAgingBucket.ts` | controller | PASS |
| `applySpecialAssessment.ts` | controller | PASS |
| `applySpecialAssessment.test.ts` | test | PASS |
| `createSpecialAssessment.ts` | controller | PASS |
| `createSpecialAssessment.test.ts` | test | PASS |
| `deleteSpecialAssessment.ts` | controller | PASS |
| `deleteSpecialAssessment.test.ts` | test | PASS |
| `getSpecialAssessmentCollection.ts` | controller | PASS |
| `getSpecialAssessmentCollection.test.ts` | test | PASS |
| `listSpecialAssessments.ts` | controller | PASS |
| `listSpecialAssessments.test.ts` | test | PASS |
| `updateSpecialAssessment.ts` | controller | PASS |
| `updateSpecialAssessment.test.ts` | test | PASS |
| `dues.test.ts` | test | PASS |
| `dues-config.test.ts` | test | PASS |
| `dues-mutation-auth.test.ts` | test | PASS |

#### Dunning

| File | Classification | Status |
|------|---------------|--------|
| `createDunningTemplate.ts` | controller | PASS |
| `deleteDunningTemplate.ts` | controller | PASS |
| `getDunningTemplate.ts` | controller | PASS |
| `updateDunningTemplate.ts` | controller | PASS |
| `runDunning.ts` | controller | PASS |
| `dunning.test.ts` | test | PASS |
| `dunning-escalation.test.ts` | test | PASS |

#### Elections

| File | Classification | Status |
|------|---------------|--------|
| `createElection.ts` | controller | PASS |
| `deleteElection.ts` | controller | PASS |
| `getElection.ts` | controller | PASS |
| `updateElection.ts` | controller | PASS |
| `openElectionNominations.ts` | controller | PASS |
| `openElectionVoting.ts` | controller | PASS |
| `openElectionVoting.test.ts` | test | PASS |
| `certifyElection.ts` | controller | PASS |
| `certifyElection.test.ts` | test | PASS |
| `createCandidate.ts` | controller | PASS |
| `createCandidate.test.ts` | test | PASS |
| `deleteCandidate.ts` | controller | PASS |
| `updateCandidate.ts` | controller | PASS |
| `getCandidate.ts` | controller | PASS |
| `castBallot.ts` | controller | PASS |
| `castBallot.test.ts` | test | PASS |
| `election-role-enforcement.test.ts` | test | PASS |

#### Roster/Seats

| File | Classification | Status |
|------|---------------|--------|
| `addRosterMember.ts` | controller | PASS |
| `getRosterMember.ts` | controller | WARN (EF-M04-fe06) |
| `listRosterMembers.ts` | controller | WARN (EF-M04-fe06) |
| `listRosterMembers.test.ts` | test | PASS |
| `updateRosterMember.ts` | controller | PASS |
| `importRosterMembers.ts` | controller | PASS |
| `allocateSeat.ts` | controller | PASS |
| `revokeSeat.ts` | controller | PASS |
| `listSeatAllocations.ts` | controller | PASS |

---

## 2. Domain Term Verification

### M04 Spec Domain Terms vs. Code

| Spec Term | Expected Schema | Found In Code | Status |
|-----------|----------------|---------------|--------|
| Organization | `organization` table | `@/handlers/platformadmin/repos/platform-admin.schema` (cross-import) | WARN |
| Officer | officer_term + position | `repos/governance.schema.ts` | PASS |
| President | position_level enum | `positionLevelEnum` in governance.schema.ts | PASS |
| Position | position table | `repos/governance.schema.ts` L34 | PASS |
| Officer Term | officer_term table | `repos/governance.schema.ts` L47 | PASS |
| Org Public Page | (frontend concern + public slug) | getOrganizationProfile.ts reads org by slug | PASS |
| Disciplinary Action | disciplinary_action table | `repos/governance.schema.ts` L93 | PASS |
| Transition Checklist | transition_checklist table | `repos/governance.schema.ts` L70 | PASS |

### State Machine Alignment

| State Machine | Spec Source | Code Implementation | Status |
|--------------|------------|---------------------|--------|
| Officer Term (term_status) | MODULE_SPEC s8: upcoming->active->completed/resigned/removed | `TERM_VALID_TRANSITIONS` in utils/status-transitions.ts | PASS |
| Organization Lifecycle | MODULE_SPEC s8: Trial->Active->Suspended->Cancelled | Not in this module (owned by platformadmin) | N/A |
| Membership Status | DOMAIN_MODEL 13b/13c | `MEMBERSHIP_VALID_TRANSITIONS` in utils/status-transitions.ts | PASS |
| Invoice Status | DOMAIN_MODEL | `INVOICE_VALID_TRANSITIONS` in utils/status-transitions.ts | PASS |
| Payment Status | DOMAIN_MODEL | `PAYMENT_VALID_TRANSITIONS` in utils/status-transitions.ts | WARN (EF-M04-fe01) |
| License Status | DOMAIN_MODEL | `LICENSE_VALID_TRANSITIONS` in utils/status-transitions.ts | PASS |

---

## 3. New Findings (Per-File Audit)

### EF-M04-fe01 | P1 | Missing `cancelled` key in PAYMENT_VALID_TRANSITIONS

**File**: `utils/status-transitions.ts`
**Check**: Data shape / state machine alignment
**Finding**: `PAYMENT_VALID_TRANSITIONS` includes `pending: ['submitted', 'expired', 'cancelled']` -- so `cancelled` is a valid target state. But `cancelled` is NOT listed as a key in the map. Result: `isValidPaymentTransition('cancelled', anything)` correctly returns `false` (terminal behavior). However, `paymentTransitionError('cancelled', x)` returns `"Unknown payment status 'cancelled'"` instead of `"none (terminal state)"`.
**Impact**: Misleading error message when validating transitions from cancelled state.
**Recommendation**: Add `cancelled: []` to `PAYMENT_VALID_TRANSITIONS` for consistency with other terminal states (refunded, failed, rejected, expired all have explicit empty-array entries).

### EF-M04-fe02 | P2 | Cross-Handler Import: platformadmin repository

**File**: `createOfficerTerm.ts`
**Check**: Import boundaries
**Finding**: Imports `PlatformAdminRepository` from `@/handlers/platformadmin/repos/platform-admin.repo`. Used to verify organization existence before creating an officer term. This is a runtime dependency on another module's repository class (not just schema reference).
**Impact**: Business logic dependency across bounded contexts. If PlatformAdminRepository API changes, this handler breaks.
**Recommendation**: Consider injecting org-existence check via middleware or shared utility. Part of mega-module split plan.

### EF-M04-fe03 | P3 | Cross-Handler Import: person schema (read-only JOINs)

**Files**: `createDuesInvoice.ts`, `getDuesInvoice.ts`, `listDuesInvoices.ts`, `listMembershipApplications.ts`, `listOfficerTerms.ts`, `publishMyDirectoryProfile.ts`, `lookupCredentialPublic.ts`, `jobs/directoryAutoPopulate.ts`
**Check**: Import boundaries
**Finding**: 8 files import `persons` table from `@/handlers/person/repos/person.schema` for JOIN operations (display name in lists). One file (`lookupCredentialPublic.ts`) imports `personPrivacySettings`.
**Impact**: Read-only schema reference for JOINs. Low risk -- Person is the root entity referenced by every context (DOMAIN_MODEL s9 Context 1).
**Recommendation**: Acceptable pattern for read-only JOINs. No action needed.

### EF-M04-fe04 | P2 | Cross-Handler Import: platformadmin schema (organization table)

**Files**: `getOrganizationProfile.ts`, `updateOrganizationProfile.ts`
**Check**: Import boundaries
**Finding**: Import `organizations` table directly from `@/handlers/platformadmin/repos/platform-admin.schema`. The Organization entity is owned by the Platform bounded context (DOMAIN_MODEL s8) but accessed directly.
**Impact**: Tight coupling between Membership and Platform contexts. Documented in DOMAIN_MODEL s12 "Anti-Corruption Layers" as known coupling.
**Recommendation**: Acceptable for now. Target resolution in mega-module split (P1-11, deferred to v1.2.0).

### EF-M04-fe05 | P3 | Naming: ValidatedContext<any> in governance handlers

**Files**: `createOfficerTerm.ts`, `createDisciplinaryAction.ts`, `createPosition.ts` (and likely other governance handlers)
**Check**: Naming / typing
**Finding**: M04-governance handlers use `ValidatedContext<any, never, never>` instead of importing specific generated validator types from `@/generated/openapi/validators`. Contrast with membership handlers (e.g., `createMembership.ts`) which correctly use typed variants (`ValidatedContext<CreateMembershipBody, never, never>`).
**Impact**: Loss of compile-time body type safety. Runtime validation still occurs via OpenAPI middleware.
**Recommendation**: Update governance handlers to use generated validator types for full type safety.

### EF-M04-fe06 | P3 | Cross-Handler Import: membership module (separate handler dir)

**Files**: `getRosterMember.ts`, `listRosterMembers.ts`, `getCreditCompliance.ts`
**Check**: Import boundaries
**Finding**: Import `MembershipRepository` from `@/handlers/membership/repos/membership.repo` (the separate `membership/` handler directory), not from `./repos/membership.repo` (the internal one). Two different `membership.repo.ts` files exist for different concerns.
**Impact**: Ambiguous -- two repos with same name in different modules. Part of mega-module debt.
**Recommendation**: Clarify ownership. Part of mega-module split plan.

---

## 4. Prior Module-Level Findings (Preserved)

These were identified in the prior module-level audit and remain valid:

| ID | Sev | Finding Summary | Status |
|----|-----|----------------|--------|
| EF-M04-a1a1a1a1 | P0 | Domain event registry missing all M04 events (OfficerAssigned, OfficerRemoved, etc.) | OPEN |
| EF-M04-b1b1b1b1 | P0 | domain-event-consumers.ts only wires dues.payment.recorded; no MemberSuspended/MemberRemoved consumers | OPEN |
| EF-M04-c1c1c1c1 | P1 | createDisciplinaryAction.ts does not emit MemberSuspended/MemberRemoved events or update membership status | OPEN |
| EF-M04-d1d1d1d1 | P1 | No transitionOfficerTerm handler; TransitionChecklistRepository methods unused | OPEN |
| EF-M04-e1e1e1e1 | P1 | No unified org dashboard handler matching API_CONTRACTS GET /org/:id/dashboard | OPEN |
| EF-M04-f1f1f1f1 | P2 | getOrgProfile.ts returns hardcoded empty strings for schema-missing fields | OPEN |
| EF-M04-a2a2a2a2 | P2 | getOrganizationBySlug.ts missing description/logoUrl/meetingSchedule/foundingDate | OPEN |
| EF-M04-b2b2b2b2 | P2 | positions table uses free-text title instead of enum; no constraint on spec values | OPEN |
| EF-M04-c2c2c2c2 | P2 | No POST /org/:id/officers handler found (API_CONTRACTS 2.3) | OPEN |
| EF-M04-d2d2d2d2 | P2 | No DELETE /org/:id/officers/:termId handler (API_CONTRACTS 2.3) | OPEN |
| EF-M04-e2e2e2e2 | P2 | SVG upload excluded from storage; AC-M04-007 sanitization not implemented | OPEN |
| EF-M04-f2f2f2f2 | P3 | governance.schema.ts disciplinary_action correctly has immutable design (spec-compliant) | PASS |

---

## 5. Schema Entity Inventory

### Enums (~35 total across 12 schema files)

| Schema File | Enums |
|------------|-------|
| governance.schema.ts | position_level, term_status, transition_checklist_status, disciplinary_action_type |
| membership.schema.ts | tier_status, membership_status, application_status |
| chapters.schema.ts | affiliation_status, transfer_status |
| credentials.schema.ts | license_status, renewal_alert_status, credential_type, credential_template_status, credential_status |
| credits.schema.ts | credit_entry_type, credit_source_type, credit_status, credit_cpd_category, credit_verification_status |
| directory.schema.ts | directory_visibility |
| dues-payments.schema.ts | billing_frequency, dues_payment_method, dues_payment_status, gateway_provider, webhook_retry_status |
| dues.schema.ts | dues_config_status, dues_invoice_status |
| dunning.schema.ts | dunning_channel, dunning_template_status, dunning_delivery_status |
| special-assessments.schema.ts | special_assessment_status, special_assessment_payment_status |

### Tables (~40 total)

| Schema File | Tables |
|------------|--------|
| governance.schema.ts | position, officer_term, transition_checklist, disciplinary_action |
| membership.schema.ts | membership_tier, membership_category, membership, membership_application |
| chapters.schema.ts | chapter_affiliation, affiliation_transfer, royalty_split |
| credentials.schema.ts | professional_license, license_renewal_alert, credential_template, digital_credential |
| credits.schema.ts | credit_entry, org_cpd_config |
| directory.schema.ts | directory_profile |
| dues-payments.schema.ts | dues_org_config, dues_category_override, dues_fund, dues_payment, dues_fund_allocation, dues_reminder_schedule, dues_gateway_config, webhook_retry_log |
| dues.schema.ts | dues_config, dues_invoice, aging_bucket, dues_reminder_log |
| dunning.schema.ts | dunning_template, dunning_event |
| special-assessments.schema.ts | special_assessment, special_assessment_payment |
| status-history.schema.ts | membership_status_history |
| dues-payment-status-history.schema.ts | dues_payment_status_history |

---

## 6. Cross-Handler Import Summary

| Source Handler | Target Module | Import Type | Files |
|---------------|--------------|-------------|-------|
| association:member | platformadmin | schema (organizations table) | getOrganizationProfile.ts, updateOrganizationProfile.ts |
| association:member | platformadmin | repository (PlatformAdminRepository) | createOfficerTerm.ts |
| association:member | person | schema (persons table) | createDuesInvoice.ts, getDuesInvoice.ts, listDuesInvoices.ts, listMembershipApplications.ts, listOfficerTerms.ts, publishMyDirectoryProfile.ts |
| association:member | person | schema (personPrivacySettings) | lookupCredentialPublic.ts |
| association:member | person | schema (persons table) | jobs/directoryAutoPopulate.ts |
| association:member | membership | repository (MembershipRepository) | getRosterMember.ts, listRosterMembers.ts, getCreditCompliance.ts |

**Total cross-handler imports**: 13 files, 3 target modules (platformadmin, person, membership)

---

## 7. Test Coverage Summary

| Category | Test Files | Coverage Notes |
|----------|-----------|----------------|
| Schema validation | repos/dues-schema.test.ts | Entity shape |
| Repository | repos/dues-payments.repo.test.ts | CRUD operations |
| Status transitions | utils/status-transitions.test.ts | Comprehensive (all 5 state machines) |
| Utility functions | 10 test files in utils/ | Unit tests with edge cases |
| Background jobs | 7 test files in jobs/ (incl. 1 integration) | Unit + integration |
| Handler/controller tests | 40+ test files in root | Business logic |
| Integration tests | ac-m04.org-admin.test.ts, jobs/directoryAutoPopulate.integration.test.ts | End-to-end flows |

---

## 8. Audit Verdict

| Check | Result |
|-------|--------|
| Error taxonomy | PASS -- Error classes from @/core/errors used consistently |
| Domain terms | PASS -- All 8 M04 domain terms found in code |
| Data shape | WARN -- `cancelled` status missing from PAYMENT_VALID_TRANSITIONS keys |
| Naming | WARN -- Some governance handlers use `any` instead of generated types |
| Import boundaries | WARN -- 13 cross-handler imports across 3 modules (documented tech debt) |
| State machines | PASS -- 5/6 state machines fully aligned (1 minor key gap) |

### Finding Summary

| Severity | New (per-file) | Prior (module-level) | Total |
|----------|---------------|---------------------|-------|
| P0 | 0 | 2 | 2 |
| P1 | 1 (fe01) | 3 | 4 |
| P2 | 2 (fe02, fe04) | 5 | 7 |
| P3 | 3 (fe03, fe05, fe06) | 1 (PASS) | 3 |
| INFO | 0 | 0 | 0 |
| **Total** | **6** | **11** | **16** (1 PASS) |

The P0s (domain event registry gaps) and P1s (missing handlers, cancelled transition key) are the highest priority. P2 cross-handler imports are documented tech debt tracked in the mega-module split plan (deferred to v1.2.0).
