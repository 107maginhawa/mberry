# Enforcement Audit: Modules M01–M05 (Phase 1)

**Date**: 2026-05-29
**Auditor**: oli-enforce-module + oli-enforce-file
**Scope**: M01 Auth & Onboarding, M02 Member Profile, M03 Platform Admin, M04 Org Admin, M05 Membership

---

## Summary

| Module | Spec Sections | Handler Files | Findings | P0 | P1 | P2 | P3 |
|--------|--------------|---------------|----------|----|----|----|----|
| M01    | 24/24        | 24 (person/)  | 8        | 1  | 3  | 3  | 1  |
| M02    | 24/24        | 24 (person/)  | 7        | 1  | 2  | 3  | 1  |
| M03    | 24/24        | 21 (platformadmin/) | 9   | 2  | 3  | 3  | 1  |
| M04    | 24/24        | ~100 (association:member/) | 8 | 1 | 3 | 3 | 1 |
| M05    | 24/24        | 12 (membership/) | 7     | 0  | 3  | 3  | 1  |
| **Total** | | | **39** | **5** | **14** | **15** | **5** |

---

## Module A: Spec Section Coverage (oli-enforce-module)

All five modules have 24/24 spec sections PRESENT with content. No STUB or MISSING sections. The spec structure is:

1. Module Overview, 2. Domain Terms, 3. Workflows, 4. Workflow Details, 5. Business Rules, 6. Permissions, 7. Data Requirements, 7b. Aggregate Boundaries, 8. State Transitions, 9. UI/UX Requirements, 10. API Expectations, 10b. Domain Events, 11. Acceptance Criteria, 12. Test Expectations, 13. Edge Cases, 14. Dependencies, 15. Error Handling, 16. Performance, 17. Observability, 18. Feature Flags, 19. Vertical Slice Plan, 20. AI Instructions

Note: The spec uses a 24-section numbering (with 7b) rather than the 22-section standard. All are PRESENT.

---

## Module B: File-Level Enforcement (oli-enforce-file)

---

### M01: Auth & Onboarding (handlers: person/)

#### Module-Level Findings

| ID | Sev | Description | Spec Ref | Confidence |
|----|-----|-------------|----------|------------|
| EM-M01-events | P1 | Spec declares 4 domain events (PersonCreated, SessionCreated, InvitationClaimed, OnboardingCompleted). Only `person.created` is emitted in code (createPerson.ts). SessionCreated, InvitationClaimed, OnboardingCompleted have no emission anywhere in person handlers. | 10b. Domain Events | HIGH |
| EM-M01-otp-handlers | P1 | Spec declares endpoints POST /verify-otp, POST /magic-link, POST /forgot-password, POST /reset-password. No corresponding handler files exist in person/ — these are handled by Better-Auth middleware, but spec/code alignment is undocumented. | 10. API Expectations | MEDIUM |
| EM-M01-onboarding | P1 | Spec declares GET /onboarding/state and PUT /onboarding/step endpoints. No handler files for onboarding wizard state management exist in person/. | 10. API Expectations | HIGH |
| EM-M01-lockout | P2 | Spec M1-R1 requires account lockout after 5 failed OTP attempts and M1-R2 requires lockout after 5 failed login attempts (15-min cooldown). No lockout enforcement visible in person handlers — likely delegated to Better-Auth but not verified. | 5. Business Rules | MEDIUM |

#### File-Level Findings

| ID | Sev | File | Description | Spec Ref | Confidence |
|----|-----|------|-------------|----------|------------|
| EF-M01-export-no-audit | P2 | exportMyData.ts | No audit logging for data export. Spec M2-R10 requires all profile access logged. Export returns raw person object including all PII fields without filtering. | 17. Observability | HIGH |
| EF-M01-export-no-ratelimit | P2 | exportMyData.ts | Spec M2-R4 requires rate limiting on data export (max 1/day). No rate limiting implemented. | 5. Business Rules (M2-R4) | HIGH |
| EF-M01-export-pii | P0 | exportMyData.ts | Export returns full person record via `personRepo.findOneById()` which includes all PII fields (license, DOB, address, phone) without field filtering. Combined with missing audit log, this is a data exfiltration surface if session is compromised. | 15. Error Handling | HIGH |
| EF-M01-getperson-admin-bypass | P3 | getPerson.ts | `isInternalExpand` flag bypasses all authorization. While documented as intentional (parent resource auth), there's no validation that the caller is actually an internal expand request vs. a forged context value. | 6. Permissions | LOW |

---

### M02: Member Profile & Settings (handlers: person/)

#### Module-Level Findings

| ID | Sev | Description | Spec Ref | Confidence |
|----|-----|-------------|----------|------------|
| EM-M02-events | P1 | Spec declares 5 domain events (PersonUpdated, PersonAnonymized, DataExportReady, DeletionRequested, DeletionCancelled). Only `person.created` emitted in code. PersonUpdated not emitted in updateMyProfile.ts or updatePerson.ts. DeletionRequested not emitted in requestMyAccountDeletion.ts. | 10b. Domain Events | HIGH |
| EM-M02-email-change | P1 | Spec M2-R1 requires OTP verification on email change. updateMyProfile.ts does not implement OTP verification for email field changes — it accepts email changes directly. | 5. Business Rules | HIGH |

#### File-Level Findings

| ID | Sev | File | Description | Spec Ref | Confidence |
|----|-----|------|-------------|----------|------------|
| EF-M02-update-no-session-invalidation | P0 | updateMyProfile.ts | Spec M2-R2 requires all other sessions invalidated on password change. updateMyProfile.ts has no session invalidation logic. Password changes may be handled elsewhere (Better-Auth), but profile updates that include sensitive fields (email) have no secondary verification. | 5. Business Rules | MEDIUM |
| EF-M02-privacy-missing | P2 | updateMyPrivacy.ts | File does not exist (cat returns "No such file or directory"). updateMyPrivacySettings.ts exists instead. Spec declares PUT /my/privacy endpoint. Naming mismatch may indicate routing gap. | 10. API Expectations | MEDIUM |
| EF-M02-idcard-no-membership-check | P2 | getMyIdCard.ts | Returns ID card data but does not verify the membership is in ACTIVE/GRACE status. Spec states only active members should have valid ID cards. A SUSPENDED or LAPSED member could generate an ID card. | 5. Business Rules | MEDIUM |
| EF-M02-notifprefs-no-inapp-guard | P2 | updateMyNotificationPreferences.ts | Spec M2-R8 states in-app notification category cannot be disabled. No enforcement visible — the handler accepts arbitrary category toggles. | 5. Business Rules | MEDIUM |
| EF-M02-deletion-cascade-no-event | P3 | executeAccountDeletion.ts | Spec declares PersonAnonymized domain event on deletion completion. No `domainEvents.emit('person.anonymized', ...)` call exists after anonymization. | 10b. Domain Events | HIGH |

---

### M03: Platform Administration (handlers: platformadmin/)

#### Module-Level Findings

| ID | Sev | Description | Spec Ref | Confidence |
|----|-----|-------------|----------|------------|
| EM-M03-missing-handlers | P1 | Three spec-declared handlers have no source files: toggleFeatureFlag.ts, updateOrgStatus.ts, getDashboardMetrics.ts. PUT /admin/feature-flags, PUT /admin/orgs/:id/status, GET /admin/analytics/* have no implementation. | 10. API Expectations | HIGH |
| EM-M03-events | P1 | Spec declares domain events (OrgCreated, OrgStatusChanged, ImpersonationStarted, AdminInvited). No `domainEvents.emit()` calls exist in any platformadmin handler. All use `auditAction()` only. | 10b. Domain Events | HIGH |
| EM-M03-admin-team | P1 | Spec declares POST /admin/team/invite, PUT /admin/team/:id/role, DELETE /admin/team/:id. No admin team management handlers exist. createPricingTier.ts and createTicket.ts/addTicketComment.ts/cancelSubscription.ts exist but are not in spec. | 10. API Expectations | HIGH |

#### File-Level Findings

| ID | Sev | File | Description | Spec Ref | Confidence |
|----|-----|------|-------------|----------|------------|
| EF-M03-impersonation-no-write-block | P0 | startImpersonation.ts | Spec M3-R4 requires write operations blocked at API level during impersonation. The handler sets a cookie (`memberry-imp-token`) but there is no middleware visible that reads this cookie and blocks write (POST/PUT/DELETE) requests. The write-block is UI-only without API enforcement. | 5. Business Rules | HIGH |
| EF-M03-impersonation-no-auto-expire | P0 | startImpersonation.ts | Spec M3-R3 requires auto-termination after 30 min. Session is created with `expiresAt` field, but no background job or middleware checks expiration. The 30-min cookie maxAge provides browser-side expiry only — API-side, an expired session token may still be valid if not validated. | 5. Business Rules | MEDIUM |
| EF-M03-delete-assoc-no-active-check | P2 | deleteAssociation.ts | Spec says DELETE /admin/associations/:id should return 409 if association has active orgs. Handler deletes without checking for child organizations. | 15. Error Handling | HIGH |
| EF-M03-create-org-no-trial-period | P2 | createOrganization.ts | Spec org lifecycle starts at 'trial' with configurable trial period. Handler sets status to 'trial' but does not set trialStartDate or trialEndDate — these remain null. | 8. State Transitions | MEDIUM |
| EF-M03-list-assoc-no-role-check | P2 | listAssociations.ts | Handler only checks `session` exists but does not verify platform admin role. Any authenticated user could list all associations. Other handlers (createAssociation) properly check for super admin role. | 6. Permissions | HIGH |
| EF-M03-no-mfa-enforcement | P3 | (global) | Spec M3-R7 requires MFA mandatory for platform admin accounts. No MFA enforcement visible in any platformadmin handler. Likely delegated to auth layer but not verified. | 5. Business Rules | LOW |

---

### M04: Org Admin (handlers: association:member/)

#### Module-Level Findings

| ID | Sev | Description | Spec Ref | Confidence |
|----|-----|-------------|----------|------------|
| EM-M04-events-partial | P1 | Spec declares OfficerAssigned, OfficerRemoved, DisciplinaryActionCreated, OrgUpdated events. OfficerAssigned (as `officer.assigned`) and member.suspended/member.removed are emitted. OfficerRemoved and OrgUpdated events are not emitted. | 10b. Domain Events | HIGH |
| EM-M04-transition-handler | P1 | Spec declares POST /org/:id/officers/:termId/transition (officer transition with checklist). No handler file for officer transition workflow exists. | 10. API Expectations | HIGH |
| EM-M04-suspend-missing | P1 | suspendMembership.ts does not exist. Spec declares officer-initiated suspension as a core workflow. Suspension may be handled via createDisciplinaryAction with actionType='suspension', but there's no direct status update handler. | 10. API Expectations | MEDIUM |

#### File-Level Findings

| ID | Sev | File | Description | Spec Ref | Confidence |
|----|-----|------|-------------|----------|------------|
| EF-M04-directory-no-privacy | P0 | getDirectoryProfile.ts / listDirectoryProfiles.ts | Spec M5-R4 (directory visibility) requires filtering based on member's privacy settings. getDirectoryProfile returns full profile regardless of visibility setting. listDirectoryProfiles passes visibility as a filter but does not verify the requester is a member of the org (only checks session). Non-members could access member-only directory data. | 6. Permissions | HIGH |
| EF-M04-officer-term-no-enddate-validation | P2 | createOfficerTerm.ts | Spec M4-R1 defines officer term lifecycle. Handler allows null endDate but doesn't validate that startDate < endDate when endDate is provided. | 9. UI/UX (validation) | MEDIUM |
| EF-M04-discipline-no-immutability | P2 | createDisciplinaryAction.ts | Spec M4-R4 states disciplinary actions are immutable after creation. No update handler exists (good), but also no guard in the repo layer to prevent direct DB updates. Relies on absence of update handler rather than schema/repo-level enforcement. | 5. Business Rules | LOW |
| EF-M04-application-no-domain-event | P2 | createMembershipApplication.ts | Spec declares MembershipApplicationSubmitted event. Handler uses auditAction with eventSubType but does not emit a domain event via domainEvents.emit(). Downstream consumers relying on domain events won't be notified. | 10b. Domain Events | HIGH |
| EF-M04-approve-no-domain-event | P3 | approveMembershipApplication.ts | Spec declares MembershipApproved event. Handler audits but does not emit domain event. M06 (invoice generation) and M07 (welcome email) are declared consumers — they won't be triggered. | 10b. Domain Events | HIGH |

---

### M05: Membership (handlers: membership/)

#### Module-Level Findings

| ID | Sev | Description | Spec Ref | Confidence |
|----|-----|-------------|----------|------------|
| EM-M05-status-compute | P1 | Spec BR-01 declares membership status is COMPUTED from dues_expiry_date, never stored as mutable field. But createMembership and approveMembershipApplication both write explicit `status` values ('active', 'pendingPayment') to the DB. graceToLapsed job also writes status directly. This contradicts the computed-status model. | 5. Business Rules | HIGH |
| EM-M05-events | P1 | Spec declares 6 domain events (MembershipApproved, MembershipSuspended, MembershipStatusChanged, MembershipResigned, MembershipDeceased, MemberImported). No `domainEvents.emit()` calls exist in any membership/ handler. | 10b. Domain Events | HIGH |
| EM-M05-transfer | P1 | Spec declares POST /org/:id/members/:id/transfer endpoint. No transfer handler exists in membership/. Transfer handlers (createAffiliationTransfer, approveTransferBySource/Target, completeAffiliationTransfer) exist in association:member/ but aren't declared by M05 spec. | 10. API Expectations | MEDIUM |

#### File-Level Findings

| ID | Sev | File | Description | Spec Ref | Confidence |
|----|-----|------|-------------|----------|------------|
| EF-M05-addmember-no-audit | P2 | addMember.ts | No `auditAction()` call. Spec requires all membership changes logged to audit trail. Other handlers (createMembership, approveMembershipApplication) do audit. | 17. Observability | HIGH |
| EF-M05-import-no-license-match | P2 | csvImport.ts / importMembers.ts | Spec BR-22 requires matching imported members by email OR license number, with conflict flagging when email matches Person A but license matches Person B. Import code matches by email only (case-insensitive) but does not implement license-based matching or conflict flagging. | 5. Business Rules | HIGH |
| EF-M05-getmember-pii-exposure | P2 | getMember.ts | Returns full membership record including potentially sensitive fields. Spec says member detail should respect privacy settings (M5-R4). No privacy filtering applied. | 6. Permissions | MEDIUM |
| EF-M05-listmembers-no-role-check | P3 | listMembers.ts | Handler checks session exists but does not verify caller is an officer or member of the org. Any authenticated user could list members of any org if they know the orgId. listMemberships.ts in association:member/ has the same pattern. | 6. Permissions | HIGH |

---

## Cross-Module Patterns

### Systemic Issues

1. **Domain events not emitted (ALL modules)**: Specs declare 25+ domain events across M01-M05. Only 3 are actually emitted in code (`person.created`, `officer.assigned`, `member.suspended`/`member.removed`). This is the single largest enforcement gap. Cross-module communication relies on these events.

2. **Audit logging inconsistent**: Some handlers use `auditAction()`, some use `ctx.get('audit')?.logEvent()`, some use only `logger?.info()`. Multiple handlers (exportMyData, addMember, listMemberships) have no audit trail at all.

3. **Role/permission checks inconsistent**: Some handlers use `requirePosition()`, some check `ctx.get('platformAdmin')`, some only check `ctx.get('session')` without role verification. No unified middleware pattern.

4. **Missing handler files**: 6 spec-declared endpoints have no implementation files: toggleFeatureFlag, updateOrgStatus, getDashboardMetrics, getMyProfile, searchPersons, updateMyPrivacy (some exist under alternate names).

### Risk Summary

- **P0 (5)**: exportMyData PII exposure, updateMyProfile session invalidation, impersonation write-block missing, impersonation auto-expire missing, directory profile privacy bypass
- **P1 (14)**: Primarily missing domain event emissions and missing handler implementations
- **P2 (15)**: Validation gaps, audit logging gaps, business rule non-enforcement
- **P3 (5)**: Convention violations, low-risk documentation gaps

### Recommended Priority

1. Fix P0 security issues (impersonation write-block, export PII filtering, directory privacy)
2. Implement domain event emissions across all modules
3. Add missing handler implementations (M03 feature flag, org status, admin team)
4. Standardize auth/audit patterns across handlers
