# Memberry Module Map

**Version:** 3.0
**Date:** 2026-04-21

This document provides the complete module inventory, dependency graph, monetization tier definitions, and phase rollout plan.

---

## 1. Full Module Table

| # | Module | Phase | Wave | Priority | Monetization | Status | Key Dependencies |
|---|--------|-------|------|----------|-------------|--------|------------------|
| 1 | Auth and Onboarding | 1 | 1 | P0 | Free | Planned | None (foundation) |
| 2 | Member Profile and Settings | 1 | 1 | P0 | Free | Planned | M01 |
| 3 | Platform Administration | 1 | 1 | P0 | -- (internal) | Planned | M01 |
| 4 | Organization Admin | 1 | 1 | P0 | Standard | Planned | M01, M03 |
| 5 | Membership | 1 | 1 | P0 | Standard | Planned | M01, M04 |
| 6 | Dues and Payments | 1 | 1 | P0 | Standard | Planned | M01, M04, M05 |
| 7 | Communications | 1 | 2 | P0 | Standard | Planned | M01, M04, M05 |
| 8 | Events | 1 | 2 | P1 | Premium | Planned | M05, M06 (paid events), M07 |
| 9 | Training | 1 | 2 | P0 | Premium | Planned | M05, M06 (paid trainings), M07, M10 |
| 10 | Credit Tracking | 1 | 3 | P0 | Premium | Planned | M05, M09 |
| 11 | Documents and Credentials | 1 | 3 | P1 | Premium | Planned | M05, M09, M10 |
| 12 | Elections and Governance | 2 | -- | -- | Add-on | Future | M04, M05, M07 |
| 13 | Professional Feed | 2 | -- | -- | Add-on | Future | M01, M02, M05 |
| 14 | National Dashboard | 2 | -- | -- | Add-on | Future | M04, M05, M06, M10 |
| 15 | Job Board | 2 | -- | -- | Add-on | Future | M01, M02, M05 |
| 16 | Advertising | 2 | -- | -- | Add-on | Future | M03, M07 |
| 17 | Marketplace | 3 | -- | -- | Add-on | Future | M01, M02, M05 |
| 18 | Surveys and Polls | 3 | -- | -- | Add-on | Future | M04, M05, M07 |
| 19 | Committee Management | 3 | -- | -- | Add-on | Future | M04, M05 |

---

## 2. Dependency Graph

```
M01 Auth and Onboarding                       (foundation -- no dependencies)
 |
 +-- M02 Member Profile and Settings
 |
 +-- M03 Platform Administration
 |    |
 |    +-- M04 Organization Admin
 |         |
 |         +-- M05 Membership
 |         |    |
 |         |    +-- M06 Dues and Payments
 |         |    |    |
 |         |    |    +-- M08 Events (paid registration requires M06)
 |         |    |    |
 |         |    |    +-- M09 Training (paid registration requires M06)
 |         |    |         |
 |         |    |         +-- M10 Credit Tracking (AUTO credits from M09)
 |         |    |         |    |
 |         |    |         |    +-- M11 Documents and Credentials (certificates need M09 + M10)
 |         |    |         |    |
 |         |    |         |    +-- M14 National Dashboard (aggregates credit data)
 |         |    |         |
 |         |    |         +-- M11 Documents and Credentials (certificates need training records)
 |         |    |
 |         |    +-- M07 Communications
 |         |    |    |
 |         |    |    +-- M08 Events (event announcements via M07)
 |         |    |    |
 |         |    |    +-- M09 Training (training announcements via M07)
 |         |    |    |
 |         |    |    +-- M12 Elections and Governance (election announcements)
 |         |    |    |
 |         |    |    +-- M16 Advertising (ad delivery channel)
 |         |    |    |
 |         |    |    +-- M18 Surveys and Polls (survey distribution)
 |         |    |
 |         |    +-- M11 Documents and Credentials (ID cards need member data)
 |         |    |
 |         |    +-- M12 Elections and Governance
 |         |    |
 |         |    +-- M13 Professional Feed
 |         |    |
 |         |    +-- M14 National Dashboard
 |         |    |
 |         |    +-- M15 Job Board
 |         |    |
 |         |    +-- M17 Marketplace
 |         |    |
 |         |    +-- M18 Surveys and Polls
 |         |    |
 |         |    +-- M19 Committee Management
 |         |
 |         +-- M16 Advertising (ad targeting by org)
 |
 +-- M13 Professional Feed (member accounts)
 |
 +-- M15 Job Board (member accounts)
 |
 +-- M17 Marketplace (member accounts)
```

### Simplified Dependency Matrix

| Module | Depends On |
|--------|-----------|
| M01 | -- |
| M02 | M01 |
| M03 | M01 |
| M04 | M01, M03 |
| M05 | M01, M04 |
| M06 | M01, M04, M05 |
| M07 | M01, M04, M05 |
| M08 | M05, M06, M07 |
| M09 | M05, M06, M07, M10 |
| M10 | M05, M09 |
| M11 | M05, M09, M10 |
| M12 | M04, M05, M07 |
| M13 | M01, M02, M05 |
| M14 | M04, M05, M06, M10 |
| M15 | M01, M02, M05 |
| M16 | M03, M07 |
| M17 | M01, M02, M05 |
| M18 | M04, M05, M07 |
| M19 | M04, M05 |

**Note on circular dependency (M09 and M10):** Training (M09) generates AUTO credit entries, and Credit Tracking (M10) consumes them. M09 references M10 because credit values are configured per training. In practice, these modules are developed in the same wave (Wave 3) and share a tight integration boundary. The credit-award mechanism in M09 depends on M10's CreditEntry schema, and M10's AUTO entries depend on M09's attendance confirmation.

---

## 3. Monetization Tier Definitions

### Free

Available to all associations at no cost. Core identity features that establish a member's presence on the platform.

| What is included | Rationale |
|-----------------|-----------|
| Registration, login, magic link, MFA | Zero-friction onboarding removes adoption barriers |
| Basic member profile and settings | Members need an identity before anything else |
| Multi-org membership (account level) | A member should never need multiple accounts |

**Business purpose:** Removes all adoption friction. Gets members onto the platform with zero cost commitment. Creates the user base that makes paid features valuable.

### Standard

Included in the base subscription tier. Core chapter management features that deliver the primary value proposition: manage members, collect dues, communicate.

| What is included | Rationale |
|-----------------|-----------|
| Organization admin (settings, officers, public page) | Every org needs basic administration |
| Membership roster, applications, bulk import | Core member lifecycle management |
| Dues collection, fund allocation, financial reports | Primary revenue-generating capability for associations |
| Announcements, segmented messaging, delivery tracking | Communication is table-stakes for any association platform |

**Business purpose:** Solves the core pain points (spreadsheet chaos, revenue leakage, communication fragmentation). This is the tier that proves the platform is "better than spreadsheets" and justifies the subscription.

### Premium

Included in the higher subscription tier. Advanced features for associations that need professional development tracking, event management, and verifiable credentials.

| What is included | Rationale |
|-----------------|-----------|
| Event management with QR check-in | Structured activity management beyond announcements |
| Training programs with credit awards | Core value prop for societies and compliance-focused orgs |
| Credit tracking with cycle management | Regulatory compliance (PRC CPD requirements) |
| ID cards, certificates, verification | Trust and credibility infrastructure |

**Business purpose:** Targets associations with compliance obligations (CPD/CE tracking) and professional credentialing needs. Higher willingness to pay due to regulatory necessity.

### Add-on

Purchasable separately on top of any paid tier. Specialized features for specific use cases, primarily in Phase 2 and Phase 3.

| What is included | Rationale |
|-----------------|-----------|
| Elections and governance | Complex, not universally needed |
| Professional feed / community | Engagement feature, not core management |
| National dashboard | Only relevant for national-level bodies |
| Job board | Monetization feature, not core management |
| Advertising | Monetization feature, requires scale |
| Marketplace integrations | Phase 3 revenue diversification |
| Surveys and polls | Nice-to-have engagement tool |
| Committee management | Organizational complexity, niche need |

**Business purpose:** Allows associations to pay only for what they use. Creates upsell opportunities. Phase 2-3 modules generate additional revenue streams (job board fees, advertising, marketplace commissions).

---

## 4. Phase-by-Phase Rollout Summary

### Phase 1: Association Management System (11 modules)

**Focus:** Chapter management fundamentals. Solve the acute pain of spreadsheet-based membership, manual dues collection, fragmented communication, and untracked compliance.

**Modules:** M01 through M11

**Delivery waves:**
- **Wave 1 (M01-M06):** Ships first. Enables the pilot chapter. Core platform, org management, membership, dues.
- **Wave 2 (M07-M09):** Ships during pilot. Adds communications, events, training.
- **Wave 3 (M10-M11):** Ships during pilot. Adds credit tracking and documents/credentials.

**Success criteria:** First chapter operational with real members and payments. Officer feedback confirms "better than spreadsheets." 30+ members registered in pilot.

### Phase 2: Professional Identity Platform + Community (5 modules)

**Focus:** Transform the AMS into a professional identity platform. Unified profile across organizations, community engagement, governance tools, and initial marketplace features.

**Modules:** M12 through M16

**Prerequisites:** Phase 1 adoption proven. Multiple associations on platform. Sufficient user base for network effects.

**Key additions:**
- Elections and governance for association self-management
- Professional feed for member engagement and retention
- National dashboard for cross-org visibility
- Job board for healthcare professional career services
- Advertising for pharma/supplier revenue

**Success criteria:** Platform stickiness increases (daily active usage, not just monthly). New revenue streams activate (job board, advertising).

### Phase 3: Health Services Marketplace (3 modules)

**Focus:** Monetize the verified healthcare professional network at scale. Cross-sell higher-value products and services.

**Modules:** M17 through M19

**Prerequisites:** Phase 2 identity platform established. Significant user base (10,000+ professionals). Partner relationships in place.

**Key additions:**
- Marketplace integrations (EMR, supply procurement, insurance, telehealth)
- Surveys and polls for data collection and member feedback
- Committee management for organizational structure

**Success criteria:** Marketplace transaction revenue. Platform becomes the operating system for healthcare professional life, not just association management.

---

## 5. Module Enable/Disable per Organization

### How It Works

- Module activation is configured per association (all organizations within an association share the same module set).
- Within an association's enabled modules, individual organizations can further toggle specific features (e.g., credit tracking toggle per org via M10-R1).
- Standard and Premium modules can be enabled or disabled within the association's subscription tier.
- Toggling does not require code deployment -- it is a configuration change by platform admin or association admin.

### Behavior When a Module is Disabled

| Aspect | Behavior |
|--------|----------|
| **Navigation** | Sidebar items for the disabled module are hidden. Officers and members do not see links to disabled features. |
| **Data** | Existing data is preserved. Disabling a module does not delete any records. Data remains queryable by platform admins and is available if the module is re-enabled. |
| **Cross-references** | Other modules that reference disabled module data handle gracefully. Example: if Documents (M11) is disabled but Training (M09) is enabled, training detail pages do not show "Download Certificate" buttons. |
| **API** | Endpoints for disabled modules return 403 with a clear message: "This feature is not enabled for your organization." |
| **Reports** | Disabled module data does not appear in officer reports or dashboards. |
| **Re-enabling** | When a module is re-enabled, all previously stored data becomes visible again. No data migration needed. |

### Configuration Hierarchy

```
Platform Admin
  |
  +-- Sets available modules per subscription tier
  |     (Free: M01-M02, Standard: M01-M07, Premium: M01-M11)
  |
  +-- Can override per association
  |     (e.g., grant a specific association access to M08 on Standard tier as a promotion)
  |
  +-- Association Admin
        |
        +-- Enables/disables modules within their tier allocation
        |
        +-- Organization-level toggles for specific features
              (e.g., credit tracking on/off per org via M10-R1)
```

---

*Module Map -- Memberry v3*
