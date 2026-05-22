# Certificate Detail

- **Route:** `/my/certificates/[id]`
- **Module:** M11 Documents & Credentials
- **Access:** Member (authenticated)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Show a single training certificate in full — rendered as an on-screen preview matching the PDF layout — and let the member download it or share its verification link. This is the detail step reached from the certificates list (`/my/certificates`).

## Layout

### Desktop

Sidebar navigation visible. Main content is a single centered column (max-width 720px). A breadcrumb at the top links back to "My Certificates." Below the breadcrumb: the certificate preview card (rendered in HTML to match the PDF layout), then a row of action buttons ("Download PDF" and "Share Verification Link"), then a collapsible QR verification explanation block. The certificate preview is large enough to read without zooming; no horizontal scrolling required.

### Mobile

Full-width single column. A back arrow in the header returns to the certificates list. The certificate preview fills the screen width. Below it: a sticky footer bar with "Download PDF" (primary) and "Share" (secondary icon button). The QR verification explanation is below the sticky footer, accessible by scrolling.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Breadcrumb | Navigation | "My Certificates / [Training Title]" — "My Certificates" links back to `/my/certificates`. |
| Certificate preview | Rendered card | HTML rendering matching the PDF layout. Displays: member name, training title, training type badge (Seminar / Workshop / etc.), date(s) of training, location (venue name or "Online"), credits earned, hosting org name and logo, regulatory approval status (e.g., "PRC Approved" badge if applicable), certificate number (format: CERT-YYYY-NNNNNN), HMAC-signed QR code (rendered inline at bottom-left), and "Verified by Memberry" footer branding. The card uses a formal document aesthetic (white background, border, serif-friendly layout). |
| QR code (on preview) | Interactive element | Tapping or clicking the QR code on the preview enlarges it to full-screen for easy scanning by a third party. |
| "Download PDF" button | Primary button | Triggers browser download of the certificate PDF. The PDF is A4/Letter sized and print-friendly. Re-downloading generates the same content with the same certificate number — it is not a new generation. |
| "Share Verification Link" button | Secondary button | Copies `memberry.com/verify/[license-number]` to clipboard (desktop), or opens the native share sheet on mobile. Confirmation toast: "Verification link copied." |
| QR verification explanation | Collapsible info block | Heading: "About this QR code." Body: "Anyone who scans this QR code can verify the authenticity of this certificate. The QR proves this certificate was issued by Memberry and its data has not been tampered with. To verify current membership status, use the verification link." |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on the certificate preview area and action buttons. |
| Loaded | Data fetch succeeds | Full certificate preview renders with all fields populated. "Download PDF" and "Share Verification Link" buttons are active. |
| PDF generating | "Download PDF" clicked | Spinner on the download button; button text changes to "Generating…". Download begins automatically when ready. Button re-enables after download starts. |
| PDF error | PDF generation fails | Toast: "Could not generate your certificate. Please try again." Download button re-enables. |
| QR enlarged | Member taps QR code on preview | Full-screen overlay shows the QR code at maximum size with a close button (X) in the corner. |
| Share success | "Share Verification Link" clicked (desktop) | Toast: "Verification link copied to clipboard." |
| Not found | Certificate ID does not exist or does not belong to the member | "Certificate not found." message with a link back to "My Certificates." |
| Error | Data fetch fails | Toast: "Could not load this certificate. Please try again." Retry button shown. |

## Interactions

- Certificate availability follows BR-20: both the training end date must have passed and the member's attendance must be confirmed by an officer. Certificates that do not meet both conditions do not appear in the list and cannot be accessed directly by URL — they redirect to an error state.
- The certificate number (CERT-YYYY-NNNNNN) is unique and permanent. Re-downloading generates the same PDF with the same certificate number, not a new one.
- The QR code on the certificate is HMAC-signed (BR-18). Anyone scanning it sees: member name, training title, date, credits earned, certificate number, and a "Valid" or "Invalid" result. Tampered QR codes are detected and rejected on the public verification page.
- "Download PDF" and "Share Verification Link" are both available without any additional steps — no second confirmation required.
- On mobile, the sticky footer always shows the primary actions. The QR verification explanation is below the fold but reachable by scrolling past the footer.
- The certificate preview renders at screen width on mobile. Pinch-to-zoom is supported on the preview area for members who want to inspect fine print.
