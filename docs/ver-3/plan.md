# Memberry -- Master PRD

**Version:** 3.0
**Date:** 2026-04-21
**Status:** APPROVED
**Classification:** Internal -- not for external distribution

---

## 1. Problem Statement

Professional healthcare associations in the Philippines -- dental societies, medical associations, nursing organizations, pharmacy boards -- manage their chapters using spreadsheets, person-to-person mobile payments (GCash, Maya), Viber group chats capped at 250 members, and manual sign-in sheets. This causes:

- **Revenue leakage** from untracked dues and unfollowed lapsed memberships.
- **Regulatory risk** for members whose compliance lapses without notice (e.g., RA 9484 mandates PDA membership for practicing dentists).
- **Communication breakdowns** when chapters exceed Viber's hard 250-member limit.
- **Zero financial accountability** -- no audit trail across officer transitions.
- **Institutional knowledge loss** -- every officer election cycle is a data destruction event.
- **No data-driven decisions** -- leaders cannot answer basic questions about retention, compliance, or engagement.

### Validation

- **Officer interviews:** Initial conversations with chapter officers confirm acute pain around dues tracking, communication fragmentation, and officer transition data loss.
- **Competitor signal:** A peer dental society contracted and paid a vendor to build a custom AMS. Their assessment of the delivered product was that it was "lacking" -- confirming both willingness to pay and inadequacy of existing solutions.
- **Market context:** The global AMS market is USD $2.97B (2026) growing at ~14% YoY. No major platform targets Southeast Asian associations, supports local payment infrastructure (GCash, Maya), or prices for chapter budgets under $5,000/year.

---

## 2. Strategic Framing

Memberry is the go-to-market wedge for a health product portfolio. The AMS is the customer acquisition channel; the long-term business is a professional identity and services platform.

### Three-Phase Trajectory

| Phase | Name | What It Is | Revenue Model |
|-------|------|-----------|---------------|
| **Phase 1** | Association Management System | Solve chapter-level membership, dues, events, communications, compliance tracking. Rapid adoption across chapters, then across associations. | Free trial to minimal SaaS subscription per association |
| **Phase 2** | Professional Identity Platform + Community | Unified professional profile across organizations. News feed, elections and governance, national dashboards, job board, pharma/supplier advertising. | Subscription tiers + job board fees + advertising revenue |
| **Phase 3** | Health Services Marketplace | Cross-sell higher-value products: EMR/clinic management, supply procurement, insurance, telehealth, accredited continuing education. | Transaction fees, referral revenue, marketplace commissions |

Each phase builds on the user base and trust established by the previous phase. Phase 1 creates the captive audience of verified healthcare professionals. Phase 2 makes their identity portable and the platform sticky. Phase 3 monetizes the network at scale.

**External positioning:** Memberry is an AMS. The identity platform and marketplace trajectory is internal strategy only -- not communicated in sales, marketing, or customer-facing materials.

---

## 3. Goals and Success Metrics

### Pilot Targets (First 3 Months)

| Goal | Metric | Target |
|------|--------|--------|
| First chapter live | Chapters with real members and payments | 1 or more by month 2 |
| Member registration | Registered members in pilot chapter | 30+ in first 2 weeks |
| Payment adoption | Online dues payments processed | 10+ in pilot |
| Officer satisfaction | Qualitative feedback | "Better than spreadsheets" |

### Growth Targets (6-18 Months)

| Goal | Metric | 6 Months | 18 Months |
|------|--------|----------|-----------|
| Chapter adoption | Chapters onboarded | 5-10 (1 association) | 50+ (3+ associations) |
| Active members | Members on platform | 500-1,000 | 10,000+ |
| Dues collection rate | % of expected dues collected via platform | 60%+ | 80%+ |
| Officer adoption | % of officers using platform weekly | 80%+ | 90%+ |
| Member self-service | % of members using at least one self-service feature | 40%+ | 70%+ |
| Revenue | Monthly recurring revenue | Minimal (free trial) | $2,000-5,000 MRR |
| Retention | Monthly chapter churn | < 5% | < 3% |
| Satisfaction | NPS (officers / members) | 40+ / -- | 50+ / 30+ |

### Platform Reliability

| Metric | Target |
|--------|--------|
| Monthly uptime | 99.5% |
| API response time (p95) | < 500ms |
| Page load on mobile (p95) | < 3s |

---

## 4. Module Map

Memberry consists of 19 modules delivered across 3 phases and assigned to monetization tiers.

### Phase 1: Association Management System (Modules 1-11)

| # | Module | Category | Wave | Priority | Monetization Tier | Description |
|---|--------|----------|------|----------|-------------------|-------------|
| 1 | Auth and Onboarding | Core Platform | 1 | P0 | Free | Registration, login, org-type-aware smart onboarding wizard |
| 2 | Member Profile and Settings | Core Platform | 1 | P0 | Free | Personal profile, multi-org identity, settings, data export |
| 3 | Platform Administration | Core Platform | 1 | P0 | -- (internal) | Super-admin: revenue, pricing, feature flags, compliance, operator analytics |
| 4 | Organization Admin | Org Management | 1 | P0 | Standard | Org settings, officer roles, org public page, transitions, benchmarking |
| 5 | Membership | Org Management | 1 | P0 | Standard | Roster, applications, bulk import, cross-org matching, engagement analytics |
| 6 | Dues and Payments | Org Management | 1 | P0 | Standard | Payment collection, fund allocation, receipts, automated reminders, treasurer dashboard |
| 7 | Communications | Engagement | 2 | P0 | Standard | Announcements, segmented messaging, delivery tracking |
| 8 | Events | Engagement | 2 | P1 | Premium | Event calendar, registration, QR check-in, attendance analytics |
| 9 | Training | Engagement | 2 | P0 | Premium | Credit-bearing activities, enrollment, approval, network-wide discovery |
| 10 | Credit Tracking | Professional Development | 3 | P0 | Premium | Credit progress dashboard, cycle management, auto and manual entries |
| 11 | Documents and Credentials | Credentials | 3 | P1 | Premium | Member ID cards, certificates, tamper-proof QR verification, branding |

**Wave delivery:** Wave 1 (Modules 1-6) ships first and enables the pilot. Wave 2 (7-9) and Wave 3 (10-11) ship while the pilot is running, informed by real user feedback.

### Phase 2: Professional Identity Platform + Community (Modules 12-16)

| # | Module | Monetization Tier | Description |
|---|--------|-------------------|-------------|
| 12 | Elections and Governance | Add-on | Officer elections (in-app and in-person), voting, term management, bylaw ratification |
| 13 | Professional Feed | Add-on | Member discussions, knowledge sharing, professional networking, content moderation |
| 14 | National Dashboard | Add-on | Cross-org reporting, aggregate analytics, national-level administration, compliance monitoring |
| 15 | Job Board | Add-on | Clinic and practice job postings, member applications, job alerts |
| 16 | Advertising | Add-on | Pharma and supplier ad inventory, scheduling, targeting, analytics |

### Phase 3: Health Services Marketplace (Modules 17-19)

| # | Module | Monetization Tier | Description |
|---|--------|-------------------|-------------|
| 17 | Marketplace | Add-on | Integration hub for EMR, supply procurement, insurance, telehealth, accredited continuing education |
| 18 | Surveys and Polls | Add-on | Member feedback, data collection, poll creation, response analytics |
| 19 | Committee Management | Add-on | Committee tracking, roles, terms, meeting management |

### Monetization Tier Summary

| Tier | Modules Included | Pricing Intent |
|------|-----------------|----------------|
| **Free** | Auth and Onboarding, Member Profile (basic) | Zero cost -- removes adoption friction |
| **Standard** | Org Admin, Membership, Dues and Payments, Communications | Core chapter operations -- minimal subscription |
| **Premium** | Events, Training, Credit Tracking, Documents and Credentials | Professional development and compliance -- higher subscription |
| **Add-on** | Elections, Professional Feed, National Dashboard, Job Board, Advertising, Marketplace, Surveys, Committees | A la carte -- associations enable based on need |

---

## 5. Hierarchy Model

Memberry operates on a four-level hierarchy. Every data operation is scoped to the appropriate level.

```
Platform (Memberry)
  |
  +-- Association (e.g., PDA, PMA, PNA, PPhA) + Country
        |
        +-- Organization (chapter, society, national body, clinic)
              |
              +-- Member (healthcare professional)
```

**Key rules:**

- A member is a first-class entity independent of any single association. One person, one account, one login.
- A member can belong to multiple organizations across multiple associations (e.g., a dentist in both a PDA chapter and a specialty society).
- Each membership relationship has its own status, dues standing, and role assignments.
- Organizations have a type (chapter, society, national body, clinic) that determines available features and workflows.
- Associations have country-level configuration: locale, currency, payment infrastructure, compliance rules, credit cycle settings.

---

## 6. Platform-as-a-Service Model

Memberry is a multi-tenant platform. Each association is a tenant that can enable or disable modules based on their subscription tier and operational needs.

### How It Works

- **Platform operator** (Memberry) manages global configuration: available modules, subscription tiers, pricing, feature flags, platform-wide analytics.
- **Association administrators** select which modules to activate for their organizations. A small rural chapter may only need Standard tier (membership + dues + communications). A national body may need Premium plus add-ons.
- **Module activation is per-association**, not per-organization. All organizations within an association share the same module set.
- **Two-level billing:** The platform bills associations for their subscription. Associations collect dues from members through their own configured payment gateway. These are separate financial flows.

### Subscription Tier Access

| Capability | Free | Standard | Premium | Add-on |
|-----------|------|----------|---------|--------|
| Member registration and login | Yes | Yes | Yes | Yes |
| Basic member profile | Yes | Yes | Yes | Yes |
| Organization administration | -- | Yes | Yes | Yes |
| Membership roster and management | -- | Yes | Yes | Yes |
| Dues collection and fund allocation | -- | Yes | Yes | Yes |
| Announcements and messaging | -- | Yes | Yes | Yes |
| Event management with QR check-in | -- | -- | Yes | Yes |
| Training programs with credits | -- | -- | Yes | Yes |
| Credit tracking and compliance | -- | -- | Yes | Yes |
| ID cards and certificates | -- | -- | Yes | Yes |
| Elections, feed, dashboard, job board, ads, marketplace, surveys, committees | -- | -- | -- | Per module |

---

## 7. User Roles

| # | Role | Scope | Summary |
|---|------|-------|---------|
| 1 | Platform Administrator | Platform-wide | Revenue, pricing, feature flags, compliance, support, impersonation |
| 2 | Chapter President | Organization | Governance: assigns roles, reviews reports, manages transitions, disciplinary actions |
| 3 | Chapter Treasurer | Organization | Financial operations: dues, payments, refunds, gateway configuration, financial reporting |
| 4 | Chapter Secretary | Organization | Member operations: roster, events, communications, applications, corrections |
| 5 | Society Officer | Organization | Training programs: courses, credits, enrollments, regulatory compliance |
| 6 | Member | Self | Self-service: pay dues, register for activities, track credits, update profile, download credentials |

Officers are members with administrative privileges. The three officer sub-roles (president, treasurer, secretary) have distinct workflows and permissions reflecting real-world association governance.

---

## 8. Data Privacy and Compliance

### Phase 1: Philippines (Data Privacy Act of 2012, RA 10173)

| Requirement | Implementation |
|-------------|---------------|
| Consent | Privacy notice at registration. Explicit, informed consent. Withdrawable at any time. |
| Data portability | Members can export all personal data (profile, payments, credits) in a standard format. |
| Right to correction | Members can request corrections to their records. |
| Right to deletion | Account deletion with 30-day grace period. Financial records retained 7 years per tax law. |
| Breach notification | National Privacy Commission notified within 72 hours. Affected members notified promptly. |
| Data processing agreement | Each association executes a DPA with the platform as data processor. |
| PII protection | License numbers and payment data encrypted at rest and in transit. Never logged in plaintext. |

### Audit Trail

All significant actions are logged in an immutable audit trail: financial transactions, membership changes, credit modifications, administrative actions, authentication events. Retention: 3 years for audit logs, 7 years for financial records.

### Global Expansion Framework

| Region | Key Regulation | Additional Requirements |
|--------|---------------|------------------------|
| ASEAN | Country-specific PDPA variants (similar to DPA 2012) | Local data residency review per country |
| European Union | GDPR | Data residency, cookie consent, Data Protection Officer, right to erasure |
| United States | HIPAA applies only if touching clinical data (AMS data is not clinical) | Standard data protection practices sufficient for non-clinical professional data |

The platform is designed so that compliance controls (consent flows, data residency, retention policies, breach procedures) are configurable per country and per association.

---

## 9. Assumptions

| ID | Assumption | Status | Risk if Wrong |
|----|-----------|--------|---------------|
| A-1 | Philippine healthcare associations are receptive to adopting a digital platform if it is easy to use and free to start | Partially validated (officer conversations, competitor spend) | GTM strategy fails -- mitigate with single champion chapter |
| A-2 | Volunteer officers will invest time to onboard | Unvalidated | Platform never gets populated -- mitigate with sub-30-minute onboarding and white-glove setup |
| A-3 | 60%+ of members have smartphones and are comfortable with digital payments | Likely valid (GCash 94M+ users, healthcare professionals skew urban) | Core dues automation weakens -- mitigate with manual payment fallback |
| A-4 | Annual dues are PHP 500-5,000 ($9-90), making subscription economics viable | Partially validated | Platform fee may exceed value of automation -- mitigate with free tier for small chapters |
| A-5 | Local payment gateway integration (PayMongo) can be completed within target timeline | Likely valid (well-documented APIs) | MVP launches without automated payments -- mitigate with early integration and manual fallback |
| A-6 | Multi-chapter hierarchical structures are common across PH healthcare associations | Validated for PH (PDA, PMA, PNA, PPhA all use similar structures) | Expansion market may be smaller |
| A-7 | Professional membership is mandated by law for key professions (captive market) | Validated (RA 9484 for dentists, similar statutes for others) | TAM is smaller than projected |

---

## 10. Open Questions

### Carried Forward from v2

| # | Question | Impact |
|---|----------|--------|
| 1 | What specific features was the competitor's AMS "lacking"? | Informs differentiation and feature priority |
| 2 | What are actual dues amounts across associations? | Determines payment economics and pricing viability |
| 3 | What is the PRC CPD credit requirement for dentists (credits per cycle)? | Required to configure default credit tracking |
| 4 | Do medical associations (PMA) have the same credit structure as dental? | Determines cross-association configurability needs |
| 5 | What are the subscription pricing tiers by member count? | Pricing model definition |
| 6 | White-labeling: association branding vs. platform branding? | UX and brand strategy |
| 7 | Multi-language support: English-first or Filipino/Tagalog for v1? | Localization scope |
| 8 | Target onboarding time? (Proposal: invite link to first dues reminder in under 15 minutes) | Onboarding design |

### New for Phase 2 and Phase 3

| # | Question | Impact |
|---|----------|--------|
| 9 | What election bylaws and voting rules vary across associations? | Elections module design complexity |
| 10 | What content moderation approach is needed for the professional feed? | Community management and liability |
| 11 | What is the minimum user base threshold before advertising becomes viable? | Phase 2 revenue timeline |
| 12 | Which pharma and supplier companies are potential advertising customers? | Ad sales pipeline |
| 13 | What job board pricing model works for the PH healthcare market? | Job board revenue model |
| 14 | Which EMR, insurance, and supply chain partners should be targeted for Phase 3? | Marketplace partner strategy |
| 15 | What regulatory requirements exist for operating a healthcare job board or marketplace in PH? | Legal and compliance scoping |
| 16 | At what scale does the national dashboard require materialized data (vs. query-time computation)? | Performance planning for Phase 2 |
| 17 | What is the expansion sequence after Philippines? (ASEAN countries, priority order) | Global expansion roadmap |

---

## 11. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R-1 | Competitor ships a viable AMS before Memberry and locks in key associations | Medium | High | Ship fast; sequential rollout means pilot starts early. Free pricing lowers switching barriers. Target associations the competitor is not pursuing. |
| R-2 | Chapter officers resist adoption due to time constraints or technology discomfort | Medium | High | White-glove onboarding for first chapters; sub-30-minute setup; demonstrate time savings within first week. |
| R-3 | Members do not adopt self-service and continue relying on officers | Medium | Medium | Make self-service genuinely easier than the manual alternative. Incentivize with faster receipts, priority registration. |
| R-4 | Payment gateway integration delays | Medium | Medium | Begin integration early; manual payment recording as fallback; use most mature local API. |
| R-5 | Data privacy incident (license number or payment data leak) | Low | Very High | Encryption at rest and in transit, role-based access, audit logging, DPA 2012 compliance, breach response procedures. |
| R-6 | Association political dynamics -- new president reverses adoption | Medium | High | Bottom-up adoption across chapters creates switching cost. Data persists regardless of political changes. |
| R-7 | Multi-association expansion reveals significant structural variation | Medium | Medium | Configurable platform from day one. Use first 2-3 associations to identify common patterns. |
| R-8 | Cold start problem for network features (benchmarking, cross-org) | High | Medium | Core value (membership + dues) works for a single chapter. Network features activate as more chapters join. |
| R-9 | Free/minimal pricing does not cover infrastructure costs | Medium | Medium | Lean infrastructure. Cross-sell and Phase 2-3 revenue is the long-term model. |
| R-10 | Phase 2-3 marketplace features require regulatory approvals not yet scoped | Medium | Medium | Begin regulatory research before Phase 2 development. Engage legal counsel early. |

---

## 12. Related Documents

The following documents comprise the complete ver-3 specification. Each is intended for handoff to a technical team.

| Document | Location | Purpose |
|----------|----------|---------|
| **Master PRD (this file)** | `ver-3/plan.md` | Business context, strategy, module map, success metrics, compliance |
| **Business Context** | `ver-3/business/context.md` | Detailed problem statement, market analysis, competitive landscape, assumptions |
| **Capabilities** | `ver-3/business/capabilities.md` | Feature inventory per module with acceptance criteria |
| **Business Rules** | `ver-3/business/business-rules.md` | All business rules with examples and edge cases |
| **Users and Journeys** | `ver-3/business/users-and-journeys.md` | Personas, user flows, page map, journey specifications |
| **Metrics** | `ver-3/business/metrics.md` | Success criteria, KPIs, measurement methodology |
| **Roadmap** | `ver-3/business/roadmap.md` | Delivery timeline, wave structure, dependencies, risks |
| **UX Specifications** | `ver-3/ux/` | Wireframes, interaction patterns, navigation structure, design principles |

---

## 13. Terminology

| Term | Definition |
|------|-----------|
| **Association** | Top-level tenant on the platform (e.g., PDA, PMA). Scoped by association and country. |
| **Organization** | An operational unit within an association: chapter, society, national body, or clinic. |
| **Member** | A healthcare professional using the platform. Exists independently of any single organization. |
| **Officer** | A member with an administrative role within an organization (president, treasurer, or secretary). |
| **Dues** | Annual or periodic membership payment required by the association. |
| **Fund Allocation** | The configurable split of a single dues payment into designated funds (e.g., 60% national, 30% chapter, 10% special). |
| **Credit Entry** | A record of professional development credits earned through platform activities (automatic) or self-reported (manual). |
| **Credit Cycle** | The per-member period for accumulating credits toward license renewal. Configurable duration. |
| **Training** | A credit-bearing professional development activity (seminar, workshop, convention, course, webinar). |
| **Event** | A social or governance activity with no credits (general assembly, induction, social gathering). |
| **AMS** | Association Management System. |
| **CPD / CE** | Continuing Professional Development / Continuing Education. |
| **PRC** | Professional Regulation Commission (Philippine government agency overseeing licensure). |
| **DPA 2012** | Data Privacy Act of 2012 (RA 10173), the Philippine data protection law. |

---

*Memberry v3 PRD -- April 2026*
