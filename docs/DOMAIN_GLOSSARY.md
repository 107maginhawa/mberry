# Domain Glossary

Canonical terminology for the Memberry platform. All code, specs, PRDs, and documentation must use these terms consistently. Ambiguity in terminology becomes ambiguity in the product.

---

## Core Entities

| Term | Definition | Avoid |
|------|------------|-------|
| **Association** | Top-level tenant organization (e.g., Philippine Dental Association). Has its own locale, currency, credit cycle config, and payment setup. Scoped by `association_id`. | tenant, company |
| **Organization** | Operational unit within an association (e.g., "PDA Metro Manila Chapter"). Has an `org_type`: chapter, society, national body, or clinic. Scoped by `organization_id`. | club, branch |
| **Person** | Central PII hub. The identity record for any individual in the system. One person can be a member of multiple organizations. | user (ambiguous), account |
| **Member** | A healthcare professional using the platform. One account, one login. Can belong to multiple organizations with independent membership status in each. | patient, client |
| **Officer** | A member assigned an administrative role within an organization: President, Treasurer, or Secretary. Each sub-role has distinct capabilities. | admin, staff, manager |
| **Platform Administrator** | A Memberry employee or super-admin who manages the platform itself (pricing, feature flags, associations, impersonation, support). Not affiliated with any association. | super user, root user |

---

## Membership Terms

| Term | Definition |
|------|------------|
| **Membership Status** | Current standing of a member within a specific organization. Computed from `dues_expiry_date`, never stored as a mutable field. Status is per-org, not global. |
| **Active** | Dues are current. Full access to org features. |
| **Grace** | Dues expired but within the configurable grace period (default 30 days). Read-only access. |
| **Lapsed** | Dues expired beyond grace period. No access to org features. Still on roster. |
| **Pending** | Application submitted, not yet approved. |
| **Suspended** | Explicitly suspended by an officer. Requires officer action to restore. Distinct from Lapsed. |
| **Removed** | Removed from org roster by President action. |
| **Membership Category** | Classification within an org (e.g., Regular, Associate, Life, Student, Honorary). Configured per org. |
| **Dues** | Annual or periodic payment required to maintain active membership. |
| **Dues Expiry Date** | Date when current dues payment expires. Membership status is derived from this value. |
| **Cross-Org Membership** | A member belonging to multiple organizations simultaneously, with independent status in each. |
| **Cross-Org Member Matching** | Linking a single account across organizations. Matches on email OR license number. Conflicts flagged for human resolution. |

---

## Financial Terms

| Term | Definition |
|------|------------|
| **Fund Allocation** | Configurable split of each dues payment into 0-N designated funds (e.g., 60% Chapter Operating, 30% National, 10% Activity). Per org. |
| **Rounding Resolution** | When fund allocation percentages produce fractional amounts, the last fund absorbs the remainder. |
| **Platform Gateway** | Payment gateway for Memberry's own subscription billing (Platform charges Associations). |
| **Org Gateway** | Payment gateway configured by each org for collecting dues from members. |
| **Two-Level Payment** | Architecture where platform billing and member dues use separate gateway accounts. |
| **Royalty Split** | Revenue sharing configuration between chapters and national bodies for dues collected. |

---

## Activity Terms

| Term | Definition | Avoid |
|------|------------|-------|
| **Event** | Social, governance, or community activity with no professional development credits. Examples: General Assembly, Induction Ceremony, Mission Trip. Internal by default. | meeting |
| **Training** | Credit-bearing professional development activity. Instructor-led or live online. Examples: Seminar, Workshop, Convention, Online Webinar. Network-wide by default. | course, class |
| **Training Types** | 5 platform-defined types: Seminar, Workshop, Convention/Conference, Online Course/Webinar, Skills Training. Fixed at platform level; orgs cannot customize. |
| **Registration** | A member's enrollment in an Event or Training. | enrollment, signup |
| **Attendance** | Confirmation that a registered member actually attended. Triggers credit generation for Training. |

---

## Credit Terms

| Term | Definition |
|------|------------|
| **Credit Entry** | Single record of professional development credits. Two types: AUTO (generated on Training attendance) and MANUAL (self-entered, no approval required). |
| **Credit Cycle** | Per-member period for accumulating credits toward renewal. Starts from registration date. Duration configurable per association (1, 2, or 3 years). |
| **Credit Aggregation** | Computation of a member's total credits across all organizations within their current credit cycle. Cross-org. |
| **Excess Credits** | Credits earned beyond the cycle requirement. Carry over to the next cycle. |
| **Credit Transcript** | Downloadable compliance report showing a member's credit history within a cycle. |

---

## Identity and Credential Terms

| Term | Definition |
|------|------------|
| **Member ID Card** | Generated PDF credential with name, photo, org, membership status, and QR code. |
| **QR Code** | HMAC-signed code in member cards and certificates. Verifies authenticity (data not tampered). Does NOT verify real-time status -- offline scans prove authenticity only. |
| **Certificate** | Generated PDF certifying completion of a Training activity. Includes credits earned and QR code. |
| **License Number** | Professional regulatory license identifier (e.g., PRC license). Used for cross-org matching and verification. |

---

## Communications Module Disambiguation

Three handler directories exist for communications. Each has a distinct scope:

### `handlers/comms/` -- Real-Time Communications

WebSocket-based real-time features. 11 handlers covering:
- **Chat rooms**: create, list, get, send messages, get messages
- **Video calls**: join, leave, end, update participant, ICE servers
- **WebSocket endpoints**: `ws.chat-room.ts`

Scope: synchronous, real-time, peer-to-peer communication between members.

### `handlers/communication/` -- Templated Messaging and Announcements

The primary communications module. 28 handlers covering:
- **Announcements**: create, publish, archive, list, get, update, delete
- **Message templates**: create, search, preview, update, delete
- **Scheduled messages**: create, schedule, cancel, send, search
- **Subscription topics**: create, update, delete, get
- **Member preferences**: list, update, bulk update

Scope: asynchronous, officer-to-member broadcast communications. Templates, scheduling, delivery tracking.

### Announcements (within `communication/`)

Announcements are a sub-feature of the `communication` module, not a separate module. They represent one-to-many officer-authored posts with optional push/email delivery.

> **Consolidation note**: The three comms-related modules (`comms`, `communication`, and the legacy `communications` reference in CLAUDE.md) are a known overlap. `comms` = real-time, `communication` = async broadcast. No standalone `communications/` handler directory exists in the codebase.

---

## Training vs Course Disambiguation

| Concept | Meaning | Where Used |
|---------|---------|------------|
| **Training** | Instructor-led or live professional development activity. Managed by officers, attended by members, generates credits on attendance confirmation. | `handlers/training/`, TypeSpec, PRD Module 9 |
| **Course** | Not a first-class entity. Used informally for the "Online Course / Webinar" training type. All courses are modeled as Training records with type = "Online Course / Webinar". | Training type dropdown only |

If self-paced online learning becomes a distinct feature in the future, it should be modeled as a separate entity, not overloaded onto Training.

---

## Field Naming: `organizationId`

`organizationId` is the canonical Drizzle schema field name. Maps to `organization_id` in PostgreSQL.

| Context | Use | Avoid |
|---------|-----|-------|
| Drizzle schema (TypeScript) | `organizationId` | `orgId` |
| PostgreSQL column | `organization_id` | `org_id` |
| API request/response | `organizationId` | `orgId` |

Exception: `nationalOrgId` is used in royalty split schemas for the national body reference, as it refers to a different org than the primary `organizationId`.

---

## Platform Terms

| Term | Definition |
|------|------------|
| **Module** | Self-contained feature set that can be enabled/disabled per org based on subscription tier. |
| **Monetization Tier** | Subscription level: Free, Standard, Premium, or Add-on. |
| **Org Public Page** | Shareable URL showing org profile, activities, and "Apply to Join" button. |
| **Member Verification API** | Public read-only endpoint to verify member status by license number. Returns status only, no PII. |
| **Network-Wide** | Visible across all organizations in the association. Default for Training. |
| **Internal** | Visible only to members of a specific organization. Default for Events. |
| **Feature Flag** | Platform-level toggle controlling feature availability. Managed by Platform Administrators. |

---

## Acronyms

| Acronym | Expansion | Context |
|---------|-----------|---------|
| **AMS** | Association Management System | What Memberry is |
| **CPD** | Continuing Professional Development | Credit system for healthcare professionals |
| **PRC** | Professional Regulation Commission | Philippine regulatory body that approves CPD providers |
| **RBAC** | Role-Based Access Control | Authorization model (Better-Auth) |
| **PII** | Personally Identifiable Information | Data privacy classification |
| **DPA** | Data Privacy Act (2012) | Philippine data protection law |
| **PDPA** | Personal Data Protection Act | Thailand/Singapore data protection law |
| **GDPR** | General Data Protection Regulation | EU data protection regulation |
| **NPS** | Net Promoter Score | Review/feedback system |
| **ORM** | Object-Relational Mapping | Drizzle ORM |
| **SDK** | Software Development Kit | `packages/sdk-ts/` |
| **HMAC** | Hash-based Message Authentication Code | QR code signing |
| **ICE** | Interactive Connectivity Establishment | WebRTC server discovery (comms module) |

---

## Localization Terms

| Term | Definition |
|------|------------|
| **Locale** | Language + regional settings (e.g., `en-PH`, `fil-PH`). |
| **Multi-currency** | Different currencies per association (PHP, SGD, etc.). Amounts display in the association's configured currency. |
| **Regulatory Framework** | Country-specific compliance rules. Pluggable per association (DPA 2012, PDPA, GDPR). |

---

## DDD Classification

All classifications below are **[INFERRED]** from codebase analysis (schema structure, handler relationships, event patterns). They have not been validated through a formal domain modeling exercise.

| Entity | Classification | Aggregate Root? | Domain Events (past tense) | Bounded Context |
|--------|---------------|----------------|---------------------------|-----------------|
| Person | Entity | Yes — owns notification preferences, privacy settings | PersonCreated, PersonUpdated, PersonAnonymized | Identity |
| Membership | Entity | Yes — owns applications, status history | MembershipApproved, MembershipSuspended, MembershipResigned, MembershipDeceased | Membership |
| Organization | Entity | Yes — owns positions, officer terms, dues configs | OrganizationCreated | Platform Admin |
| Association | Entity | Yes — owns organizations | AssociationCreated | Platform Admin |
| Officer Term | Entity | No — child of Organization | OfficerTermCreated, OfficerTermExpired | Governance |
| Credit Entry | Entity | No — child of Membership cycle | CreditAwarded, CreditVerified, CreditRejected | Training/CPD |
| Dues Invoice | Entity | Yes — owns payment records | InvoiceGenerated, InvoicePaid, InvoiceCancelled | Billing |
| Dues Payment | Entity | No — child of Dues Invoice | PaymentRecorded, PaymentConfirmed, PaymentRefunded | Billing |
| Booking | Entity | Yes — owns time slots | BookingConfirmed, BookingCancelled, BookingNoShow | Scheduling |
| Event | Entity | Yes — owns registrations, check-ins | EventPublished, EventCancelled, EventCompleted | Events |
| Training | Entity | Yes — owns enrollments | TrainingPublished, TrainingCompleted | Training/CPD |
| Election | Entity | Yes — owns nominations, ballots | ElectionOpened, ElectionPublished, ElectionCancelled | Governance |
| Chat Room | Entity | Yes — owns messages | ChatRoomCreated, ChatRoomArchived | Communications |
| Notification Preference | Value Object | No — owned by Person | — | Identity |
| Privacy Settings | Value Object | No — owned by Person | — | Identity |
| Address / Contact Info | Value Object | No — stored as JSONB on Person | — | Identity |
| Credential Template | Entity | No — owned by Organization | CredentialTemplateCreated | Credentials |

---

## Bounded Contexts

Eight bounded context candidates identified from codebase structure and domain relationships.

### 1. Identity
- **Modules/Entities:** Person, Notification Preference, Privacy Settings, Address/Contact Info
- **Key Invariants:** One Person per email address globally. PII centralized — no other context stores name/email/phone directly.

### 2. Membership
- **Modules/Entities:** Membership, applications, status history, transfers, cross-org matching
- **Key Invariants:** Membership status derived from `dues_expiry_date` (never stored as mutable field). Status is per-org, not global. A person can hold independent memberships across multiple organizations.

### 3. Billing
- **Modules/Entities:** Dues Config, Dues Invoice, Dues Payment, Fund Allocation, Royalty Split
- **Key Invariants:** Fund allocation percentages must sum to 100% per org. Rounding remainder absorbed by last fund. Two-level payment architecture (platform gateway vs org gateway).

### 4. Training/CPD
- **Modules/Entities:** Training, Credit Entry, Accredited Provider, Credit Cycle, Credit Transcript
- **Key Invariants:** AUTO credits generated only on confirmed attendance. Credit cycle duration configured per association (1, 2, or 3 years). Excess credits carry over to next cycle.

### 5. Governance
- **Modules/Entities:** Officer Term, Position, Election, Nomination, Ballot
- **Key Invariants:** Officer terms are time-bounded. President/Treasurer/Secretary require 2FA. Only active officers can perform governance mutations.

### 6. Events
- **Modules/Entities:** Event, Registration, Check-in, Capacity Management
- **Key Invariants:** Events are internal to an organization by default. Registration requires active membership status.

### 7. Communications
- **Modules/Entities:** Chat Room, Message, Video Call, Announcement, Message Template, Scheduled Message, Subscription Topic
- **Key Invariants:** Real-time (comms) and async broadcast (communication) are separate subsystems. Announcements are one-to-many officer-authored posts.

### 8. Platform Admin
- **Modules/Entities:** Association, Organization, Feature Flag, Platform Administrator, Impersonation
- **Key Invariants:** Platform Administrators are not affiliated with any association. Feature flags control module availability per org subscription tier.

---

## Anti-Corruption Layer Recommendations

Three missing Anti-Corruption Layers (ACLs) identified during codebase audit. Currently, all modules import directly from each other via `@/handlers/` paths with no abstraction boundary. These are recommendations for future refactoring, not current state.

### 1. Person <-> Membership

**Current state:** The Person module directly imports membership repositories to check membership status when rendering person profiles.

**Problem:** Changes to membership schema or status computation logic can break person module handlers unexpectedly.

**Recommendation:** Introduce a shared interface or internal API for querying membership status from the person context. The person module should not depend on membership repository internals.

### 2. Dues <-> Membership

**Current state:** The Dues module directly imports `membership-lifecycle` utilities to transition membership status after payment confirmation.

**Problem:** Tight coupling to the membership state machine. Changes to status transitions (e.g., adding a new status) require coordinated changes in the dues module.

**Recommendation:** Dues should emit domain events (e.g., `InvoicePaid`) that the membership context subscribes to, rather than directly invoking membership state transitions.

### 3. Email <-> Membership

**Current state:** The Email module directly imports membership schema to check for deceased or suppressed members before sending.

**Problem:** Email delivery logic is coupled to membership domain concepts. Adding new suppression reasons requires changes in the email module.

**Recommendation:** Introduce a `DeliveryEligibility` interface that the email module queries. The membership context implements this interface, encapsulating suppression logic behind a stable contract.
