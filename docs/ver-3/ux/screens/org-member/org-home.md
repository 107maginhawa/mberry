# Org Home (Member View)

- **Route:** `/org/[id]/home`
- **Module:** M04 Org Admin, M08 Events, M09 Training
- **Access:** Member (must be active member of this org)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Give members a single landing page for their org that surfaces the most important upcoming activities and officer announcements so they know what is happening without navigating to multiple sections.

## Layout

### Desktop
Left sidebar carries the org's navigation (Home, Events, Training, Members, Feed). The main content area is a two-column layout: a wider primary column with a reverse-chronological announcement and activity feed, and a narrower sidebar column showing the member's own membership status badge, dues expiry, and a compact list of the next 3 upcoming events/trainings. The org name and logo appear as a header above the content area, distinct from the platform-level global nav.

### Mobile
The org name and logo appear in a sticky top header (replacing the global header while in org context). A bottom tab bar provides navigation (Home, Events, Training, Members, Feed). The content is a single-column scrollable feed of announcements and upcoming activities, with the member's membership status card pinned just below the org header (dismissible after first view). No sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Org Identity Header | Header strip | Org logo, org name, org type badge (Chapter / Society / National / Clinic). Appears on all org-context screens. |
| Member Status Card | Info card | Shows member's current status (Active / Grace / Lapsed), membership category, and dues expiry date. Grace/Lapsed states show a warning color and a "Renew Dues" CTA link. Suspended members see a banner explaining restricted access. |
| Pinned Announcement | Featured card | If an officer has pinned an announcement, it appears at the top of the feed above chronological content. Pin icon + "Pinned" label. Only one pinned announcement per org. |
| Activity Feed | Scrollable list | Reverse-chronological feed of: officer announcements, upcoming events (published, not cancelled), upcoming trainings (published). Each item shows its type icon, title, date, and a "View" link. |
| Upcoming Events Strip | Widget (desktop sidebar / collapsed section on mobile) | Next 3 upcoming events with date and type badge. "See all events" link to `/org/[id]/events`. |
| Upcoming Trainings Strip | Widget (desktop sidebar / collapsed section on mobile) | Next 3 upcoming trainings with credit value badge. "See all trainings" link to `/org/[id]/training`. |
| Officer Roster Mini | Widget (desktop sidebar only) | Lists current officers with name and role. Tapping a name does nothing (members cannot view officer contact info from here). |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton cards for announcement feed and widgets; org header shows immediately from cached org profile. |
| Empty | New org with no published content | "Nothing here yet. Your chapter's events and announcements will appear here." No widgets shown. |
| Lapsed member | Member's dues have expired beyond grace period | Member Status Card shows red "Lapsed" badge. A persistent full-width banner above the feed reads: "Your membership has lapsed. Renew to access all features." Feed is visible but RSVP/enroll actions are disabled on linked items. |
| Grace member | Member's dues expired, within grace period | Member Status Card shows amber "Grace" badge with days remaining until lapse. Non-blocking banner with "Renew Dues" CTA. Feed fully functional. |
| Suspended | Officer has suspended this member | Member sees a blocking banner: "Your account has been suspended. Contact your chapter officers." Feed content is hidden. |
| Error | Feed fails to load | "Unable to load your chapter home. Pull down to retry." Retry button shown. |

## Interactions

- Tapping any activity card (event or training) in the feed navigates to the respective detail screen (`/org/[id]/events/[id]` or `/org/[id]/training/[id]`).
- Tapping "Renew Dues" on the member status card or banner navigates to the dues payment flow (M06).
- The feed does not paginate on first load — it shows the 20 most recent items. "Load more" appears at the bottom.
- Pull-to-refresh on mobile refreshes the feed and the member status card.
- Officers see the same member view (no admin controls on this screen; officer-only controls live under `/org/[id]/officer/`).
