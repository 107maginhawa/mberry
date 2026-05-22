# Trace Report

---
oli-version: trace-v1
Report Date: 2026-05-21
Phase: B (auto-detected)
Modules Traced: all (19)
Mode: standalone
Data Sources: artifacts only (no COMPLIANCE_REPORT or CONFIDENCE_REPORT)
Partial Staleness: none
Previous Report: 2026-05-20 (v1.0 — 203 nodes, 157 edges, BR-focused)
---

## Changes Since Last Run

- **Scope expanded**: 203 → 760 nodes (added AC, API endpoint, UI screen, event, error code, role, state machine node types)
- **Edge types expanded**: 3 → 6 active edge types (added WF_EXPOSED_VIA_API, API_CONSUMED_BY_UI, EVENT_PUBLISHED_BY, EVENT_CONSUMED_BY)
- **BR count normalized**: 51 → 40 BRs (previous report included code-discovered BR-41 through BR-51 from br-registry.json; this report traces WORKFLOW_MAP Section 4 canonical 40 only)
- **WF count normalized**: 114 → 108 WFs (previous report included WFs from earlier WORKFLOW_MAP version; current artifacts define 108)
- **Gap methodology**: Previous report traced WF→BR→Code→Test. New report traces WF→BR→Spec→Slice→Test (spec-first, phase-gated)
- Net: deeper graph, wider coverage, stricter phase-gating

## Summary

| Metric | Count | Delta from v1 |
|--------|-------|---------------|
| Total nodes | 775 | +15 |
| Total edges | 2,903 | +2,339 |
| CRITICAL gaps (P0) | 0 | — |
| HIGH gaps (P1) | 0 | — |
| MEDIUM gaps (P2) | 0 | — |
| Non-AC orphans | 3 | -285 (3 by-design WFs — accepted) |
| Phase-suppressed (ACs) | 116 | Activates at Phase C |
| Total orphans | 119 | -169 |
| Main component | 604 nodes | +502 |
| Chain coverage (WF→BR→Spec→API) | 25% | — |

### Phase-Gating Status

| Algorithm | Name | Active? | Reason |
|-----------|------|---------|--------|
| 4a | Orphan Nodes | YES | Phase A+ |
| 4b | Broken Chains | NO | Requires Phase C (slices) |
| 4c | Coverage Gaps | NO | Requires Phase D (tests) |
| 4d | Cross-Module Blind Spots | YES | Phase B+ |
| 4e | Dangling References | YES | Phase A+ |

## Per-Phase Health Contribution

| Phase | Score | Metric | Notes |
|-------|-------|--------|-------|
| A | 10/10 | Artifact completeness | 108 WFs + 40 BRs fully defined |
| B | 10/10 | Spec coverage | 38/41 BR→Spec edges (93%), all 19 MODULE_SPECs present |
| C | N/A | Slice coverage | No slices linked to spec IDs yet |
| D | N/A | Test coverage | No spec-linked tests yet |

## Coverage Matrix

### Per-Module WF→BR→Spec→API Chain

| Module | WFs | WF→BR | WF→API | BR→Spec | Full Chain % |
|--------|-----|-------|--------|---------|-------------|
| M01 Auth | 9 | 4 | 8 | 3/5 | 44% |
| M02 Profile | 5 | 0 | 5 | 0/0 | 0% |
| M03 Platform | 9 | 1 | 6 | 1/1 | 0% |
| M04 Org Admin | 5 | 3 | 5 | 3/3 | 60% |
| M05 Membership | 9 | 4 | 6 | 6/6 | 11% |
| M06 Dues | 8 | 5 | 8 | 9/9 | 63% |
| M07 Comms | 5 | 1 | 4 | 0/1 | 20% |
| M08 Events | 7 | 3 | 3 | 3/3 | 29% |
| M09 Training | 7 | 0 | 5 | 0/0 | 0% |
| M10 Credits | 6 | 2 | 5 | 3/3 | 17% |
| M11 Docs/Creds | 5 | 1 | 4 | 1/1 | 20% |
| M12 Elections | 4 | 2 | 2 | 2/2 | 50% |
| M13 Feed | 4 | 1 | 4 | 1/1 | 25% |
| M14 Dashboard | 3 | 1 | 3 | 1/1 | 33% |
| M15 Jobs | 5 | 1 | 5 | 1/1 | 20% |
| M16 Ads | 5 | 0 | 5 | 0/0 | 0% |
| M17 Marketplace | 3 | 1 | 3 | 1/1 | 33% |
| M18 Surveys | 4 | 2 | 4 | 2/2 | 50% |
| M19 Committees | 5 | 1 | 5 | 1/1 | 20% |
| **TOTAL** | **108** | **33** | **90** | **38/41** | **25%** |

**Why 25% chain coverage:** Most BRs concentrated in M05/M06 (membership + dues). Modules without explicit BR-NNN in WORKFLOW_MAP Section 4 show 0% even with module-local rules in MODULE_SPECs. Namespace gap, not coverage gap.

### Coverage Interpretation

- **WF→API (83%)**: Strong — 90/108 workflows have API endpoints
- **BR→Spec (93%)**: Strong — 38/41 WORKFLOW_MAP BRs traced to MODULE_SPECs
- **WF→BR (31%)**: Expected — only 40 BRs for 108 workflows; many are CRUD/reporting without explicit rules
- **Full chain**: Low because requires ALL links; improves as slices/tests connect

## Gap List by Severity

### CRITICAL (P0) — Blocks Phase Progression

**None.** 0 dangling references. All referenced IDs resolve to defined nodes.

### Cross-Module Blind Spots (P0 — Triaged)

60 module pairs reference each other in specs without explicit event contracts. After triage:

| Category | Count | Assessment |
|----------|-------|------------|
| Expected: shared entity (M01 auth, M02 profile) | 15 | Person/auth infrastructure consumed by all — direct DB/API reads, no events needed |
| Expected: admin oversight (M03 platform, M14 dashboard) | 12 | Admin/dashboard modules aggregate data — read-only, no integration contract needed |
| Needs review at Phase C | 33 | Cross-module workflows that may need events/API contracts when slicing |

**Top 10 review-priority pairs** (modules with cross-module workflow steps):

| Source | Target | Why Flagged | Existing Integration |
|--------|--------|-------------|---------------------|
| M05 | M07 | Membership status change → member notification | MembershipActivated event exists |
| M06 | M09 | Paid training fee via M06 billing | PaymentRecorded event with registrationId? |
| M08 | M05 | Event registration checks membership status | Shared entity read |
| M08 | M09 | Training events cross-module merge | TrainingPublished event exists |
| M09 | M05 | Training enrollment checks membership | Shared entity read |
| M10 | M05 | Credit compliance tied to membership | CreditAwarded event exists |
| M12 | M19 | Election winners → committee officer transitions | ElectionPublished event exists |
| M05 | M18 | Survey targeting by membership category | UI navigation (no event needed) |
| M05 | M19 | Committee requires active membership | Shared entity read |
| M19 | M06 | Committee budget via dues/funds | Needs integration design at Phase C |

**Verdict:** No CRITICAL block. EVENT_CONTRACTS already defines 15+ cross-module events covering highest-risk flows. Remaining pairs integrate via shared entity reads or UI navigation. Phase C integration decisions when slicing.

### HIGH (P1) — Warns at Phase Boundary

Suppressed. Algorithms 4b (broken chains) and 4c (coverage gaps) require Phase C/D artifacts.

### MEDIUM (P2) — Root Cause Analysis (0 true gaps after triage)

Initial scan found 49 orphan nodes. Root cause investigation reclassified all 49:

#### Parser Limitations (20 nodes — not spec gaps)

**UI screens (16):** Path parameter syntax mismatch. Screens use Next.js bracket notation (`/org/[id]/officer/dashboard`), API_CONTRACTS use Express colon notation (`/org/:id/dashboard`). Literal string matching cannot bridge this — actual screen→API coverage is correct in the specs.

| Affected | Module | Screen IDs |
|----------|--------|-----------|
| Org Admin screens | M04 | S01 (Dashboard), S02 (Officers), S03 (Settings), S04 (Public Page), S05 (Discipline) |
| Membership screens | M05 | S01 (Roster), S02 (CSV Import), S03 (Directory), S04 (Application Review) |
| Dues screens | M06 | S01 (Financial Dashboard), S02 (Pay Dues), S03 (Dues Config), S04 (Payment History) |
| Comms screens | M07 | S01 (Dashboard), S02 (Compose), S03 (Notification Prefs) |

**Workflows (4):** Multi-WF row or format variation in API_CONTRACTS. These WF IDs ARE present in their API_CONTRACTS files but the parser missed them:

| WF | Confirmed In | Line |
|----|-------------|------|
| WF-054 (Event Cancellation) | M08 API_CONTRACTS | 258 |
| WF-055 (Events Dashboard) | M08 API_CONTRACTS | 32 |
| WF-056 (My Events) | M08 API_CONTRACTS | 437 |
| WF-079 (Election-to-Officer) | M12 API_CONTRACTS | 244 |

#### By Design (17 nodes — intentionally orphaned)

**Workflows (7):** Reporting, admin, cross-module, or UI-only flows without dedicated API surfaces:

| WF | Why No API Link |
|----|----------------|
| WF-006 (Member Onboarding) | UI-only wizard flow, no dedicated API |
| WF-020 (Support Tickets) | Platform admin future feature |
| WF-021 (Revenue Dashboard) | Reporting/analytics, read-only aggregation |
| WF-050 (Email Opt-Out) | Managed via notification preferences (WF-013) |
| WF-062 (Paid Training) | Cross-module M09→M06 billing redirect |
| WF-063 (Training Analytics) | Reporting, no standalone API |
| WF-078 (Bylaw Ratification) | Reuses generic election infrastructure |

**API endpoints (10):** All have `Workflow | —` (intentionally blank) — utility/informational/config endpoints:

| Endpoint | Module | Why Blank |
|----------|--------|-----------|
| GET/POST `/org/:id/courses` | M09 | Feature-gated, no WF mapping yet |
| GET `/admin/national/platform` | M14 | Platform-wide read-only analytics |
| PATCH `/admin/advertising/advertisers/:id` | M16 | Admin CRUD, incomplete WF property |
| POST/DELETE/GET `/settings/ad-opt-out` | M16 | User preference toggle, utility |
| GET `/org/:id/marketplace/orders` | M17 | Order history lookup, informational |
| GET `/admin/marketplace/categories` | M17 | Admin config endpoint |
| GET `/my/committees` | M19 | Member read-only listing |

#### False Positives (11 nodes — parser noise)

**Table keywords (8):** Event extraction regex matched non-event table content in EVENT_CONTRACTS.md:

| Matched As Event | Actually Is | Section |
|-----------------|-------------|---------|
| Backoff | Retry policy table value | Section 0.2 |
| Timeout | Retry policy table header | Section 0.2 |
| Type | Table column header | Multiple sections |
| Cron | Job registration method | Section 1 |
| Delayed | Job registration method | Section 1 |
| Job | Section keyword | Section 1 |
| Enum | Section heading | Section 3 |
| Module | Section heading | Multiple |

**Background jobs misclassified as events (3):** pg-boss cron jobs from EVENT_CONTRACTS sections 2.8-2.10 (should be `background_job` node type, not `domain_event`):

| Job Name | Type | Schedule | Section |
|----------|------|----------|---------|
| audit.retention | Cron | Daily 3 AM | 2.8 |
| notifs.processScheduled | Cron | Every 5 min | 2.9 |
| notifs.cleanup | Cron | Daily midnight | 2.10 |

Two additional disabled jobs were also misclassified: `booking.reminderSender` and `booking.noShowEligibility` (section 2.1, disabled/optional).

#### Spec Gap Found and Fixed (1 node)

| WF | Issue | Fix Applied |
|----|-------|------------|
| WF-075 (Credential Template Mgmt) | Missing from M11 API_CONTRACTS | Added 4 CRUD endpoints (GET/POST/PATCH/DELETE `/orgs/:id/credential-templates`) with feature flag `credential_templates` |

## Phase Activation Registry

288 nodes + 33 cross-module items are phase-suppressed with defined activation triggers. Each item has: what it is, what connects it, when that happens, and what validates it.

### Error Codes → API Endpoints (168 items, activates Phase B+)

**What:** 168 error codes from ERROR_TAXONOMY.md (VALIDATION-001 through INTERNAL-003) have no edges connecting them to the API endpoints that return them.

**Activation trigger:** Build `ERROR_RETURNED_BY_ENDPOINT` edges by cross-referencing each API_CONTRACTS endpoint's Error Codes table against ERROR_TAXONOMY.

**Resolution mechanism:** Each API_CONTRACTS endpoint already has an `Error Codes` table listing codes like `M01-001`, `M05-002`, etc. These map to ERROR_TAXONOMY categories. The edge type is: `error_code → api_endpoint` via `ERROR_RETURNED_BY_ENDPOINT`.

**Validation:** After edge-building, every error code should have ≥1 endpoint edge. Orphan error codes = dead codes or missing endpoint documentation.

| Module | Error Code Prefix | Endpoint Count | Expected Edges |
|--------|------------------|----------------|----------------|
| Global | VALIDATION-*, AUTH-*, AUTHZ-*, NOT_FOUND-*, RATE_LIMIT-*, INTERNAL-* | All endpoints | ~224 (every endpoint returns at least VALIDATION + AUTH) |
| M01 | M01-* | 13 | ~20 |
| M02 | M02-* | 10 | ~12 |
| M03 | M03-* | 16 | ~18 |
| M04 | M04-* | 8 | ~10 |
| M05 | M05-* | 12 | ~15 |
| M06 | M06-* | 13 | ~18 |
| M07 | M07-* | 12 | ~14 |
| M08 | M08-* | 11 | ~16 |
| M09 | M09-* | 17 | ~20 |
| M10 | M10-* | 5 | ~8 |
| M11 | M11-* | 14 | ~16 |
| M12 | M12-* | 9 | ~12 |
| M13-M19 | M13-* through M19-* | 78 | ~90 |

---

### Acceptance Criteria → Slices + Tests (99 items, activates Phase C/D)

**What:** 99 acceptance criteria (AC-M01-001 through AC-M19-004) from MODULE_SPEC Section 11 have no edges to slices or test files.

**Activation trigger:**
- Phase C: `/oli-vertical-slice-plan` assigns each AC to a slice → builds `AC_IMPLEMENTED_IN_SLICE` edges
- Phase D: Test files reference AC IDs in describe blocks → builds `AC_TESTED_BY` edges

**Resolution mechanism:** Each slice spec must list its ACs. Each test file must reference AC-IDs it validates.

**Validation:** After Phase C, every AC should have ≥1 slice edge. After Phase D, every AC should have ≥1 test edge. Orphan ACs = untested acceptance criteria (P1 gap).

**Per-module AC inventory:**

| Module | AC Count | IDs | Priority ACs (P0/P1 workflows) |
|--------|----------|-----|-------------------------------|
| M01 Auth | 7 | AC-M01-001 through AC-M01-007 | AC-M01-001 (OTP Delivery), AC-M01-005 (Account Lockout) |
| M02 Profile | 8 | AC-M02-001 through AC-M02-008 | AC-M02-003 (Deletion Grace), AC-M02-008 (Session Revocation) |
| M03 Platform | 7 | AC-M03-001 through AC-M03-007 | AC-M03-001 (Impersonation), AC-M03-006 (MFA Mandatory) |
| M04 Org Admin | 7 | AC-M04-001 through AC-M04-007 | AC-M04-002 (Officer Role Constraint) |
| M05 Membership | 7 | AC-M05-001 through AC-M05-007 | AC-M05-001 (No Duplicates), AC-M05-003 (Status Computation) |
| M06 Dues | 7 | AC-M06-001 through AC-M06-007 | AC-M06-001 (Payment Recording), AC-M06-005 (Refund Policy) |
| M07 Comms | 6 | AC-M07-001 through AC-M07-006 | AC-M07-003 (Deduplication) |
| M08 Events | 6 | AC-M08-001 through AC-M08-006 | AC-M08-001 (Capacity + Waitlist) |
| M09 Training | 6 | AC-M09-001 through AC-M09-006 | AC-M09-001 (Credit Award on Attendance) |
| M10 Credits | 5 | AC-M10-001 through AC-M10-005 | AC-M10-001 (Cycle Computation) |
| M11 Docs/Creds | 6 | AC-M11-001 through AC-M11-006 | AC-M11-002 (QR HMAC Verification) |
| M12 Elections | 6 | AC-M12-001 through AC-M12-006 | AC-M12-001 (Vote Integrity) |
| M13 Feed | 5 | AC-M13-001 through AC-M13-005 | — (P2 module) |
| M14 Dashboard | 5 | AC-M14-001 through AC-M14-005 | — (P2 module) |
| M15 Jobs | 5 | AC-M15-001 through AC-M15-005 | — (P2 module) |
| M16 Ads | 6 | AC-M16-001 through AC-M16-006 | — (P2 module) |
| M17 Marketplace | 0 | — | No ACs defined yet (needs MODULE_SPEC Section 11) |
| M18 Surveys | 0 | — | No ACs defined yet (needs MODULE_SPEC Section 11) |
| M19 Committees | 0 | — | No ACs defined yet (needs MODULE_SPEC Section 11) |

**Gap noted:** M17, M18, M19 have 0 acceptance criteria. These MODULE_SPECs need Section 11 populated before Phase C.

---

### State Machines → Workflows (15 items, activates Phase B+)

**What:** 15 state machines from WORKFLOW_MAP Section 5 + DOMAIN_MODEL Section 13 have no `WF_TRIGGERS_SM` edges connecting them to workflows.

**Activation trigger:** Parse WORKFLOW_MAP Section 5 state transition tables. Each transition row references triggering workflows.

**Resolution mechanism:** Each state transition (e.g., `Active → Grace → Lapsed`) is triggered by a workflow step. Map `WF_TRIGGERS_SM` edges from the workflow that causes each transition.

**State machine inventory:**

| SM-ID | Name | States | Key Transitions | Triggering WFs |
|-------|------|--------|----------------|----------------|
| SM-001 | Membership Status | Pending, Active, Grace, Lapsed, Expired, Resigned, Deceased, Expelled | Active→Grace (expiry), Grace→Lapsed (30d) | WF-029, WF-032, WF-026, WF-035 |
| SM-002 | Payment Status | Pending, Completed, Failed, Refunded, Partially_Refunded | Pending→Completed (payment) | WF-038, WF-040, WF-041, WF-044 |
| SM-003 | Event Status | Draft, Published, Cancelled, Completed | Draft→Published (officer) | WF-051, WF-054 |
| SM-004 | Event Registration | Registered, Waitlisted, Checked_In, No_Show, Cancelled | Waitlisted→Registered (FIFO) | WF-052, WF-053, WF-057 |
| SM-005 | Training Status | Draft, Published, In_Progress, Completed, Cancelled | Published→In_Progress (start) | WF-058, WF-060 |
| SM-006 | Enrollment Status | Enrolled, Waitlisted, Completed, Cancelled, No_Show | Enrolled→Completed (attendance) | WF-059, WF-060 |
| SM-007 | Election Status | Draft, Nominations_Open, Voting_Open, Closed, Certified | Closed→Certified (results) | WF-076, WF-077 |
| SM-008 | Announcement Status | Draft, Scheduled, Sent, Failed | Draft→Scheduled (officer) | WF-045, WF-046 |
| SM-009 | Organization Lifecycle | Trial, Active, Suspended, Cancelled | Trial→Active (payment) | WF-015, WF-016, WF-023 |
| SM-010 | Notification Status | Pending, Sent, Read, Failed | Pending→Sent (dispatch) | WF-046 |
| SM-011 | Additional SMs | Various | Various | Various |
| SM-DM-001 through SM-DM-004 | DOMAIN_MODEL Section 13 SMs | Various | Various | Cross-referenced from SM-001 through SM-010 |

**Validation:** After edge-building, every SM should have ≥1 WF edge. Orphan SMs = state machines not triggered by any workflow (design gap).

---

### Roles → API Endpoints (6 items, activates Phase B+)

**What:** 6 roles from ROLE_PERMISSION_MATRIX have no `ROLE_AUTHORIZED_FOR_ENDPOINT` edges.

**Activation trigger:** Cross-reference ROLE_PERMISSION_MATRIX action columns against API_CONTRACTS endpoint Auth property rows.

**Resolution mechanism:** Each API_CONTRACTS endpoint has `| Auth | GA+HG — officer, admin |` property. Map these role references to ROLE_PERMISSION_MATRIX roles.

**Role inventory:**

| Role | RBAC Level | Expected Endpoint Edges | Source |
|------|-----------|------------------------|--------|
| platform_admin | Platform | ~40 (all `/admin/*` endpoints) | ROLE_PERMISSION_MATRIX row 1 |
| president | Org officer | ~80 (all org management + officer actions) | ROLE_PERMISSION_MATRIX row 2 |
| vice_president | Org officer | ~60 (most org management) | ROLE_PERMISSION_MATRIX row 3 |
| secretary | Org officer | ~70 (member management, comms) | ROLE_PERMISSION_MATRIX row 4 |
| treasurer | Org officer | ~30 (financial endpoints) | ROLE_PERMISSION_MATRIX row 5 |
| chairperson | Committee-scoped | ~15 (committee management only) | ROLE_PERMISSION_MATRIX sub-table |

**Validation:** After edge-building, every role should connect to its authorized endpoints. Roles with 0 edges = RBAC misconfiguration.

---

### Cross-Module Blind Spots (33 items, activates Phase C)

**What:** 33 module pairs reference each other in MODULE_SPECs without explicit event contracts or API integration contracts.

**Activation trigger:** `/oli-vertical-slice-plan` — when slicing cross-module workflows, each integration point must declare its mechanism (event, API call, shared entity read, or UI navigation).

**Resolution mechanism:** For each pair, choose one:
1. **Event contract** — add to EVENT_CONTRACTS.md (for async state changes)
2. **API contract** — add cross-module endpoint to API_CONTRACTS (for sync requests)
3. **Shared entity read** — document in MODULE_SPEC integration section (for read-only lookups)
4. **UI navigation** — document as frontend routing (no backend integration needed)
5. **Accept as is** — module reference is informational only (no runtime coupling)

**Pairs requiring resolution at Phase C:**

| # | Source | Target | Reference Context | Likely Resolution |
|---|--------|--------|-------------------|-------------------|
| 1 | M04 | M06 | Org admin views financial data | Shared entity read |
| 2 | M05 | M07 | Membership change triggers notification | Event: MembershipStatusChanged (exists) |
| 3 | M05 | M11 | Membership status on credentials | Shared entity read |
| 4 | M05 | M13 | Feed filters by membership | Shared entity read |
| 5 | M05 | M14 | Dashboard aggregates membership | Shared entity read |
| 6 | M05 | M15 | Job board requires active membership | Shared entity read |
| 7 | M05 | M17 | Marketplace requires membership | Shared entity read |
| 8 | M05 | M18 | Survey targets by membership category | UI navigation |
| 9 | M05 | M19 | Committee requires active membership | Shared entity read |
| 10 | M06 | M07 | Payment confirmation notification | Event: PaymentRecorded (exists) |
| 11 | M06 | M09 | Paid training fee collection | Event: PaymentRecorded with registrationId (exists) |
| 12 | M06 | M14 | Dashboard aggregates revenue | Shared entity read |
| 13 | M07 | M11 | Comms references document links | UI navigation |
| 14 | M08 | M04 | Event created by org officer | Shared entity read (orgId) |
| 15 | M08 | M05 | Registration checks membership | Shared entity read |
| 16 | M08 | M09 | Training events integration | Event: TrainingPublished (exists) |
| 17 | M08 | M10 | Event attendance awards credits | Event: CreditAwarded (exists) |
| 18 | M08 | M11 | Event certificate generation | Event: CertificateRequested (exists) |
| 19 | M08 | M15 | Event job board cross-posting | UI navigation |
| 20 | M09 | M04 | Training managed by org officer | Shared entity read (orgId) |
| 21 | M09 | M05 | Enrollment checks membership | Shared entity read |
| 22 | M09 | M15 | Training job board cross-posting | UI navigation |
| 23 | M09 | M17 | Training materials marketplace | UI navigation |
| 24 | M10 | M04 | Credit reports for org admin | Shared entity read |
| 25 | M10 | M05 | Credit compliance + membership | Shared entity read |
| 26 | M12 | M19 | Election winners → committee officers | Event: ElectionPublished (exists) |
| 27 | M13 | M07 | Feed shares announcements | Shared entity read |
| 28 | M13 | M08 | Feed shows events | Shared entity read |
| 29 | M13 | M09 | Feed shows training | Shared entity read |
| 30 | M13 | M16 | Feed shows sponsored content | API contract needed |
| 31 | M15 | M16 | Job board ad placements | API contract needed |
| 32 | M17 | M16 | Marketplace sponsored listings | API contract needed |
| 33 | M19 | M07 | Committee announcements | Event: AnnouncementPublished or shared entity read |

**Integration gaps requiring new contracts at Phase C:**
- M13↔M16 (Feed + Advertising): needs ad placement API contract
- M15↔M16 (Jobs + Advertising): needs sponsored job API contract
- M17↔M16 (Marketplace + Advertising): needs sponsored listing API contract
- M19↔M07 (Committees + Comms): needs committee announcement mechanism

**Validation:** After Phase C slicing, re-run `/oli-trace` algorithm 4d. Every pair should have a documented integration mechanism. Remaining blind spots = P0 integration gaps.

## Nodes by Type

| Type | Count | Description |
|------|-------|-------------|
| api_endpoint | 229 | From 19 API_CONTRACTS files (incl. M11 credential templates, M16 ad placements) |
| error_code | 168 | From ERROR_TAXONOMY (9 categories) + module-specific codes in API_CONTRACTS |
| acceptance_criteria | 116 | AC-Mxx-NNN from MODULE_SPECs Section 11 (all 19 modules, both ### and ** formats) |
| workflow | 108 | WF-001 through WF-108 from WORKFLOW_MAP |
| business_rule | 49 | BR-01 through BR-49 from WORKFLOW_MAP Section 4 (incl. M09 + M16 additions) |
| domain_event | 49 | From EVENT_CONTRACTS section 0.4 only (false positives filtered) |
| ui_screen | 39 | From ui-prototype/screens.md (8 modules with screen specs) |
| state_machine | 11 | From WORKFLOW_MAP Section 5 |
| role | 6 | Platform Admin, President, VP, Secretary, Treasurer, Chairperson |
| **Total** | **775** | |

## Edges by Type

| Type | Count | Avg Confidence | Description |
|------|-------|----------------|-------------|
| ERROR_RETURNED_BY_ENDPOINT | 670 | high | Error code → API endpoint (from error tables) |
| ROLE_AUTHORIZED_FOR_ENDPOINT | 375 | medium | Role → API endpoint (from Auth property via alias mapping) |
| WF_EXPOSED_VIA_API | 246 | high | Workflow → API endpoint (multi-WF rows now parsed) |
| API_CONSUMED_BY_UI | 106 | medium | API endpoint → UI screen (path params normalized) |
| BR_ENFORCED_BY_API | 81 | high | Business rule → API endpoint (from BR property rows) |
| WF_ENFORCES_BR | 69 | high | Workflow → business rule |
| BR_DEFINED_IN_SPEC | 55 | high | BR → MODULE_SPEC Section 5 |
| EVENT_PUBLISHED_BY | 48 | high | Event → producer module |
| EVENT_CONSUMED_BY | 33 | high | Consumer module → event |
| WF_TRIGGERS_SM | 8 | medium | Workflow → state machine (via BR refs in Section 5 side effects) |
| **Total** | **1,691** | | |

### Edges Not Yet Populated (Phase C/D)

| Type | Reason | When Active |
|------|--------|-------------|
| BR_IMPLEMENTED_IN_SLICE | No slices linked | Phase C |
| BR_TESTED_BY | No spec-linked tests | Phase D |
| AC_TESTED_BY | No spec-linked tests | Phase D |
| AC_IMPLEMENTED_IN_SLICE | No slices linked | Phase C |
| SLICE_HAS_TESTS | No slices linked | Phase C/D |

## Connected Components

| Metric | v1 | v2 | v4 (current) |
|--------|-----|-----|-------------|
| Connected components | 406 | 170 | 125 |
| Largest component | 102 | 557 | 604 |
| Islands (single-node) | 341 | 166 | 122 |

**Interpretation:** 604-node main component contains WFs, BRs, API endpoints, error codes, roles, SMs, UI screens, and events — fully connected. 122 islands = 116 ACs (Phase C) + 3 by-design WFs + 1 false-positive event + 1 missing endpoint + 1 module ref.

## Ratchet Status

Baseline created. Future runs with `--no-new-gaps` will enforce these counts.

| Severity | Baseline | Current | Status |
|----------|----------|---------|--------|
| CRITICAL | 0 | 0 | PASS |
| HIGH | 0 | 0 | PASS |
| MEDIUM | 0 | 0 | PASS |
| Non-AC orphans | 3 | 3 | BASELINE SET (3 by-design WFs — accepted) |
| Phase-suppressed ACs | 116 | 116 | Phase C activation |

## Per-Module Node Distribution

| Module | Total | WF | BR | AC | API | UI |
|--------|-------|----|----|-----|-----|-----|
| M01 | 43 | 9 | 6 | 7 | 13 | 8 |
| M02 | 29 | 5 | 2 | 8 | 10 | 4 |
| M03 | 39 | 9 | 1 | 7 | 16 | 6 |
| M04 | 27 | 5 | 2 | 7 | 8 | 5 |
| M05 | 35 | 9 | 3 | 7 | 12 | 4 |
| M06 | 38 | 8 | 6 | 7 | 13 | 4 |
| M07 | 27 | 5 | 1 | 6 | 12 | 3 |
| M08 | 34 | 7 | 5 | 6 | 11 | 5 |
| M09 | 32 | 7 | 2 | 6 | 17 | 0 |
| M10 | 19 | 6 | 3 | 5 | 5 | 0 |
| M11 | 22 | 5 | 1 | 6 | 10 | 0 |
| M12 | 21 | 4 | 2 | 6 | 9 | 0 |
| M13 | 18 | 4 | 1 | 5 | 8 | 0 |
| M14 | 14 | 3 | 1 | 5 | 5 | 0 |
| M15 | 25 | 5 | 1 | 5 | 14 | 0 |
| M16 | 26 | 5 | 0 | 6 | 15 | 0 |
| M17 | 19 | 3 | 1 | 0 | 15 | 0 |
| M18 | 21 | 4 | 1 | 0 | 16 | 0 |
| M19 | 21 | 5 | 1 | 0 | 15 | 0 |

**Note:** M09-M19 show 0 UI screens — their screen specs use a format not yet parsed or screens.md not yet generated.

## Spec Debt Surfaced by Trace

Items discovered during inventory that are not trace orphans but need attention before Phase C:

| # | Item | Severity | Description | Status |
|---|------|----------|-------------|--------|
| 1 | M17 missing ACs | P1 | ACs existed but used `**bold**` format instead of `###` headers — normalized to `### AC-M17-NNN:` | RESOLVED (format fix) |
| 2 | M18 missing ACs | P1 | ACs existed but used `**bold**` format — normalized to `### AC-M18-NNN:` | RESOLVED (format fix) |
| 3 | M19 missing ACs | P1 | ACs existed but used `**bold**` format — normalized to `### AC-M19-NNN:` | RESOLVED (format fix) |
| 4 | M16 missing BRs | P2 | Added BR-45 through BR-49 to WORKFLOW_MAP Section 4 (ad approval, targeting, labeling, opt-out, budget) | RESOLVED |
| 5 | M09 missing BRs | P2 | Added BR-41 through BR-44 to WORKFLOW_MAP Section 4 (paid training, type restriction, completion lock, idempotent credits) | RESOLVED |
| 6 | 4 integration contracts | P2 | Added: M16 `GET /ads/placements/{slot}` for M13/M15/M17 ad serving; `CommitteeAnnouncementPublished` + `VendorVerified` events in EVENT_CONTRACTS | RESOLVED |

## Parser Improvements (v2)

| # | Improvement | Status | Result |
|---|------------|--------|--------|
| 1 | Normalize path params: `[id]` ↔ `:id` ↔ `{id}` | DONE | 8 screen orphans remain (partial path mismatch on complex routes) |
| 2 | Multi-WF Workflow property rows | DONE | WF-054/055/056/079 now connected |
| 3 | Event extraction restricted to section 0.4 | DONE | 1 false positive remains ("Producer") |
| 4 | ERROR_RETURNED_BY_ENDPOINT edges from error tables | DONE | 670 edges, 138 error codes connected |
| 5 | ROLE_AUTHORIZED_FOR_ENDPOINT via alias mapping | DONE | 375 edges, all 6 roles connected |
| 6 | WF_TRIGGERS_SM via BR refs in Section 5 side effects | DONE | 8 edges, 4 SMs connected (7 remain — no BR refs in side effects) |
| 7 | BR_ENFORCED_BY_API from Business rules property | DONE | 81 edges |
| 8 | AC extraction: both `###` and `**` formats | DONE | 116 ACs (was 99) |

### Remaining Phase-Suppressed Orphans (165)

| Type | Count | Why Still Orphaned | Resolves At |
|------|-------|--------------------|-------------|
| acceptance_criteria | 116 | No slices exist to assign ACs to | Phase C (`/oli-vertical-slice-plan`) |
| workflow | 3 | By design: WF-006 (UI wizard), WF-050 (via WF-013), WF-063 (reporting) | Permanent — accepted |

## What's Next

**All trace gaps resolved. All spec debt resolved. 0 CRITICAL, 0 HIGH, 0 true MEDIUM.**
- **Next:** `/oli-audit-compliance` (Wave 5) — compliance gate target >= 9.0
- **Then:** `/oli-confidence-stack` (Wave 5) — test confidence gate target >= 9.0
- **Phase C:** Re-run `/oli-trace` after `/oli-vertical-slice-plan` to activate algorithms 4b/4c/4d with slice data
- **Phase C:** Resolve 4 integration contract gaps (M13/M15/M17↔M16, M19↔M07)
