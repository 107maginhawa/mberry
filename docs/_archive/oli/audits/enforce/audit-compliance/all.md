# Audit Logging Compliance Report

**Generated:** 2026-05-28
**Source contract:** `docs/product/AUDIT_CONTRACTS.md`
**Source code:** `services/api-ts/src/handlers/` + `services/api-ts/src/core/auth.ts`
**Auditor:** oli-audit-compliance --audit-logging-only (Step 9d)

---

## Summary

| Metric | Count |
|--------|-------|
| Auditable events declared in contract | 40 |
| Events with compliant audit logging | 14 |
| Events with partial audit logging (logger only, missing fields) | 5 |
| Events with NO audit logging | 21 |
| P0 findings (PII leak) | 1 |
| P1 findings (missing audit log) | 21 |
| P2 findings (missing required fields) | 5 |

**Compliance rate: 35% (14/40 events fully compliant)**

---

## Events Checked Per Module

| Module | Events Declared | Compliant | Partial | Missing | Files Checked |
|--------|----------------|-----------|---------|---------|---------------|
| Authentication | 9 | 4 | 0 | 5 | `core/auth.ts`, `core/account-lockout.ts`, `platformadmin/startImpersonation.ts`, `platformadmin/endImpersonation.ts` |
| Data Access | 6 | 3 | 1 | 2 | `person/getPerson.ts`, `person/exportMyData.ts`, `person/updatePerson.ts`, `person/executeAccountDeletion.ts`, `storage/getFile.ts` |
| Financial | 6 | 0 | 2 | 4 | `billing/captureInvoicePayment.ts`, `billing/createInvoice.ts`, `billing/deleteInvoice.ts`, `billing/markInvoiceUncollectible.ts`, `billing/payInvoice.ts`, `dues/downloadReceipt.ts` |
| Membership | 6 | 0 | 1 | 5 | `membership/reviewApplication.ts`, `membership/updateMember.ts`, `membership/addMember.ts`, `membership/importMembers.ts` |
| Governance | 5 | 0 | 1 | 4 | `elections/createElection.ts`, `elections/castVote.ts`, `elections/certifyElection.ts` |
| Administrative | 5 | 4 | 0 | 1 | `platformadmin/createOrganization.ts`, `platformadmin/createAssociation.ts`, `platformadmin/deleteFeatureFlag.ts`, `platformadmin/exportDashboardReport.ts` |
| Content | 4 | 3 | 0 | 1 | `documents/createDocument.ts`, `documents/deleteDocument.ts`, `documents/getDocument.ts`, `certificates/generateCertificatePdf.ts`, `certificates/verifyCertificatePublic.ts` |

---

## Audit Logging Patterns Found

The codebase uses **three** audit logging mechanisms:

1. **`auditAction()` utility** (`@/utils/audit`) -- Structured audit via `audit.logEvent()`. Captures who (user ID), what (action, resourceType), when (auto), where (IP, userAgent), outcome (always "success"). **Best pattern.**
2. **Direct `audit.logEvent()`** -- Same structured audit but called inline without the helper. Used in `person/`, `storage/`, `core/auth.ts`.
3. **`logger?.info()`** (Pino) -- Operational logging only. Writes to stdout/log aggregator, NOT to the `audit_log_entry` table. **Does not satisfy audit contract.**

---

## Findings Table

### P0 -- Sensitive Data Logged Without Masking

| ID | Severity | Finding | File | Auditable Event |
|----|----------|---------|------|-----------------|
| AL-PERSON-a1b2c3d4 | **P0** | `exportMyData` returns full PII (person record, memberships, credit entries) with NO audit log call. The response includes email, phone, address, license number, date of birth -- all PII fields. No `data.pii-exported` audit event is logged, meaning bulk PII exfiltration is invisible to compliance. | `handlers/person/exportMyData.ts` | `data.pii-exported` |

### P1 -- Auditable Event With No Audit Log Call

| ID | Severity | Finding | File | Auditable Event |
|----|----------|---------|------|-----------------|
| AL-AUTH-e3f4a5b6 | P1 | No audit log for password change events. Better-Auth handles password reset flow but no `after` hook logs the event to the audit table. | `core/auth.ts` (emailAndPassword config) | `auth.password-changed` |
| AL-AUTH-f5a6b7c8 | P1 | No audit log for 2FA enable. Better-Auth `twoFactor()` plugin configured but no hook logs the event. | `core/auth.ts` (plugins) | `auth.2fa-enabled` |
| AL-AUTH-a7b8c9d0 | P1 | No audit log for 2FA disable. The handler blocks platform admins from disabling but does not log successful disables for regular users. | `core/auth.ts` (registerRoutes) | `auth.2fa-disabled` |
| AL-AUTH-b9c0d1e2 | P1 | No audit log for session revocation. Session limit enforcement revokes oldest sessions but only logs via Pino (`logger.info`), not to audit table. | `core/auth.ts` (enforceSessionLimit) | `auth.session-revoked` |
| AL-AUTH-c1d2e3f4 | P1 | No audit log for failed sign-in attempts. `onAPIError` hook records to in-memory counter and Pino logger but not to audit table. Only lockout itself is audited. | `core/auth.ts` (onAPIError) | `auth.sign-in` (failure path) |
| AL-DATA-d3e4f5a6 | P1 | `getPerson` uses `logger?.info()` only -- no `audit.logEvent()` call. PII access (name, email, DOB, license number) is not recorded in the audit table. | `handlers/person/getPerson.ts` | `data.pii-accessed` |
| AL-DATA-e5f6a7b8 | P1 | No audit log for bulk data export. `exportMyData` has zero audit calls -- neither `auditAction()` nor `audit.logEvent()`. | `handlers/person/exportMyData.ts` | `data.bulk-export` |
| AL-FINANCIAL-f7a8b9c0 | P1 | `captureInvoicePayment` uses only `logger.info()` -- no structured audit log. Payment capture (financial transaction) is invisible to audit. | `handlers/billing/captureInvoicePayment.ts` | `financial.payment-recorded` |
| AL-FINANCIAL-a9b0c1d2 | P1 | No audit log in `payInvoice`. Uses `logger.info()` only. Payment recording is a BIR-required 7-year audit event. | `handlers/billing/payInvoice.ts` | `financial.payment-recorded` |
| AL-FINANCIAL-b1c2d3e4 | P1 | No refund handler found. No handler implements payment refund flow with audit logging. | N/A | `financial.payment-refunded` |
| AL-FINANCIAL-c3d4e5f6 | P1 | `createInvoice` uses only `logger.info()` -- no audit log call. Invoice generation is a BIR-required event. | `handlers/billing/createInvoice.ts` | `financial.invoice-generated` |
| AL-FINANCIAL-d5e6f7a8 | P1 | `deleteInvoice` uses only `logger.info()` -- no audit log. Invoice voiding/deletion is a BIR-required event. | `handlers/billing/deleteInvoice.ts` | `financial.invoice-voided` |
| AL-MEMBERSHIP-e7f8a9b0 | P1 | `reviewApplication` has NO audit log call. Membership approval/rejection (approve or deny) is not recorded. | `handlers/membership/reviewApplication.ts` | `membership.application-approved` / `membership.application-rejected` |
| AL-MEMBERSHIP-f9a0b1c2 | P1 | `addMember` has NO audit log call. New member creation is not recorded. | `handlers/membership/addMember.ts` | `membership.status-changed` |
| AL-MEMBERSHIP-a1b2c3d5 | P1 | `updateMember` has NO audit log call. Status transitions (active/suspended/removed) are emitted as domain events but not to audit table. | `handlers/membership/updateMember.ts` | `membership.status-changed` |
| AL-MEMBERSHIP-b3c4d5e6 | P1 | No dedicated `membership.application-submitted` audit log in any handler. Application submission via `createMembershipApplication` in `association:member` not checked for audit. | `handlers/association:member/createMembershipApplication.ts` | `membership.application-submitted` |
| AL-MEMBERSHIP-c5d6e7f8 | P1 | `importMembers` (bulk import) has NO audit log call. Bulk operations importing member records are not audited. | `handlers/membership/importMembers.ts` | `membership.bulk-imported` |
| AL-GOVERNANCE-d7e8f9a0 | P1 | `createElection` has NO audit log call. Election creation is not recorded. | `handlers/elections/createElection.ts` | `governance.election-created` |
| AL-GOVERNANCE-e9f0a1b2 | P1 | `castVote` has NO audit log call. Vote casting (even anonymized) is not recorded in audit table. | `handlers/elections/castVote.ts` | `governance.vote-cast` |
| AL-GOVERNANCE-f1a2b3c4 | P1 | `certifyElection` has NO audit log call. Election certification and results publication are not audited. | `handlers/elections/certifyElection.ts` | `governance.results-published` |
| AL-GOVERNANCE-a3b4c5d6 | P1 | No dedicated officer assignment/removal handler found with audit logging. Officer transitions happen inside `certifyElection` but are not individually audited. | `handlers/elections/certifyElection.ts` | `governance.officer-assigned` / `governance.officer-removed` |
| AL-ADMIN-b5c6d7e8 | P1 | No `admin.platform-config-changed` audit event found. Platform configuration changes are not audited. | N/A | `admin.platform-config-changed` |

### P2 -- Audit Log Missing Required Fields

| ID | Severity | Finding | File | Auditable Event |
|----|----------|---------|------|-----------------|
| AL-AUTH-c7d8e9f0 | P2 | `auth.sign-in` audit log missing `email` field. Contract requires `email` but `session.create.after` hook only logs `userId`, `sessionId`, `ipAddress`, `userAgent`. | `core/auth.ts` (session.create.after) | `auth.sign-in` |
| AL-AUTH-d9e0f1a2 | P2 | `auth.sign-out` audit log missing `sessionId` in the event. Uses `session.id` as `resource` but contract says both `personId` and `sessionId` are required as explicit data fields. Minor -- sessionId is present as `resource`. | `core/auth.ts` (session.delete.after) | `auth.sign-out` |
| AL-DATA-e1f2a3b4 | P2 | `updatePerson` audit log missing `before/after` redacted state. Contract requires `data.pii-modified` to capture `before (redacted)` and `after (redacted)` but handler only logs `updatedFields` list, not before/after values. | `handlers/person/updatePerson.ts` | `data.pii-modified` |
| AL-CONTENT-f3a4b5c6 | P2 | `getDocument` has NO audit log call. Contract requires `data.document-accessed` with `documentId`, `accessedBy`, `IP`, `timestamp`. Handler returns the document but does not log access. | `handlers/documents/getDocument.ts` | `data.document-accessed` |
| AL-CONTENT-a5b6c7d8 | P2 | `generateCertificatePdf` has NO audit log. Contract requires `content.certificate-generated` but the handler returns HTML without logging. Missing who, what, when fields. | `handlers/certificates/generateCertificatePdf.ts` | `content.certificate-generated` |

---

## Compliant Events (14/40)

These events have proper `audit.logEvent()` or `auditAction()` calls with required fields:

| Event | Handler | Mechanism |
|-------|---------|-----------|
| `auth.sign-in` (success path) | `core/auth.ts` session.create.after | `auditRepo.logEvent()` |
| `auth.sign-out` | `core/auth.ts` session.delete.after | `auditRepo.logEvent()` |
| `auth.account-locked` | `core/account-lockout.ts` applyLockout | `auditRepo.logEvent()` |
| `auth.impersonation-started` | `platformadmin/startImpersonation.ts` | `auditAction()` with eventSubType |
| `auth.impersonation-ended` | `platformadmin/endImpersonation.ts` | `auditAction()` with eventSubType |
| `data.pii-modified` | `person/updatePerson.ts` | `audit.logEvent()` (partial -- see P2) |
| `data.pii-deleted` | `person/executeAccountDeletion.ts` | `audit.logEvent()` |
| `admin.role-changed` | `core/auth.ts` user.update.after | `auditRepo.logEvent()` |
| `admin.org-created` | `platformadmin/createOrganization.ts` | `auditAction()` |
| `admin.org-created` (association) | `platformadmin/createAssociation.ts` | `auditAction()` |
| `admin.feature-flag-toggled` | `platformadmin/deleteFeatureFlag.ts` | `auditAction()` |
| `content.document-uploaded` | `documents/createDocument.ts` | `auditAction()` |
| `content.document-deleted` | `documents/deleteDocument.ts` | `auditAction()` |
| `data.document-accessed` (storage) | `storage/getFile.ts` | `audit.logEvent()` |

---

## Partially Logged Events (logger only, no audit table entry)

These use `logger?.info()` (Pino) which writes to stdout but NOT to the `audit_log_entry` table. They are visible in log aggregators but fail the audit contract requirement of tamper-evident, queryable audit records.

| Event | Handler | What's Logged |
|-------|---------|---------------|
| `financial.payment-recorded` | `billing/captureInvoicePayment.ts` | `logger.info()` with invoiceId, paymentIntentId, chargeId |
| `financial.invoice-generated` | `billing/createInvoice.ts` | `logger.info()` with invoiceId, invoiceNumber |
| `financial.invoice-voided` | `billing/deleteInvoice.ts` | `logger.info()` with invoiceId, invoiceNumber, deletedByUser |
| `data.pii-accessed` | `person/getPerson.ts` | `logger.info()` with personId, viewedBy, action |
| `governance.vote-cast` | `elections/castVote.ts` | No logging at all (not even Pino) |

---

## Remediation Priority

### Wave 1 -- P0 (immediate)
1. **AL-PERSON-a1b2c3d4**: Add `auditAction()` call to `exportMyData.ts` with `eventSubType: 'data.pii-exported'`. Log fields accessed, format (JSON), and record count. Mask PII in audit details.

### Wave 2 -- P1 Financial (BIR compliance, 7-year retention)
2. **AL-FINANCIAL-***: Add `auditAction()` to all billing handlers: `captureInvoicePayment`, `payInvoice`, `createInvoice`, `deleteInvoice`, `markInvoiceUncollectible`. Each needs `eventSubType: 'financial.*'`.
3. **AL-FINANCIAL-b1c2d3e4**: Implement refund handler or add audit log to Stripe webhook refund path.

### Wave 3 -- P1 Auth (DPA 2012 compliance)
4. **AL-AUTH-***: Add Better-Auth hooks for `password-changed`, `2fa-enabled`, `2fa-disabled`. Add audit log to session revocation path. Log failed sign-in attempts to audit table (not just in-memory counter).

### Wave 4 -- P1 Membership & Governance
5. **AL-MEMBERSHIP-***: Add `auditAction()` to `reviewApplication`, `addMember`, `updateMember`, `importMembers`.
6. **AL-GOVERNANCE-***: Add `auditAction()` to `createElection`, `castVote` (anonymized voter hash), `certifyElection`.

### Wave 5 -- P2 Field Completeness
7. Fix missing fields in existing audit logs (email on sign-in, before/after on PII modify, access logs on document/certificate).

---

## File Index

All handler files referenced in this report are under `services/api-ts/src/`:

- `core/auth.ts` -- Better-Auth configuration with session hooks
- `core/account-lockout.ts` -- Failed login tracking and lockout
- `utils/audit.ts` -- `auditAction()` helper utility
- `handlers/person/getPerson.ts`
- `handlers/person/updatePerson.ts`
- `handlers/person/exportMyData.ts`
- `handlers/person/executeAccountDeletion.ts`
- `handlers/billing/captureInvoicePayment.ts`
- `handlers/billing/payInvoice.ts`
- `handlers/billing/createInvoice.ts`
- `handlers/billing/deleteInvoice.ts`
- `handlers/billing/markInvoiceUncollectible.ts`
- `handlers/membership/reviewApplication.ts`
- `handlers/membership/addMember.ts`
- `handlers/membership/updateMember.ts`
- `handlers/membership/importMembers.ts`
- `handlers/elections/createElection.ts`
- `handlers/elections/castVote.ts`
- `handlers/elections/certifyElection.ts`
- `handlers/documents/createDocument.ts`
- `handlers/documents/deleteDocument.ts`
- `handlers/documents/getDocument.ts`
- `handlers/certificates/generateCertificatePdf.ts`
- `handlers/certificates/verifyCertificatePublic.ts`
- `handlers/platformadmin/startImpersonation.ts`
- `handlers/platformadmin/endImpersonation.ts`
- `handlers/platformadmin/createOrganization.ts`
- `handlers/platformadmin/createAssociation.ts`
- `handlers/platformadmin/deleteFeatureFlag.ts`
- `handlers/platformadmin/exportDashboardReport.ts`
- `handlers/storage/getFile.ts`
- `handlers/storage/deleteFile.ts`
