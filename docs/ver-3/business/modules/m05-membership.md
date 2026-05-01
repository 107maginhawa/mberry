# Module 5: Membership

## Overview

| Attribute | Detail |
|---|---|
| **Purpose** | Complete member lifecycle management -- from application through renewal, across multiple organizations. Covers the member roster, applications, categories, bulk import, cross-org matching, directory, transfers, and the org public page application flow. |
| **Phase** | 1 |
| **Monetization Tier** | Standard |
| **Dependencies** | M01 (Auth & Onboarding), M04 (Org Admin) |
| **Key Actors** | Secretary, President, Officers, Member, Prospective Member (public visitor), System |

---

## Capabilities

| # | Capability | Description | User(s) | Priority |
|---|---|---|---|---|
| 5.1 | Multi-org membership | A member can belong to chapter, society, and national body simultaneously. One account, one login. Each org-membership has independent status, category, dues, and credit balance. | Member | P0 |
| 5.2 | Cross-org member matching | On add/import, system matches existing accounts by email OR license number. Normalization: strip spaces, dashes, leading zeros; case-insensitive. Ambiguous matches (email matches person A, license matches person B) flagged for human resolution. | Officer, System | P0 |
| 5.3 | Membership categories | Per-org configurable categories (defaults: Regular, Associate, Life, Student, Honorary). Each category has a name, description, and dues rate. Categories can be deactivated but not deleted if members are assigned. | Officer, Member | P0 |
| 5.4 | Computed membership status | Status derived from `dues_expiry_date` at query time. Never stored as mutable field. States: Pending, Active, Grace, Lapsed, Suspended, Removed. Computed independently per org. | System | P0 |
| 5.5 | Life member exemption | Members with category "Life" always computed as Active. `dues_expiry_date` set to sentinel value (2099-12-31). Exempt from renewal reminders. Life designation only granted/revoked by National Admin or Super Admin. | System | P0 |
| 5.6 | Member directory | Searchable list of members within an org. Search by name, license number. Results filtered by member privacy settings. Officers see full details + status + dues info. Members see name, photo (if allowed), specialization. Scoped to current org. | Member, Officer | P0 |
| 5.7 | Member transfer | Officer initiates transfer from one org to another (same association). Preserves payment history, credit records, profile. Receiving org admin must approve. Member notified. | Officer | P0 |
| 5.8 | Membership application | Visitor clicks "Apply to Join" on org public page. Fills out: name, email, license number, specialization, category preference. Application enters review queue. Confirmation email sent. | Prospective Member | P0 |
| 5.9 | Application review | Officer views pending applications. Approve (member created, welcome email, dues invoice generated), reject (with optional reason, rejection email sent), or request more info. Bulk approve supported. | Officer | P0 |
| 5.10 | Manual member add | Officer adds a single member directly: name, email, license number, category. System checks for existing account (cross-org matching). Member receives claim email. | Officer | P0 |
| 5.11 | Bulk CSV import | Officer downloads CSV template, uploads filled CSV. Row-level validation. Preview: valid rows, invalid rows with errors, already-matched members. Officer confirms import. Claim emails sent to new members. Invalid rows downloadable for correction. | Officer | P0 |
| 5.12 | Renewal reminders | Configurable automated reminders before dues expiry (defaults: 60, 30, 7 days before). Each reminder includes member name, org, amount, expiry date, and direct one-tap payment link. Schedule configurable per org. | System, Officer | P0 |
| 5.13 | Grace period enforcement | After expiry: Grace status with persistent warning banner. After grace period ends: Lapsed status. Lapsed members can log in, see dashboard, but cannot register for paid events/trainings. Reinstatement prompt shown. | System | P0 |
| 5.14 | Reinstatement workflow | Lapsed member reinstates by paying current dues. Payment resets `dues_expiry_date` to one year from payment date. Status immediately recomputes to Active. Officer can manually reinstate with recorded offline payment. | Member, Officer | P0 |
| 5.15 | Member engagement analytics | Officer views per-member engagement: last login, events attended, trainings attended, dues history (on-time vs. late), engagement score. "At risk" members highlighted. Sortable, filterable, exportable as CSV. | Officer | P0 |

---

## User Journeys

### CS-1: Process Membership Applications

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Secretary sees notification: "N pending applications" | Applications page (/org/[id]/officer/applications) shows pending list sorted by date | |
| 2 | Opens an application | Member details: name, email, license#, specialization, category preference, date applied | |
| 3a | Approves application | Member created. Dashboard access granted. Welcome email sent. Dues invoice generated for selected category. | |
| 3b | Rejects with reason | Member notified: "Application rejected. Reason: [text]" | |
| 3c | Requests more information | Applicant receives email: "More information needed: [officer message]" | |
| 4 | Bulk approve: selects multiple applications | Confirmation: "Approve N applications?" All approved simultaneously. | Some applications have validation issues: skipped with error |

### CS-2: Import Members from CSV

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens `/org/[id]/officer/roster/import` | "Download Template" button and file upload area | |
| 2 | Downloads CSV template | Pre-formatted template: columns for name, email, license_number, category, phone | |
| 3 | Fills in member data, uploads CSV | Validates each row independently per M5-R8 | Invalid file type: "CSV files only" |
| 4 | Reviews validation preview | Summary: "N total rows. X new members. Y already-linked (will be linked automatically). Z invalid rows." | |
| 5 | Clicks "View Invalid Rows" | Table of invalid rows with row number, field(s), error reason | |
| 6 | Clicks "View Already-Linked" | Table of matched members with name, email, match method (email/license#) | |
| 7 | Confirms import | Processing with progress bar | |
| 8 | Views completion report | "X imported, Y linked, Z skipped" | |
| 9 | Downloads invalid rows CSV | CSV of failed rows for correction and re-upload | |
| 10 | New members receive claim emails | Claim flow: verify email + set password | Bounce: logged |

### M-11: Apply to Join an Org (Member Self-Service)

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Visits org public page (`/org/[slug]`) | Org profile with "Apply to Join" button | |
| 2 | Clicks "Apply to Join" | If logged in: application form (pre-filled from profile). If not logged in: redirect to registration with org pre-selected. | |
| 3 | Fills out application | Name, email, license#, specialization, category preference | License format invalid: "Expected format: [example]" |
| 4 | Submits | "Application submitted. Waiting for approval from [Org]." Confirmation email sent. | Duplicate application: "You already have a pending application for this org." |
| 5 | Officer approves (CS-1) | Member gets dashboard access. Welcome notification. | Rejected: "Rejected. Reason: [text]" |

### M-12: View Member Directory

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens `/org/[id]/members` | Member list scoped to current org | |
| 2 | Searches by name or license# | Filtered results | No results: "No members found matching your search." |
| 3 | Views member profile | Name, photo (if privacy allows), specialization, membership status. Officers additionally see: contact info, dues info, category. | |

### CO-14: Add Member Manually

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens "Add Member" from members section | Member form | |
| 2 | Enters member details | Name, email, license#, phone, membership category | |
| 3 | System checks for existing account | Match on email or license# (normalized per BR-22). If match: "This person already has an account. They will be linked to this org." If no match: "A new account will be created." | Ambiguous match (email matches A, license matches B): flagged for manual resolution |
| 4 | Confirms | If new: claim email sent. If existing: notification "You've been added to [Org]." | |

### CO-15: Bulk Member Import

Same as CS-2 above. This is the officer-facing journey for the CSV import capability.

### M-7: Cross-Org Membership

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Second org adds/imports member (email or license match) | System detects existing account. Links to new org. No duplicate. | Ambiguous match: flagged for officer resolution |
| 2 | Member receives notification | "You've been added to [Org B]" | |
| 3 | Opens dashboard | "My Memberships" shows all orgs with independent status, dues, credits | |

---

## Business Rules

### Referenced Business Rules

| Rule ID | Name | Application in This Module |
|---|---|---|
| BR-01 | Membership Status Computation | Status (Active/Grace/Lapsed) computed from `dues_expiry_date` + org grace period at every read. Never stored as mutable field. Life members (null or sentinel `dues_expiry_date`) always return Active. |
| BR-02 | Grace Period Default | Per-org setting (0-90 days, default 30). Determines duration of Grace status after expiry. |
| BR-04 | Dues Amount per Org | Categories configured per org. Cannot delete categories with assigned members (deactivate only). |
| BR-21 | Multi-Org Member Account | One account, multiple org-memberships. Each independent. |
| BR-22 | Member Matching on Import | Match by email (case-insensitive) or license number (normalized). Ambiguous matches flagged for human review. |

### Module-Specific Rules

**M5-R1: Membership State Machine**

Valid states and transitions:

```
                    +---------+
       Apply ------>| Pending |
                    +----+----+
                         |
                   Approve|   Reject --> (removed from queue)
                         v
                    +--------+
    Pay dues ------>| Active |<----- Reinstate (pay dues)
                    +----+----+
                         |
                  Expiry  |
                         v
                    +-------+
                    | Grace |
                    +---+---+
                        |
              Grace end |
                        v
                    +--------+
                    | Lapsed |
                    +--------+

    Officer override (any state except Pending):
        --> Suspended (officer action, requires reason)
        --> Removed (officer action, requires reason)
```

Valid transitions:
- **Pending -> Active:** Application approved (or import with direct add)
- **Active -> Grace:** `dues_expiry_date` passes (computed, not stored)
- **Grace -> Lapsed:** Grace period expires (computed, not stored)
- **Lapsed -> Active:** Member pays dues (reinstatement)
- **Any (except Pending) -> Suspended:** Officer disciplinary action (M04)
- **Suspended -> Active:** Officer lifts suspension
- **Any -> Removed:** Officer removes member (M04)

States that are computed (not stored): Active, Grace, Lapsed.
States that are stored as overrides: Pending, Suspended, Removed.

**M5-R2: Cross-Org Member Matching Normalization**

Before matching, the system normalizes identifiers:
- **Email:** Lowercase. Trim whitespace.
- **License number:** Remove all spaces, dashes, and leading zeros. Case-insensitive.

Examples:
- `" Maria.Cruz@Hospital.PH "` normalizes to `maria.cruz@hospital.ph`
- `"PRC-RN-0056789"` normalizes to `prcrn56789`
- `" 0056789 "` normalizes to `56789`

Matching priority:
1. Exact email match -> auto-link
2. Exact license match -> auto-link
3. Email matches Person A, license matches Person B -> flag as conflict for human resolution

**M5-R3: CSV Import Validation Rules**

Per-row validation checks (all independent per M5-R8):
| Field | Validation | Error Message |
|---|---|---|
| name | Required, non-empty, 2-100 chars | "Name is required" / "Name must be 2-100 characters" |
| email | Required, valid email format | "Email is required" / "Invalid email format" |
| license_number | Required, matches association license format regex | "License number is required" / "Invalid format. Expected: [pattern]" |
| category | Required, must match an active category name for this org | "Category is required" / "Unknown category '[value]'. Valid: Regular, Associate, Student, ..." |
| phone | Optional, valid phone format if provided | "Invalid phone format" |

Cross-row validation:
- Duplicate emails within the same file: second occurrence flagged as "Duplicate email in file (row N)"
- Duplicate license numbers within the same file: same treatment

Performance requirement: 500-row CSV files must complete validation within 30 seconds.

**M5-R4: Directory Visibility Rules**

| Viewer Role | Visible Fields |
|---|---|
| Fellow Member | Name, photo (if privacy allows), specialization, membership status |
| Officer | All of the above + email, phone, address, dues info, category, last login |
| Public (no auth) | Directory not accessible. Only org public page visible. |

Members control visibility of: email (default: hidden), phone (default: hidden), photo (default: visible). Name and license number are always visible to officers regardless of privacy settings.

**M5-R5: Application Deduplication**

A member may not have more than one pending application per org. If a member with a pending application attempts to apply again, the system rejects with: "You already have a pending application for this organization."

**M5-R6: Member Transfer Preserves History**
Transfer creates a new org-membership record in the receiving org, optionally deactivating the old one. Payment history, credit records, and profile data are never deleted. The receiving org admin must approve before the transfer is finalized. Member is notified of the outcome.

**M5-R7: Email Verification for Imported Members**
Imported members must verify their email and set a password before accessing platform features. A claim email is sent on import. If the claim email bounces, the bounce is logged and the member remains in "Pending Verification" state.

**M5-R8: Independent Row Validation in Bulk Import**
Each CSV row is validated independently. Valid rows are imported even if other rows in the same file fail. Invalid rows are collected into a downloadable error report and do not block the rest of the import.

**M5-R9: Immutable Audit Trail**
All membership changes (status transitions, category changes, transfers, disciplinary actions, import events) are logged with actor, timestamp, and before/after state. Audit log entries are never modified or deleted after creation.

**M5-R10: Independent Org-Membership Context**
Each org-membership maintains independent state. Actions in one org (status changes, suspensions, category changes) do not affect a member's membership in any other org.

**M5-R11: Bulk Import Already-Linked Member Count**
The pre-import validation preview shows a count of already-linked members (existing accounts matched by email or license number). The officer must review this count before confirming the import. Already-linked members are linked to the org automatically without creating duplicate accounts.

---

## UX Specification

### Screen Inventory

| Route | Screen Name | Access | Purpose |
|---|---|---|---|
| `/org/[id]/officer/roster` | Member Roster | Officers | Full member list with status, category, search, filter, bulk actions |
| `/org/[id]/officer/roster/[id]` | Member Detail | Officers | Individual member profile, dues history, engagement metrics |
| `/org/[id]/officer/applications` | Application Queue | Officers | Review pending membership applications |
| `/org/[id]/officer/roster/import` | Bulk CSV Import | Officers | Upload, validate, preview, and import members from CSV |
| `/org/[id]/members` | Member Directory | Members, Officers | Searchable member list (privacy-filtered for members) |

### Screen Details

#### `/org/[id]/officer/roster` -- Member Roster

**Layout:** Table with search bar, filter controls, and bulk action toolbar.

**Columns:**
| Column | Content | Sortable |
|---|---|---|
| Name | Full name (linked to detail page) | Yes |
| License # | Professional license number | Yes |
| Category | Membership category (Regular, Life, etc.) | Yes (filter) |
| Status | Computed status badge (Active=green, Grace=yellow, Lapsed=red, Suspended=gray, Pending=blue) | Yes (filter) |
| Dues Expiry | Date or "N/A" for Life members | Yes |
| Joined | Date member joined this org | Yes |

**Filters:**
- Status: All / Active / Grace / Lapsed / Suspended / Pending
- Category: All / [per-org categories]
- Search: name, email, license number

**Bulk Actions:**
- Send dues reminder (to selected members)
- Export selected to CSV
- Change category (for selected members)

**States:**
- **Empty:** "No members yet. Add members manually or import from CSV." with action buttons.
- **Loading:** Table skeleton with shimmer.
- **Filtered with No Results:** "No members match your filters."
- **Populated:** Full table with pagination (50 per page).

#### `/org/[id]/officer/roster/[id]` -- Member Detail

**Sections:**
1. **Profile Header:** Photo, name, license#, category badge, status badge.
2. **Contact Information:** Email, phone, address (visible to officers always).
3. **Membership Info:** Category, joined date, dues expiry, status history.
4. **Dues History:** Table of payments (date, amount, method, receipt link).
5. **Engagement:** Last login, events attended count, trainings attended count, engagement score.
6. **Actions:** Change category, record payment (links to M06), initiate transfer, disciplinary action (links to M04).

**States:**
- **Active Member:** Green status badge. Full details.
- **Grace Member:** Yellow badge. Warning: "Dues expired [date]. Grace period ends [date]."
- **Lapsed Member:** Red badge. CTA: "Record payment to reinstate."
- **Suspended:** Gray badge. Suspension reason shown. "Lift suspension" button.
- **Pending Verification:** Blue badge. "Resend claim email" button.

#### `/org/[id]/officer/applications` -- Application Queue

**Layout:** List of pending applications sorted by date (oldest first).

**Each Application Card:**
- Applicant name, email, license#, specialization
- Requested category
- Date applied
- Actions: Approve / Reject / Request More Info

**Bulk Actions:**
- Select multiple + "Approve Selected"

**States:**
- **Empty:** "No pending applications."
- **Loaded:** List of application cards.
- **After Approve:** Card removed from list. Success toast: "[Name] approved and added to roster."
- **After Reject:** Card removed. Toast: "[Name] rejected. Notification sent."

#### `/org/[id]/officer/roster/import` -- Bulk CSV Import

**Layout:** Multi-step wizard.

**Step 1: Upload**
- "Download Template" button (downloads CSV with headers and example row).
- File upload area (drag-and-drop or browse). Accepts .csv files only.
- "Upload and Validate" button.

**Step 2: Validation Preview**
- Summary bar: "N total rows | X valid (new) | Y already-linked | Z invalid"
- Three tabs:
  - **Valid Rows:** Table showing rows that will be imported.
  - **Already-Linked:** Table showing members that already exist on the platform, with match method (email/license#).
  - **Invalid Rows:** Table with row number, field, error message. "Download Invalid Rows" button.

**Step 3: Confirm**
- "Import X new members and link Y existing members?"
- "Confirm Import" button. Cancel returns to Step 1.

**Step 4: Results**
- Progress bar during import.
- Completion report: "X imported. Y linked. Z skipped."
- "View Roster" button.

**States:**
- **Invalid File:** "Invalid file format. Please upload a CSV file."
- **All Invalid:** "0 valid rows found. Please review errors and correct your CSV."
- **Processing:** Progress bar. Cannot navigate away (warning if attempted).
- **Complete:** Success summary with link to roster.

#### `/org/[id]/members` -- Member Directory

**Layout:** Search bar at top. Grid of member cards below.

**Member Card (member view):**
- Photo (if privacy allows) or initials placeholder
- Name
- Specialization
- Status badge (Active/Grace/Lapsed)

**Member Card (officer view):**
- All of the above + email, phone, category, dues expiry

**Search:** By name or license number. Results filter as user types (debounced 300ms).

**States:**
- **Empty:** "No active members in the directory."
- **No Results:** "No members found matching '[query]'."
- **Loading:** Card skeleton grid.
- **Populated:** Paginated grid. 20 members per page.

---

## Acceptance Criteria Patterns

- Cross-org matching never creates duplicate accounts for the same email or license number.
- Computed status returns the correct value for all edge cases: Life member (always Active), zero grace period (Active -> Lapsed with no Grace), suspended override (Suspended regardless of dues), Pending (new application not yet approved).
- Bulk import handles 500-row CSV files within 30 seconds.
- Renewal reminder payment link pre-fills amount and supports one-tap payment.
- Invalid CSV rows do not block valid rows from importing.
- Member directory respects privacy settings: hidden fields never shown to fellow members.
- Application deduplication prevents multiple pending applications from the same member to the same org.
- License number normalization correctly matches `PRC-RN-0056789` to `PRCRN56789` and `56789` to `0056789`.

---

## Data Entities

| Entity | Key Fields | Notes |
|---|---|---|
| **OrgMembership** | `id`, `org_id`, `member_id`, `category_id`, `dues_expiry_date`, `joined_at`, `status_override` (enum: null/pending/suspended/removed), `created_at`, `updated_at` | Core membership record. Status computed from `dues_expiry_date` + grace period + `status_override`. One record per member per org. |
| **MembershipCategory** | `id`, `org_id`, `name`, `description`, `dues_amount` (decimal), `billing_cycle` (enum: annual/quarterly/custom), `is_active` (boolean), `sort_order`, `created_at`, `updated_at` | Per-org categories. Cannot delete if members assigned (set `is_active = false` instead). |
| **MembershipApplication** | `id`, `org_id`, `applicant_name`, `applicant_email`, `applicant_license_number`, `specialization`, `requested_category_id`, `status` (enum: pending/approved/rejected/info_requested), `rejection_reason` (nullable), `reviewed_by` (nullable), `reviewed_at` (nullable), `created_at` | One pending application per person per org (M5-R5). |
| **MemberTransfer** | `id`, `source_org_id`, `destination_org_id`, `member_id`, `status` (enum: pending/approved/rejected), `requested_by`, `approved_by` (nullable), `approved_at` (nullable), `created_at` | Tracks inter-org transfers. Destination org must approve. |
| **BulkImportJob** | `id`, `org_id`, `uploaded_by`, `file_url`, `total_rows`, `valid_rows`, `invalid_rows`, `linked_rows`, `status` (enum: validating/previewing/importing/complete/failed), `error_report_url` (nullable), `created_at`, `completed_at` | Tracks CSV import lifecycle. Error report stored as downloadable CSV. |
| **MemberMatchConflict** | `id`, `org_id`, `import_job_id` (nullable), `email_match_member_id`, `license_match_member_id`, `source_email`, `source_license_number`, `resolved` (boolean), `resolved_by` (nullable), `resolution` (enum: null/link_email_match/link_license_match/create_new), `created_at` | Tracks ambiguous matches that require human resolution per BR-22. |
