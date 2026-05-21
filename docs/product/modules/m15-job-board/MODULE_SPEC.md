# Module Specification: Job Board (M15)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose

Healthcare professional job board within the association network. Officers and verified external employers post job listings; members browse, save, and apply. Listings auto-expire at 30 days with 7-day warning. Supports full-time, part-time, contract, fellowship, and internship postings.

### Users

- **Member** — Browses jobs, saves listings, configures job alerts, applies
- **Officer (Secretary)** — Posts job listings for their org
- **External Employer** — Registers, gets approved, posts listings
- **Platform Administrator** — Approves external employers, moderates listings

### Related Modules

| Module | Relationship |
|--------|-------------|
| M01 (Onboarding) | Membership status gates job board access |
| M02 (Person) | Applicant identity |
| M05 (Membership) | Active membership required for full access |
| M07 (Communications) | Job alert notifications |
| Storage | Resume file storage for applications |

### In Scope

- Job listing CRUD (create, publish, edit, close, expire)
- Job search with filters (type, specialty, location)
- Save/bookmark listings
- Job alerts (keyword, specialty, location notifications)
- External employer registration and approval workflow
- Auto-expiry at 30 days with 7-day warning and extension option
- Job applications with resume upload

### Out of Scope

- In-app applicant tracking system (ATS)
- Salary benchmarking / market data
- Recruiter tools / candidate search
- Payment for job postings (future monetization)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| **Association** | Top-level tenant organization. Scoped by `association_id`. |
| **Organization** | Operational unit within an association. Jobs are posted per-org. |
| **Member** | Healthcare professional. Can browse and apply for jobs. |
| **Officer** | Member with admin role. Can post job listings for their org. |
| **Job Posting** | A job listing with title, description, type, location, and expiry. |
| **Job Application** | A member's application to a job posting, with optional resume. |
| **External Employer** | Non-member company that registers to post jobs, requiring platform admin approval. |

## 3. Workflows

| Workflow | WF-ID | Actor | Description | Priority |
|----------|-------|-------|-------------|----------|
| Browse & Save Jobs | WF-087 | Member | Search, filter, save listings | P1 |
| Create Job Posting | WF-088 | Officer / Employer | Create and publish listing | P1 |
| External Employer Registration | WF-089 | External Employer | Register, verify, post jobs | P1 |
| Job Listing Expiry | WF-090 | System | Auto-expire at 30 days, 7-day warning, extension | P1 |
| Job Alerts | WF-091 | Member | Configure keyword/specialty/location alerts | P2 |

## 4. Workflow Details

### Workflow: Browse & Save Jobs (WF-087)

- **Actor:** Member (active)
- **Preconditions:** Authenticated, active membership
- **Steps:**
  1. Member navigates to job board
  2. System displays published listings, newest first
  3. Member filters by job type, specialty, location
  4. Member views listing detail
  5. Member saves/bookmarks listing
  6. Member applies (optional resume upload)
- **Alternate Flows:** Grace/Lapsed member — read-only access, cannot save or apply (M15-R1)
- **Exception Flows:** No listings match filters — empty state
- **Postconditions:** Saved job persisted; application submitted if applied

### Workflow: Create Job Posting (WF-088)

- **Actor:** Officer (Secretary) or verified External Employer
- **Preconditions:** Active officer term or approved employer account
- **Steps:**
  1. Actor navigates to "Post a Job"
  2. Fills in: title, employer name, description, job type, location, specialty (optional), application URL/email
  3. Sets expiry (default 30 days from now)
  4. Submits listing
  5. If officer: published immediately. If external employer: enters pendingReview (M15-R2)
- **Alternate Flows:** Save as draft
- **Exception Flows:** Validation fails — inline errors
- **Postconditions:** Listing created, JobPostingCreated event emitted

### Workflow: External Employer Registration (WF-089)

- **Actor:** External Employer
- **Preconditions:** Public form, no authentication required
- **Steps:**
  1. Employer fills registration form (company name, contact, description)
  2. System creates employer record in "pending" state
  3. Platform admin receives notification
  4. Admin reviews and approves/rejects
  5. If approved: employer can post listings (enter pendingReview on each)
  6. If rejected: employer notified with reason
- **Alternate Flows:** Employer updates profile after approval
- **Exception Flows:** Duplicate registration — system detects and notifies
- **Postconditions:** Employer account created; approval event logged

### Workflow: Job Listing Expiry (WF-090)

- **Actor:** System (automated)
- **Preconditions:** Listing is published with expiresAt date
- **Steps:**
  1. At expiresAt - 7 days: system sends warning notification to poster
  2. Poster can extend (resets 30-day counter per M15-R4)
  3. At expiresAt: system changes status to expired
  4. Expired listing hidden from search, poster notified (M15-R3)
- **Alternate Flows:** Poster manually closes listing before expiry
- **Exception Flows:** Poster's account deactivated — listing expires normally
- **Postconditions:** Listing status updated; notifications sent

### Workflow: Job Alerts (WF-091)

- **Actor:** Member
- **Preconditions:** Authenticated, active membership
- **Steps:**
  1. Member configures alert: keywords, specialty, location
  2. System saves alert preferences
  3. When new listing matches criteria, system sends notification
- **Alternate Flows:** Member edits/deletes alert
- **Exception Flows:** Too many alerts — limit per member
- **Postconditions:** Alert persisted; notifications triggered on match

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-37 | IF job listing age > 30 days THEN auto-expire with 7-day warning | Expiry | Officer/employer can extend |
| M15-R1 | IF member status != Active THEN read-only job board access | Access | Grace/Lapsed can browse but not save or apply |
| M15-R2 | IF external employer posting THEN require platform admin approval | Moderation | Listings enter "pendingReview" status |
| M15-R3 | IF listing expired THEN hide from search, notify poster | Expiry | 7-day warning before expiry |
| M15-R4 | IF listing extended THEN reset 30-day counter | Extension | Per-extension renewal, resets expiresAt |
| M15-R5 | IF application submitted THEN notify poster | Notification | Via M07 communications |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Browse job board | All active members | Non-members | GA |
| Save job listing | Active members | Grace, Lapsed | GA |
| Apply to job | Active members | Grace, Lapsed | GA |
| Post job listing | Officers (Secretary), verified employers | Member | GA+HG |
| Manage listings | Officers (own org), Platform Admin | Member | GA+HG / PA |
| External employer registration | Public | — | Public form |
| Approve external employers | Platform Admin | All others | PA |

> **Note:** No explicit ROLE_PERMISSION_MATRIX section exists for M15. Permissions derived from PRD and v1 spec. [VERIFY]

## 7. Data Requirements

### Entity: JobPosting

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| organizationId | Yes | Posting org | FK to organization |
| title | Yes | Job title | varchar(255) |
| organizationName | Yes | Company name | varchar(255) — denormalized for display |
| description | Yes | Job description | text |
| type | Yes | Job type | Enum: full_time, part_time, contract, fellowship, internship |
| location | Yes | City/region | varchar(500) |
| salary | No | Salary range | varchar(255) |
| specialty | No | Medical specialty | varchar(255) |
| requirements | No | Job requirements | JSONB (string[]) |
| applicationUrl | No | External application link | URL validation |
| applicationEmail | No | Email for applications | Email validation |
| status | Yes | Lifecycle state | Enum: draft, active, filled, expired, closed (+ pendingReview for external) |
| expiresAt | Yes | Auto-expiry date | Default: createdAt + 30 days |
| postedAt | No | Publication timestamp | Set when status -> active |
| postedBy | Yes | Person FK | Officer or external employer contact |
| createdAt | Yes | Timestamp | Auto |
| updatedAt | Yes | Timestamp | Auto |

Source: DOMAIN_MODEL.md `job_posting` table, `job_posting_status` enum, `job_posting_type` enum.

### Entity: JobApplication

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| postingId | Yes | Job FK | FK to job_posting |
| personId | Yes | Applicant FK | FK to person |
| resumeRef | No | Stored file reference | varchar(500) — via Storage module |
| coverLetter | No | Cover letter text | text |
| status | Yes | Pipeline state | Enum: applied, screening, interviewed, offered, hired, rejected, withdrawn |
| appliedAt | Yes | Timestamp | Default: now |

Source: DOMAIN_MODEL.md `job_application` table, `job_application_status` enum.

### Entity: JobBookmark

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| personId | Yes | Member FK | FK to person |
| jobPostingId | Yes | Job FK | FK to job_posting. Unique with personId |
| createdAt | Yes | Timestamp | Auto |

### Entity: JobAlert

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| personId | Yes | Member FK | FK to person |
| keywords | No | Search terms | text |
| specialty | No | Specialty filter | varchar(255) |
| location | No | Location filter | varchar(255) |
| createdAt | Yes | Timestamp | Auto |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---------------|---------------|--------------------|-----------------| 
| JobPosting | JobApplication | requirements (JSONB) | Status transitions enforced; expiresAt >= createdAt; 30-day default |
| JobBookmark | — | — | Unique per (personId, jobPostingId) |
| JobAlert | — | — | One per (personId, keyword+specialty+location combo) |

Source: DOMAIN_MODEL.md — "Jobs Context: `job_posting` — Root aggregate. Referenced by `job_application.postingId`."

## 8. State Transitions

### Job Posting Status

```
draft --> active           [Officer publishes]
draft --> pendingReview    [External employer submits — M15-R2]
pendingReview --> active   [Admin approves]
pendingReview --> rejected [Admin rejects — terminal for this submission]
active --> expired         [System auto-expires at 30 days — BR-37]
active --> closed          [Poster manually closes]
active --> filled          [Poster marks as filled]
expired --> active         [Poster extends — M15-R4, resets 30-day counter]
```

Terminal states: `rejected`, `filled`, `closed`
Reversible: `expired` -> `active` (via extension)

Source: DOMAIN_MODEL.md state inventory — "Job Listing (M15): Draft -> Published -> Expired/Closed; Draft -> PendingReview -> Published/Rejected. 30-day auto-expiry."

> **Note:** DOMAIN_MODEL uses `active` for `job_posting_status` enum; v1 spec used `published`. Aligned to DOMAIN_MODEL canonical enum: `draft`, `active`, `filled`, `expired`, `closed`.

### Job Application Status

```
applied --> screening      [Poster reviews]
screening --> interviewed  [Interview scheduled]
interviewed --> offered    [Offer extended]
offered --> hired          [Offer accepted]
offered --> rejected       [Offer declined or poster rejects]
screening --> rejected     [Poster rejects]
interviewed --> rejected   [Poster rejects post-interview]
applied --> withdrawn      [Applicant withdraws]
screening --> withdrawn    [Applicant withdraws]
interviewed --> withdrawn  [Applicant withdraws]
```

Terminal states: `hired`, `rejected`, `withdrawn`

Source: DOMAIN_MODEL.md `job_application_status` enum.

## 9. UI/UX Requirements

### Screen: Job Board (/org/[id]/jobs)

- **Purpose:** Browse and search job listings
- **Users:** Active members
- **Components:** Search bar, filter chips (type, specialty, location), job listing cards (title, employer, type, location, posted date), save/bookmark button, pagination
- **States:**
  - Loading: Skeleton listing cards
  - Empty: "No job listings available" with CTA for officers
  - Success: Paginated listing grid
  - ValidationError: N/A (read-only)
  - PermissionError: "Active membership required to access job board"
  - UnexpectedError: "Unable to load job listings."

### Screen: Job Detail (/org/[id]/jobs/[jobId])

- **Purpose:** View full listing and apply
- **Users:** Active members
- **Components:** Full job description, requirements, employer info, apply button, save button, application form (resume upload, cover letter)
- **States:**
  - Loading: Skeleton layout
  - Empty: N/A
  - Success: Full listing with apply form
  - ValidationError: "Resume required" or field errors
  - PermissionError: "Active membership required to apply"
  - UnexpectedError: "Unable to load listing."

### Screen: Create Job Posting (/org/[id]/officer/jobs/new)

- **Purpose:** Post a new job listing
- **Users:** Officers, verified employers
- **Components:** Form fields (title, description, type selector, location, specialty, salary, application URL/email), expiry date picker, submit/draft buttons
- **States:**
  - Loading: Submitting spinner
  - Empty: Blank form
  - Success: "Job posted successfully" toast (sonner)
  - ValidationError: Inline field errors
  - PermissionError: "Only officers can post jobs"
  - UnexpectedError: "Failed to post job. Draft saved."

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /orgs/{orgId}/jobs | List job postings | orgId, cursor, filters (type, specialty, location) | Paginated listings | 403 not member |
| GET /orgs/{orgId}/jobs/{jobId} | Job detail | jobId | Full listing | 403, 404 |
| POST /orgs/{orgId}/jobs | Create posting | orgId, title, description, type, location, etc. | Created listing | 403 not officer, 422 |
| PATCH /orgs/{orgId}/jobs/{jobId} | Update posting | jobId, fields | Updated listing | 403, 404, 422 |
| POST /orgs/{orgId}/jobs/{jobId}/apply | Apply to job | jobId, resumeRef, coverLetter | Created application | 403, 404, 409 already applied |
| POST /orgs/{orgId}/jobs/{jobId}/bookmark | Save listing | jobId | 201 | 403, 409 already saved |
| DELETE /orgs/{orgId}/jobs/{jobId}/bookmark | Unsave | jobId | 204 | 404 |
| POST /orgs/{orgId}/jobs/alerts | Create alert | keywords, specialty, location | Created alert | 403, 422 |
| DELETE /orgs/{orgId}/jobs/alerts/{alertId} | Delete alert | alertId | 204 | 404 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|------------|---------|---------|-----------|
| JobPostingCreated | Listing published | { postingId, orgId, title, type } | M07 (notification), Job Alerts |
| JobPostingExpired | Auto-expiry triggered | { postingId, orgId } | Poster notification |
| JobApplicationSubmitted | Member applies | { applicationId, postingId, personId } | Poster notification |
| JobPostingExpiryWarning | 7 days before expiry | { postingId, orgId, expiresAt } | Poster notification |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|------------|-------------|---------|-------------|
| MembershipStatusChanged | M05 | updateAccessLevel | Revoke save/apply if membership lapses |

## 11. Acceptance Criteria

### AC-M15-001: Auto-Expiry
**Given** a job listing published 30 days ago  
**When** the expiry job runs  
**Then** the listing status changes to expired and is hidden from search, poster notified

### AC-M15-002: External Employer Approval
**Given** an external employer submits a job listing  
**When** the listing is created  
**Then** it enters pendingReview status and is not visible until admin approves

### AC-M15-003: Access Gating
**Given** a member with Lapsed status  
**When** they browse the job board  
**Then** they can view listings but cannot save or apply

### AC-M15-004: Extension
**Given** an expired job listing  
**When** the poster clicks "Extend"  
**Then** the listing status returns to active with a new 30-day expiry

### AC-M15-005: Job Alert Matching
**Given** a member has a job alert for "dentist" specialty  
**When** a new listing with "dentist" specialty is published  
**Then** the member receives a notification

## 12. Test Expectations

- **Unit:** Expiry date calculation, status transition validation, alert matching logic, bookmark uniqueness
- **Integration:** Auto-expiry cron job, external employer approval flow, application with resume upload
- **Contract:** GET /jobs returns paginated results, POST /jobs requires officer auth, POST /apply enforces active membership
- **E2E:** Officer posts job, member saves and applies; external employer registers and gets approved; listing auto-expires at 30 days

## 13. Edge Cases

- Job listing extended multiple times — each extension resets 30-day counter
- External employer posts while approval still pending — queued
- Member applies to same job twice — 409 conflict
- Poster closes listing with pending applications — applications remain, status frozen
- Job alert matches many new listings simultaneously — batch notification
- Listing with no applicationUrl or applicationEmail — at least one required
- External employer account deactivated — all their listings closed
- Very large number of listings (1000+) — pagination and search indexing

## 14. Dependencies

### Internal Dependencies

- M02 (Person): Applicant and poster identity
- M05 (Membership): Status check for access gating
- M07 (Communications): Job alert and expiry warning notifications
- Storage module: Resume file upload for applications

### External Dependencies

- Cron/scheduled job runner for auto-expiry check (Bun-native or external)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Non-member browses jobs | 403 Forbidden | "Active membership required to access job board" |
| Non-officer posts job | 403 Forbidden | "Only officers can post job listings" |
| Duplicate application | 409 Conflict | "You have already applied to this listing" |
| Listing not found | 404 Not Found | "Job listing not found" |
| Listing expired | 410 Gone | "This listing has expired" |
| Resume upload fails | 422, retry | "Resume upload failed. Please try again." |
| External employer not approved | 403 Forbidden | "Your employer account is pending approval" |

## 16. Performance Expectations

- **Data volume:** ~50 listings/org/month, ~5K listings/association/year
- **Concurrent users:** Up to 1000 members browsing simultaneously
- **Response times:** Job list < 500ms (p95), job detail < 300ms, application submit < 2s
- **Caching:** Active listings cached with 5min TTL; invalidated on new posting
- **Search:** Full-text search on title + description for keyword filtering

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|-------|-------|------|--------|------|
| job.listed | INFO | Listing published | postingId, orgId, type | No |
| job.applied | INFO | Application submitted | postingId, applicantId | No |
| job.expired | INFO | Auto-expiry triggered | postingId, orgId | No |
| job.extended | INFO | Listing extended | postingId, orgId | No |
| employer.registered | INFO | External employer registered | employerId | No |
| employer.approved | INFO | Employer approved | employerId, approvedBy | No |

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| job_listings_total | counter | orgId, type, status | Total listings |
| job_applications_total | counter | orgId | Total applications |
| job_expiry_total | counter | orgId | Auto-expired listings |
| job_alert_matches_total | counter | — | Alert notifications sent |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|-----------|------|---------|-------------|--------------|
| job_board_enabled | boolean | false | Enable job board module | Post Phase 2 GA |
| job_external_employers | boolean | false | Allow external employer registration | Post validation |
| job_alerts | boolean | false | Enable job alert notifications | Post validation |
| job_applications | boolean | false | Enable in-app applications | Post validation |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|--------------|----------|
| M15-S1 | Browse Jobs | GET listings with pagination and filters | M02, M05 | P0 |
| M15-S2 | Create Listing | Officer creates and publishes listing | M15-S1 | P0 |
| M15-S3 | Save/Bookmark | Member saves listings | M15-S1 | P1 |
| M15-S4 | Auto-Expiry | Cron job for 30-day expiry + 7-day warning | M15-S2 | P1 |
| M15-S5 | Apply to Job | Member applies with resume upload | M15-S1, Storage | P1 |
| M15-S6 | External Employers | Registration + admin approval workflow | M15-S2 | P2 |
| M15-S7 | Job Alerts | Alert configuration + matching notifications | M15-S1, M07 | P2 |
| M15-S8 | Listing Extension | Extend expired listings | M15-S4 | P2 |

## 20. AI Instructions

When implementing this module:
1. No existing handler code — scaffold `handlers/jobs/` from scratch following `handlers/person/createPerson.ts` pattern.
2. Schema file: `jobs/repos/jobs.schema.ts` as specified in DOMAIN_MODEL.md.
3. Convert workflows into vertical slice specs. Implement one slice at a time.
4. Use DOMAIN_MODEL enums exactly: `job_posting_status` (draft, active, filled, expired, closed), `job_posting_type` (full_time, part_time, contract, fellowship, internship), `job_application_status` (applied, screening, interviewed, offered, hired, rejected, withdrawn).
5. Auto-expiry requires a scheduled job — implement as Bun cron or background worker.
6. Keep terminology consistent with the Domain Glossary.
7. Use acceptance criteria as test basis.
8. Follow ARCHITECTURE.md (Bun, Hono, Drizzle, TypeSpec-first), CONTRIBUTING.md, and CLAUDE.md.
9. Resume upload integrates with existing Storage module (S3/MinIO).

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | — |
| 2. Domain Terms | COMPLETE | — |
| 3. Workflows | COMPLETE | From WORKFLOW_MAP WF-087 to WF-091 |
| 4. Workflow Details | COMPLETE | — |
| 5. Business Rules | COMPLETE | BR-37 from WORKFLOW_MAP + module-specific rules |
| 6. Permissions | PARTIAL | No explicit ROLE_PERMISSION_MATRIX section for M15 |
| 7. Data Requirements | COMPLETE | Aligned to DOMAIN_MODEL `job_posting` and `job_application` tables |
| 7b. Aggregate Boundaries | COMPLETE | From DOMAIN_MODEL Jobs Context |
| 8. State Transitions | COMPLETE | From DOMAIN_MODEL enums and state inventory |
| 9. UI/UX Requirements | COMPLETE | — |
| 10. API Expectations | COMPLETE | — |
| 10b. Domain Events | COMPLETE | — |
| 11. Acceptance Criteria | COMPLETE | — |
| 12. Test Expectations | COMPLETE | — |
| 13. Edge Cases | COMPLETE | — |
| 14. Dependencies | COMPLETE | — |
| 15. Error Handling | COMPLETE | — |
| 16. Performance | COMPLETE | — |
| 17. Observability | COMPLETE | — |
| 18. Feature Flags | COMPLETE | — |
| 19. Vertical Slice Plan | COMPLETE | — |
| 20. AI Instructions | COMPLETE | — |
| 21. Section Completeness | COMPLETE | — |
| 22. Downstream Impact | COMPLETE | — |

## 22. Downstream Impact

- **MODULE_MAP.md:** M15 dependencies (M01, M02, M05, M07) must be reflected
- **ROLE_PERMISSION_MATRIX.md:** Missing section 3.x for Job Board — needs addition [VERIFY]
- **DOMAIN_MODEL.md:** `job_posting` and `job_application` tables defined (Wave 4). `job_bookmark` and `job_alert` tables not defined — needs addition [VERIFY]
- **M16 (Advertising):** Job board pages are potential ad placement targets (sidebar slot)
