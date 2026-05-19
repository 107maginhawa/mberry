# Module Specification: Member Profile & Settings (M02)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Allow members to manage their professional identity, control privacy, configure notifications, export data, request account deletion, and access a digital member ID card — all from a single self-service area.

### Users
- Member (healthcare professional)

### Related Modules
- M01 Auth & Onboarding (authentication required)
- M05 Membership (status computation for ID card)
- M11 Documents & Credentials (ID card, certificates)
- M13 Professional Feed (profile display)
- M15 Job Board (profile display)

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

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Member | Healthcare professional using the platform. One account, multiple orgs. |
| Membership Status | Current standing per org, computed from dues_expiry_date. Never stored as mutable. |
| Active | Dues current. Full access. |
| Grace | Dues expired within grace period. Read-only access. |
| Lapsed | Beyond grace period. No org features. |
| QR Code | HMAC-signed code on ID cards. Verifies authenticity offline. |
| Member ID Card | Generated PDF with name, photo, org, status, QR code. |
| License Number | PRC license identifier for cross-org matching and verification. |
| Credit Cycle | Per-member period for accumulating CPD credits. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| View & Update Profile | Member | Edit name, photo, contact, license, specialization | P0 |
| Change Password/Email | Member | Security settings with OTP verification | P0 |
| Privacy Settings | Member | Toggle directory visibility per field | P0 |
| Notification Preferences | Member | Configure push/email per category | P0 |
| Data Export | Member | DPA portability right — ZIP download | P0 |
| Account Deletion | Member | 30-day grace, then anonymization | P0 |
| View Member Card + QR | Member | Digital ID card with QR verification | P0 |

## 4. Workflow Details

### Workflow: View & Update Profile (M-6)

Actor: Member
Preconditions: Authenticated
Steps:
1. Member opens /my/profile. Shows photo, name, email, license, specialization, all org memberships.
2. Clicks "Edit Profile."
3. Edits fields. Photo upload opens crop dialog (square).
4. If license changed, validates against association regex.
5. Saves changes. Immediately visible.
6. If email changed, OTP sent to NEW email. Change pending until verified.

Exception Flows:
- Photo too large: "Image must be under 5MB."
- Invalid license format: inline error.
- Email already in use: "Email associated with another account."

Postconditions: Profile updated. Directory reflects changes within 1 minute.

### Workflow: Account Deletion (M-10)

Actor: Member
Preconditions: Authenticated, no pending payments, not sole officer
Steps:
1. Member clicks "Delete Account." Confirmation dialog with consequences.
2. Types "DELETE" to confirm.
3. 30-day grace period begins. Banner on every page.
4. During grace: full platform access, cancel anytime.
5. After 30 days: PII anonymized, sessions invalidated, login disabled.
6. Financial records retained 7 years (anonymized). Credit records retained.

Exception Flows:
- Pending payments: "Resolve outstanding payments first."
- Sole officer: "Transfer your role before deleting."
- Cancel during grace: full restoration, officers notified.

Postconditions: Account anonymized per DPA 2012. Financial records retained.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| M2-R1 | IF email changed THEN require OTP on new email | Email change | Old email active until verified |
| M2-R2 | IF password changed THEN invalidate all other sessions | Password change | Immediate session revocation |
| M2-R3 | IF privacy toggle changed THEN directory updated within 1 min | Privacy settings | Cache invalidation |
| M2-R4 | IF data export requested THEN rate limit 1 per 24h | Data export | Prevent abuse |
| M2-R5 | IF deletion requested THEN 30-day grace, blocked if pending payments or sole officer | Account deletion | Mandatory grace period |
| M2-R6 | IF account deleted THEN retain financial records 7 years anonymized | Post-deletion | DPA/BIR compliance |
| M2-R7 | IF profile/status changes THEN regenerate ID card | ID card | Auto-regeneration |
| M2-R8 | IF notification category = in-app THEN cannot be disabled | Notifications | Always on |
| M2-R9 | IF photo uploaded THEN validate JPEG/PNG/WebP, max 5MB | Photo upload | Format + size check |
| M2-R10 | IF profile changed THEN log to immutable audit trail | All changes | Audit compliance |
| M2-R14 | IF member has multiple orgs THEN display independently | Multi-org view | No cross-org status leakage |
| BR-01 | IF viewing status THEN compute from dues_expiry_date | ID card, profile | Real-time computation |
| BR-18 | IF QR generated THEN HMAC-signed | ID card QR | Tamper-proof |
| BR-21 | IF member has multiple orgs THEN one account, independent statuses | Profile overview | Cross-org display |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Read own profile | All authenticated | — | GA |
| Update own profile | All authenticated | — | GA |
| Read any profile | super, admin, support | All others | PA |
| Update any profile | super, admin | All others | PA |
| Delete account | Account owner | — | GA, subject to M2-R5 |
| View own ID card | All authenticated | — | GA |

## 7. Data Requirements

### Entity: Person (extended fields)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| specialization | No | Professional specialty | Free text |
| subSpecialization | No | Sub-specialty | Free text |
| yearsOfPractice | No | Years in practice | Integer |
| affiliation | No | Clinic/hospital | Free text |
| deletionRequestedAt | No | Deletion request timestamp | Set on request |
| deletionScheduledAt | No | Scheduled deletion date | requestedAt + 30 days |

### Entity: NotificationPreference

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| personId | Yes | Person FK | — |
| organizationId | Yes | Org FK | Per-org preferences |
| category | Yes | dues/events/trainings/announcements/credits | — |
| pushEnabled | No | Push toggle | Default: true |
| emailEnabled | No | Email toggle | Default: false |

### Entity: PersonPrivacySetting

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| personId | Yes | Person FK | — |
| organizationId | Yes | Org FK | Per-org |
| emailVisible | No | Directory email visibility | Default: false |
| phoneVisible | No | Directory phone visibility | Default: false |
| photoVisible | No | Directory photo visibility | Default: true |
| addressVisible | No | Directory address visibility | Default: false |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Person | NotificationPreference, PersonPrivacySetting, DataExport, MemberCard | Address, ContactInfo | One Person per email. PII centralized. |

## 8. State Transitions

### Account Deletion
```txt
Active → DeletionRequested → DeletionScheduled (30 days) → Anonymized
DeletionRequested → Cancelled (member action) → Active
```

### Data Export
```txt
Requested → Processing → Ready → Expired (7 days)
Requested → Processing → Failed
```

## 9. UI / UX Requirements

### Screen: Profile Overview (/my/profile)
Purpose: Read-only profile view with all org memberships
Users: Member
Components: Photo, name, license, specialization, org membership cards (status, category, expiry)
States: Loading (skeleton), Empty orgs ("Not a member yet"), Error (retry banner)

### Screen: Digital ID Card (/my/id-card)
Purpose: View and download verifiable digital ID
Users: Member
Components: Card preview (photo, name, license, org, status, QR), org selector, Download PDF, Share Verification Link
States: Active (green), Grace (amber), Lapsed (red stamp), No photo (default avatar), PDF generating (spinner)

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /my/profile | Fetch profile | — | Person data + org memberships | 401 |
| PUT /my/profile | Update profile | Fields to update | Updated person | 400 validation |
| PUT /my/privacy | Update privacy | Field toggles | Updated settings | 400 |
| PUT /my/notifications | Update notification prefs | Category toggles | Updated prefs | 400 |
| POST /my/data-export | Request export | — | exportId, status | 429 rate limited |
| POST /my/delete-account | Request deletion | confirmation | scheduledDate | 409 blocked |
| GET /my/id-card/:orgId | Get ID card data | orgId | Card data + QR payload | 404 |
| GET /my/id-card/:orgId/pdf | Download PDF | orgId | PDF binary | 500 generation failure |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| PersonUpdated | Profile fields changed | personId, changedFields | M11 (card regen), M05 (directory) |
| PersonAnonymized | Deletion completed | personId (anonymized) | M05, M06, M07 |
| DataExportReady | Export generation complete | personId, downloadUrl | Notifications |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MembershipStatusChanged | M05 | Regenerate ID card | QR payload updated |
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

## 12. Test Expectations

Required tests:
- Profile update saves and reflects immediately
- Email change requires OTP on new email; old email stays active until verified
- Password change invalidates other sessions
- Privacy toggles: each field independently controllable, directory updates within 1 min
- Data export: generation, notification, download, expiry after 7 days
- Account deletion: grace period, cancellation, anonymization, financial record retention
- ID card: PDF generation, QR HMAC validation, status color coding
- Multi-org: independent status display per org

## 13. Edge Cases

- Member deletes account while having memberships in 5 orgs: all 5 officers notified.
- Data export requested twice within 24h: second request rejected (M2-R4).
- Email change OTP fails 5 times: code invalidated, must request new.
- ID card for Lapsed member: still downloadable, "LAPSED" prominently displayed.
- Member with no photo: default avatar on ID card.
- Privacy toggle during network outage: optimistic update reverts, toast notification.

## 14. Dependencies

### Internal Dependencies
- M01 Auth & Onboarding (authentication, session management)
- M05 Membership (status computation for ID card, directory data)
- M06 Dues & Payments (payment history for data export)
- M11 Documents & Credentials (certificate data for export)

### External Dependencies
- PDF generation service (ID card, export summary)
- HMAC signing (QR codes)
- Email service (notifications)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Photo upload fails | Retain previous photo | "Photo upload failed. Please try again." |
| Invalid license format | Block save | "License must match format [pattern]." |
| Email already in use | Block change | "Email associated with another account." |
| Export generation fails | Log error, notify admin | "Export could not be completed. Try again." |
| PDF generation fails | Allow retry | "Could not generate ID card. Try again." |
| Deletion blocked | Show reason | "Resolve outstanding payments first." |

## 16. Performance Expectations

- Expected data volume: 1 person record, N org memberships, N privacy settings
- Expected concurrent users: 500+ at convention
- Acceptable response times: Profile load < 200ms; PDF generation < 3 seconds
- Caching requirements: Privacy settings cached with 1-min invalidation

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| profile.updated | INFO | Profile saved | personId, changedFields | No |
| profile.photo.uploaded | INFO | Photo saved | personId, fileSize | No |
| profile.deletion.requested | WARN | Deletion requested | personId, scheduledDate | No |
| profile.deletion.completed | WARN | Anonymization done | personId (anonymized) | No |
| profile.export.requested | INFO | Export initiated | personId | No |
| profile.idcard.generated | INFO | PDF generated | personId, orgId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| profile_updates_total | counter | field | Profile change count |
| idcard_generations_total | counter | status | PDF generation count |
| deletion_requests_total | counter | outcome | Deletion request count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| profile_data_export_enabled | release | true | Gates data export feature | — |
| profile_weekly_digest | release | true | Gates weekly digest preference | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M02-S1 | Profile View & Edit | Profile display + edit form | M01 | P0 |
| M02-S2 | Privacy Controls | Directory visibility toggles | M02-S1 | P0 |
| M02-S3 | Security Settings | Password, email, MFA, sessions | M02-S1 | P0 |
| M02-S4 | Notification Preferences | Push/email per category | M02-S1 | P0 |
| M02-S5 | Digital ID Card | Card preview + PDF + QR | M02-S1, M05 | P0 |
| M02-S6 | Data Export | DPA portability export | M02-S1 | P0 |
| M02-S7 | Account Deletion | Grace period + anonymization | M02-S1 | P0 |
| M02-S8 | Multi-Org Display | Independent org membership cards | M02-S1, M05 | P0 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
