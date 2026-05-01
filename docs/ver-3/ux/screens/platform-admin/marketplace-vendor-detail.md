# Marketplace Vendor Detail

- **Route:** `/admin/marketplace/vendors/[id]`
- **Module:** M17 Marketplace
- **Access:** Platform Admin (all roles)
- **Phase:** 3
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give operators a complete view of a single marketplace vendor — their application documents, listings, revenue-share disclosure status, and account controls to verify, reject, or suspend them.

## Layout

Full-width vendor detail page. A profile header at the top shows the vendor's identity, status, and account action buttons. Below the header, three tabs: Application & Documents, Listings, and Revenue Share. A breadcrumb links back to the vendor list. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Breadcrumb | Navigation | "Marketplace > Vendors > [Company Name]." |
| Header: company name | Display | Large company name, category sub-label (e.g., "EMR / Clinic Software"). |
| Status badge | Badge | Pending (amber), Verified (green with checkmark), Suspended (red). |
| Verified badge preview | Display (Verified state only) | Shows the "Verified" badge as it appears on marketplace listings, for visual confirmation. |
| Application date | Display | Date the vendor submitted their application. |
| Contact details | Display | Company contact name, email, phone. |
| "Verify" button | Primary button (Pending state only) | Approves the vendor. Confirmation: "Verify [Company Name]? Their listings will become visible to members and a Verified badge will be applied to all their listings." Saves with admin ID and timestamp. |
| "Reject" button | Secondary button (Pending state only) | Opens a modal with a required rejection reason field. Reason is sent to the vendor via email. Vendor record retained with status "Rejected" for audit. |
| "Suspend" button | Destructive button (Verified state only) | Opens a modal with a required reason field. Confirmation: "Suspending this vendor will immediately hide all [N] of their listings from members. Continue?" On confirm: vendor status = Suspended, all listings hidden. |
| "Reinstate" button | Secondary button (Suspended state only) | Restores the vendor to Verified status. Listings are restored to visible. Confirmation required. |
| Tab: Application & Documents | Tab | Submitted application details and document review interface. |
| Application review panel | Display section | Fields submitted by the vendor: business registration number, relevant license types, description of products/services, website URL. Each document (uploaded files) shown with a download link and a review status chip (Pending / Accepted / Flagged). Admin can mark individual documents as Accepted or Flagged with an optional note. |
| Document checklist | Checklist | Items: Business Registration (required), Relevant Licenses (required), Product/Service Documentation (required). Check marks as each is accepted. |
| Review notes | Text area | Internal admin notes visible only to the admin team. "Save Notes" button. |
| Tab: Listings | Tab | Table of all listings submitted by this vendor. Columns: Listing Title, Category, Status (Active / Hidden / Pending), Member Rating (average stars, review count), Created Date. Row links to the member-facing listing detail (opens in new tab). Per-row "Hide" / "Show" toggle for Super Admins to manage individual listing visibility. |
| Tab: Revenue Share | Tab | Revenue-share disclosure configuration and history for this vendor. |
| Revenue share terms | Display / Edit | Whether a referral fee or revenue-share arrangement exists for this vendor's products (per BR-38). If yes: fee percentage or flat amount, disclosure text as it appears to members, effective date. "Edit Terms" button (Super Admin only). |
| Disclosure preview | Display | Shows the disclosure text exactly as it renders on the product detail page and in the adoption/application confirmation flow. Confirms the text is compliant with BR-38. |
| Revenue history | Table | Monthly revenue-share payments: period, products sold/adopted, gross revenue attributed, platform share, payment status (Pending / Paid). |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton for header and tabs. |
| Pending verification | Status = Pending | Application tab is active by default. Document checklist shows unchecked items. "Verify" and "Reject" buttons prominent. |
| Verified | Status = Verified | Green status badge + verified badge preview. "Suspend" button available. Listings tab shows active listings. |
| Suspended | Status = Suspended | Red status badge. Amber banner: "This vendor is suspended. All listings are hidden from members." "Reinstate" button prominent. |
| No listings | Listings tab, vendor has not created any listings | "This vendor has not created any listings yet." |
| No revenue share | Revenue share tab, no arrangement exists | "No revenue-share arrangement configured for this vendor. All purchases through this vendor's listings generate no platform revenue." Note to confirm if this is intentional. |
| Documents not yet reviewed | Application tab, documents pending | Each document shows "Pending" chip. The "Verify" button is disabled with tooltip: "Review and accept all required documents before verifying this vendor." |
| Error | Any tab fetch fails | Inline error per tab with retry. |

## Interactions

- "Verify" is blocked until all required documents in the checklist are marked as Accepted; the button is disabled with a tooltip explaining the requirement.
- "Suspend" hides all listings immediately; members see no listings from this vendor until reinstatement.
- "Reinstate" restores all listings to their prior visibility state (Active listings become visible again; listings that were manually Hidden by an admin before suspension remain Hidden).
- Individual listing "Hide / Show" toggles (Listings tab) allow Super Admins to manage a single listing's visibility independently of the vendor's overall status.
- Revenue share terms editing opens an inline form; changes to the disclosure text take effect on the product detail page immediately after save.
- All account status changes are logged in the platform audit trail with admin ID and timestamp.
- Document download links open uploaded files in a new tab; files are served from secure storage and do not require a separate login.
