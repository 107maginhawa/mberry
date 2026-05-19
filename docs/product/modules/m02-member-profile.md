---
# Module 2: Member Profile & Settings

## Overview
- **Purpose:** Allow members to manage their professional identity, control their privacy, configure notification preferences, export their data, and access a digital member ID card -- all from a single self-service area.
- **Phase:** 1
- **Monetization tier:** Free (basic profile management) / Standard (org directory access for officers)
- **Dependencies:** M1 Auth & Onboarding (authenticated user required)

## Capabilities

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 2.1 | Profile viewing and editing | Member views and edits their name, photo (upload + crop to square), contact info (email, phone, address), license number, and specialization. Changes to license number trigger re-validation against the association's format regex. Email changes require re-verification via 6-digit OTP. | Member | P0 |
| 2.2 | Professional details | Member manages their professional credentials: specialization, sub-specialization, years of practice, clinic/hospital affiliation (free text). Displayed in the member directory (subject to privacy controls). | Member | P0 |
| 2.3 | Privacy controls | Member toggles which profile fields are visible in the member directory: email (on/off), phone (on/off), photo (on/off), address (on/off). Name and license number are always visible to officers. Default: email hidden, phone hidden, photo visible, address hidden. Toggles take effect within 1 minute (cache invalidation). | Member | P0 |
| 2.4 | Notification preferences | Member configures notification delivery per category. In-app: always on, cannot be disabled (per M2-R8). Push: toggleable per category (dues, events, trainings, announcements, credits). High-priority items (dues overdue, account security) always push regardless of preference. Email: transactional emails always sent (receipts, password reset, status changes). Announcement/activity emails are opt-in. Weekly digest: opt-in (per M2-R11). | Member | P0 |
| 2.5 | Security settings | Member manages: change password (requires current password), change email (requires OTP verification on new email), manage MFA (enable/disable TOTP, view backup codes), view active sessions (device, location, last active), revoke sessions. | Member | P0 |
| 2.6 | Data export (DPA portability) | Member requests a full export of their personal data: profile, payment history, credit entries, activity participation, certificates. Export is generated as a ZIP file containing JSON + PDF summary. Available for download within 48 hours. Member is notified when the export is ready. | Member | P0 |
| 2.7 | Account deletion | Member requests account deletion. 30-day grace period begins immediately. During grace: member can cancel deletion and restore full access. After 30 days: PII is anonymized, profile photo deleted, email replaced with anonymized hash. Financial records retained for 7 years per tax law (anonymized -- linked to a placeholder ID, not the member's name). Credit records retained for regulatory compliance (anonymized). All org officers are notified of the member's departure. | Member | P0 |
| 2.8 | Digital member ID card + QR | Member views and downloads a digital ID card as a PDF. Card contains: member photo, full name, license number, organization name + logo, membership category, membership status (Active/Grace/Lapsed), expiry date, and a tamper-proof HMAC-signed QR code (per BR-18). Card regenerates when profile or status changes. Card works offline -- QR verification does not require a server call for basic authenticity (HMAC check). A verification page (online) shows current real-time status. | Member | P0 |
| 2.9 | Multi-org membership display | Member sees all their org memberships in one view: org name, membership category, status, dues expiry date. Each org is a card/row that links to the org-scoped dashboard. No org switching required for viewing overview data. | Member | P0 |

## User Journeys

### M-6: View & Update Profile
**Actor:** Member
**Trigger:** Clicks avatar/profile icon in nav bar, or navigates to /my/profile

**Steps:**
1. Member lands on /my/profile. Page shows their current profile: photo, name, email, phone, license number, specialization, and all org memberships.
2. Member clicks "Edit Profile" (or taps the edit icon on mobile).
3. /my/profile/edit form appears with all editable fields pre-populated.
4. Member changes desired fields. Photo upload opens a crop dialog (square aspect ratio).
5. If license number is changed, system validates against the association's regex pattern. If invalid, field shows an error inline.
6. Member clicks "Save Changes."
7. System saves the profile. Changes are immediately visible.
8. If email was changed, a 6-digit OTP is sent to the NEW email. The change is pending until verified. Old email remains active until verification completes.

**Success outcome:** Profile updated. Changes reflected in the directory (subject to privacy settings).
**Error paths:**
- Photo too large: "Image must be under 5MB. Please resize or choose a different photo."
- Invalid license format: "License number must match [format example]."
- Email already in use: "This email is already associated with another account."
- OTP verification fails (email change): Old email remains. Member can retry or cancel the email change.

---

### M-7: Change Password / Email
**Actor:** Member
**Trigger:** Navigates to /my/settings

**Steps:**
1. Member opens the security settings page.
2. **Change password:** Enters current password, new password, confirm new password. System validates password strength. On success, all other sessions are invalidated.
3. **Change email:** Enters new email. System sends 6-digit OTP to the new email. Member enters OTP. On success, email is updated and all sessions remain valid. A confirmation is sent to the OLD email: "Your email was changed. If this wasn't you, contact support immediately."

**Success outcome:** Password or email updated. Confirmation notification sent.
**Error paths:**
- Current password incorrect: "Current password is incorrect."
- New password too weak: Strength indicator + requirements list.
- New email already in use: "This email is associated with another account."
- OTP expired/incorrect: Same error handling as M1 OTP flows.

---

### M-8: Privacy Settings
**Actor:** Member
**Trigger:** Navigates to /my/settings

**Steps:**
1. Member opens privacy settings. Page shows toggle switches for each field: email visibility, phone visibility, photo visibility, address visibility.
2. Each toggle shows current state (visible/hidden) and who can see the field when visible ("other members in your org") vs. always visible ("officers always see this").
3. Member toggles a field. Change is saved immediately (optimistic update with server confirmation).
4. A notice at the top explains: "Officers of your organizations can always see your name, license number, and contact information regardless of these settings."

**Success outcome:** Privacy preferences updated. Directory reflects changes within 1 minute.
**Error paths:**
- Network error on toggle: Toast: "Could not save. Reverting." Toggle flips back.

---

### M-9: Export My Data (DPA Portability Right)
**Actor:** Member
**Trigger:** Navigates to /my/data-export

**Steps:**
1. Member sees a page explaining what data will be included: profile information, payment history, credit entries, activity participation records, downloaded certificates.
2. Member clicks "Request Data Export."
3. System shows confirmation: "Your data export is being prepared. You will be notified when it is ready for download. This usually takes a few hours."
4. Export job runs asynchronously. Generates a ZIP containing:
   - profile.json (all profile fields)
   - payments.json (all payment records with receipts)
   - credits.json (all credit entries with source details)
   - activities.json (all event/training participation)
   - summary.pdf (human-readable summary document)
5. Member receives an in-app notification and email when the export is ready.
6. Member returns to /my/data-export and clicks "Download Export." File downloads. Link expires after 7 days.

**Success outcome:** Member has a complete, portable copy of all their data.
**Error paths:**
- Export generation fails: "Export could not be completed. Please try again." Admin is notified of the failure.
- Download link expired: "This download link has expired. Request a new export."
- Concurrent requests: "An export is already in progress. You will be notified when it is ready."

---

### M-10: Delete Account
**Actor:** Member
**Trigger:** Navigates to /my/settings and clicks "Delete Account"

**Steps:**
1. Member clicks "Delete Account." A confirmation dialog appears explaining the consequences:
   - "Your profile and personal data will be permanently deleted after a 30-day grace period."
   - "Your payment records will be retained for 7 years (anonymized) as required by law."
   - "Your credit records will be retained (anonymized) for regulatory compliance."
   - "You can cancel the deletion at any time during the 30-day grace period."
   - "All organizations you belong to will be notified."
2. Member types "DELETE" to confirm (or enters their password on mobile for easier input).
3. System begins the 30-day grace period. Member's account is marked for deletion. A banner appears on every page: "Your account is scheduled for deletion on [date]. Cancel deletion?"
4. During the 30 days: Member can log in, use the platform normally, and cancel the deletion from the banner or from /my/settings.
5. After 30 days: PII is anonymized, sessions are invalidated, login is disabled.

**Success outcome:** Account deleted after grace period. Data anonymized per policy.
**Error paths:**
- Pending payments block deletion: "You have outstanding payments. Please resolve them before deleting your account."
- Member is the only officer in an org: "You are the sole [role] of [Org]. Transfer your role before deleting your account."
- Member cancels during grace period: Full account restoration. Banner removed. Org officers notified: "[Member] cancelled their account deletion request."

---

### M-20: View Member Card + QR (Digital ID)
**Actor:** Member
**Trigger:** Navigates to /my/id-card or taps "My ID Card" from dashboard

**Steps:**
1. Member opens /my/id-card. Page shows a visual preview of their digital ID card.
2. Card displays: profile photo, full name, license number, primary org name + logo, membership category, current status (Active/Grace/Lapsed -- color-coded), expiry date, and a QR code.
3. The QR code contains an HMAC-signed payload: member ID, org ID, status, expiry date.
4. Member can switch between orgs if they belong to multiple (each org generates a separate card).
5. Member clicks "Download PDF." A print-friendly PDF (credit card size, landscape) is generated and downloaded.
6. Below the card: a "Verify" link that opens the public verification URL (e.g., memberry.com/verify/[encoded-payload]). Anyone with the link or QR can verify the card's authenticity.

**Success outcome:** Member has a downloadable, verifiable digital ID card.
**Error paths:**
- No profile photo: Card shows a default avatar silhouette. A notice says: "Add a profile photo for a complete ID card."
- Status is Lapsed: Card is still downloadable but prominently shows "LAPSED" in red with the lapsed date. A notice says: "Your membership has lapsed. Pay dues to restore Active status."
- PDF generation fails: "Could not generate your ID card. Please try again." Retry button.

## Business Rules

This module references the following global business rules:

| Rule | Relevance to this module |
|------|--------------------------|
| BR-01 | Real-time membership status computation -- status shown on profile and ID card is always computed, never cached stale |
| BR-18 | QR Code Authentication (HMAC-signed) -- QR code on ID card uses HMAC for tamper-proof authenticity verification; does not require a server call for basic authenticity |
| BR-19 | ID Card Generation (on-demand) -- card is generated/regenerated when profile or status changes |
| BR-21 | Multi-Org Member Account -- profile shows all org memberships independently under one login |
| BR-23 | License Number Format -- license numbers validated against association-specific format pattern on profile save |

**Module-specific rules:**

| Code | Rule |
|------|------|
| M2-R1 | Email changes require OTP verification on the new email address. The old email remains active until verification completes. A security notification is sent to the old email. |
| M2-R2 | Password changes invalidate all other active sessions immediately. |
| M2-R3 | Privacy toggle changes take effect within 1 minute (directory cache invalidation). |
| M2-R4 | Data export requests are rate-limited to 1 per 24 hours per member. |
| M2-R5 | Account deletion has a mandatory 30-day grace period. Deletion is blocked if the member has pending payments or is the sole officer of any org. |
| M2-R6 | After account deletion, financial records are retained for 7 years with PII replaced by an anonymized identifier. Credit records are retained for the current cycle + 2 previous cycles. |
| M2-R7 | ID card PDF regenerates automatically when profile data or membership status changes. Previously downloaded PDFs remain valid (QR verification shows current status, not PDF-time status). |
| M2-R8 | In-app notifications are always on and cannot be disabled by the member. |
| M2-R9 | Profile photo uploads are limited to JPEG, PNG, or WebP formats with a maximum size of 5MB. |
| M2-R10 | All profile changes, email changes, password changes, and account deletion requests are recorded in an immutable audit trail. |
| M2-R11 | Weekly digest email is opt-in. Members can enable or disable it from notification preferences. |
| M2-R12 | Push notifications are toggleable per category (dues, events, trainings, announcements, credits). High-priority alerts (dues overdue, account security events) are always pushed regardless of preference. |
| M2-R13 | Transactional emails (payment receipts, password reset, status change notifications) cannot be opted out of. Announcement and activity emails are opt-in. |
| M2-R14 | Each org membership is displayed independently on the profile. One org's status (Active/Grace/Lapsed) does not affect the display or computation of another org's status. |

## UX Specification

### Screen Inventory

| Route | Page Name | Description | Desktop | Mobile |
|-------|----------|-------------|---------|--------|
| /my/profile | Profile Overview | Read-only view of member profile + all org memberships | Yes | Yes (primary) |
| /my/profile/edit | Edit Profile | Editable form for profile fields | Yes | Yes |
| /my/settings | Account Settings | General account settings, privacy, security, delete account | Yes | Yes |
| /my/data-export | Data Export | Request and download personal data export | Yes | Yes |
| /my/id-card | Digital ID Card | View and download member ID card with QR | Yes | Yes (primary) |

### Screen Details

#### Profile Overview (/my/profile)
**Route:** /my/profile
**Desktop layout:** Two-column layout. Left column (1/3 width): profile photo (large, circular), name, license number, specialization, status badges per org. Right column (2/3 width): contact information section, professional details section, org memberships list (cards), quick links to edit/settings/privacy/security/id-card.
**Mobile layout:** Single column. Profile photo centered at top (smaller). Name and key details below. Org membership cards stack vertically. Tab bar or segmented control for contact/professional/memberships sections.
**Components:**
- Profile photo (circular, 120px desktop / 80px mobile)
- Name + license number heading
- Specialization badge
- Org membership cards: each shows org logo, org name, category, status pill (green Active, amber Grace, red Lapsed), expiry date
- "Edit Profile" button (top right on desktop, floating action button on mobile)
- Quick links row: Privacy, Security, ID Card, Data Export
**States:**
- Loading: Skeleton placeholders for photo, text blocks, and cards
- Empty org memberships: "You are not yet a member of any organization. Search for your chapter or ask for an invitation."
- Error: Banner: "Could not load your profile. Pull to refresh." (mobile) / "Retry" button (desktop)
- Success: All data displayed
**Interactions:**
- Tapping an org membership card navigates to that org's scoped dashboard
- Pull-to-refresh on mobile reloads profile data

#### Edit Profile (/my/profile/edit)
**Route:** /my/profile/edit
**Desktop layout:** Single column form (max-width 600px), centered. Photo upload at top with crop overlay. Fields grouped: Personal (name, phone, address), Professional (license number, specialization, sub-specialization, years of practice, affiliation).
**Mobile layout:** Full-width form. Same field grouping. Photo upload is a full-width tap target.
**Components:**
- Photo upload: circular preview with "Change Photo" overlay. Click opens file picker. After selection, crop dialog appears (square aspect, drag to reposition, pinch to zoom on mobile).
- Text inputs for all editable fields
- License number input with format hint and real-time validation
- "Save Changes" primary button (sticky bottom on mobile)
- "Cancel" link
**States:**
- Loading: Spinner on save button
- Empty: Form with current values (never truly empty since it is an edit form)
- Error: Inline field errors. If save fails: banner "Could not save changes. Please try again."
- Success: Toast: "Profile updated." Redirect to /my/profile.
**Interactions:**
- Photo crop dialog uses a minimal UI: image preview, circular mask, drag to pan, slider to zoom, "Apply" and "Cancel" buttons
- License number validates on blur against the association regex

#### Privacy Settings (/my/settings -- Privacy tab)
**Route:** /my/settings
**Desktop layout:** Single column (max-width 500px). Heading: "Control what other members can see." List of toggle rows, each showing field name, current visibility, and a switch.
**Mobile layout:** Full-width. Same toggle list with large touch targets.
**Components:**
- Toggle row: "Email address" -- switch (on = visible in directory, off = hidden) -- helper text: "Officers can always see your email."
- Toggle row: "Phone number" -- same pattern
- Toggle row: "Profile photo" -- same pattern
- Toggle row: "Address" -- same pattern
- Info box at bottom: "Your name and license number are always visible to officers and in verification checks."
**States:**
- Loading: Toggles disabled with skeleton animation
- Default: Toggles show current state
- Saving: Toggle animates, brief spinner
- Error: Toggle reverts, toast: "Could not save. Please try again."
**Interactions:**
- Each toggle saves immediately on change (no submit button)
- Optimistic update: toggle changes visually before server confirms

#### Security Settings (/my/settings -- Security tab)
**Route:** /my/settings
**Desktop layout:** Single column (max-width 600px). Three sections: Change Password, Change Email, Two-Factor Authentication, Active Sessions.
**Mobile layout:** Full-width. Collapsible sections (accordion).
**Components:**
- Change Password section: current password, new password (with strength meter), confirm password, "Update Password" button
- Change Email section: new email input, "Send Verification Code" button, OTP input (appears after code sent)
- MFA section: toggle to enable/disable. If enabling: QR code for authenticator app, secret key (text fallback), backup codes list, "Confirm" button. If disabling: requires current password + TOTP code.
- Active Sessions section: list of sessions with device icon, device name/browser, IP location (city/country), last active time. "Revoke" button per session. "Revoke All Other Sessions" button.
**States:**
- Loading: Section skeletons
- Default: Current state of all settings
- Error: Inline errors per section. Wrong current password: "Incorrect password."
- Success: Per-section toast confirmation
**Interactions:**
- "Revoke" on a session is instant (optimistic). If the revoked session is the current one, user is logged out.
- MFA enable flow is a 3-step inline wizard (scan QR, enter code to verify, save backup codes)

#### Data Export (/my/data-export)
**Route:** /my/data-export
**Desktop layout:** Single column (max-width 600px). Explanation text at top. "Request Export" button. Below: list of previous export requests with status and download links.
**Mobile layout:** Full-width. Same structure.
**Components:**
- Explanation text: what is included in the export, estimated time
- "Request Data Export" primary button
- Previous exports table: date requested, status (processing/ready/expired), download button (if ready)
**States:**
- Loading: Skeleton
- No previous exports: "You have not requested a data export yet."
- Export in progress: "Your export is being prepared. You will be notified when it is ready." Progress indicator (indeterminate).
- Export ready: "Your data export is ready." Download button (prominent). Expiry notice: "Download available until [date]."
- Export expired: Row shows "Expired" with "Request New Export" link
**Interactions:**
- "Request Export" shows confirmation dialog: "This will generate a ZIP file with all your personal data. Continue?"
- Download triggers browser's native file download

#### Digital ID Card (/my/id-card)
**Route:** /my/id-card
**Desktop layout:** Centered card preview (credit card proportions, landscape). Below: org selector (if multi-org), "Download PDF" button, "Share Verification Link" button, explanation of QR verification.
**Mobile layout:** Card preview fills screen width. Org selector as a horizontal scroll of org pills. Sticky footer with "Download" and "Share" buttons.
**Components:**
- ID card preview: rendered as an HTML card mimicking the PDF layout. Shows photo, name, license number, org name + logo, category, status pill, expiry date, QR code, platform branding footer ("Verified by Memberry").
- Org selector: if member belongs to multiple orgs, a pill/tab per org. Selecting an org regenerates the card preview.
- "Download PDF" button
- "Share Verification Link" button (copies URL to clipboard or opens share sheet on mobile)
- QR explanation: "Anyone can scan this QR code to verify your membership status."
**States:**
- Loading: Card skeleton with blurred placeholder
- Active status: Green status pill. Clean card design.
- Grace status: Amber status pill. Card otherwise normal.
- Lapsed status: Red "LAPSED" stamp across the card (still downloadable). Notice below: "Your membership has lapsed. Renew to restore Active status."
- No photo: Default avatar silhouette on card. Notice: "Add a photo for a complete ID card."
- PDF generating: "Generating your ID card..." spinner on the download button.
- Error: "Could not generate ID card. Please try again."
**Interactions:**
- Tapping the QR code on the preview enlarges it full-screen (useful for someone else to scan)
- "Share" on mobile uses the native share sheet (if available) with the verification URL
- Card preview updates instantly when switching orgs

### Empty States

| Screen | Empty State | Message | Action |
|--------|------------|---------|--------|
| Profile Overview -- Org Memberships | No org memberships | "You are not a member of any organization yet. Find your chapter or ask for an invitation." | "Search Organizations" button |
| Profile Overview -- Photo | No profile photo | Default avatar with "Add Photo" overlay | Tap to upload |
| Data Export -- History | No previous exports | "You have not requested a data export before. Your export will include your profile, payments, credits, and activity history." | "Request Export" button |
| Security -- Active Sessions | Only current session | "This is your only active session." (Not really empty, but worth noting) | No action needed |
| ID Card -- No org | Member has no org membership | "Join an organization to get your digital member ID card." | "Find Organizations" link |

### Error States

| Scenario | UI Treatment |
|----------|-------------|
| Profile photo upload fails (server error) | Crop dialog closes. Toast: "Photo upload failed. Please try again." Previous photo retained. |
| Profile photo upload fails (invalid format) | Crop dialog does not open. Inline error below upload area: "Please upload a JPEG, PNG, or WebP image under 5MB." |
| License number change rejected (format invalid) | Inline error below field: "License number must match the format [expected pattern]." Save button remains disabled until corrected. |
| Email change OTP fails 5 times | OTP input disabled. Message: "Too many incorrect attempts. Request a new verification code." |
| Account deletion blocked | Dialog: "Cannot delete your account right now." Reason list: "You have a pending payment of [amount] to [Org]." or "You are the only [role] of [Org]. Transfer your role first." |
| Data export generation fails | Previous exports list shows failed entry with "Failed" status and "Retry" button. |
| ID card PDF generation fails | Toast: "Could not generate PDF. Please try again." Download button re-enabled. |
| Network error on privacy toggle | Toggle reverts to previous state. Toast: "Could not save your preference. Check your connection." |

## Acceptance Criteria Patterns

**Given** a member uploads a 3MB JPEG profile photo and crops it to a square,
**When** the photo is saved,
**Then** the photo appears on the member's profile, ID card, and in the directory (if photo visibility is enabled) within 1 minute.

**Given** a member toggles email visibility from hidden to visible in privacy settings,
**When** another member searches the org directory,
**Then** the first member's email is visible within 1 minute of the toggle change.

**Given** a member requests account deletion and the 30-day grace period is active,
**When** the member logs in during the grace period,
**Then** a persistent banner shows "Your account is scheduled for deletion on [date]" with a "Cancel Deletion" button, and the member can use all platform features normally.

**Given** a member downloads their digital ID card as a PDF,
**When** a third party scans the QR code on the PDF,
**Then** the verification page shows the member's current real-time status (which may differ from the status at PDF generation time).

**Given** a member belongs to 3 organizations with statuses Active, Grace, and Lapsed,
**When** the member views /my/profile,
**Then** all 3 org memberships are displayed as separate cards with independent status indicators, and no org's status affects the display of another.

**Given** a member requests a data export,
**When** the export is ready for download,
**Then** the member receives both an in-app notification and an email, and the ZIP file contains profile.json, payments.json, credits.json, activities.json, and summary.pdf.

## Data Entities

| Entity | Description | Key Fields | Relationships |
|--------|-------------|------------|---------------|
| Member | Core user profile | id, email, full_name, license_number, phone, address, photo_url, specialization, sub_specialization, years_of_practice, affiliation, email_verified_at, deletion_requested_at, deletion_scheduled_at, created_at, updated_at | Has many MemberOrganizations, has many PrivacySettings, has many DataExports, has many NotificationPreferences |
| PrivacySetting | Per-member directory visibility controls | id, member_id, field_name (email/phone/photo/address), is_visible, updated_at | Belongs to Member |
| NotificationPreference | Per-member, per-category notification toggles | id, member_id, category (dues/events/trainings/announcements/credits), push_enabled, email_enabled, updated_at | Belongs to Member |
| WeeklyDigestPreference | Digest opt-in config | id, member_id, enabled, preferred_day, updated_at | Belongs to Member |
| DataExport | Export request and download tracking | id, member_id, status (processing/ready/expired/failed), file_url, requested_at, completed_at, expires_at | Belongs to Member |
| MemberCard | Generated ID card metadata | id, member_id, org_id, pdf_url, qr_payload_hash, generated_at | Belongs to Member, belongs to Organization |
