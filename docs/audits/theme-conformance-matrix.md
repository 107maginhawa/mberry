# Theme Conformance Matrix — apps/memberry (2026-06-19)

Per-page conformance to the Stripe-inspired pattern in [DESIGN.md](../../DESIGN.md).
Classified mechanically on four signals:

- **raw status color** — `bg-red-100`, `text-emerald-600`, etc. instead of `--color-*` tokens. **The real "colors aren't consistent" signal.**
- **`—` dash** — a literal `—` placeholder. Bad in a *card* (dead space); acceptable as quiet text in a dense *table*.
- **arbType** — arbitrary `text-[13px]` instead of the type scale (minor).
- **shell** — uses `PageShell`/`PageHeader`. Absence is expected on public/standalone pages.

**Verdict key:** ✅ on-theme · 🟡 minor/by-design · 🔴 real deviation (raw colors, or dashes in a card).

> Read the verdict with the caveats. A 🟡 `noShell` on `auth`/`onboarding`/`pay` is correct (those live outside the app shell). The actionable backlog is the 🔴 **raw-color** rows.

**Tally:** 121 pages · 75 clean · 25 minor · 21 flagged. **Real actionable deviations (raw status colors): 7 route files** + 1 component (`active-booking-card`).

## Actionable backlog (raw status colors → tokens)

| Page | raw colors |
|---|---|
| `my/training.tsx` | 17 |
| `org/my-cpd.tsx` | 14 |
| `org/training/$trainingId.tsx` | 4 |
| `org/training/index.tsx` | 4 |
| `org/dues.tsx` | 3 |
| `join/$slug.tsx` | 2 |
| `verify/$id.tsx` | 28 (standalone verify page) |

Plus `features/booking/components/active-booking-card.tsx` (6, component-level).

---

## 1 · My / account (25)

| Page | Verdict | Notes |
|---|---|---|
| dashboard.tsx | ✅ | |
| my/billing.tsx | ✅ | |
| my/calendar.tsx | ✅ | |
| my/certificates/index.tsx | ✅ | |
| my/certificates/$certificateId.tsx | ✅ | |
| my/credits/index.tsx | 🟡 | `—` (verify: table vs card) |
| my/credits/log.tsx | ✅ | |
| my/data-export.tsx | ✅ | |
| my/events.tsx | ✅ | |
| my/id-card.tsx | 🟡 | `—`, arbType, gray (ID card is a bespoke visual surface) |
| my/notifications.tsx | ✅ | |
| my/organizations.tsx | ✅ | (stacked meta line — minor, noted in survey) |
| my/payments.tsx | ✅ | |
| my/profile.tsx | ✅ | |
| my/schedule.tsx | ✅ | |
| my/settings.tsx | ✅ | |
| my/surveys/index.tsx | ✅ | |
| my/surveys/$surveyId.tsx | ✅ | |
| my/training.tsx | 🔴 | **raw colors ×17** + dashes |
| my/bookings/index.tsx | 🟡 | noShell (uses BookingList component) |
| my/bookings/$bookingId.tsx | 🟡 | noShell |
| my/bookings/host.$personId.tsx | 🟡 | noShell |
| my/bookings/host.$personId.$slotId.tsx | 🟡 | noShell |
| settings/account.tsx | ✅ | |
| settings/security.tsx | ✅ | |

## 2 · Org (member-facing) (21)

| Page | Verdict | Notes |
|---|---|---|
| org/announcements/index.tsx | 🟡 | arbType |
| org/announcements/$announcementId.tsx | ✅ | |
| org/directory.tsx | ✅ | |
| org/directory/$personId.tsx | ✅ | |
| org/documents/index.tsx | ✅ | |
| org/documents/$documentId.tsx | 🟡 | `—` (has proper access-denied state) |
| org/dues.tsx | 🔴 | **raw colors ×3**, dashes, arbType ×15 |
| org/elections/index.tsx | ✅ | |
| org/elections/$electionId/index.tsx | ✅ | |
| org/elections/$electionId/vote.tsx | ✅ | |
| org/events/index.tsx | ✅ | |
| org/events/$eventId.tsx | 🟡 | `—` (detail page) |
| org/governance/index.tsx | 🟡 | arbType ×2 |
| org/home.tsx | ✅ | |
| org/members.tsx | ✅ | |
| org/messages/index.tsx | ✅ | |
| org/messages/dm/index.tsx | ✅ | |
| org/my-cpd.tsx | 🔴 | **raw colors ×14** |
| org/my-notifications.tsx | 🟡 | arbType |
| org/training/index.tsx | 🔴 | **raw colors ×4**, dashes |
| org/training/$trainingId.tsx | 🔴 | **raw colors ×4**, dashes |

## 3 · Officer (64)

| Page | Verdict | Notes |
|---|---|---|
| officer/applications.tsx | ✅ | |
| officer/certificates.tsx | ✅ | |
| officer/communications.tsx | 🟡 | noShell (custom header) |
| officer/communications/index.tsx | ✅ | |
| officer/communications/$announcementId.tsx | 🟡 | `—` |
| officer/communications/analytics.tsx | ✅ | |
| officer/communications/new.tsx | ✅ | |
| officer/communications/sent.tsx | ✅ | |
| officer/communications/templates/index.tsx | ✅ | |
| officer/communications/templates/new.tsx | ✅ | |
| officer/compliance.tsx | ✅ | |
| officer/dashboard.tsx | 🟡 | noShell (officer landing, custom hero) |
| officer/documents/index.tsx | ✅ | |
| officer/documents/$documentId.tsx | 🟡 | `—`, arbType |
| officer/dues/assessments.tsx | 🟡 | noShell |
| officer/dues/member.$memberId.tsx | 🟡 | noShell |
| officer/dues/treasurer.tsx | 🟡 | noShell |
| officer/elections/index.tsx | ✅ | |
| officer/elections/$electionId.tsx | ✅ | |
| officer/elections/$electionId/edit.tsx | ✅ | |
| officer/elections/new.tsx | ✅ | |
| officer/events/index.tsx | ✅ | |
| officer/events/$eventId.tsx | ✅ | |
| officer/events/$eventId/attendance.tsx | ✅ | |
| officer/events/new.tsx | ✅ | |
| officer/finances/index.tsx | ✅ | |
| officer/finances/assessments.tsx | ✅ | |
| officer/finances/dues.tsx | ✅ | |
| officer/finances/funds.tsx | ✅ | |
| officer/finances/members.tsx | 🟡 | `—` (table) |
| officer/finances/members/$memberId.tsx | 🟡 | `—` (detail) |
| officer/finances/invoices/index.tsx | ✅ | |
| officer/finances/invoices/$invoiceId.tsx | ✅ | (fixed this session) |
| officer/institutional-memberships/index.tsx | ✅ | |
| officer/institutional-memberships/$institutionalMembershipId.tsx | 🟡 | gray ×8 |
| officer/institutional-memberships/new.tsx | ✅ | |
| officer/messages/index.tsx | ✅ | |
| officer/officers.tsx | ✅ | |
| officer/payments.tsx | 🟡 | noShell |
| officer/payments/index.tsx | ✅ | |
| officer/payments/$paymentId.tsx | 🟡 | `—` (detail) |
| officer/payments/new.tsx | ✅ | |
| officer/reports/credits.tsx | 🟡 | `—`, arbType ×4 (report) |
| officer/reports/financial.tsx | ✅ | |
| officer/reviews/index.tsx | ✅ | |
| officer/roster.tsx | 🟡 | noShell (wrapper) |
| officer/roster/index.tsx | ✅ | **(roster card fixed this session)** |
| officer/roster/$memberId.tsx | 🟡 | arbType, noShell |
| officer/roster/import.tsx | 🟡 | `—` (import preview table) |
| officer/settings/chapters.tsx | ✅ | |
| officer/settings/cpd.tsx | ✅ | |
| officer/settings/dues.tsx | 🟡 | noShell |
| officer/settings/funds.tsx | 🟡 | noShell |
| officer/settings/gateway.tsx | ✅ | |
| officer/settings/membership-categories.tsx | ✅ | |
| officer/settings/org.tsx | ✅ | |
| officer/settings/providers.tsx | 🟡 | `—` |
| officer/surveys/index.tsx | ✅ | |
| officer/surveys/$surveyId.tsx | ✅ | |
| officer/surveys/new.tsx | ✅ | |
| officer/training/index.tsx | ✅ | (uses training-card — fixed this session) |
| officer/training/$trainingId.tsx | 🟡 | `—` (detail) |
| officer/training/$trainingId/attendance.tsx | ✅ | |
| officer/training/new.tsx | ✅ | |

## 4 · Public / auth / misc (11) — standalone, outside the app shell

| Page | Verdict | Notes |
|---|---|---|
| discover/events.tsx | ✅ | |
| auth/$authView.tsx | 🟡 | noShell (by design) |
| index.tsx | 🟡 | noShell (redirect/landing) |
| onboarding.tsx | 🟡 | noShell (by design) |
| invite/$token.tsx | 🟡 | noShell (by design) |
| join/index.tsx | 🟡 | noShell (by design) |
| pay/$token.tsx | 🟡 | noShell, gray (by design) |
| verify-email.tsx | 🟡 | noShell (by design) |
| events/$eventSlug.tsx | 🟡 | `—` (public event page) |
| join/$slug.tsx | 🔴 | **raw colors ×2**, noShell |
| verify/$id.tsx | 🔴 | **raw colors ×28**, noShell (verification status page) |
