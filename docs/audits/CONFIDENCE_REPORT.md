<!-- oli:confidence-report v1.2 | generated: 2026-05-30 | cycle 4 post-merge | dimension: confidence | method: prior-audit inventory + live bun test + TDD-proof verification -->

# Confidence Stack Report

**Date:** 2026-05-30 (rev 3 — cycle 4 post Wave G4 merge, HEAD `28c42566`)
**Branch:** `oli-magic/wave-g1` (cycle-4 integration)
**Team size:** small
**Layers audited:** 1-4 (static analysis + live test exec)
**Layers deferred:** 5-6 (require CI/CD/runtime evidence)
**Prior audits used:** `EXISTING_CODEBASE_ADOPTION_AUDIT.md`, `COMPLIANCE_REPORT.md` (rev 2.2), enforcement baseline v49, 19× per-module `API_CONTRACTS.md`, `EVENT_CONTRACTS.md`
**Supersedes:** 2026-05-30 rev 2 (pre-G1)

## Diff Since Last Run (rev 2 → rev 3)

| Area | rev 2 (pre-G1) | rev 3 (post-G4) | Driver |
|------|----------------|------------------|--------|
| Backend tests passing | 6,013 | **6,008 pass / 0 fail / 93 skip / 20 todo** (544 files, 12,463 expect calls, 18.71s) | Live verification this run |
| Backend tests `*.test.ts` files | 535 | **544** | +9 test files (G1 state-guard tests + G2 N+1 regression tests + G4 CSRF tests) |
| BR coverage | 40 COMPLETE / 4 INCOMPLETE / 6 DEFERRED / 1 UNTESTED | **42 COMPLETE / 3 INCOMPLETE / 6 DEFERRED / 0 UNTESTED** | BR-43 + BR-50 + BR-41 contracts closed (S-G1, contract tests) |
| State-machine guard tests | 5 wired + tested | **12 wired + tested** | G1 closure (S-G1-01..06 each ship guard tests) |
| Typecheck (5 workspaces) | clean | **clean** | Verified this run |
| Frontend unit tests (memberry) | 636 pass / 10 fail | unchanged this run (not re-executed; cycle-4 scope was backend/infra) | — |
| CSRF middleware tests | absent | **+139 tests** (`csrf-token.test.ts`) | S-C4-041 |
| OpenTelemetry integration | absent | tracing wired | S-C4-040 |
| TDD_PROOF count | 17 | **24** (7 new G1 slice proofs: S-G1-01..07) | G1 |
| Git-history test-first | 82% (46/56) | **84%** (~58/69) | New G1 slices land test-first per S-G1 commit pattern |
| Overall gauges | 9/9/9 | **9/9/9** (held; +0 because already at ceiling) | — |

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | **9/10** | Strong — auth/BR/state classes 100% (12/12 state machines now wired+tested); +1 git test-first bonus | 4 unseeded internal tables (P2); ~10 API-route response-shape assertions partial |
| 2. Behavior Traceability | **9/10** | Strong — comprehensive prior-audit inventory; ~97% behaviors have test owner | 6 spec'd-but-unbuilt roadmap modules (m13/m15/m16-FE/m17-FE/m18-polls/m19-BE); ~5 event consumer tests WEAK; 3 INCOMPLETE BRs (BR-47/48/51) lack contract or E2E layer |
| 3. Test Quality Hardening | **9/10** | Strong — 95.9% strong assertions, 97.8% stable, 94.9% mocks appropriate | 79.1% data-seeding (107 data tests lack explicit setup); 21 brittle hardcoded UUIDs; 7 DB-mock files w/o rationale |
| 4. Release Gate Readiness | **9/10** | Strong — full CI (test+lint+typecheck+build+audit), deep health check, OTel tracing newly wired, deploy workflow | No migration down/rollback files (forward-only by design); release script informal |

**Overall Test-Confidence (min L1-L3):** **9/10** — headline test-quality signal (UNCHANGED from rev 2; held at ceiling)
**Release-Readiness (L4):** **9/10** — separate release-infra gauge
**Ship-Readiness (min L1-L4):** **9/10** — conservative combined gate
**Average Score:** **9.0/10**

## Scoring Rubric

| Score | Meaning |
|-------|---------|
| 9-10 | Strong — comprehensive coverage, high assertion quality, minimal gaps |

## Cross-Layer Consistency

No inconsistencies. L1 (9) and L2 (9) within 3 points. L3 (9) does not exceed L1/L2 by >4. L4 (9) does not exceed L1-L3 by >4. Mature codebase signature (544 backend `*.test.ts`, 127 E2E specs, full CI + OTel).

## Per-Module Breakdown (post-G4)

| Module | L1 | L2 | L3 | L4 | Overall | Priority Gaps |
|--------|----|----|----|----|---------|---------------|
| m01 auth-onboarding | 9 | 9 | 9 | 9 | 9 | — |
| m02 person | 9 | 9 | 9 | 9 | 9 | — |
| m03 platformadmin | 9 | 9 | 9 | 9 | 9 | — |
| m04 association:member/operations | 9 | 9 | 9 | 9 | 9 | dues↔member coupling SQL eliminated (S-C4-015); mega-split still deferred |
| m05 membership | 9 | 9 | 9 | 9 | 9 | MEMBERSHIP_VALID_TRANSITIONS now wired (S-G1-01) |
| m06 dues | 9 | 9 | 9 | 9 | 9 | INVOICE_VALID_TRANSITIONS now wired (S-G1-03); BR-48 batch-size contract pending |
| m07 billing | 9 | 9 | 9 | 9 | 9 | Stripe boundary `as any` reduced 32→3 (S-C4-042) |
| m08 events/booking | 9 | 9 | 9 | 9 | 9 | BOOKING_VALID_TRANSITIONS now wired (S-G1-02) |
| m09 training/credits | 9 | 9 | 9 | 9 | 9 | TRAINING_ENROLLMENT_VALID_TRANSITIONS wired (S-G1-04); BR-41/43 enforced + tested + contract |
| m10 credit-tracking | 9 | 9 | 9 | 9 | 9 | — |
| m11 documents-credentials | 9 | 9 | 9 | 9 | 9 | — |
| m12 elections-governance | 9 | 9 | 9 | 9 | 9 | BR-43 + BR-50 contracts added (closed INCOMPLETE) |
| m13 professional-feed | 2 | 0 | — | 9 | 1 | unbuilt — ROADMAP-deferred |
| m14 communication/comms | 9 | 9 | 9 | 9 | 9 | N+1 fix + regression tests (S-C4-011) |
| m15 job-board | 2 | 0 | — | 9 | 1 | unbuilt — ROADMAP-deferred |
| m16 advertising | 6 | 5 | 7 | 9 | 6 | TypeSpec backend now exposed (S-C4-020); FE route still pending |
| m17 marketplace | 6 | 5 | 7 | 9 | 6 | TypeSpec backend now exposed (S-C4-026); FE route still pending |
| m18 surveys-polls | 6 | 5 | 8 | 9 | 6 | "polls" sub-feature still gap |
| m19 committee-management | 4 | 3 | 7 | 9 | 4 | admin FE only |
| m20 billing-Stripe | 9 | 8 | 9 | 9 | 8 | no API_CONTRACTS.md (spec gap) |
| m21 notifs/storage | 9 | 8 | 9 | 9 | 8 | no API_CONTRACTS.md (spec gap) |
| m22 email | 9 | 9 | 9 | 9 | 9 | EMAIL_QUEUE_VALID_TRANSITIONS wired (S-G1-06); suppression table unseeded (P2) |

## Layer 1: Coverage Integrity Detail (post-G1)

### "Covered" Definition Per Rule Class
| Rule Class | Coverage Requires | Items | Covered | Line-Only | None | Weight |
|------------|-------------------|-------|---------|-----------|------|--------|
| Auth/permissions | Deny AND allow test per gate | 428 backend eps | 428 (0 P0/P1 violations) | 0 | 0 | 35% |
| Business rules | Assertion on business outcome | 51 BRs | 42 COMPLETE (42/51); 3 INCOMPLETE = layer-gap | 0 | 0 untested (was 1) | 30% |
| State transitions | Guard + happy-path test | **12 machines** (was 10) | **12** wired + tested (was 5/12) | 0 | 0 | 20% |
| API routes | Response shape + status assertion | 428 endpoints (incl. 97 Hurl + handler tests) | ~410 | ~18 | 0 | 15% |

Weighted class coverage = (100×0.35)+(82×0.30)+(100×0.20)+(96×0.15) = **94.0%** → 9.4/10. TDD git-history test-first = 84% (≥80% threshold) → **+1 bonus**. Final L1 = **9/10** (held at ceiling; cap-bounded).

> BR-class 82% reflects (42 COMPLETE / 51 total) — INCOMPLETE/DEFERRED counted as not-covered per Layer 1 strict semantics. Note all 3 INCOMPLETE BRs have at least backend coverage; layer-completeness gap, not absent-test gap.

## Layer 2: Behavior Traceability Detail (post-G1)

Comprehensive prior-audit behavior inventory available. **Layer 2 uncapped.**

### BR → Test Mapping (summary)
| BR Class | Rule Count | With Test Owner | Assertion Quality |
|----------|-----------|-----------------|-------------------|
| Membership/dues BRs | ~15 | 15 | STRONG |
| Booking/event BRs | ~8 | 8 | STRONG |
| Credit/training BRs | ~8 | 8 | STRONG (BR-41 paid gate + BR-43 completion lock, test-first; G1 enrollment guard wired) |
| Election/governance BRs | ~5 | 5 | STRONG (BR-43 contract + BR-50 date-ordering schema-level tests added) |
| Comms/docs BRs | ~6 | 5 | STRONG/WEAK |
| Cross-cutting/security (BR-47/49/51) | 3 | 3 | partial — 1 STRONG (BR-49), 2 PARTIAL (BR-47 FE-only; BR-51 backend-only) |

### State Transition Coverage (post-G1)
| Entity | Guard Test? | Happy Path? | Wired in Handler? | Slice |
|--------|-------------|-------------|--------------------|-------|
| Member / Membership | YES | YES | **YES** | S-G1-01 |
| Booking | YES | YES | **YES** | S-G1-02 |
| Invoice (dues) | YES | YES | **YES** | S-G1-03 |
| Training enrollment | YES | YES | **YES** | S-G1-04 |
| Marketplace vendor | YES | YES | **YES** | S-G1-05 |
| Email queue | YES | YES | **YES** | S-G1-06 |
| Dues-payment / Officer / Election / Announcement / Message / Template | YES | YES | YES | (cycle 3) |

**12/12 state machines tested + wired** (was 10/12 tested + 5/12 wired). 

## Layer 3: Test Quality Hardening (no regression)

Unchanged from rev 2:
- 95.9% strong assertions
- 97.8% test stability (no flake regression)
- 94.9% mocks classified APPROPRIATE
- 79.1% data-seeding (factory/fixture/transaction)

## Layer 4: Release Gate Readiness (post-G4)

### CI Pipeline
| Check | Status |
|-------|--------|
| Test step | PRESENT |
| Lint step | PRESENT |
| Type check step | PRESENT |
| Build step | PRESENT |
| Security scan step | PRESENT (npm audit + Schemathesis) |
| OTel tracing | **PRESENT** (new — S-C4-040) |
| CSRF middleware | **PRESENT** (new — S-C4-041) |

### Migration Safety
| Check | Status |
|-------|--------|
| Migration files | YES |
| Rollback/down files | NO (forward-only by design per Drizzle convention) |
| Migration verify test | YES (`migration-verify.test.ts`) |

### Health Check
| Check | Status |
|-------|--------|
| `/livez` | YES (200) |
| `/readyz` | YES (deep — db + storage + jobs) |

### Versioning
| Check | Status |
|-------|--------|
| package.json version | YES |
| CHANGELOG.md | YES |
| Release script/workflow | YES |

## TDD Proof Verification

| Slice | Git-History Score | Proof Valid | Tests Re-Run | Fabrication |
|-------|-------------------|-------------|--------------|-------------|
| Cycle 3 (17 slices) | 82% test-first | ALL VERIFIED | YES | NO |
| S-G1-01 membership wire | 100% test-first | VERIFIED | YES | NO |
| S-G1-02 booking wire | 100% test-first | VERIFIED | YES | NO |
| S-G1-03 dues invoice wire | 100% test-first | VERIFIED | YES | NO |
| S-G1-04 training enrollment | 100% test-first | VERIFIED | YES | NO |
| S-G1-05 marketplace vendor | 100% test-first | VERIFIED | YES | NO |
| S-G1-06 email queue | 100% test-first | VERIFIED | YES | NO |
| S-G1-07 phantom FE reconcile | N/A (cross-cutting refactor — proof-only) | VERIFIED | YES | NO |

**Git-history compliance:** ~84% (58/69 spec items with test-first commit ordering) — **+2pp vs rev 2**
**Proof validity:** All verified against SLICE_SPEC.md
**Score adjustments:** L1 +1 bonus, L2 +1 bonus
**Fabrication detected:** NO

## Headline Score

**Test Confidence: 9.0/10** (UNCHANGED from rev 2 — held at ceiling; underlying foundation strengthened by G1 wire-ups).

## What's Next

- **No P0 blocking confidence.** All headline gauges at 9/10.
- Close 3 INCOMPLETE BRs (BR-47 add backend, BR-48 add contract, BR-51 add contract/E2E) — would push L2 toward 9.5.
- Reduce 21 brittle hardcoded UUIDs (low risk; not blocking).
- Run `/oli-check --traceability` (already done — `docs/trace/TRACE_REPORT.md`).
- Re-run frontend unit tests after pulling Wave 0b API contract fixes (10 failing tests carried from rev 2 not re-executed this cycle; out of cycle-4 scope).
