# AHA Fix-Ready Plan: Auth/RBAC enforcement

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Auth/RBAC enforcement |
| Module slug | auth-rbac |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/auth-rbac-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/auth-rbac-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS (carried from gap plan §24) |
| Superpowers used | No (organizer reasoning sufficient; not invoked for this organize-only pass) |
| Organizer decision | PARTIALLY READY |
| Reason | Four P1 enforcement gaps (G1, G2, G4) plus the doc-as-spec fix (G5) and the negative-test pack (G6) are evidence-backed and safe to fix now via small, isolated batches. G3 (TypeSpec session-role provisioning) is **blocked on a product decision** and must not be batched with the others. Several P2/P3 items are deferred or cleanup-only. |
| Limitations | (1) Static review only — `requireOfficerTerm` 2FA gap (G2) verified by reading `core/auth/officer-checks.ts` directly; NODE_ENV-gated 2FA paths cannot be exercised without a production env, so the G2 test must simulate `NODE_ENV=production` like `require-officer.test.ts`. (2) `[NEEDS CONFIRMATION]` items in the gap plan (real role-provisioning path for G3; whether `requireActiveStatus`/`requireTenantAccess` have callers; committee guard) were NOT re-audited — organizer respects the gap plan. (3) Correction to gap plan recorded in §12: `requireOfficerTerm` has no title information at its call sites (it only verifies term existence, no title filter), so the G2 2FA fix must resolve the officer's actual privileged titles from the already-fetched terms before enforcing — this is a real implementation nuance, not a copy of the `requirePosition` block. |

## 2. Fix Strategy Summary

**What to fix first:** Batch A (P1 enforcement + the doc-as-spec correction). The core member/officer/admin separation already works (gap plan §24 confirms PARTIAL PASS, not FAIL), so these are targeted privilege-escalation / trust gaps, not a rebuild.

The recommended sequence inside the active scope:

1. **Batch D first (RED tests)** — write the negative RBAC contract/unit tests for G1, G2, G4 *before* touching enforcement code, so each fix is locked by a failing test. This is the gap plan author's explicit recommendation (§26).
2. **Batch A (enforcement fixes)** — G1 (super-only guard on 5 platformadmin handlers), G2 (2FA branch in `requireOfficerTerm`), G4 (officer gate on `POST /invite`). All three are small, module-local-ish, and follow existing patterns already in the codebase (`createAssociation.ts:21-22`, `requirePosition` 2FA block, `requireOfficerTerm` itself).
3. **Batch G (doc/spec correction)** — rewrite `ROLE_PERMISSION_MATRIX.md` §2/§4/§5/§3.28 to describe the actual mechanisms. Do this **early** because every other module audit consumes this matrix as acceptance criteria (gap plan §26, §21). Doc-only, no code risk.

**What NOT to fix now:**
- **G3** (TypeSpec session-role strings `association:admin`/`platform_admin`/`national_officer`) is `[NEEDS PRODUCT DECISION]` — provision the roles vs. strip the gates. It also touches TypeSpec + `scripts/generate.ts` regeneration (whole-`routes.ts` blast radius). Hold for a separate `04` pass after the product decision.
- Matrix §5 hierarchy enforcement, generic policy engine, `client`/`host` role expansion → **Do Not Build** (gap plan §23).
- Dead-code deletion (`officerAuthMiddleware`, `requireOrgRole`/`hasMinimumRole`) → cleanup batch, only **after** the matrix rewrite lands.

**Major risks:** (1) G2's 2FA enforcement is production-gated, so a shallow test would pass without proving anything — the test MUST simulate `NODE_ENV=production`. (2) G1 must guard exactly the 5 super-only handlers without accidentally locking analyst/support out of legitimately-allowed reads. (3) G4 touches the invite module (cross-module ownership: enforcement rule is auth-rbac's, file is invite's).

**One pass or multiple?** Multiple. Batch A + Batch D + Batch G can run in **one `04` pass** (small, related, all P1, no shared-platform regeneration). G3 and the cleanup batch are **separate later passes**.

**Shared/platform/database work required?** No schema change. One shared-platform touch only if G3 is later executed (TypeSpec + generator regen) — explicitly out of the first pass. `officer-checks.ts` ideally swaps its direct `OfficerTermRepository` import for the governance port, but the organizer keeps that **out of the first batch** to avoid scope creep (note in §7).

**Product decisions / environment blockers?** G3 (product decision), impersonation super-vs-support (product decision), 403 security-event logging (product decision). No environment blockers for Batch A/D/G.

## 3. Active Fix Scope

Only P0/P1/selected P2/V1 REQUIRED/selected V1 RECOMMENDED items.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G1 — Super-only platform mutations callable by analyst/support: `createOrganization`, `setFeatureFlag`, `deleteFeatureFlag`, `transitionOrgStatus`, `updateOrganization` have no admin-role check | P1 | V1 REQUIRED | Batch A | Privilege escalation inside the admin tier; analyst (read-only by spec §3.7) can create orgs, flip feature flags, transition org lifecycle | `handlers/platformadmin/createOrganization.ts` (no role check — verified: grep for role/super/403 returns nothing); `createAssociation.ts:21-22` has the correct `callerAdmin.role !== 'super'` pattern; matrix §3.7 |
| FIX-002 | G2 — Inline `requireOfficerTerm` performs no 2FA enforcement although its file docstring claims both functions do; routes guarded only by `requireOfficerTerm` let privileged officers without 2FA act in production | P1 | V1 REQUIRED | Batch A | Defeats matrix §4 / m01 2FA trust commitment on the inline-checked subset of handler files | `core/auth/officer-checks.ts:10-11` (claim) vs `:26-46` (`requireOfficerTerm` body — no 2FA branch, verified); `:99-107` (`requirePosition` HAS the branch); compare `middleware/require-officer.ts` |
| FIX-003 | G4 — Any active org member can create invitations; m01 §6 restricts to president/secretary/officer | P1 | V1 REQUIRED | Batch A | Spam/abuse vector; violates m01 §6 permission table | `handlers/invite/createInvite.ts:16-20` (only user + orgId checks — verified: `createdByOfficer: user.id` set without any officer-term gate); `app.ts:448` mounts membership-only middleware |
| FIX-004 | G5 — `ROLE_PERMISSION_MATRIX.md` documents dead/phantom enforcement: `officerAuthMiddleware` (§2/§4), `hasMinimumRole` (§5), `requireCommitteeRole` (§3.28) | P1 (doc/trust) | V1 REQUIRED | Batch G | The matrix is the primary RBAC acceptance reference for every other module audit; auditors/devs trust phantom layers | `officerAuthMiddleware` zero mounts (verified: grep in `app.ts` returns nothing); `utils/org-auth.ts hasMinimumRole` zero callers (gap plan §12); `requireCommitteeRole` absent (gap plan §4 row §3.28) |
| FIX-005 | G6 — No negative RBAC contract tests beyond `security-officer-auth.hurl`; permission regressions (incl. FIX-001..003) cannot be verified | P1 [TEST GAP] | V1 REQUIRED | Batch D | Locks FIX-001..003; `assoc-positions-flow.hurl`/`admin-flow.hurl`/`platformadmin-extended-flow.hurl` have 0× `HTTP 403` | gap plan §20, §6 G6; `security-officer-auth.hurl` (8× 403) is the only negative file |
| FIX-006 | m01 §6 import roster — `bulkImportMembers` checks any officer term, no president/secretary title filter, no 2FA | P2 | V1 RECOMMENDED | Batch C | Roster import is a high-impact bulk mutation; spec restricts to president(2FA)/secretary(2FA)/super; low-risk fix using existing `requirePosition` | `handlers/invite/bulkImportMembers.ts:88-89`; m01 §6 |
| FIX-007 | G7 — `auth-gate-coverage.test.ts` tests pure functions re-defined inside the test file, not production code (fake-green coverage) | P2 [TEST GAP] | V1 RECOMMENDED | Batch D | Coverage metric counts it as auth-gate protection; it protects nothing in `src` | `handlers/auth-gate-coverage.test.ts` defines `canPublishAnnouncement` etc. locally (gap plan §6 G7, §19) |
| FIX-008 | G8 — org-context platform-admin bypass grants full `role:'admin'` org-member access to ALL admin tiers (analyst included) in any org | P2 | V1 RECOMMENDED | Batch C | Combined with FIX-001, widens analyst surface; should be tier-aware after FIX-001 | `middleware/org-context.ts` admin bypass block (`role:'admin'`, any orgId); gap plan §10 G8 |
| FIX-009 | Public-path exemption uses `startsWith` prefix match (matrix/§14) | P3 | V1 RECOMMENDED | Batch C | Low-risk, low-cost hardening: prevents future accidental exemption of a route under a public prefix subtree | `app.ts:419-423`; gap plan §14 |
| FIX-010 | `INVITE_TOKEN_SECRET` falls back to `'dev-secret-change-in-production'` | P2 | V1 RECOMMENDED | Batch E | Predictable invite-token secret in any misconfigured prod = forgeable invites; fail-fast in prod config validation | `handlers/invite/createInvite.ts:40`; gap plan §13 [SHARED DEPENDENCY: core/config.ts] |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch D | Test hardening / regression coverage — write the RED negative-RBAC tests first, plus rebind the fake-green coverage test | FIX-005, FIX-007 | Low (tests only) | **Run first, in the current `04` pass** — write the RED tests for FIX-001/002/003 before their implementation |
| Batch A | P1 enforcement / permission gaps | FIX-001, FIX-002, FIX-003 | Medium (touches platformadmin handlers, core/auth, invite handler — all follow existing patterns) | **Run in the current `04` pass**, immediately after the Batch D RED tests for these IDs exist |
| Batch G | Doc/spec correction — rewrite matrix §2/§4/§5/§3.28 to actual mechanisms | FIX-004 | Low (doc-only, no code) | **Run in the current `04` pass** (or immediately after) — do early; downstream audits consume the matrix |
| Batch C | Selected P2/P3 V1 completeness + hardening | FIX-006, FIX-008, FIX-009 | Low–Medium | **Later** — separate `04` pass after Batch A lands (FIX-008 depends on FIX-001 being in place) |
| Batch E | Shared/platform dependency fix — fail-fast on `INVITE_TOKEN_SECRET` default in production | FIX-010 | Low–Medium (touches `core/config.ts` — shared; could affect any consumer reading config at boot) | **Later** — only after shared `core/config.ts` validation pattern is confirmed; isolate from module-local batches |
| Batch F | Database/schema dependency fix | (none) | — | Not applicable — no schema change required for any active fix |
| Batch B (deferred) | Cleanup: delete dead `officerAuthMiddleware` + test; deprecate `requireOrgRole`/`hasMinimumRole` | (deferred — see §10) | Low | **Only after Batch G** (matrix rewrite) lands, so docs no longer reference the deleted code |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | analyst/support token → `403` on `POST /admin/organizations` (createOrganization), `setFeatureFlag`, `deleteFeatureFlag`, `transitionOrgStatus`, `updateOrganization`; super token → success | permission/RBAC (contract) + backend/unit | Non-super platform-admins are rejected on each of the 5 super-only mutations; super still passes | Contract: extend the `platformadmin-extended-flow.hurl` / `admin-flow.hurl` family in `specs/api/tests/contract/`. Unit: co-locate with each handler, e.g. `handlers/platformadmin/createOrganization.test.ts` (asserts `role !== 'super'` → 403) |
| FIX-002 | `requireOfficerTerm` with a president-without-2FA officer under `NODE_ENV=production` → `403`; same user with 2FA → allowed; dev env → allowed | permission/RBAC (backend/unit) | The inline path enforces 2FA for privileged titles in production (currently it does NOT — this test is RED until the fix) | Extend `core/auth/officer-checks.test.ts` (currently lacks a 2FA case for `requireOfficerTerm` — that absence is why G2 survived). Follow the `NODE_ENV=production` simulation pattern in `middleware/require-officer.test.ts` |
| FIX-003 | member token (active org member, no officer term) → `POST /invite` → `403`; officer token → `201` | permission/RBAC (contract) | Only officers can issue invites | Contract: new scenario in `specs/api/tests/contract/` (extend the `security-officer-auth.hurl` family or an invite-flow file). Unit: `handlers/invite/createInvite.test.ts` if one exists; else co-locate |
| FIX-004 | n/a (documentation rewrite — no test) | — | — | n/a (doc-only) |
| FIX-005 | The negative-RBAC contract pack itself (the tests for FIX-001/002/003 above) + a route-registry regression assertion: every officer-gated TypeSpec op emits `requireOfficer`/`requirePosition` middleware in `routes.ts` | permission/RBAC (contract) + regression (backend/unit) | Permission regressions are caught; extensions aren't silently lost on regeneration | Contract files in `specs/api/tests/contract/`; regression unit test reading `generated/openapi/routes.ts` (new test location, e.g. `middleware/route-registry-rbac.test.ts`) |
| FIX-006 | non-privileged officer (not president/secretary) → `bulkImportMembers` → `403`; president/secretary with 2FA → allowed | permission/RBAC (backend/unit) | Roster import restricted to privileged titles with 2FA | Co-locate `handlers/invite/bulkImportMembers.test.ts` |
| FIX-007 | Rebind existing assertions to real production functions/handlers (or relabel file as documentation-only) | backend/unit | Coverage reflects real `src` behavior, not test-local functions | Rewrite `handlers/auth-gate-coverage.test.ts` in place |
| FIX-008 | analyst token in org-context → asserts read-only / tier-aware bypass behavior decided alongside fix | backend/unit | Analyst does not silently get `role:'admin'` write-level org access in arbitrary orgs | Extend `middleware/org-context.test.ts` |
| FIX-009 | request to a route under a public prefix but NOT itself public → `401` when unauthenticated | backend/unit | Prefix-match exemption can't accidentally exempt a private route | Extend `middleware/auth.test.ts` or `middleware/custom-routes-auth.test.ts` |
| FIX-010 | production config with default `INVITE_TOKEN_SECRET` → boot/validation throws; non-default → ok | data/schema (config) backend/unit | Server refuses to start in production with the dev-default secret | New/extended config test, e.g. `core/config.test.ts` |

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `services/api-ts/src/handlers/platformadmin/{createOrganization,setFeatureFlag,deleteFeatureFlag,transitionOrgStatus,updateOrganization}.ts`; optionally a new shared `requireAdminRole(ctx, ['super'])` helper (e.g. `core/auth/admin-role-check.ts`) | module-local (platformadmin); helper is platform-admin-scoped, not global | Small — only the 5 named handlers; helper reused by `createAssociation.ts` pattern |
| FIX-002 | `services/api-ts/src/core/auth/officer-checks.ts` (`requireOfficerTerm` function) | shared/platform (core/auth — consumed by the inline-check subset of 64 handler files) | Medium — every handler that inline-calls `requireOfficerTerm` gains the 2FA branch in production. This is the intended behavior, but verify no privileged-title handler relied on the missing check |
| FIX-003 | `services/api-ts/src/handlers/invite/createInvite.ts` (add inline `requireOfficerTerm(ctx)` after orgId resolution) | cross-module (file is invite's; rule is auth-rbac's) | Small — single handler |
| FIX-004 | `docs/product/ROLE_PERMISSION_MATRIX.md` (§2, §4, §5, §3.28) | shared/platform (doc consumed by all module audits) | Doc-only — high *informational* reach (every downstream audit), zero code risk |
| FIX-005 | `specs/api/tests/contract/*.hurl` (new + extended); new `middleware/route-registry-rbac.test.ts` | module-local (tests) | Test-only |
| FIX-006 | `services/api-ts/src/handlers/invite/bulkImportMembers.ts` (swap term check for `requirePosition(ctx, ['President','Secretary'])`) | module-local (invite); uses shared `core/auth` helper | Small — single handler |
| FIX-007 | `services/api-ts/src/handlers/auth-gate-coverage.test.ts` | module-local (tests) | Test-only |
| FIX-008 | `services/api-ts/src/middleware/org-context.ts` (admin bypass block) | shared/platform (middleware mounted on all `/association/*`) | Medium — touches the global org-context path; needs careful test before/after |
| FIX-009 | `services/api-ts/src/app.ts` (public allowlist match logic, ~lines 419-423) | shared/platform (app wiring) | Low–Medium — affects which routes are treated public; verify all current public prefixes still resolve |
| FIX-010 | `services/api-ts/src/core/config.ts` (production validation) + `handlers/invite/createInvite.ts:40` (consume validated secret) | shared/platform (config) | Medium — config validation runs at boot for all consumers |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001 | shared/platform | `platform_admin` table + `ctx.get('platformAdmin')` role (set by `platformAdminAuthMiddleware`) | The fix reads `callerAdmin.role` exactly like `createAssociation.ts:21-22`; no schema change | No — pattern already exists |
| FIX-002 | cross-module | `GovernancePort` / `OfficerTermRepository` (association:member governance) | `requireOfficerTerm` reads governance data to find active terms; to enforce 2FA it must determine whether any active term is a privileged title. **Correction (see §12):** `requireOfficerTerm` already fetches `terms` (line 39) but does not currently inspect titles — the 2FA fix needs to read `term.positionTitle` against `PRIVILEGED_POSITIONS` | No — data already fetched; fix is local to the function |
| FIX-002 | cross-module | `officer-checks.ts` imports `OfficerTermRepository` directly (line 14) rather than via the governance port | Gap plan §26 suggests swapping to the port (S-C4-014 pattern). Organizer recommends keeping this **out of the first batch** to avoid scope creep — do the 2FA fix minimally, leave the port migration as an optional follow-up | No — keep minimal |
| FIX-003 | cross-module | `handlers/invite/createInvite.ts` owned by invite module; enforcement rule owned by auth-rbac | Coordinate with invite/auth-onboarding; the fix is a single inline `requireOfficerTerm` call | No |
| FIX-004 | product decision (light) | `ROLE_PERMISSION_MATRIX.md` rewrite | Other module audits cite it as acceptance criteria; rewrite early | Should be done early, independent of code fixes |
| FIX-005 | shared/platform | Generator `scripts/generate.ts` → `generated/openapi/routes.ts` (read-only for the regression assertion) | The route-registry regression test READS the generated routes; it does not regenerate | No |
| FIX-008 | shared/platform | `middleware/org-context.ts` mounted on all `/association/*` | Tier-aware bypass changes global org access for admins; pair with FIX-001 | After FIX-001 |
| FIX-010 | shared/platform | `core/config.ts` production validation | Fail-fast pattern must match existing config validation conventions | Confirm config-validation pattern first |
| (G3 — NOT active) | product decision + shared/platform | TypeSpec `x-security-required-roles` + `scripts/generate.ts` regeneration | G3 fix would regenerate `routes.ts` across modules (large diff) and depends on the role-provisioning product decision | Blocked — see §8, §9 |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Should `association:admin` / `association:staff` / `platform_admin` / `national_officer` be provisioned onto `user.role` in production flows, or should the `x-security-required-roles` gates be removed from accredited-providers + national-dashboard ops? | `[NEEDS PRODUCT DECISION]` + `[NEEDS CONFIRMATION]` | G3 (NOT in active scope) | Either legitimate officers are 403'd (accredited-providers CRUD) or the gate enforces nothing; seeds (`seed/layer-2-users.ts:350`) mask it in CI | Decide canonical role model first; then a separate `04` pass touches TypeSpec + regen. Do NOT seed more roles as a "fix" |
| Should `support` admins be allowed to impersonate, or super only? | `[NEEDS PRODUCT DECISION]` | (impersonation divergence — deferred §10) | Code allows `['super','support']`; matrix + admin UI say super only | Align matrix to code, or code to matrix; product call |
| Should denied (403) attempts on privileged routes emit security/audit events? | `[NEEDS PRODUCT DECISION]` | (403 security-event logging — deferred §10) | Audit currently skips non-2xx by design; healthcare-adjacent compliance posture | Confirm against THREAT_MODEL before any work |
| Should analyst retain the org-context membership bypass at all (read-everything posture)? | `[NEEDS PRODUCT DECISION]` | FIX-008 | Determines whether tier-aware bypass should be read-only or removed for analyst | Confirm analyst data-access scope; then implement FIX-008 in Batch C |
| What guard do committee handlers actually use (matrix §3.28 cites nonexistent `requireCommitteeRole`)? | `[NEEDS CONFIRMATION]` `[CROSS-MODULE RISK]` | FIX-004 (matrix §3.28 wording) | Matrix accuracy; belongs to committee-management audit | Verify during committee-management audit; for FIX-004, document §3.28 as "verify actual guard" rather than inventing one |
| Are `requireActiveStatus` / `requireTenantAccess` called anywhere? | `[NEEDS CONFIRMATION]` | (org-auth cleanup — deferred §10) | Determines cleanup scope for `utils/org-auth.ts` | Verify before the cleanup batch deletes/deprecates exports |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| G3 — TypeSpec session-role gates (`association:admin`/`association:staff` on accredited-providers; `platform_admin`/`national_officer` on national-dashboard) | `[NEEDS PRODUCT DECISION]` + `[NEEDS CONFIRMATION]` + `[SHARED DEPENDENCY]` | Requires a product decision (provision roles vs. remove gates) AND touches TypeSpec + `scripts/generate.ts` regeneration (whole `routes.ts` diff). Too risky to batch with module-local enforcement fixes | Product decision on role model; then a dedicated `04` pass with regen review |
| Impersonation super-vs-support divergence | `[NEEDS PRODUCT DECISION]` | Code allows support; matrix/admin-UI say super only — direction unknown | Product decision |
| 403 security-event logging on privileged routes | `[NEEDS PRODUCT DECISION]` | Conflicts with audit-on-success-only design; needs compliance driver | THREAT_MODEL confirmation |
| Committee-scoped role guard (matrix §3.28) | `[NEEDS CONFIRMATION]` `[CROSS-MODULE RISK]` | `requireCommitteeRole` doesn't exist; actual guard unverified; owned by committee-management | committee-management audit confirms the real guard |
| `INVITE_TOKEN_SECRET` fail-fast (FIX-010) — execution gating | `[SHARED DEPENDENCY]` | Touches shared `core/config.ts`; isolate into Batch E and confirm the existing config-validation convention first | Confirm config-validation pattern; run as isolated Batch E |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Delete dead `officerAuthMiddleware` (`middleware/officer-auth.ts`) + its 155-line test | §12, G5/G9 | V1 RECOMMENDED (cleanup) | Must wait until matrix rewrite (FIX-004) no longer references it; pure cleanup, no functional gain |
| Deprecate/remove `requireOrgRole` / `hasMinimumRole` (`utils/org-auth.ts`, zero callers) | §12, G5 | V1 RECOMMENDED (cleanup) | Same — after matrix §5 rewrite; confirm no callers (incl. `requireActiveStatus`/`requireTenantAccess`) first |
| G9 — 2FA dev-skip divergence (dead middleware always enforces; live paths NODE_ENV-gated) | §10 G9 | V1 RECOMMENDED | Resolves automatically when dead `officerAuthMiddleware` is removed in the cleanup batch |
| Tier-aware org-context admin bypass for analyst (FIX-008) — could also be deferred if no product decision | G8 | V1 RECOMMENDED | Kept in Batch C but depends on the analyst-bypass product decision (§8) |
| Align impersonation roles (super vs support) | §14 | `[NEEDS PRODUCT DECISION]` | Blocked on product decision (§8/§9) |
| Swap `officer-checks.ts` direct `OfficerTermRepository` import for governance port | §26, §21 | V2 DEFERRED `[DO NOT OVERBUILD]` for first pass | Architecturally nice but not required for the G2 fix; keep FIX-002 minimal |
| Reconcile `ORPHANED: /dues/funds/{orgId}` contract target with `HAND_WIRED_ROUTES.yaml` | §12 | V2 DEFERRED `[SHARED DEPENDENCY: api-contract-pipeline]` | Belongs to api-contract-pipeline reconciliation, not auth-rbac enforcement |
| Define canonical `user.role` vocabulary (comma-separated mixed strings) | §13 | V2 DEFERRED | Documentation/model decision; relates to G3 (blocked); not required for Batch A |
| Session-cached officer roles (perf) | §23 | V2 DEFERRED | Per-request DB lookup gives correct instant revocation; no perf evidence |
| 403 security-event audit stream | §15, §23 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | Audit-on-success is the designed contract; needs THREAT_MODEL driver |
| Admin-app server-side route gating (SSR/edge) | §23 | V2 DEFERRED | Client gate + backend 403 is acceptable defense-in-depth for V1 |
| Committee-scoped role middleware generalization | §23 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | First confirm what committee handlers actually do |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Matrix §5 hierarchy enforcement (wire `hasMinimumRole`, build 8-level org-role hierarchy) | §8 step row, §10 G5/§23 | Position-title model already covers real product needs; a parallel hierarchy creates duplicate sources of authority `[DO NOT OVERBUILD]` |
| Generic policy-engine / centralized RBAC service (Casbin-style) | §23 | Declarative-extension + port model is adequate; no evidence of need `[DO NOT OVERBUILD]` |
| Expand `client` / `host` / `:owner` role machinery in `authMiddleware` | §6, §12, §23 (matrix §6.5 "not currently used") | Healthcare-template leftovers; expanding adds dead complexity |
| Resurrect/mount `officerAuthMiddleware` as the §2 layer-2 enforcement | §3, §10 G5 | Live enforcement already exists via generated `requireOfficer`/`requirePosition` + inline checks; mounting dead middleware duplicates it. Fix the doc instead, then delete the dead code |
| Seed additional roles to make G3 gates pass | §21 | Would mask the production gap, not fix it — the gap plan explicitly warns against this |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Missing per-handler authorization check; the correct pattern (`callerAdmin.role !== 'super'`) exists in `createAssociation.ts:21-22` but was never applied to the 5 super-only mutation handlers. A shared `requireAdminRole(ctx, ['super'])` helper is the cleaner root-cause fix (6th+ usage) |
| FIX-002 | Root cause | `requireOfficerTerm` was written without the 2FA branch while its docstring claimed it had one. **Correction to gap plan §26 approach:** unlike `requirePosition`, `requireOfficerTerm` has no `allowedTitles` argument — it only checks term existence. So the 2FA fix must inspect the already-fetched `terms[].positionTitle` against `PRIVILEGED_POSITIONS` to decide whether 2FA is required, rather than copying `requirePosition`'s `normalizedAllowed`-based branch verbatim. This is a meaningful semantic difference, not a paste |
| FIX-003 | Root cause | `createInvite.ts` enforces authentication + org membership but never verifies officer status; the spec (m01 §6) requires officer/president/secretary. Adding an inline `requireOfficerTerm(ctx)` is the minimal root-cause fix |
| FIX-004 | Root cause (documentation) | The spec drifted from the implementation: it documents enforcement layers (`officerAuthMiddleware`, `hasMinimumRole`, `requireCommitteeRole`) that are dead or absent. Rewriting the matrix to the actual mechanism set fixes the root (spec-vs-code drift), not a symptom |
| FIX-005 | Root cause (test gap) | Negative-authorization coverage was never built beyond one file, so enforcement gaps (G1/G2/G4) went undetected. Adding the negative pack + a route-registry regression assertion addresses the root testing gap |
| FIX-006 | Root cause | `bulkImportMembers` uses a generic officer-term check instead of the title-filtered + 2FA `requirePosition` the spec requires |
| FIX-007 | Symptom-of-process / fake-green | The test exercises functions defined inside the test file, so it proves nothing about `src`. Rebinding (or relabeling) removes the false-positive coverage signal |
| FIX-008 | Root cause | `org-context` hardcodes `role:'admin'` for any platform admin regardless of tier, so analyst inherits write-level org access everywhere. Tier-aware bypass is the root fix (pending product decision on analyst scope) |
| FIX-009 | Symptom / hardening | `startsWith` prefix matching is currently safe (all listed prefixes are public subtrees) but is a latent footgun; tightening to exact/regex match is preventive hardening, not a live bug |
| FIX-010 | Root cause | A predictable default secret in production is forgeable; fail-fast config validation is the root fix (don't let the server boot with the dev default in prod) |

## 13. Recommended First Fix Batch

**Batch name:** Batch D (RED tests) + Batch A (P1 enforcement) + Batch G (matrix doc rewrite) — executed together in the first `04` pass, in that order.

**Included Fix IDs:** FIX-005 + FIX-007 (Batch D, tests first) → FIX-001, FIX-002, FIX-003 (Batch A) → FIX-004 (Batch G).

**Why this batch comes first:**
- These are the four evidence-confirmed P1 enforcement/trust gaps (G1, G2, G4) plus the doc-as-spec correction (G5) and the negative-test pack (G6) that the gap plan author explicitly sequenced first (§26).
- They are small, isolated, follow patterns already in the codebase, require **no schema change and no generator regeneration**, and have no product-decision blockers.
- FIX-004 (matrix rewrite) must land early because every other module audit consumes `ROLE_PERMISSION_MATRIX.md` as acceptance criteria — leaving phantom layers documented would propagate the error.

**Tests to write first (RED before implementation):**
1. analyst/support token → `403` on `createOrganization`, `setFeatureFlag`, `deleteFeatureFlag`, `transitionOrgStatus`, `updateOrganization` (FIX-001).
2. `requireOfficerTerm` president-without-2FA under `NODE_ENV=production` → `403` (FIX-002) — simulate prod env per `require-officer.test.ts`.
3. member token → `POST /invite` → `403` (FIX-003).
4. Route-registry regression: every officer-gated TypeSpec op emits `requireOfficer`/`requirePosition` middleware in `routes.ts` (FIX-005).
5. Rebind `auth-gate-coverage.test.ts` to real `src` functions (FIX-007).

**Explicit out-of-scope items for the first batch:**
- G3 / TypeSpec session-role gates — blocked on product decision (§8, §9).
- FIX-006, FIX-008, FIX-009 (Batch C) and FIX-010 (Batch E) — later passes.
- Dead-code deletion (`officerAuthMiddleware`, `requireOrgRole`/`hasMinimumRole`) — cleanup batch AFTER FIX-004 lands.
- Impersonation role alignment, 403 security-event logging — product decisions.
- Matrix §5 hierarchy, policy engine, `client`/`host` expansion — Do Not Build (§11).
- Do NOT migrate `officer-checks.ts` to the governance port in this batch — keep FIX-002 minimal.

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Auth/RBAC enforcement
- **Exact module slug:** `auth-rbac`
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/auth-rbac-fix-ready-plan.md`
- **Exact batch to execute first:** Batch D (RED tests for FIX-001/002/003 + FIX-005, FIX-007) → then Batch A (FIX-001, FIX-002, FIX-003) → then Batch G (FIX-004). Run these together in one `04` pass.
- **Tests to prioritize (write RED first):**
  1. analyst/support → 403 on the 5 super-only platformadmin handlers (FIX-001) — extend `specs/api/tests/contract/platformadmin-extended-flow.hurl` / `admin-flow.hurl` + co-located handler unit tests.
  2. `requireOfficerTerm` president-without-2FA under `NODE_ENV=production` → 403 (FIX-002) — extend `services/api-ts/src/core/auth/officer-checks.test.ts`, simulate prod env like `middleware/require-officer.test.ts`.
  3. member token → `POST /invite` → 403 (FIX-003) — extend the `security-officer-auth.hurl` family.
  4. Route-registry regression assertion (FIX-005); rebind `auth-gate-coverage.test.ts` (FIX-007).
- **Files likely to touch:**
  - `services/api-ts/src/handlers/platformadmin/{createOrganization,setFeatureFlag,deleteFeatureFlag,transitionOrgStatus,updateOrganization}.ts` (+ optional shared `core/auth/admin-role-check.ts` helper) — FIX-001.
  - `services/api-ts/src/core/auth/officer-checks.ts` (`requireOfficerTerm`) — FIX-002.
  - `services/api-ts/src/handlers/invite/createInvite.ts` — FIX-003.
  - `docs/product/ROLE_PERMISSION_MATRIX.md` (§2, §4, §5, §3.28) — FIX-004.
  - Tests under `specs/api/tests/contract/` and `services/api-ts/src/{core/auth,middleware,handlers}/`.
- **Shared/database cautions:**
  - No database/schema change for any first-batch fix (Batch F = none).
  - FIX-002 touches `core/auth/officer-checks.ts` (shared by the inline-check subset of ~64 handler files) — the 2FA branch is intended, but keep the fix minimal: read `terms[].positionTitle` against `PRIVILEGED_POSITIONS`; do NOT swap the direct `OfficerTermRepository` import for the governance port in this pass.
  - FIX-004 edits a shared doc consumed by all module audits — informational blast radius is high; do it early and accurately.
  - Do NOT regenerate `routes.ts` / touch TypeSpec in the first batch (that belongs to the blocked G3 pass).
- **Items NOT to implement:**
  - G3 / TypeSpec session-role gates — blocked on product decision (§8, §9).
  - FIX-006, FIX-008, FIX-009, FIX-010 — later batches (C/E), not the first pass.
  - Dead-code deletion (`officerAuthMiddleware` + test; `requireOrgRole`/`hasMinimumRole`) — cleanup batch only AFTER FIX-004 lands.
  - Impersonation super-vs-support change; 403 security-event logging — blocked product decisions.
  - Matrix §5 hierarchy enforcement, generic policy engine, `client`/`host`/`:owner` expansion, resurrecting `officerAuthMiddleware`, seeding extra roles for G3 — Do Not Build (§11).

---

Next recommended step:
Module/group: Auth/RBAC enforcement
Module slug: auth-rbac
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/auth-rbac-fix-ready-plan.md
Recommended batch: Batch D (RED tests) + Batch A (P1 enforcement) + Batch G (matrix rewrite)
