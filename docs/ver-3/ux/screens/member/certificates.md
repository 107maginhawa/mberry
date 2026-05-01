# My Certificates

- **Route:** `/my/certificates`
- **Module:** M09 Training, M11 Documents & Credentials
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Give the member a consolidated list of all training completion certificates they can download, with access to preview and share each one.

## Layout

### Desktop
Single-column, max-width 720px, centered within the authenticated shell (left sidebar visible). Page heading: "My Certificates." A card grid (2 columns on desktop) lists all certificates. Each card is compact: training title, date, hosting org, credits earned, and a "Download" button. Clicking a card or the "View" link navigates to the individual certificate detail page (`/my/certificates/[id]`) for a full preview before download.

### Mobile
Full-width. Cards stack in a single column. Tapping a card navigates to the certificate detail page. A "Download" icon button on each card allows direct download without navigating away. Bottom nav is visible with Profile tab active.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Certificate card | card | Compact card showing: training title, training type badge (Seminar / Workshop / etc.), date(s), hosting org name + org logo thumbnail, credits earned badge (e.g., "5 CPD"), certificate number (e.g., CERT-2026-04821), regulatory approval status (PRC Approved badge if applicable). |
| "Download" button | button | Primary (small). On each card. Triggers PDF download directly or navigates to the certificate detail page. |
| "View" link | link | On each card. Navigates to `/my/certificates/[id]` for the full preview. |
| Certificate detail page link | link | Navigates to `/my/certificates/[id]` which shows: rendered certificate preview (as it appears in PDF), "Download PDF" primary button, "Share Verification Link" button, and the verification QR code explanation. |
| Search / filter | filter | A search input at the top for filtering by training title or org name. Optional date range filter. Useful when member has many certificates. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton cards with shimmer; 2-column grid on desktop. |
| Empty | Member has no certificates yet | Full-page illustrated empty state: "No certificates yet. Complete a training to receive your certificate of attendance." with a "Browse Trainings" link navigating to the training discovery feed. |
| Filtered — no results | Search/filter matches no certificates | Inline message: "No certificates match your search." with a "Clear filters" link. |
| Single certificate | Member has exactly one certificate | Card renders in a single column; no visual awkwardness from an empty second column. |
| Error | Data fetch fails | Toast: "Could not load your certificates. Please try again." Retry button. |

## Interactions

- The certificate detail page (`/my/certificates/[id]`) renders the certificate as an HTML preview matching the PDF layout: member name, training title, training type, date(s), location, credits earned, hosting org name and logo, certificate number, "Verified by Memberry" footer, and the HMAC-signed verification QR code.
- "Download PDF" on the detail page triggers browser download of the PDF. PDFs are A4/Letter sized and print-friendly (M9, M-21 success criteria).
- "Share Verification Link" copies the verification URL to clipboard or opens the native share sheet on mobile. The URL is `memberry.com/verify/[license-number]`, which shows current real-time status.
- Tapping the QR code on the certificate preview enlarges it to full-screen for easy scanning by a third party.
- QR codes on certificates are HMAC-signed (BR-18). Anyone scanning the QR sees: member name, training title, date, credits, certificate number, and a "Valid" or "Invalid" verification result. Tampered certificates are detected and rejected.
- Certificates are only available when both conditions are met: training date has passed AND attendance is confirmed (BR-20). A certificate that is not yet available does not appear in this list; it appears in `/my/training` with a status note instead.
- Certificate numbers are unique and permanent (format: CERT-YYYY-NNNNNN per M9-R7). Re-downloading the same certificate generates the same content with the same certificate number — it is not a new generation.
