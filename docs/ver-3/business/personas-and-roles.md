# Personas & Roles

**Version:** 3.0
**Updated:** 2026-04-21
**Layer:** Business -- Personas, Roles & Permissions

---

## 1. Role Overview Table

| # | Role | Scope | Device | Flow Count |
|---|------|-------|--------|------------|
| P1 | Platform Administrator | Super-admin: revenue, pricing, feature flags, multi-admin, support, impersonation, compliance | Desktop only | 22 |
| P2 | Chapter President | Org governance: role assignment, officer transitions, elections, discipline, report review | Both (desktop for reports, mobile for oversight) | 14 |
| P3 | Chapter Treasurer | Financial ops: dues collection, payment recording, refunds, gateway config, financial reports | Both (desktop for reconciliation, mobile for quick recording) | 11 |
| P4 | Chapter Secretary | Member ops: roster management, events, communications, applications, data corrections | Both (desktop for imports/reports, mobile for event check-in) | 13 |
| P5 | Society Officer | Training programs: course creation, credit issuance, enrollments, regulatory compliance | Both (desktop primary) | 14 |
| P6 | Member (Healthcare Professional) | Self-service: dues payment, activity registration, credit tracking, credentials, directory | Mobile-first | 27 |
| -- | Business Rule Exercises | Cross-cutting flows exercising specific rules | -- | 6 |
| | **Total** | | | **107** |

---

## 2. Persona Deep Dives

### P1: Platform Administrator

**Name:** Carlo Mendoza
**Role:** Platform Administrator (Memberry team member)
**Device:** Desktop only

**Pain points before Memberry:**
- No visibility into which associations are actually active vs. dormant -- everything is anecdotal
- Support requests arrive via personal Viber messages, email threads, and Facebook Messenger with no tracking or SLA
- Manual onboarding of each new association requires copying configuration between spreadsheets and sending a dozen setup emails
- Revenue tracking means opening a spreadsheet, cross-referencing gateway dashboards, and hoping nothing was missed
- Feature rollout is all-or-nothing -- no way to test a feature with one chapter before pushing to ninety-five
- Compliance obligations (DPA 2012 breach notification, data export requests) are handled ad-hoc with no documented workflow

**Goals:**
- Platform health: 99.5% uptime, sub-500ms API response times, zero unresolved support tickets older than 48 hours
- Revenue clarity: real-time MRR, ARR, ARPU, and churn metrics without touching a spreadsheet
- Controlled feature rollout: enable modules per tier or per org, measure adoption before broad release
- Scalable support: ticketed, SLA-tracked support with impersonation for debugging -- not personal messages
- Compliance confidence: automated breach notification workflows, one-click data export, auditable deletion

**Key capabilities:**
- Onboard new associations and provision organizations with type-aware setup
- Manage subscription lifecycle: trial, active, suspended, cancelled with automated reminders
- Monitor platform health via org health scores (login rates, payment activity, feature adoption)
- Revenue dashboard with MRR, ARR, ARPU, LTV, churn, and growth metrics
- Configure pricing tiers with member-count brackets and trial durations
- Feature flag matrix: toggle modules per tier or override per org
- Multi-admin team management with three sub-roles (Super Admin, Support Admin, Analyst)
- User impersonation for support debugging (read-only, fully audited)
- Platform-wide announcements to all orgs or filtered by association/country
- Support ticket workflow with SLA tracking and escalation
- Data breach notification workflow (DPA 2012 / NPC)
- Member account merge for duplicates, data export/deletion processing
- Country/locale configuration (currency, date format, license regex, credit cycle defaults)
- Org suspension and lifecycle state management
- Payment dispute escalation and resolution

**What delights them:**
- The org health score dashboard catches a chapter going dormant before it churns -- Carlo reaches out proactively
- Feature flags let him beta-test a new module with three chapters, see adoption data, then roll it out to everyone with one toggle
- Impersonation lets him see exactly what a confused officer sees, diagnose the issue in seconds, and close the ticket -- no more "can you send me a screenshot?"
- Revenue dashboard auto-generates the investor report he used to spend two hours assembling manually

**What frustrates them:**
- If the platform goes down and there is no clear incident dashboard or status page
- If support tickets pile up with no way to prioritize, track SLAs, or escalate
- If feature flags have unintended side effects (disabling a module hides data that officers are looking for)
- If onboarding a new association still requires manual steps outside the platform

---

### P2: Chapter President

**Name:** Dr. Maria Santos
**Role:** Chapter President, PDA Cebu
**Device:** Both (desktop for heavy admin, mobile for quick oversight)

**Pain points before Memberry:**
- Annual officer transition is a catastrophe: the outgoing treasurer walks out with the only copy of the Excel file, the WhatsApp group admin forgets to add the new officers, and institutional knowledge evaporates overnight
- Discipline issues are handled via WhatsApp threads that get deleted, leaving no record of what was decided or communicated
- She has no idea if the treasurer is actually collecting from everyone -- she hears "we're at 70%" but cannot verify it herself
- Elections are managed with hand-raised votes at a general assembly, results scribbled in a notebook, and officer roles updated by whoever remembers to do it
- When a member complains about a missed payment or wrong status, there is no audit trail to settle the dispute
- She manages all of this between patients, so anything requiring more than five minutes of focused desktop time tends to get postponed indefinitely

**Goals:**
- Smooth officer transitions: a structured handover checklist that transfers access, pending items, and institutional context to the incoming team
- Governance accountability: every role assignment, disciplinary action, and election result is recorded with timestamps and reasons
- Financial oversight: she can review the treasurer's reports, flag discrepancies, and trust that the numbers are real
- Chapter growth: member engagement analytics that tell her who is at risk of lapsing so she can intervene personally
- Minimal time investment: quick mobile checks for approvals and oversight, desktop only when reviewing detailed reports

**Key capabilities:**
- Assign and remove officer roles (President, Treasurer, Secretary) with confirmation and audit trail
- Initiate and complete officer transitions with structured handover checklists
- Review and approve/reject member applications
- Review financial reports submitted by the treasurer, with annotation and flagging
- Manage annual elections: create election event, record results, trigger role transitions
- Suspend members for disciplinary reasons with documented cause and member notification
- Annual roster review: identify lapsed, never-logged-in, and long-inactive members for archival
- View engagement analytics: at-risk members, activity trends, never-logged-in imports
- View org benchmarking: anonymized comparison against other chapters in the association
- Edit org settings: membership categories, fund allocation, grace periods, credit tracking, sharing preferences
- Invite another chapter to the platform with social proof referral
- Communicate with platform admin via support tickets
- First-time signup and chapter setup (org creation, member import, dues config, gateway connection)

**What delights them:**
- The officer transition checklist surfaces everything the outgoing team has left undone -- pending applications, outstanding payments, upcoming events -- so the new team starts informed, not blind
- The engagement dashboard highlights three members who have not logged in since import; Maria texts them personally and two activate that week
- Benchmarking shows her chapter's collection rate is 72% vs. the association average of 85% -- she now has a concrete, data-backed conversation to have with her treasurer

**What frustrates them:**
- If the platform requires her to sit at a desktop for 30 minutes to approve three applications that could have been one-tap approvals on her phone
- If officer transition does not actually transfer all access and she has to chase the outgoing president for weeks
- If the financial reports are confusing or require accounting knowledge to interpret
- If the benchmarking data feels inaccurate or the comparison is unfair (comparing a 50-member rural chapter to a 500-member metro chapter)

---

### P3: Chapter Treasurer

**Name:** Dr. Jose Reyes
**Role:** Chapter Treasurer, PMA Manila
**Device:** Both (desktop for reconciliation and reports, mobile for recording payments on the go)

**Pain points before Memberry:**
- He chases members for dues manually: calls, texts, WhatsApp messages, and in-person reminders at events -- and half the time he forgets who he already reminded
- He has no idea who has actually paid because payments come through GCash, Maya, bank transfer, cash at events, and checks -- all tracked in different places (or not tracked at all)
- GCash screenshots are his receipts: members send a photo of a transfer confirmation, he saves it to a folder, and hopes he can find it six months later when the president asks for a report
- Fund allocation is done by hand: he collects P2,000 in dues and manually splits it across three funds using a calculator and a spreadsheet
- Financial reports for the annual general assembly take him an entire weekend to compile because the data is scattered across three apps and a notebook
- When a payment dispute arises, it is his word against the member's because there is no shared, timestamped record

**Goals:**
- Zero revenue leakage: every payment is recorded, every member's status is current, nothing falls through the cracks
- Automated reminders: members who owe dues get reminded automatically with a payment link -- he does not have to chase anyone
- Audit-ready records: financial reports generate in seconds, not weekends, and any auditor or officer can verify every transaction
- Clean reconciliation: gateway transactions match platform records, discrepancies are flagged, not hidden
- Easy refunds and corrections: when something goes wrong, there is a clear process with an audit trail

**Key capabilities:**
- Record manual payments (cash, check, bank transfer) with amount, date, method, and reference number
- View and generate financial reports: collection summary, fund breakdown, dues status by member
- Send batch dues reminders to filtered member lists (grace, lapsed, expiring soon) with payment links
- Reconcile gateway transactions against bank records with matched/unmatched flagging
- Submit periodic financial reports to the president for review
- Update dues rates for new fiscal years (applied to future payments only)
- Configure and test payment gateway connection (PayMongo, Stripe)
- Process refunds (overpayment, duplicate, error) with gateway reversal and fund allocation adjustment
- Handle payment amount mismatches: accept as full, record partial, request additional, or refund excess
- Correct previously recorded payments (void and re-record with full audit trail)
- First value moment: record first payment, see fund allocation split correctly

**What delights them:**
- The first time he records a payment and watches the fund allocation split automatically across three funds -- correctly, to the centavo -- he realizes he will never touch that calculator again
- Batch reminders go out to 45 members with a payment link; 12 pay within 24 hours without Jose sending a single personal message
- The quarterly report generates in three seconds as a PDF -- last year it took him an entire Saturday

**What frustrates them:**
- If recording a manual payment takes more than 30 seconds (he is doing this between patients, standing at the clinic counter)
- If the reconciliation tool does not match gateway transactions reliably and he ends up doing manual reconciliation anyway
- If refund processing is slow or unclear, leaving him exposed to member complaints
- If the platform does not support the payment methods his members actually use (GCash, Maya, QR Ph)

---

### P4: Chapter Secretary

**Name:** Nurse Ana Cruz
**Role:** Chapter Secretary, PNA Davao Chapter
**Device:** Both (desktop for roster imports and reports, mobile for event check-in and quick updates)

**Pain points before Memberry:**
- She maintains the membership roster in an Excel file on her personal laptop -- when her laptop crashed last year, she lost three months of updates and had to reconstruct from memory and old emails
- She gets blamed when events are miscommunicated because the WhatsApp group has a 256-member limit and 80 members never got the announcement
- Attendance at events is tracked by passing around a sign-in sheet that she then types into Excel -- sometimes she cannot read the handwriting
- Member contact information is perpetually outdated: email addresses bounce, phone numbers are disconnected, and she has no way to know until something fails
- Processing a new member application means printing a form, collecting documents, manually entering data, and sending a welcome email -- a process that takes her 30 minutes per person
- When a member asks to correct their license number, she has to verify it manually, update three spreadsheets, and hope she did not break a formula

**Goals:**
- Accurate, centralized roster: one source of truth for member data that she does not have to maintain on her personal laptop
- Frictionless events: create an event, notify all members (not just the WhatsApp group), track RSVPs, and record attendance digitally
- Timely communications: announcements reach every member through multiple channels (in-app, push, email) with delivery tracking
- Efficient application processing: online applications that she can approve or reject with one tap, not a 30-minute paper process
- Self-service corrections: members can update their own contact info so she is not the bottleneck

**Key capabilities:**
- Manage member roster: inline editing, contact info updates, category management, change logging
- Add members manually with duplicate detection (email and license number matching)
- Bulk import members via CSV with row-by-row validation, conflict resolution, and automatic linking of existing accounts
- Compose and send announcements with rich text editor, image embedding, multi-channel delivery (in-app, push, email), and delivery stats
- Create and manage events with type selection, registration configuration (free/paid, capacity), QR check-in toggle, and visibility settings
- Create and manage trainings with credit value, regulatory approval status, and network-wide sharing
- QR check-in at events and trainings with camera scanner and manual fallback
- Manage event logistics: non-QR attendance, meeting minutes, RSVP tracking
- Generate membership reports: totals by category, new members, lapsed, growth trends
- Distribute meeting agendas as announcements attached to events
- Process member data correction requests with verification and conflict detection
- Handle deceased member records: removal from active roster and reminders, record preservation
- Process member reinstatement applications with payment coordination

**What delights them:**
- The bulk import validates 200 members in seconds, flags 12 with invalid license numbers, and automatically links 35 who already have Memberry accounts from another chapter -- no duplicates
- QR check-in at the general assembly: she scans 80 members in 15 minutes instead of spending an hour deciphering a paper sign-in sheet
- An announcement reaches all 200 members instantly through push notifications, with delivery stats showing 94% reached -- not 128 out of 200 via WhatsApp

**What frustrates them:**
- If the CSV import rejects valid data because the validation is too strict or the error messages are unclear
- If event creation requires too many steps for a simple monthly meeting
- If members bombard her with correction requests that she still has to process manually
- If QR check-in is slow or unreliable during a 300-person convention with poor Wi-Fi

---

### P5: Society Officer

**Name:** Dr. Lito Tan
**Role:** Training Director, PDA Cebu Society (Orthodontic Society)
**Device:** Both (desktop primary for course management)

**Pain points before Memberry:**
- CPD credit records are paper-based: he issues handwritten certificates at the end of each seminar and members lose them within months
- He has no idea how many credits each member has accumulated -- when members call to ask, he digs through folders of attendance sheets
- Regulatory compliance is a constant worry: PRC approval references expire, and he only finds out when a member's renewal is rejected
- Training enrollment is managed through a Google Form, payments through bank transfer, and confirmation through personal email -- three disconnected systems
- When his term ends, the incoming training director inherits a box of folders and has to reconstruct the entire training history from scratch
- Cross-chapter promotion of trainings requires personally messaging each chapter president and hoping they forward it to their members

**Goals:**
- Digital CPD tracking: every training attended, every credit earned, every certificate issued -- all in one place, accessible to both the officer and the member
- Automated certificate issuance: completion triggers a downloadable, verifiable PDF certificate -- no handwriting, no lost paper
- Regulatory compliance: PRC approval status tracked per training, expiration alerts, bulk status updates
- Network-wide reach: publish a training once and it appears in the activity feeds of every chapter in the association
- Clean enrollment pipeline: registration, payment, attendance, completion, and credit award in a single workflow

**Key capabilities:**
- Create training courses and programs (single-session and multi-session) with credit values, regulatory approval status, and registration options
- Manage training enrollments: view registered/paid/completed, track capacity, send reminders to unpaid registrants
- Mark course completion and award credits in bulk -- credits auto-appear on members' dashboards
- View training analytics: enrollment count, completion rate, revenue, member sources by chapter, credit distribution
- Manage training lifecycle: Draft, Published, Registration Open, Registration Closed, In Progress, Completed, Archived
- Maintain regulatory approval status for trainings with reference documents and expiration tracking
- Coordinate cross-org training promotion with chapter officers
- Configure society settings: default credit values per training type, approval workflows, certificate templates
- Cancel trainings with automatic notification and refund workflow trigger
- Correct credits awarded in error with documented reason and member notification
- Society-specific onboarding wizard (training-focused, skips dues configuration)
- Society officer transition with training management handover

**What delights them:**
- He publishes a seminar and it appears in the activity feeds of 12 chapters across the association -- 45 dentists register within a week without him sending a single personal message
- After the seminar, he bulk-marks 40 attendees as completed; each one instantly gets a downloadable certificate with a verification QR code and 5 credits on their dashboard
- The training analytics show that 60% of enrollees came from Metro Manila chapters and 30% from Visayas -- he now knows where to focus promotion for the next course

**What frustrates them:**
- If the training creation form is cumbersome or requires fields that do not apply to his training type
- If cross-chapter visibility does not work because chapters have sharing disabled and he has no way to know or request it
- If credit corrections are difficult, especially after members have already downloaded certificates
- If the society onboarding tries to push him through dues and payment configuration that is irrelevant to a training-focused society

---

### P6: Member (Healthcare Professional)

**Name:** Dr. Rachel Gomez
**Role:** Dentist, PDA Metro Manila Chapter + PDA Young Professionals Society
**Device:** Mobile-first (checks between patients, at lunch, on the commute)

**Pain points before Memberry:**
- She does not know if her CPD credits are sufficient for license renewal until she manually counts certificates from a folder in her desk drawer -- and she is pretty sure she lost two of them
- She forgets to pay dues every year until someone from the chapter calls to remind her, by which point she is already in the grace period and embarrassed
- Certificates from trainings she attended are scattered across email attachments, photos of paper certificates, and a Google Drive folder she cannot find
- She belongs to two organizations (chapter + society) and has no unified view of her membership status, credits, or upcoming activities across both
- When she wants to find a specialist colleague's contact information, she scrolls through an outdated PDF directory that was last updated two years ago
- Paying dues means transferring money via GCash, taking a screenshot, and sending it to the treasurer on Viber -- then waiting days to find out if it was recorded

**Goals:**
- Compliance assurance: a single dashboard that shows her credit progress, dues status, and upcoming deadlines across all her memberships -- so she never has to wonder if she is compliant
- Easy payments: pay dues in under 60 seconds from a notification link on her phone, with instant confirmation and a downloadable receipt
- Accessible credentials: ID card and training certificates always available on her phone, downloadable as PDFs, verifiable via QR code
- Effortless discovery: a single activity feed showing events and trainings from both her chapter and society, with credit values clearly displayed
- Privacy control: she decides what personal information appears in the directory and who can contact her

**Key capabilities:**
- View dashboard with status banner (Active/Grace/Lapsed), action cards, upcoming activities, and announcements
- Pay dues online via multiple methods (GCash, Maya, card, QR Ph) with one-tap payment from notification links
- View dues history and download receipts for all payments (online and manual)
- Browse unified activity feed (events + trainings from all memberships) and register for activities
- Track credit progress with per-org breakdown, cycle progress bar, and history
- Add manual credit entries (external trainings, self-reported) with optional evidence upload
- View and manage cross-org memberships with independent status per organization
- Download member ID card as PDF with tamper-proof QR code (works offline via PWA)
- Download training certificates as verifiable PDFs
- Browse member directory with privacy-filtered contact information
- Edit profile and privacy settings (directory visibility, notification preferences)
- Apply to join organizations via public pages
- Transfer membership between organizations within the same association
- Contact chapter officers through the platform
- Request data export (DPA portability) and account deletion (DPA right to be forgotten)
- Self-service registration, account claim (imported member), and password reset

**What delights them:**
- A push notification says "Dues expiring in 7 days" with a "Pay Now" button; she taps it, GCash opens, she confirms, and 30 seconds later her status is green again -- between patients, done before the next one sits down
- She opens her credit dashboard and sees 35/50 credits with a clear progress bar and a list of upcoming trainings that would get her to 50 -- no more counting paper certificates
- At a PRC office, someone asks for her professional ID; she pulls up the ID card on her phone with a QR code that verifies her active status -- no paper card, no wallet fumbling
- She attended a seminar last month through the society; the credits automatically appear on her chapter dashboard too because the platform aggregates across memberships

**What frustrates them:**
- If the app is slow on mobile data (she checks between patients on a 4G connection in a clinic with mediocre signal)
- If paying dues requires more than three taps or forces her to log in again from a notification link
- If her credit count does not update immediately after attending a training -- she wants to see it reflected before she leaves the venue
- If the platform sends too many notifications (she will turn them all off and then miss the ones that matter)
- If the directory exposes her personal phone number or email without her explicit consent

---

## 3. Anti-Persona (Who This Is NOT For)

This platform is not designed for:

- **National-level associations with full-time staff.** Organizations that already have a dedicated operations team and an enterprise AMS (Aptify, iMIS, Personify) are overserved by their current tools. Memberry targets volunteer-run chapters that manage everything between patients.

- **Associations with fewer than 10 members.** The complexity that Memberry solves -- dues tracking, event management, credit monitoring, officer transitions -- does not exist at this scale. A group chat is sufficient.

- **Associations that meet only once per year.** The platform's value compounds with regular activity: monthly dues cycles, quarterly trainings, weekly communications. An annual convention does not justify a platform subscription.

- **Associations requiring multi-language UI beyond English and Filipino in Phase 1.** The v1 interface supports English with Filipino/Tagalog context where needed. Associations requiring Thai, Bahasa, Vietnamese, or other ASEAN languages must wait for Phase 2 localization.

- **Organizations managing clinical data or patient records.** Memberry manages professional membership data (license numbers, dues, credits), not electronic health records. HIPAA-grade clinical data management is out of scope entirely.

---

## 4. Permission Matrix

Rows represent capabilities grouped by module. Columns represent the six roles.

Legend: **full access** = can create, read, update, delete | **read** = view only | -- = no access

| Capability | P1: Platform Admin | P2: President | P3: Treasurer | P4: Secretary | P5: Society Officer | P6: Member |
|---|---|---|---|---|---|---|
| **Membership** | | | | | | |
| View member roster | read (via impersonation) | full | read | full | full (society scope) | -- |
| Add/remove members | -- | full | -- | full | full (society scope) | -- |
| Assign officer roles | -- | full | -- | -- | full (society scope) | -- |
| Review member applications | -- | full | -- | full | full (society scope) | -- |
| Suspend/reinstate members | -- | full | -- | -- | -- | -- |
| **Dues & Payments** | | | | | | |
| Manage dues configuration | -- | full | full | -- | -- | -- |
| Record payments | -- | -- | full | -- | -- | -- |
| View financial reports | read (via impersonation) | read | full | -- | -- | -- |
| Process refunds | full (escalated) | -- | full | -- | -- | -- |
| Pay own dues | -- | -- | -- | -- | -- | full |
| View own payment history | -- | -- | -- | -- | -- | full |
| **Communications** | | | | | | |
| Send announcements | full (platform-wide) | full | -- | full | full (society scope) | -- |
| **Events** | | | | | | |
| Create events | -- | full | -- | full | -- | -- |
| QR check-in | -- | full | -- | full | full | -- |
| Register for events | -- | -- | -- | -- | -- | full |
| **Training** | | | | | | |
| Create trainings | -- | full | -- | full | full | -- |
| Mark completions / award credits | -- | -- | -- | -- | full | -- |
| Register for trainings | -- | -- | -- | -- | -- | full |
| **Credits** | | | | | | |
| View credit overview (org) | -- | read | -- | -- | full (society scope) | -- |
| Issue/correct credits | -- | -- | -- | -- | full | -- |
| Add manual credits (own) | -- | -- | -- | -- | -- | full |
| View own credit progress | -- | -- | -- | -- | -- | full |
| **Documents & Credentials** | | | | | | |
| Download own ID card | -- | -- | -- | -- | -- | full |
| Download own certificates | -- | -- | -- | -- | -- | full |
| Generate reports (membership) | -- | read | -- | full | full (society scope) | -- |
| Generate reports (financial) | -- | read | full | -- | -- | -- |
| **Directory** | | | | | | |
| View member directory | -- | full | full | full | full (society scope) | read (privacy-filtered) |
| **Profile & Settings** | | | | | | |
| View own profile | full | full | full | full | full | full |
| Edit own profile | full | full | full | full | full | full |
| Edit org settings | -- | full | read | read | full (society scope) | -- |
| **Platform Administration** | | | | | | |
| Impersonate users | full (read-only) | -- | -- | -- | -- | -- |
| Feature flags | full | -- | -- | -- | -- | -- |
| Revenue dashboard | full | -- | -- | -- | -- | -- |
| Pricing & plan management | full | -- | -- | -- | -- | -- |
| Multi-admin management | full | -- | -- | -- | -- | -- |
| Org health scoring | full | -- | -- | -- | -- | -- |
| Subscription management | full | -- | -- | -- | -- | -- |
| Support ticket management | full | -- | -- | -- | -- | -- |
| Data breach workflow | full | -- | -- | -- | -- | -- |
| Country/locale config | full | -- | -- | -- | -- | -- |
| Platform announcements | full | -- | -- | -- | -- | -- |

---

## 5. User Flow Count Summary

| Role | Flow Count | Key Flows |
|---|---|---|
| P1: Platform Admin | 22 | PA-1 Onboard association, PA-2 Provision org, PA-3 Manage subscription, PA-4 Monitor health, PA-5 Admin onboarding, PA-6 Subscription reconciliation, PA-7 Country/locale config, PA-8 Platform settings, PA-9 Account merge, PA-10 Org suspension, PA-11 Data breach notification, PA-12 Payment dispute escalation, PA-13 Org lifecycle states, PA-14 Data export/deletion, PA-15 Revenue dashboard, PA-16 Pricing management, PA-17 Feature flags, PA-18 Multi-admin roles, PA-19 Platform announcements, PA-20 Support tickets, PA-21 User impersonation, PA-22 Org health scoring |
| P2: Chapter President | 14 | CO-1 Signup/setup, CO-7 Review applications, CO-9 Officer transition, CO-10 Edit org settings, CO-11 Invite chapter, CO-12 Engagement analytics, CO-13 Org benchmarking, CP-1 First value moment, CP-2 Elections, CP-3 Roster review, CP-4 Platform admin communication, CP-5 Financial report review, CP-6 Member suspension, CP-7 End-of-term transition |
| P3: Chapter Treasurer | 11 | CO-6 Record manual payment, CO-8 View financial reports, CT-1 First value moment, CT-2 Batch dues reminders, CT-3 Payment reconciliation, CT-4 Periodic report submission, CT-5 Dues rate update, CT-6 Gateway configuration, CT-7 Payment refund, CT-8 Payment mismatch, CT-9 Payment correction |
| P4: Chapter Secretary | 13 | CO-2 Compose announcement, CO-3 Create event, CO-4 Create training, CO-5 QR check-in, CO-14 Add member manually, CO-15 Bulk member import, CS-1 Roster maintenance, CS-2 Event logistics, CS-3 Membership reports, CS-4 Meeting agenda distribution, CS-5 Data correction requests, CS-6 Deceased member handling, CS-7 Member reinstatement |
| P5: Society Officer | 14 | SO-1 Create training course, SO-2 Manage enrollments, SO-3 Mark completion/award credits, SO-4 Training analytics, SO-5 Discovery, SO-6 Society onboarding, SO-7 First value moment, SO-8 Regulatory approval maintenance, SO-9 Cross-org promotion, SO-10 Society configuration, SO-11 Training cancellation, SO-12 Credit correction, SO-13 Training lifecycle, SO-14 Officer transition |
| P6: Member | 27 | M-1 Self-registration, M-2 Account claim, M-3 Pay dues online, M-4 Register for training + earn credits, M-5 Register for event, M-6 Manual credit entry, M-7 Cross-org membership, M-8 Apply via public page, M-9 Edit profile/privacy, M-10 Browse directory, M-11 Download ID card, M-12 Download certificate, M-13 Password reset, M-14 View dues history, M-15 Manage notifications, M-16 Transfer membership, M-17 Organic discovery, M-18 Contact officer, M-19 Gateway unavailable, M-20 Offline use, M-21 Duplicate merge request, M-22 Payment dispute, M-23 Account lockout, M-24 Status transition experience, M-25 Account deletion, M-26 Data export, M-27 Voluntary org departure |
| -- Business Rules | 6 | BR-EX-1 Life member designation, BR-EX-2 Officer manual credit award, BR-EX-3 Officer credit deduction, BR-EX-4 Credit cycle boundary, BR-EX-5 Audit trail viewing, BR-EX-6 Weekly digest |
| **Total** | **107** | |

---

## Sign-off

| Role | Name | Date | Decision |
|------|------|------|----------|
| Product Owner | | | Approved / Rejected |
| Domain Expert | | | Approved / Rejected |
