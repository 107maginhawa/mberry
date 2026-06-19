# Workflow Coverage Audit — Prioritized Backlog

**Source:** `.audits/coverage-matrix.json`
**Date:** 2026-06-19 (initial). **Updated 2026-06-19 post-detector-fix + Wave-1 batch 2.**

**Total MISSING / UNTESTED counts (initial → current):**
- Matrix **B** (flows, `WF-NNN`): 76 → **71 MISSING** (5 P0 flows were covered-but-untagged → tagged)
- Matrix **C** (routes): 85 → **45 MISSING** (40 were false positives — route-coverage matcher broadened, `scripts/audit/route-match.ts`)
- Matrix **A** (BRs): 4 → **2 UNTESTED** (BR-55/56 closed; BR-48 deferred, BR-39 p2-deferred)

> **Caveat:** the per-row P0/P1/P2 tables below were generated from the *initial* matrix and OVERSTATE route gaps. Trust the live counts above + `docs/audits/COVERAGE_MATRIX.md`.

## Wave-1 batch 2 — P0 flow triage (verified, 2026-06-19)

**Tagged (covered-but-untagged, now COVERED):** WF-041 refund, WF-042 dunning, WF-076 run-election, WF-079 officer-transition, WF-128 merchant-onboard.

**Genuinely MISSING P0 flows — need new live E2E specs (next write-batch):**
- WF-077 — Member Votes (cast secret ballot, one vote/position). *president-election-tally is a read-only smoke; ballot cast blocked on G15 fixture.*
- WF-078 — Bylaw Ratification (propose + vote on bylaw changes). *No e2e; "bylaw" hits are document specs.*
- WF-124 — Handle Bounce (provider webhook → suppression). *Trigger not implemented in code; backend-shaped, not e2e.*
- WF-125 — Manage Suppressions (admin views/removes suppressed addresses). *Handler tests exist; no e2e UI spec.*
- WF-129 — Create Invoice (line items for dues/events/services). *Maps to officer/finances/invoices (also a C gap).*
- WF-131 — Refund Payment (billing-module full/partial). *Distinct from dues-refund WF-041.*
- WF-132 — Handle Webhook (Stripe payment success/failure/refund events). *Backend integration, not e2e-shaped.*
- WF-133 — View Invoices (list/filter by status/date). *Maps to officer/finances/invoices route gap.*

Note WF-124/132 are webhook/trigger flows that are backend-shaped — better closed by backend integration tests than e2e (Matrix B only counts e2e, so they may stay MISSING-by-design; revisit whether to exempt).

---

**(Original counts, for history:)**
- Matrix **B** (flows, `WF-NNN`): **76 MISSING** (no E2E spec mentions the WF id)
- Matrix **C** (routes): **85 MISSING** (no E2E `page.goto` hits the route)
- Matrix **A** (BRs): **4 UNTESTED** (zero test refs) — BR-48, BR-55, BR-56, BR-39

Each MISSING flow/route is classified as **real-gap** (P0/P1/P2), **noise**, or **deferred**.
Module names: M01 onboarding/invite, M02 member-profile, M03 platform-admin, M04 governance,
M05 membership, M06 dues, M07 announcements, M08 events, M09 training, M10 credits/CPD,
M11 credentials, M12 elections, M13 social, M14 national-reporting, M15 jobs, M16 advertising,
M17 marketplace, M18 surveys, M19 committees, M20 booking, M21 billing, M22 email.

p2-deferred modules (per `br-registry.json`): **M13, M14, M15, M17, M18, M19** (+ **M16** advertising,
absent from the registry = not part of the shipped surface).

---

## Summary

| Matrix | real-gap | noise | deferred |
|---|---|---|---|
| **A** (BRs, untested) | 3 | 0 | 1 |
| **B** (flows) | 51 | 0 | 25 |
| **C** (routes) | 60 | 17 | 8 |

Real-gap priority split (A+B+C): **P0 = 34**, **P1 = 78**, **P2 = 2**.

---

## P0 — money / auth / data-isolation / security

Modules: M06 dues, M21 billing, M22 email-suppression, M12 elections integrity, audit/compliance, cross-org isolation.

### Matrix A — UNTESTED business rules

| id | module | description | suggested spec/test file |
|---|---|---|---|
| BR-48 | M06 | Bulk Payment Batch Size Limit (p1-business; money path — bulk dues recording) | `services/api-ts/src/handlers/dues/bulkRecordPayments.test.ts` |
| BR-55 | M22 | Hard Bounce Auto-Suppression (alias M22-R4; p0-data) | `services/api-ts/src/handlers/email/handleBounce.test.ts` |
| BR-56 | M22 | Complaint Auto-Suppression / CAN-SPAM (alias M22-R5; p0-security) | `services/api-ts/src/handlers/email/handleComplaint.test.ts` |

### Matrix B — MISSING flows

| id | module | description | suggested spec/test file |
|---|---|---|---|
| WF-041 | M06 | Refund Processing: treasurer-initiated, reverses expiry extension | `apps/memberry/tests/e2e/journeys/dues-refund-processing.spec.ts` |
| WF-042 | M06 | Dunning/Reminders: scheduled reminder processor checks expiry, creates notifications | `apps/memberry/tests/e2e/journeys/dues-dunning-reminders.spec.ts` |
| WF-076 | M12 | Create & Run Election: full lifecycle (draft -> nominations -> voting -> results) | `apps/memberry/tests/e2e/journeys/elections-create-run-election.spec.ts` |
| WF-077 | M12 | Member Votes: cast secret ballot, one vote per position | `apps/memberry/tests/e2e/journeys/elections-member-votes.spec.ts` |
| WF-078 | M12 | Bylaw Ratification: propose and vote on bylaw changes | `apps/memberry/tests/e2e/journeys/elections-bylaw-ratification.spec.ts` |
| WF-079 | M12 | Election-to-Officer Transition: winners auto-assigned officer roles (touches M04) | `apps/memberry/tests/e2e/journeys/elections-election-to-officer-transition.spec.ts` |
| WF-124 | M22 | Handle Bounce: system processes hard bounce, adds address to suppression list | `apps/memberry/tests/e2e/journeys/email-handle-bounce.spec.ts` |
| WF-125 | M22 | Manage Suppressions: admin views and removes suppressed addresses | `apps/memberry/tests/e2e/journeys/email-manage-suppressions.spec.ts` |
| WF-128 | M21 | Onboard Merchant: admin creates Stripe Connect account, completes onboarding flow | `apps/memberry/tests/e2e/journeys/billing-onboard-merchant.spec.ts` |
| WF-129 | M21 | Create Invoice: system/admin generates invoice with line items for dues/events/services | `apps/memberry/tests/e2e/journeys/billing-create-invoice.spec.ts` |
| WF-131 | M21 | Refund Payment: admin processes full or partial refund | `apps/memberry/tests/e2e/journeys/billing-refund-payment.spec.ts` |
| WF-132 | M21 | Handle Webhook: system processes Stripe webhook events (payment success/failure/refund) | `apps/memberry/tests/e2e/journeys/billing-handle-webhook.spec.ts` |
| WF-133 | M21 | View Invoices: member/admin lists and filters invoices by status/date | `apps/memberry/tests/e2e/journeys/billing-view-invoices.spec.ts` |

### Matrix C — MISSING routes

| id | module | description | suggested spec/test file |
|---|---|---|---|
| /org/$orgSlug/elections/$electionId/vote | memberry | ballot integrity | `apps/memberry/tests/e2e/member/org-detail-elections-detail-vote.spec.ts` |
| /org/$orgSlug/officer/finances/ | memberry | dues/finances money | `apps/memberry/tests/e2e/officer/org-detail-officer-finances.spec.ts` |
| /org/$orgSlug/officer/finances/assessments | memberry | dues/finances money | `apps/memberry/tests/e2e/officer/org-detail-officer-finances-assessments.spec.ts` |
| /org/$orgSlug/officer/finances/funds | memberry | dues/finances money | `apps/memberry/tests/e2e/officer/org-detail-officer-finances-funds.spec.ts` |
| /org/$orgSlug/officer/finances/members | memberry | dues/finances money | `apps/memberry/tests/e2e/officer/org-detail-officer-finances-members.spec.ts` |
| /org/$orgSlug/officer/finances/dues | memberry | dues/finances money | `apps/memberry/tests/e2e/officer/org-detail-officer-finances-dues.spec.ts` |
| /org/$orgSlug/officer/finances/members/$memberId | memberry | dues/finances money | `apps/memberry/tests/e2e/officer/org-detail-officer-finances-members-detail.spec.ts` |
| /org/$orgSlug/officer/finances/invoices/$invoiceId | memberry | dues/finances money | `apps/memberry/tests/e2e/officer/org-detail-officer-finances-invoices-detail.spec.ts` |
| /org/$orgSlug/officer/finances/invoices/ | memberry | dues/finances money | `apps/memberry/tests/e2e/officer/org-detail-officer-finances-invoices.spec.ts` |
| /org/$orgSlug/officer/dues/assessments | memberry | dues/finances money | `apps/memberry/tests/e2e/officer/org-detail-officer-dues-assessments.spec.ts` |
| /org/$orgSlug/officer/dues/member.$memberId | memberry | dues/finances money | `apps/memberry/tests/e2e/officer/org-detail-officer-dues-member-detail.spec.ts` |
| /org/$orgSlug/officer/dues/treasurer | memberry | dues/finances money | `apps/memberry/tests/e2e/officer/org-detail-officer-dues-treasurer.spec.ts` |
| /org/$orgSlug/officer/payments/ | memberry | dues/finances money | `apps/memberry/tests/e2e/officer/org-detail-officer-payments.spec.ts` |
| /impersonate/ | admin | audit/compliance/impersonate security | `apps/admin/tests/e2e/impersonate.spec.ts` |
| /members/ | admin | cross-org member PII isolation | `apps/admin/tests/e2e/members.spec.ts` |
| /members/$personId | admin | cross-org member PII isolation | `apps/admin/tests/e2e/members-detail.spec.ts` |
| /audit/ | admin | audit/compliance/impersonate security | `apps/admin/tests/e2e/audit.spec.ts` |
| /compliance/ | admin | audit/compliance/impersonate security | `apps/admin/tests/e2e/compliance.spec.ts` |

---

## P1 — membership lifecycle / credits / events / governance / communications

### Matrix B — MISSING flows

| id | module | description | suggested spec/test file |
|---|---|---|---|
| WF-006 | M01 | Member Onboarding: optional profile completion wizard post-dashboard | `apps/memberry/tests/e2e/journeys/onboarding-member-onboarding.spec.ts` |
| WF-008 | M01 | Invite Member: officer sends individual email invitation | `apps/memberry/tests/e2e/journeys/onboarding-invite-member.spec.ts` |
| WF-009 | M01 | Bulk CSV Import with Member Matching: upload, validate, preview, import (touches M05) | `apps/memberry/tests/e2e/journeys/onboarding-bulk-csv-import-with-member-matching.spec.ts` |
| WF-012 | M02 | Digital ID Card: view/download QR-verified member ID | `apps/memberry/tests/e2e/journeys/member-profile-digital-id-card.spec.ts` |
| WF-013 | M02 | Notification Preferences: per-channel opt-in/out | `apps/memberry/tests/e2e/journeys/member-profile-notification-preferences.spec.ts` |
| WF-015 | M03 | Onboard Association: create tenant with locale, license regex, credit config | `apps/memberry/tests/e2e/journeys/platform-admin-onboard-association.spec.ts` |
| WF-016 | M03 | Provision Organization: create org within association, assign initial officer | `apps/memberry/tests/e2e/journeys/platform-admin-provision-organization.spec.ts` |
| WF-017 | M03 | Manage Subscriptions: trial-to-paid conversion, payment management | `apps/memberry/tests/e2e/journeys/platform-admin-manage-subscriptions.spec.ts` |
| WF-018 | M03 | Feature Flag Management: module x tier matrix + per-org overrides | `apps/memberry/tests/e2e/journeys/platform-admin-feature-flag-management.spec.ts` |
| WF-020 | M03 | Support Ticket Resolution: ticket inbox, SLA tracking, escalation | `apps/memberry/tests/e2e/journeys/platform-admin-support-ticket-resolution.spec.ts` |
| WF-021 | M03 | Revenue Dashboard: MRR, ARR, churn, growth metrics | `apps/memberry/tests/e2e/journeys/platform-admin-revenue-dashboard.spec.ts` |
| WF-031 | M05 | Bulk CSV Import: upload, validate, preview, import with matching (M01) | `apps/memberry/tests/e2e/journeys/membership-bulk-csv-import.spec.ts` |
| WF-033 | M05 | Membership Categories: CRUD categories per org | `apps/memberry/tests/e2e/journeys/membership-membership-categories.spec.ts` |
| WF-034 | M05 | Member Directory: privacy-filtered searchable list | `apps/memberry/tests/e2e/journeys/membership-member-directory.spec.ts` |
| WF-036 | M05 | Member Transfer: inter-org transfer with approval | `apps/memberry/tests/e2e/journeys/membership-member-transfer.spec.ts` |
| WF-047 | M07 | Message Templates: create/edit reusable templates with variables | `apps/memberry/tests/e2e/journeys/announcements-message-templates.spec.ts` |
| WF-048 | M07 | Delivery Stats: open/delivery rates per announcement | `apps/memberry/tests/e2e/journeys/announcements-delivery-stats.spec.ts` |
| WF-051 | M08 | Create & Publish Event: draft, configure, publish with capacity | `apps/memberry/tests/e2e/journeys/events-create-publish-event.spec.ts` |
| WF-054 | M08 | Event Cancellation: cancel event, notify registrants, process refunds | `apps/memberry/tests/e2e/journeys/events-event-cancellation.spec.ts` |
| WF-056 | M08 | My Events: member view of registered/past events | `apps/memberry/tests/e2e/journeys/events-my-events.spec.ts` |
| WF-057 | M08 | Waitlist Auto-Promotion: FIFO promotion when spot opens | `apps/memberry/tests/e2e/journeys/events-waitlist-auto-promotion.spec.ts` |
| WF-062 | M09 | Paid Training: fee collection via M06 billing | `apps/memberry/tests/e2e/journeys/training-paid-training.spec.ts` |
| WF-063 | M09 | Training Analytics: completion rates, revenue | `apps/memberry/tests/e2e/journeys/training-training-analytics.spec.ts` |
| WF-064 | M09 | Accredited Providers: provider CRUD and management | `apps/memberry/tests/e2e/journeys/training-accredited-providers.spec.ts` |
| WF-065 | M10 | View Credit Summary: per-cycle breakdown, cross-org aggregation | `apps/memberry/tests/e2e/journeys/credits-view-credit-summary.spec.ts` |
| WF-066 | M10 | Add Manual Credit: self-entry with activity details, optional docs | `apps/memberry/tests/e2e/journeys/credits-add-manual-credit.spec.ts` |
| WF-067 | M10 | Officer Credit Adjustment: award or deduct credits with mandatory reason | `apps/memberry/tests/e2e/journeys/credits-officer-credit-adjustment.spec.ts` |
| WF-068 | M10 | Org Credit Compliance: officer view of member compliance rates | `apps/memberry/tests/e2e/journeys/credits-org-credit-compliance.spec.ts` |
| WF-072 | M11 | Public Verification: scan QR code, verify membership/credential status | `apps/memberry/tests/e2e/journeys/credentials-public-verification.spec.ts` |
| WF-075 | M11 | Credential Template Management: design digital credential templates | `apps/memberry/tests/e2e/journeys/credentials-credential-template-management.spec.ts` |
| WF-115 | M20 | Create Booking Event: provider configures availability template (schedule, duration, location) | `apps/memberry/tests/e2e/journeys/booking-create-booking-event.spec.ts` |
| WF-116 | M20 | Manage Schedule Exceptions: provider blocks dates or modifies hours for specific periods | `apps/memberry/tests/e2e/journeys/booking-manage-schedule-exceptions.spec.ts` |
| WF-120 | M20 | Mark No-Show: provider flags client or host no-show after appointment time | `apps/memberry/tests/e2e/journeys/booking-mark-no-show.spec.ts` |
| WF-121 | M20 | List My Bookings: client/provider views upcoming and past bookings | `apps/memberry/tests/e2e/journeys/booking-list-my-bookings.spec.ts` |
| WF-122 | M22 | Create Template: admin defines reusable email template with variables | `apps/memberry/tests/e2e/journeys/email-create-template.spec.ts` |
| WF-123 | M22 | Enqueue Email: system adds email to processing queue with template and variables | `apps/memberry/tests/e2e/journeys/email-enqueue-email.spec.ts` |
| WF-126 | M22 | Cancel Queued Email: admin cancels pending email before processing | `apps/memberry/tests/e2e/journeys/email-cancel-queued-email.spec.ts` |
| WF-127 | M22 | Retry Failed Email: system re-attempts failed delivery up to max retries | `apps/memberry/tests/e2e/journeys/email-retry-failed-email.spec.ts` |

### Matrix C — MISSING routes

| id | module | description | suggested spec/test file |
|---|---|---|---|
| /verify-email | memberry | auth/onboarding surface | `apps/memberry/tests/e2e/member/verify-email.spec.ts` |
| /my/schedule | memberry | booking/scheduling | `apps/memberry/tests/e2e/member/my-schedule.spec.ts` |
| /my/calendar | memberry | booking/scheduling | `apps/memberry/tests/e2e/member/my-calendar.spec.ts` |
| /my/credits/ | memberry | credits/CPD/training | `apps/memberry/tests/e2e/member/my-credits.spec.ts` |
| /my/certificates/ | memberry | credits/CPD/training | `apps/memberry/tests/e2e/member/my-certificates.spec.ts` |
| /my/bookings/ | memberry | booking/scheduling | `apps/memberry/tests/e2e/member/my-bookings.spec.ts` |
| /org/$orgSlug/directory | memberry | membership directory/roster | `apps/memberry/tests/e2e/member/org-detail-directory.spec.ts` |
| /org/$orgSlug/elections/ | memberry | elections/governance | `apps/memberry/tests/e2e/member/org-detail-elections.spec.ts` |
| /org/$orgSlug/events/ | memberry | events | `apps/memberry/tests/e2e/member/org-detail-events.spec.ts` |
| /org/$orgSlug/documents/ | memberry | documents | `apps/memberry/tests/e2e/member/org-detail-documents.spec.ts` |
| /org/$orgSlug/officer/institutional-memberships/ | memberry | institutional membership lifecycle | `apps/memberry/tests/e2e/officer/org-detail-officer-institutional-memberships.spec.ts` |
| /org/$orgSlug/officer/elections/ | memberry | elections/governance | `apps/memberry/tests/e2e/officer/org-detail-officer-elections.spec.ts` |
| /org/$orgSlug/officer/elections/$electionId/edit | memberry | elections/governance | `apps/memberry/tests/e2e/officer/org-detail-officer-elections-detail-edit.spec.ts` |
| /org/$orgSlug/officer/communications/ | memberry | communications | `apps/memberry/tests/e2e/officer/org-detail-officer-communications.spec.ts` |
| /org/$orgSlug/officer/events/ | memberry | events | `apps/memberry/tests/e2e/officer/org-detail-officer-events.spec.ts` |
| /org/$orgSlug/officer/events/$eventId/attendance | memberry | events | `apps/memberry/tests/e2e/officer/org-detail-officer-events-detail-attendance.spec.ts` |
| /org/$orgSlug/officer/documents/ | memberry | documents | `apps/memberry/tests/e2e/officer/org-detail-officer-documents.spec.ts` |
| /org/$orgSlug/officer/training/ | memberry | credits/CPD/training | `apps/memberry/tests/e2e/officer/org-detail-officer-training.spec.ts` |
| /org/$orgSlug/officer/training/$trainingId/attendance | memberry | credits/CPD/training | `apps/memberry/tests/e2e/officer/org-detail-officer-training-detail-attendance.spec.ts` |
| /org/$orgSlug/officer/roster/ | memberry | membership directory/roster | `apps/memberry/tests/e2e/officer/org-detail-officer-roster.spec.ts` |
| /org/$orgSlug/officer/messages/ | memberry | communications | `apps/memberry/tests/e2e/officer/org-detail-officer-messages.spec.ts` |
| /org/$orgSlug/officer/compliance | memberry | officer credit-compliance dashboard (#5) | `apps/memberry/tests/e2e/officer/org-detail-officer-compliance.spec.ts` |
| /org/$orgSlug/governance/ | memberry | elections/governance | `apps/memberry/tests/e2e/member/org-detail-governance.spec.ts` |
| /org/$orgSlug/directory/$personId | memberry | membership directory/roster | `apps/memberry/tests/e2e/member/org-detail-directory-detail.spec.ts` |
| /org/$orgSlug/announcements/ | memberry | communications | `apps/memberry/tests/e2e/member/org-detail-announcements.spec.ts` |
| /org/$orgSlug/training/ | memberry | credits/CPD/training | `apps/memberry/tests/e2e/member/org-detail-training.spec.ts` |
| /org/$orgSlug/messages/ | memberry | communications | `apps/memberry/tests/e2e/member/org-detail-messages.spec.ts` |
| /settings/security | memberry | auth/onboarding surface | `apps/memberry/tests/e2e/member/settings-security.spec.ts` |
| /join/ | memberry | auth/onboarding surface | `apps/memberry/tests/e2e/member/join.spec.ts` |
| /communications/ | admin | communications | `apps/admin/tests/e2e/communications.spec.ts` |
| /communications/templates | admin | communications | `apps/admin/tests/e2e/communications-templates.spec.ts` |
| /communications/email | admin | communications | `apps/admin/tests/e2e/communications-email.spec.ts` |
| /communications/moderation | admin | communications | `apps/admin/tests/e2e/communications-moderation.spec.ts` |
| /events/ | admin | events | `apps/admin/tests/e2e/events.spec.ts` |
| /verifications/ | admin | credential verification queue | `apps/admin/tests/e2e/verifications.spec.ts` |
| /feature-flags/ | admin | admin SaaS ops surface | `apps/admin/tests/e2e/feature-flags.spec.ts` |
| /training/ | admin | credits/CPD/training | `apps/admin/tests/e2e/training.spec.ts` |
| /operators/ | admin | admin SaaS ops surface | `apps/admin/tests/e2e/operators.spec.ts` |
| /associations/ | admin | admin SaaS ops surface | `apps/admin/tests/e2e/associations.spec.ts` |
| /organizations/ | admin | admin SaaS ops surface | `apps/admin/tests/e2e/organizations.spec.ts` |

---

## P2 — everything else

### Matrix C — MISSING routes

| id | module | description | suggested spec/test file |
|---|---|---|---|
| /org/$orgSlug/my-notifications | memberry | notification prefs | `apps/memberry/tests/e2e/member/org-detail-my-notifications.spec.ts` |
| /org/$orgSlug/officer/reviews/ | memberry | NPS reviews | `apps/memberry/tests/e2e/officer/org-detail-officer-reviews.spec.ts` |

---

## Noise (excluded)

Grouped by reason; representative ids only (not exhaustive):

- **Detail/child pages reachable only via an already-targeted sibling index route** (16 C routes) — e.g. `/my/bookings/$bookingId`, `/my/bookings/host.$personId`, `/org/$orgSlug/elections/$electionId/`, `/org/$orgSlug/events/$eventId`, `/org/$orgSlug/documents/$documentId`, `/org/$orgSlug/announcements/$announcementId`, `/org/$orgSlug/officer/communications/templates/` + `/new` + `/analytics`, `/org/$orgSlug/officer/institutional-memberships/$id` + `/new`, `/org/$orgSlug/messages/dm/`, admin `/associations/$associationId`, `/organizations/$organizationId`. Covered transitively once the parent index spec navigates into them.
- **Test-route shell / non-product file** (1 C route) — `/my/id-card.test` (TanStack picked up a `.test.tsx` colocated file; not a real route).

---

## Deferred (excluded)

p2-deferred modules and out-of-shipped-surface flows/routes — track but do not gate.

### Matrix A
- **BR-39** — M19 Committee Dissolution (p2-deferred).

### Matrix B — flows (25)
- **M13** social (2): WF-081, WF-083
- **M14** national reporting (3): WF-084, WF-085, WF-086
- **M15** jobs board (5): WF-087, WF-088, WF-089, WF-090, WF-091
- **M16** advertising (5): WF-092, WF-093, WF-094, WF-095, WF-096 — module absent from br-registry
- **M17** marketplace (3): WF-097, WF-098, WF-099
- **M18** surveys (2): WF-102, WF-103
- **M19** committees (5): WF-104, WF-105, WF-106, WF-107, WF-108

### Matrix C — routes (8)
- **M18 surveys** (6): `/my/surveys/`, `/my/surveys/$surveyId`, `/org/$orgSlug/officer/surveys/`, `/org/$orgSlug/officer/surveys/$surveyId`, `/org/$orgSlug/officer/surveys/new`, admin `/surveys/`
- **M14 / M19** (2): admin `/national-dashboard/`, admin `/committees/`
