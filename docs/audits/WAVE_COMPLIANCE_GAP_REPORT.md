<!-- oli-magic v1.1 | generated 2026-05-24 | scope: waves 0-7 -->
# Wave 0-7 Compliance Gap Report

**Generated:** 2026-05-24
**Scope:** All strategic waves (0-7)
**Method:** /oli-spec-consistency + /oli-confidence-stack + /oli-audit-compliance + /oli-api-contracts (parallel)

---

## Executive Summary

| Metric | Previous (Cycle 4) | Current (Post-Waves) | Delta |
|--------|-------|---------|-------|
| P0 violations | 10 | **0** | -10 (all resolved) |
| P1 violations | 47 | TBD (re-audit needed) | — |
| Spec consistency | PASSED | PASSED (1 MEDIUM) | stable |
| Survey tests | 0 | **0** | CRITICAL |
| Missing migration | 0 | **1** (surveys) | NEW |
| TypeSpec coverage | ~60% | ~60% | unchanged |
| Hand-wired routes | 34 | 34 | unchanged |

---

## Per-Wave Gap Report

### Wave 0 (Foundation) — LOW RISK ✅

| Dimension | Status |
|-----------|--------|
| Spec compliance | GREEN — no violations |
| Test coverage | Good — TDD_PROOF exists (0a, 0b) |
| API contracts | Generated routes |
| Domain model | Complete |
| **Gaps:** | None identified |

### Wave 1 (Financial) — LOW RISK ✅

| Dimension | Status |
|-----------|--------|
| Spec compliance | GREEN — all 8 tasks complete |
| Test coverage | Gold standard — 8 SLICE_SPECs + 8 TDD_PROOFs |
| API contracts | Generated (dues endpoints via TypeSpec) |
| Domain model | Complete |
| **Gaps:** | None identified |

### Wave 2a (Events) — MEDIUM RISK ⚠️

| Dimension | Status |
|-----------|--------|
| Spec compliance | YELLOW — 5 untested ACs from compliance report |
| Test coverage | Strong — 23 test files |
| API contracts | **GAP: No events.tsp.** 2 hand-wired routes (completeEvent, serveEventOgMeta) |
| Domain model | Complete |
| **Gaps:** | G-2A-1: No TypeSpec for event module. G-2A-2: completeEvent + OG meta hand-wired without validators |

### Wave 2b (Training+Certs) — MEDIUM RISK ⚠️

| Dimension | Status |
|-----------|--------|
| Spec compliance | YELLOW — HMAC/QR verification EXISTS but needs audit |
| Test coverage | Excellent — 31 test files |
| API contracts | **MAJOR GAP: No training.tsp.** All 10+ handlers hand-wired. 4 accredited-provider routes in app.ts |
| Domain model | **MISSING:** org_cpd_config table, compliance_standings view, org_certificate_seq table, 2 enums, ~14 new columns absent from DOMAIN_MODEL.md |
| **Gaps:** | G-2B-1: Zero TypeSpec coverage. G-2B-2: Domain model completely missing Wave 2b entities |

### Wave 3 (Identity/Trust) — LOW RISK ✅

| Dimension | Status |
|-----------|--------|
| Spec compliance | GREEN |
| Test coverage | Good — directory.test.ts, credentials.test.ts, trust-signals.test.ts all exist |
| API contracts | **GAP: No dedicated TypeSpec.** Credential lookup + certificate verification hand-wired |
| Domain model | Minor gap — 3 privacy fields missing (credentialsVisible, duesStatusVisible, ceComplianceVisible) |
| **Gaps:** | G-3-1: Public credential endpoints lack TypeSpec validators. G-3-2: Minor domain model gap |

### Wave 4 (Communications) — LOW RISK ✅

| Dimension | Status |
|-----------|--------|
| Spec compliance | GREEN — 37/37 spec items covered |
| Test coverage | Excellent — 454 tests, TDD_PROOF exists |
| API contracts | Generated (communication TypeSpec exists) |
| Domain model | Complete |
| **Gaps:** | None identified |

### Wave 5 (Governance) — LOW RISK ✅

| Dimension | Status |
|-----------|--------|
| Spec compliance | GREEN — 31/31 spec items covered |
| Test coverage | Excellent — 381 tests, TDD_PROOF exists |
| API contracts | Generated (elections TypeSpec exists) |
| Domain model | Complete |
| **Gaps:** | None identified |

### Wave 6 (Surveys & NPS) — CRITICAL RISK 🔴

| Dimension | Status |
|-----------|--------|
| Spec compliance | **P0 auth: CLEAR** (all handlers have auth). P1: 7 spec endpoints not implemented |
| Test coverage | **ZERO** — 10 handlers, 0 test files |
| API contracts | CLEAN — full TypeSpec↔handler↔route alignment (10/10) |
| Domain model | **MAJOR MISMATCH** — domain model fields don't match actual schema |
| Migration | **MISSING** — survey/survey_response tables have schema but no Drizzle migration |
| **Gaps:** | G-6-1: Zero tests (CRITICAL). G-6-2: No DB migration (CRITICAL). G-6-3: Domain model structural mismatch. G-6-4: 7 spec endpoints not in TypeSpec/handlers (polls, member views, export) |

### Wave 7 (Admin App) — MEDIUM RISK ⚠️

| Dimension | Status |
|-----------|--------|
| Spec compliance | YELLOW — 10 `as any`, 8 raw `<input>`, weak ARIA |
| Test coverage | Unknown — 0 component tests for admin app |
| API contracts | N/A — admin app is frontend-only |
| Domain model | N/A |
| **Gaps:** | G-7-1: Zero component tests. G-7-2: Raw HTML bypassing component library. G-7-3: Type safety issues |

---

## Triage: All Gaps Classified

### SECURITY (fix immediately)

| ID | Description | Wave | Status |
|----|-------------|------|--------|
| V-M03-003 | MFA disable guard | Pre-wave | **RESOLVED** — production guard at `services/api-ts/src/core/auth.ts:490-508`. Blocks platform admins from POST /auth/two-factor/disable. Earlier audit missed it (searched for separate file, guard is inline in registerRoutes). |

**All 10 Cycle 4 P0s now RESOLVED. P0 count = 0.**

### BUG (code exists, behaves wrong — fix)

| ID | Description | Wave | Effort |
|----|-------------|------|--------|
| G-6-2 | Survey schema has no Drizzle migration — tables won't exist in DB | 6 | 15 min |
| G-6-3 | Domain model fields don't match survey schema (createdBy vs createdByPersonId, settings JSONB vs discrete fields, varchar vs pgEnum) | 6 | 30 min |

### MISSING-TESTS (shipped code without tests — write)

| ID | Description | Wave | Effort |
|----|-------------|------|--------|
| G-6-1 | 10 survey handlers with zero test files | 6 | 3-4h |
| G-7-1 | Admin app zero component tests | 7 | 2-3h |
| BR-05/06/07/46/48 | 5 missing BR test files in dues/association utils | 1 | 1-2h |

### SPEC-DRIFT (spec says X but code correctly does Y — update spec)

| ID | Description | Wave | Effort |
|----|-------------|------|--------|
| G-6-4 | M18 spec defines 17 endpoints but only 10 implemented (polls, member views, export are Phase C) | 6 | 15 min |
| G-6-3b | M18 MODULE_SPEC §22 says downstream artifacts needed but they exist | 6 | 5 min |
| G-2B-2 | DOMAIN_MODEL.md missing Wave 2b entities (org_cpd_config, compliance_standings, org_certificate_seq, 2 enums, ~14 columns) | 2b | 1h |
| G-3-2 | DOMAIN_MODEL.md missing 3 privacy fields on person_privacy_setting | 3 | 10 min |

### MISSING-TYPESPEC (hand-wired routes without TypeSpec — defer to roadmap)

| ID | Description | Wave | Effort |
|----|-------------|------|--------|
| G-2A-1 | No events.tsp — event module hand-wired | 2a | 2-3h |
| G-2B-1 | No training.tsp — entire training module hand-wired | 2b | 3-4h |
| G-3-1 | No TypeSpec for credential lookup + certificate verification | 3 | 1h |
| — | 34 total hand-wired routes in app.ts | all | 8-12h total |

---

## Prioritized Fix Queue

| Priority | Category | Items | Est. Effort | Phase |
|----------|----------|-------|-------------|-------|
| ~~1~~ | ~~SECURITY~~ | ~~V-M03-003 MFA disable guard~~ | ~~1h~~ | ~~6a~~ **RESOLVED** — guard at auth.ts:490 |
| ~~2~~ | ~~BUG~~ | ~~G-6-2 Survey migration~~ | ~~15min~~ | ~~6b~~ **RESOLVED** — 0050_wave6_surveys.sql |
| 3 | MISSING-TESTS | G-6-1 Survey handler tests | 3-4h | 6b |
| 4 | SPEC-DRIFT | G-6-3b, G-6-4, G-2B-2, G-3-2 | 1.5h | 6e |
| 5 | BUG | G-6-3 Domain model alignment | 30 min | 6e |
| 6 | MISSING-TESTS | BR-05/06/07/46/48 test files | 1-2h | 6d |
| 7 | MISSING-TESTS | G-7-1 Admin component tests | 2-3h | 6d |
| **Total** | | | **~10-12h** | |

### Deferred (not blocking v1)

| Category | Items | Rationale |
|----------|-------|-----------|
| MISSING-TYPESPEC | events.tsp, training.tsp, credential TypeSpec, 34 hand-wired routes | Known debt since v1.0. Tracked in BROWNFIELD_STATUS. Not a compliance blocker. |
| M18 Phase C endpoints | 7 endpoints (polls, member views, export) | Spec-ahead-of-code by design. Phase C features. |
| Frontend as-any | 103 casts across 3 apps | Tracked in brownfield Cycle 2/3. Separate effort. |

---

## Graduation Impact

After fixing Priority 1-5 items (~6h):

| Metric | Current | Expected | Target |
|--------|---------|----------|--------|
| P0 violations | 1 | 0 | 0 |
| Survey tests | 0 | 10+ | > 0 |
| DB migration | missing | present | present |
| Domain model | stale | current | current |
| Spec consistency | 1 MEDIUM | 0 | 0 |

After Priority 6-7 (~4h more): BR coverage gaps close, admin app gets component tests.
