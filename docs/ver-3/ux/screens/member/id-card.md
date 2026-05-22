# My ID Card

- **Route:** `/my/id-card`
- **Module:** M02 Member Profile & Settings, M05 Membership, M11 Documents & Credentials
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Let the member view, download, and share their digital membership ID card for each organization they belong to, with a verifiable HMAC-signed QR code.

## Layout

### Desktop
Centered layout, max-width 680px, within the authenticated shell (left sidebar visible). At the top: an org selector (horizontal tabs or pill strip, one per org the member belongs to). Below: the ID card preview rendered as an HTML card in credit-card proportions (landscape, approximately 3.37" × 2.125" at 96dpi). Below the card: a QR explanation paragraph, then two action buttons side by side ("Download PDF" and "Share Verification Link").

### Mobile
Full-width. Org selector is a horizontally scrollable strip of org name pills; the active org is highlighted. The card preview fills screen width. The QR code on the card is tappable to enlarge it to full-screen (for someone else to scan). Sticky footer with "Download" and "Share" buttons. Bottom nav is visible with Profile tab active.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Org selector | tabs/pills | One tab or pill per org the member belongs to. Selecting an org instantly regenerates the card preview for that org. Hidden if the member belongs to only one org. |
| ID card preview | card | Rendered as HTML mimicking the PDF layout. Contains: member photo (circular crop) or default avatar silhouette, full name, license number, org name, org logo, membership category, status pill (Active=green / Grace=amber / Lapsed=red stamp), dues expiry date, generation date, HMAC-signed QR code, platform branding footer ("Verified by Memberry"). |
| Lapsed overlay | badge | When membership status is Lapsed, a red "LAPSED" stamp is overlaid diagonally across the card. The card is still downloadable. |
| QR code area | image | The QR code on the card preview is tappable/clickable to enlarge it to a full-screen overlay (for easy scanning by another person). The overlay shows the QR at full size with a close button. |
| QR explanation | text | Below the card: "Anyone can scan this QR code to verify your membership status. The QR proves this card was issued by Memberry. For real-time status, scan opens the verification page." |
| "Download PDF" button | button | Primary. Generates the PDF with current data and a new generation timestamp. Button shows "Generating your ID card…" spinner while generating. Download is triggered on completion. |
| "Share Verification Link" button | button | Secondary. Copies the verification URL (`memberry.com/verify/[license-number]`) to clipboard on desktop, or opens the native share sheet on mobile. |
| Staleness notice | info | If the card was last generated more than 30 days ago (tracked via `generation_date`), a notice appears below the card: "This card was last generated on [date]. Regenerate for the most current status." with a "Regenerate" link. |
| No photo notice | info | If member has no profile photo: "Add a profile photo for a complete ID card." with a link to `/my/profile/edit`. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load or org switch | Card area shows a blurred skeleton placeholder with shimmer; button states are disabled. |
| Active membership | Status is Active | Green status pill on card. Clean card design, no overlay. |
| Grace membership | Status is Grace | Amber status pill on card. Card otherwise renders normally. |
| Lapsed membership | Status is Lapsed | Red "LAPSED" diagonal stamp across card. Card is still downloadable. Notice below card: "Your membership has lapsed. Pay dues to restore Active status." with a "Pay Dues" link. |
| No active memberships | Member has no org membership | Full-page message: "Join an organization to get your digital member ID card." with a "Find Organizations" link. |
| PDF generating | Member clicks "Download PDF" | Button text changes to "Generating your ID card…" with a spinner. Button is disabled during generation. |
| PDF error | PDF generation fails | Toast: "Could not generate your ID card. Please try again." Button re-enables immediately. |
| Share success | Member clicks "Share Verification Link" | Toast: "Verification link copied to clipboard." (Desktop.) On mobile, native share sheet opens. |

## Interactions

- Switching orgs via the org selector updates the card preview instantly (client-side re-render with the new org's data); no page navigation or loading state is triggered unless data must be fetched from the server.
- Tapping the QR code on the card preview opens a full-screen overlay displaying the QR at maximum resolution with a countdown if the QR is time-limited; close button (X) returns to the card view.
- QR code payload contains: member ID, org ID, document type (ID_CARD), issue/generation date, and HMAC signature (BR-18). The signature is validated offline for authenticity; real-time membership status requires the online verification URL.
- "Download PDF" generates the PDF with the current timestamp as the generation date — each download is a fresh generation (M2-R7, M11, 11.1).
- The verification URL opened by QR scan is `memberry.com/verify/[license-number]`, which shows the member's current live status (not the status at card generation time).
