# Feature Research

**Domain:** Healthcare Association Management System — Philippine dental associations (pilot)
**Researched:** 2026-05-13
**Confidence:** HIGH (PH regulatory sources + AMS industry patterns + existing codebase context)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features officers and members assume exist. Missing these = pilot association won't adopt.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Dues invoice security (auth check) | Officers expect invoices are private — auth bypass is a trust-breaker | LOW | Critical bug fix; dues module exists, route guard missing |
| Mark invoice paid (cash/cheque/bank transfer) | Most PH dental chapter dues are paid offline, not online | MEDIUM | New payment recording flow; receipt PDF generation required |
| Receipt generation (PDF) | Treasurer needs paper trail for audit | MEDIUM | PDF via server-side render or template; link from invoice |
| Bulk membership approval | Chapter officer approves batches of applicants, not one-by-one | MEDIUM | Batch endpoint on existing membership module |
| Member roster view + search | Officers need to look up any member by name, PRC number, status | LOW | Already partially exists; needs status filter + PRC# field |
| Member status transitions (active → resigned, deceased) | Members leave or die; records must persist for compliance | MEDIUM | New status enum values + transition guards; soft-delete pattern |
| Account deletion (data subject request) | PH DPA RA 10173 §16: right to erasure on request | MEDIUM | Cascade delete PII, anonymize audit logs, export before delete |
| Data export (portability) | PH DPA RA 10173 §16: right to data portability | MEDIUM | JSON or CSV export of all personal data linked to person record |
| CPD credit tracking per member | PRC requires proof of CPD compliance for license renewal | MEDIUM | Training module exists; needs PRC accreditation number on training records |
| Unsubscribe / email preference center | CAN-SPAM + PH DPA §13: lawful basis for communications | LOW | Per-member email opt-out flags; existing email module needs guard |

### Differentiators (Competitive Advantage)

Features that would make Memberry clearly better than spreadsheets or generic tools used by PH dental chapters today.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| PRC accreditation number on training events | Officers can submit CPD compliance reports directly to PRC without manual reconciliation | MEDIUM | Accreditation number + credit hours on event/training record; CPDAS-compatible export |
| Attendance tracking with officer sign-off | Auto-generates CPD certificate only after officer confirms attendance | MEDIUM | Attendance record linked to training event; gate on certificate issuance |
| Cross-chapter training recognition | Member who attended event under Chapter A gets credit recognized in Chapter B after transfer | HIGH | Cross-org training records; requires transfer workflow and credit portability |
| Chapter transfer workflow with dues continuity | Member moves chapter; old dues balance resolves, new chapter gets clean record | HIGH | Transfer request → approval → dues proration or waiver; audit trail |
| Deceased member memorial record | Record preserved for historical roster, not purged; death date noted | LOW | Status = "deceased" + date; exclude from active dues runs; keep in event history |
| Officer daily ops dashboard | Single view: pending approvals, unpaid invoices, upcoming events, recent training submissions | MEDIUM | Dashboard widget aggregation; no new data, new view |
| Bulk email with bounce/suppression guard | Sending chapter-wide email to 500 members without nuking deliverability | MEDIUM | Hard bounce → auto-suppress; soft bounce counter; rate throttle per batch |
| Payment receipt audit trail | Every "mark paid" action logged with officer identity, timestamp, method | LOW | Audit middleware already exists; just ensure payment actions route through it |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time payment gateway (e.g., GCash, PayMongo) | Officers want automated collection | v1.2.0 scope creep; PH payment rails need separate compliance review; adds webhook complexity | Manual payment recording with receipt — covers 90% of actual PH dental chapter dues workflows today |
| Full CPDAS API integration (PRC system sync) | Auto-submit CPD records to PRC portal | CPDAS does not expose a public API; portal is login-only; screen-scraping is fragile | Export CPD report as PDF/CSV in CPDAS-compatible format; officer manually uploads |
| Automatic member expiry + reinstatement | Seems like automation win | Triggers dues disputes if member was "expired" without notice; needs human review | Send renewal reminder → member-initiated renewal → officer approval |
| Bulk delete / hard purge of member records | "Clean up old data" request | Violates PH DPA record retention obligations for professional associations; also destroys audit trail | Soft-delete + anonymization; keep encrypted PII in cold storage for mandated retention period |
| Email HTML template builder | Officers want to design newsletters | Scope creep; AMS is not an email marketing platform | Use pre-defined templates with variable substitution; integrate Postmark templates |
| Open-ended custom fields on member profiles | "We need to track X" per chapter | Turns schema into a blob; breaks TypeSpec-first approach | Model known fields (PRC number, specialty, chapter) explicitly; use notes field for ad-hoc |

---

## Feature Dependencies

```
Account Deletion
    └──requires──> Data Export (export before delete)
    └──requires──> Audit Log Anonymization (preserve compliance trail)

Mark Invoice Paid
    └──requires──> Receipt Generation (proof of payment)
    └──requires──> Payment Audit Log (officer accountability)

Certificate Issuance
    └──requires──> Attendance Tracking (officer sign-off gate)
    └──requires──> Training Event with PRC Accreditation Number

Cross-Chapter Training Recognition
    └──requires──> Chapter Transfer Workflow
    └──requires──> Training records with source-chapter reference

Bulk Email
    └──requires──> Email Preference / Unsubscribe flags
    └──requires──> Bounce suppression list

Deceased / Resigned Status
    └──requires──> Status transition guards (prevent re-activation without officer approval)
    └──enhances──> Dues invoice runs (exclude deceased/resigned from new invoices)
```

### Dependency Notes

- **Account deletion requires data export:** PH DPA best practice — export triggered before erasure so data subject receives their data.
- **Certificate issuance requires attendance:** Prevents CPD fraud; PRC audits require evidence of attendance, not just enrollment.
- **Cross-chapter training requires transfer workflow:** Credits reference source chapter; without transfer record, attribution is ambiguous.
- **Bulk email requires suppression list:** Sending to bounced addresses = deliverability death; suppression must be checked before any send.
- **Deceased handling enhances dues runs:** Deceased members must be excluded from auto-generated invoices or dues collection campaigns.

---

## MVP Definition (v1.2.0 Pilot Launch Scope)

### Launch With (v1.2.0)

Minimum set to make the pilot association's treasurer + chapter president operational.

- [ ] **Dues invoice auth fix** — Without this, any logged-out user can view invoices. Trust-breaker on day one.
- [ ] **Mark invoice paid + receipt PDF** — Most dues are cash/bank transfer. Officers need to record payments. Core revenue workflow.
- [ ] **Bulk membership approval** — Chapter receives 10-50 applications per intake period. One-by-one approval is unusable.
- [ ] **Member roster with status filter** — Officers need to see active vs lapsed vs resigned members at a glance.
- [ ] **Account deletion + data export** — Required for PH DPA compliance before collecting real user data in pilot.
- [ ] **Member status: resigned + deceased** — Associations lose members. Without these transitions, roster becomes stale garbage.
- [ ] **CPD credit with PRC accreditation number** — Training records without PRC accreditation number are useless for license renewal proof.
- [ ] **Email unsubscribe guard** — Before any bulk comms go out to pilot members, opt-out must be respected.
- [ ] **Email bounce suppression** — Prevent hard-bounce addresses from being re-sent; protects pilot deliverability.

### Add After Validation (v1.x)

Add once pilot chapter has been using the system for 60+ days.

- [ ] **Officer daily ops dashboard** — Trigger: officers complaining about navigating between sections for daily tasks.
- [ ] **Attendance tracking with officer sign-off** — Trigger: first CPD audit or PRC compliance report request.
- [ ] **Chapter transfer workflow** — Trigger: first inter-chapter member transfer request from pilot.
- [ ] **Cross-chapter training recognition** — Trigger: transferred member asks why their CPD credits disappeared.
- [ ] **Bulk email with rate throttle** — Trigger: chapter wants to email 200+ members for an announcement.

### Future Consideration (v2+)

Defer until product-market fit confirmed and second association onboards.

- [ ] **Payment gateway (GCash/PayMongo)** — Defer: requires PH payment compliance review; current cash workflow is sufficient for pilot.
- [ ] **CPDAS export format** — Defer: need to verify exact PRC CPDAS import format; manual PDF works for now.
- [ ] **Multi-chapter admin view** — Defer: pilot is single-chapter scope; national-level rollup is v2 feature.
- [ ] **Automated renewal reminders with escalation** — Defer: manual reminder is fine at pilot scale.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Dues invoice auth fix | HIGH | LOW | P1 |
| Mark invoice paid + receipt | HIGH | MEDIUM | P1 |
| Bulk membership approval | HIGH | MEDIUM | P1 |
| Account deletion + data export | HIGH | MEDIUM | P1 (compliance) |
| Member roster + status filter | HIGH | LOW | P1 |
| Resigned / deceased status transitions | HIGH | MEDIUM | P1 |
| CPD with PRC accreditation number | HIGH | LOW | P1 |
| Email unsubscribe guard | MEDIUM | LOW | P1 |
| Email bounce suppression | MEDIUM | MEDIUM | P1 |
| Officer daily ops dashboard | MEDIUM | MEDIUM | P2 |
| Attendance tracking + officer sign-off | MEDIUM | MEDIUM | P2 |
| Chapter transfer workflow | MEDIUM | HIGH | P2 |
| Cross-chapter training recognition | MEDIUM | HIGH | P2 |
| Bulk email rate throttle | LOW | MEDIUM | P2 |
| Payment gateway integration | HIGH | HIGH | P3 (v2) |
| CPDAS API / export | MEDIUM | HIGH | P3 (v2) |

**Priority key:**
- P1: Must have for pilot launch
- P2: Add after pilot validation
- P3: Future milestone

---

## PH-Specific Regulatory Context

### PRC CPD Requirements (Dental)

- Dentists need **45 CPD units** per 3-year license renewal cycle (RA 10912).
- CPD programs must be run by **PRC-accredited providers** — the association itself can be accredited.
- Accreditation numbers are issued per program by PRC; they are NOT auto-generated. Officers must manually enter the PRC accreditation number when creating a training event.
- CPDAS (cpdas.prc.gov.ph) is PRC's online portal; no public API. Officers upload attendance sheets and certificates manually.
- **System implication:** Store `prc_accreditation_number` and `cpd_units` on training events. Generate CPD transcript per member for their manual upload to CPDAS.

### PH Data Privacy Act (RA 10173)

- Right to erasure: must delete PII when no longer necessary OR on data subject request, with exceptions for legally mandated retention.
- Right to portability: export in structured, machine-readable format (JSON or CSV acceptable).
- Professional associations have a **legitimate interest** basis for processing member data (no separate consent needed for core AMS functions), but communications require opt-in or opt-out mechanism.
- **System implication:** Account deletion = anonymize PII fields + export first. Audit log entries must be kept but de-linked from personal identity (replace personId with a hash or "DELETED_USER" marker).
- Retention: professional licensing records should be retained for the duration required by PRC (typically 5 years minimum after membership ends).

### Chapter Daily Operations (Typical PH Dental Chapter)

An officer's typical week involves:
1. **Monday:** Check new membership applications from the online form; approve or request documents.
2. **Tuesday/Wednesday:** Respond to dues payment confirmations from members (GCash screenshot sent via Messenger); manually mark invoices paid.
3. **Thursday:** Prepare for weekend seminar/CPD event; confirm attendees.
4. **Post-event:** Mark attendance; issue CPD certificates; record accreditation number.
5. **Monthly:** Run dues report; chase unpaid invoices; email lapsed members.

This workflow is currently done in Excel + Messenger + Google Forms. The system replaces all of it.

---

## Competitor Feature Analysis

| Feature | YourMembership / Wild Apricot | Fonteva (Salesforce) | Memberry Approach |
|---------|-------------------------------|----------------------|-------------------|
| Dues payment recording | Online only or manual via admin panel | Salesforce-integrated payment records | Offline-first: manual recording with receipt; online gateway deferred |
| CPD tracking | Generic CEU tracking, no PRC awareness | Generic, no PH-specific | PRC accreditation number as first-class field |
| Member status (deceased) | Rarely supported natively | Custom field workaround | Native status enum with transition guards |
| PH DPA compliance | Not designed for PH | Not designed for PH | Native account deletion + data export |
| Chapter transfer | Multi-chapter orgs: chapter switching | Multi-chapter with Salesforce flows | Transfer request workflow with dues continuity |
| Email suppression | Built into email marketing module | Salesforce Marketing Cloud | Native bounce suppression on email module |

---

## Sources

- [PRC CPD Accreditation System — cpdas.prc.gov.ph](https://cpdas.prc.gov.ph/)
- [PRC Revised CPD Guidelines (March 2025)](https://www.prc.gov.ph/node/7611)
- [PRC Dentistry CPD page](https://www.prc.gov.ph/dentistry)
- [Philippines Data Privacy Act — NPC](https://privacy.gov.ph/data-privacy-act/)
- [PH DPA Guide — SecurePrivacy](https://secureprivacy.ai/blog/data-privacy-act-2012-philippines-guide)
- [AMS features overview — Fonteva](https://fonteva.com/ams-system/)
- [AMS features — Nimble AMS](https://www.nimbleams.com/what-is-association-management-software-ams/)
- [Email bounce best practices — AssociationSphere](https://support.associationsphere.com/support/solutions/articles/67000724313-email-marketing-best-practices-for-high-deliverability-and-low-bounce-rates)
- [Chapter transfer process — BNI example](https://bnimn.com/img/site/601c2cf2b2b8cc00095fc854.pdf)

---
*Feature research for: Memberry v1.2.0 Pilot Launch — Philippine healthcare associations*
*Researched: 2026-05-13*
