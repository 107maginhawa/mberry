# Memberry — Domain Terminology

This glossary defines the precise language used throughout the Memberry PRD. The tech team and product team must use these terms consistently. Ambiguity in terminology becomes ambiguity in the product.

---

## Core Entities

| Term | Definition | Do NOT use |
|------|------------|-----------|
| **Association** | The top-level tenant organization (e.g., Philippine Dental Association, Philippine Medical Association). Each association has its own locale, currency, credit cycle configuration, and payment setup. Scoped by `association_id`. | tenant, company, organization (overloaded) |
| **Organization** | An operational unit within an association (e.g., "PDA Metro Manila Chapter", "PDA Cebu Society"). Has an `org_type`: chapter, society, national body, or clinic. Scoped by `org_id`. | club, branch, chapter (use org_type = chapter instead) |
| **Member** | A healthcare professional using the platform. One account, one login. Can belong to multiple organizations simultaneously, with independent membership status in each. | user (ambiguous), patient, client |
| **Officer** | A member who has been assigned an administrative role within an organization. Three distinct sub-roles (President, Treasurer, Secretary), each with different capabilities. | admin, staff, manager |
| **Platform Administrator** | A Memberry employee or super-admin who manages the platform itself — pricing, feature flags, associations, impersonation, support. Not affiliated with any association. | super user, root user |

---

## Officer Sub-Roles

| Role | Scope | Primary Responsibilities |
|------|-------|------------------------|
| **President** | Org governance | Assigns officer roles, manages officer transitions, reviews reports, handles disciplinary actions |
| **Treasurer** | Financial operations | Collects dues, records payments, manages payment gateway, generates financial reports, handles refunds |
| **Secretary** | Member operations | Maintains roster, manages events, handles communications, processes applications and corrections |

---

## Membership Terms

| Term | Definition | Notes |
|------|------------|-------|
| **Membership Status** | The current standing of a member within a specific organization. Computed from `dues_expiry_date`, never stored as a mutable field. | Status is per-org, not per-member globally. A member can be Active in one chapter and Lapsed in another. |
| **Active** | Dues are current (not expired). The member has full access to all org features. | |
| **Grace** | Dues have expired, but within the grace period (configurable, default 30 days). The member retains read access but cannot register for new activities. | |
| **Lapsed** | Dues are expired beyond the grace period. The member loses access to org features. Still visible in the roster. | |
| **Pending** | The member has applied to join the org but hasn't been approved yet. | |
| **Suspended** | The member has been explicitly suspended by an officer. Different from Lapsed. Requires officer action to restore. | |
| **Membership Category** | The classification of a member within an org (e.g., Regular, Associate, Life, Student, Honorary). Configured per org. | |
| **Dues** | The annual or periodic payment required to maintain active membership in an organization. | fee, subscription, billing |
| **Dues Expiry Date** | The date when a member's current dues payment expires. Computed status is derived from this. | |

---

## Membership Lifecycle State Machine

```
                    [Officer imports or approves]
                              ↓
PENDING ──────────────────► ACTIVE
                              │
                    [dues_expiry_date passes]
                              ↓
                            GRACE  (configurable period, default 30 days)
                              │
                    [grace period passes]
                              ↓
                           LAPSED
                              │
                    [member pays dues]
                              ↓
                            ACTIVE
                              
                    [Officer action at any point]
                              ↓
                          SUSPENDED
                              │
                    [Officer action to restore]
                              ↓
                            ACTIVE

                    [President action]
                              ↓
                           REMOVED (from org roster)
```

Valid transitions:
- `PENDING → ACTIVE` (officer approves application)
- `PENDING → REMOVED` (officer rejects application)
- `ACTIVE → GRACE` (automatic, dues expired)
- `GRACE → LAPSED` (automatic, grace period expired)
- `LAPSED → ACTIVE` (member pays dues)
- `ACTIVE → SUSPENDED` (officer action)
- `GRACE → SUSPENDED` (officer action)
- `LAPSED → SUSPENDED` (officer action)
- `SUSPENDED → ACTIVE` (officer restores)
- `ACTIVE → REMOVED` (president action)

---

## Financial Terms

| Term | Definition | Notes |
|------|------------|-------|
| **Fund Allocation** | The configurable split of each dues payment into 0–N designated funds (e.g., 60% Chapter Operating Fund, 30% National Fund, 10% Activity Fund). Configured per org. | split, distribution |
| **Rounding Resolution** | When fund allocation percentages produce fractional amounts, the last fund absorbs the rounding remainder. | |
| **Platform Gateway** | The payment gateway used for Memberry's own subscription billing (Platform charges Associations). | |
| **Org Gateway** | The payment gateway configured by each org for collecting dues from members (Org collects from Members). | |
| **Two-Level Payment** | The architecture where platform billing and member dues are handled by separate gateway accounts. | |

---

## Activity Terms

| Term | Definition | Notes |
|------|------------|-------|
| **Event** | A social, governance, or community activity with no professional development credits. Examples: General Assembly, Induction Ceremony, Mission Trip, Social Gathering. Internal by default (visible only to org members). | meeting (generic — too vague) |
| **Training** | A credit-bearing professional development activity. Examples: Seminar, Workshop, Convention, Online Course, Webinar. Network-wide by default (visible across organizations). | course (generic), class |
| **Activity Types** | Platform-defined lists for Events (8 types) and Training (5 types). Orgs select from these lists; they cannot create custom types. This ensures network-wide consistency for analytics. | |
| **Registration** | A member's enrollment in an Event or Training. Creates a record linking member to activity. | enrollment, signup |
| **Attendance** | Confirmation that a registered member actually attended the activity. Triggers credit generation for Training. | |

---

## Credit Terms

| Term | Definition | Notes |
|------|------------|-------|
| **Credit Entry** | A single record of professional development credits for a member. Two types: AUTO (generated by platform when attending a Training) and MANUAL (self-entered by member, no approval required). | point record, score entry |
| **Credit Cycle** | The per-member period for accumulating credits toward renewal. Starts from the member's registration date. Duration is configurable per association (1, 2, or 3 years). | CPD cycle, point period |
| **Credit Aggregation** | The computation of a member's total credits across all organizations they belong to, within their current credit cycle. Cross-org. | |
| **Excess Credits** | Credits earned beyond the cycle requirement. Carry over to the next cycle. | |

---

## Identity Terms

| Term | Definition | Notes |
|------|------------|-------|
| **Member ID Card** | A generated PDF credential showing the member's name, photo, org, membership status, and a QR code. Can be downloaded and printed. | |
| **QR Code** | An HMAC-signed code embedded in member cards and activity certificates. Scanning verifies authenticity (the data hasn't been tampered with). Does NOT verify current status in real-time — offline scans prove authenticity only, not currency. | |
| **Certificate** | A generated PDF document certifying completion of a Training activity. Includes member name, activity name, credits earned, date, and a QR code. | |

---

## Platform Terms

| Term | Definition | Notes |
|------|------------|-------|
| **Module** | A self-contained set of features that can be enabled or disabled per organization based on subscription tier. | feature (too generic) |
| **Monetization Tier** | The subscription level required to access a module: Free, Standard, Premium, or Add-on. | pricing tier |
| **Org Public Page** | A shareable URL for each organization showing their profile, activities, and an "Apply to Join" button. | landing page, website |
| **Member Verification API** | A public, read-only endpoint that allows external parties to verify a member's current status using their license number. Returns status only — no personal data. | |
| **Cross-Org Member Matching** | The process of linking a member's single account across multiple organizations. Matches on email OR license number. Conflicts (email matches person A, license matches person B) are flagged for human resolution. | |
| **Network-Wide** | Visible and accessible across all organizations in the association network. Default for Training activities. | |
| **Internal** | Visible only to members of the specific organization. Default for Events. | |

---

## Localization Terms

| Term | Definition |
|------|------------|
| **Locale** | A combination of language and regional settings (e.g., `en-PH` for English/Philippines, `fil-PH` for Filipino/Philippines). |
| **Multi-currency** | Platform supports different currencies per association (PHP for PH, SGD for Singapore, etc.). All amounts display in the association's configured currency. |
| **Regulatory Framework** | Country-specific compliance rules (DPA 2012 for PH, PDPA for Thailand, GDPR for EU). Pluggable per association. |
