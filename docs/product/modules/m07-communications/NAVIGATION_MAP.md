---
name: navigation-map
module: m07-communications
route-count: 18
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.716Z
status: INFERRED — needs human review
---

# Navigation Map — m07-communications

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

## Routes (18)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/communications/email` | `/communications/email` | EmailHealth | admin | — | — | — |
| `/communications/` | `/communications/` | CommunicationsBroadcasts | admin | — | — | — |
| `/communications/moderation` | `/communications/moderation` | ModerationQueue | admin | — | — | — |
| `/communications/templates` | `/communications/templates` | PlatformTemplates | admin | — | — | — |
| `/_authenticated/my/notifications` | `/my/notifications` | NotificationsPage | memberry | yes | — | — |
| `/_authenticated/org/$orgSlug/announcements/$announcementId` | `/org/$orgSlug/announcements/$announcementId` | MemberAnnouncementPage | memberry | yes | orgSlug, announcementId | — |
| `/_authenticated/org/$orgSlug/announcements/` | `/org/$orgSlug/announcements/` | MemberAnnouncementFeed | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/messages/` | `/org/$orgSlug/messages/` | MessagesIndexPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/communications` | `/org/$orgSlug/officer/communications` | — | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/messages/dm/` | `/org/$orgSlug/messages/dm/` | DmIndexPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/communications/$announcementId` | `/org/$orgSlug/officer/communications/$announcementId` | AnnouncementDetailPage | memberry | yes | orgSlug, announcementId | — |
| `/_authenticated/org/$orgSlug/officer/communications/analytics` | `/org/$orgSlug/officer/communications/analytics` | AnalyticsDashboardPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/communications/` | `/org/$orgSlug/officer/communications/` | OfficerCommunications | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/communications/new` | `/org/$orgSlug/officer/communications/new` | NewAnnouncementPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/communications/sent` | `/org/$orgSlug/officer/communications/sent` | SentHistoryPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/messages/` | `/org/$orgSlug/officer/messages/` | OfficerMessagesPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/communications/templates/` | `/org/$orgSlug/officer/communications/templates/` | TemplateListPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/communications/templates/new` | `/org/$orgSlug/officer/communications/templates/new` | NewTemplatePage | memberry | yes | orgSlug | — |

## Derivation


## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
