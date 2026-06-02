---
Artifact: WORKFLOW_MAP
Version: 1.0
Generated: 2026-05-20
Based On: MASTER_PRD.md, DOMAIN_GLOSSARY.md, ROLE_PERMISSION_MATRIX.md, MODULE_MAP.md, EVENT_CONTRACTS.md, DOMAIN_MODEL.md, MODULE_SPECs M01-M19
Pipeline Stage: Phase A -- Workflow Discovery
---

# Workflow Map

## 1. Workflow Registry

### 1.1 Authentication & Onboarding (M01)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-001 | M01 | lifecycle | Self-Registration: name, email, license, password + OTP verification | PRD |
| WF-002 | M01 | lifecycle | Account Claim: imported member claims pre-populated account via token + OTP | PRD |
| WF-003 | M01 | CRUD | Login: email/password or magic link authentication | PRD |
| WF-004 | M01 | lifecycle | Password Reset: OTP-based password reset flow | PRD |
| WF-005 | M01 | lifecycle | Smart Onboarding Wizard: org-type-aware setup (profile, import, dues, gateway, invite) | PRD |
| WF-006 | M01 | lifecycle | Member Onboarding: optional profile completion wizard post-dashboard | PRD |
| WF-007 | M01 | lifecycle | MFA Enrollment: TOTP setup via authenticator app | PRD |
| WF-008 | M01 | CRUD | Invite Member: officer sends individual email invitation | PRD |
| WF-009 | M01 | cross-module | Bulk CSV Import with Member Matching: upload, validate, preview, import (touches M05) | PRD |

### 1.2 Member Profile & Settings (M02)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-010 | M02 | CRUD | View & Update Profile: edit personal info, photo upload, privacy toggles | PRD |
| WF-011 | M02 | lifecycle | Account Deletion: request, 30-day grace, cascade via person.deletionProcessor | PRD |
| WF-012 | M02 | CRUD | Digital ID Card: view/download QR-verified member ID | PRD |
| WF-013 | M02 | CRUD | Notification Preferences: per-channel opt-in/out | PRD |
| WF-014 | M02 | reporting | Data Export: GDPR-style personal data export | PRD |

### 1.3 Platform Administration (M03)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-015 | M03 | lifecycle | Onboard Association: create tenant with locale, license regex, credit config | PRD |
| WF-016 | M03 | lifecycle | Provision Organization: create org within association, assign initial officer | PRD |
| WF-017 | M03 | lifecycle | Manage Subscriptions: trial-to-paid conversion, payment management | PRD |
| WF-018 | M03 | admin | Feature Flag Management: module x tier matrix + per-org overrides | PRD |
| WF-019 | M03 | admin | User Impersonation: read-only, 30-min, full audit trail | PRD |
| WF-020 | M03 | admin | Support Ticket Resolution: ticket inbox, SLA tracking, escalation | PRD |
| WF-021 | M03 | reporting | Revenue Dashboard: MRR, ARR, churn, growth metrics | PRD |
| WF-022 | M03 | admin | Admin Team Management: invite/modify/remove platform admins | PRD |
| WF-023 | M03 | admin | Org Suspension/Cancellation: admin suspends or cancels org | PRD |

### 1.4 Organization Admin (M04)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-024 | M04 | CRUD | Org Settings: update org profile, logo, branding, public page | PRD |
| WF-025 | M04 | lifecycle | Officer Transition: assign/transfer officer roles with handoff | PRD |
| WF-026 | M04 | lifecycle | Disciplinary Action: suspend/remove member with mandatory reason | PRD |
| WF-027 | M04 | reporting | Org Dashboard: smart action cards, key metrics | PRD |
| WF-028 | M04 | CRUD | Org Public Page: URL-friendly public profile | PRD |

### 1.5 Membership (M05)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-029 | M05 | lifecycle | Membership Application: submit, review, approve/reject | PRD |
| WF-030 | M05 | CRUD | Member Roster: list, search, filter, bulk actions | PRD |
| WF-031 | M05 | cross-module | Bulk CSV Import: upload, validate, preview, import with matching (M01) | PRD |
| WF-032 | M05 | lifecycle | Membership Status Computation: derived from dues_expiry_date | PRD |
| WF-033 | M05 | CRUD | Membership Categories: CRUD categories per org | PRD |
| WF-034 | M05 | CRUD | Member Directory: privacy-filtered searchable list | PRD |
| WF-035 | M05 | cross-module | Reinstatement: pay dues to restore Active (touches M06) | PRD |
| WF-036 | M05 | lifecycle | Member Transfer: inter-org transfer with approval | PRD |
| WF-037 | M05 | CRUD | Cross-Org Matching: email/license matching with normalization | PRD |

### 1.6 Dues & Payments (M06)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-038 | M06 | lifecycle | Pay Dues Online: member initiates payment, gateway processes, webhook confirms | PRD |
| WF-039 | M06 | lifecycle | Fund Allocation: automatic split on every payment (chapter, national, special) | PRD |
| WF-040 | M06 | admin | Dues Config: set amount, currency, billing cycle per org | PRD |
| WF-041 | M06 | lifecycle | Refund Processing: treasurer-initiated, reverses expiry extension | PRD |
| WF-042 | M06 | cross-module | Dunning/Reminders: scheduled reminder processor checks expiry, creates notifications | PRD |
| WF-043 | M06 | reporting | Financial Dashboard: collection rates, payment history, fund reports | PRD |
| WF-044 | M06 | CRUD | Manual Payment Recording: treasurer records offline payment | PRD |
| WF-045 | M06 | CRUD | Payment Receipt Generation: auto-generate receipt on completed payment | PRD |

### 1.7 Communications (M07)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-046 | M07 | lifecycle | Send Announcement: compose, target audience, schedule/send immediately | PRD |
| WF-047 | M07 | CRUD | Message Templates: create/edit reusable templates with variables | PRD |
| WF-048 | M07 | reporting | Delivery Stats: open/delivery rates per announcement | PRD |
| WF-049 | M07 | CRUD | Communication Dashboard: announcement list, drafts, scheduled | PRD |
| WF-050 | M07 | admin | Email Opt-Out Management: respect member preferences per channel | PRD |

### 1.8 Events (M08)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-051 | M08 | lifecycle | Create & Publish Event: draft, configure, publish with capacity | PRD |
| WF-052 | M08 | lifecycle | Event Registration: member registers, waitlist if full | PRD |
| WF-053 | M08 | lifecycle | QR Check-In: authenticated scanner confirms attendance | PRD |
| WF-054 | M08 | lifecycle | Event Cancellation: cancel event, notify registrants, process refunds | PRD |
| WF-055 | M08 | CRUD | Events Dashboard: event list, upcoming/past, attendance stats | PRD |
| WF-056 | M08 | CRUD | My Events: member view of registered/past events | PRD |
| WF-057 | M08 | lifecycle | Waitlist Auto-Promotion: FIFO promotion when spot opens | PRD |

### 1.9 Training (M09)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-058 | M09 | lifecycle | Training CRUD: create, publish, cancel, complete (5 types) | PRD |
| WF-059 | M09 | lifecycle | Training Enrollment: register with capacity management | PRD |
| WF-060 | M09 | cross-module | Attendance & Credit Award: mark attendance, auto-credit to M10 | PRD |
| WF-061 | M09 | cross-module | Certificate Generation: PDF with QR verification (touches M11) | PRD |
| WF-062 | M09 | cross-module | Paid Training: fee collection via M06 billing | PRD |
| WF-063 | M09 | reporting | Training Analytics: completion rates, revenue | PRD |
| WF-064 | M09 | CRUD | Accredited Providers: provider CRUD and management | PRD |

### 1.10 Credit Tracking (M10)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-065 | M10 | CRUD | View Credit Summary: per-cycle breakdown, cross-org aggregation | PRD |
| WF-066 | M10 | CRUD | Add Manual Credit: self-entry with activity details, optional docs | PRD |
| WF-067 | M10 | admin | Officer Credit Adjustment: award or deduct credits with mandatory reason | PRD |
| WF-068 | M10 | reporting | Org Credit Compliance: officer view of member compliance rates | PRD |
| WF-069 | M10 | lifecycle | Credit Cycle Management: configurable start date, excess carryover | PRD |
| WF-070 | M10 | reporting | Credit Transcript Export: per-member PDF/CSV transcript | PRD |

### 1.11 Documents & Credentials (M11)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-071 | M11 | CRUD | Download Member ID Card: PDF with QR, auto-regenerated on profile change | PRD |
| WF-072 | M11 | lifecycle | Public Verification: scan QR code, verify membership/credential status | PRD |
| WF-073 | M11 | CRUD | Document Management: upload, publish, archive org documents | PRD |
| WF-074 | M11 | CRUD | Certificate Download: member downloads training certificates | PRD |
| WF-075 | M11 | admin | Credential Template Management: design digital credential templates | PRD |

### 1.12 Elections & Governance (M12)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-076 | M12 | lifecycle | Create & Run Election: full lifecycle (draft -> nominations -> voting -> results) | PRD |
| WF-077 | M12 | lifecycle | Member Votes: cast secret ballot, one vote per position | PRD |
| WF-078 | M12 | lifecycle | Bylaw Ratification: propose and vote on bylaw changes | PRD |
| WF-079 | M12 | cross-module | Election-to-Officer Transition: winners auto-assigned officer roles (touches M04) | PRD |

### 1.13 Professional Feed (M13)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-080 | M13 | CRUD | Browse Feed: infinite scroll, org-scoped, engagement actions | PRD |
| WF-081 | M13 | lifecycle | Create Post: compose, attach media, publish | PRD |
| WF-082 | M13 | admin | Content Moderation: hide/remove posts, report handling | PRD |
| WF-083 | M13 | CRUD | Mute/Unmute: member mutes specific authors | PRD |

### 1.14 National Dashboard (M14)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-084 | M14 | reporting | Review Association Health: cross-chapter KPIs, trends, comparison | PRD |
| WF-085 | M14 | reporting | Chapter Drill-Down: detailed chapter metrics | PRD |
| WF-086 | M14 | reporting | National Data Export: CSV/PDF export of aggregated data | PRD |

### 1.15 Job Board (M15)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-087 | M15 | CRUD | Browse & Save Jobs: search, filter, save listings | PRD |
| WF-088 | M15 | lifecycle | Create Job Posting: officer or employer creates listing | PRD |
| WF-089 | M15 | lifecycle | External Employer Registration: register, verify, post jobs | PRD |
| WF-090 | M15 | lifecycle | Job Listing Expiry: auto-expire at 30 days, 7-day warning, extension | PRD |
| WF-091 | M15 | CRUD | Job Alerts: member configures keyword/specialty/location alerts | PRD |

### 1.16 Advertising (M16)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-092 | M16 | lifecycle | Campaign Creation: advertiser creates campaign, submits creatives | PRD |
| WF-093 | M16 | admin | Creative Approval: admin reviews and approves/rejects creatives | PRD |
| WF-094 | M16 | lifecycle | Campaign Lifecycle: draft -> active -> paused -> completed | PRD |
| WF-095 | M16 | CRUD | Member Reports Ad: report inappropriate/misleading ads | PRD |
| WF-096 | M16 | reporting | Advertising Dashboard: impressions, clicks, revenue metrics | PRD |

### 1.17 Marketplace (M17)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-097 | M17 | lifecycle | Vendor Registration & Verification: apply, verify, list products | PRD |
| WF-098 | M17 | CRUD | Browse Marketplace: search, filter by category | PRD |
| WF-099 | M17 | admin | Vendor Suspension: admin suspends non-compliant vendor | PRD |

### 1.18 Surveys & Polls (M18)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-100 | M18 | lifecycle | Create Survey: compose questions, set deadline, publish | PRD |
| WF-101 | M18 | CRUD | Respond to Survey: member fills out and submits | PRD |
| WF-102 | M18 | reporting | Survey Results: aggregated analytics per question type | PRD |
| WF-103 | M18 | CRUD | Quick Poll: inline single-question poll with instant results | PRD |

### 1.19 Committee Management (M19)

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-104 | M19 | lifecycle | Create Committee: standing or ad-hoc, assign chairperson | PRD |
| WF-105 | M19 | CRUD | Manage Committee Members: add/remove members, assign roles | PRD |
| WF-106 | M19 | CRUD | Manage Tasks: create, assign, track committee tasks | PRD |
| WF-107 | M19 | CRUD | Committee Meetings: schedule and record meetings | PRD |
| WF-108 | M19 | lifecycle | Committee Dissolution: dissolve ad-hoc committee, cascade cleanup | PRD |

### 1.20 Cross-Cutting Workflows

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-109 | Notifications | lifecycle | Notification Lifecycle: queued -> sent -> delivered -> read (3 channels) | PRD |
| WF-110 | Email | lifecycle | Email Queue Processing: pending -> sent/failed, 30-day cleanup | PRD |
| WF-111 | Audit | admin | Audit Log Retention: 1-year retention, daily cleanup | PRD |
| WF-112 | Booking | lifecycle | Booking Event Lifecycle: create slots, accept bookings, confirmations | PRD |
| WF-113 | Booking | lifecycle | Slot Generation: auto-generate time slots from recurrence config | PRD |
| WF-114 | Booking | lifecycle | Booking Confirmation Timer: auto-reject unconfirmed bookings | PRD |

### 1.21 Booking (M20) — User-Facing Workflows

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-115 | M20 | CRUD | Create Booking Event: provider configures availability template (schedule, duration, location) | MODULE_SPEC m20-booking §3 |
| WF-116 | M20 | CRUD | Manage Schedule Exceptions: provider blocks dates or modifies hours for specific periods | MODULE_SPEC m20-booking §3 |
| WF-117 | M20 | lifecycle | Browse & Book: client views available slots and creates a booking | MODULE_SPEC m20-booking §3 |
| WF-118 | M20 | lifecycle | Confirm/Reject Booking: provider accepts or declines pending bookings | MODULE_SPEC m20-booking §3 |
| WF-119 | M20 | lifecycle | Cancel Booking: client or provider cancels existing booking, releases slot | MODULE_SPEC m20-booking §3 |
| WF-120 | M20 | lifecycle | Mark No-Show: provider flags client or host no-show after appointment time | MODULE_SPEC m20-booking §3 |
| WF-121 | M20 | CRUD | List My Bookings: client/provider views upcoming and past bookings | MODULE_SPEC m20-booking §3 |

### 1.22 Email (M22) — Module-Local Workflows

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-122 | M22 | CRUD | Create Template: admin defines reusable email template with variables | MODULE_SPEC m22-email §3 |
| WF-123 | M22 | lifecycle | Enqueue Email: system adds email to processing queue with template and variables | MODULE_SPEC m22-email §3 |
| WF-124 | M22 | lifecycle | Handle Bounce: system processes hard bounce, adds address to suppression list | MODULE_SPEC m22-email §3 |
| WF-125 | M22 | admin | Manage Suppressions: admin views and removes suppressed addresses | MODULE_SPEC m22-email §3 |
| WF-126 | M22 | admin | Cancel Queued Email: admin cancels pending email before processing | MODULE_SPEC m22-email §3 |
| WF-127 | M22 | lifecycle | Retry Failed Email: system re-attempts failed delivery up to max retries | MODULE_SPEC m22-email §3 |

### 1.23 Billing (M21) — Module-Local Workflows

| WF-ID | Module | Type | Description | Source |
|-------|--------|------|-------------|--------|
| WF-128 | M21 | lifecycle | Onboard Merchant: admin creates Stripe Connect account, completes onboarding flow | MODULE_SPEC m21-billing §3 |
| WF-129 | M21 | CRUD | Create Invoice: system/admin generates invoice with line items for dues/events/services | MODULE_SPEC m21-billing §3 |
| WF-130 | M21 | lifecycle | Pay Invoice: member processes payment via Stripe Payment Intent | MODULE_SPEC m21-billing §3 |
| WF-131 | M21 | lifecycle | Refund Payment: admin processes full or partial refund | MODULE_SPEC m21-billing §3 |
| WF-132 | M21 | lifecycle | Handle Webhook: system processes Stripe webhook events (payment success/failure/refund) | MODULE_SPEC m21-billing §3 |
| WF-133 | M21 | CRUD | View Invoices: member/admin lists and filters invoices by status/date | MODULE_SPEC m21-billing §3 |

---

## 2. Entity CRUD Lifecycle Matrix

### 2.1 Person

| Operation | Who | Validation | Cascade |
|-----------|-----|------------|---------|
| Create | Self (registration) / Officer (import) | Email unique, license format per BR-23 | Creates session |
| Read | Self / Officer (roster) / Admin (impersonation) | Org-scoped for officers | -- |
| Update | Self (profile) / Admin (support) | Photo <5MB, SVG sanitized per BR-31 | Regenerate ID card |
| Delete | Self (request) | 30-day grace period | person.deletionProcessor: anonymize payments, remove PII, retain financial records 7yr (BR-32) |
| Bulk Import | Officer | CSV validation, match on email/license (BR-22) | Create or link membership |

### 2.2 Membership

| Operation | Who | Validation | Cascade |
|-----------|-----|------------|---------|
| Create | Officer (approve application) / System (import) | One per person-per-org, valid tier | Log to status_history |
| Read | Self / Officer / Admin | Org-scoped | -- |
| Update | System (status computation) / Officer (override) | Valid transitions only (BR-03) | Update dues_expiry_date |
| Archive | N/A (soft via status) | -- | -- |
| Bulk | Officer (import, category change, reminder) | Max 500 per batch | -- |

### 2.3 DuesPayment

| Operation | Who | Validation | Cascade |
|-----------|-----|------------|---------|
| Create | Member (online) / Treasurer (manual) | Amount matches config (BR-04) | Fund allocation (BR-05), extend expiry (BR-07) |
| Read | Self / Treasurer / President / Admin | Org-scoped | -- |
| Refund | Treasurer | Within 30 days, not allocated (BR-08) | Reverse expiry extension |
| Delete | Never | Financial retention 7yr (BR-32) | -- |

### 2.4 Event

| Operation | Who | Validation | Cascade |
|-----------|-----|------------|---------|
| Create | Officer | Required fields, visibility setting (BR-16) | -- |
| Read | Members (if published) / Officers | Org or network scoped | -- |
| Update | Officer | Cannot change type after registrations (BR-15) | -- |
| Cancel | Officer | -- | Notify registrants, process refunds (M8-R3) |
| Complete | Officer/System | Post-event | Lock registrations and check-ins (M8-R6) |

### 2.5 Training

| Operation | Who | Validation | Cascade |
|-----------|-----|------------|---------|
| Create | Officer | 5 types, credit hours, provider | -- |
| Read | Members (network-wide if published) | -- | -- |
| Update | Officer | Cannot change type after registrations (BR-15) | -- |
| Cancel | Officer | -- | Cancel enrollments, no certificates |
| Complete | Officer | Post-training | Generate certificates, award credits (BR-13) |

### 2.6 Election

| Operation | Who | Validation | Cascade |
|-----------|-----|------------|---------|
| Create | President/Officer | Positions, timeline | -- |
| Read | Members (when active) / Officers | Org-scoped | -- |
| Update | Officer (before voting opens) | -- | -- |
| Publish Results | President | After voting closes | Immutable results (BR-33) |
| Cancel | Officer | Before results published | -- |

### 2.7 Announcement

| Operation | Who | Validation | Cascade |
|-----------|-----|------------|---------|
| Create | Officer (secretary+) | Channel, audience segment | -- |
| Read | Target audience | Respect opt-out (BR-28) | -- |
| Schedule | Officer | Future date/time | -- |
| Send | System (scheduled) / Officer (immediate) | Deduplication (BR-28) | Queue email, push, in-app |
| Archive | Officer | -- | -- |

### 2.8 Committee

| Operation | Who | Validation | Cascade |
|-----------|-----|------------|---------|
| Create | President/Officer | Chairperson required | -- |
| Read | Org members | -- | -- |
| Update | Chairperson/Officer | -- | -- |
| Dissolve | President/Chairperson | -- | Remove member assignments, archive tasks (BR-39) |

---

## 3. Role Journey Maps

### 3.1 Member (Regular)

| Activity | Workflows | Frequency |
|----------|-----------|-----------|
| Pay dues | WF-038 | Annual/semi-annual/quarterly |
| View profile & ID card | WF-010, WF-012 | As needed |
| Register for events | WF-052 | Monthly |
| Attend training | WF-059 | Quarterly |
| Check credit status | WF-065 | Quarterly |
| Browse feed | WF-080 | Daily |
| Vote in elections | WF-077 | Annual |
| Respond to surveys | WF-101 | As needed |
| Browse jobs | WF-087 | As needed |
| Browse marketplace | WF-098 | As needed |
| Update preferences | WF-013 | Rare |

### 3.2 Officer (Treasurer)

| Activity | Workflows | Frequency |
|----------|-----------|-----------|
| Review financial dashboard | WF-043 | Weekly |
| Record manual payments | WF-044 | Weekly |
| Process refunds | WF-041 | Rare |
| Configure dues | WF-040 | Annual |
| View collection rates | WF-043 | Monthly |
| Export financial reports | WF-043 | Monthly |

### 3.3 Officer (Secretary)

| Activity | Workflows | Frequency |
|----------|-----------|-----------|
| Manage member roster | WF-030 | Weekly |
| Review applications | WF-029 | Weekly |
| Send announcements | WF-046 | Weekly |
| Manage events | WF-051 | Monthly |
| Manage training | WF-058 | Monthly |
| Bulk import members | WF-031 | Rare |

### 3.4 Officer (President)

| Activity | Workflows | Frequency |
|----------|-----------|-----------|
| Review org dashboard | WF-027 | Daily |
| Manage officers | WF-025 | Rare |
| Disciplinary actions | WF-026 | Rare |
| Run elections | WF-076 | Annual |
| Publish election results | WF-076 | Annual |
| Create committees | WF-104 | As needed |
| Dissolve committees | WF-108 | Rare |

### 3.5 Platform Administrator (Super Admin)

| Activity | Workflows | Frequency |
|----------|-----------|-----------|
| Onboard associations | WF-015 | Monthly |
| Provision organizations | WF-016 | Weekly |
| Manage subscriptions | WF-017 | Weekly |
| Manage feature flags | WF-018 | Weekly |
| Impersonate users | WF-019 | Daily |
| Resolve support tickets | WF-020 | Daily |
| Review revenue dashboard | WF-021 | Weekly |
| Manage admin team | WF-022 | Rare |
| Approve external employers | WF-089 | Weekly |
| Approve ad creatives | WF-093 | Weekly |
| Verify marketplace vendors | WF-097 | Weekly |

---

## 4. Business Rule to Workflow Mapping

| BR-ID | Rule Summary | Enforcing Workflows | Module |
|-------|-------------|---------------------|--------|
| BR-01 | Membership status from dues_expiry_date | WF-032 | M05 |
| BR-02 | Grace period 30d default, 0-90 configurable | WF-032 | M05 |
| BR-03 | Valid membership transitions only | WF-032, WF-029, WF-026, WF-035 | M05 |
| BR-04 | Dues amount per org | WF-040 | M06 |
| BR-05 | Fund allocation sums to 100% | WF-039 | M06 |
| BR-06 | Payment recording by treasurer | WF-044, WF-038 | M06 |
| BR-07 | Dues expiry extension on payment | WF-038, WF-044 | M06 |
| BR-08 | Refund within 30 days, not allocated | WF-041 | M06 |
| BR-09 | Officer role assignment (one per org) | WF-025 | M04 |
| BR-10 | Platform admin impersonation rules | WF-019 | M03 |
| BR-11 | Credit cycle start configurable | WF-069 | M10 |
| BR-12 | Credit carry-over to next cycle | WF-069 | M10 |
| BR-13 | Auto credits on attendance confirmation | WF-060 | M09, M10 |
| BR-14 | Cross-org credit aggregation | WF-065 | M10 |
| BR-15 | Training vs event distinction | WF-051, WF-058 | M08, M09 |
| BR-16 | Activity visibility (internal/network) | WF-051, WF-058 | M08, M09 |
| BR-17 | Attendance confirmation by officer | WF-053, WF-060 | M08, M09 |
| BR-18 | QR check-in auth + valid event | WF-053 | M08 |
| BR-19 | ID card generation rules | WF-071 | M11 |
| BR-20 | Certificate generation post-activity | WF-061 | M09, M11 |
| BR-21 | Multi-org member account | WF-001, WF-037 | M01 |
| BR-22 | Member matching on import | WF-009, WF-031 | M01, M05 |
| BR-23 | License number format normalization | WF-001, WF-031 | M01, M05 |
| BR-24 | Invitation expiry | WF-008, WF-002 | M01 |
| BR-25 | OTP registration requirements | WF-001 | M01 |
| BR-26 | Session management | WF-003 | M01 |
| BR-27 | Event registration capacity + waitlist | WF-052, WF-057 | M08 |
| BR-28 | Communication deduplication | WF-046 | M07 |
| BR-29 | Org public page requirements | WF-028 | M04 |
| BR-30 | Payment gateway isolation per org | WF-038, WF-040 | M06 |
| BR-31 | SVG upload sanitization | WF-010, WF-024 | M02, M04 |
| BR-32 | Financial records retained 7yr | WF-011, WF-038 | M02, M06 |
| BR-33 | Election integrity (secret ballot, one vote) | WF-077 | M12 |
| BR-34 | Nomination eligibility (active members) | WF-076 | M12 |
| BR-35 | Feed content moderation | WF-082 | M13 |
| BR-36 | National dashboard access scoping | WF-084 | M14 |
| BR-37 | Job posting expiry (30 days) | WF-090 | M15 |
| BR-38 | Marketplace referral disclosure | WF-098 | M17 |
| BR-39 | Committee dissolution cascade | WF-108 | M19 |
| BR-40 | Survey anonymity guarantee | WF-101, WF-102 | M18 |
| BR-41 | Paid training requires payment confirmation before enrollment | WF-062 | M09 |
| BR-42 | Training type restricted to 5 platform-defined types (not org-customizable) | WF-058 | M09 |
| BR-43 | Completed training locks enrollments (no changes post-completion) | WF-058, WF-060 | M09 |
| BR-44 | Election certification cross-module effects (ends outgoing officer terms, creates new terms, generates transition checklists) | WF-077 | M12 |
| BR-45 | Ad creative requires admin approval before display (no self-serve) | WF-093 | M16 |
| BR-46 | Ad targeting segment-based only, no individual member data shared | WF-093, WF-094 | M16 |
| BR-47 | Sponsored content clearly labeled "Sponsored" | WF-094 | M16 |
| BR-48 | Member ad opt-out: no targeted ads, generic only | WF-094 | M16 |
| BR-49 | Campaign budget exhausted = auto-pause delivery (no overspend) | WF-093, WF-095 | M16 |

**Orphan Rules:** None. All 49 BRs map to at least one workflow.

---

## 5. State Transition Inventory

> **Note:** Authoritative state machine definitions are in STATE_MACHINES.md. This section provides a summary inventory for quick reference.

### 5.1 Membership Status

| State | Trigger | Preconditions | Side Effects | Terminal? |
|-------|---------|---------------|--------------|-----------|
| Pending | Application submitted | Valid person record | -- | No |
| Active | Approved / dues paid / officer restores | Valid application or payment | Log to status_history; status computed from dues_expiry_date (BR-01) | No |
| Grace | dues_expiry_date passed | Was Active; grace period per BR-02 | Read-only access, blocked from new registrations | No |
| Lapsed | Grace period expired (BR-02) | Was Grace; valid transition per BR-03 | Blocked from most features | No |
| Suspended | Officer action | Any active state | Mandatory reason logged | No |
| Removed | President action / rejection | Any state | Cascade: remove from rosters, committees | Yes |
| Expired | Lapsed duration exceeded | Lapsed state + configured expiry threshold | Blocks all org access | Yes |
| Resigned | Member voluntary resignation | Active/Grace/Lapsed + member action | Blocks all org access, retains history | Yes |
| Deceased | Officer records death | Any state + officer action | Blocks all access, anonymize after retention | Yes |
| Expelled | Disciplinary expulsion (M04) | Any state (except Deceased) + president action | Blocks all access, audit trail retained | Yes |

### 5.2 Payment Status

| State | Trigger | Preconditions | Side Effects | Terminal? |
|-------|---------|---------------|--------------|-----------|
| Pending | Payment initiated | Valid member + dues config | -- | No |
| Completed | Webhook / manual confirm | Pending payment | Extend expiry (BR-07), fund allocation (BR-05) | No |
| Failed | Gateway failure | Pending payment | Notification to member | Yes |
| Expired | 24h timeout | Pending, no webhook | -- | Yes |
| Refunded | Treasurer action | Completed, within 30d (BR-08) | Reverse expiry extension | Yes |
| PartiallyRefunded | Treasurer action | Completed | Partial expiry adjustment | Yes |
| Submitted | Officer submits manual payment | pending + officer action | Awaits confirmation | No |
| UnderReview | Senior officer reviewing | submitted + reviewer action | Under review | No |
| Confirmed | Payment verified | underReview + reviewer confirms | Records as completed equivalent | No |
| Rejected | Payment rejected | underReview + reviewer rejects | Returns to pending or terminates | Yes |

### 5.3 Event Status

| State | Trigger | Preconditions | Side Effects | Terminal? |
|-------|---------|---------------|--------------|-----------|
| Draft | Created | Officer auth | -- | No |
| Published | Officer publishes | Has required fields; visibility per BR-16 | Visible to audience | No |
| Completed | Post-event | Published | Lock registrations (M8-R6); activity type per BR-15 | Yes |
| Cancelled | Officer action | Published | Notify registrants, refunds (M8-R3) | Yes |

### 5.4 Event Registration Status

| State | Trigger | Preconditions | Side Effects | Terminal? |
|-------|---------|---------------|--------------|-----------|
| Confirmed | Registration accepted | Active member, capacity available per BR-27 | -- | No |
| Waitlisted | Registration when full | Active member, at capacity per BR-27 | FIFO waitlist queue | No |
| Cancelled | Member or officer | Confirmed/Waitlisted | Release capacity, auto-promote waitlist (BR-27) | Yes |
| Refunded | Event cancelled | Was Confirmed | Payment refund | Yes |
| NoShow | Post-event mark | Confirmed, event completed | -- | Yes |

### 5.5 Training Status

| State | Trigger | Preconditions | Side Effects | Terminal? |
|-------|---------|---------------|--------------|-----------|
| Draft | Created | Officer auth | -- | No |
| Published | Officer publishes | Required fields set | Network-wide visible (BR-16 default) | No |
| Completed | Post-training | Published, end date passed | Enable certificate generation | Yes |
| Cancelled | Officer action | Draft/Published | Cancel enrollments, block certificates | Yes |

### 5.6 Enrollment Status

| State | Trigger | Preconditions | Side Effects | Terminal? |
|-------|---------|---------------|--------------|-----------|
| Enrolled | Member registers | Active member, capacity | -- | No |
| Completed | Attendance confirmed | Enrolled, training completed | Auto-credit award (BR-13) | Yes |
| Cancelled | Member/officer action | Enrolled | Release capacity | Yes |
| NoShow | Post-training mark | Enrolled | -- | Yes |

### 5.7 Election Status

| State | Trigger | Preconditions | Side Effects | Terminal? |
|-------|---------|---------------|--------------|-----------|
| Draft | Created | Officer auth | -- | No |
| NominationsOpen | Officer opens | Draft, positions configured | Members can self-nominate | No |
| VotingOpen | Officer opens voting | Nominations closed, candidates exist | Ballot available to active members | No |
| AwaitingConfirmation | Voting closes | Voting period ended | Officers see results, members see "awaiting" | No |
| Published | President publishes | AwaitingConfirmation | Results immutable (BR-33), trigger officer transition | Yes |
| Cancelled | Officer action | Draft/NominationsOpen/VotingOpen | -- | Yes |

### 5.8 Announcement Status

| State | Trigger | Preconditions | Side Effects | Terminal? |
|-------|---------|---------------|--------------|-----------|
| Draft | Created | Officer auth | -- | No |
| Scheduled | Officer sets future date | Draft, valid schedule | -- | No |
| Sent | Delivery triggered | Scheduled time reached / immediate | Queue email, push, in-app; dedup per BR-28 | No |
| ScheduledFailed | Delivery failure | Was Scheduled | Alert officer | Yes |
| Archived | Officer action | Sent | -- | Yes |

### 5.9 Organization Lifecycle

| State | Trigger | Preconditions | Side Effects | Terminal? |
|-------|---------|---------------|--------------|-----------|
| Trial | Provisioned by admin | Association exists | -- | No |
| Active | Payment confirmed | Trial org | Full feature access; payment gateway isolated per BR-30 | No |
| Suspended | Admin action / payment failure | Active | Read-only for members; impersonation rules per BR-10 | No |
| Cancelled | Admin action / trial expired | Active/Suspended | 90-day data preservation | Yes |

### 5.10 Notification Status

| State | Trigger | Preconditions | Side Effects | Terminal? |
|-------|---------|---------------|--------------|-----------|
| Queued | Any module creates notification | -- | Dedup check per BR-28 | No |
| Sent | processScheduled job delivers | Queued | -- | No |
| Delivered | Delivery confirmed | Sent | -- | No |
| Read | User opens | Delivered | -- | Yes |
| Failed | Delivery error | Queued/Sent | Retry or alert | Yes |
| Expired | 90-day cleanup | Any non-terminal | Removed by notifs.cleanup | Yes |

### 5.11 Additional State Machines

| Entity | States | Notes |
|--------|--------|-------|
| Post (M13) | Draft -> Published -> Hidden/Removed | Hidden is reversible; moderation per BR-35 |
| Job Listing (M15) | Draft -> Published -> Expired/Closed; Draft -> PendingReview -> Published/Rejected | 30-day auto-expiry (BR-37) |
| Campaign (M16) | Draft -> Active -> Paused/Completed | Paused is reversible; budget auto-pause per BR-49 |
| Creative (M16) | Pending -> Approved/Rejected | Admin approval required per BR-45 |
| Survey (M18) | Draft -> Active -> Closed | Manual or deadline close; anonymity per BR-40 |
| Vendor (M17) | Pending -> Verified -> Suspended; Pending -> Rejected | Suspended is reversible; referral disclosure per BR-38 |
| Committee (M19) | Active -> Expired/Dissolved; Expired -> Renewed | Standing committees renew; dissolution cascade per BR-39 |
| Task (M19) | Open -> InProgress -> Completed/Overdue | -- |
| Document (M11) | Draft -> Published -> Archived | -- |
| Onboarding (M01) | Started -> InProgress -> Completed/Resumed | Resumable |
| Invitation Token (M01) | Pending -> Claimed/Expired | 7-day default expiry |

---

## 6. Cross-Module Flow Catalog

### 6.1 Member Registration & Onboarding

| Step | From | To | Data Passed | Mechanism | Sync/Async |
|------|------|-----|-------------|-----------|------------|
| 1 | M01 (Registration form) | M05 (Membership API) | personId, orgId, licenseNumber | API call (POST /membership) — not via PersonCreated event | Sync |
| 2 | M05 (MembershipApproved event) | M11 (Credentials) | membershipId, personId, orgId | Event subscription | Async |
| 3 | M01 (Onboarding Wizard) | M06 (Dues Config API) | orgId, billing cycle | API call | Sync |
| 4 | M01 (Onboarding Wizard) | M05 (Bulk Import API) | CSV file, orgId | API call | Sync |

> **Note:** PersonCreated event (payload: `{personId, email, licenseNumber}`) is consumed by M02 (profile initialization), not M05. Membership creation is triggered by the registration form API call, which includes orgId from the registration context.

### 6.2 Dues Payment & Membership Status

| Step | From | To | Data Passed | Sync/Async |
|------|------|-----|-------------|------------|
| 1 | M06 (PaymentRecorded event) | M05 (Membership) | paymentId, personId, orgId, amount, invoiceId, newExpiryDate | Sync |
| 2 | M05 (Status updated) | M05 (Status History) | membershipId, oldStatus, newStatus | Sync |
| 3 | M06 (Dunning processor) | Notifications | memberId, reminderLevel, orgId | Async (cron) |
| 4 | Notifications | Email Queue | notificationId, template, recipient | Async (5min) |

### 6.3 Training Attendance & Credit Award

| Step | From | To | Data Passed | Sync/Async |
|------|------|-----|-------------|------------|
| 1 | M09 (Attendance confirmed) | M10 (Credit Entry) | personId, trainingId, creditValue, type=AUTO | Sync |
| 2 | M09 (Training completed) | M11 (Certificate) | personId, trainingId, creditValue, orgName | Sync |
| 3 | M11 (Certificate generated) | M02 (Profile) | certificateId, downloadUrl | Async |

### 6.4 Event Registration & Payment

| Step | From | To | Data Passed | Mechanism | Sync/Async |
|------|------|-----|-------------|-----------|------------|
| 1 | M08 (Paid event registration) | M06 (Billing) | eventId, personId, registrationId, amount | UI redirect to payment page (frontend navigates to checkout with invoiceId) | Sync |
| 2 | M06 (PaymentRecorded event) | M08 (Registration confirmed) | paymentId, personId, orgId, amount, invoiceId, registrationId, newExpiryDate | Event subscription — M08 correlates via registrationId | Sync |
| 3 | M08 (Event cancelled) | M06 (Refund API) | registrationIds, amounts | API call | Sync |
| 4 | M08 (Event cancelled) | Notifications | registrantIds, eventName | Event (EventCancelled) | Async |

> **Note:** Step 1 is UI-driven, not event-driven. M08 creates a pending registration + invoice via M06 API, then the frontend redirects to the payment page. Registration stays `pending` until PaymentRecorded event confirms (AC-M08-003).

### 6.5 Election & Officer Transition

| Step | From | To | Data Passed | Sync/Async |
|------|------|-----|-------------|------------|
| 1 | M12 (Results published) | M04 (Officer Roles) | winnerId, positionId, orgId | Sync |
| 2 | M04 (Officer assigned) | Notifications | officerId, roleName, orgId | Async |
| 3 | M04 (Officer assigned) | Auth middleware | Officer role reflected via officer_term table read | No event — middleware reads directly | N/A |

> **Note:** Officer roles are not stored in M05 (Membership). Auth middleware reads `officer_term` table (M04) directly via `hasMinimumRole()`. No M05 action required for permission updates.

### 6.6 Account Deletion Cascade

| Step | From | To | Data Passed | Sync/Async |
|------|------|-----|-------------|------------|
| 1 | M02 (Deletion requested) | person.deletionProcessor | personId, gracePeriodEnd | Async (30-day delay) |
| 2 | Processor | M06 (Payments) | personId | Sync: anonymize, retain records |
| 3 | Processor | M05 (Memberships) | personId | Sync: deactivate all |
| 4 | Processor | M11 (Credentials) | personId | Sync: revoke active credentials |
| 5 | Processor | M10 (Credits) | personId | Sync: retain anonymized |
| 6 | Processor | M01 (Auth) | personId | Sync: delete sessions, PII |

### 6.7 Booking Event Flow

| Step | From | To | Data Passed | Sync/Async |
|------|------|-----|-------------|------------|
| 1 | Booking (Event created) | slotGenerator | eventId, recurrence config | Async (job) |
| 2 | Booking (Slot booked) | confirmationTimer | bookingId, timeout | Async (job) |
| 3 | confirmationTimer (Expired) | Booking | bookingId, status=auto_rejected | Async |
| 4 | Booking (Confirmed) | Notifications | bookingId, clientId, hostId | Async |
| 5 | slotCleanup | Booking | Expired past slots removed | Async (daily) |

### 6.8 Communication Delivery Pipeline

| Step | From | To | Data Passed | Sync/Async |
|------|------|-----|-------------|------------|
| 1 | M07 (Announcement sent) | Email Queue | recipientIds, template, content | Async |
| 2 | M07 (Announcement sent) | Notification Service | recipientIds, type, channels | Async |
| 3 | email.processor (30s) | SMTP Provider | email payload | Async |
| 4 | notifs.processScheduled (5min) | Push / In-App | notification payload | Async |

---

## 7. SLA/SLO Catalog

| Workflow | Category | Expected Duration | SLA Target |
|----------|----------|-------------------|------------|
| WF-001 Registration | UI | <2s form submit | p95 <2s |
| WF-003 Login | UI | <1s auth | p95 <1s |
| WF-009 Bulk Import (500 rows) | Background | <30s processing | p95 <30s |
| WF-012 ID Card Generation | Background | <5s PDF render | p95 <5s |
| WF-019 Impersonation | UI | <2s session switch | p95 <2s |
| WF-038 Pay Dues | UI + Webhook | <3s initiation, webhook <30s | p95 <30s total |
| WF-046 Send Announcement | Background | <5min delivery start | p95 <5min |
| WF-053 QR Check-In | UI | <1s scan-to-confirm | p95 <1s |
| WF-060 Credit Award | Sync | <2s after attendance | p95 <2s |
| WF-061 Certificate PDF | Background | <5s generation | p95 <5s |
| WF-077 Vote Cast | UI | <1s submit | p95 <1s |
| WF-109 Notification | Async | <5min queued-to-sent | p95 <5min |
| WF-110 Email | Async | <30s pending-to-sent | p95 <30s |
| WF-042 Dunning Reminder | Cron | Daily midnight, <5min batch | p95 <5min |
| WF-084 National Dashboard | UI | <3s aggregation query | p95 <3s |
| WF-030 Member Roster (1000 rows) | UI | <2s with pagination | p95 <2s |

---

## 8. Discovered Gaps

| Gap-ID | Category | Description | Affected WF | Impact |
|--------|----------|-------------|-------------|--------|
| GAP-001 | Missing workflow | No explicit refund handler in dues module -- BR-08 requires refund with expiry reversal | WF-041 | HIGH |
| GAP-002 | Missing error path | Bulk import conflict resolution (email matches Person A, license matches Person B) has no admin UI workflow defined | WF-009, WF-031 | MEDIUM |
| GAP-003 | Missing notification | Waitlist auto-promotion (WF-057) has no notification to promoted member (deferred per BR-27 notes) | WF-057 | MEDIUM |
| GAP-004 | Missing lifecycle end | No archive/purge workflow for completed elections -- results are immutable but election records accumulate | WF-076 | LOW |
| GAP-005 | Missing bulk op | No bulk payment recording for treasurers (only individual payments) | WF-044 | MEDIUM |
| GAP-006 | Missing notification | Late cancellation after deadline has no officer notification workflow (deferred per BR-27) | WF-052 | MEDIUM |
| GAP-007 | Missing workflow | No configurable cancellation deadline per event (deferred field) | WF-052 | LOW |
| GAP-008 | Missing search | No global cross-org member search for platform admins (only org-scoped) | WF-019 | LOW |
| GAP-009 | Missing error path | Payment webhook failure retry strategy not specified -- only "failed" terminal state | WF-038 | HIGH |
| GAP-010 | Missing workflow | Election-to-officer-transition (WF-079) is inferred -- no explicit spec for auto-assigning officer roles from election results | WF-079 | MEDIUM |
| GAP-011 | Missing lifecycle end | No data archival strategy for committees after dissolution beyond "cascade cleanup" | WF-108 | LOW |
| GAP-012 | Missing notification | Dunning escalation stages beyond initial reminder not specified (dunning_template exists but escalation flow undefined) | WF-042 | MEDIUM |
| GAP-013 | Missing bulk op | No bulk credit adjustment for officers (only individual) | WF-067 | LOW |
| GAP-014 | Missing search | No cross-module global search (member searching across events, training, announcements) | -- | LOW |
| GAP-015 | Missing workflow | Grace period → Lapsed automatic transition has no explicit scheduled job defined | WF-032 | HIGH |
| GAP-016 | Missing error path | Survey response editing before deadline -- spec says re-edit allowed but no conflict resolution for concurrent edits | WF-101 | LOW |
| GAP-017 | Missing notification | Committee task overdue notifications not wired to notification service | WF-106 | LOW |
| GAP-018 | Missing workflow | Credit transcript PDF export (WF-070) is inferred -- no explicit spec for PDF format or content | WF-070 | LOW |
| GAP-019 | Missing lifecycle end | Job listing auto-extension flow: extension resets expiry but max extensions not specified | WF-090 | LOW |
| GAP-020 | Missing error path | Ad creative rejection has no re-submission workflow for advertiser | WF-093 | LOW |

---

## 9. Summary Statistics

| Metric | Count |
|--------|-------|
| **Total Workflows** | 121 |
| Explicit (PRD-sourced) | 114 |
| Spec-sourced (MODULE_SPEC user-facing workflows) | 7 |
| Inferred | 0 |
| **By Type** | |
| CRUD | 40 |
| Lifecycle | 51 |
| Cross-module | 10 |
| Admin | 12 |
| Reporting | 8 |
| **Business Rules** | 77 |
| BR -> WF mapped | 75 |
| Orphan BRs (no workflow) | 0 |
| **State Machines** | 22 |
| **Cross-Module Flows** | 8 (with 36 handoff steps) |
| **Discovered Gaps** | 20 |
| HIGH impact | 3 |
| MEDIUM impact | 6 |
| LOW impact | 11 |
| **Modules Covered** | 19 + cross-cutting (notifications, email, audit, booking) |
