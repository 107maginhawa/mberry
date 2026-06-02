# Per-File Spec Traceability: M04 Organization Admin

**Module**: `services/api-ts/src/handlers/association:member/`
**Spec Sources**: `docs/product/modules/m04-org-admin/MODULE_SPEC.md`, `API_CONTRACTS.md`
**Cross-references**: `DOMAIN_MODEL.md`, `WORKFLOW_MAP.md`, `ROLE_PERMISSION_MATRIX.md`, `MODULE_MAP.md`
**Audit Date**: 2026-05-28 (refreshed from 2026-05-27)
**Total Files**: 194 non-test handlers in mega-module (31 M04-relevant)
**Prior Findings Preserved**: Yes (EF-M04-a1a1a1a1 through EF-M04-f2f2f2f2 from prior module-level audit)

---

## 1. Spec-to-Handler Traceability Matrix

### 1.0 API Endpoint Coverage (MODULE_SPEC Section 10)

| Spec Endpoint | Method | Path | Handler File | Status |
|---|---|---|---|---|
| API-01 | GET | `/org/:id` | `getOrganizationProfile.ts` | IMPLEMENTED |
| API-02 | PUT | `/org/:id` | `updateOrganizationProfile.ts` | IMPLEMENTED |
| API-03 | POST | `/org/:id/officers` | `createOfficerTerm.ts` | IMPLEMENTED |
| API-04 | DELETE | `/org/:id/officers/:termId` | `deleteOfficerTerm.ts` | IMPLEMENTED |
| API-05 | POST | `/org/:id/officers/:termId/transition` | `transitionOfficerTerm.ts` | IMPLEMENTED |
| API-06 | POST | `/org/:id/discipline` | `createDisciplinaryAction.ts` | IMPLEMENTED |
| API-07 | GET | `/org/:slug/public` | -- | **MISSING** (EF-M04-fe07) |
| API-08 | GET | `/org/:id/dashboard` | `getOrgDashboard.ts` | IMPLEMENTED |

**Coverage: 7/8 spec endpoints implemented (87.5%)**

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
| `repos/institutional-membership.repo.ts` | repository | Institutional membership CRUD | PASS |
| `repos/institutional-membership.schema.ts` | entity | Institutional membership table | PASS |

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
| `utils/membership-status-middleware.ts` | service | Membership status middleware | PASS |
| `utils/membership-status-middleware.test.ts` | test | Membership status middleware tests | PASS |
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

### 1.4 Job/Background Service Files (14 files)

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
| `jobs/statusRecomputeCron.ts` | service | Periodic membership status recomputation | PASS |
| `jobs/webhookRetryProcessor.ts` | service | Payment webhook retry logic | PASS |
| `jobs/webhookRetryProcessor.test.ts` | test | Webhook retry tests | PASS |

### 1.5 Handler/Controller Files (~107 files)

#### Governance (M04-core)

| File | Classification | Spec Trace | Status |
|------|---------------|-----------|--------|
| `createOfficerTerm.ts` | controller | API-03; BR-09, BR-09e, M4-R1, M4-R2 | PASS (auth + one-per-role + board-member exception + platform-admin for president) |
| `createOfficerTerm.test.ts` | test | AC-M04-002 | PASS |
| `deleteOfficerTerm.ts` | controller | API-04 | PASS |
| `transitionOfficerTerm.ts` | controller | API-05; M4-R3 | WARN (EF-M04-fe08) |
| `listOfficerTerms.ts` | controller | (list variant, not in spec) | INFO -- orphan, legitimate |
| `listOfficerTermsSummary.ts` | controller | (summary variant, not in spec) | INFO -- orphan, legitimate |
| `updateOfficerTerm.ts` | controller | (update variant, not in spec) | INFO -- orphan, legitimate |
| `updateOfficerTerm.test.ts` | test | Officer term update | PASS |
| `getOfficerTerm.ts` | controller | (get variant, not in spec) | INFO -- orphan, legitimate |
| `getMyOfficerRole.ts` | controller | (self-check, not in spec) | INFO -- orphan, legitimate |
| `createPosition.ts` | controller | MODULE_SPEC s7 Entity: Position | INFO -- orphan, legitimate |
| `deletePosition.ts` | controller | (CRUD) | INFO -- orphan, legitimate |
| `listPositions.ts` | controller | (CRUD) | INFO -- orphan, legitimate |
| `getPosition.ts` | controller | (CRUD) | INFO -- orphan, legitimate |
| `updatePosition.ts` | controller | (CRUD) | INFO -- orphan, legitimate |
| `createDisciplinaryAction.ts` | controller | API-06; M4-R4, M4-R2, M4-R6 | PASS |
| `getOrganizationProfile.ts` | controller | API-01 | WARN (EF-M04-fe10) |
| `updateOrganizationProfile.ts` | controller | API-02; M4-R5, BR-31 | WARN (EF-M04-fe09) |
| `getOrgDashboard.ts` | controller | API-08; AC-M04-005 | PASS |
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
| `createInstitutionalMembership.test.ts` | test | PASS |
| `deleteInstitutionalMembership.ts` | controller | PASS |
| `deleteInstitutionalMembership.test.ts` | test | PASS |
| `getInstitutionalMembership.ts` | controller | PASS |
| `getInstitutionalMembership.test.ts` | test | PASS |
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
| `getMembershipApplication.ts` | controller | PASS |
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
| `updateOrgCpdConfig.ts` | controller | PASS |
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
| `allocateSeat.test.ts` | test | PASS |
| `revokeSeat.ts` | controller | PASS |
| `listSeatAllocations.ts` | controller | PASS |

#### Subscriptions

| File | Classification | Status |
|------|---------------|--------|
| `createSubscriptionCheckout.ts` | controller | PASS |
| `getMySubscription.ts` | controller | PASS |

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
| Org Public Page | (frontend concern + public slug) | No dedicated handler (EF-M04-fe07) | FAIL |
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

## 3. New Findings (File-Level Audit, 2026-05-28)

### EF-M04-fe07 | P1 | Missing Public Page Handler (GET /org/:slug/public)

**File**: (does not exist)
**Spec Ref**: API-07, BR-29, WF-028, AC-M04-006
**Finding**: No handler implements `GET /org/:slug/public`. The spec requires a public-facing org page accessible without auth, returning org profile data and "Apply to Join" CTA. `getPublicDirectoryProfile.ts` exists but is member-directory-scoped, not org-profile-scoped. No file matching `*public*` or `*slug*` exists in the association:member handler directory.
**Impact**: Public page unreachable. Apply-to-Join flow dead. BR-29 not satisfied.
**Fix**: Create `getPublicOrgPage.ts` handler with slug-based org lookup, no auth middleware, suspended-org banner support per error handling spec row 6.

### EF-M04-fe08 | P2 | Transition Checklist Optional, Not Required (M4-R3)

**File**: `transitionOfficerTerm.ts`
**Spec Ref**: M4-R3, WF-025, AC-M04-003
**Finding**: Spec says "IF officer transition THEN checklist required before transfer" and "Role-specific items auto-generated." Handler treats checklist items as optional: `if (body.checklistItems && body.checklistItems.length > 0)`. An officer transition can complete with zero checklist items, bypassing accountability.
**Impact**: Knowledge transfer can be skipped entirely. No forced handover documentation.
**Fix**: Either (a) require non-empty `checklistItems` array in body validation, or (b) auto-generate default checklist items when none provided (per M4-R3 "auto-generated" directive).

### EF-M04-fe09 | P2 | SVG Handling Diverges from Spec (Block vs. Sanitize)

**File**: `updateOrganizationProfile.ts`
**Spec Ref**: BR-31, M4-R5, AC-M04-007
**Finding**: Spec says "sanitize SVG (strip scripts, event handlers, external refs)" -- sanitize and allow. Handler **blocks SVGs entirely** via `throw new ValidationError('SVG logos are not allowed')`. The AC test file has a `sanitizeSvg()` function that correctly strips scripts, but this function is not used in the actual handler. The handler is more restrictive than spec requires.
**Impact**: SVG logos cannot be uploaded. Spec and code disagree on behavior.
**Fix**: Blocking is arguably more secure than sanitizing. Recommend updating MODULE_SPEC BR-31, M4-R5, and AC-M04-007 to reflect the current "block SVG" policy. Alternative: implement sanitization per spec if SVG support is desired.

### EF-M04-fe10 | P2 | No Suspended Org Banner in Profile Response

**File**: `getOrganizationProfile.ts`
**Spec Ref**: Error Handling row 6 ("Org suspended -> 200 with banner")
**Finding**: Spec error table says suspended orgs should return 200 with banner "This organization is currently inactive." Handler returns raw org data without checking or surfacing org status.
**Impact**: Suspended orgs appear identical to active orgs in API responses.
**Fix**: Add org status check in response; include `isSuspended: boolean` and optional `statusBanner: string` fields.

### EF-M04-fe11 | P2 | Domain Event Consumers Not Wired

**File**: (no consumer file exists)
**Spec Ref**: MODULE_SPEC 10b Consumed Events
**Finding**: Spec declares two consumed events: `ElectionPublished` (from M12, triggers officer transition from election results) and `OrganizationCreated` (from M03, initializes dashboard + creates default positions). Grep for both event names across the entire `association:member/` directory returns zero matches.
**Impact**: Election results don't auto-trigger officer transitions. New orgs don't get default positions.
**Fix**: Register domain event listeners in `association:member/` for `ElectionPublished` (create officer terms from election results) and `OrganizationCreated` (create default position records).

### EF-M04-fe12 | P3 | Self-Discipline Not Blocked

**File**: `createDisciplinaryAction.ts`
**Spec Ref**: Edge Cases (UI Blueprint S05)
**Finding**: UI blueprint says "Self-discipline: server rejects -- president cannot discipline themselves." Handler does not check `body.targetPersonId === user.id`. President can issue disciplinary action against self.
**Impact**: Low -- unlikely in practice, but spec says it should be blocked.
**Fix**: Add `if (body.targetPersonId === user.id) return ctx.json({ error: 'Cannot issue disciplinary action against yourself' }, 400)`.

### EF-M04-fe13 | INFO | 2FA Enforcement Correctly Implemented

**File**: `utils/officer-check.ts` (shared utility, not in handler dir)
**Spec Ref**: MODULE_SPEC Section 6 Permissions, AI Instruction #3
**Finding**: `requirePosition()` correctly enforces 2FA for privileged positions (president, secretary, treasurer) in production. Skipped in dev via `NODE_ENV` check (line 102). All governance mutation handlers use `requirePosition()`.
**Status**: PASS -- no action needed.

### EF-M04-fe14 | INFO | Auth Pattern Consistent Across Governance Handlers

**File**: All governance mutation handlers
**Spec Ref**: M4-R2
**Finding**: `createOfficerTerm`, `deleteOfficerTerm`, `transitionOfficerTerm`, `createDisciplinaryAction`, `updateOrganizationProfile` all use `requirePosition([POSITION_TITLES.PRESIDENT])`. `getOrgDashboard` uses `requirePosition([PRESIDENT, TREASURER, SECRETARY])` for read access per spec.
**Status**: PASS -- auth patterns are correct and consistent.

### EF-M04-fe15 | INFO | Domain Events Published Correctly

**File**: Multiple governance handlers
**Spec Ref**: MODULE_SPEC 10b Published Events
**Finding**: All three officer lifecycle events emit correctly: `officer.assigned` (createOfficerTerm L89), `officer.removed` (deleteOfficerTerm L50), `officer.transitioned` (transitionOfficerTerm L109). Disciplinary events emit `member.suspended` and `member.removed` based on action type.
**Status**: PASS -- published events aligned with spec.

---

## 4. Prior Module-Level Findings (Preserved)

These were identified in the prior module-level audit. Status updated where findings have been resolved.

| ID | Sev | Finding Summary | Status |
|----|-----|----------------|--------|
| EF-M04-a1a1a1a1 | P0 | Domain event registry missing all M04 events (OfficerAssigned, OfficerRemoved, etc.) | **RESOLVED** -- events emitted via `domainEvents.emit()` in handlers (see EF-M04-fe15) |
| EF-M04-b1b1b1b1 | P0 | domain-event-consumers.ts only wires dues.payment.recorded; no MemberSuspended/MemberRemoved consumers | OPEN (subsumed by EF-M04-fe11) |
| EF-M04-c1c1c1c1 | P1 | createDisciplinaryAction.ts does not emit MemberSuspended/MemberRemoved events or update membership status | **RESOLVED** -- handler now emits `member.suspended` and `member.removed` based on actionType |
| EF-M04-d1d1d1d1 | P1 | No transitionOfficerTerm handler; TransitionChecklistRepository methods unused | **RESOLVED** -- `transitionOfficerTerm.ts` exists and uses TransitionChecklistRepository |
| EF-M04-e1e1e1e1 | P1 | No unified org dashboard handler matching API_CONTRACTS GET /org/:id/dashboard | **RESOLVED** -- `getOrgDashboard.ts` implements full dashboard with metrics + action cards |
| EF-M04-f1f1f1f1 | P2 | getOrgProfile.ts returns hardcoded empty strings for schema-missing fields | NEEDS RE-VERIFY (handler renamed to getOrganizationProfile.ts) |
| EF-M04-a2a2a2a2 | P2 | getOrganizationBySlug.ts missing description/logoUrl/meetingSchedule/foundingDate | OPEN (no slug handler exists; subsumed by EF-M04-fe07) |
| EF-M04-b2b2b2b2 | P2 | positions table uses free-text title instead of enum; no constraint on spec values | OPEN |
| EF-M04-c2c2c2c2 | P2 | No POST /org/:id/officers handler found (API_CONTRACTS 2.3) | **RESOLVED** -- `createOfficerTerm.ts` implements this |
| EF-M04-d2d2d2d2 | P2 | No DELETE /org/:id/officers/:termId handler (API_CONTRACTS 2.3) | **RESOLVED** -- `deleteOfficerTerm.ts` implements this |
| EF-M04-e2e2e2e2 | P2 | SVG upload excluded from storage; AC-M04-007 sanitization not implemented | OPEN (subsumed by EF-M04-fe09) |
| EF-M04-f2f2f2f2 | P3 | governance.schema.ts disciplinary_action correctly has immutable design (spec-compliant) | PASS |

---

## 5. Orphan Handler Analysis

10 handlers exist in governance scope but are **not listed in the M04 spec's 8 API endpoints**:

| Handler | Classification | Notes |
|---|---|---|
| `createPosition.ts` | Legitimate extension | Position CRUD. Spec lists Position entity (s7) but no explicit CRUD endpoints. |
| `deletePosition.ts` | Legitimate extension | Position CRUD. |
| `getPosition.ts` | Legitimate extension | Position CRUD. |
| `listPositions.ts` | Legitimate extension | Position CRUD. |
| `updatePosition.ts` | Legitimate extension | Position CRUD. |
| `getOfficerTerm.ts` | Legitimate extension | Single-term read. Spec has assign/remove/transition but no GET single. |
| `listOfficerTerms.ts` | Legitimate extension | List terms. Needed by officer management UI. |
| `listOfficerTermsSummary.ts` | Legitimate extension | Summary view for dashboard. |
| `updateOfficerTerm.ts` | Legitimate extension | Update term metadata (notes, dates). |
| `getMyOfficerRole.ts` | Legitimate extension | Current user's role lookup. Needed by frontend auth context. |

**Verdict**: All 10 are legitimate CRUD extensions needed by the UI. **Recommend adding Position CRUD and officer term read/list endpoints to spec Section 10** to close the traceability gap.

---

## 6. Extended Handlers (Cross-Module in Mega-Module)

14 handlers matched M04 keywords but belong to other modules sharing the mega-module directory:

| Handler | Belongs To | Reason |
|---|---|---|
| `addRosterMember.ts` | M05 Membership | Roster management |
| `getRosterMember.ts` | M05 Membership | Roster management |
| `importRosterMembers.ts` | M05 Membership | Roster management |
| `listRosterMembers.ts` | M05 Membership | Roster management |
| `updateRosterMember.ts` | M05 Membership | Roster management |
| `generateDuesInvoicesForOrg.ts` | M06 Dues | Org-scoped dues generation |
| `getDuesDashboard.ts` | M06 Dues | Finance dashboard |
| `getDuesFinancialDashboard.ts` | M06 Dues | Finance dashboard |
| `getOrgCpdConfig.ts` | M09 Training/CPD | CPD config per org |
| `updateOrgCpdConfig.ts` | M09 Training/CPD | CPD config per org |
| `getPublicDirectoryProfile.ts` | M05 Directory | Public member lookup |
| `lookupCredentialPublic.ts` | M11 Credentials | Public verification |
| `verifyCertificatePublic.ts` | M11 Certificates | Public verification |
| `verifyCredentialPublic.ts` | M11 Credentials | Public verification |

This is expected in the mega-module architecture. See P1-11 (deferred mega-module split, v1.2.0).

---

## 7. Business Rule Coverage

| Rule | Status | Evidence |
|---|---|---|
| BR-09 / M4-R1 | IMPLEMENTED | `createOfficerTerm.ts`: `findActiveByPosition()` check, Board Member exception via title match |
| BR-09 / M4-R2 | IMPLEMENTED | All governance mutation handlers: `requirePosition([POSITION_TITLES.PRESIDENT])` |
| BR-09e | IMPLEMENTED | `createOfficerTerm.ts`: President position requires `PlatformAdminRepository.findById()` check |
| BR-29 | **NOT IMPLEMENTED** | No public page handler (EF-M04-fe07) |
| BR-31 / M4-R5 | **DIVERGENT** | SVGs blocked entirely, not sanitized per spec (EF-M04-fe09) |
| M4-R3 | **PARTIAL** | Checklist optional, not required (EF-M04-fe08) |
| M4-R4 | IMPLEMENTED | Reason required (handler check + schema `NOT NULL`), no update handler (immutable by design) |
| M4-R6 | IMPLEMENTED | `auditAction()` called in create/transition/delete/update governance handlers |
| M4-R7 | IMPLEMENTED | All queries scoped by `organizationId` parameter or context |

---

## 8. Domain Event Coverage

### Published Events

| Event | Handler | Line | Status |
|---|---|---|---|
| `officer.assigned` | `createOfficerTerm.ts` | L89 | IMPLEMENTED |
| `officer.removed` | `deleteOfficerTerm.ts` | L50 | IMPLEMENTED |
| `officer.transitioned` | `transitionOfficerTerm.ts` | L109 | IMPLEMENTED |
| `member.suspended` | `createDisciplinaryAction.ts` | (suspension type) | IMPLEMENTED |
| `member.removed` | `createDisciplinaryAction.ts` | (removal/expulsion type) | IMPLEMENTED |

### Consumed Events

| Event | Source | Expected Side Effect | Status |
|---|---|---|---|
| `ElectionPublished` | M12 Elections | Trigger officer transition from election results | **NOT IMPLEMENTED** (EF-M04-fe11) |
| `OrganizationCreated` | M03 Platform | Initialize dashboard, create default positions | **NOT IMPLEMENTED** (EF-M04-fe11) |

---

## 9. Error Handling Coverage

| Spec Error Scenario | Expected | Handler | Status |
|---|---|---|---|
| Duplicate role assignment | 409 "This role is currently held by [Name]." | `createOfficerTerm.ts` | IMPLEMENTED (message slightly different but correct) |
| Non-president assigns role | 403 "Only the President can assign officer roles." | `createOfficerTerm.ts` via `requirePosition` | IMPLEMENTED |
| Empty disciplinary reason | Block submission | `createDisciplinaryAction.ts` | IMPLEMENTED (400) |
| SVG with scripts | Strip and save (sanitize) | `updateOrganizationProfile.ts` | **DIVERGENT** -- blocks SVG entirely (EF-M04-fe09) |
| Org not found (public page) | 404 "Organization not found." | -- | **NOT IMPLEMENTED** (no handler, EF-M04-fe07) |
| Org suspended (public page) | 200 with banner | `getOrganizationProfile.ts` | **NOT IMPLEMENTED** (EF-M04-fe10) |
| Cross-org 403 | "You do not have permission in this organization." | All handlers via orgId context | IMPLEMENTED |

---

## 10. Test Coverage Summary

| Category | Test Files | Coverage Notes |
|----------|-----------|----------------|
| Acceptance criteria | `ac-m04.org-admin.test.ts` | All 7 ACs covered with pure-logic tests |
| Schema validation | `repos/dues-schema.test.ts` | Entity shape |
| Repository | `repos/dues-payments.repo.test.ts` | CRUD operations |
| Status transitions | `utils/status-transitions.test.ts` | Comprehensive (all 5 state machines) |
| Utility functions | 10+ test files in `utils/` | Unit tests with edge cases |
| Background jobs | 7 test files in `jobs/` (incl. 1 integration) | Unit + integration |
| Handler tests | 40+ test files in root | Business logic validation |
| Governance-specific | `officer-admin.test.ts`, `governance.test.ts`, `createOfficerTerm.test.ts`, `updateOfficerTerm.test.ts` | Officer lifecycle |

**Gap**: AC tests use pure-logic inline helpers, not actual handler imports. Handler-level tests exist separately but are not tagged to ACs.

---

## 11. Cross-Handler Import Summary

| Source Handler | Target Module | Import Type | Files |
|---------------|--------------|-------------|-------|
| association:member | platformadmin | schema (organizations table) | `getOrganizationProfile.ts`, `updateOrganizationProfile.ts` |
| association:member | platformadmin | repository (PlatformAdminRepository) | `createOfficerTerm.ts` |
| association:member | person | schema (persons table) | `createDuesInvoice.ts`, `getDuesInvoice.ts`, `listDuesInvoices.ts`, `listMembershipApplications.ts`, `listOfficerTerms.ts`, `publishMyDirectoryProfile.ts` |
| association:member | person | schema (personPrivacySettings) | `lookupCredentialPublic.ts` |
| association:member | person | repository (PersonRepository) | `transitionOfficerTerm.ts` |
| association:member | membership | repository (MembershipRepository) | `getRosterMember.ts`, `listRosterMembers.ts`, `getCreditCompliance.ts` |
| association:member | association:operations | schema (events, trainings) | `getOrgDashboard.ts` |

**Total cross-handler imports**: 14 files, 4 target modules

---

## 12. Audit Verdict

| Check | Result |
|-------|--------|
| API endpoint coverage | **WARN** -- 7/8 spec endpoints implemented (public page missing) |
| Error taxonomy | PASS -- Error classes from `@/core/errors` used consistently |
| Domain terms | WARN -- "Org Public Page" has no handler implementation |
| Data shape | WARN -- `cancelled` status missing from PAYMENT_VALID_TRANSITIONS keys |
| Auth patterns | PASS -- All governance mutations use `requirePosition(PRESIDENT)` with 2FA |
| Business rules | WARN -- 3/9 rules not fully implemented (BR-29, M4-R3, BR-31/M4-R5) |
| Domain events (published) | PASS -- 5/5 events emitted correctly |
| Domain events (consumed) | **FAIL** -- 0/2 consumed events wired |
| Import boundaries | WARN -- 14 cross-handler imports across 4 modules (documented tech debt) |
| State machines | PASS -- 5/6 state machines fully aligned |
| Naming/typing | WARN -- Some governance handlers use `any` instead of generated types |

### Finding Summary

| Severity | Count | IDs |
|----------|-------|-----|
| P1 | 1 | EF-M04-fe07 (public page handler missing) |
| P2 | 4 | EF-M04-fe08 (checklist optional), EF-M04-fe09 (SVG divergent), EF-M04-fe10 (suspended banner), EF-M04-fe11 (event consumers) |
| P3 | 1 | EF-M04-fe12 (self-discipline) |
| INFO | 3 | EF-M04-fe13 (2FA OK), EF-M04-fe14 (auth consistent), EF-M04-fe15 (events published) |
| **Total new** | **9** | 1 P1, 4 P2, 1 P3, 3 INFO |

### Prior Findings Status

| Status | Count |
|--------|-------|
| RESOLVED | 5 (a1a1, c1c1, d1d1, e1e1, c2c2/d2d2) |
| OPEN | 4 (b1b1 subsumed by fe11, f1f1 needs re-verify, a2a2 subsumed by fe07, b2b2, e2e2 subsumed by fe09) |
| PASS | 1 (f2f2) |

### Priority Fix Order

1. **P1** EF-M04-fe07 -- Create public page handler (`GET /org/:slug/public`)
2. **P2** EF-M04-fe11 -- Wire domain event consumers (`ElectionPublished`, `OrganizationCreated`)
3. **P2** EF-M04-fe08 -- Enforce or auto-generate transition checklist items
4. **P2** EF-M04-fe09 -- Resolve SVG spec/code divergence (recommend updating spec to match code)
5. **P2** EF-M04-fe10 -- Add suspended org status check in profile response
6. **P3** EF-M04-fe12 -- Block self-discipline


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
