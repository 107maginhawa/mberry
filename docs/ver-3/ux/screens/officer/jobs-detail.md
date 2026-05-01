# Manage Job Posting

- **Route:** `/org/[id]/officer/jobs/[id]`
- **Module:** M15 Job Board
- **Access:** President, Secretary
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Allows officers to view, edit, extend, close early, or repost a specific job listing — providing full lifecycle control over a single posting from publication through expiry.

## Layout

### Desktop
Sidebar with Jobs active. Main content: left column (65%) shows the listing preview exactly as members see it (read-only). Right column (35%) is the management panel with status, dates, and context-sensitive action buttons.

### Mobile
Single-column layout. Listing preview at the top (collapsed by default, expandable). Management panel below: status, dates, and action buttons in a card.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Listing preview | Read-only view | Full listing rendered as members see it: title, org name, location, employment type, specialty, description, how to apply. |
| Status badge | Colored badge | Active (green), Expiring Soon (amber), Expired (gray), Closed Early (gray), Draft (blue), Pending Review (blue). |
| Posted date | Date display | When the listing was published. |
| Expiry date | Date display | When the listing will expire. Shows "X days remaining" in amber text when fewer than 7 days. Shows "Expired on [date]" for expired listings. |
| Edit Listing button | Secondary button | Active listings only. Opens the create form pre-populated with current values. Edit re-publishes immediately for verified orgs. |
| Extend 30 Days button | Primary button | Shown when status is Expiring Soon or Active within 7 days of expiry. Adds 30 days to the current expiry date. Confirmation inline: "Listing extended to [new date]." |
| Close Listing Early button | Destructive button | Active and Expiring Soon listings only. Opens a confirmation dialog before closing. |
| Repost button | Secondary button | Expired and Closed Early listings only. Opens the create form pre-populated with previous content. Creates a new listing with a fresh 30-day expiry. |
| Back link | Navigation | Returns to /org/[id]/officer/jobs. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton for listing preview and management panel. |
| Active | Listing is live on the board | Edit, Close Early buttons visible. Extend button visible if within 7 days of expiry. |
| Expiring Soon | Fewer than 7 days until expiry | Expiry date shown in amber. "Expiring Soon" badge. Extend 30 Days button prominently displayed. |
| Expired | Expiry date passed | No editing actions. "Repost" button shown. Expiry shown as "Expired on [date]." Note: "This listing is no longer visible on the job board." |
| Closed Early | Officer closed the listing | Same as Expired — no editing. "Repost" button. Note: "You closed this listing on [date]." |
| Draft | Listing was saved but not published | Edit and Publish buttons shown. No Close Early or Extend options. |
| Extend success | Officer clicks Extend 30 Days | Expiry date updates inline. Toast: "Listing extended to [new date]." Status badge returns to "Active" if it was "Expiring Soon." |
| Close Early confirmation | Officer clicks Close Listing Early | Confirmation dialog: "This listing will be removed from the job board immediately and members will no longer see it. This cannot be undone." Two buttons: "Yes, Close Listing" (destructive) and "Cancel." |
| Close Early confirmed | Officer confirms close | Listing removed from member board within 5 minutes. Management panel status updates to "Closed Early." Close Early and Extend buttons removed. Repost button appears. Toast: "Listing closed. Members can no longer see it." |
| Pending Review | External employer listing awaiting approval | All editing actions disabled. Note: "This listing is under review by the platform admin. You will be notified when it is approved." |

## Interactions

- The "Extend 30 Days" button adds 30 days from the current calendar date (not from the current expiry date), so extending a listing that expires in 2 days still gives 30 full days from today.
- Officers can extend a listing any number of times per BR-37. There is no maximum extension count.
- Editing an active listing republishes it immediately for verified orgs. The listing remains visible on the board during the edit — there is no "unpublish while editing" step.
- Editing a listing that is in Pending Review re-enters the review queue for external employer accounts.
- "Repost" creates a completely new listing record with a new ID and a fresh 30-day expiry. The old listing record is retained in the system with its original status ("Expired" or "Closed Early") and is visible in the officer management view but not on the member-facing board.
- The listing preview on this screen is a live render — it shows the exact same HTML/markup that members see, so officers can verify that formatting (bold text, bullet points) looks correct before deciding to extend or repost.
