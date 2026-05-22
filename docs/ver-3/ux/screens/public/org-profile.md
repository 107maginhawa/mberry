# Org Public Profile

- **Route:** `/org/[slug]`
- **Module:** M04 Organization Admin
- **Access:** Public (no authentication required); SEO-indexed
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Give any visitor (prospective member, public, or current member) a publicly accessible snapshot of the organization and provide a direct path to apply for membership.

## Layout

### Desktop
Single-page layout with no sidebar. A minimal top navigation bar with the platform logo and "Log In" / "Sign Up" links (replaced by "Dashboard" if the visitor is authenticated). Below the nav: a full-width header band with the org logo, org name, org type badge, and founding date. The body content flows in a single centered column (max-width 800px) divided into labeled sections: About, Contact, Officers, Upcoming Activities, and Stats. A sticky "Apply to Join" button anchors to the bottom-right of the viewport (visible at all scroll positions). Footer with platform legal links.

### Mobile
Top nav collapses to logo + "Log In" link (no hamburger needed at this size). Header band stacks logo above org name and badges, full-width. Each body section stacks vertically at full width. The "Apply to Join" button becomes a full-width sticky bar at the bottom of the viewport — sits above the browser chrome — with the org name as a one-line label above the button for context when the user has scrolled away from the header.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Top nav | nav | Platform logo (links to `/`); "Log In" links to `/login`; "Sign Up" links to `/register?org=[slug]`; replaced by "Go to Dashboard" if visitor is authenticated |
| Org logo | image | Uploaded org logo; falls back to a circle with org initials if no logo is set |
| Org name | text (display) | Full organization name |
| Org type badge | badge | One of: Chapter / Society / National / Clinic |
| Founding date | text | "Founded [year]" or "Founded [Month Year]" |
| About section | text block | Org description text (max 2,000 characters); section hidden if description is empty |
| Contact section | data list | Contact email, phone, address, website URL (opens in new tab), meeting schedule text (e.g., "Every 2nd Tuesday, 7PM"); only populated fields shown |
| Officers section | list | Each officer: full name + role title; no contact info exposed; sorted by role seniority (President first) |
| Upcoming Activities section | card list | Up to 5 upcoming activities/events marked as shared to the network; each card: activity name, date, brief description; section hidden if no shared activities |
| Member count | stat | "Active Members: [N]" — shows count of active members only (not Grace or Lapsed) |
| Apply to Join | button (primary, sticky) | If visitor is not logged in: navigates to `/register?org=[slug]` to create an account and apply simultaneously. If visitor is logged in: submits a membership application directly to this org (triggers application review queue in M05) and confirms with a toast. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page first loads | Page is server-rendered; sections with no data are hidden server-side; no client-side loading skeleton needed for the initial render |
| Org not found | `[slug]` does not match any organization | Standard 404 page: "Organization not found." with a link back to the platform home |
| Org suspended/inactive | Org record is flagged inactive | Page body replaced with: "This organization is currently inactive." Header with org name and logo still shown for identification. Apply to Join button hidden. |
| No logo | Org has no uploaded logo | Initials placeholder: one or two letters from org name in a colored circle |
| No description | Org description field is empty | About section is hidden entirely; no placeholder text shown |
| No shared activities | Org has no upcoming shared activities | Upcoming Activities section is hidden entirely |
| Visitor logged in, not yet a member | Authenticated visitor who is not a member of this org | "Apply to Join" button visible and functional; submits application on click |
| Visitor logged in, already a member | Authenticated visitor who is already an active/grace/lapsed member | "Apply to Join" button replaced by "[Your status] Member" badge (e.g., "Active Member"); no application action available |
| Visitor logged in, pending application | Authenticated visitor with an existing pending application | "Apply to Join" button replaced by "Application Pending" badge; clicking shows tooltip: "You already have a pending application for this organization." |
| Apply to Join: Success (logged in) | Logged-in visitor clicks Apply and application is submitted | Toast notification: "Application submitted. Waiting for approval from [Org Name]." Button changes to "Application Pending" badge. |
| Apply to Join: Duplicate error | Member already has pending application (edge case, e.g., concurrent tab) | Toast error: "You already have a pending application for this organization." |

## Interactions

- Page must load in under 2 seconds for unauthenticated visitors (M04 acceptance criterion); it is server-rendered and SEO-friendly with a canonical URL.
- The "Apply to Join" sticky button is visible at all scroll depths on both desktop and mobile — this is the primary conversion action on the page.
- Clicking "Apply to Join" when not logged in routes to `/register?org=[slug]`; the `?org=[slug]` param causes the registration screen to show an org badge at the top and queues the membership application upon successful email verification.
- Officer names in the Officers section are not linked to profiles and no contact information is shown — only name and role are publicly exposed.
- The website URL in Contact opens in a new tab (`target="_blank"` with `rel="noopener noreferrer"`).
- The Activities section only shows activities that the org has explicitly marked as shared to the network — private events are not visible.
- Member count reflects active members only; Grace and Lapsed members are not included in the public count.
- The slug is the stable identifier in the URL; if the org changes its name, the slug remains unchanged to preserve inbound links.
