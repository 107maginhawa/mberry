# 03 Route Navigation Audit — App Shell / Navigation

**Module**: App Shell / Navigation
**Audit Date**: 2026-05-26

---

## Route Tree Summary

### Public Routes (no auth)
- `/auth/sign-in`, `/auth/sign-up`, etc. — Better-Auth UI routes
- `/org/:orgSlug` — public org profile (auth spec confirms accessible without login)

### Authenticated Routes (`_authenticated.tsx` layout)

#### Personal (`/my/*`)
| Route | File |
|---|---|
| `/dashboard` | `_authenticated/dashboard.tsx` |
| `/my/profile` | `_authenticated/my/profile.tsx` |
| `/my/settings` | `_authenticated/my/settings.tsx` |
| `/my/billing` | `_authenticated/my/billing.tsx` |
| `/my/calendar` | `_authenticated/my/calendar.tsx` |
| `/my/events` | `_authenticated/my/events.tsx` |
| `/my/credits` | `_authenticated/my/credits/index.tsx` |
| `/my/credits/log` | `_authenticated/my/credits/log.tsx` |
| `/my/training` | `_authenticated/my/training.tsx` |
| `/my/certificates` | `_authenticated/my/certificates/index.tsx` |
| `/my/certificates/:id` | `_authenticated/my/certificates/$certificateId.tsx` |
| `/my/payments` | `_authenticated/my/payments.tsx` |
| `/my/notifications` | `_authenticated/my/notifications.tsx` |
| `/my/organizations` | `_authenticated/my/organizations.tsx` |
| `/my/schedule` | `_authenticated/my/schedule.tsx` |
| `/my/bookings` | `_authenticated/my/bookings/index.tsx` |
| `/my/bookings/:id` | `_authenticated/my/bookings/$bookingId.tsx` |
| `/my/bookings/host/:personId` | `_authenticated/my/bookings/host.$personId.tsx` |
| `/my/data-export` | `_authenticated/my/data-export.tsx` |
| `/my/surveys` | `_authenticated/my/surveys/index.tsx` |
| `/my/surveys/:id` | `_authenticated/my/surveys/$surveyId.tsx` |
| `/my/id-card` | `_authenticated/my/id-card.tsx` |

#### Org-scoped Member (`/org/:orgSlug/*`)
| Route | File |
|---|---|
| `/org/:orgSlug/home` | (inferred from sidebar link) |
| `/org/:orgSlug/directory` | `org/$orgSlug/directory.tsx` |
| `/org/:orgSlug/directory/:personId` | `org/$orgSlug/directory/$personId.tsx` |
| `/org/:orgSlug/documents` | `org/$orgSlug/documents/index.tsx` |
| `/org/:orgSlug/documents/:id` | `org/$orgSlug/documents/$documentId.tsx` |
| `/org/:orgSlug/announcements` | `org/$orgSlug/announcements/index.tsx` |
| `/org/:orgSlug/announcements/:id` | `org/$orgSlug/announcements/$announcementId.tsx` |
| `/org/:orgSlug/events` | (inferred from sidebar) |
| `/org/:orgSlug/dues` | (inferred from bottom nav) |
| `/org/:orgSlug/messages` | (inferred from bottom nav) |
| `/org/:orgSlug/governance` | (inferred from sidebar) |
| `/org/:orgSlug/my-cpd` | (inferred from sidebar) |

#### Officer (`/org/:orgSlug/officer/*`)
| Route | File |
|---|---|
| `/org/:orgSlug/officer/dashboard` | `officer/dashboard.tsx` |
| `/org/:orgSlug/officer/roster` | (inferred from nav) |
| `/org/:orgSlug/officer/applications` | `officer/applications.tsx` |
| `/org/:orgSlug/officer/dues/treasurer` | `officer/dues/treasurer.tsx` |
| `/org/:orgSlug/officer/dues/assessments` | `officer/dues/assessments.tsx` |
| `/org/:orgSlug/officer/dues/member.:memberId` | `officer/dues/member.$memberId.tsx` |
| `/org/:orgSlug/officer/events` | (inferred from nav) |
| `/org/:orgSlug/officer/training` | (inferred from nav) |
| `/org/:orgSlug/officer/communications` | `officer/communications.tsx` |
| `/org/:orgSlug/officer/communications/index` | `officer/communications/index.tsx` |
| `/org/:orgSlug/officer/communications/new` | `officer/communications/new.tsx` |
| `/org/:orgSlug/officer/communications/sent` | `officer/communications/sent.tsx` |
| `/org/:orgSlug/officer/communications/analytics` | `officer/communications/analytics.tsx` |
| `/org/:orgSlug/officer/communications/templates` | `officer/communications/templates/index.tsx` |
| `/org/:orgSlug/officer/communications/templates/new` | `officer/communications/templates/new.tsx` |
| `/org/:orgSlug/officer/compliance` | `officer/compliance.tsx` |
| `/org/:orgSlug/officer/certificates` | `officer/certificates.tsx` |
| `/org/:orgSlug/officer/documents` | `officer/documents/index.tsx` |
| `/org/:orgSlug/officer/documents/:id` | `officer/documents/$documentId.tsx` |
| `/org/:orgSlug/officer/elections` | (inferred from nav) |
| `/org/:orgSlug/officer/settings/org` | (inferred from nav) |
| `/org/:orgSlug/officer/settings/dues` | `officer/settings/dues.tsx` |
| `/org/:orgSlug/officer/settings/funds` | `officer/settings/funds.tsx` |
| `/org/:orgSlug/officer/settings/membership-categories` | (inferred from nav) |
| `/org/:orgSlug/officer/settings/gateway` | (inferred from nav) |
| `/org/:orgSlug/officer/officers` | (inferred from nav) |
| `/org/:orgSlug/officer/reports/credits` | (inferred from nav) |
| `/org/:orgSlug/officer/payments` | (inferred from nav) |

---

## Sidebar Navigation Links

### Member Sidebar (Desktop)
**Personal mode** (no orgSlug in URL):
- Home (`/dashboard`)
- My Profile (`/my/profile`)
- Training (`/my/training`)
- Events (`/my/events`)
- Calendar (`/my/calendar`)
- Schedule (`/my/schedule`)
- Certificates (`/my/certificates`)
- Settings (`/my/settings`)
- My Surveys (`/my/surveys`)
- [Officer View link shown if `isOfficer=true`]

**Org mode** (orgSlug in URL):
- Org Home (`/org/:orgSlug/home`)
- Directory (`/org/:orgSlug/directory`)
- My CPD (`/org/:orgSlug/my-cpd`)
- Events (`/org/:orgSlug/events`)
- Dues (`/org/:orgSlug/dues`)
- Announcements (`/org/:orgSlug/announcements`)
- Governance (`/org/:orgSlug/governance`)
- Documents (`/org/:orgSlug/documents`)

### Member Bottom Nav (Mobile)
**Personal mode**: Home, Events, Credits, Profile
**Org mode**: Home, Events, Dues, Messages, More (Governance)

### Officer Sidebar (Desktop)
Sections vary by position. Full president view:
- Dashboard
- MEMBERS: Roster, Applications, Upload Members
- FINANCES: Payment Records, Dues Config, Treasurer
- ACTIVITIES: Events, Trainings, Elections
- COMMUNICATIONS: Announcements, Templates, Sent, Analytics
- GOVERNANCE: Elections
- FEEDBACK: Credit Reports
- DOCUMENTS: Credit Reports
- SETTINGS: Org Profile, Officers, Categories, Payment Gateway

---

## Potential Broken Links / Issues

| Severity | Issue | Evidence |
|---|---|---|
| P2 | Bottom nav has `Messages` → `/org/:orgSlug/messages` but no route file found in audit | No file found at `org/$orgSlug/messages.tsx` in route tree |
| P2 | Bottom nav has `Dues` → `/org/:orgSlug/dues` but no route file found in audit | No file found at `org/$orgSlug/dues.tsx` in route tree |
| P2 | `Governance` → `/org/:orgSlug/governance` no route file found | Not in routes-structure output |
| P2 | `My CPD` → `/org/:orgSlug/my-cpd` no route file found | Not in routes-structure output |
| P1 | OrgIconRail "Join org" button links to `/my/organizations` (non-org) path via typed `as "/"` cast | `org-icon-rail.tsx`: `to={"/my/organizations" as "/"}` — type cast suppresses TS checking |
| INFO | OrgIconRail `+` button links to `/join` — no route file found for this path | `org-icon-rail.tsx`: `to="/join"` (bottom Plus button nav) |
| INFO | UUID-to-slug redirect in org route correctly normalizes legacy URLs | `route.tsx` regex + redirect logic |

---

## Navigation Consistency

- Desktop sidebar and mobile bottom nav serve different link sets — consistent with responsive design intent
- Sidebar mode switches (personal vs org) based on URL `orgSlug` param — no explicit state management, driven purely by URL
- Officer sidebar's "Back to member view" links to `/dashboard` — correct
- OfficerMobileNav Bell icon links to `/my/notifications` — cross-context link but acceptable UX
