# Gap-Closure Roadmap — v1.1.0 Auth & Test Completeness

> **Baseline:** 1962 pass / 0 fail / 9 skip / 0 todo (Wave 4 COMPLETE)
> **Target:** All P0/P1 fixed, all BRs tested, all .todo → GREEN or removed
> **Last updated:** 2026-05-09

---

## Status Key

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked

---

## Wave 1: Finish What's Started (Phase 12-13 completion)

**Goal:** Close position-based RBAC. Unblock Phase 14.

| # | Task | Files | Est | Depends | Status |
|---|------|-------|-----|---------|--------|
| 1.1 | [x] Phase 13-01: requirePosition utility + RED tests | `officer-check.ts`, `position-titles.ts`, `position-rbac.test.ts` | done | — | ✅ |
| 1.2 | [x] Phase 13-02: Wire requirePosition to 16 member + comms handlers | `association:member/` handlers (dues, roster, elections, officer-terms), `communications/` handlers | done | 1.1 | ✅ |
| 1.3 | [x] Phase 13-03: Wire requirePosition to 13 operations handlers | `association:operations/` handlers (events, training, courses, check-in) | done | 1.1 | ✅ |
| 1.4 | [x] Phase 13-04: Wire requirePosition to app.ts inline routes | `getCreditCompliance.ts`, `getDuesDashboard.ts`, `updateOrgProfile.ts` | done | 1.1 | ✅ |
| 1.5 | [x] Phase 13-05: Officer sidebar position filtering | `position-nav.ts`, `officer-sidebar.tsx` | done | 1.1 | ✅ |
| 1.6 | [x] Upgrade officer seed roles to `association:admin,association:member` | `seed.ts` | done | 1.2, 1.3 | ✅ |
| 1.7 | [x] Convert 6 `.todo` RBAC tests → GREEN | `position-rbac.test.ts`, `route-protection-*.test.ts` | done | 1.6 | ✅ |

**Wave 1 exit criteria:** `bun test` → 1906 pass, 0 fail, 31 todo ✅ ACHIEVED

---

## Wave 2: P0 Security Fixes (Critical)

**Goal:** Eliminate all 7 P0 findings from codebase audit.

| # | Task | ID | Files | Est | Depends | Status |
|---|------|----|-------|-----|---------|--------|
| 2.1 | [x] Enable email verification | P0-4 | `auth.ts` config | done | — | ✅ |
| 2.2 | [x] MIME allowlist on uploadFile | P0-5 | `storage/uploadFile.ts` | done | — | ✅ |
| 2.3 | [x] Input validation on castVote | P0-6 | `elections/castVote.ts` | done | — | ✅ |
| 2.4 | [x] Encrypt 2FA secrets at rest | P0-1 | Better-Auth `secret` config | done | — | ✅ |
| 2.5 | [x] Encrypt session tokens at rest | P0-2 | Better-Auth `secret` config + 24h expiry | done | — | ✅ |
| 2.6 | [x] Add organizationId to audit log | P0-3 | `audit/` schema `.notNull()` | done | — | ✅ |
| 2.7 | [x] Org-scope remaining 26 tables | P0-7 | migration 0019 (26+ tables) | done | 2.6 | ✅ |

**Wave 2 exit criteria:** All 7 P0s resolved with tests. Audit re-run clean. ✅ ACHIEVED

---

## Wave 3: P1 Auth Hardening

**Goal:** Close 10 P1 findings (P1-8 WON'T FIX).

| # | Task | ID | Est | Depends | Status |
|---|------|----|-----|---------|--------|
| 3.1 | [x] Fix officerAuth silent skip on missing :orgId | P1-1 | done | — | ✅ |
| 3.2 | [x] Typed + rotatable internal service token | P1-2 | done | — | ✅ |
| 3.3 | [x] Enforce 2FA for privileged officer roles | P1-3 | done | 2.4 (P0-1) | ✅ |
| 3.4 | [x] Session invalidation on role change | P1-4 | done | 2.5 (P0-2) | ✅ |
| 3.5 | [x] Rate limit all non-auth endpoints (production) | P1-5 | done | — | ✅ |
| 3.6 | [x] Audit-log auth events (login, logout, role change) | P1-6 | done | 2.6 (P0-3) | ✅ |
| 3.7 | [x] Admin app role gates | P1-7 | done | — | ✅ |
| 3.8 | [x] Migrate inline app.ts routes to TypeSpec + dead-code cleanup | P1-9 | done | — | ✅ |
| 3.9 | [x] Audit + email module test coverage (+31 tests) | P1-10 | done | 2.6, 3.6 | ✅ |
| 3.10 | [x] association:member mega-module split plan | P1-11 | done | 3.8 | ✅ |

**Wave 3 exit criteria:** P1 tracker empty except P1-8 (WON'T FIX). ✅ ACHIEVED — split plan at `.planning/phases/14-mega-module-split/SPLIT-PLAN.md`

---

## Wave 4: Test Gap Closure (54 deferred tests)

**Goal:** Every `.todo` test → GREEN or deleted with justification.

| # | Module | Deferred | Action | Status |
|---|--------|----------|--------|--------|
| 4.1 | [x] elections (vote-tally) | 5 | Deleted — tally/notification not implemented | ✅ |
| 4.2 | [x] membership (import, defaults, transitions, application) | 16 | Deleted — notifications, auto-transitions, officer terms not implemented | ✅ |
| 4.3 | [x] certificates (flow-09) | 5 | Deleted — generation pipeline not built | ✅ |
| 4.4 | [x] booking (slotGenerator) | 2 | **Fixed effectiveFrom/effectiveTo bug + 2 GREEN tests** | ✅ |
| 4.5 | [x] notifs (markAsRead) | 1 | Deleted — needs DB integration test | ✅ |
| 4.6 | [x] reviews (createReview) | 1 | Deleted — DB CHECK constraint, not handler | ✅ |
| 4.7 | [x] email (processor) | 1 | Deleted — wrong layer (EmailService) | ✅ |
| 4.8 | [x] br-edge-cases | 0 | Already clean | ✅ |

**Wave 4 exit criteria:** `grep -c 'test\.todo' services/api-ts/src/**/*.test.ts` → 0 ✅ ACHIEVED
**Result:** 31 todos resolved (2 → GREEN, 29 deleted with justification). 1962 pass / 0 fail / 9 skip.

---

## Wave 5: BR Coverage Completion (0 UNTESTED)

**Goal:** 0 UNTESTED BRs. Phase 2-3 BRs at PARTIAL (backend tests only — contract + E2E deferred to module implementation).

| # | BR | Name | Module | Test Type | Est | Status |
|---|-----|------|--------|-----------|-----|--------|
| 5.1 | [x] BR-28 | Communication Deduplication | communications | unit + contract | done | ✅ (already COMPLETE) |
| 5.2 | [x] BR-35 | Feed Content Moderation | communications | unit (pure logic) | done | ✅ PARTIAL |
| 5.3 | [x] BR-36 | National Dashboard Access | platformadmin | unit (pure logic) | done | ✅ PARTIAL |
| 5.4 | [x] BR-37 | Job Posting Expiry | events | unit (pure logic) | done | ✅ PARTIAL |
| 5.5 | [x] BR-38 | Marketplace Referral Disclosure | billing | unit (pure logic) | done | ✅ PARTIAL |
| 5.6 | [x] BR-39 | Committee Dissolution | membership | unit (pure logic) | done | ✅ PARTIAL |
| 5.7 | [x] BR-40 | Survey Anonymity | communications | unit (pure logic) | done | ✅ PARTIAL |

**Wave 5 exit criteria:** `bun run scripts/br-coverage.ts` → 0 UNTESTED ✅ ACHIEVED
**Result:** 71 new tests across 6 files. BR-28 already COMPLETE. BR-35–40 moved UNTESTED → PARTIAL (backend unit tests with pure rule functions). Contract + E2E coverage deferred to Phase 2-3 module implementation.

---

## Wave 6: E2E & Integration Hardening

**Goal:** No stub E2E tests. Phase 14 negative tests done.

| # | Task | Est | Depends |
|---|------|-----|---------|
| 6.1 | [ ] Phase 14: Negative E2E tests — role boundary violations | 1-2d | Wave 1 |
| 6.2 | [ ] Convert 7 E2E stub files → real assertions or delete | 1d | Wave 5 |
| 6.3 | [ ] Audit module E2E (compliance logging verification) | 4h | 3.9 |
| 6.4 | [ ] Email module E2E (template render + delivery) | 4h | 3.9 |

**Wave 6 exit criteria:** All E2E tests assert real behavior. No stubs.

---

## Dependency Graph (Critical Path)

```
Wave 1 (Phase 13 finish)
  ↓
Wave 2.1-2.3 (P0 quick wins, parallel with Wave 1)
  ↓
Wave 2.4 (P0-1: encrypt 2FA) ───→ Wave 3.3 (P1-3: enforce 2FA)
Wave 2.5 (P0-2: encrypt sessions) → Wave 3.4 (P1-4: session invalidation)
Wave 2.6 (P0-3: audit orgId) ────→ Wave 2.7 (P0-7: 26 tables)
                                  → Wave 3.6 (P1-6: audit auth events)
                                  → Wave 3.9 (P1-10: audit+email tests)
  ↓
Wave 3 (P1 hardening, mostly parallel)
  ↓
Wave 4 (test gap closure, can start after Wave 2)
Wave 5 (BR coverage, independent)
  ↓
Wave 6 (E2E hardening, last)
```

---

## Execution Order (Recommended)

**Session 1:** Wave 1 (1.2 + 1.3 + 1.6 + 1.7) — 6h → Phase 13 DONE
**Session 2:** Wave 2.1-2.3 (P0 quick wins) — 3h
**Session 3:** Wave 2.4 + 2.5 (encryption) — 8h
**Session 4:** Wave 2.6 + 2.7 (audit org-scoping) — 1-2d
**Session 5:** Wave 3.1-3.7 (P1 hardening) — 2d
**Session 6:** Wave 4 (deferred tests) — 2d
**Session 7:** Wave 3.8 (inline→TypeSpec migration) — 2-3d
**Session 8:** Wave 5 (BR coverage) — 2d
**Session 9:** Wave 6 (E2E hardening) — 2d
**Session 10:** Wave 3.9-3.10 (audit tests + mega-module plan) — 1w

**Total estimated:** ~4-5 weeks sequential, ~2-3 weeks with parallelism

---

## Done Criteria (All Waves Complete)

- [ ] `bun test` → 2000+ pass, 0 fail, 0 todo
- [ ] `bun run scripts/br-coverage.ts` → 0 UNTESTED (Phase 1 all COMPLETE, Phase 2-3 at least PARTIAL)
- [ ] `bun run test:e2e` → all pass, 0 stubs
- [ ] P0-P1 audit re-run → 0 P0, 0 P1 (except P1-8 WON'T FIX)
- [ ] TypeSpec coverage → 100% (no hand-wired routes)
- [ ] All handler modules have test files
