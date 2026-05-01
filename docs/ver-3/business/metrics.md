# Memberry — Success Metrics, KPIs, and Failure Criteria

**Product**: Memberry — Healthcare Association Management Platform
**Market**: Professional healthcare associations in the Philippines (dental, medical, and allied health)
**Document purpose**: Define what success looks like at every phase, how we measure it, and when to stop and reassess

---

## 1. North Star Metric

**Number of dues payments processed per month**

This is the single number that best captures whether Memberry is delivering real value. It is not a vanity metric. It requires:

- An association to have signed up and onboarded
- Officers to have configured dues schedules
- Members to have claimed accounts and engaged with billing
- At least one payment to have cleared

A dues payment cannot happen unless the association is actively using the platform for its primary administrative function. Growth in this number means associations are adopting, retaining, and operationalizing Memberry — not just trialing it.

**Baseline**: 0 at launch
**Month 3 target (pilot)**: ≥ 10 payments processed across pilot associations
**Month 12 target**: ≥ 200 payments processed per month across all live associations

Secondary confirmation metric: Monthly Active Organizations (MAOs) with at least one dues payment processed that month.

---

## 2. Phase 1 Metrics — Core AMS (Months 1–12)

Phase 1 is about proving the core association management loop: onboard an association, migrate their roster, collect dues, and communicate with members. Everything else is secondary.

---

### 2.1 Pilot Success Criteria

The first two associations are not just customers — they are validation partners. The following criteria determine whether the pilot has proven the core product hypothesis.

| Criterion | Target | Measurement Window |
|-----------|--------|--------------------|
| Active members per org | ≥ 30 members who have logged in at least once | By end of month 3 |
| Dues payments processed per org | ≥ 10 payments (any amount, any member) | By end of month 3 |
| Officer onboarding completion | All 3 officer roles (Association Admin, Treasurer, Secretary) have completed setup | By end of week 2 |
| Critical bug count | 0 P0/P1 bugs in production | First 30 days |

If any pilot association fails to meet the active member and dues payment targets by month 3, this is a warning signal requiring immediate qualitative investigation before expanding to additional associations.

---

### 2.2 Module-Level KPIs (6-Month Targets)

These KPIs measure whether each module is functioning at a level that justifies continued investment and expansion. They are reviewed monthly internally and shared with association partners quarterly.

| Module | KPI | 6-Month Target | Notes |
|--------|-----|----------------|-------|
| M01 — Auth & Onboarding | Member claim rate (invited members who activated accounts) | ≥ 60% | Unclaimed accounts = wasted import effort |
| M01 — Auth & Onboarding | Median time from invite email to first login | ≤ 5 minutes | Measures friction in the claim flow |
| M02 — Member Profile | Profile completeness rate (photo + specialty filled) | ≥ 40% | Proxy for member engagement beyond login |
| M03 — Platform Admin | Association onboarding time (roster import to live) | ≤ 2 business days | Measures internal efficiency |
| M04 — Org Admin | Officer setup completion rate (all required steps done) | ≥ 80% | Incomplete setup = stalled org |
| M05 — Membership | Active member rate (Active status / total roster) | ≥ 70% | High inactive counts signal data quality issues |
| M06 — Dues & Payments | Dues collection rate (paid / members with dues due in cycle) | ≥ 50% at 6 months; ≥ 70% at 12 months | Primary revenue-driving KPI |
| M06 — Dues & Payments | Digital payment adoption (online payments / total payments collected) | ≥ 30% at 6 months | Cash still expected; target shifts digital over time |
| M07 — Communications | Email open rate for association-sent messages | ≥ 30% | Industry baseline for transactional email is ~25–35% |
| M08 — Events | Events created per organization per quarter | ≥ 2 | Signals active program management |
| M09 — Training | Training sessions created per organization per quarter | ≥ 1 | CPD-adjacent; low bar in phase 1 |
| M10 — Credit Tracking | Manual credit entries recorded per member per billing cycle | ≥ 2 | Officers actively logging credits = data is live |
| M11 — Documents | Digital ID cards downloaded as % of active members | ≥ 40% | High-value feature; download = proof of use |

---

### 2.3 Platform Health KPIs

These are cross-module indicators of overall platform health. Reviewed monthly.

**Adoption**
- **Monthly Active Organizations (MAO)**: Count of associations where at least one officer performed a meaningful action (published communication, recorded payment, updated member status) in the calendar month. Target: 100% of live associations by month 6.
- **Monthly Active Members (MAM)**: Count of members who logged in at least once in the calendar month. Target: ≥ 50% of active-status members by month 6.

**Retention**
- **Association churn rate**: Percentage of associations that cancel their subscription in any given 6-month period. Target: < 10% per 6-month period.
- **Officer continuity rate**: Percentage of associations that retain at least one active officer across consecutive months. Target: ≥ 95%. Loss of all officers is a major churn risk signal.

**Satisfaction**
- **Net Promoter Score (NPS)**: Collected via officer-facing survey each quarter. Question: "How likely are you to recommend Memberry to another healthcare association?" Target: ≥ 40 by month 12. Below 20 is a red flag.
- **Support ticket volume**: Number of tickets submitted per 100 active members per month. Target: < 10 tickets per 100 members per month. Above 20 triggers an engineering reliability sprint.

**Data quality**
- **Roster accuracy rate**: Percentage of imported members whose records are confirmed as current (verified via officer review). Measured at 3-month intervals. Target: ≥ 85%.

---

### 2.4 Non-Functional Requirements (NFRs)

These are the performance thresholds below which the product is considered broken, regardless of feature completeness. All NFRs apply from the day of pilot launch.

| Requirement | Threshold | Why This Number |
|-------------|-----------|-----------------|
| API response time (p95) | < 500ms | Officers in the field on mobile connections |
| Page load time on mobile 3G | < 3 seconds | Philippine mobile infrastructure reality |
| Platform uptime (monthly) | ≥ 99.5% SLA | < 3.6 hours downtime per month permitted |
| PDF generation (ID cards, receipts, reports) | < 3 seconds per document | Officers generate these in real-time during events |
| Search results (member lookup) | < 200ms | Reception-desk workflows require instant lookup |
| Concurrent users without degradation | ≥ 500 simultaneous users | Annual conventions can spike attendance |

Any breach of an NFR threshold in production must be treated as a P1 incident with a 24-hour resolution SLA.

---

## 3. Phase 2 Metrics — Professional Identity + Community (Months 6–18)

Phase 2 adds the features that make Memberry stickier beyond dues: elections, professional content, job boards, and advertising. These modules deepen daily engagement and open new revenue channels.

The Phase 2 modules should not be launched until Phase 1 core KPIs (dues collection rate ≥ 50%, MAO ≥ 90%) are consistently met.

| Module | KPI | Target | Notes |
|--------|-----|--------|-------|
| M12 — Elections | Online voter participation rate (votes cast / eligible members) | ≥ 50% of eligible voters | First digital election is a trust moment |
| M12 — Elections | Election result dispute rate | < 2% of completed elections | Measures perceived legitimacy |
| M13 — Professional Feed | Weekly active feed readers as % of active members | ≥ 30% | Indicates content is relevant and timely |
| M13 — Professional Feed | Content items posted per association per month | ≥ 4 | Minimum signal that associations are curating |
| M14 — National Dashboard | Dashboard access by platform admins during reporting periods | ≥ 80% of defined reporting periods | Admins must be using data, not ignoring it |
| M15 — Job Board | Active job postings per association per month | ≥ 3 | Low bar; signals employers trust the channel |
| M15 — Job Board | Application-to-posting ratio | ≥ 2 applications per posting | Measures candidate engagement |
| M16 — Advertising | Ad slot fill rate (% of available impressions with an active ad) | ≥ 50% | Below 50% = ad product not viable |
| M16 — Advertising | Monthly advertising revenue | Track from first ad sold; target ₱50,000/month by month 18 | Revenue diversification goal |
| M16 — Advertising | Advertiser renewal rate (pharma/vendor) | ≥ 60% after first campaign | Proves ROI to advertisers |

---

## 4. Phase 3 Metrics — Health Services Marketplace (Months 12–24)

Phase 3 extends Memberry beyond association management into a marketplace connecting members with healthcare vendors, tools, and services. This is the platform's long-term monetization and lock-in layer.

Phase 3 modules should not launch until Phase 2 engagement KPIs (feed weekly actives ≥ 30%, election participation ≥ 50%) demonstrate that members treat Memberry as a professional home, not just a billing portal.

| Module | KPI | Target | Notes |
|--------|-----|--------|-------|
| M17 — Marketplace | Verified vendor listings at end of year 1 | ≥ 10 vendors | Quality over quantity; must be verified |
| M17 — Marketplace | Member-to-vendor inquiries per month | ≥ 20 by month 18 | Proves marketplace generates leads |
| M17 — Marketplace | EMR adoption referrals generated per quarter | ≥ 1 | Strategic goal; even 1 referral validates the channel |
| M17 — Marketplace | Vendor retention rate (renewals) | ≥ 70% at annual renewal | Vendors stay if they get qualified leads |
| M18 — Surveys | Survey response rate (respondents / targeted members) | ≥ 40% | Associations need this for CPD and accreditation |
| M18 — Surveys | Surveys deployed per association per quarter | ≥ 2 | Low floor; ensures the module gets real use |
| M19 — Committees | Committees created per 100-member organization | ≥ 3 | Proxy for governance depth |
| M19 — Committees | Committee meeting records logged per quarter per committee | ≥ 1 | Ensures committees are active, not just created |

---

## 5. Failure and Pivot Criteria

These are explicit thresholds that trigger a mandatory pause, root cause investigation, and strategic reassessment. They are not suggestions. If any of these signals is reached, feature development stops until the underlying issue is diagnosed and addressed.

| Signal | Threshold | Required Response |
|--------|-----------|-------------------|
| Digital dues payment adoption | < 20% of payments made digitally by month 9 | Investigate payment friction. Consider direct GCash/Maya integration, or shift strategy to cash-recording-only mode with digital as optional. |
| Association churn | > 20% of active associations cancel in any rolling 6-month period | Immediate qualitative interviews with churned and at-risk accounts. Evaluate freemium extension for small associations. Pause sales expansion. |
| Officer setup abandonment | > 40% of newly onboarded associations do not complete full officer setup within 4 weeks | Full UX audit of the onboarding flow. Consider offering white-glove assisted setup (human-guided remote onboarding) as standard. |
| Member claim rate | < 30% of imported members claim accounts within 3 months of import | Reassess invitation strategy. Evaluate SMS OTP onboarding as a replacement or supplement to email-based invitations. |
| Officer NPS | Score < 20 after first 3 months of operation | Pause all new feature development. Run a dedicated reliability and UX improvement sprint. Re-survey in 6 weeks. |
| Support ticket volume | > 20 tickets per 100 active members per month for any 2 consecutive months | Dedicated engineering sprint focused entirely on reliability, error handling, and self-service documentation. |
| Pilot association loss | Either pilot association churns before month 6 | Full post-mortem before signing any additional associations. Product direction review with leadership. |

These thresholds are calibrated for the pilot stage. They will be updated at the end of Phase 1 based on observed data ranges.

---

## 6. Reporting Cadence

**Weekly (internal team)**
- North Star metric: total dues payments processed in the trailing 7 days
- Active P0 and P1 bug count
- New associations onboarded
- MAO count vs. prior week

**Monthly (shared with key association partners)**
- Module KPI dashboard for their organization
- Dues collection rate trend (current cycle vs. prior)
- Member claim and login activity
- Support ticket summary

**Quarterly (leadership review + officer NPS)**
- Full KPI review across all modules and phases
- NPS survey distributed to all association officers
- Failure criteria check (explicit go/no-go assessment against each threshold)
- Phase gate assessment: readiness to launch next-phase modules
- Advertiser and marketplace revenue summary (Phase 2 and 3 only)

---

*Memberry PRD v3 — Business Metrics | Last updated: April 2026*
