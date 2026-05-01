# Job Listing Detail

- **Route:** `/org/[id]/jobs/[id]`
- **Module:** M15 Job Board
- **Access:** Member (must be active member of this org)
- **Phase:** 2
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Show a member the full details of a job listing — description, requirements, and how to apply — so they can decide whether to apply and initiate contact with the employer off-platform.

## Layout

### Desktop
Centered single-column view (max-width 680px). Header block with job title, org name, location, and employment type badge. Metadata summary row. Body sections in order: Job Description, Requirements (if separate), How to Apply. Sticky apply CTA in the right margin (desktop only) that mirrors the "Apply Now" or email link in the body section.

### Mobile
Full-width single column. Back arrow in top-left. All content stacks. A persistent bottom action bar contains the primary apply action (either "Apply via Email" or "Apply Now" button linking to the external URL) and the save/bookmark icon so the member can always apply or save without scrolling.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Back Arrow | Navigation | Returns to the job board list at previous scroll position. |
| Job Title | Heading (h1) | Large, bold. |
| Organization Name | Subheading | Clinic or hospital name. Below the title. |
| Location | Metadata chip | City, Province. |
| Employment Type Badge | Chip | Full-time / Part-time / Locum/Relief / Contract. |
| Specialty Requirement | Metadata chip | Required specialty or specialties. |
| Expiry Info | Metadata row | "Posted [date] — Closes [date]." Amber text if fewer than 7 days until expiry. "Expired" label if listing is expired (should not appear in normal browse, but may appear via saved list or deep link). |
| Bookmark Icon | Toggle icon (header) | Same bookmark toggle as the list view. Outlined = not saved, filled = saved. |
| Job Description | Rich text section | Full description preserving officer's formatting (paragraphs, bullet points). Section heading: "About this role." |
| Requirements | Rich text section | If officer provided requirements as a separate field. Section heading: "Requirements." |
| How to Apply | Section | Section heading: "How to apply." Displays the application instructions field verbatim. If a contact email is provided, it renders as a `mailto:` link styled as a button: "Apply via Email." If an application URL is provided, it renders as a button: "Apply Now" (navigates to external page). Both may appear if the officer provided both. |
| Employer Note | Inline note | Small print below the apply section: "Applications are handled directly by [Org Name]. Memberry does not collect or process your application." |
| Bottom Action Bar (mobile) | Persistent bar | Primary apply button (email or external URL) + bookmark icon. Always visible, floats above the main scroll area. |
| Sticky Sidebar CTA (desktop) | Floating sidebar | Right-margin card with "Apply Now" or "Apply via Email" + bookmark icon. Sticks to the viewport while scrolling. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton: header block, three section placeholders. |
| Loaded — active listing | Listing is still active | Full content. Apply actions are live. |
| Saved | Member taps bookmark | Bookmark fills. Toast: "Saved to your job list." |
| Unsaved | Member taps filled bookmark | Bookmark empties. Toast: "Removed from your job list" with 5-second Undo. |
| Expired listing | Listing's expiry date has passed | Full content still visible (accessible from saved list or direct link). A gray banner at the top: "This listing has expired and is no longer accepting applications." Apply action buttons are replaced with a disabled "Listing Expired" label. Bookmark is still functional. |
| Closed early | Officer closed the listing | Same treatment as expired: banner reads "This position has been filled or is no longer available." |
| Not found | Listing ID does not exist or was deleted | "This listing is not available." with a back button to the job board. |
| No access | Member navigates to a listing for an association they don't belong to | "You don't have access to this listing." with a back button. |
| Error | API failure | "Unable to load this listing. Try again." with retry button. |

## Interactions

- **"Apply via Email" button:** Opens the device's default email client pre-addressed to the contact email. The subject line is pre-filled: "Application — [Job Title]." No application data is sent through or stored by the platform.
- **"Apply Now" button:** Opens the external application URL in a new browser tab (or the device's default browser on mobile). The URL is validated at posting time (must include a protocol). No redirect through Memberry's servers.
- **Bookmark:** Same optimistic toggle as the job board list. Saved listings are accessible from `/my/saved-jobs` where the member can review them later.
- **Back navigation:** Returns to the job board at the previous scroll and filter state. If the member arrived via a notification deep link (no prior board context), the back arrow goes to the job board root (`/org/[id]/jobs`).
- **Expired listing via saved list:** Members can access expired listings from their saved list. The full detail is shown with an expired banner so members can still read the employer information (useful for re-applying later or understanding the role). The apply actions are disabled.
- **No in-platform application:** The platform explicitly does not collect resumes, cover letters, or application data. This is communicated in the employer note. Clicking apply opens an off-platform channel entirely.
