# Member Profile

- **Route:** `/my/profile`
- **Module:** M02 Member Profile & Settings
- **Access:** Member (authenticated)
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Let the member view their professional identity and all org memberships in one place, and navigate into editing, privacy, or ID card flows.

## Layout

### Desktop
Two-column layout. Left column (1/3 width): circular profile photo (120px), member name, license number heading, specialization badge, and status pills for each org membership stacked below. Right column (2/3 width): four collapsible sections — Contact Information, Professional Details, Org Memberships (cards), and Quick Links row (Privacy, Security, ID Card, Data Export). An "Edit Profile" button sits in the top-right of the main content area.

### Mobile
Single column. Profile photo centered at top (80px, circular). Name and license number below. Specialization badge. A horizontal segmented control switches between three sections: Info, Memberships, and Links. The "Edit Profile" floating action button appears at bottom-right. Bottom nav is visible with the Profile tab active.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Profile photo | image | Circular. 120px desktop / 80px mobile. If no photo uploaded, shows a default avatar silhouette with an "Add Photo" overlay that taps to open the edit form. |
| Name + license heading | text | Full name as h1, professional license number in muted text below. License number is always visible. |
| Specialization badge | badge | Displays the member's specialization. Shows sub-specialization as secondary text if set. |
| Org membership card | card | One card per org. Shows: org logo, org name, membership category, status pill (Active=green/Grace=amber/Lapsed=red/Suspended=gray), and dues expiry date. Each card is tappable and navigates to that org's scoped dashboard. |
| "Edit Profile" button | button | Primary. On desktop: top-right of content area. On mobile: floating action button. Navigates to `/my/profile/edit`. |
| Quick links row | list | Four links: Privacy Settings, Security Settings, My ID Card (`/my/id-card`), Data Export (`/my/data-export`). |
| Contact section | section | Displays email, phone, and address. Locked fields that require going through Settings to change email (OTP-verified). |
| Professional details section | section | Displays years of practice, clinic/hospital affiliation (free text). All read-only on this screen. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton placeholders for photo circle, text lines, and org cards; shimmer animation. |
| No photo | Member has not uploaded a photo | Default avatar shown with an "Add Photo" overlay on desktop and a tap-to-upload prompt on mobile. |
| No org memberships | Member has zero org links | Org memberships section shows: "You are not a member of any organization yet. Find your chapter or ask for an invitation." with a "Search Organizations" button. |
| Multi-org, mixed statuses | Member belongs to 3+ orgs with different statuses | All org cards render independently with their own status pill; no org's status affects any other's display (M2-R14). |
| Error | Profile data fails to load | Banner: "Could not load your profile." with a "Retry" button on desktop. Pull-to-refresh prompt on mobile. |

## Interactions

- Tapping an org membership card navigates to that org's scoped member dashboard.
- Tapping "Edit Profile" navigates to `/my/profile/edit` (the editable form with photo crop dialog).
- Tapping "Privacy Settings" navigates to `/my/settings` with the Privacy tab open.
- Tapping "Security Settings" navigates to `/my/settings` with the Security tab open.
- Pull-to-refresh on mobile reloads the full profile.
- Email changes are not made from this screen — the member is directed to Security Settings where OTP verification is required.
