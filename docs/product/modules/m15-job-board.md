# Module 15: Job Board

**Version:** 3.0
**Updated:** 2026-04-21
**Phase:** 2 -- Professional Identity Platform
**Monetization Tier:** Standard
**Status:** Draft

---

## 1. Overview

### Purpose

Job Board gives healthcare professionals a dedicated, association-verified marketplace for healthcare employment opportunities. It connects active members with job postings from verified healthcare employers -- clinics, hospitals, and practices -- without the noise and fragmentation of generic job platforms or informal Viber and Facebook group postings.

### Why This Module Exists

Healthcare job postings in the Philippines are scattered across Viber groups, Facebook pages, word-of-mouth referrals, and generic job boards (JobStreet, LinkedIn) where healthcare roles compete with every other industry. A dentist looking for a part-time relief position, or a nurse seeking a locum contract, has no single place to find verified, healthcare-specific opportunities matched to their specialty and location.

Memberry already has a verified base of active healthcare professionals with known specialties, locations, and membership standing. Healthcare organizations already on the platform -- clinics, specialty societies, practice groups -- need to hire from exactly this pool. The Job Board leverages the existing identity layer to make connections that are already happening informally through the platform's officer network into something structured, searchable, and professionally credible.

### Dependencies

| Module | Relationship |
|--------|-------------|
| **M05: Membership** | Membership status determines who can view and who can post job listings. The association-wide job board is visible to all active members of the association. |

---

## 2. Capabilities

| # | Capability | Description | User(s) | Priority |
|---|-----------|-------------|---------|----------|
| 15.1 | Job listing fields | Each job posting includes: job title, organization or clinic name, location (city and province), employment type (full-time, part-time, locum/relief, contract), specialty requirements, job description, application instructions, contact email or application URL, and expiry date (default 30 days per BR-37). | Officer, External Employer | P1 |
| 15.2 | Officer posting | Officers (Secretary or President) of any organization on the platform can post job listings on behalf of their org. Postings are auto-published -- no admin approval required for verified platform organizations. | Officer (Secretary or President) | P1 |
| 15.3 | External employer posting | Verified external employers (clinics, hospitals, and other healthcare organizations not already on the platform) can apply to post jobs. External employer accounts require platform admin approval before they can publish listings. Once approved, postings require per-listing admin review before publication (BR-37). | External Employer, Platform Admin | P2 |
| 15.4 | Network-wide visibility | The job board is association-wide. A member of PDA sees all job postings across all PDA chapters and all approved external employers targeting PDA's network. The board is not siloed by chapter. | Member (Active) | P1 |
| 15.5 | Browse and filter | Members browse job listings filtered by: specialty, location (province and city), employment type. Results are sorted by most recent by default. | Member (Active) | P1 |
| 15.6 | Save listings | Members can save individual job listings to a personal saved list for later reference. Saved listings are accessible from the member's profile area. | Member (Active) | P2 |
| 15.7 | Job alerts | Members configure alert preferences (specialty, location, employment type). When a new listing matches their preferences, they receive a notification (push and/or email per their notification settings). | Member (Active) | P2 |
| 15.8 | Officer listing management | Officers view all job listings posted by their org, see each listing's status (active, expired, closed early), extend or close listings early, and repost expired listings. | Officer (Secretary or President) | P1 |
| 15.9 | Job expiry and extension | Job postings expire after 30 days by default, configurable by the officer at posting time. Officers receive a 3-day reminder before expiry. One-click extension adds 30 more days to the expiry date (BR-37). Expired listings are no longer visible to members but remain in the officer's management view. | System, Officer | P1 |
| 15.10 | Application via contact | The platform does not manage the application process. Each listing includes either a contact email address or an application URL provided by the employer. Interested members apply directly via those channels. | Member (Active) | P1 |
| 15.11 | Platform moderation | Platform admin can remove any listing from the board for policy violations. External employer listings require per-listing admin approval before publication. | Platform Admin | P1 |

---

## 3. User Journeys

### Journey 15A: Member Browses and Saves a Job Listing

**Persona:** Dr. Garcia (Active Member, dentist, PDA Metro Manila)
**Trigger:** Looking for a part-time relief position.

1. Dr. Garcia navigates to `/org/[id]/jobs` from the sidebar.
2. Sees the association-wide job board. Sets filters: Specialty = "General Dentistry", Employment Type = "Part-time / Locum", Location = "Metro Manila."
3. Results show 6 matching listings. Each card shows: job title, organization name, location, employment type, and days remaining before expiry.
4. Taps "Part-Time Relief Dentist -- Smile Dental Clinic."
5. Navigates to `/org/[id]/jobs/[id]` -- sees the full listing: description, schedule preference (MWF mornings), requirements (PRC licensed, 3+ years experience), application instructions ("Email CV and PRC ID to hr@smileclinic.ph"), and the listing's expiry date.
6. Taps "Save" to add the listing to her saved list.
7. Later that week, Dr. Garcia visits `/my/saved-jobs` and reviews all her saved listings to decide which to apply to.
8. Taps "Apply" on Smile Dental Clinic's listing -- her email client opens pre-addressed to hr@smileclinic.ph.

### Journey 15B: Officer Posts a Job Listing

**Persona:** Dr. Reyes (Chapter Secretary, PDA Quezon City)
**Trigger:** Dr. Reyes's clinic needs to hire an associate dentist.

1. Dr. Reyes navigates to `/org/[id]/officer/jobs` -- the officer job management view.
2. Taps "Post a Job" -- navigates to `/org/[id]/officer/jobs/new`.
3. Fills in the posting form:
   - Job title: "Associate Dentist -- Full Time"
   - Organization name: "Reyes Dental Clinic" (pre-filled from org profile, editable)
   - Location: Quezon City, Metro Manila
   - Employment type: Full-time
   - Specialty requirement: General Dentistry
   - Description: practice details, patient volume, working hours, team culture
   - Application instructions: "Email your CV and PRC license copy to reyes.dental@gmail.com"
   - Application URL: (left blank -- using email instead)
   - Expiry date: default 30 days (May 21, 2026)
4. Taps "Post." The listing is auto-published immediately (verified org, no admin review required).
5. The listing appears on the association-wide job board. Members browsing by specialty or location in Metro Manila can find it.

### Journey 15C: Officer Manages Listings and Extends Expiry

**Persona:** Dr. Reyes (Chapter Secretary, PDA Quezon City)
**Trigger:** Receives a 3-day expiry reminder notification.

1. Dr. Reyes receives a push notification: "Your job listing 'Associate Dentist -- Full Time' expires in 3 days."
2. Navigates to `/org/[id]/officer/jobs` -- sees the listing with status "Expiring soon" and a countdown.
3. Taps the listing -- navigates to `/org/[id]/officer/jobs/[id]`.
4. The position is not yet filled. Taps "Extend 30 Days."
5. The expiry date is updated to 30 days from today. The listing remains live on the board.
6. Two weeks later, Dr. Reyes hires a candidate. Returns to the listing management screen and taps "Close Listing." The listing is removed from the member-facing job board immediately. Status in the officer view updates to "Closed Early."

### Journey 15D: Member Sets Up a Job Alert

**Persona:** Dr. Cruz (Active Member, nurse, PNA Visayas)
**Trigger:** Not actively searching but wants to be notified of matching opportunities.

1. Dr. Cruz visits `/org/[id]/jobs` and sees no listings matching her criteria right now.
2. Taps "Create Alert."
3. Sets preferences: Specialty = "Nursing", Employment Type = "Full-time, Part-time", Location = "Cebu City."
4. Saves the alert.
5. Two weeks later, a hospital in Cebu posts a full-time nursing position. Dr. Cruz receives a push notification: "New job matching your alert: Staff Nurse -- Cebu General Hospital." Taps the notification and navigates directly to the listing detail.

### Journey 15E: External Employer Applies to Post

**Persona:** HR Manager, Cebu General Hospital (not on the Memberry platform)
**Trigger:** The hospital wants to reach verified nurses on the PNA network.

1. The HR manager finds the Memberry employer registration page and submits a request: company name, type (hospital), Philippine business registration number, contact name, email, and phone.
2. The request lands in the platform admin queue.
3. Platform admin reviews the business registration, verifies it is a legitimate healthcare organization, and approves the account.
4. The HR manager receives an email with login credentials and instructions.
5. Logs in and navigates to the job posting form. Creates a listing for "Staff Nurse -- Full Time, Cebu City."
6. Submits the listing. Because this is an external employer, the listing enters "Pending Review" status.
7. Platform admin reviews the listing, confirms it is a genuine healthcare job, and approves it for publication.
8. The listing appears on the PNA job board. PNA members browsing by nursing specialty and Cebu City location can find it.

---

## 4. Business Rules

### BR-37: Job Posting Expiry, Reminders, and Extension

- **Rule:** Job postings expire after 30 days from the date of publication. The default 30-day period is set at posting time and is displayed to the officer in the posting form. Officers may set a shorter expiry period (minimum 7 days) but may not set a longer initial period -- the 30-day default is the maximum initial term. Three days before expiry, the posting officer (Secretary or President of the org) receives a reminder notification (push and email) that the listing is about to expire. Officers can extend the listing for one additional 30-day period with a single tap. Listings may be extended any number of times. Expired listings are automatically removed from the member-facing job board and are no longer returned in search results. Expired listings remain visible in the officer's listing management view with status "Expired" and a "Repost" option that creates a new listing (resetting the expiry clock to 30 days from today). External employer listings follow the same expiry rules but reminders are sent to the contact email address on file for that employer account.
- **Category:** Constraint / Operational
- **Why this matters:** Stale job listings erode member trust in the job board. If a member applies to a position that was filled weeks ago, they waste their time and lose confidence in the platform. Automated expiry ensures the board only shows current opportunities. The 3-day reminder and one-click extension prevent officers from losing active listings to expiry through inattention -- the system nudges them to take action without forcing a full repost workflow for positions that are still open.
- **Examples:**
  1. Dr. Reyes posts a listing on April 21, 2026. The listing expires on May 21, 2026. On May 18, Dr. Reyes receives a reminder. She taps "Extend 30 Days" -- the listing now expires on June 17, 2026.
  2. Dr. Santos posts a listing with a custom 14-day expiry for a locum position that is needed by a specific date. The listing expires on May 5, 2026. No extension is needed -- the position was for a specific date that has passed.
  3. An expired listing from February is visible to Dr. Reyes in her management dashboard with status "Expired." She taps "Repost." A new listing is created, identical in content, with a new expiry date of 30 days from today. The old listing record is retained for audit purposes but is not visible to members.
  4. An external employer's listing expires while the employer is unresponsive. The listing is removed automatically from the board. The platform admin does not need to take action -- expiry is handled by the system.
- **Impact if wrong:** Members apply to filled positions (trust erosion). Boards become cluttered with stale listings. Officers receive no warning and lose active listings unexpectedly.
- **Approval:** [ ] Stakeholder sign-off

---

## 5. UX Specification

### Screen Inventory

| Screen | Route | Persona | Device |
|--------|-------|---------|--------|
| Job Board (Member View) | `/org/[id]/jobs` | Member (Active) | Mobile-first, both |
| Job Listing Detail | `/org/[id]/jobs/[id]` | Member (Active) | Both |
| Saved Jobs | `/my/saved-jobs` | Member (Active) | Both |
| Officer Job Management | `/org/[id]/officer/jobs` | Officer (Secretary, President) | Both |
| Create Job Posting | `/org/[id]/officer/jobs/new` | Officer (Secretary, President) | Desktop primary, both |
| Manage Job Posting | `/org/[id]/officer/jobs/[id]` | Officer (Secretary, President) | Both |

### Screen Details

#### Job Board -- Member View (`/org/[id]/jobs`)

**Layout:** Filter bar at top, card list below. Infinite scroll.

**Filter bar:**
- Specialty dropdown (multi-select, populated from platform specialty list).
- Employment type: chips for All, Full-time, Part-time, Locum/Relief, Contract.
- Location: province dropdown, then city dropdown (cascading, optional).
- Sort: "Most Recent" (default) | "Expiring Soon."

**Content per card:**
- Job title (bold).
- Organization/clinic name.
- Location (city, province).
- Employment type badge (colored chip).
- Specialty requirement.
- "X days remaining" expiry indicator. Amber text if fewer than 7 days remaining.
- Save icon (bookmark): tapping saves the listing to `/my/saved-jobs`.

**Actions:**
- Tap card body: navigate to job listing detail.
- Tap save icon: toggle saved state (immediately, no confirmation needed).
- "Create Alert" button visible at top if member has no alerts configured.

**Empty state (filters applied, no results):** "No listings match your filters. Try adjusting your specialty or location, or create an alert to be notified when matching positions are posted."

**Empty state (no listings at all):** "No job postings yet. Check back soon -- new opportunities are added regularly."

#### Job Listing Detail (`/org/[id]/jobs/[id]`)

**Layout:** Single-column, full-page view.

**Header:**
- Job title (large heading).
- Organization/clinic name + location.
- Employment type badge + specialty requirement.
- Posted date and expiry date ("Posted Apr 21 -- Closes May 21").

**Body sections:**
- Job Description (full text, preserving officer's formatting: paragraphs and bullet points).
- Requirements (if provided separately from description).
- How to Apply: the application instructions field displayed in full. If a contact email is provided, it renders as a mailto link. If an application URL is provided, it renders as a button labeled "Apply Now" linking to the external URL. Both may be present.

**Save button:** Bookmark icon in the header. Active/saved state toggles visually.

**Note:** The platform does not collect or process applications. Clicking "Apply Now" or the mailto link opens the member's email client or navigates to the employer's external page. There is no in-platform application form, no application tracking, and no data shared with the employer through the platform.

#### Saved Jobs (`/my/saved-jobs`)

**Layout:** Card list, sorted by saved date (most recently saved first).

**Content per card:**
- Same fields as the job board card.
- "Closed" or "Expired" badge overlaid on cards where the listing is no longer active.
- Unsave button (trash/remove icon).

**Actions:**
- Tap card: navigate to listing detail.
- Tap unsave: remove from saved list (immediate, with toast "Removed from saved jobs" + 5-second "Undo" option).

**Empty state:** "No saved jobs yet. Browse the job board and tap the bookmark icon to save listings for later."

#### Officer Job Management (`/org/[id]/officer/jobs`)

**Layout:** Table or card list (table on desktop, card list on mobile). Sorted by most recent first.

**Columns (desktop) / Card fields (mobile):**
- Job title.
- Employment type.
- Location.
- Status badge: Active (green), Expiring Soon (amber, <7 days), Expired (gray), Closed Early (gray), Pending Review (blue, for external employer postings).
- Posted date.
- Expiry date.
- Actions: "Manage" link to the individual listing management screen.

**Header actions:**
- "Post a Job" button (navigates to create form).

**Filters:** Status dropdown (All, Active, Expiring Soon, Expired, Closed Early).

#### Create Job Posting (`/org/[id]/officer/jobs/new`)

**Layout:** Single-column form.

**Fields:**
- Job title (text input, required).
- Organization or clinic name (text input, pre-filled with org name, editable if the listing is for an affiliated clinic rather than the org itself).
- Location: Province dropdown + City text input (both required).
- Employment type (radio: Full-time, Part-time, Locum/Relief, Contract; required).
- Specialty requirement (dropdown, multi-select if multiple specialties are acceptable; required).
- Job description (textarea, rich text: bold, bullets, paragraphs; required, max 3,000 characters).
- Application instructions (textarea, plain text; required. Prompt: "Describe how candidates should apply. Include what to send and where.").
- Contact email (text input, optional if application URL provided).
- Application URL (text input, optional if contact email provided. Validated as a URL.).
- Expiry date (date picker, default 30 days from today, minimum today + 7 days, maximum today + 30 days).

**Validation:**
- At least one of contact email or application URL must be provided.
- Job description required.
- Application instructions required.
- Expiry date must be between 7 and 30 days from today.

**Actions:**
- "Post Job" (primary): publishes immediately for verified platform orgs. Submits for review for external employer accounts.
- "Save as Draft" (secondary): saves without publishing. Draft is accessible from the officer management list.
- "Cancel" (tertiary, with unsaved changes confirmation).

**Post-submission state:**
- For verified orgs: "Your listing is live. It will appear on the job board immediately."
- For external employers: "Your listing has been submitted for review. It will appear on the job board after platform admin approval."

#### Manage Job Posting (`/org/[id]/officer/jobs/[id]`)

**Layout:** Single-column, detail and action view.

**Content:**
- Preview of the listing as members see it (read-only).
- Status, posted date, expiry date, days remaining.

**Actions (context-sensitive):**
- "Edit Listing" (active listings only): reopens the create form pre-populated. Edit republishes immediately for verified orgs or re-enters review for external employers.
- "Extend 30 Days" (shown only within 7 days of expiry, or when status is "Expiring Soon"): adds 30 days to the expiry date. Confirmation: "Listing extended to [new date]."
- "Close Listing Early": removes the listing from the board immediately. Confirmation dialog: "This listing will be removed from the job board immediately and members will no longer see it. This cannot be undone. Close listing?" Confirm button: "Yes, Close Listing."
- "Repost" (expired and closed listings only): opens the create form pre-populated with the previous listing's content. Creates a new listing; does not restore the old one.

### States

| State | Trigger | UI Behavior |
|-------|---------|-------------|
| **Loading** | Screen opens | Skeleton cards while listings load. |
| **No listings** | No active postings for the association | Empty state with prompt to check back or create an alert. |
| **No results (filtered)** | Active filters return no matches | Empty state with prompt to adjust filters or create an alert. |
| **Listing saved** | Member taps bookmark | Bookmark icon fills (solid). Toast: "Saved to your job list." |
| **Listing unsaved** | Member taps filled bookmark | Bookmark icon empties. Toast: "Removed from your job list" with 5-second Undo. |
| **Listing expired** | Listing's expiry date passes | Listing removed from member-facing board automatically. Status in officer view updates to "Expired." |
| **Expiring soon reminder** | 3 days before expiry | Officer receives push and email notification. Listing shows "Expiring Soon" badge in officer management view. |
| **Extended** | Officer taps "Extend 30 Days" | Expiry date updates. Toast: "Listing extended to [new date]." Badge returns to "Active." |
| **Closed early** | Officer confirms close | Listing immediately removed from board. Status in officer view: "Closed Early" with closure date. |
| **Pending review** | External employer submits listing | Listing visible in officer management view with "Pending Review" status. Not visible to members until approved. |

---

## 6. Acceptance Criteria Patterns

- All active members of the association can view the association-wide job board, regardless of which specific chapter they belong to.
- Only officers with the role of Secretary or President can access the job posting creation form.
- Job postings from verified platform organizations are published immediately upon officer submission.
- External employer listings require platform admin approval before appearing on the member-facing board.
- Job listings expire automatically at 11:59 PM on the expiry date. Expired listings are removed from search results and the member-facing board within 5 minutes of expiry.
- Officers receive reminder notifications exactly 3 days before a listing's expiry, via push notification and email.
- One-click extension from the officer management screen or from within the reminder notification extends the expiry by exactly 30 days from the current date.
- Listings closed early are removed from the member-facing board within 5 minutes of the officer's close action.
- Members can save and unsave listings; the saved state persists across sessions.
- Job alert notifications are delivered within 1 hour of a matching listing being published.
- The job board search and filter returns results within 2 seconds for associations with up to 500 active listings.
- At least one of contact email or application URL is required on every listing. Listings without either fail validation at submission time.

---

## 7. Data Entities

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| **Job Listing** | `id`, `org_id` (nullable for external employer postings), `external_employer_id` (nullable for platform org postings), `association_id`, `title`, `organization_display_name`, `location_province`, `location_city`, `employment_type` (full_time/part_time/locum_relief/contract), `specialty_requirements` (array), `description`, `application_instructions`, `contact_email` (nullable), `application_url` (nullable), `status` (draft/pending_review/active/expiring_soon/expired/closed_early), `published_at`, `expires_at`, `closed_at` (nullable), `created_by`, `created_at`, `updated_at` | Either `org_id` or `external_employer_id` is set, not both. `expires_at` is set to `published_at` + 30 days by default. |
| **External Employer** | `id`, `company_name`, `company_type` (hospital/clinic/practice/pharma/device/other), `business_registration_number`, `contact_name`, `contact_email`, `contact_phone`, `association_id`, `verification_status` (pending/approved/rejected), `verified_by`, `verified_at`, `created_at` | Non-platform organizations that apply to post jobs. Requires platform admin approval. Linked to one association's job board. |
| **Saved Job** | `id`, `member_id`, `job_listing_id`, `saved_at` | Records which members have saved which listings. Unique constraint on `(member_id, job_listing_id)`. Retained after listing expiry so members can see what they previously saved. |
| **Job Alert** | `id`, `member_id`, `association_id`, `specialty_filters` (array), `employment_type_filters` (array), `location_province` (nullable), `location_city` (nullable), `notification_preference` (push_and_email/push_only/email_only), `is_active`, `created_at`, `updated_at` | Member-configured alert. Matching runs on new listing publication. |
| **Expiry Reminder Log** | `id`, `job_listing_id`, `reminded_at`, `recipient_member_id`, `channel` (push/email) | Records which reminders have been sent. Prevents duplicate reminders if the notification job runs more than once. |

---

*Module 15: Job Board -- Memberry v3*
