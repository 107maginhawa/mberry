<!-- oli-seed v2.0 | generated 2026-05-24 | mode: dev | layer: L3 (workflow-aware) -->
# Seed Data Manifest

**Project:** Memberry Healthcare AMS
**Generated:** 2026-05-24 by `/oli-seed` comprehensive gap analysis
**Previous:** v1.1 (2026-05-20, incremental phases 17-22)
**Stack:** Bun + Drizzle ORM + PostgreSQL
**Seed Format:** TypeScript (Drizzle insert)
**Mode:** dev (10-20/entity, happy paths + edge cases)

---

## 1. Current State Assessment

### File Inventory (BEFORE revamp)

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `seed.ts` | 561 | Base: org, users, positions, memberships | **SUPERSEDED** by seed-scenarios |
| `seed-rich.ts` | 967 | Enrichment: payments, credits, invoices | **SUPERSEDED** by seed-scenarios |
| `seed-modules.ts` | 416 | F2-F10 module data | **DEAD CODE** — seed-scenarios covers all |
| `seed-scenarios.ts` | 3,415 | Comprehensive API-driven scenarios | **PRIMARY** but messy |
| `seed-officer.ts` | 119 | One-off officer script | **DEAD CODE** — seed-scenarios handles officers |
| `diagnose-seed-data.ts` | 709 | Diagnostic checker | **KEEP** — useful validation tool |
| **Total** | **6,187** | | 4 of 6 files redundant |

### Architecture Problems

| # | Problem | Severity | Impact |
|---|---------|----------|--------|
| A1 | 4 overlapping files, unclear execution order | HIGH | Confusion, partial seeds, run wrong file |
| A2 | `as any` on ~90% of inserts | HIGH | No type safety, schema drift silently breaks data |
| A3 | Silent error swallowing (try/catch → log + skip) | HIGH | Partial data with no failure signal |
| A4 | No idempotency — "check exists, skip" not upsert | MEDIUM | Re-runs fail on partial state |
| A5 | seed-modules.ts + seed-rich.ts + seed.ts are dead code | LOW | Confusion, maintenance burden |
| A6 | No scenario naming convention | LOW | Hard to trace what data exercises what workflow |
| A7 | Raw SQL mixed with Drizzle ORM in same file | LOW | Inconsistent data access patterns |
| A8 | Hardcoded Filipino data, no configurability | LOW | Demo inflexibility |

---

## 2. Table Coverage Analysis

### Coverage Summary

seed-scenarios.ts inserts into **70 tables** across all 25 handler modules.

| Bounded Context | Tables Seeded | Tables in Schema | Gap |
|----------------|---------------|------------------|-----|
| Identity & Auth | person, user (+ better-auth auto) | 7 | 0 |
| Membership | memberships, tiers, categories, applications, statusHistory, chapterAffiliations | 6 | 0 |
| Governance | positions, officerTerms | 2 | 0 |
| Dues (Config) | duesConfigs, duesInvoices, duesOrgConfigs | 3 | 0 |
| Dues (Payments) | duesFunds, duesFundAllocations, duesReminderSchedules, duesGatewayConfigs, paymentTokens | 5 | 0 |
| Dues (Dunning) | dunningTemplates, dunningEvents | 2 | 0 |
| Special Assessments | specialAssessments, specialAssessmentTargets | 2 | 0 |
| Billing | invoices, invoiceLineItems, merchantAccounts, billingConfigs | 4 | 0 |
| Events | events, eventRegistrations, checkIns | 3 | 0 |
| Training | trainings, enrollments, courses, courseEnrollments, accreditedProviders, quizAttempts | 6 | 0 |
| Credits | creditEntries, orgCpdConfig | 2 | 0 |
| Certificates | certificates, orgCertificateSeq, credentialTemplates, digitalCredentials | 4 | 0 |
| Documents | documents, documentVersions, documentAccessLogs | 3 | 0 |
| Communications | chatRooms, chatMessages, chatRoomMembers, chatMessageReactions | 4 | 0 |
| Surveys | surveys, surveyResponses | 2 | 0 |
| Elections | elections (raw SQL), electionNominees, electionVotes | 3 | 0 |
| Notifications | notifications, notificationPreferences | 2 | 0 |
| Storage | storedFiles | 1 | 0 |
| Marketplace | vendors, marketplaceListings, marketplaceOrders | 3 | 0 |
| Jobs | jobPostings, jobApplications | 2 | 0 |
| Reviews | reviews | 1 | 0 |
| Invite | invitationTokens | 1 | 0 |
| Audit | auditLogEntries | 1 | 0 |
| Platform Admin | organizations, associations, platformAdmins | 3 | 0 |
| Directory | directoryProfiles | 1 | 0 |
| Privacy | personPrivacySettings | 1 | 0 |
| Credentials | professionalLicenses, licenseRenewalAlerts | 2 | 0 |
| Committees | committees, committeeMembers, committeeTasks | 3 | 0 |
| Segments | savedSegments | 1 | 0 |
| Waitlist | waitlistEntries | 1 | 0 |
| **Advertising** | **(ads)** | **1** | **1 — not imported in seed-scenarios** |

**Table coverage: 69/70 (99%).** Only advertising table not explicitly seeded.

### Tables Not Seeded (deferred — no active handlers or not in v1 scope)

| Table | Module | Reason |
|-------|--------|--------|
| booking_event | M08 Booking | Booking feature not in v1 |
| time_slot | M08 Booking | Depends on booking_event |
| booking | M08 Booking | Depends on time_slot |
| schedule_exception | M08 Booking | Depends on booking_event |
| affiliation_transfer | M04 Org Admin | Transfer workflow not in scope |
| royalty_split | M04 Org Admin | Dues split config not in v1 |
| dues_payment_status_history | M06 Dues | Needs dues_payment IDs to link |
| dues_category_override | M06 Dues | Category override not in v1 |
| aging_bucket | M06 Dues | AR aging report not in v1 |
| dues_reminder_log | M06 Dues | Reminder idempotency log |
| advertising (ads) | M16 | No handler active |

---

## 3. State Transition Coverage

Cross-referenced against WORKFLOW_MAP Section 5 (11 state machines, 52 total states).

### 3.1 Membership Status (11 states)

| State | Seeded? | Gap |
|-------|---------|-----|
| pending | YES | — |
| active | YES | — |
| grace | YES | — |
| lapsed | YES | — |
| suspended | YES | — |
| removed | YES | — |
| pendingPayment | YES | — |
| expired | YES | — |
| resigned | YES | — |
| **deceased** | **NO** | **GAP** — terminal state |
| **expelled** | **NO** | **GAP** — terminal state |

### 3.2 Payment Status (10 states)

| State | Seeded? | Gap |
|-------|---------|-----|
| pending | YES | — |
| completed | YES | — |
| submitted | YES | — |
| **failed** | **NO** | **GAP** — gateway failure |
| **expired** | **NO** | **GAP** — 24h timeout |
| **refunded** | **NO** | **GAP** — BR-08 |
| **partiallyRefunded** | **NO** | **GAP** |
| **underReview** | **NO** | **GAP** — review workflow |
| **confirmed** | **NO** | **GAP** — post-review |
| **rejected** | **NO** | **GAP** — post-review |

### 3.3 Event Status (4 states)

| State | Seeded? | Gap |
|-------|---------|-----|
| draft | YES | — |
| published | YES | — |
| completed | YES | — |
| **cancelled** | **NO** | **GAP** |

### 3.4 Event Registration (4 states)

| State | Seeded? | Gap |
|-------|---------|-----|
| registered | YES | — |
| attended | YES | — |
| **waitlisted** | **NO** | **GAP** — BR-27 |
| **cancelled** | **NO** | **GAP** |

### 3.5 Training Status (5 states)

| State | Seeded? | Gap |
|-------|---------|-----|
| draft | YES | — |
| published | YES | — |
| in_progress | YES | — |
| completed | YES | — |
| **cancelled** | **NO** | **GAP** |

### 3.6 Enrollment Status (3 states)

| State | Seeded? | Gap |
|-------|---------|-----|
| enrolled | YES | — |
| completed | YES | — |
| **dropped** | **NO** | **GAP** |

### 3.7 Election Status (6 states)

| State | Seeded? | Gap |
|-------|---------|-----|
| draft | YES | — |
| nominations_open | YES | — |
| voting_open | YES | — |
| **awaitingConfirmation** | **NO** | **GAP** |
| **published** | **NO** | **GAP** |
| **cancelled** | **NO** | **GAP** |

### 3.8 Announcement Status (3 states)

| State | Seeded? | Gap |
|-------|---------|-----|
| draft | YES | — |
| published | YES | — |
| **archived** | **NO** | **GAP** |

### 3.9 Notification Status (3 states)

| State | Seeded? | Gap |
|-------|---------|-----|
| unread | YES | — |
| read | YES | — |
| **dismissed** | **NO** | **GAP** |

### 3.10 Committee Status (3 states)

| State | Seeded? | Gap |
|-------|---------|-----|
| active | YES | — |
| completed | YES | — |
| dissolved | PARTIAL | Has dissolvedAt but status field might not match |

### State Coverage Summary

| State Machine | Total States | Seeded | Gaps |
|---------------|-------------|--------|------|
| Membership | 11 | 9 | **2** |
| Payment | 10 | 3 | **7** |
| Event | 4 | 3 | **1** |
| Event Registration | 4 | 2 | **2** |
| Training | 5 | 4 | **1** |
| Enrollment | 3 | 2 | **1** |
| Election | 6 | 3 | **3** |
| Announcement | 3 | 2 | **1** |
| Notification | 3 | 2 | **1** |
| Committee | 3 | 2 | **1** |
| **Total** | **52** | **32** | **20 (38%)** |

---

## 4. Business Rule Coverage

40 BRs documented in WORKFLOW_MAP Section 4. Assessment of seed data pairs.

| BR | Description | Pass? | Violate? | Priority |
|----|-------------|-------|----------|----------|
| BR-01 | Membership status from dues_expiry_date | YES | PARTIAL | — |
| BR-02 | Grace period 30d default, configurable | YES | NO | G: need 0-day config |
| BR-03 | Valid membership transitions | PARTIAL | NO | G: need invalid transition data |
| BR-04 | Dues amount per org | YES | — | — |
| BR-05 | Fund allocation sums to 100% | YES | NO | G: need >100% violator |
| BR-06 | Payment recording by treasurer | YES | NO | G: need non-treasurer attempt |
| BR-07 | Dues expiry extension on payment | YES | NO | — |
| BR-08 | Refund within 30d, not allocated | NO | NO | **CRITICAL: no refund data** |
| BR-09 | Officer role one per org | YES | NO | — |
| BR-10 | Platform admin impersonation | YES | — | — |
| BR-11 | Credit cycle start configurable | YES | — | — |
| BR-12 | Credit carry-over | YES | — | — |
| BR-13 | Auto credits on attendance | PARTIAL | — | — |
| BR-14 | Cross-org credit aggregation | NO | — | G: only 1 org with credits |
| BR-15 | Training vs event distinction | YES | — | — |
| BR-16 | Activity visibility internal/network | PARTIAL | — | — |
| BR-17 | Attendance confirmation by officer | YES | — | — |
| BR-18 | QR check-in auth + valid event | PARTIAL | — | — |
| BR-19 | ID card generation rules | NO | — | G: no ID card template |
| BR-20 | Certificate post-activity | YES | — | — |
| BR-21 | Multi-org member account | PARTIAL | — | — |
| BR-22 | Member matching on import | NO | — | G: no import scenario |
| BR-23 | License number normalization | YES | NO | G: need malformed license |
| BR-24 | Member category assignment | YES | — | — |
| BR-25 | Billing gateway isolation | PARTIAL | — | — |
| BR-26 | Financial retention 7yr | — | — | Policy, not seed |
| BR-27 | Event capacity + waitlist | NO | NO | **CRITICAL: no capacity-limited event** |
| BR-28 | Training prerequisite chain | NO | — | G: no prerequisites |
| BR-29 | Document access control | YES | — | — |
| BR-30 | Payment gateway per-org | PARTIAL | — | — |
| BR-31 | Photo <5MB, SVG sanitized | — | — | Upload validation |
| BR-32 | Financial records 7yr | — | — | Policy, not seed |
| BR-33 | Election integrity | PARTIAL | NO | G: need tampered ballot |
| BR-34 | Notification delivery tracking | YES | — | — |
| BR-35 | Survey anonymity | PARTIAL | — | — |
| BR-36-40 | Additional rules | PARTIAL | — | Varies |

**BR Coverage: ~18/40 pass (45%), ~2/40 violate (5%)**

---

## 5. Role Coverage

| Role | Hierarchy | Seed User? | Email | Gap |
|------|-----------|-----------|-------|-----|
| president | 0 | YES | test@memberry.ph | — |
| vice-president | 1 | **NO** | — | **GAP** |
| secretary | 2 | YES | secretary@memberry.ph | — |
| treasurer | 3 | YES | treasurer@memberry.ph | — |
| board-member | 4 | **NO** | — | **GAP** |
| officer | 5 | YES | society@memberry.ph | — |
| staff | 6 | **NO** | — | **GAP** |
| member | 7 | YES | member@memberry.ph + 25 | — |
| platform admin (super) | — | YES | platformAdmins table | — |
| platform admin (support) | — | **NO** | — | **GAP** |
| platform admin (viewer) | — | **NO** | — | **GAP** |

**Role coverage: 6/11 (55%). Missing 5 role variants.**

---

## 6. Revamp Architecture

### Proposed Structure

Replace 4 overlapping files with 1 entry point + modular layers:

```
services/api-ts/src/
├── seed.ts                    # Entry point — orchestrates layers in order
├── seed/
│   ├── config.ts              # Counts, feature flags, locale toggle
│   ├── helpers.ts             # typed upsert(), dateHelpers, idGen
│   ├── personas.ts            # All seed users with typed roles
│   ├── layer-1-foundation.ts  # Org, users, persons, positions, tiers
│   ├── layer-2-modules.ts     # Per-module data (typed inserts, no `as any`)
│   ├── layer-3-scenarios.ts   # Named scenarios → WF-NNN / BR-NNN
│   ├── layer-4-states.ts      # Every state machine state ≥1 record
│   └── data/
│       ├── filipino-names.ts  # Persona data (swappable per locale)
│       └── constants.ts       # Org slugs, dates, amounts
```

### Design Principles

1. **Zero `as any`** — use `typeof table.$inferInsert` for every insert
2. **Idempotent** — `onConflictDoNothing()` on every insert
3. **FK dependency order** — topological: org → person → membership → dues → ...
4. **Named scenarios** — `scenario_WF001_member_registration_happy`
5. **Fail-loud** — no try/catch swallowing; crash with clear error on missing table
6. **State-complete** — Layer 4 ensures every state machine state has ≥1 record
7. **Source-tagged** — `// seeded from WF-001` or `// [INFERRED]` on every block

### Files to Delete After Revamp

| File | Action |
|------|--------|
| `seed-rich.ts` | DELETE (superseded) |
| `seed-modules.ts` | DELETE (dead code) |
| `scripts/seed-officer.ts` | DELETE (dead code) |
| `seed-scenarios.ts` | ARCHIVE → `seed-scenarios.ts.bak` then DELETE |
| `scripts/diagnose-seed-data.ts` | KEEP — update to match new structure |

---

## 7. Gap Summary & Priorities

### Critical (blocks demo/testing)

| # | Gap | Tables/States | Fix |
|---|-----|---------------|-----|
| G1 | 7/10 payment states missing | failed, expired, refunded, partiallyRefunded, underReview, confirmed, rejected | Layer 4 |
| G2 | 3/6 election states missing | awaitingConfirmation, published, cancelled | Layer 4 |
| G3 | No refund seed data (BR-08) | dues_payment with status=refunded | Layer 3 scenario |
| G4 | No capacity-limited event (BR-27) | event with maxCapacity < registrations | Layer 3 scenario |

### Important (incomplete coverage)

| # | Gap | Fix |
|---|-----|-----|
| G5 | 5 missing role variants (VP, board-member, staff, support-admin, viewer-admin) | Layer 1 personas |
| G6 | No deceased/expelled members | Layer 4: 1 each |
| G7 | No cancelled event/training | Layer 4: 1 each |
| G8 | Advertising table not seeded | Layer 2 |
| G9 | No multi-org credit scenario (BR-14) | Layer 3: credits in org 2 |
| G10 | `as any` on 90% of inserts (A2) | Revamp: typed inserts |

### Nice-to-Have

| # | Gap | Fix |
|---|-----|-----|
| G11 | No import scenario data (BR-22) | CSV fixture |
| G12 | No malformed license (BR-23) | Normalization test data |
| G13 | No training prerequisites (BR-28) | Prerequisite chain |
| G14 | No ID card generation data (BR-19) | Template + member photo |
| G15 | Archived announcement state | Layer 4 |
| G16 | Dismissed notification state | Layer 4 |
| G17 | Dropped enrollment state | Layer 4 |
| G18 | dues_payment_status_history not seeded | Link to existing payments |

---

## 8. What's Next

| Step | Action | Skill |
|------|--------|-------|
| **1** | Approve revamp architecture (above) | User decision |
| **2** | Build unified seed: Layers 1-4 | `/gsd-quick` |
| **3** | Fill 20 state transition gaps | Part of Layer 4 |
| **4** | Add 5 missing role seed users | Part of Layer 1 |
| **5** | Add BR pass/violate pairs for G1-G4 | Part of Layer 3 |
| **6** | Delete old files, update package.json | Part of revamp |
| **7** | Run `diagnose-seed-data.ts` post-revamp | Validate |
| **8** | Run `/oli-confidence-stack` | Measure improvement |
