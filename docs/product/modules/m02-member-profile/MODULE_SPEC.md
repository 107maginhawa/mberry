# Module Specification: Member Profile & Settings (M02)

---
oli_version: "Phase B -- Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Allow members to manage their professional identity, control privacy, configure notifications, export data, request account deletion, and access a digital member ID card -- all from a single self-service area.

### Users
- Member (healthcare professional)

### Related Modules
- M01 Auth & Onboarding (authentication required)
- M05 Membership (status computation for ID card)
- M06 Dues & Payments (payment history for data export, deletion guard)
- M11 Documents & Credentials (ID card, certificates)
- M13 Professional Feed (profile display)
- M15 Job Board (profile display)
- M17 Marketplace (profile display)

### In Scope
- Profile viewing and editing (name, photo, contact, license, specialization)
- Privacy controls (directory visibility toggles)
- Notification preferences (push, email, digest)
- Security settings (password, email, MFA, sessions)
- Data export (DPA portability)
- Account deletion (30-day grace, anonymization)
- Digital member ID card with QR code
- Multi-org membership display

### Out of Scope
- Membership status computation (M05)
- Payment processing (M06)
- Certificate generation (M09/M11)
- Consent management (planned, NOT yet implemented in schema)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Member | Healthcare professional using the platform. One account, multiple orgs. |
| Person | Central PII entity (name, email, phone). Aggregate root for identity context. |
| Membership Status | Current standing per org, computed from dues_expiry_date. Never stored as mutable. |
| Active | Dues current. Full access. |
| Grace | Dues expired within grace period. Read-only access. |
| Lapsed | Beyond grace period. No org features. |
| QR Code | HMAC-signed code on ID cards. Verifies authenticity offline. |
| Member ID Card | Generated PDF with name, photo, org, status, QR code. |
| License Number | PRC license identifier for cross-org matching and verification. |
| Credit Cycle | Per-member period for accumulating CPD credits. |

## 3. Workflows

| Workflow | WF-ID | Actor | Description | Priority |
|----------|-------|-------|-------------|----------|
| View & Update Profile | WF-010 | Member | Edit personal info, photo upload, privacy toggles | P0 |
| Account Deletion | WF-011 | Member | Request, 30-day grace, cascade via person.deletionProcessor | P0 |
| Digital ID Card | WF-012 | Member | View/download QR-verified member ID | P0 |
| Notification Preferences | WF-013 | Member | Per-channel opt-in/out | P0 |
| Data Export | WF-014 | Member | DPA-style personal data export | P0 |
| Change Password/Email | -- | Member | Security settings with OTP verification | P0 |
| Privacy Settings | -- | Member | Toggle directory visibility per field | P0 |

## 4. Workflow Details

### Workflow: View & Update Profile (WF-010)

Actor: Member
Preconditions: Authenticated
Steps:
1. Member opens /my/profile. Shows photo, name, email, license, specialization, all org memberships.
2. Clicks "Edit Profile."
3. Edits fields. Photo upload opens crop dialog (square).
4. If license changed, validates against association regex (BR-23).
5. Saves changes. Immediately visible.
6. If email changed, OTP sent to NEW email. Change pending until verified.

Exception Flows:
- Photo too large: "Image must be under 5MB."
- Invalid license format: inline error.
- Email already in use: "Email associated with another account."

Postconditions: Profile updated. Directory reflects changes within 1 minute.

### Workflow: Account Deletion (WF-011)

Actor: Member
Preconditions: Authenticated, no pending payments, not sole officer
Steps:
1. Member clicks "Delete Account." Confirmation dialog with consequences.
2. Types "DELETE" to confirm.
3. 30-day grace period begins. Banner on every page.
4. During grace: full platform access, cancel anytime.
5. After 30 days: PII anonymized via person.deletionProcessor, sessions invalidated, login disabled.
6. Financial records retained 7 years (anonymized). Credit records retained.

Exception Flows:
- Pending payments: "Resolve outstanding payments first."
- Sole officer: "Transfer your role before deleting."
- Cancel during grace: full restoration, officers notified.

Postconditions: Account anonymized per DPA 2012. Financial records retained.

### Workflow: Digital ID Card (WF-012)

Actor: Member
Preconditions: Authenticated, at least one org membership
Steps:
1. Member opens /my/id-card. Org selector if multi-org.
2. Card preview shows photo, name, license, org, computed status, QR code.
3. Member clicks Download PDF or Share Verification Link.
4. Third-party scanning QR sees real-time status (may differ from PDF-time).

Exception Flows:
- No photo: default avatar on card.
- PDF generation failure: "Could not generate ID card. Try again."

Postconditions: PDF downloaded or link shared. QR verifiable.

### Workflow: Data Export (WF-014)

Actor: Member
Preconditions: Authenticated, no export in last 24h
Steps:
1. Member clicks "Export My Data" in settings.
2. System queues export generation (profile, memberships, payments, credits, certificates).
3. Notification sent when ready. ZIP download link expires in 7 days.

Exception Flows:
- Rate limited: "You can request one export per 24 hours."
- Generation fails: "Export could not be completed. Try again."

Postconditions: ZIP available for download with 7-day TTL.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| M2-R1 | IF email changed THEN require OTP on new email | Email change | Old email active until verified |
| M2-R2 | IF password changed THEN invalidate all other sessions | Password change | Immediate session revocation |
| M2-R3 | IF privacy toggle changed THEN directory updated within 1 min | Privacy settings | Cache invalidation |
| M2-R4 | IF data export requested THEN rate limit 1 per 24h | Data export | Prevent abuse |
| M2-R5 | IF deletion requested THEN 30-day grace, blocked if pending payments or sole officer | Account deletion | Mandatory grace period |
| M2-R6 | IF account deleted THEN retain financial records 7 years anonymized | Post-deletion | DPA/BIR compliance |
| M2-R7 | IF profile or status changes THEN regenerate ID card | ID card | Auto-regeneration |
| M2-R8 | IF notification category = in-app THEN cannot be disabled | Notifications | Always on |
| M2-R9 | IF photo uploaded THEN validate JPEG/PNG/WebP, max 5MB | Photo upload | Format + size check |
| M2-R10 | IF profile changed THEN log to immutable audit trail | All changes | Audit compliance |
| M2-R14 | IF member has multiple orgs THEN display independently | Multi-org view | No cross-org status leakage |
| BR-01 | IF viewing status THEN compute from dues_expiry_date, never store as mutable field | ID card, profile | Real-time computation |
| BR-18 | IF QR generated THEN HMAC-signed for tamper-proof verification | ID card QR | Offline verification |
| BR-21 | IF member has multiple orgs THEN one account, independent statuses per org | Profile overview | Cross-org display |
| BR-31 | IF SVG uploaded THEN sanitize (remove scripts, event handlers) | Photo/logo | XSS prevention |
| BR-32 | IF account deleted THEN anonymize payments, remove PII, retain financial records 7yr | Deletion cascade | DPA compliance |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Read own profile | All authenticated | -- | GA |
| Update own profile | All authenticated | -- | GA |
| Read any profile | super, admin, support | All others | PA |
| Update any profile | super, admin | All others | PA |
| Delete account | Account owner | -- | GA, subject to M2-R5 |
| View own ID card | All authenticated | -- | GA |
| Request data export | All authenticated | -- | GA, subject to M2-R4 |

## 7. Data Requirements

### Entity: Person (extended fields)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| specialization | No | Professional specialty | Free text |
| subSpecialization | No | Sub-specialty | Free text, max 100 chars |
| yearsOfPractice | No | Years in practice | Integer >= 0 |
| affiliation | No | Clinic/hospital | Free text |
| deletionRequestedAt | No | Deletion request timestamp | Set on request |
| deletionScheduledAt | No | Scheduled deletion date | requestedAt + 30 days |

### Entity: NotificationPreference

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| personId | Yes | Person FK | -- |
| organizationId | Yes | Org FK | Per-org preferences |
| category | Yes | dues/events/trainings/announcements/credits | Enum |
| pushEnabled | No | Push toggle | Default: true |
| emailEnabled | No | Email toggle | Default: false |

### Entity: PersonPrivacySetting

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| personId | Yes | Person FK | -- |
| organizationId | Yes | Org FK | Per-org |
| emailVisible | No | Directory email visibility | Default: false |
| phoneVisible | No | Directory phone visibility | Default: false |
| photoVisible | No | Directory photo visibility | Default: true |
| addressVisible | No | Directory address visibility | Default: false |

### Entity: DataExport

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID | Auto-generated |
| personId | Yes | Person FK | -- |
| status | Yes | requested/processing/ready/failed/expired | Enum |
| downloadUrl | No | Signed URL | Set when ready |
| expiresAt | No | Download link expiry | 7 days from ready |
| requestedAt | Yes | Request timestamp | Rate limit check |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Person | NotificationPreference, PersonPrivacySetting, DataExport, MemberCard | Address, ContactInfo | One Person per email. PII centralized. |

Rules:
- All profile writes go through Person aggregate root.
- External modules reference Person by ID only.
- Membership status is computed, never stored on Person.

## 8. State Transitions

### Account Deletion
```txt
Active --> DeletionRequested --> DeletionScheduled (30 days) --> Anonymized
DeletionRequested --> Cancelled (member action) --> Active
```
Rules:
- Blocked if pending payments or sole officer (M2-R5).
- Cancellation restores full access immediately.
- Anonymized triggers person.deletionProcessor (BR-32).

### Data Export
```txt
Requested --> Processing --> Ready --> Expired (7 days)
Requested --> Processing --> Failed
```
Rules:
- Rate limited to 1 per 24h (M2-R4).
- Ready state triggers notification.

## 9. UI/UX Requirements

### Screen: Profile Overview (/my/profile)
Purpose: Read-only profile view with all org memberships
Users: Member
Components: Photo, name, license, specialization, org membership cards (status, category, expiry)
States:
- Loading: skeleton
- Empty: "Not a member yet" for zero orgs
- Success: full profile with org cards
- ValidationError: N/A (read-only)
- PermissionError: 401 redirect to login
- UnexpectedError: retry banner

### Screen: Profile Edit (/my/profile/edit)
Purpose: Edit personal info
Users: Member
Components: Form fields (name, photo crop, license, specialization, affiliation), Save button
States:
- Loading: skeleton
- Empty: default form with current values
- ValidationError: inline field errors
- Success: toast "Profile updated"
- UnexpectedError: "Save failed. Try again."

### Screen: Digital ID Card (/my/id-card)
Purpose: View and download verifiable digital ID
Users: Member
Components: Card preview (photo, name, license, org, status, QR), org selector, Download PDF, Share Verification Link
States:
- Active: green status badge
- Grace: amber status badge
- Lapsed: red "LAPSED" stamp
- NoPhoto: default avatar
- PDFGenerating: spinner overlay
- UnexpectedError: retry prompt

### Screen: Settings (/my/settings)
Purpose: Security, privacy, notifications, data management
Users: Member
Components: Password change, email change (with OTP), MFA toggle, active sessions list, privacy toggles, notification preferences, export button, delete account button
States:
- Loading: skeleton
- Success: settings displayed with current values
- DeletionActive: banner with countdown and cancel button
- UnexpectedError: retry banner

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /my/profile | Fetch profile | -- | Person data + org memberships | 401 |
| PUT /my/profile | Update profile | Fields to update | Updated person | 400 validation |
| PUT /my/privacy | Update privacy | Field toggles per org | Updated settings | 400 |
| PUT /my/notifications | Update notification prefs | Category toggles per org | Updated prefs | 400 |
| POST /my/data-export | Request export | -- | exportId, status | 429 rate limited |
| GET /my/data-export/:id | Check export status | exportId | status, downloadUrl | 404 |
| POST /my/delete-account | Request deletion | confirmation: "DELETE" | scheduledDate | 409 blocked (payments/officer) |
| DELETE /my/delete-account | Cancel deletion | -- | cancelled: true | 404 no active request |
| GET /my/id-card/:orgId | Get ID card data | orgId | Card data + QR payload | 404 no membership |
| GET /my/id-card/:orgId/pdf | Download PDF | orgId | PDF binary | 500 generation failure |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| PersonUpdated | Profile fields changed | personId, changedFields | M11 (card regen), M05 (directory) |
| PersonAnonymized | Deletion completed (30 days) | personId (anonymized) | M05, M06, M07 |
| DataExportReady | Export generation complete | personId, downloadUrl | Notifications |
| DeletionRequested | Member requests deletion | personId, scheduledDate | M05 (officer notification) |
| DeletionCancelled | Member cancels deletion | personId | M05 (officer notification) |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MembershipStatusChanged | M05 | Regenerate ID card | QR payload updated per M2-R7 |
| PaymentRecorded | M06 | Update dues display | Profile shows new expiry |

## 11. Acceptance Criteria

### AC-M02-001: Photo Upload
Given a member uploads a 3MB JPEG and crops to square,
When saved,
Then photo appears on profile, ID card, and directory within 1 minute.

### AC-M02-002: Privacy Toggle
Given a member toggles email visibility to visible,
When another member searches the directory,
Then the email is visible within 1 minute.

### AC-M02-003: Deletion Grace Period
Given a member requests deletion and the 30-day grace period is active,
When the member logs in,
Then a persistent banner shows deletion date with "Cancel Deletion" button, and all features work normally.

### AC-M02-004: QR Verification
Given a member downloads their ID card PDF,
When a third party scans the QR code,
Then the verification page shows current real-time status (may differ from PDF-time status).

### AC-M02-005: Multi-Org Display
Given a member belongs to 3 orgs with statuses Active, Grace, and Lapsed,
When viewing /my/profile,
Then all 3 displayed as separate cards with independent status indicators.

### AC-M02-006: Data Export Rate Limit
Given a member requested a data export 2 hours ago,
When they request another export,
Then the request is rejected with "You can request one export per 24 hours."

### AC-M02-007: Deletion Blocked by Payments
Given a member has outstanding payments in M06,
When they request account deletion,
Then the request is blocked with "Resolve outstanding payments first."

### AC-M02-008: Session Revocation on Password Change
Given a member changes their password,
When the change is saved,
Then all other active sessions are immediately revoked (M2-R2).

## 12. Test Expectations

Required tests:
- Profile update saves and reflects immediately
- Email change requires OTP on new email; old email stays active until verified
- Password change invalidates other sessions (M2-R2)
- Privacy toggles: each field independently controllable, directory updates within 1 min
- Data export: generation, notification, download, expiry after 7 days, rate limit
- Account deletion: grace period, cancellation, anonymization, financial record retention (BR-32)
- ID card: PDF generation, QR HMAC validation (BR-18), status color coding
- Multi-org: independent status display per org (BR-21)
- Photo validation: format, size, SVG sanitization (BR-31)
- Status computation: always from dues_expiry_date (BR-01)

## 13. Edge Cases

- Member deletes account while having memberships in 5 orgs: all 5 officers notified.
- Data export requested twice within 24h: second request rejected (M2-R4).
- Email change OTP fails 5 times: code invalidated, must request new.
- ID card for Lapsed member: still downloadable, "LAPSED" prominently displayed.
- Member with no photo: default avatar on ID card.
- Privacy toggle during network outage: optimistic update reverts, toast notification.
- Deletion cancelled at day 29: full restoration, all officers notified.
- Member with zero org memberships: ID card section hidden, profile shows "Join an organization."
- Concurrent profile updates from two devices: last-write-wins with conflict toast on stale device.

## 14. Dependencies

### Internal Dependencies
- M01 Auth & Onboarding (authentication, session management)
- M05 Membership (status computation for ID card, directory data)
- M06 Dues & Payments (payment history for data export, deletion guard)
- M11 Documents & Credentials (certificate data for export)

### External Dependencies
- PDF generation service (ID card, export summary)
- HMAC signing (QR codes per BR-18)
- Email service (notifications, OTP for email change)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Photo upload fails | Retain previous photo | "Photo upload failed. Please try again." |
| Invalid license format | Block save | "License must match format [pattern]." |
| Email already in use | Block change | "Email associated with another account." |
| Export generation fails | Log error, notify admin | "Export could not be completed. Try again." |
| PDF generation fails | Allow retry | "Could not generate ID card. Try again." |
| Deletion blocked (payments) | Show reason | "Resolve outstanding payments first." |
| Deletion blocked (sole officer) | Show reason | "Transfer your role before deleting." |
| SVG with scripts | Sanitize silently | File accepted after sanitization |

## 16. Performance Expectations

- Expected data volume: 1 person record, N org memberships, N privacy settings
- Expected concurrent users: 500+ at convention
- Acceptable response times: Profile load < 200ms; PDF generation < 3 seconds; data export < 5 minutes
- Caching requirements: Privacy settings cached with 1-min invalidation; ID card cached until status change

## 17. Observability Hooks

Structured log events:

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| profile.updated | INFO | Profile saved | personId, changedFields | No |
| profile.photo.uploaded | INFO | Photo saved | personId, fileSize | No |
| profile.deletion.requested | WARN | Deletion requested | personId, scheduledDate | No |
| profile.deletion.cancelled | INFO | Deletion cancelled | personId | No |
| profile.deletion.completed | WARN | Anonymization done | personId (anonymized) | No |
| profile.export.requested | INFO | Export initiated | personId | No |
| profile.export.ready | INFO | Export complete | personId, exportId | No |
| profile.idcard.generated | INFO | PDF generated | personId, orgId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| profile_updates_total | counter | field | Profile change count |
| idcard_generations_total | counter | status | PDF generation count |
| deletion_requests_total | counter | outcome | Deletion request count |
| data_exports_total | counter | status | Export count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| profile_data_export_enabled | release | true | Gates data export feature | -- |
| profile_weekly_digest | release | true | Gates weekly digest preference | -- |
| profile_idcard_share_link | release | false | Gates QR share verification link | -- |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M02-S1 | Profile View & Edit | Profile display + edit form + photo upload | M01 | P0 |
| M02-S2 | Privacy Controls | Directory visibility toggles per org | M02-S1 | P0 |
| M02-S3 | Security Settings | Password, email change (OTP), MFA, sessions | M02-S1 | P0 |
| M02-S4 | Notification Preferences | Push/email per category per org | M02-S1 | P0 |
| M02-S5 | Digital ID Card | Card preview + PDF + QR + org selector | M02-S1, M05 | P0 |
| M02-S6 | Data Export | DPA portability export + ZIP download | M02-S1 | P0 |
| M02-S7 | Account Deletion | Grace period + anonymization + cancellation | M02-S1 | P0 |
| M02-S8 | Multi-Org Display | Independent org membership cards | M02-S1, M05 | P0 |

## 20. AI Instructions

When implementing this module:
1. **Person is the central PII hub**: All profile data lives on the Person entity. Do not duplicate PII across modules. External modules reference Person by ID only.
2. **Consent management is NOT yet implemented**: Do not add JSONB consent fields to Person. This is planned for a future phase.
3. **Status is always computed**: Membership status comes from `dues_expiry_date` (BR-01). Never store status as a mutable field on Person.
4. **Handler pattern**: Use `services/api-ts/src/handlers/person/` as reference. Router -> Validators -> Handlers -> Repositories.
5. **Spec-first**: Define TypeSpec first, generate OpenAPI + types, then implement handlers.
6. **Vertical slices**: Implement one slice at a time. M02-S1 (Profile View & Edit) first.
7. **SVG sanitization**: Use BR-31 rules. Remove script elements and event handlers from uploaded SVGs.
8. **QR HMAC signing**: Use a server-side HMAC secret for BR-18. QR payload includes personId, orgId, timestamp.
9. **Deletion cascade**: person.deletionProcessor handles anonymization per BR-32. Financial records retained 7 years.
10. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | -- |
| 2. Domain Terms | COMPLETE | Added Person term from DOMAIN_GLOSSARY.md |
| 3. Workflows | COMPLETE | Aligned with WORKFLOW_MAP.md WF-010 through WF-014 |
| 4. Workflow Details | COMPLETE | Added WF-012 (ID Card) and WF-014 (Data Export) details |
| 5. Business Rules | COMPLETE | 16 rules including BR-01, BR-18, BR-21, BR-31, BR-32 |
| 6. Permissions | COMPLETE | Aligned with ROLE_PERMISSION_MATRIX.md |
| 7. Data Requirements | COMPLETE | Added DataExport entity |
| 7b. Aggregate Boundaries | COMPLETE | From DOMAIN_MODEL.md |
| 8. State Transitions | COMPLETE | Deletion and Export state machines |
| 9. UI/UX Requirements | COMPLETE | Added all required states |
| 10. API Expectations | COMPLETE | Added export status and deletion cancel endpoints |
| 10b. Domain Events | COMPLETE | Added DeletionRequested, DeletionCancelled |
| 11. Acceptance Criteria | COMPLETE | 8 ACs in Given/When/Then |
| 12. Test Expectations | COMPLETE | -- |
| 13. Edge Cases | COMPLETE | -- |
| 14. Dependencies | COMPLETE | -- |
| 15. Error Handling | COMPLETE | Added SVG sanitization |
| 16. Performance Expectations | COMPLETE | Added export timing |
| 17. Observability Hooks | COMPLETE | Added export.ready and deletion.cancelled |
| 18. Feature Flags | COMPLETE | Added idcard_share_link flag |
| 19. Vertical Slice Plan | COMPLETE | -- |
| 20. AI Instructions | COMPLETE | Enhanced with Person-centric and consent notes |
| 21. Section Completeness | COMPLETE | -- |
| 22. Downstream Impact | COMPLETE | -- |

## 22. Downstream Impact

- **M05**: Depends on PersonUpdated event for directory refresh. If Person entity schema changes, membership display must update.
- **M06**: PersonAnonymized event triggers financial record anonymization. Deletion guard depends on M06 reporting pending payments.
- **M07**: PersonAnonymized event triggers communication record cleanup.
- **M11**: PersonUpdated event triggers ID card regeneration. Certificate data included in data export.
- **M13/M15/M17**: Profile display fields (name, photo, specialization) feed into feed, job board, and marketplace. Privacy toggles gate field visibility.
