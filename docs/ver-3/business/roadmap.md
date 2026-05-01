# Memberry Roadmap

**Healthcare Association Management Platform — Philippines**
**Last Updated:** April 2026

---

## 1. Strategic Context

Memberry is built in three distinct phases, each with a clear commercial logic. Phases are sequential — later phases build on the foundation and network effects of earlier ones.

### Phase 1: AMS Core (Months 1–6)
**Thesis:** Prove the core value proposition before expanding.

A healthcare association's most fundamental operational needs are roster management and dues collection. Everything else is secondary. Phase 1 is complete when at least one association can run their full membership cycle — onboarding, payment collection, and compliance tracking — entirely on Memberry, without spreadsheets or WhatsApp threads as a fallback.

Product-market fit signal: two pilot associations fully operational, with 30+ members, 10+ payments processed, and officers logging in weekly without prompting.

### Phase 2: Professional Identity and Community (Months 6–12)
**Thesis:** Give members a reason to return daily, not just at renewal.

Once the operational backbone is proven, the platform becomes the professional home for individual members — not just a dues portal. This means a feed of professional content, an elections system for governance, a national view for federated associations, and a job board that creates direct career value. Stickiness at this phase is measured by member-initiated logins, not officer-driven reminders.

### Phase 3: Health Services Marketplace (Months 12–24)
**Thesis:** Monetize the professional network through third-party revenue.

A verified, credentialed database of healthcare professionals is a distribution asset. Phase 3 opens the platform to EMR vendors, pharmaceutical companies, medical suppliers, and insurance providers who want to reach this audience through legitimate, association-endorsed channels. Revenue shifts from subscription-only to a multi-stream model including referral fees, ad placements, and marketplace commissions.

---

## 2. Wave-Based Delivery (Phase 1)

Phase 1 is delivered in three sequential waves. Each wave produces a working, usable product increment — not a prototype. No big-bang launch.

---

### Wave 1: Foundation — Weeks 1–3

**Goal:** One association can log in, see their roster, and record a payment.

This is the minimum viable operation. An officer can import or confirm their member list, record a dues payment, and see who is current and who is lapsed — nothing more. This wave establishes trust with the first pilot association.

| Module | Scope |
|--------|-------|
| M01 — Auth & Onboarding | Member self-claim flow; officer login; invitation by email |
| M02 — Member Profile | View-only member records; contact details; membership status |
| M04 — Org Admin | Basic association settings; fiscal year; membership categories |
| M05 — Membership | Roster view; active/lapsed/inactive status computation |
| M06 — Dues & Payments | Record a payment; basic dues schedule configuration |

---

### Wave 2: Engagement — Weeks 3–5

**Goal:** Officers are running operations on the platform, not just viewing data.

The platform moves from passive record-keeping to active operations. Officers can communicate with members, manage events, and run training sessions. This wave is where the day-to-day value of replacing WhatsApp becomes tangible.

| Module | Scope |
|--------|-------|
| M03 — Platform Admin | Association setup wizard; org management; impersonation for support |
| M07 — Communications | Email blast to members; automated payment reminders |
| M08 — Events | Create and publish events; member RSVP; attendance marking |
| M09 — Training | Create training sessions; registration; attendance tracking |

---

### Wave 3: Professional Development — Weeks 5–6

**Goal:** Members have a reason to log in, not just officers.

The platform becomes relevant to individual members — not only the treasurer and secretary. CPD credit tracking and credential issuance create a direct personal stake for every member.

| Module | Scope |
|--------|-------|
| M10 — Credit Tracking | Auto-credit from completed training; manual credit entry; CPD cycle progress |
| M11 — Documents & Credentials | Digital ID cards; certificates of attendance/completion; QR-code verification |

---

### Phase 1 Complete: Pilot Launch Target

| Metric | Target |
|--------|--------|
| Pilot associations fully operational | 2 |
| Members onboarded across both pilots | 30+ |
| Payments recorded | 10+ |
| Officer weekly active usage | Consistent, without prompting |
| Member logins (self-initiated) | Measurable baseline established |

---

## 3. Phase 2 Delivery — Months 6–12

**Theme: Professional Identity and Community**

Phase 2 modules deepen member engagement and extend the platform from local chapter operations to national federation visibility.

| Module | Description |
|--------|-------------|
| M12 — Elections and Governance | Officer elections, candidate nominations, member voting, results certification |
| M13 — Professional Feed | News, regulatory updates, and member-shared content; follows and saves |
| M14 — National Dashboard | Cross-chapter reporting for national associations; federation-level member and dues views |
| M15 — Job Board | Physician and healthcare professional postings; member applications |
| M16 — Advertising | Sponsored placements for pharmaceutical, medical supply, and continuing education vendors |

Phase 2 success signal: month-over-month growth in member-initiated logins; at least one national association federation onboarded using M14.

---

## 4. Phase 3 Delivery — Months 12–24

**Theme: Health Services Marketplace**

Phase 3 converts the verified professional network into a commercial distribution layer. All marketplace activity is association-endorsed — vendors access the network through association partnerships, not cold outreach.

| Module | Description |
|--------|-------------|
| M17 — Marketplace | EMR vendor referrals; medical supply procurement; insurance product listings; telehealth provider connections |
| M18 — Surveys and Polls | Member feedback collection; regulatory opinion gathering; research partner surveys |
| M19 — Committee Management | Standing and ad-hoc committee creation; member assignment; document and task management |

Phase 3 success signal: at least one active third-party revenue stream generating consistent monthly income; marketplace GMV measurable and growing.

---

## 5. Top Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Adoption — Officers don't switch from WhatsApp and spreadsheets.** Officers have established workflows built around free, familiar tools. The platform must demonstrate a clear operational advantage within the first session. | High | High | White-glove onboarding for the first five associations. Offer to import their existing Google Sheet roster on their behalf as a concierge service. The first session must end with the officer seeing their own real data — not sample data. |
| **Payment adoption — Treasurers record cash and resist pushing digital.** The Philippines payment ecosystem is GCash and Maya-first. If the platform doesn't support e-wallets, the payment module will be ignored and adoption stalls at the most critical revenue-proving feature. | High | High | Prioritize GCash and Maya integration in gateway configuration before Wave 1 launch. Allow manual cash recording as a permanent fallback — the goal is capturing the record, not forcing the payment method. |
| **Regulatory compliance — PRC CPD requirements change.** The Philippine Regulation Commission periodically revises CPD requirements by profession. If credit logic is hardcoded, any change requires a code update and creates a compliance gap. | Medium | Medium | Credit cycle configuration is externalized — credit hours, cycle length, and carryover rules are association settings, not hardcoded values. A PRC regulatory change triggers a configuration update, not a development effort. |
| **Association fragmentation — Each chapter wants custom features.** National associations with multiple regional chapters will each present slightly different operational requirements. Without a clear policy, this becomes unbounded scope creep. | Medium | Medium | Configuration-first design handles most chapter-level variation through org settings: credit cycles, fund allocation rules, membership categories, and dues schedules. New feature requests require national association sign-off before any build commitment. |
| **Data migration quality — Imported rosters are incomplete or wrong.** If the initial member import contains errors, member self-claim rates will be low, officer trust will erode quickly, and the onboarding experience will feel broken. | Medium | High | Platform admin reviews and validates every import before it is activated. Provide a standardized roster import template. First-time imports are offered as a paid concierge service — not self-serve. |

---

## 6. Assumptions

The following assumptions underpin Phase 1 scope and timeline. If any assumption proves false, scope must be revisited before proceeding.

- **Language:** Pilot associations are English-speaking (en-PH locale). Filipino language support is deferred until post-pilot validation.
- **Willingness to pay:** The first pilot associations are paying customers — not a free tier. This is a deliberate choice to validate commercial viability from the first engagement.
- **Device access:** Officers and members have smartphone access. Mobile-responsive web experience is a Phase 1 requirement, not a nice-to-have.
- **Payment gateway:** A Philippine domestic payment gateway with GCash and Maya support is contracted and configured before Wave 1 launch. This is a dependency, not an assumption the product team controls.
- **Legal readiness:** A legal review for Data Privacy Act of 2012 (DPA 2012) compliance is completed before any member PII is stored in production. The platform does not go live before this review is signed off.

---

## 7. Out of Scope — All Phases

The following are explicitly excluded from Memberry's product scope across all phases. These boundaries exist to maintain product focus and avoid capability dilution.

| Excluded Capability | Reason |
|---------------------|--------|
| Native mobile app (iOS or Android) | Web-only for all phases. Mobile-responsive web serves the use case without native development overhead. |
| Clinical data — patient records, diagnoses, treatment history | Memberry is an association management platform, not an EMR. No patient data enters the system. |
| Direct patient-facing features | All users are healthcare professionals or association staff. Patients are never a user persona. |
| Real-time video — streaming, webinars | Integrations with Zoom and Google Meet serve this need. Memberry does not build or host video infrastructure. |
| Payroll or HR functions | Associations are not employers of their members in the relevant sense. Payroll is outside the AMS scope entirely. |
