# Module Specification: Job Board (M15)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Dedicated, association-verified marketplace for healthcare employment opportunities. Connects active members with job postings from verified healthcare employers without the noise of generic job platforms.

### Users
- Member, Officer, External Employer, Platform Admin

### Related Modules
- M01 (Auth), M02 (Member Profile — applicant data), M05 (Membership — access gating)

### In Scope
- Job listing CRUD (officer + external employer), listing review and approval
- Member job search, filtering, and saving, job alerts
- External employer registration and verification
- Listing expiry, reminders, and extension
- Member application tracking (external link or email)

### Out of Scope
- Full ATS (applicant tracking system), resume management, salary negotiation

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Job Listing | Employment opportunity posted by an officer or verified employer. |
| External Employer | Healthcare organization not on the Memberry platform (hospital, clinic). |
| Job Alert | Automated notification when new listings match member criteria. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Browse & Save Jobs | Member | Search, filter, save listings | P0 |
| Post Job Listing | Officer | Create and publish listing | P0 |
| Manage Listings | Officer | Edit, extend, close listings | P0 |
| Set Up Job Alert | Member | Automated notifications for new matches | P1 |
| External Employer Registration | Employer | Apply to post on platform | P1 |

## 4. Workflow Details

### Workflow: Browse & Save Jobs (Journey 15A)

Actor: Active member
Steps:
1. Opens /org/[id]/jobs.
2. Searches by keyword, specialty, location.
3. Filters by job type (full-time/part-time/contract), location.
4. Views listing detail: title, employer, description, requirements, how to apply.
5. Saves listing to "My Saved Jobs."

### Workflow: External Employer Registration (Journey 15E)

Actor: External employer (HR manager)
Steps:
1. Finds employer registration page.
2. Submits: company name, type, registration number, contact info.
3. Platform admin reviews and approves.
4. Employer receives login credentials.
5. Posts listings (enter "Pending Review" status).
6. Platform admin reviews and approves listings.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-37 | IF job listing age > 30 days THEN auto-expire with 7-day warning | Expiry | Officer can extend |
| M15-R1 | IF member status != Active THEN read-only job board access | Access | Grace/Lapsed can browse but not save |
| M15-R2 | IF external employer posting THEN require platform admin approval | Moderation | Listings enter "Pending Review" |
| M15-R3 | IF listing expired THEN hide from search, notify poster | Expiry | 7-day warning before expiry |
| M15-R4 | IF listing extended THEN reset 30-day counter | Extension | Per-extension renewal |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Browse job board | All active members | non-members | GA |
| Save job listing | Active members | Grace, Lapsed | GA |
| Post job listing | Officers | member | GA+HG |
| Manage listings | Officers (own org), platform admin | member | GA+HG |
| External employer registration | Public | — | Public form |

## 7. Data Requirements

### Entity: JobListing

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Posting org | — |
| title | Yes | Job title | — |
| employerName | Yes | Company name | — |
| description | Yes | Job description | — |
| jobType | Yes | full-time/part-time/contract | Enum |
| location | Yes | City/region | — |
| specialty | No | Medical specialty | — |
| applicationUrl | No | External application link | URL |
| applicationEmail | No | Email for applications | — |
| status | Yes | draft/published/pendingReview/expired/closed | Enum |
| expiresAt | Yes | Auto-expiry date | Default: createdAt + 30 days |
| postedBy | Yes | Person FK | Officer or external employer |

### Entity: SavedJob

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| personId | Yes | Member FK | — |
| jobListingId | Yes | Job FK | Unique with personId |

### Entity: JobAlert

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| personId | Yes | Member FK | — |
| keywords | No | Search terms | — |
| specialty | No | Filter | — |
| location | No | Filter | — |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| JobListing | — | — | Expires after 30 days unless extended. |

## 8. State Transitions

### Job Listing Status
```txt
Draft → Published → Expired (30 days)
Draft → Published → Closed (officer)
Draft → PendingReview (external employer) → Published (admin approves)
PendingReview → Rejected
Published → Extended → Published (reset expiry)
```

## 9. UI / UX Requirements

### Screen: Job Board (/org/[id]/jobs)
Purpose: Member job search
Components: Search bar, filters (type, location, specialty), listing cards, "Save" button per listing

### Screen: Create Job Posting (/org/[id]/officer/jobs/new)
Purpose: Officer creates listing
Components: Title, employer, description, requirements, job type, location, specialty, application method, publish/draft

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /org/:id/jobs | List jobs | filters, search | Job list | — |
| POST /org/:id/jobs | Create listing | Job data | jobId | 403 |
| POST /my/saved-jobs | Save job | jobListingId | saved: true | 409 already saved |
| POST /my/job-alerts | Create alert | criteria | alertId | — |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| JobListingPublished | Listing goes live | jobId, orgId | Job alert notifications |
| JobListingExpired | 30-day expiry | jobId | Poster notification |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MembershipStatusChanged | M05 | Update access level | Browse/save permissions |

## 11. Acceptance Criteria

### AC-M15-001: Auto-Expiry
Job listings auto-expire after 30 days with 7-day pre-expiry warning to poster.

### AC-M15-002: External Employer Approval
External employer listings require platform admin approval before visibility.

### AC-M15-003: Access Gating
Only active members can save jobs. Grace/Lapsed can browse but not save.

## 12. Test Expectations

Required tests:
- Listing CRUD: create, publish, expire, extend, close
- Search and filtering: keyword, specialty, location, job type
- Save/unsave: member saves, unique constraint, access gating
- External employer: registration, approval, listing moderation
- Auto-expiry: 30-day timer, 7-day warning, extension reset

## 13. Edge Cases

- All listings expired: empty board with "No jobs available" message.
- External employer submits duplicate registration: deduplicate by registration number.
- Member saves job that then expires: saved job shows "Expired" badge.
- Job alert with no matching new listings: no notification sent.

## 14. Dependencies

### Internal Dependencies
- M01 (Auth), M02 (Profile), M05 (Membership — access gating)

### External Dependencies
- None (application tracking is external via URL/email)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Save by non-active member | 403 | "Active membership required to save jobs." |
| Expired listing view | Show with badge | "This listing has expired." |
| External listing rejected | Notify employer | "Listing not approved. Reason: [text]." |

## 16. Performance Expectations

- Expected data volume: 100+ listings per association
- Acceptable response times: Search < 500ms, listing detail < 200ms

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| job.listing.published | INFO | Listing live | jobId, orgId | No |
| job.listing.expired | INFO | Auto-expiry | jobId | No |
| job.saved | INFO | Member saves | jobId, personId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| job_listings_total | counter | status | Listing count |
| job_saves_total | counter | — | Save count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| job_board_enabled | release | false | Gates job board | — |
| job_external_employers | release | false | External employer registration | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M15-S1 | Job Listing CRUD | Create, publish, edit listings | M04 | P0 |
| M15-S2 | Job Search & Browse | Search, filter, pagination | M15-S1, M05 | P0 |
| M15-S3 | Save Jobs | Member saves listings | M15-S2 | P0 |
| M15-S4 | Auto-Expiry | 30-day expiry + warnings | M15-S1 | P0 |
| M15-S5 | Job Alerts | Automated match notifications | M15-S2 | P1 |
| M15-S6 | External Employers | Registration + approval | M15-S1 | P1 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
