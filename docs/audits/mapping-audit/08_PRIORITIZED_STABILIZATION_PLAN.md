# 08 — Prioritized Stabilization Plan

**Date:** 2026-05-26
**Sources:** Audits 01-08 (Brownfield Baseline through Test Confidence Gap)
**Mode:** Plan only. No code modifications.

---

## Executive Summary

**Current Health: 5.5/10**

The Memberry codebase has a **strong backend foundation** (6,629 API tests, 97 contract tests, comprehensive domain gate coverage) but **weak frontend and journey-level confidence** (29% frontend coverage, 60% of routes untested E2E, admin app nearly ungated).

**Most urgent risks:**
1. **1 P0 broken feature** — void-event-credits endpoint missing (frontend calls a non-existent backend endpoint)
2. **18 P1 gaps** — financial operations untested, officer allow paths unverified, admin role enforcement client-side only, cross-org write isolation unverified
3. **4 officer positions** have empty navigation (VP, board-member, staff, generic officer)
4. **No E2E tests** for core financial, governance, or communication journeys

**Recommendation:** Fix P0 immediately, then stabilize in 5 vertical slices targeting the highest-risk journeys.

---

## Consolidated Findings (Deduplicated)

### P0 — Critical (1)

| ID | Finding | Module | Evidence | Source |
|----|---------|--------|----------|--------|
| F-01 | `POST /api/association/member/credits/void-event` called by frontend but endpoint doesn't exist | Credits/Events | `features/events/components/post-event-actions.tsx:236` → 404 | CD-01, BJ-01 |

### P1 — Major (18)

| ID | Finding | Module | Role | Severity | Source |
|----|---------|--------|------|----------|--------|
| F-02 | No membership-status check on member routes — lapsed/suspended members access active features | Membership | Lapsed/suspended | P1 | PG-01 |
| F-03 | `POSITION_NAV_CONFIG` missing VP, board-member, staff, generic officer — empty sidebar | Navigation | VP/board/staff/officer | P1 | PG-02/03/04/08 |
| F-04 | Admin `ROUTE_ROLES` only in sidebar filter, not `beforeLoad` — direct URL bypass | Admin | analyst/support | P1 | PG-06, BJ-07 |
| F-05 | No E2E officer ALLOW tests — only deny verified | Roles | All officers | P1 | PG-09 |
| F-06 | No admin per-role E2E tests | Admin | super/support/analyst | P1 | PG-10 |
| F-07 | Cross-org write IDOR untested — only GET tested | Security | Officers | P1 | PG-11 |
| F-08 | Dues payment recording: no behavior test | Dues | Treasurer | P1 | Audit 04/07 |
| F-09 | Refund processing: no behavior test | Dues | Treasurer | P1 | Audit 04/07 |
| F-10 | Election vote casting: no behavior test | Elections | Members | P1 | Audit 04/07 |
| F-11 | Officer term assignment: no test | Officers | President | P1 | Audit 04/07 |
| F-12 | Announcement broadcast: no behavior test | Communications | Secretary | P1 | Audit 04/07 |
| F-13 | Member import: no test | Membership | Secretary | P1 | Audit 04/07 |
| F-14 | Application processing: no behavior test | Membership | Secretary | P1 | Audit 04/07 |
| F-15 | SDK codegen out of sync — bulk-approve uses raw fetch | SDK | Officers | P1 | CD-02 |
| F-16 | Officer reviews sidebar link → 404 (route missing) | Navigation | Officers | P1 | BN-01, BJ-02 |
| F-17 | Feature flag delete — no confirmation dialog | Admin | super | P1 | BI-02 |
| F-18 | Start/end election voting — no confirmation | Elections | President | P1 | BI-09 |
| F-19 | Navigation smoke: 60% of routes have no E2E | Navigation | All | P1 | Audit 03/08 |

### P2 — Important (16)

| ID | Finding | Module | Source |
|----|---------|--------|--------|
| F-20 | Response envelope inconsistency (`.data` vs `.items` vs flat) | API Contract | CD-03/04 |
| F-21 | 30+ `api.get/post` calls bypass SDK hooks | SDK | CD-07 |
| F-22 | 6 `as any` type casts in dues components | Types | CD-08 |
| F-23 | Training form uses manual `useState` (not react-hook-form) | Forms | FG-01 |
| F-24 | Org settings form uses manual `useState` | Forms | FG-02 |
| F-25 | No "unsaved changes" warning on forms | UX | FG-04 |
| F-26 | NPS modal submit: silent error | Surveys | BI-01 |
| F-27 | Form double-submit: debounce missing on person forms | UX | BI-07 |
| F-28 | Error state missing on 63% of routes | UX | Audit 03 |
| F-29 | Empty state missing on 74% of routes | UX | Audit 03 |
| F-30 | Not-found handling missing on 78% of detail routes | UX | Audit 03 |
| F-31 | No 404 page for admin app | Admin | BN-02 |
| F-32 | Table accessibility (ARIA roles) missing on custom tables | A11y | TG-02 |
| F-33 | Officer role cached 5min — stale permissions window | Auth | PG-15 |
| F-34 | 2FA enforcement skipped in dev — untestable | Auth | PG-13 |
| F-35 | Impersonation write-block: middleware-level test missing | Security | PG-07 |

### P3 — Cleanup (5)

| ID | Finding | Source |
|----|---------|--------|
| F-36 | Inline Zod schemas not centralized | FG-05 |
| F-37 | Member table TODO: dynamic credit requirements | BI-03 |
| F-38 | Dues export lacks error display | BI-06 |
| F-39 | `patient`/`provider` AC statements in AMS codebase | PG-12 |
| F-40 | 12 stub E2E test files excluded from suite | Audit 01 |

---

## Recommended Vertical Slices

### Slice 1: P0 Fix + Financial Journey Stabilization

**Goal:** Fix broken credit void feature + ensure financial operations have behavior tests

| Attribute | Detail |
|-----------|--------|
| **Scope** | Implement void-event-credits endpoint, test payment recording, refund processing |
| **Findings** | F-01, F-08, F-09 |
| **Roles** | Treasurer, President, Member |
| **Routes** | `/org/:slug/officer/finances/*`, `/org/:slug/dues` |
| **APIs** | `POST /api/association/member/credits/void-event` (implement), `POST /api/dues/payments/record`, `POST /api/dues/refunds` |
| **Files** | `services/api-ts/src/handlers/association:member/` (new endpoint), `features/events/components/post-event-actions.tsx`, `features/dues/components/record-payment-form.tsx`, `features/dues/components/refund-form.tsx` |
| **Tests** | API integration: void-event, record-payment, refund. E2E: payment journey, refund journey |
| **Acceptance** | Void-event returns 200. Payment recorded and balance updated. Refund issues and fund reversed. All with position enforcement |
| **Priority** | **FIRST — contains the only P0** |

### Slice 2: Role Enforcement Hardening

**Goal:** Close permission enforcement gaps in frontend and backend

| Attribute | Detail |
|-----------|--------|
| **Scope** | Add POSITION_NAV_CONFIG for missing roles, enforce ROUTE_ROLES in admin `beforeLoad`, add cross-org write IDOR tests |
| **Findings** | F-03, F-04, F-05, F-06, F-07 |
| **Roles** | VP, board-member, staff, generic officer, analyst, support |
| **Routes** | Officer sidebar, admin routes |
| **APIs** | All write endpoints (IDOR test), admin routes |
| **Files** | `config/position-nav.ts`, `apps/admin/src/routes/__root.tsx` (add beforeLoad guards), `apps/admin/src/routes/*.tsx` (per-route guards) |
| **Tests** | Component: nav config renders for all positions. E2E: officer allow tests, admin per-role tests, cross-org write IDOR. API: POST/PATCH/DELETE to wrong org → 403 |
| **Acceptance** | VP/board/staff/officer see correct nav. Analyst gets 403 on super-only routes via direct URL. Cross-org writes blocked. |
| **Priority** | **SECOND — security + UX risk** |

### Slice 3: Governance Journey Stabilization

**Goal:** Test election lifecycle, officer management, application processing

| Attribute | Detail |
|-----------|--------|
| **Scope** | Add behavior tests for elections, officer term CRUD, membership applications |
| **Findings** | F-10, F-11, F-14, F-18 |
| **Roles** | Member (voter), President, Secretary |
| **Routes** | `/org/:slug/elections/*`, `/org/:slug/officer/elections/*`, `/org/:slug/officer/officers`, `/org/:slug/officer/applications` |
| **APIs** | `POST /api/elections/:id/vote`, `POST /api/elections`, `PATCH /api/elections/:id`, `POST/DELETE /api/association/member/officer-terms`, `PATCH /api/membership/applications/:id` |
| **Tests** | API: vote (happy + double-vote + wrong status), election state machine, officer term CRUD, application approve/reject. E2E: voting journey, election lifecycle, officer assignment, add confirmation dialog to start/end voting |
| **Acceptance** | Votes recorded correctly, no double-votes. Election transitions validated. Officer assignment/removal works. Applications approve → active member. |
| **Priority** | **THIRD — governance integrity** |

### Slice 4: Communication + Navigation Stabilization

**Goal:** Test announcements, fix broken links, smoke-test all routes

| Attribute | Detail |
|-----------|--------|
| **Scope** | Announcement behavior tests, remove/fix broken reviews nav link, navigation smoke E2E |
| **Findings** | F-12, F-13, F-15, F-16, F-17, F-19 |
| **Roles** | Secretary, all roles |
| **Routes** | All routes (smoke), officer comms, officer reviews (broken) |
| **APIs** | `POST /api/announcements`, `POST /api/membership/import` |
| **Files** | `officer-sidebar.tsx` (remove/fix reviews link), all route files |
| **Tests** | API: announcement send, member import. E2E: all-routes smoke test, feature-flag delete confirmation. Fix: SDK codegen sync |
| **Acceptance** | Announcements delivered. Import creates members. All routes render without error. No broken sidebar links. Feature flag delete has confirmation. |
| **Priority** | **FOURTH — completeness** |

### Slice 5: Frontend Resilience

**Goal:** Add error/empty/not-found states, fix form inconsistencies

| Attribute | Detail |
|-----------|--------|
| **Scope** | ErrorBoundary on routes, empty states, not-found on detail routes, form pattern cleanup |
| **Findings** | F-23, F-24, F-26, F-28, F-29, F-30, F-31 |
| **Roles** | All |
| **Routes** | All detail routes (`$id`), admin catch-all |
| **Files** | Route files, training-form, org-settings-form, nps-modal |
| **Tests** | Component: error boundary renders, empty state renders. E2E: invalid ID shows not-found, admin 404 page |
| **Acceptance** | No blank pages on API errors. Invalid IDs show friendly message. Admin has 404 page. Training form uses react-hook-form. NPS modal shows error toast. |
| **Priority** | **FIFTH — UX resilience** |

---

## Product Decisions Needed

| Question | Affected Finding | Why Needed | Suggested Owner |
|----------|-----------------|-----------|-----------------|
| Should lapsed/suspended members be blocked from accessing org features? | F-02 | Currently auth-only, no status check | Product owner |
| What nav sections should VP, board-member, staff, and generic officer see? | F-03 | POSITION_NAV_CONFIG only has 4 entries | Product owner |
| Is 5-minute officer role cache acceptable? Or should it be shorter/realtime? | F-33 | Stale permissions window | Product owner |
| Are `patient`/`provider` access control statements still relevant? | F-39 | Healthcare AC in AMS codebase | Product owner |
| Should the officer reviews feature exist? (sidebar link but no route) | F-16 | Link to non-existent page | Product owner |
| What should the admin 404 page show? | F-31 | No catch-all route | Product owner |

---

## Implementation Readiness

**Status: READY TO BEGIN**

All 8 audits complete. All gates passed. Findings consolidated and deduplicated.

**Start with:** Slice 1 (P0 Fix + Financial Journey Stabilization)
- Contains the only P0 (broken void-event-credits endpoint)
- Financial operations are highest-risk untested area
- Clear scope: 3 endpoints, 2 forms, 1 new endpoint to implement

**To begin implementation, run:**
```
docs/audits/mapping-audit/prompts/10-tdd-execution-gate-prompt.md
```
targeting Slice 1.

---

## Final Orchestrator Status Dashboard

| Audit | Status | Gate | Artifact |
|-------|--------|------|----------|
| 01 — Brownfield Baseline | COMPLETE | PASS | `00_BROWNFIELD_BASELINE_AUDIT.md` |
| 02 — Role Permission Map | COMPLETE | PASS | `01_ROLE_PERMISSION_MAP_AUDIT.md` |
| 03 — Route Navigation | COMPLETE | PASS | `02_ROUTE_NAVIGATION_AUDIT.md` |
| 04 — Frontend Interaction Integrity | COMPLETE | PASS | `03_FRONTEND_INTERACTION_INTEGRITY_AUDIT.md` |
| 05 — Form/Modal/Table Action | COMPLETE | PASS | `04_FORM_MODAL_TABLE_ACTION_AUDIT.md` |
| 06 — Backend API Contract Alignment | COMPLETE | PASS | `05_BACKEND_API_CONTRACT_ALIGNMENT_AUDIT.md` |
| 07 — Role-Based Journey Map | COMPLETE | PASS | `06_ROLE_BASED_JOURNEY_MAP_AUDIT.md` |
| 08 — Test Confidence Gap | COMPLETE | PASS | `07_TEST_CONFIDENCE_GAP_AUDIT.md` |
| 09 — Prioritized Stabilization Plan | COMPLETE | PASS | `08_PRIORITIZED_STABILIZATION_PLAN.md` |

**All 9 audits complete. All gates passed. Implementation pending user authorization.**
