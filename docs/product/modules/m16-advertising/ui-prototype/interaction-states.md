<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Interaction States: Advertising (M16)

---

## Loading State

**When it appears:** Dashboard load, campaign detail load, creative review queue load, campaign config save, creative approval/rejection, status transition
**Expected UI behavior:**
- Dashboard load: skeleton table with 5-8 rows matching CampaignTable dimensions
- Campaign detail load: skeleton layout (config section, creative cards, charts)
- Creative review queue: skeleton creative cards (3-4)
- Config save: save button spinner, fields disabled
- Creative approval: approve button spinner on specific card
- Status transition: action button spinner, status badge shows "updating" state
- aria-busy="true" on main content during load

---

## Empty State

**When it appears:** No campaigns exist, no pending creatives, no creatives in campaign, no performance data
**Expected UI behavior:**
- No campaigns: "No campaigns yet. Create your first advertising campaign to get started." + "Create Campaign" CTA button
- No pending creatives: "No creatives pending review. All caught up!" with checkmark illustration
- Campaign with no creatives: "No creatives added yet. Add your first creative to this campaign." + "Add Creative" CTA
- No performance data (new campaign): "Performance data will appear once the campaign receives its first impressions."
- aria-live="polite" announces empty state

---

## Success State

**When it appears:** Campaign created, config saved, creative approved/rejected, status changed, advertiser registered, ad reported, member opted out
**Expected UI behavior:**
- Campaign created: sonner toast "Campaign created" (3s), redirect to campaign detail
- Config saved: sonner toast "Campaign updated" (3s)
- Creative approved (M16-R1): sonner toast "Creative approved" (3s), card status badge updates to "approved"
- Creative rejected (M16-R1): sonner toast "Creative rejected" (3s), card status badge updates to "rejected" with reason
- Campaign activated: sonner toast "Campaign is now active" (3s), status badge updates
- Campaign paused: sonner toast "Campaign paused" (3s)
- Campaign completed: sonner toast "Campaign completed" (3s)
- Advertiser registered: sonner toast "Advertiser registered" (3s)
- Ad reported (member): sonner toast "Ad reported. We'll review it shortly." (4s)
- Member opt-out (M16-R4): sonner toast "You've opted out of targeted ads" (3s)

---

## Validation Error State

**When it appears:** Campaign config with invalid data, creative form with invalid data, rejection without reason
**Expected UI behavior:**
- Campaign config:
  - "Campaign name is required"
  - "Budget must be greater than 0" (M16-R6)
  - "End date must be after start date"
  - "Please select an ad slot"
- Creative form:
  - "Title is required" (max 255 chars)
  - "Body text is required" (max 500 chars)
  - "Invalid image URL"
  - "Invalid click URL"
- Rejection reason:
  - "Rejection reason is required" in dialog
- Advertiser registration:
  - "Company name is required"
  - "Invalid email format" (VALIDATION-003)
  - "Advertiser with this name already exists" (CONFLICT-002)
- Focus moves to first invalid field
- aria-invalid="true" on invalid fields
- aria-describedby links to error message

---

## Permission Error State

**When it appears:** Non-platform-admin attempts to access advertising screens, member attempts admin action
**Expected UI behavior:**
- Non-platform-admin navigates to /admin/advertising: redirect to /admin with sonner toast "Platform admin access required" (AUTHZ-004)
- Page content not rendered for unauthorized users (no flash)
- All advertising admin screens: same permission check
- Member-facing ad components (report, opt-out): accessible to any authenticated member

---

## Unexpected Error State

**When it appears:** Server 500, network failure, timeout during any advertising operation
**Expected UI behavior:**
- Dashboard load failure: centered error card "Unable to load advertising dashboard. Please try again." with "Retry" button
- Campaign detail failure: "Unable to load campaign. Please try again." with "Retry" and "Back to Dashboard" buttons
- Creative review queue failure: "Unable to load review queue. Please try again." with "Retry"
- Config save failure: sonner toast "Failed to save changes. Please try again." (error variant, 5s), form data preserved
- Creative approval failure: sonner toast "Failed to update creative. Please try again." (error, 5s)
- Status transition failure: sonner toast "Failed to update campaign status." (error, 5s), status reverts
- Impression/click tracking failure: silent retry (no user-facing error for tracking)
- Correlation ID displayed for support
- aria-live="assertive" announces error

---

## Conflict / Duplicate Warning State

**When it appears:** Creative already reviewed, campaign state conflict, duplicate advertiser
**Expected UI behavior:**
- Creative already reviewed (concurrent admin): sonner toast "This creative has already been reviewed" (info, 3s), card removed from pending queue
- Campaign status conflict (e.g., another admin paused): "Campaign status has changed. Refreshing..." + auto-refresh
- Duplicate advertiser (CONFLICT-002): inline error "An advertiser with this company name already exists"
- Budget exhausted while active (M16-R6): "Campaign auto-paused: budget exhausted" banner + status badge changes to "paused"
- Cannot activate without approved creative: "At least one creative must be approved before activation" inline warning

---

## Confirmation / Warning State

**When it appears:** Complete campaign (terminal), activate campaign, budget threshold
**Expected UI behavior:**
- Complete campaign: AlertDialog "Complete this campaign? This action cannot be undone. The campaign will stop serving ads." + "Complete" (destructive) and "Cancel"
- Activate campaign: "Activate this campaign? Ads will begin serving to members immediately." + "Activate" and "Cancel"
- Budget >90% spent: warning banner "Campaign budget is nearly exhausted ({X}% spent)"
- Reject creative: reason dialog acts as confirmation (reason is required)

---

## Offline / Sync State

**When it appears:** Network unavailable while managing campaigns
**Expected UI behavior:**
- Browsing dashboard: "You're offline. Data may be stale." banner with last-loaded timestamp
- Editing config: "You're offline. Changes will be saved when you reconnect." — form edits queued locally
- Reviewing creatives: "You're offline. Approval actions will be submitted when you reconnect." — actions queued
- Impression/click tracking: events queued locally, batch-sent on reconnect
- Online restore: banner dismissed, data refreshed, queued actions processed
- aria-live="polite" announces connectivity changes

---

## Per-Screen Completeness Score

| Screen | States Defined | States Missing | Score |
|--------|---------------|---------------|-------|
| Advertising Dashboard | 9/9 | none | COMPLETE |
| Campaign Detail | 9/9 | none | COMPLETE |
| Creative Review Queue | 9/9 | none | COMPLETE |
