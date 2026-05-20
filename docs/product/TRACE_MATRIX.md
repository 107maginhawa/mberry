# Intent Traceability Matrix

**Generated:** 2026-05-20
**Scope:** All traceable IDs across docs/product/ specs, handler source, and test files

## Summary

| Metric | Count | % |
|--------|-------|---|
| **Total traceable items** | 246 | -- |
| **Business Rules (BR)** | 40 | -- |
| **Acceptance Criteria (AC)** | 72 | -- |
| **Workflows (WF)** | 114 | -- |
| **Modules (M)** | 19 | -- |
| --- | --- | --- |
| **BR COMPLETE chains** (spec+code+test) | 28 | 70% |
| **BR PARTIAL chains** (spec+code OR spec+test) | 11 | 27.5% |
| **BR ORPHAN nodes** (spec only) | 1 | 2.5% |
| **AC COMPLETE chains** (spec+code+test) | 9 | 12.5% |
| **AC PARTIAL chains** | 17 | 23.6% |
| **AC ORPHAN nodes** | 46 | 63.9% |
| **WF ORPHAN nodes** (spec only, 0 in code) | 114 | 100% |

## Business Rules Trace

| BR-ID | Spec | Code | Test | WF Link | Status |
|-------|------|------|------|---------|--------|
| BR-01 | MASTER_PRD, WORKFLOW_MAP | `approveMembershipApplication.ts`, `compute-membership-status.ts`, `bulkApproveMembershipApplications.ts` | `compute-membership-status.test.ts`, `createMembership.test.ts`, `approveMembershipApplication.test.ts` | WF-032 | COMPLETE |
| BR-02 | MASTER_PRD, WORKFLOW_MAP | `enroll.ts`, `registerForEvent.ts`, `graceToLapsed.ts` | `enroll.test.ts`, `paid-training.test.ts`, `dues-config.test.ts` | WF-032 | COMPLETE |
| BR-03 | MASTER_PRD, WORKFLOW_MAP | `membership-lifecycle.ts`, `updateMember.ts` | `settle-payment.test.ts`, `membership.test.ts`, `terminateMembership.test.ts` | WF-032, WF-029, WF-026, WF-035 | COMPLETE |
| BR-04 | MASTER_PRD, WORKFLOW_MAP | NONE | NONE | WF-040 | **ORPHAN** |
| BR-05 | MASTER_PRD, WORKFLOW_MAP | `fund-math.ts` | `dues-config.test.ts`, `fund-math.test.ts`, `dues.test.ts` | WF-039 | COMPLETE |
| BR-06 | MASTER_PRD, WORKFLOW_MAP | `recordDuesPayment.ts` | `recordDuesPayment.test.ts` | WF-044, WF-038 | COMPLETE |
| BR-07 | MASTER_PRD, WORKFLOW_MAP | `recordManualPayment.ts`, `expiry-extension.ts` | `expiry-extension.test.ts`, `recordManualPayment.test.ts`, `dues.test.ts` | WF-038, WF-044 | COMPLETE |
| BR-08 | MASTER_PRD, WORKFLOW_MAP | `refund-validation.ts`, `refundPayment.ts` | `refund-validation.test.ts`, `refundPayment.test.ts` | WF-041 | COMPLETE |
| BR-09 | MASTER_PRD, WORKFLOW_MAP | `apps/memberry/src/utils/guards.ts` | `createOfficerTerm.test.ts`, `governance.test.ts`, `officer-admin.test.ts` | WF-025 | COMPLETE |
| BR-10 | MASTER_PRD, WORKFLOW_MAP | NONE | `br-edge-cases.test.ts`, `startImpersonation.test.ts`, `platformadmin.test.ts` | WF-019 | PARTIAL (test only) |
| BR-11 | MASTER_PRD, WORKFLOW_MAP | `getCreditTranscriptPdf.ts`, `credit-cycle.ts`, `platform-admin.schema.ts` | `credits.test.ts`, `getCreditTranscriptPdf.test.ts` | WF-069 | COMPLETE |
| BR-12 | MASTER_PRD, WORKFLOW_MAP | `getCreditTranscript.ts`, `credit-cycle.ts` | `credits.test.ts` | WF-069 | COMPLETE |
| BR-13 | MASTER_PRD, WORKFLOW_MAP | `markComplete.ts`, `credits.schema.ts`, `createCreditEntry.ts` | `markComplete.test.ts`, `credits.test.ts` | WF-060 | COMPLETE |
| BR-14 | MASTER_PRD, WORKFLOW_MAP | NONE | `credits.test.ts` | WF-065 | PARTIAL (test only) |
| BR-15 | MASTER_PRD, WORKFLOW_MAP | NONE | `createTraining.test.ts`, `createEvent.test.ts` | WF-051, WF-058 | PARTIAL (test only) |
| BR-16 | MASTER_PRD, WORKFLOW_MAP | `event-form.tsx` (frontend) | `br-edge-cases.test.ts`, `updateEvent.test.ts`, `br-p2-gap.test.ts` | WF-051, WF-058 | COMPLETE |
| BR-17 | MASTER_PRD, WORKFLOW_MAP | `attendance.tsx` (frontend) | `checkIn.test.ts` | WF-053, WF-060 | COMPLETE |
| BR-18 | MASTER_PRD, WORKFLOW_MAP | NONE | `check-in.test.ts`, `credentials.test.ts` | WF-053 | PARTIAL (test only) |
| BR-19 | MASTER_PRD, WORKFLOW_MAP | `issueDigitalCredential.ts` | `br-edge-cases.test.ts`, `credentials.test.ts` | WF-071 | COMPLETE |
| BR-20 | MASTER_PRD, WORKFLOW_MAP | `markComplete.ts` | `markComplete.test.ts`, `certificates.repo.test.ts`, `getCertificate.test.ts` | WF-061 | COMPLETE |
| BR-21 | MASTER_PRD, WORKFLOW_MAP | `getPublicDirectoryProfile.ts`, `guards.ts`, `member-header.tsx` | `listRosterMembers.test.ts`, `directory.test.ts`, `listMembers.test.ts` | WF-001, WF-037 | COMPLETE |
| BR-22 | MASTER_PRD, WORKFLOW_MAP | `importMembers.ts`, `csvImport.ts`, `import.tsx` | `importMembers.test.ts`, `csvImport.test.ts` | WF-009, WF-031 | COMPLETE |
| BR-23 | MASTER_PRD, WORKFLOW_MAP | `importMembers.ts` | `importMembers.test.ts`, `br-p2-gap.test.ts` | WF-001, WF-031 | COMPLETE |
| BR-24 | MASTER_PRD, WORKFLOW_MAP | NONE | `invite.test.ts` | WF-008, WF-002 | PARTIAL (test only) |
| BR-25 | MASTER_PRD, WORKFLOW_MAP | `importMembers.ts` | `br-edge-cases.test.ts`, `br-p2-gap.test.ts` | WF-001 | COMPLETE |
| BR-26 | MASTER_PRD, WORKFLOW_MAP | NONE | `br-p2-gap.test.ts` | WF-003 | PARTIAL (test only) |
| BR-27 | MASTER_PRD, WORKFLOW_MAP | `cancelEventRegistration.ts` | `events.test.ts`, `event-waitlisting.test.ts`, `registerForEvent.test.ts` | WF-052, WF-057 | COMPLETE |
| BR-28 | MASTER_PRD, WORKFLOW_MAP | `communication.repo.ts`, `createMessage.ts` | `communication.test.ts`, `br-p2-gap.test.ts` | WF-046 | COMPLETE |
| BR-29 | MASTER_PRD, WORKFLOW_MAP | `getOrganizationBySlug.ts` | `br-edge-cases.test.ts`, `getOrganizationBySlug.test.ts` | WF-028 | COMPLETE |
| BR-30 | MASTER_PRD, WORKFLOW_MAP | `gateway.ts`, `billing.schema.ts`, `billing.repo.ts` | `gateway.test.ts`, `billing-config.repo.test.ts` | WF-038, WF-040 | COMPLETE |
| BR-31 | MASTER_PRD, WORKFLOW_MAP | NONE | `uploadFile.test.ts` | WF-010, WF-024 | PARTIAL (test only) |
| BR-32 | MASTER_PRD, WORKFLOW_MAP | `fund-math.ts`, `person.schema.ts`, `deleteMyAccount.ts` | `dues-config.test.ts`, `fund-math.test.ts`, `requestAccountDeletion.test.ts` | WF-011, WF-038 | COMPLETE |
| BR-33 | MASTER_PRD, WORKFLOW_MAP | `castBallot.ts`, `openElectionVoting.ts`, `certifyElection.ts` | `castBallot.test.ts`, `certifyElection.test.ts`, `openElectionVoting.test.ts` | WF-077 | COMPLETE |
| BR-34 | MASTER_PRD, WORKFLOW_MAP | `castBallot.ts`, `createCandidate.ts`, `createNominee.ts` | `createCandidate.test.ts`, `castBallot.test.ts`, `nomination-eligibility-e2e.test.ts` | WF-076 | COMPLETE |
| BR-35 | MASTER_PRD, WORKFLOW_MAP | NONE | `m13.professional-feed.test.ts`, `br-35.feed-moderation.test.ts` | WF-082 | PARTIAL (test only) |
| BR-36 | MASTER_PRD, WORKFLOW_MAP | NONE | `br-36.national-dashboard.test.ts` | WF-084 | PARTIAL (test only) |
| BR-37 | MASTER_PRD, WORKFLOW_MAP | `jobs.repo.ts` | `br-37.job-posting-expiry.test.ts` | WF-090 | COMPLETE |
| BR-38 | MASTER_PRD, WORKFLOW_MAP | `verifyVendor.ts`, `createListing.ts` | `vendor-crud.test.ts`, `listing-order.test.ts`, `verifyVendor.test.ts` | WF-098 | COMPLETE |
| BR-39 | MASTER_PRD, WORKFLOW_MAP | NONE | `committees.test.ts`, `br-39.committee-dissolution.test.ts` | WF-108 | PARTIAL (test only) |
| BR-40 | MASTER_PRD, WORKFLOW_MAP | NONE | `surveys-polls.test.ts`, `br-40.survey-anonymity.test.ts` | WF-101, WF-102 | PARTIAL (test only) |

### BR Summary

- **COMPLETE** (spec + code + test): BR-01, BR-02, BR-03, BR-05, BR-06, BR-07, BR-08, BR-09, BR-11, BR-12, BR-13, BR-16, BR-17, BR-19, BR-20, BR-21, BR-22, BR-23, BR-25, BR-27, BR-28, BR-29, BR-30, BR-32, BR-33, BR-34, BR-37, BR-38 = **28 (70%)**
- **PARTIAL** (test-only, no production code referencing BR): BR-10, BR-14, BR-15, BR-18, BR-24, BR-26, BR-31, BR-35, BR-36, BR-39, BR-40 = **11 (27.5%)**
- **ORPHAN** (spec only, no code or test): BR-04 = **1 (2.5%)**

## Workflow Trace

**Result: All 114 WF IDs (WF-001 through WF-114) are ORPHAN in code/tests.**

No source file (`.ts`, `.tsx`) anywhere in `services/` or `apps/` references any `WF-NNN` identifier. Workflows are defined in `docs/product/WORKFLOW_MAP.md` and cross-referenced to BRs and modules in spec docs, but the implementation layer does not trace back to WF IDs.

| WF Range | Module | Description | Code Refs | Test Refs | Status |
|----------|--------|-------------|-----------|-----------|--------|
| WF-001..WF-013 | M01 Auth | Registration, invite, session, lockout | 0 | 0 | ORPHAN |
| WF-014..WF-018 | M02 Profile | Update, photo, preferences | 0 | 0 | ORPHAN |
| WF-019..WF-024 | M03 Platform Admin | Impersonation, feature flags | 0 | 0 | ORPHAN |
| WF-025..WF-031 | M04 Org Admin | Officer mgmt, org settings, import | 0 | 0 | ORPHAN |
| WF-032..WF-037 | M05 Membership | Lifecycle, directory, applications | 0 | 0 | ORPHAN |
| WF-038..WF-044 | M06 Dues | Payments, refunds, config | 0 | 0 | ORPHAN |
| WF-045..WF-050 | M07 Communications | Templates, announcements, queuing | 0 | 0 | ORPHAN |
| WF-051..WF-057 | M08 Events | Create, register, waitlist, check-in | 0 | 0 | ORPHAN |
| WF-058..WF-064 | M09 Training | Create, enroll, attendance, complete | 0 | 0 | ORPHAN |
| WF-065..WF-072 | M10 Credits | Cycle config, transcripts, credentials | 0 | 0 | ORPHAN |
| WF-073..WF-078 | M12 Elections | Nominations, voting, certification | 0 | 0 | ORPHAN |
| WF-079..WF-083 | M13 Feed | Posts, moderation | 0 | 0 | ORPHAN |
| WF-084..WF-089 | M14 National Dashboard | Analytics, rollups | 0 | 0 | ORPHAN |
| WF-090..WF-096 | M15 Job Board | Postings, applications | 0 | 0 | ORPHAN |
| WF-097..WF-100 | M16 Advertising | Campaigns, placements | 0 | 0 | ORPHAN |
| WF-101..WF-105 | M18 Surveys | Create, respond, results | 0 | 0 | ORPHAN |
| WF-106..WF-110 | M19 Committees | Create, assign, dissolve | 0 | 0 | ORPHAN |
| WF-111..WF-114 | M17 Marketplace | Vendors, listings, orders | 0 | 0 | ORPHAN |

**Assessment:** WF IDs serve as spec-layer design artifacts. The implementation does not embed WF traceability. This is a documentation-only layer -- functional coverage is tracked via BR IDs and AC IDs instead.

## Acceptance Criteria Trace

| AC-ID | Spec | Code | Test | Status |
|-------|------|------|------|--------|
| AC-M01-001 | m01-auth-onboarding.md | NONE | auth-session-hardening.test.ts | PARTIAL |
| AC-M01-002 | m01-auth-onboarding.md | csvImport.ts | csvImport.test.ts | COMPLETE |
| AC-M01-003 | m01-auth-onboarding.md | NONE | NONE | ORPHAN |
| AC-M01-004 | m01-auth-onboarding.md | NONE | auth-session-hardening.test.ts | PARTIAL |
| AC-M01-005 | m01-auth-onboarding.md | account-lockout.ts | account-lockout.test.ts | COMPLETE |
| AC-M02-001 | m02-member-profile.md | NONE | profile-spec-compliance.test.ts | PARTIAL |
| AC-M02-002 | m02-member-profile.md | NONE | profile-spec-compliance.test.ts | PARTIAL |
| AC-M02-003 | m02-member-profile.md | NONE | accountDeletionCascade.test.ts | PARTIAL |
| AC-M02-004 | m02-member-profile.md | NONE | profile-spec-compliance.test.ts | PARTIAL |
| AC-M02-005 | m02-member-profile.md | NONE | profile-spec-compliance.test.ts | PARTIAL |
| AC-M03-001 | m03-platform-admin.md | NONE | NONE | ORPHAN |
| AC-M03-002 | m03-platform-admin.md | setFeatureFlag.ts | setFeatureFlag.test.ts | COMPLETE |
| AC-M03-003 | m03-platform-admin.md | NONE | NONE | ORPHAN |
| AC-M03-004 | m03-platform-admin.md | updateAdmin.ts | updateAdmin.test.ts | COMPLETE |
| AC-M04-001 | m04-org-admin.md | NONE | NONE | ORPHAN |
| AC-M04-002 | m04-org-admin.md | NONE | NONE | ORPHAN |
| AC-M04-003 | m04-org-admin.md | NONE | NONE | ORPHAN |
| AC-M04-004 | m04-org-admin.md | NONE | NONE | ORPHAN |
| AC-M04-005 | m04-org-admin.md | NONE | NONE | ORPHAN |
| AC-M05-001 | m05-membership.md | NONE | NONE | ORPHAN |
| AC-M05-002 | m05-membership.md | NONE | NONE | ORPHAN |
| AC-M05-003 | m05-membership.md | csvImport.ts | csvImport.test.ts | COMPLETE |
| AC-M05-004 | m05-membership.md | csvImport.ts | csvImport.test.ts | COMPLETE |
| AC-M05-005 | m05-membership.md | NONE | directory.test.ts | PARTIAL |
| AC-M06-001 | m06-dues-payments.md | NONE | NONE | ORPHAN |
| AC-M06-002 | m06-dues-payments.md | NONE | NONE | ORPHAN |
| AC-M06-003 | m06-dues-payments.md | NONE | NONE | ORPHAN |
| AC-M06-004 | m06-dues-payments.md | NONE | NONE | ORPHAN |
| AC-M06-005 | m06-dues-payments.md | NONE | NONE | ORPHAN |
| AC-M07-001 | m07-communications.md | NONE | NONE | ORPHAN |
| AC-M07-002 | m07-communications.md | NONE | NONE | ORPHAN |
| AC-M07-003 | m07-communications.md | NONE | NONE | ORPHAN |
| AC-M07-004 | m07-communications.md | NONE | NONE | ORPHAN |
| AC-M08-001 | m08-events.md | NONE | events.test.ts | PARTIAL |
| AC-M08-002 | m08-events.md | NONE | events.test.ts | PARTIAL |
| AC-M08-003 | m08-events.md | NONE | NONE | ORPHAN |
| AC-M09-001 | m09-training.md | completeTrainingEnrollment.ts | flow-020.attendance-credit.test.ts | COMPLETE |
| AC-M09-002 | m09-training.md | NONE | NONE | ORPHAN |
| AC-M09-003 | m09-training.md | NONE | NONE | ORPHAN |
| AC-M10-001 | m10-credit-tracking.md | NONE | credits.test.ts | PARTIAL |
| AC-M10-002 | m10-credit-tracking.md | markComplete.ts | flow-020.attendance-credit.test.ts | COMPLETE |
| AC-M10-003 | m10-credit-tracking.md | NONE | credits.test.ts | PARTIAL |
| AC-M10-004 | m10-credit-tracking.md | NONE | credits.test.ts | PARTIAL |
| AC-M11-001 | m11-documents-credentials.md | NONE | slice-023-documents-credentials.test.ts | PARTIAL |
| AC-M11-002 | m11-documents-credentials.md | NONE | slice-023-documents-credentials.test.ts | PARTIAL |
| AC-M11-003 | m11-documents-credentials.md | NONE | slice-023-documents-credentials.test.ts | PARTIAL |
| AC-M11-004 | m11-documents-credentials.md | NONE | slice-023-documents-credentials.test.ts | PARTIAL |
| AC-M12-001 | m12-elections-governance.md | NONE | NONE | ORPHAN |
| AC-M12-002 | m12-elections-governance.md | NONE | NONE | ORPHAN |
| AC-M12-003 | m12-elections-governance.md | NONE | NONE | ORPHAN |
| AC-M13-001 | m13-professional-feed.md | NONE | NONE | ORPHAN |
| AC-M13-002 | m13-professional-feed.md | NONE | NONE | ORPHAN |
| AC-M13-003 | m13-professional-feed.md | NONE | NONE | ORPHAN |
| AC-M14-001 | m14-national-dashboard.md | NONE | NONE | ORPHAN |
| AC-M14-002 | m14-national-dashboard.md | NONE | NONE | ORPHAN |
| AC-M14-003 | m14-national-dashboard.md | NONE | NONE | ORPHAN |
| AC-M15-001 | m15-job-board.md | NONE | NONE | ORPHAN |
| AC-M15-002 | m15-job-board.md | NONE | NONE | ORPHAN |
| AC-M15-003 | m15-job-board.md | NONE | NONE | ORPHAN |
| AC-M16-001 | m16-advertising.md | creative.repo.ts | getAdForPlacement.test.ts | COMPLETE |
| AC-M16-002 | m16-advertising.md | NONE | createCampaign.test.ts | PARTIAL |
| AC-M16-003 | m16-advertising.md | createCreative.ts | getAdForPlacement.test.ts | COMPLETE |
| AC-M16-004 | m16-advertising.md | setMemberOptOut.ts | getAdForPlacement.test.ts | COMPLETE |
| AC-M17-001 | m17-marketplace.md | NONE | NONE | ORPHAN |
| AC-M17-002 | m17-marketplace.md | NONE | NONE | ORPHAN |
| AC-M18-001 | m18-surveys-polls.md | NONE | NONE | ORPHAN |
| AC-M18-002 | m18-surveys-polls.md | NONE | NONE | ORPHAN |
| AC-M18-003 | m18-surveys-polls.md | NONE | NONE | ORPHAN |
| AC-M19-001 | m19-committee-management.md | NONE | NONE | ORPHAN |
| AC-M19-002 | m19-committee-management.md | NONE | NONE | ORPHAN |
| AC-M19-003 | m19-committee-management.md | NONE | NONE | ORPHAN |
| AC-M19-004 | m19-committee-management.md | NONE | NONE | ORPHAN |

### AC Summary

- **COMPLETE**: 10 (13.9%)
- **PARTIAL**: 16 (22.2%)
- **ORPHAN**: 46 (63.9%)

## Module Coverage

| Module | Spec | Handler Dir | Handlers | Backend Tests | Frontend Tests | Coverage |
|--------|------|-------------|----------|---------------|----------------|----------|
| M01 Auth & Onboarding | m01-auth-onboarding.md | `person/` | 27 | 32 | 7 (account) | HIGH |
| M02 Member Profile | m02-member-profile.md | `person/` (shared) | (shared) | (shared) | 3 (account) | MEDIUM |
| M03 Platform Admin | m03-platform-admin.md | `platformadmin/` | 21 | 24 | -- | HIGH |
| M04 Org Admin | m04-org-admin.md | `association:member/` | 166 | 44 | 3 (memberry) | MEDIUM |
| M05 Membership | m05-membership.md | `membership/` + `association:member/` | 14 + shared | 23 + shared | 5 (memberry) | HIGH |
| M06 Dues & Payments | m06-dues-payments.md | `dues/` + `billing/` | 6 + 16 | 16 + 21 | 16 (memberry) | HIGH |
| M07 Communications | m07-communications.md | `communication/` + `comms/` + `email/` + `notifs/` | 28 + 11 + 11 + 6 | 35 + 5 + 17 + 7 | 2 (memberry) | MEDIUM |
| M08 Events | m08-events.md | `events/` + `booking/` | 10 + 19 | 16 + 24 | 4 (memberry) | HIGH |
| M09 Training | m09-training.md | `training/` | 13 | 18 | 4 (memberry) | HIGH |
| M10 Credit Tracking | m10-credit-tracking.md | `training/` (shared) | (shared) | (shared) | 2 (memberry) | MEDIUM |
| M11 Documents & Credentials | m11-documents-credentials.md | `documents/` + `certificates/` + `storage/` | 15 + 4 + 6 | 18 + 7 + 2 | 2 (memberry) | MEDIUM |
| M12 Elections & Governance | m12-elections-governance.md | `elections/` | 7 | 15 | 3 (memberry) | HIGH |
| M13 Professional Feed | m13-professional-feed.md | -- (marked Future) | 0 | 1 (stub) | 0 | LOW |
| M14 National Dashboard | m14-national-dashboard.md | `association:operations/` | 54 | 13 | 0 | LOW |
| M15 Job Board | m15-job-board.md | `jobs/` (exists, not in MODULE_MAP) | 7 | 7 | 0 | LOW |
| M16 Advertising | m16-advertising.md | `advertising/` (exists, not in MODULE_MAP) | 7 | 7 | 0 | MEDIUM |
| M17 Marketplace | m17-marketplace.md | `marketplace/` (exists, not in MODULE_MAP) | 9 | 3 | 0 | LOW |
| M18 Surveys & Polls | m18-surveys-polls.md | -- (marked Future) | 0 | 1 (stub) | 0 | LOW |
| M19 Committee Management | m19-committee-management.md | -- (marked Future) | 0 | 1 (stub) | 0 | LOW |

## Orphan Nodes

### Spec orphans (defined but not implemented)

| ID | Description | Notes |
|----|-------------|-------|
| BR-04 | Dues amount per org | No code or test references. WF-040 specified but not traced. |
| AC-M01-003 | (M01 auth) | No code or test references |
| AC-M03-001 | (M03 platform admin) | No code or test references |
| AC-M03-003 | (M03 platform admin) | No code or test references |
| AC-M04-001..005 | All M04 Org Admin ACs | Zero traceability -- 5 orphan ACs |
| AC-M05-001..002 | M05 Membership ACs | 2 orphan ACs |
| AC-M06-001..005 | All M06 Dues ACs | Zero traceability -- 5 orphan ACs despite strong BR coverage |
| AC-M07-001..004 | All M07 Communications ACs | Zero traceability -- 4 orphan ACs |
| AC-M08-003 | M08 Events | 1 orphan AC |
| AC-M09-002..003 | M09 Training | 2 orphan ACs |
| AC-M12-001..003 | All M12 Elections ACs | Zero traceability -- 3 orphan ACs despite strong BR coverage |
| AC-M13-001..003 | All M13 Feed ACs | 3 orphan ACs (module marked Future) |
| AC-M14-001..003 | All M14 Dashboard ACs | 3 orphan ACs |
| AC-M15-001..003 | All M15 Job Board ACs | 3 orphan ACs |
| AC-M17-001..002 | M17 Marketplace ACs | 2 orphan ACs |
| AC-M18-001..003 | All M18 Surveys ACs | 3 orphan ACs |
| AC-M19-001..004 | All M19 Committees ACs | 4 orphan ACs |
| WF-001..WF-114 | All 114 workflows | Zero code traceability (by-design -- see note) |

### Code orphans (implemented but not in spec / MODULE_MAP discrepancy)

| Handler Directory | Handlers | Tests | Notes |
|-------------------|----------|-------|-------|
| `advertising/` | 7 | 7 | MODULE_MAP says "-- (Future)" but 7 handlers + 7 tests exist |
| `marketplace/` | 9 | 3 | MODULE_MAP says "-- (Future)" but 9 handlers + 3 tests exist |
| `jobs/` | 7 | 7 | Not mapped to any module in MODULE_MAP at all |
| `audit/` | 1 | 4 | Listed as cross-cutting, no dedicated module spec |
| `invite/` | 3 | 4 | Listed as related to M04/M05, no dedicated module spec |
| `reviews/` | 4 | 5 | Listed as related to M08/M09, no dedicated module spec |

### Test orphans (testing removed/non-existent code)

None detected. All test files reference existing BRs (BR-01 through BR-40). No tests reference BR IDs beyond the defined range.

## Broken Chains

These have spec and test but NO production code referencing the BR ID (test-only coverage -- may be testing the behavior without explicit BR annotation in code):

| BR-ID | Has Spec | Has Test | Missing Code | Risk |
|-------|----------|----------|--------------|------|
| BR-10 | Yes | `br-edge-cases.test.ts`, `startImpersonation.test.ts` | No handler references BR-10 | LOW -- impersonation handler exists, just lacks BR annotation |
| BR-14 | Yes | `credits.test.ts` | No handler references BR-14 | LOW -- credit aggregation likely implemented, lacks annotation |
| BR-15 | Yes | `createTraining.test.ts`, `createEvent.test.ts` | No handler references BR-15 | LOW -- distinction enforced in schema |
| BR-18 | Yes | `check-in.test.ts`, `credentials.test.ts` | No handler references BR-18 | MEDIUM -- QR check-in auth should be explicitly annotated |
| BR-24 | Yes | `invite.test.ts` | No handler references BR-24 | LOW -- invite expiry likely in repo logic |
| BR-26 | Yes | `br-p2-gap.test.ts` | No handler references BR-26 | LOW -- session mgmt handled by Better-Auth |
| BR-31 | Yes | `uploadFile.test.ts` | No handler references BR-31 | MEDIUM -- SVG sanitization should be explicitly annotated |
| BR-35 | Yes | `br-35.feed-moderation.test.ts` | No code exists (Future module) | LOW -- deferred |
| BR-36 | Yes | `br-36.national-dashboard.test.ts` | No code references BR-36 | LOW -- dashboard handlers exist, lack annotation |
| BR-39 | Yes | `br-39.committee-dissolution.test.ts` | No code exists (Future module) | LOW -- deferred |
| BR-40 | Yes | `br-40.survey-anonymity.test.ts` | No code exists (Future module) | LOW -- deferred |

## Key Findings

1. **BR traceability is strong**: 70% COMPLETE chains, only 1 true orphan (BR-04). The remaining 27.5% are PARTIAL, mostly test-only (behavior tested but code lacks explicit BR annotation).

2. **WF traceability is zero**: All 114 workflow IDs exist only in spec docs. This is a structural gap -- workflows are design artifacts without implementation-layer tracing. Not necessarily a defect, but means WF-level regression detection requires manual mapping.

3. **AC traceability is weak**: 63.9% orphan rate. Many modules (M04, M06, M07, M12) have strong BR coverage but zero AC traceability. Suggests ACs are defined at a different granularity than what code/tests reference.

4. **MODULE_MAP is stale**: Lists M15 (Job Board), M16 (Advertising), M17 (Marketplace) as "-- (Future)" with no handlers, but all three have active handler directories with production code and tests. `jobs/` handler directory is not mapped to any module at all.

5. **M14 (National Dashboard) has low test density**: 54 handlers but only 13 tests (0.24 test ratio). Compare to M06 (22 handlers, 37 tests, 1.68 ratio) or M08 (29 handlers, 40 tests, 1.38 ratio).

6. **Frontend test coverage is concentrated**: 86 frontend tests total, heavily weighted toward `memberry` app (dues: 16, events: 4, training: 4) and `account` app (person: 5, booking: 5). No frontend tests for M14, M15, M16, M17, M18, M19.

---

*Generated 2026-05-20 by /oli-trace*
*Source: `docs/product/`, `services/api-ts/src/handlers/`, `apps/`*
