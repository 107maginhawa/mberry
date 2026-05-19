# Module 4: Organization Admin

## Overview

| Attribute | Detail |
|---|---|
| **Purpose** | Officers manage their organization's profile, team, operational configuration, and public presence. This module provides the administrative backbone that all other org-scoped modules depend on. |
| **Phase** | 1 |
| **Monetization Tier** | Standard |
| **Dependencies** | M01 (Auth & Onboarding) |
| **Key Actors** | President, Officers (Secretary, Treasurer, Auditor, PRO, VP, Board Member, Custom Role), Platform Admin |

---

## Capabilities

| # | Capability | Description | User(s) | Priority |
|---|---|---|---|---|
| 4.1 | Org type designation | Each org has a type: chapter, society, national body, or clinic. Set at creation. Determines default behaviors (onboarding wizard flow, dashboard layout, content sharing defaults). Stored as enum. | Platform Admin, Officer | P0 |
| 4.2 | Org dashboard with smart action cards | Officer home screen: member count, collection rate, upcoming activities, recent announcements. Smart action cards surface actionable items with direct links (e.g., "12 members have unpaid dues -- Send reminder"). | Officer | P0 |
| 4.3 | Org profile management | Edit: org name, logo (upload + crop), description, contact info (email, phone, address), website URL, meeting schedule (text field), founding date, region/location. Visible on org public page and network directory. | Officer | P0 |
| 4.4 | Officer role management | President assigns officer roles to members. Roles: President, Vice President, Secretary, Treasurer, Auditor, PRO, Board Member, Custom Role. Each role carries specific permissions. Only ONE member per role at a time. President can remove/reassign roles. | President | P0 |
| 4.5 | Officer transition | When officers change (election, resignation), all organizational data persists. New officers get immediate access. Outgoing officers lose admin access but retain member profile. Checklist-based handover required before role reassignment. Transition logged in audit trail. | President, Platform Admin | P0 |
| 4.6 | Disciplinary actions | President can warn, suspend, or remove a member. All actions require a reason (mandatory, non-empty). All actions recorded in immutable audit log. Suspended members lose access to org features. Removed members lose org membership. | President | P0 |
| 4.7 | Org public page | Publicly visible URL (`/org/[slug]`) showing: org name, logo, description, officer list (name + role), upcoming shared activities, member count, founding date, and "Apply to Join" button. No login required. SEO-friendly. | Public Visitor, Member | P0 (Growth) |
| 4.8 | Invite a Chapter | Officer sends invitation to another chapter to join the platform. Includes social proof metrics. Invitation sent via email with signup link. | Officer | P0 (Growth) |
| 4.9 | Admin referral incentive | When an invited chapter signs up and completes onboarding, both orgs receive extended free trial (+30 days). Tracked per referral. Visible in org billing settings. | Officer, Platform Admin | P0 (Growth) |

---

## User Journeys

### CO-1: First-Time Signup and Chapter Setup

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Creates account (name, email, license#, password) | Validates license format, email uniqueness | Duplicate email: "Already registered. Log in?" |
| 2 | Verifies email | Verification link sent | Not received: resend option |
| 3 | If self-service: creates new org | Form: org name, type (chapter/society/national/clinic), association | |
| 3b | If invited: org is pre-selected | Skips org creation | |
| 4 | Org-type-aware setup wizard begins | Chapter: "Import members, set dues, connect payment." Society: "Create first training." National: "Configure credit requirements." | |
| 5 | Imports member list (CSV) or skips | Row-by-row validation preview | Invalid rows flagged |
| 6 | Sets dues amount and fund allocation | Configures amount per category, fund split percentages | |
| 7 | Connects payment gateway | Links PayMongo/Stripe account | Gateway fails: can skip, use manual payments |
| 8 | Dashboard appears | Smart action cards: members imported, collection rate, next steps | |

**Target: signup to first dues reminder in under 15 minutes.**

### CO-9: Officer Transition

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | President opens org admin > officers | Officers list with current roles | |
| 2 | Assigns new president role to a member | Confirmation dialog: "This will transfer presidency. You will become a regular member." | |
| 3 | Confirms transfer | Roles updated. New president gets admin access. Old president becomes regular member. All data persists. | Accidental: new president can reverse within 24 hours |

### CO-10: Edit Org Settings

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens org admin > profile | Settings organized by category | |
| 2 | Edits org profile fields | Name, logo, description, contact info, address, founding date | SVG logo: sanitization applied |
| 3 | Saves | Changes take effect immediately. Visible on public page. | |

### CO-11: Invite Another Chapter

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens "Invite a Chapter" from dashboard | Invite form | |
| 2 | Enters contact's name and email | Validates email format | |
| 3 | Sends invite | Email with social proof: "[Org] has [N] members and [X]% collection rate on Memberry. Start your free trial." | Email bounce: logged |
| 4 | Invited officer signs up | Both orgs get extended free trial (if referral incentive enabled) | |

### CP-1: First Value Moment (President)

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Sees first dashboard with imported members, collection rate, action cards | "Send dues reminder to N members" card appears | CSV import failed: empty dashboard with re-import prompt |

### CP-2: Annual Elections Management

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Creates Election/Governance event | Configures nominees and positions | |
| 2 | Records election results | Officer roles updated based on results | Tied election. Contested results. |
| **Related** | Triggers officer transition (CO-9). All members notified. | | |

### CP-3: Annual Membership Roster Review

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Reviews members lapsed >12 months, never logged in | Report with bulk action: archive or remove | Archived member tries to log in: recovery path |
| **Related** | Archived members receive notification | | |

### CP-4: Communication with Platform Admin

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Submits support ticket or feature request | Message routed to platform admin | No response within SLA: escalation |

### CP-5: Financial Report Review

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Reviews treasurer's financial reports | Report viewer with annotation capability. Can flag entries. | Discrepancy found |
| **Related** | Treasurer notified of flagged entries | | |

### CP-6: Member Suspension (Disciplinary)

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens org admin > discipline | Discipline action form | |
| 2 | Selects member and action (warn, suspend, remove) | Reason field required (mandatory, non-empty) | Empty reason: blocked |
| 3 | Confirms action | Status updated. Member notified with reason. Action logged in audit trail. | Suspended member disputes |
| **Related** | Member notified. Secretary logs record. | | |

### CP-7: End-of-Term Transition

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Initiates full transition checklist | System generates checklist: pending applications, outstanding payments, upcoming events, open issues | Outgoing president does not complete |
| 2 | Outgoing officer completes each checklist item | Items marked complete with notes. System tracks completion percentage. | Items left incomplete: warning to new officer |
| 3 | New president accepts handover | All access transferred. Audit trail recorded. Old president loses admin access. | |
| **Related** | All officers affected. Members notified of new leadership. | | |

### CO-12: View Engagement Analytics

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens "Engagement" from sidebar | Engagement dashboard | |
| 2 | Views at-risk members | List: dues expiring soon + low login frequency + low event attendance | No at-risk members: "All members are engaged!" |
| 3 | Views never-logged-in members | Imported members who haven't claimed their account | |
| 4 | Takes action | Send reminder to specific members or groups | |

### CO-13: View Org Benchmarking

| Stage | User Action | System Response | Error Path |
|---|---|---|---|
| 1 | Opens "Benchmarking" from sidebar | Anonymized comparison dashboard | Fewer than 3 chapters: "Benchmarking requires 3+ chapters" |
| 2 | Views metrics | Collection rate vs average, event attendance vs average, member growth vs average | |
| 3 | Sees relative position | "Your collection rate is 72%. Average across 12 chapters is 85%." | |

---

## Business Rules

| Rule ID | Name | Relevance to This Module |
|---|---|---|
| BR-09 | Officer Role Assignment | One officer per role per org; role assignment triggers outbound notification to new officer |
| BR-29 | Org Public Page | Every org has a public-facing profile page at `/org/[slug]` with configurable visibility fields |
| BR-31 | SVG Upload Security | Logo upload: SVG accepted for org logos only. Max 5 MB. File type validated by magic bytes, not extension. SVG must be sanitized to prevent XSS. |

### Module-Specific Rules

**M4-R1: One Officer Per Role**
Each officer role (President, Vice President, Secretary, Treasurer, Auditor, PRO) can be held by exactly one member at a time. Board Member is the exception -- multiple members may hold this role. Custom roles follow the same one-per-role constraint unless explicitly configured otherwise.

**M4-R2: President-Only Role Assignment**
Only the current President may assign or remove officer roles. Platform Admin may intervene if no President is assigned (e.g., initial provisioning or president account lockout).

**M4-R3: Transition Checklist Required**
When an officer role is being reassigned, the outgoing officer must complete a handover checklist before the role transfer is finalized. Checklist items are role-specific:
- **President:** Pending applications, outstanding issues, upcoming governance events
- **Treasurer:** Outstanding payments, unreconciled transactions, gateway access status
- **Secretary:** Pending roster updates, upcoming communications, active event registrations

If the outgoing officer is unavailable (e.g., resigned without notice), the President (or Platform Admin) may override the checklist requirement with a documented reason logged in the audit trail.

**M4-R4: Disciplinary Action Constraints**
- **Warn:** Informational. No access change. Recorded in audit log. Member notified.
- **Suspend:** Member loses access to org features (cannot register for events, pay dues, view directory). Retains login and access to other orgs. Computed status overridden to `Suspended`.
- **Remove:** Org membership terminated. Member retains platform account and other org memberships. Historical records preserved (view-only for officers).
- All actions require a non-empty reason field.
- All actions generate an immutable audit log entry.
- Suspend and Remove generate a notification to the member with the reason.

**M4-R5: SVG Sanitization**
Organization logos in SVG format must be sanitized on upload to remove all script elements, event handlers, external references, and embedded data URIs (except image data URIs). Sanitization must strip: `<script>`, `on*` attributes, `<foreignObject>`, `<use>` with external hrefs, and CSS `url()` pointing to external resources.

**M4-R6: Immutable Audit Trail**
All officer role changes, disciplinary actions, profile edits, and transitions are logged with actor, timestamp, before/after state, and IP. Audit log entries are never modified or deleted after creation.

**M4-R7: Independent Org-Membership Context**
Officer roles exist only within their org. Assigning a role in one org does not affect any other org. Each org-membership context is fully isolated.

---

## UX Specification

### Screen Inventory

| Route | Screen Name | Access | Purpose |
|---|---|---|---|
| `/org/[id]/officer/dashboard` | Org Dashboard | All Officers | Smart action cards, key metrics, quick actions |
| `/org/[id]/officer/settings/org` | Org Profile | All Officers | Edit org name, logo, description, contact, address, founding date |
| `/org/[id]/officer/officers` | Officer Management | President | Assign/remove roles, view current officers |
| `/org/[id]/officer/officers` | Officer Transition | President | Handover checklist, role transfer workflow |
| `/org/[id]/officer/roster/[id]` | Disciplinary Actions | President | Warn, suspend, remove members with reason |
| `/org/[slug]` | Org Public Page | Public (no auth) | Org profile, officers, activities, Apply to Join |

### Screen Details

#### `/org/[id]/officer/dashboard` -- Org Dashboard

**Layout:** Sidebar navigation (desktop) or hamburger menu (mobile). Main content area with smart action cards in a responsive grid.

**Smart Action Cards:**
- "N members have unpaid dues -- Send reminder" (links to dues reminder flow)
- "N membership applications pending -- Review now" (links to /org/[id]/officer/applications)
- "Annual election due in N days -- Schedule event" (links to event creation)
- "N members lapsing this month -- View list" (links to filtered roster)
- "Officer transition incomplete -- Resume checklist" (links to /org/[id]/officer/officers)

**Key Metrics (always visible):**
- Total members (Active / Grace / Lapsed)
- Collection rate (paid / total for current period)
- Upcoming activities (next 30 days)

**States:**
- **Empty:** New org with no data. Show onboarding wizard prompt.
- **Loading:** Skeleton cards with shimmer animation.
- **Populated:** Cards with real data and action links.
- **Error:** "Unable to load dashboard. Retry." with retry button.

#### `/org/[id]/officer/settings/org` -- Org Profile

**Fields:**
| Field | Type | Required | Constraints |
|---|---|---|---|
| Org Name | Text input | Yes | 2-100 characters |
| Org Type | Read-only display | -- | Set at creation, not editable |
| Description | Textarea | No | Max 2,000 characters |
| Logo | Image upload | No | SVG (sanitized per M4-R5), JPEG, PNG, WebP. Max 5 MB. |
| Contact Email | Email input | No | Standard email validation |
| Contact Phone | Phone input | No | E.164 format or local format |
| Address | Structured address (street, city, province, country, postal) | No | |
| Website URL | URL input | No | Must include protocol (https://) |
| Meeting Schedule | Text input | No | Free text. E.g., "Every 2nd Tuesday, 7PM" |
| Founding Date | Date picker | No | Must not be in the future |

**States:**
- **View:** Read-only display of all fields with "Edit" button.
- **Edit:** Form fields become editable. "Save" and "Cancel" buttons appear.
- **Saving:** "Save" button shows spinner. Fields disabled.
- **Saved:** Success toast: "Profile updated." Return to view state.
- **Validation Error:** Inline errors below each invalid field. Form not submitted.

#### `/org/[id]/officer/officers` -- Officer Management

**Layout:** Table/list of current officers. Each row: member name, role, date assigned.

**Actions (President only):**
- "Assign Role" button opens a modal: search member by name, select role from dropdown. If role is already assigned, warning: "This role is currently held by [Name]. Assigning will remove their role."
- "Remove Role" button on each officer row. Confirmation dialog required.
- "Initiate Transition" button links to `/org/[id]/officer/officers`.

**States:**
- **No Officers:** "No officers assigned yet. Assign your first officer." (Only President role is always filled.)
- **Full Roster:** All standard roles filled. Custom role option available.
- **Transition In Progress:** Banner at top: "Officer transition in progress. [X] of [Y] checklist items complete."

#### `/org/[id]/officer/officers` -- Officer Transition

**Layout:** Stepper/checklist interface.

**Step 1: Generate Checklist**
- System auto-generates role-specific checklist items based on current state.
- President sees: pending applications count, outstanding payments count, upcoming events, open issues.
- Treasurer sees: unreconciled transactions, gateway access handover, pending refunds.
- Secretary sees: pending roster updates, draft communications, active registrations.

**Step 2: Complete Items**
- Each item can be marked "Complete" with optional notes.
- Items cannot be un-completed once marked.
- Progress bar shows completion percentage.

**Step 3: Transfer Role**
- Once checklist is 100% complete (or overridden by President with reason), role can be transferred.
- Confirmation dialog: "Transfer [Role] from [Current] to [New]. This action is logged."

**States:**
- **Not Started:** Checklist generated but no items completed.
- **In Progress:** Some items completed. Progress bar partially filled.
- **Ready to Transfer:** All items complete. "Transfer Role" button enabled.
- **Override Required:** Items incomplete but President chooses to proceed. Reason field appears.
- **Complete:** Role transferred. Audit log entry created. Success message shown.

#### `/org/[id]/officer/roster/[id]` -- Disciplinary Actions

**Layout:** Two sections: "Take Action" form and "Action History" table.

**Take Action Form:**
| Field | Type | Required |
|---|---|---|
| Member | Search/select (name or license#) | Yes |
| Action | Radio: Warn / Suspend / Remove | Yes |
| Reason | Textarea | Yes (non-empty) |

**Confirmation Dialog (after form submission):**
- Warn: "This will record a warning for [Name]. They will be notified."
- Suspend: "This will suspend [Name] from [Org]. They will lose access to org features. They will be notified with your reason."
- Remove: "This will remove [Name] from [Org]. Their membership will be terminated. Historical records preserved. They will be notified with your reason."

**Action History Table:**
| Column | Content |
|---|---|
| Date | Timestamp of action |
| Member | Member name |
| Action | Warn / Suspend / Remove |
| Reason | Full reason text |
| Performed By | Officer name |

**States:**
- **Empty History:** "No disciplinary actions recorded."
- **Submission Success:** Toast: "Action recorded. [Member] has been notified."
- **Validation Error:** "Reason is required." if reason field is empty.

#### `/org/[slug]` -- Org Public Page

**Layout:** Single-page, publicly accessible. No authentication required.

**Sections:**
1. **Header:** Org logo (or placeholder), org name, org type badge (Chapter / Society / National / Clinic), founding date.
2. **About:** Description text.
3. **Contact:** Email, phone, address, website link, meeting schedule.
4. **Officers:** List of current officers (name + role). No contact info exposed publicly.
5. **Recent Activities:** Up to 5 upcoming network-wide activities (events/trainings marked as shared).
6. **Stats:** Member count (active members only).
7. **CTA:** "Apply to Join" button. If visitor is logged in, submits application directly. If not logged in, redirects to registration with org pre-selected.

**States:**
- **Org Not Found:** 404 page: "Organization not found."
- **Org Suspended:** Page shows: "This organization is currently inactive."
- **No Activities:** Activities section hidden.
- **No Logo:** Placeholder icon with org initials.

---

## Acceptance Criteria Patterns

- Smart action cards update as underlying data changes (no stale cards after member pays dues).
- Officer transition creates an audit log entry with old officer, new officer, role, and timestamp.
- Fund allocation percentages are enforced to total exactly 100% (enforced in M06, configured here).
- Logo SVG sanitization strips all script elements before storage.
- Org public page loads in under 2 seconds for unauthenticated visitors.
- Disciplinary actions cannot be submitted without a non-empty reason.
- Only the President can assign or remove officer roles (API returns 403 for other roles).
- Officer role assignment enforces one-per-role constraint (except Board Member).
- Transition checklist items are role-specific and auto-generated from current org state.

---

## Data Entities

| Entity | Key Fields | Notes |
|---|---|---|
| **Organization** | `id`, `association_id`, `name`, `slug`, `type` (enum: chapter/society/national/clinic), `description`, `logo_url`, `contact_email`, `contact_phone`, `address` (JSON), `website_url`, `meeting_schedule`, `founding_date`, `created_at`, `updated_at` | Core org record. Slug used for public page URL. |
| **OrgMembership** | `id`, `org_id`, `member_id`, `category_id`, `dues_expiry_date`, `joined_at`, `status_override` (enum: null/suspended/removed), `created_at`, `updated_at` | Links member to org. Status computed from `dues_expiry_date` + grace period unless `status_override` is set. |
| **OfficerRole** | `id`, `org_id`, `member_id`, `role` (enum: president/vp/secretary/treasurer/auditor/pro/board_member/custom), `custom_role_name` (nullable), `assigned_at`, `assigned_by`, `removed_at`, `removed_by` | One active record per role per org (except board_member). Soft-deleted on removal. |
| **OfficerTransition** | `id`, `org_id`, `role`, `outgoing_member_id`, `incoming_member_id`, `checklist` (JSON array of items with status), `override_reason` (nullable), `completed_at`, `created_at` | Tracks handover process. Checklist items are role-specific. |
| **DisciplinaryAction** | `id`, `org_id`, `member_id`, `action_type` (enum: warn/suspend/remove), `reason`, `performed_by`, `created_at` | Immutable. Never deleted or modified. |
| **AuditLogEntry** | `id`, `org_id`, `actor_id`, `actor_role`, `action_type`, `entity_type`, `entity_id`, `before_state` (JSON), `after_state` (JSON), `ip_address`, `created_at` | Immutable per M4-R6. Covers all significant actions in this module. |
