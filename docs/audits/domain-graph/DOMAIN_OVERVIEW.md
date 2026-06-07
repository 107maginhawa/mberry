# Memberry — Domain Graph Overview

Generated: 2026-06-06T00:00:46.068Z
Git commit at scan: `0178b7cadc050c45ac7dd32cb15c125af1ed138d`
Source artifact: `.understand-anything/domain-graph.json` (gitignored — regen via `/understand-domain`)

11 domains · 43 flows · 131 steps · 26 cross-domain edges

## Why this exists

Source of truth for **business-flow-centrality ordering** in the hardening sequencing plan (`~/.claude/plans/ill-ask-this-again-validated-graham.md`). Used by:

- **Step 4 (contract coverage W4)** — pick the ~87 missing Hurl scenarios in flow-centrality order, not module-alphabetical.
- **Step 6 (mega-module rebuild W5.5)** — confirm or adjust the 9-sub-module split for `association:member` against actual domain boundaries.

Regenerate after major code shifts: `/understand-domain` (cheap, derives from existing knowledge graph in ~5 min).

## Domains

### Identity & Access (complex)

Central PII hub plus authentication, account lifecycle, and onboarding. Owns the Person record, self-service profile/privacy/notification preferences, data export/deletion (GDPR), and the better-auth-backed sign-in/sign-up flows.

**Entities:** Person, Session, NotificationPreference, PrivacySettings, DataExport, AccountDeletion

**Business rules:**
- Person is the single PII safeguard for user data
- Account deletion fans out via domain-event cascade (person.deleted)
- Self-service endpoints scope to authenticated session person_id
- Better-Auth manages credentials; handlers never touch raw passwords

**Flows (4):**

| Flow | Entry | Type | Steps |
|---|---|---|---|
| Self-Service Sign-Up | `POST /auth/sign-up` | http | 4 |
| Sign-In & Session | `POST /auth/sign-in` | http | 3 |
| Account Deletion Cascade | `POST /me/account/delete` | http | 4 |
| Export My Data | `POST /me/data-export` | http | 3 |

### Membership Lifecycle (complex)

Application, approval, renewal, and roster management for healthcare association members. Spans the standalone membership module (applications, tiers, imports) and the association:member mega-module (chapters, officers, positions, directory).

**Entities:** Membership, MembershipApplication, MembershipCategory, Chapter, OfficerTerm, Position, Roster, MemberStatusHistory

**Business rules:**
- Applications require officer review before approval
- Officer terms gate privileged endpoints via @extension(x-require-officer)
- Position checks enforce 2FA on President/Treasurer/Secretary in prod
- Status transitions emit history for compliance

**Flows (4):**

| Flow | Entry | Type | Steps |
|---|---|---|---|
| Membership Application | `POST /memberships/applications` | http | 5 |
| Bulk Member Import | `POST /memberships/import` | http | 4 |
| Officer Term Management | `POST /orgs/:id/officers` | http | 3 |
| Invite Claim | `POST /invites/claim` | http | 3 |

### Billing & Dues (complex)

Stripe Connect-backed billing plus per-org dues invoicing, payment funds, receipts, and webhooks. Handles merchant onboarding (KYC), invoices, refunds, payment tokens for unauthenticated payors, and the dunning loop.

**Entities:** Invoice, DuesPayment, MerchantAccount, PaymentToken, Fund, StripeWebhookEvent, Refund

**Business rules:**
- Stripe webhook signatures verified before dispatch
- Payment tokens single-use and time-bound
- Refunds gated to officer/treasurer roles
- Marking uncollectible transitions invoice state machine without payment

**Flows (5):**

| Flow | Entry | Type | Steps |
|---|---|---|---|
| Generate Dues Invoices | `POST /orgs/:id/dues/generate` | http | 4 |
| Pay Invoice | `POST /billing/invoices/:id/pay` | http | 4 |
| Stripe Webhook Processing | `POST /billing/webhooks/stripe` | http | 3 |
| Stripe Connect Merchant Onboarding | `POST /billing/merchants/:id/onboard` | http | 3 |
| Refund Invoice Payment | `POST /billing/invoices/:id/refund` | http | 3 |

### Events, Booking & Training (complex)

Bookable event templates, registrations, and CPD/CE credit tracking. Covers booking (time-slot scheduling), events (registrations, custom events, national-dashboard export) and association:member credit lifecycle (entries, summary, professional licenses, ID card).

**Entities:** BookingEvent, Booking, Event, EventRegistration, CreditEntry, ProfessionalLicense, CreditCycle

**Business rules:**
- Bookings respect capacity and time-slot uniqueness
- CPD credits tally against active cycle with per-category caps
- Event certification flows can promote credit entries
- Custom event registration emits audit events

**Flows (4):**

| Flow | Entry | Type | Steps |
|---|---|---|---|
| Create Bookable Event | `POST /booking/events` | http | 3 |
| Register For Event | `POST /events/:id/register` | http | 4 |
| Track CPD Credits | `POST /me/credits` | http | 4 |
| National Dashboard Export | `POST /association/national-dashboard/export` | http | 3 |

### Governance & Elections (moderate)

Officer elections, nominations, ballots, vote tallying, and committee management. Hand-wired election lifecycle plus governance content embedded in association:member (committees, m12 governance spec).

**Entities:** Election, Nominee, Ballot, Vote, Committee, OfficerTerm

**Business rules:**
- Nominee eligibility checked against active membership and position rules
- Ballots immutable after cast; one-person-one-vote enforced
- Election certification promotes winners into OfficerTerm
- Cancellation cascades into nominee/ballot soft-deletes

**Flows (3):**

| Flow | Entry | Type | Steps |
|---|---|---|---|
| Create & Manage Election | `POST /elections` | http | 3 |
| Cast Ballot | `POST /elections/:id/ballots` | http | 3 |
| Certify Election | `POST /elections/:id/certify` | http | 3 |

### Communications (complex)

Two bounded contexts: communication (templated bulk messaging, announcements, message queue, subscriptions, saved segments) and comms (real-time WebSocket chat rooms, DMs, video calls). Plus the transactional email queue and OneSignal-backed multi-channel notifs.

**Entities:** MessageTemplate, MessageQueueItem, Announcement, PersonSubscription, SavedSegment, ChatRoom, DirectMessage, VideoCall, EmailQueueItem, Notification

**Business rules:**
- communication = templated/bulk + announcements; comms = real-time chat/video (split by design)
- Notifications target external_id (person id) cross-app
- Email queue retries with backoff and DLQ
- WebSocket auth checked on connect, room ACL on join

**Flows (6):**

| Flow | Entry | Type | Steps |
|---|---|---|---|
| Send Templated Message | `POST /communication/messages` | http | 4 |
| Post Org Announcement | `POST /communication/announcements` | http | 3 |
| Real-Time Chat Room | `WS /comms/rooms/:id` | event | 3 |
| Video Call Session | `WS /comms/calls/:id` | event | 3 |
| Email Queue Dispatch | `Job: emailQueueProcessor` | cron | 3 |
| Push Notification Send | `POST /notifs` | http | 3 |

### Content, Documents & Certificates (moderate)

Document management with access-log tracking, S3/MinIO-backed file storage, generated certificates (CPD/event completion), and NPS reviews. Owns the document compliance trail.

**Entities:** Document, DocumentAccessLog, Certificate, StoredFile, Review

**Business rules:**
- Every document download writes a DocumentAccessLog
- Certificate generation is idempotent per (person, event)
- Reviews score 0-10 with comment <= 1000 chars
- Files served via short-lived signed URLs

**Flows (5):**

| Flow | Entry | Type | Steps |
|---|---|---|---|
| Upload & Distribute Document | `POST /documents` | http | 3 |
| Download Document | `GET /documents/:id/download` | http | 3 |
| Issue Certificate | `POST /certificates/:id/generate` | http | 3 |
| Upload File To Storage | `POST /storage/upload` | http | 3 |
| Submit NPS Review | `POST /reviews` | http | 2 |

### Marketplace & Advertising (simple)

Vendor + offers marketplace plus sponsored placement (advertising). Distribution channel for health-product partners targeting association members.

**Entities:** Vendor, Offer, Advertiser, SponsoredPlacement

**Business rules:**
- Advertiser approval required before placement goes live
- Offer redemption scoped to active members

**Flows (3):**

| Flow | Entry | Type | Steps |
|---|---|---|---|
| Browse Marketplace Offers | `GET /marketplace/offers` | http | 2 |
| Redeem Marketplace Offer | `POST /marketplace/offers/:id/redeem` | http | 3 |
| Create Sponsored Placement | `POST /advertising/placements` | http | 2 |

### Platform Administration (complex)

Super-admin ops dashboard: provisioning associations and orgs, org-health scoring, revenue analytics, breach handling, ticket SLA monitoring, and public org directory. Powers apps/admin (port 3003).

**Entities:** Association, Organization, OrgHealthScore, RevenueRollup, BreachRecord, Ticket

**Business rules:**
- Only super-admins (role='super') can mutate associations
- Org health is composite: collection_rate, active members, CPD compliance, activity
- Breach status mutations are audited

**Flows (4):**

| Flow | Entry | Type | Steps |
|---|---|---|---|
| Provision New Association | `POST /admin/associations` | http | 3 |
| Org Health Scoring | `GET /admin/orgs/health` | http | 3 |
| Revenue Analytics | `GET /admin/analytics/revenue` | http | 2 |
| Dashboard Report Export | `POST /admin/dashboard/export` | http | 2 |

### Surveys & Feedback (moderate)

Surveys and polls with per-question analytics, admin-facing listing, and member submission. Used for satisfaction, governance polls, and program evaluation.

**Entities:** Survey, SurveyQuestion, SurveyResponse, Poll

**Business rules:**
- One response per (survey, person) unless explicitly multi-response
- Analytics computed per-question with role-checked access
- Closed surveys reject submissions

**Flows (3):**

| Flow | Entry | Type | Steps |
|---|---|---|---|
| Create Survey | `POST /surveys` | http | 2 |
| Submit Survey Response | `POST /surveys/:id/responses` | http | 2 |
| Survey Analytics | `GET /surveys/:id/analytics` | http | 2 |

### Compliance, Audit & Background Jobs (moderate)

Audit-log infrastructure (per-route audit middleware composing events from x-audit extensions), the job registry that drives scheduled cleanups, and supporting infra (invite tokens, onboarding bootstrap).

**Entities:** AuditEvent, JobDefinition, InviteToken, OnboardingStep

**Business rules:**
- Audit middleware skips events on 4xx/5xx responses
- TypeSpec @extension(x-audit) is the canonical declaration path
- Invite tokens single-use and TTL-bound
- Jobs registered through registerXxxJobs entry points called at app bootstrap

**Flows (2):**

| Flow | Entry | Type | Steps |
|---|---|---|---|
| Audit Event Write | `Middleware: per-route-audit` | event | 3 |
| Background Job Tick | `Cron: job registry` | cron | 3 |

## Cross-domain edges (26)

These are the integration seams. A change to either domain may break the other — Step 4 contract scenarios must cover these explicitly.

| Source | → | Target | Interaction |
|---|---|---|---|
| Identity & Access | → | Membership Lifecycle | Membership ties Person identity to org-scoped roles, officer terms, and roster. |
| Identity & Access | → | Compliance, Audit & Background Jobs | person.deleted domain event drives fan-out cascade across 9 module subscribers. |
| Identity & Access | → | Communications | Person notification preferences and subscriptions key message routing. |
| Membership Lifecycle | → | Billing & Dues | Approving a membership triggers first dues invoice generation. |
| Membership Lifecycle | → | Events, Booking & Training | Active membership gates event registration eligibility and CPD cycle. |
| Membership Lifecycle | → | Governance & Elections | Active members are eligible voters and nominees; elections promote into officer terms. |
| Membership Lifecycle | → | Communications | Welcome, renewal, and roster notifications fan out via communication module. |
| Billing & Dues | → | Communications | Invoice, receipt, and dunning messages dispatched through email + notifs. |
| Billing & Dues | → | Compliance, Audit & Background Jobs | Stripe webhook + refund actions emit audit events. |
| Billing & Dues | → | Platform Administration | Revenue analytics aggregate from billing invoices. |
| Events, Booking & Training | → | Content, Documents & Certificates | Event/CPD completion issues certificates from the certificates module. |
| Events, Booking & Training | → | Communications | Event confirmations, reminders, and post-event surveys queue through communication. |
| Events, Booking & Training | → | Platform Administration | National dashboard rollups feed platform analytics. |
| Governance & Elections | → | Membership Lifecycle | Certified elections promote winners into OfficerTerm records. |
| Governance & Elections | → | Compliance, Audit & Background Jobs | Ballots and election status transitions are audited. |
| Communications | → | Identity & Access | Push notifications target external_id (person.id) cross-app. |
| Content, Documents & Certificates | → | Compliance, Audit & Background Jobs | Document downloads emit DocumentAccessLog entries. |
| Content, Documents & Certificates | → | Communications | Certificate issuance fans out via communication. |
| Platform Administration | → | Membership Lifecycle | Org provisioning bootstraps the membership/officer scaffolding for a tenant. |
| Platform Administration | → | Compliance, Audit & Background Jobs | Admin actions (provisioning, breach updates, exports) are audited. |
| Surveys & Feedback | → | Communications | Survey invites and reminders queue through communication. |
| Surveys & Feedback | → | Events, Booking & Training | Post-event surveys gather feedback after registrations close out. |
| Marketplace & Advertising | → | Membership Lifecycle | Offer redemption requires an active membership. |
| Marketplace & Advertising | → | Platform Administration | Vendor approvals and advertiser status managed via platform admin. |
| Compliance, Audit & Background Jobs | → | Billing & Dues | Background jobs run dunning, payment retries, and invoice cleanup. |
| Compliance, Audit & Background Jobs | → | Communications | Background jobs power the email retry processor and notification dispatch. |

## How to consume

- For Step 4 prioritization: order the missing-Hurl backlog by the count of cross-domain edges touching each domain. Identity & Access, Membership Lifecycle, and Billing & Dues have the densest cross-domain fan-out — start there.
- For Step 6 rebuild: the Membership Lifecycle + Governance & Elections + parts of Events/CPD currently all live inside `association:member`. The 9-sub-module split in the rebuild plan should map roughly to: membership, status, dunning, officer-terms, credits, chapters, governance, directory, certificates. Use the flows here to validate that each sub-module owns one bounded slice.
- Open the interactive dashboard with `/understand-dashboard` for a horizontal flow visualization (auto-launches after the skill runs).
