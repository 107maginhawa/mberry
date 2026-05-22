# My Data Export

- **Route:** `/my/data-export`
- **Module:** M02 Member Profile & Settings
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Allow the member to exercise their data portability right by requesting and downloading a complete export of all their personal data in a portable format (DPA compliance).

## Layout

### Desktop
Single-column, max-width 600px, centered within the authenticated shell (left sidebar visible). The top section is a plain-language explanation of what the export contains and the expected wait time. A "Request Data Export" primary button is below the explanation. A "Previous Exports" table lists past export requests with their status and download links.

### Mobile
Full-width. Same structure. The explanation is rendered as collapsible text (expandable "What's included?" section to keep the primary action prominent). The previous exports list becomes a card stack. Bottom nav is visible with Profile tab active.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Export explanation | text | Plain-language description of what will be included: "Your export will contain a ZIP file with the following: profile.json (all profile fields), payments.json (all payment records with receipts), credits.json (all credit entries with source details), activities.json (all event and training participation records), summary.pdf (a human-readable summary of your data). Your export is usually ready within a few hours." |
| "Request Data Export" button | button | Primary. Disabled if an export is already in progress (M2-R4: rate-limited to 1 request per 24 hours). |
| Confirmation dialog | modal | Opens when the member clicks "Request Data Export." Body: "This will generate a ZIP file with all your personal data. Continue?" Confirm and Cancel buttons. |
| Previous exports table | list | Columns: Date Requested, Status badge (Processing=blue / Ready=green / Expired=gray / Failed=red), Action (Download button if Ready; "Request New Export" link if Expired; "Retry" button if Failed). |
| Download button | button | On Ready exports. Triggers browser file download of the ZIP. |
| Processing indicator | progress | Indeterminate spinner or animated progress indicator next to a "Processing" export row. Text: "Your export is being prepared. You will be notified when it is ready." |
| Expiry notice | text | On Ready exports: "Download available until [date] (7 days from generation)." |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton for explanation text and table; resolves quickly. |
| No previous exports | Member has never requested an export | Previous exports section shows: "You have not requested a data export before. Your export will include your profile, payments, credits, and activity history." |
| Export in progress | Member has a recent request that is still processing | "Request Data Export" button is disabled with tooltip: "An export is already in progress. You will be notified when it is ready." A processing row appears in the previous exports table with an indeterminate indicator. |
| Rate limited | Member attempts a second request within 24 hours | Button is disabled. Helper text below: "You can request one export per 24 hours. Your most recent request was on [date]." |
| Export ready | Async job completes and notification is sent | Status changes to "Ready" with a green badge. Download button appears. Expiry date shown. Member receives an in-app notification and email (M2, M-9). |
| Download triggered | Member clicks Download | Browser native file download begins. ZIP contains all five files: profile.json, payments.json, credits.json, activities.json, summary.pdf. |
| Export expired | 7 days have passed since generation | Row status changes to "Expired" with a gray badge. "Request New Export" link replaces the download button. |
| Export failed | Async job fails | Row shows "Failed" red badge and a "Retry" button. A platform admin is also notified of the failure (M2, M-9 error paths). |
| Error | Page data fetch fails | Toast: "Could not load export history. Please try again." |

## Interactions

- "Request Data Export" opens a confirmation dialog before submitting. Dismissing the dialog cancels the request; the button remains active.
- After confirmation, the request is submitted asynchronously. The page immediately shows the new export row with "Processing" status without a page reload.
- The member is notified via in-app notification AND email when the export is ready (M2-R6 behavior: member receives both channels). Clicking the in-app notification navigates directly to this page.
- Download links expire after 7 days. After expiry, the member must submit a new request. Rate limiting (1 export per 24 hours per M2-R4) means they must wait a day after the expired download before requesting again, unless the system clock has rolled past the 24-hour window.
- The "Retry" button on a failed export attempts re-generation of the same request rather than creating a new request. It is not counted against the 24-hour rate limit.
