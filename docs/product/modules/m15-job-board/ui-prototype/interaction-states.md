<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Interaction States: Job Board (M15)

---

## Loading State

**When it appears:** Initial job board load, search query, filter change, job detail load, application submission, bookmark toggle, alert creation
**Expected UI behavior:**
- Job board load: 6-8 skeleton job cards matching JobListingCard dimensions
- Search/filter: skeleton cards replace existing results (fade transition)
- Job detail: skeleton layout matching detail page structure
- Application submit: submit button spinner, form fields disabled
- Bookmark toggle: icon replaced with spinner (brief)
- Alert creation: create button spinner
- Pagination change: skeleton cards with page indicator
- aria-busy="true" on listing section during load

---

## Empty State

**When it appears:** No job listings exist, search/filter returns zero results, no bookmarked jobs, no alerts configured
**Expected UI behavior:**
- No listings at all:
  - Illustration (job search graphic)
  - Officers: "No job listings yet. Post the first job for your organization." + "Post a Job" CTA
  - Members: "No job opportunities available right now. Check back soon or set up a job alert."
- Search returns nothing: "No jobs match '{query}'. Try different keywords." with "Clear search" link
- Filter returns nothing: "No jobs match your filters. Try broadening your criteria." with "Clear filters" link
- No bookmarks: "You haven't saved any jobs yet. Browse listings and bookmark the ones that interest you."
- No alerts: "No job alerts configured. Create one to get notified about new opportunities."
- aria-live="polite" announces empty state and result count

---

## Success State

**When it appears:** Job posted, application submitted, bookmark toggled, alert created/deleted, listing extended
**Expected UI behavior:**
- Job posted (officer): sonner toast "Job posted successfully" (3s), redirect to job detail
- Job submitted (external employer): sonner toast "Job submitted for review" (3s), redirect to board
- Application submitted: sonner toast "Application submitted successfully" (3s), apply button changes to "Applied" (disabled)
- Bookmark added: icon animates to filled state (no toast — inline feedback only)
- Bookmark removed: icon animates to outline state (no toast)
- Alert created: sonner toast "Job alert created. You'll be notified when matching jobs are posted." (4s)
- Alert deleted: sonner toast "Job alert removed" (3s)
- Listing extended: sonner toast "Listing extended by 30 days" (3s)

---

## Validation Error State

**When it appears:** Create job form or application form submitted with invalid data
**Expected UI behavior:**
- Create job form:
  - Inline errors below each invalid field
  - "Title is required", "Description is required", "Location is required"
  - "Please select a job type"
  - "Please provide an application URL or email"
  - "Invalid URL format" / "Invalid email format"
  - "Expiry date must be in the future"
- Application form:
  - "Resume is required" below upload zone
  - "File must be PDF, DOC, or DOCX" for invalid file type
  - "File size must be under 10MB" for oversized files
- Focus moves to first invalid field
- aria-invalid="true" on invalid fields
- aria-describedby links to error messages
- Error summary announced via aria-live="assertive"

---

## Permission Error State

**When it appears:** Non-active member attempts bookmark/apply, non-officer attempts to post job
**Expected UI behavior:**
- Grace/Lapsed member (M15-R1):
  - Bookmark button disabled with tooltip: "Active membership required to save jobs"
  - Apply button disabled with tooltip: "Active membership required to apply"
  - Banner on detail page: "Your membership is inactive. Renew to apply for jobs." + "Renew" CTA
- Non-officer accesses create job form:
  - Redirect to job board with sonner toast "Only officers and verified employers can post jobs"
- AUTHZ-002 (403): "You must be an active member to perform this action"
- External employer (not verified): "Your employer account is pending verification"

---

## Unexpected Error State

**When it appears:** Network failure, server 500, timeout
**Expected UI behavior:**
- Job board load failure: centered error card "Unable to load job listings. Please try again." with "Retry" button
- Job detail load failure: "Unable to load this listing. Please try again." with "Retry" and "Back to Jobs" buttons
- Application failure: "Failed to submit application. Please try again." with "Retry" (form data preserved)
- Job creation failure: "Failed to post job. Your draft has been saved." with "Try Again"
- Bookmark failure: sonner toast "Failed to save job. Please try again." (error variant, 5s)
- All errors include correlation ID for support
- aria-live="assertive" announces error

---

## Conflict / Duplicate Warning State

**When it appears:** Bookmark already exists, already applied to job
**Expected UI behavior:**
- Already bookmarked (CONFLICT-002): bookmark icon already filled, toggle removes bookmark
- Already applied: apply button shows "Applied" (disabled), no re-submission possible
- Listing expired while viewing detail: "This listing expired on {date}. You can no longer apply." banner at top, apply button disabled
- Listing filled while viewing: "This position has been filled." banner, apply disabled

---

## Confirmation / Warning State

**When it appears:** External application redirect, delete job alert, listing about to expire
**Expected UI behavior:**
- External application: "You will be redirected to {domain} to complete your application. Continue?" with "Go to Application" and "Cancel"
- Delete job alert: "Remove this job alert? You'll stop receiving notifications for matching jobs." with "Remove" and "Cancel"
- Listing expiring soon (<7 days): orange badge "Expiring in {N} days" on card and detail
- Remove job listing (officer): "Remove this listing? It will no longer be visible to members." with "Remove" (destructive) and "Cancel"

---

## Offline / Sync State

**When it appears:** Network unavailable while browsing or applying
**Expected UI behavior:**
- Browsing: "You're offline. Showing cached listings." banner with last-synced timestamp
- Applying: "You're offline. Your application will be submitted when you reconnect." — form data saved locally
- Posting: "You're offline. Job saved as draft and will be posted when you reconnect."
- Bookmarks: toggle queued for sync on reconnect
- Online restore: banner dismissed, data refreshed, queued actions processed
- aria-live="polite" announces connectivity changes

---

## Per-Screen Completeness Score

| Screen | States Defined | States Missing | Score |
|--------|---------------|---------------|-------|
| Job Board | 9/9 | none | COMPLETE |
| Job Detail | 9/9 | none | COMPLETE |
| Create Job Posting | 9/9 | none | COMPLETE |
