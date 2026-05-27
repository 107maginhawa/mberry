# Traceability Report

**Generated:** 2026-05-27
**Scope:** Full -- all 19 modules, all spec artifacts
**Branch:** audit/codebase-improvements

---

## Data Sources

| Artifact | Path | Status |
|----------|------|--------|
| WORKFLOW_MAP.md | `docs/product/WORKFLOW_MAP.md` | Loaded -- 114 WFs, 49 BRs, 22 state machines |
| DOMAIN_MODEL.md | `docs/product/DOMAIN_MODEL.md` | Loaded -- 13 bounded contexts, 4 explicit state machines |
| EVENT_CONTRACTS.md | `docs/product/EVENT_CONTRACTS.md` | Loaded -- 10 job contracts, 8 async flows |
| ROLE_PERMISSION_MATRIX.md | `docs/product/ROLE_PERMISSION_MATRIX.md` | Loaded -- 9 roles, 28 module permission tables |
| MODULE_SPEC.md (x19) | `docs/product/modules/m{01-19}/MODULE_SPEC.md` | All 19 loaded |
| API_CONTRACTS.md (x19) | `docs/product/modules/m{01-19}/API_CONTRACTS.md` | All 19 loaded |
| ENFORCEMENT_REPORT.md | `docs/audits/ENFORCEMENT_REPORT.md` | Loaded -- enrichment source |
| br-registry.json | `services/api-ts/br-registry.json` | Not found |
| Test files (backend) | `services/api-ts/src/**/*.test.*` | 536 test files found |
| Test files (frontend) | `apps/**/*.test.*` | 244 test files found (224 memberry, 20 admin) |

---

## Graph Statistics

### Node Counts by Type

| Node Type | Count |
|-----------|-------|
| Workflows (WF-NNN) | 114 |
| Business Rules (BR-NNN) | 49 |
| Acceptance Criteria (AC-MNN-NNN) | 127 (from MODULE_SPECs) |
| State Machines (WORKFLOW_MAP 5.x) | 22 (11 primary + 11 additional) |
| State Machines (DOMAIN_MODEL explicit) | 4 (org lifecycle, membership officer, membership computed, election) |
| Domain Events / Jobs | 10 job contracts + ~50 event types |
| API Endpoints (from API_CONTRACTS) | 136 total |
| Roles | 9 (super_admin, org_admin, chapter_admin, officer, member, guest, employer, vendor, national_admin) |
| Test Files (backend) | 536 |
| Test Files (frontend) | 244 |
| **Total Nodes** | **~1,291** |

### Edge Counts by Type

| Edge Type | Count | Notes |
|-----------|-------|-------|
| WF_ENFORCES_BR | 73 | All 49 BRs mapped to at least 1 WF (some multi-WF) |
| BR_DEFINED_IN_SPEC | 38 unique BRs across 18 MODULE_SPECs | 11 BRs missing from specs |
| BR_TESTED_BY | 43 unique BRs tested | 6 BRs untested |
| AC_DEFINED_IN_SPEC | 127 ACs across 19 modules | -- |
| AC_TESTED_BY | 116 ACs tested | 11 ACs untested |
| WF_IN_MODULE_SPEC | 114 WFs across 19 MODULE_SPECs | Full coverage |
| ROLE_AUTHORIZED_FOR_ENDPOINT | ~280+ | 28 module permission tables |
| **Total Edges** | **~800+** |

### Connected Components

- **Main component:** All 19 modules interconnected via cross-module BR references and shared person/org entities
- **Isolated nodes:** 0 -- all WFs, BRs, and ACs connect to at least one module
- **Cross-module flows:** 8 explicit flows documented (registration, dues, training, events, elections, deletion, booking, comms)

---

## Coverage Matrix

### Per-Module Workflow Chain Completeness

| Module | WFs | BRs Linked | BRs in Spec | BRs Tested | ACs in Spec | ACs Tested | API Endpoints | Test Files | Chain % |
|--------|-----|-----------|-------------|------------|-------------|------------|---------------|------------|---------|
| M01 Auth & Onboarding | 9 | BR-21,22,23,24,25,26 | 4 (22,23,25,26) | 6/6 | 7 | 7/7 | 11 | 30 (person) | 83% |
| M02 Member Profile | 5 | BR-01,18,21,23,31,32 | 6 (01,18,21,23,31,32) | 6/6 | 8 | 8/8 | 8 | 30 (person) | 100% |
| M03 Platform Admin | 9 | BR-10,30 | 2 (10,30) | 2/2 | 7 | 7/7 | 9 | 28 | 100% |
| M04 Org Admin | 5 | BR-09,29,31 | 3 (09,29,31) | 3/3 | 7 | 7/7 | 8 | 81 (assoc:member) | 100% |
| M05 Membership | 9 | BR-01,02,03,04,21,22,23 | 7 (01,02,03,04,21,22,23) | 7/7 | 7 | 7/7 | 8 | 25 | 100% |
| M06 Dues & Payments | 8 | BR-01,04,05,06,07,08,30,32 | 8 (01,04,05,06,07,08,30,32) | 8/8 | 7 | **0/7** | 8 | 15 | **57%** |
| M07 Communications | 5 | BR-26,28 | 1 (26) | 2/2 | 6 | 6/6 | 9 | 41 | 83% |
| M08 Events | 7 | BR-03,15,16,17,18,27 | 6 (03,15,16,17,18,27) | 6/6 | 6 | 6/6 | 8 | 25 | 100% |
| M09 Training | 7 | BR-11,13,15,17,20,41,42,43,44 | 5 (11,13,15,17,20) | 5/9 | 6 | **5/6** | 7 | 22 | **67%** |
| M10 Credit Tracking | 6 | BR-11,12,13,14 | 4 (11,12,13,14) | 4/4 | 5 | 5/5 | 5 | 22 (training) | 100% |
| M11 Docs & Credentials | 5 | BR-18,19,20 | 3 (18,19,20) | 3/3 | 6 | 6/6 | 8 | 22+12 | 100% |
| M12 Elections & Governance | 4 | BR-33,34 | 2 (33,34) | 2/2 | 6 | 6/6 | 7 | 17 | 100% |
| M13 Professional Feed | 4 | BR-35 | 1 (35) | 1/1 | 5 | 5/5 | 3 | 41 (comm) | 100% |
| M14 National Dashboard | 3 | BR-36 | 1 (36) | 1/1 | 5 | 5/5 | 5 | 21 (assoc:ops) | 100% |
| M15 Job Board | 5 | BR-37 | 1 (37) | 1/1 | 5 | 5/5 | 6 | 7 (jobs) | 100% |
| M16 Advertising | 5 | BR-45,46,47,48,49 | **0** | 1/5 | 6 | 6/6 | 7 | 7 | **33%** |
| M17 Marketplace | 3 | BR-38 | 1 (38) | 1/1 | 5 | 5/5 | 5 | 3 | 100% |
| M18 Surveys & Polls | 4 | BR-40 | 1 (40) | 1/1 | 6 | **3/6** | 4 | 15 | **75%** |
| M19 Committee Mgmt | 5 | BR-39 | 1 (39) | 1/1 | 6 | 6/6 | 5 | 21 (assoc:ops) | 100% |

### Cross-Cutting Workflows (WF-109 to WF-114)

| WF-ID | Description | BRs | Tested |
|-------|-------------|-----|--------|
| WF-109 | Notifications delivery | -- | 8 test files (notifs/) |
| WF-110 | Email transactional queue | -- | 18 test files (email/) |
| WF-111 | Audit trail logging | -- | 4 test files (audit/) |
| WF-112 | File storage (S3/MinIO) | BR-31 | 4 test files (storage/) |
| WF-113 | Certificate generation | BR-20 | 12 test files (certificates/) |
| WF-114 | Review/NPS system | -- | 5 test files (reviews/) |

---

## Gap Analysis

### P0 -- Critical (Cross-Module Blind Spots + Dangling References)

| ID | Type | Description | Impact | Fix |
|----|------|-------------|--------|-----|
| P0-01 | Cross-Module Blind Spot | M16 Advertising has 0 BRs in MODULE_SPEC despite WORKFLOW_MAP defining 5 (BR-45 to BR-49) | Spec-to-impl chain completely broken for advertising safety rules | Add BR-45..49 to m16 MODULE_SPEC |
| P0-02 | Dangling Reference | BR-24 (Invitation expiry) in WORKFLOW_MAP but absent from all MODULE_SPECs | Rule exists in spec registry but no module claims it | Add BR-24 to m01-auth-onboarding MODULE_SPEC |
| P0-03 | Dangling Reference | BR-28 (Communication deduplication) in WORKFLOW_MAP but absent from all MODULE_SPECs | Dedup rule has no module ownership | Add BR-28 to m07-communications MODULE_SPEC |
| P0-04 | Dangling Reference | BR-41,42,43,44 (Training enforcement rules) in WORKFLOW_MAP but absent from m09 MODULE_SPEC | 4 training safety rules have no spec home | Add BR-41..44 to m09-training MODULE_SPEC |

### P1 -- High (Broken Chains + Coverage Gaps)

| ID | Type | Description | Impact | Fix |
|----|------|-------------|--------|-----|
| P1-01 | Coverage Gap (BR) | BR-41 (Paid training payment gate) -- UNTESTED | Enrollments could bypass payment | Write test in training/enroll.test.ts |
| P1-02 | Coverage Gap (BR) | BR-42 (Training type restriction) -- UNTESTED | Orgs could create unauthorized training types | Write test in training/createTraining.test.ts |
| P1-03 | Coverage Gap (BR) | BR-43 (Completed training lock) -- UNTESTED | Post-completion enrollment changes possible | Write test in training/markComplete.test.ts |
| P1-04 | Coverage Gap (BR) | BR-44 (Idempotent attendance) -- UNTESTED | Duplicate credits on re-confirmation | Write test in training/markComplete.test.ts |
| P1-05 | Coverage Gap (BR) | BR-45 (Ad creative admin approval) -- UNTESTED | Self-serve ad display bypass | Write test in advertising/*.test.ts |
| P1-06 | Coverage Gap (BR) | BR-47 (Sponsored content labeling) -- UNTESTED | Unlabeled ads violating disclosure rules | Write test in advertising/*.test.ts |
| P1-07 | Coverage Gap (AC) | AC-M06-001 through AC-M06-007 (all 7 Dues ACs) -- UNTESTED | Entire dues module acceptance criteria unverified | Write AC-tagged tests in dues/ |
| P1-08 | Coverage Gap (AC) | AC-M09-003 (Training enrollment AC) -- UNTESTED | Training enrollment flow unverified | Write test in training/ |
| P1-09 | Coverage Gap (AC) | AC-M18-004, AC-M18-005, AC-M18-006 (Surveys ACs) -- UNTESTED | 3 of 6 survey ACs unverified | Write tests in surveys/ or communication/ |
| P1-10 | Broken Chain | M06 Dues: 8 BRs all tested but 0/7 ACs tested | BRs tested at unit level but AC-level integration untested | Add AC-tagged integration tests |
| P1-11 | Broken Chain | M09 Training: BRs 41-44 have no spec home AND no tests | Double break: unspecced and untested | Spec first, then test |

### P2 -- Medium (Orphan Nodes + Weak Chains)

| ID | Type | Description | Module |
|----|------|-------------|--------|
| P2-01 | Weak Spec Coverage | M07 Communications has only 1 BR in spec (BR-26) but WORKFLOW_MAP assigns BR-28 too | M07 |
| P2-02 | Weak Spec Coverage | M01 Auth has 6 BRs assigned but only 4 in spec (missing BR-21, BR-24) | M01 |
| P2-03 | No BR-Registry | br-registry.json not found -- BR-to-test mapping relies on grep, not structured data | All |
| P2-04 | State Machine Gap | WORKFLOW_MAP defines 22 state machines, DOMAIN_MODEL defines 4 explicit ones -- 18 are enum-only without transition guards | All |
| P2-05 | AC-T series orphans | AC-T3-001..005, AC-T4-001..006, AC-T8-003..009 tested but not in any MODULE_SPEC | TDD infrastructure |
| P2-06 | Frontend test isolation | 244 frontend test files exist but none reference BR-NNN or AC-NNN IDs | apps/ |

---

## Per-Module Chain Health

| Module | WFs | BRs (WF) | BRs Specced | BRs Tested | ACs Specced | ACs Tested | Chain % | Gaps |
|--------|-----|----------|-------------|------------|-------------|------------|---------|------|
| M01 Auth & Onboarding | 9 | 6 | 4 | 6 | 7 | 7 | 83% | BR-21,24 not in spec |
| M02 Member Profile | 5 | 6 | 6 | 6 | 8 | 8 | **100%** | -- |
| M03 Platform Admin | 9 | 2 | 2 | 2 | 7 | 7 | **100%** | -- |
| M04 Org Admin | 5 | 3 | 3 | 3 | 7 | 7 | **100%** | -- |
| M05 Membership | 9 | 7 | 7 | 7 | 7 | 7 | **100%** | -- |
| M06 Dues & Payments | 8 | 8 | 8 | 8 | 7 | **0** | **57%** | All 7 ACs untested |
| M07 Communications | 5 | 2 | 1 | 2 | 6 | 6 | 83% | BR-28 not in spec |
| M08 Events | 7 | 6 | 6 | 6 | 6 | 6 | **100%** | -- |
| M09 Training | 7 | 9 | 5 | 5 | 6 | 5 | **67%** | BR-41..44 unspecced+untested; AC-M09-003 untested |
| M10 Credit Tracking | 6 | 4 | 4 | 4 | 5 | 5 | **100%** | -- |
| M11 Docs & Credentials | 5 | 3 | 3 | 3 | 6 | 6 | **100%** | -- |
| M12 Elections & Gov | 4 | 2 | 2 | 2 | 6 | 6 | **100%** | -- |
| M13 Professional Feed | 4 | 1 | 1 | 1 | 5 | 5 | **100%** | -- |
| M14 National Dashboard | 3 | 1 | 1 | 1 | 5 | 5 | **100%** | -- |
| M15 Job Board | 5 | 1 | 1 | 1 | 5 | 5 | **100%** | -- |
| M16 Advertising | 5 | 5 | **0** | 1 | 6 | 6 | **33%** | All 5 BRs unspecced; 4 untested |
| M17 Marketplace | 3 | 1 | 1 | 1 | 5 | 5 | **100%** | -- |
| M18 Surveys & Polls | 4 | 1 | 1 | 1 | 6 | 3 | **75%** | 3 ACs untested |
| M19 Committee Mgmt | 5 | 1 | 1 | 1 | 6 | 6 | **100%** | -- |

### Aggregate Metrics

| Metric | Value |
|--------|-------|
| Total WFs | 114 |
| Total BRs | 49 |
| BRs in MODULE_SPECs | 38 (78%) |
| BRs with test coverage | 43 (88%) |
| BRs fully chained (spec + test) | 37 (76%) |
| Total ACs | 127 |
| ACs with test coverage | 116 (91%) |
| ACs untested | 11 (9%) |
| Modules at 100% chain | 11 of 19 (58%) |
| Modules below 80% chain | 3 (M06, M09, M16) |
| **Overall Chain Health** | **82%** |

---

## Cross-Module Integration Health

### 8 Cross-Module Flows (from WORKFLOW_MAP Section 6)

| Flow | Modules Involved | Integration Mechanism | Test Coverage |
|------|-----------------|----------------------|---------------|
| 6.1 Member Registration & Onboarding | M01 -> M05 -> M02 | Sync (direct import) | Covered (person/, membership/) |
| 6.2 Dues Payment & Membership Status | M06 -> M05 | Sync (status update on payment) | Covered (dues/, membership/) |
| 6.3 Training Attendance & Credit Award | M09 -> M10 | Sync (credit insert on completion) | Covered (training/, credit tests) |
| 6.4 Event Registration & Payment | M08 -> M06 -> M09 | Sync + async | Covered (events/) |
| 6.5 Election & Officer Transition | M12 -> M04 | Sync (officer term creation) | Covered (elections/) |
| 6.6 Account Deletion Cascade | M01 -> all modules | Async (deletion processor job) | Covered (deletionProcessor.test.ts) |
| 6.7 Booking Event Flow | Booking -> Events | Sync | Covered (booking/) |
| 6.8 Communication Delivery Pipeline | M07 -> Email -> Notifs | Async (jobs) | Covered (communication/, email/, notifs/) |

**Cross-module integration test coverage: 8/8 flows have at least one test touching the integration boundary.**

---

## Suggested Next Actions

| Priority | Action | Gaps Fixed | Effort |
|----------|--------|-----------|--------|
| **P0** | Add BR-45..49 to `docs/product/modules/m16-advertising/MODULE_SPEC.md` section 5 | P0-01 | 30 min |
| **P0** | Add BR-24 to m01, BR-28 to m07, BR-41..44 to m09 MODULE_SPECs | P0-02, P0-03, P0-04 | 1 hr |
| **P1** | Write tests for BR-41..44 in `services/api-ts/src/handlers/training/` | P1-01..04 | 2 hr |
| **P1** | Write tests for BR-45, BR-47 in `services/api-ts/src/handlers/advertising/` | P1-05, P1-06 | 1 hr |
| **P1** | Add AC-M06-001..007 tagged tests to `services/api-ts/src/handlers/dues/` | P1-07, P1-10 | 3 hr |
| **P1** | Add AC-M09-003 test and AC-M18-004..006 tests | P1-08, P1-09 | 1.5 hr |
| **P2** | Create `services/api-ts/br-registry.json` for structured BR-to-test mapping | P2-03 | 1 hr |
| **P2** | Add BR/AC ID references to frontend test descriptions | P2-06 | 2 hr |

### Estimated Total Remediation: ~12 hours

### Priority Order
1. **Spec gaps first** (P0) -- unblocks test writing
2. **BR test gaps** (P1-01..06) -- 6 untested business rules
3. **AC test gaps** (P1-07..09) -- 11 untested acceptance criteria
4. **Tooling** (P2-03) -- br-registry.json for automated tracking
