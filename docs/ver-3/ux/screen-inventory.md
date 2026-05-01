# Memberry Screen Inventory — PRD v3

This document is the authoritative route and screen inventory for the Memberry platform across all modules and phases. All other module files, routing configs, and implementation references must defer to this file — no route defined elsewhere overrides what is listed here.

**Phases:** Phase 1 (Core), Phase 2 (Professional Identity + Community), Phase 3 (Advanced Engagement)

---

## 1. Public Screens

Accessible without authentication. Covers marketing, onboarding, public org profiles, and verification flows.

| Route | Screen Name | Module(s) | Phase | Desktop | Mobile |
|---|---|---|---|---|---|
| `/` | Landing / marketing home | M01 | 1 | ✓ | ✓ |
| `/login` | Login (email + password) | M01 | 1 | ✓ | ✓ |
| `/register` | Member self-registration | M01 | 1 | ✓ | ✓ |
| `/register/verify` | OTP verification step | M01 | 1 | ✓ | ✓ |
| `/forgot-password` | Password reset request | M01 | 1 | ✓ | ✓ |
| `/reset-password` | Password reset (OTP-based, no token in URL) | M01 | 1 | ✓ | ✓ |
| `/org/[slug]` | Org public profile + Apply to Join | M02 | 1 | ✓ | ✓ |
| `/verify/[token]` | QR code verification (HMAC check result) | M03 | 1 | ✓ | ✓ |
| `/pay/[token]` | One-tap payment page (tokenized dues link) | M06 | 1 | ✓ | ✓ |
| `/invite/[token]` | Member invitation claim + set password | M03 | 1 | ✓ | ✓ |

---

## 2. Member Screens

Authenticated member screens scoped to the member's personal account. These are cross-org aggregate views — not tied to a specific org context.

| Route | Screen Name | Module(s) | Phase | Desktop | Mobile |
|---|---|---|---|---|---|
| `/my/dashboard` | Member aggregate dashboard (all orgs) | M01 | 1 | ✓ | ✓ |
| `/my/profile` | Profile view + edit | M03 | 1 | ✓ | ✓ |
| `/my/settings` | Account settings (password, notification prefs, privacy, security) | M01 | 1 | ✓ | ✓ |
| `/my/credits` | CPD credit history + totals | M07 | 1 | ✓ | ✓ |
| `/my/credits/log` | Log manual credit entry | M07 | 1 | ✓ | ✓ |
| `/my/payments` | Payment history (all orgs) | M06 | 1 | ✓ | ✓ |
| `/my/id-card` | Member ID card download (org selector) | M03 | 1 | ✓ | ✓ |
| `/my/organizations` | All orgs I belong to (status per org) | M02 | 1 | ✓ | ✓ |
| `/my/notifications` | Notification inbox | M10 | 1 | ✓ | ✓ |
| `/my/events` | Events I've registered for | M04 | 1 | ✓ | ✓ |
| `/my/training` | Training sessions I've registered for | M05 | 1 | ✓ | ✓ |
| `/my/certificates` | My certificates list | M07 | 1 | ✓ | ✓ |
| `/my/certificates/[id]` | Certificate detail + download | M11 | 1 | ✓ | ✓ |
| `/my/saved-jobs` | Saved job listings | M13 | 2 | ✓ | ✓ |
| `/my/data-export` | DPA data portability export | M01 | 1 | ✓ | ✓ |
| `/my/surveys/[id]` | Survey response page | M19 | 3 | ✓ | ✓ |

---

## 3. Org Member Screens

Authenticated member screens within a specific org context. Members see org content, events, training, and community features relevant to their membership in that org.

| Route | Screen Name | Module(s) | Phase | Desktop | Mobile |
|---|---|---|---|---|---|
| `/org/[id]/home` | Org home (announcements, events — member view) | M02 | 1 | ✓ | ✓ |
| `/org/[id]/events` | Events list (upcoming + past) | M04 | 1 | ✓ | ✓ |
| `/org/[id]/events/[id]` | Event detail + RSVP | M04 | 1 | ✓ | ✓ |
| `/org/[id]/training` | Training sessions list | M05 | 1 | ✓ | ✓ |
| `/org/[id]/training/[id]` | Training detail + register | M05 | 1 | ✓ | ✓ |
| `/org/[id]/members` | Member directory (public-facing roster) | M03 | 1 | ✓ | ✓ |
| `/org/[id]/feed` | Professional feed | M12 | 2 | ✓ | ✓ |
| `/org/[id]/feed/post/[id]` | Post detail | M12 | 2 | ✓ | ✓ |
| `/org/[id]/jobs` | Job board | M13 | 2 | ✓ | ✓ |
| `/org/[id]/jobs/[id]` | Job listing detail | M13 | 2 | ✓ | ✓ |
| `/org/[id]/elections/[id]/vote` | Cast ballot | M11 | 2 | ✓ | ✓ |

---

## 4. Officer Screens — General

Available to any officer role (president, treasurer, or secretary) within the org context. Covers the officer dashboard, full roster management, member applications, and communications.

| Route | Screen Name | Module(s) | Phase | Desktop | Mobile |
|---|---|---|---|---|---|
| `/org/[id]/officer/dashboard` | Officer actionable dashboard | M02 | 1 | ✓ | ✓ |
| `/org/[id]/officer/roster` | Full member roster (filter, search, export) | M03 | 1 | ✓ | ✓ |
| `/org/[id]/officer/roster/[id]` | Member detail (all info, payments, credits, status) | M03 | 1 | ✓ | ✓ |
| `/org/[id]/officer/roster/import` | CSV roster import | M03 | 1 | ✓ | — |
| `/org/[id]/officer/applications` | Pending member applications | M03 | 1 | ✓ | ✓ |
| `/org/[id]/officer/communications` | Communications center | M10 | 1 | ✓ | ✓ |
| `/org/[id]/officer/communications/new` | Compose message / email blast | M10 | 1 | ✓ | ✓ |
| `/org/[id]/officer/communications/[id]` | Communication detail (sent message + stats) | M07 | 1 | ✓ | ✓ |

---

## 5. Officer Screens — Treasurer

Financial management screens restricted to the treasurer role. Covers payment recording, dues configuration, fund allocation, gateway setup, and financial reporting.

| Route | Screen Name | Module(s) | Phase | Desktop | Mobile |
|---|---|---|---|---|---|
| `/org/[id]/officer/payments` | Payment record list | M06 | 1 | ✓ | ✓ |
| `/org/[id]/officer/payments/new` | Record payment | M06 | 1 | ✓ | ✓ |
| `/org/[id]/officer/payments/[id]` | Payment detail (edit, refund) | M06 | 1 | ✓ | ✓ |
| `/org/[id]/officer/settings/dues` | Dues configuration | M06 | 1 | ✓ | ✓ |
| `/org/[id]/officer/settings/funds` | Fund allocation configuration | M06 | 1 | ✓ | ✓ |
| `/org/[id]/officer/settings/gateway` | Payment gateway setup | M06 | 1 | ✓ | — |
| `/org/[id]/officer/reports/financial` | Financial summary report | M08 | 1 | ✓ | ✓ |

---

## 6. Officer Screens — Secretary

Event, training, and attendance management restricted to the secretary role. Covers the full event and training lifecycle including attendance recording.

| Route | Screen Name | Module(s) | Phase | Desktop | Mobile |
|---|---|---|---|---|---|
| `/org/[id]/officer/events` | Events management list | M04 | 1 | ✓ | ✓ |
| `/org/[id]/officer/events/new` | Create event | M04 | 1 | ✓ | ✓ |
| `/org/[id]/officer/events/[id]` | Event management (edit, detail) | M04 | 1 | ✓ | ✓ |
| `/org/[id]/officer/events/[id]/attendance` | Record event attendance | M04 | 1 | ✓ | ✓ |
| `/org/[id]/officer/training` | Training management list | M05 | 1 | ✓ | ✓ |
| `/org/[id]/officer/training/new` | Create training | M05 | 1 | ✓ | ✓ |
| `/org/[id]/officer/training/[id]` | Training management (edit, detail) | M05 | 1 | ✓ | ✓ |
| `/org/[id]/officer/training/[id]/attendance` | Record training attendance | M05 | 1 | ✓ | ✓ |

---

## 7. Officer Screens — President

Org governance screens restricted to the president role. Covers org settings, officer assignment, membership categories, elections, committees, surveys, job board management, and CPD reporting.

| Route | Screen Name | Module(s) | Phase | Desktop | Mobile |
|---|---|---|---|---|---|
| `/org/[id]/officer/settings/org` | Org profile and details | M02 | 1 | ✓ | ✓ |
| `/org/[id]/officer/settings/membership-categories` | Membership category management | M03 | 1 | ✓ | ✓ |
| `/org/[id]/officer/officers` | Officer management (assign, remove) | M09 | 1 | ✓ | ✓ |
| `/org/[id]/officer/reports/credits` | CPD credit report | M08 | 1 | ✓ | ✓ |
| `/org/[id]/officer/elections` | Election management list | M11 | 2 | ✓ | ✓ |
| `/org/[id]/officer/elections/new` | Create election | M11 | 2 | ✓ | ✓ |
| `/org/[id]/officer/elections/[id]` | Election detail and management | M11 | 2 | ✓ | ✓ |
| `/org/[id]/officer/jobs` | Job board management | M13 | 2 | ✓ | ✓ |
| `/org/[id]/officer/jobs/new` | Create job posting | M13 | 2 | ✓ | ✓ |
| `/org/[id]/officer/jobs/[id]` | Manage job posting | M13 | 2 | ✓ | ✓ |
| `/org/[id]/officer/committees` | Committee management list | M18 | 3 | ✓ | ✓ |
| `/org/[id]/officer/committees/[id]` | Committee detail | M18 | 3 | ✓ | ✓ |
| `/org/[id]/officer/committees/[id]/meetings` | Committee meetings | M18 | 3 | ✓ | ✓ |
| `/org/[id]/officer/committees/[id]/meetings/[id]` | Meeting detail | M18 | 3 | ✓ | ✓ |
| `/org/[id]/officer/committees/[id]/tasks` | Committee task board | M18 | 3 | ✓ | ✓ |
| `/org/[id]/officer/surveys` | Survey management | M19 | 3 | ✓ | ✓ |
| `/org/[id]/officer/surveys/new` | Create survey | M19 | 3 | ✓ | ✓ |
| `/org/[id]/officer/surveys/[id]/results` | Survey results | M19 | 3 | ✓ | ✓ |

---

## 8. Platform Admin Screens

Memberry internal platform administration. Desktop-only. Covers association management, org oversight, global member search, impersonation, feature flags, pricing, operator management, support, analytics, national dashboards, advertising, marketplace vendor review, and system health.

| Route | Screen Name | Module(s) | Phase | Desktop | Mobile |
|---|---|---|---|---|---|
| `/admin` | Platform admin dashboard | M01 | 1 | ✓ | — |
| `/admin/associations` | Associations list | M02 | 1 | ✓ | — |
| `/admin/associations/new` | Create association | M02 | 1 | ✓ | — |
| `/admin/associations/[id]` | Association detail + settings | M02 | 1 | ✓ | — |
| `/admin/associations/[id]/orgs` | Orgs within association | M02 | 1 | ✓ | — |
| `/admin/associations/[id]/billing` | Subscription and billing | M06 | 1 | ✓ | — |
| `/admin/orgs` | All orgs across all associations | M02 | 1 | ✓ | — |
| `/admin/orgs/[id]` | Org detail (admin view) | M02 | 1 | ✓ | — |
| `/admin/members` | Global member search | M03 | 1 | ✓ | — |
| `/admin/members/[id]` | Member detail (admin view) | M03 | 1 | ✓ | — |
| `/admin/impersonate` | Impersonation (select user) | M01 | 1 | ✓ | — |
| `/admin/feature-flags` | Feature flag management | M01 | 1 | ✓ | — |
| `/admin/pricing` | Pricing and plan management | M01 | 1 | ✓ | — |
| `/admin/operators` | Admin team management | M01 | 1 | ✓ | — |
| `/admin/support` | Support ticket inbox | M01 | 1 | ✓ | — |
| `/admin/support/[id]` | Support ticket detail | M01 | 1 | ✓ | — |
| `/admin/analytics` | Platform analytics hub | M01 | 1 | ✓ | — |
| `/admin/system/logs` | Audit log viewer | M01 | 1 | ✓ | — |
| `/admin/system/health` | System health overview | M01 | 1 | ✓ | — |
| `/admin/national` | National dashboard | M14 | 2 | ✓ | — |
| `/admin/national/[id]` | Association-level aggregate | M14 | 2 | ✓ | — |
| `/admin/national/[id]/orgs/[id]` | Chapter drill-down | M14 | 2 | ✓ | — |
| `/admin/advertising` | Ad management dashboard | M16 | 2 | ✓ | — |
| `/admin/advertising/advertisers` | Advertiser list + approvals | M16 | 2 | ✓ | — |
| `/admin/advertising/advertisers/[id]` | Advertiser detail | M16 | 2 | ✓ | — |
| `/admin/advertising/placements` | Ad slot configuration | M16 | 2 | ✓ | — |
| `/admin/advertising/campaigns` | All campaigns | M16 | 2 | ✓ | — |
| `/admin/advertising/campaigns/[id]` | Campaign detail | M16 | 2 | ✓ | — |
| `/admin/advertising/analytics` | Ad performance analytics | M16 | 2 | ✓ | — |
| `/admin/marketplace/vendors` | Vendor verification queue | M17 | 3 | ✓ | — |
| `/admin/marketplace/vendors/[id]` | Vendor review | M17 | 3 | ✓ | — |

---

## Summary by Phase

| Phase | Screen Count | Description |
|---|---|---|
| Phase 1 | 74 | Core membership, payments, events, training, CPD, communications, officer tools, platform admin |
| Phase 2 | 24 | Professional feed, job board, elections, national analytics, advertising |
| Phase 3 | 11 | Committees, surveys, marketplace vendor admin |
| **Total** | **109** | All screens across all modules. See individual sections for full route list. |

## Summary by Access Level

| Access Level | Screen Count | Notes |
|---|---|---|
| Public | 10 | Unauthenticated marketing, onboarding, verification, payment |
| Member | 15 | Personal account aggregate views |
| Org Member | 11 | Org-contextual member views |
| Officer — General | 7 | Shared across all officer roles |
| Officer — Treasurer | 7 | Payment, dues, fund, gateway, and financial reporting |
| Officer — Secretary | 8 | Event and training lifecycle management |
| Officer — President | 18 | Governance, elections, committees, surveys, jobs |
| Platform Admin | 31 | Internal Memberry admin (desktop-only) |
