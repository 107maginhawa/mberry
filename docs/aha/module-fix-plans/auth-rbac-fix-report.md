# AHA Module/Group Fix Report: Auth/RBAC enforcement

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Auth/RBAC enforcement |
| Module slug | auth-rbac |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/auth-rbac-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/auth-rbac-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/auth-rbac-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch D (RED tests: FIX-005, FIX-007) + Batch A (FIX-001, FIX-002, FIX-003) + Batch G (FIX-004 matrix doc rewrite) |
| Superpowers used | Yes (`superpowers:using-superpowers` invoked at start) |
| Working tree status checked | Yes (`git status --short` — pre-existing dirty tree from 12 prior AHA modules; preserved) |
| Fix scope | P1 (FIX-001/002/003/004) + selected P2 test-hardening (FIX-005, FIX-007) — all V1 REQUIRED / V1 RECOMMENDED |
| Out of scope | G3 (TypeSpec session-role provisioning `[NEEDS PRODUCT DECISION]`), Batch C (FIX-006/008/009), Batch E (FIX-010), Batch B cleanup, impersonation role alignment, matrix §5 hierarchy enforcement, policy engine, dead-code deletion |
| Shared files touched | Yes — `core/auth/officer-checks.ts` (FIX-002, `[SHARED DEPENDENCY]`) and `docs/product/ROLE_PERMISSION_MATRIX.md` (FIX-004, shared doc) |
| Schema/migration touched | No |
| Limitations | (1) 2FA enforcement (FIX-002) is production-gated; verified by simulating `NODE_ENV=production` in unit tests (cannot exercise a live prod env). (2) `routes.ts` is asserted **read-only** by FIX-005; it was not modified by this pass (its `M` status in git is from prior AHA work). (3) Contract-level (Hurl) negative tests were NOT added — focused unit/permission tests were used instead, per the focused-validation directive (whole-suite not run). (4) FIX-004 §3.28 committee guard left as `[NEEDS CONFIRMATION]` (owned by committee-management audit) rather than inventing a guard — no product decision made. |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G1 — super-only platform mutations callable by analyst/support. **Full scope = FIVE handlers**: `createOrganization`, `setFeatureFlag`, `transitionOrgStatus` (gated during the platform-admin pass, see that report's `[SCOPE DEVIATION]`) **+ `deleteFeatureFlag`, `updateOrganization`** (the remaining ungated two) | P1 | V1 REQUIRED | Batch A | Privilege escalation inside admin tier; analyst (read-only by spec) could create orgs / flip flags / transition org lifecycle / **delete flags / patch orgs** | Fixed — **all 5 gated** (3 during platform-admin pass; `deleteFeatureFlag` + `updateOrganization` closed in the security follow-up, 2026-06-11) |
| FIX-002 | G2 — inline `requireOfficerTerm` performed no 2FA enforcement despite docstring claiming it | P1 | V1 REQUIRED | Batch A | Defeats matrix §4 / m01 2FA trust commitment on the inline-checked handler subset | Fixed |
| FIX-003 | G4 — any active org member could create invitations (m01 §6 restricts to officers) | P1 | V1 REQUIRED | Batch A | Spam/abuse vector; violated m01 §6 permission table | Fixed |
| FIX-004 | G5 — `ROLE_PERMISSION_MATRIX.md` documented dead/phantom enforcement (§2/§4/§5/§3.28) | P1 (doc/trust) | V1 REQUIRED | Batch G | Matrix is the primary RBAC acceptance reference for every other module audit; phantom layers misled auditors/devs | Fixed |
| FIX-005 | G6 — no route-registry regression net for officer/position extensions | P1 [TEST GAP] | V1 REQUIRED | Batch D | Locks the generated officer/position gates against silent loss on regeneration | Fixed |
| FIX-007 | G7 — `auth-gate-coverage.test.ts` tested locally re-defined pure functions (fake-green) | P2 [TEST GAP] | V1 RECOMMENDED | Batch D/G | Coverage counted it as auth-gate protection; it protected nothing in `src` | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `bun test src/core/auth/officer-checks.test.ts` | 8 pass / 0 fail | FIX-002 | No 2FA case for `requireOfficerTerm` — the absence that let G2 survive |
| `bun test src/handlers/auth-gate-coverage.test.ts` | 56 pass / 0 fail | FIX-007 | Fake-green: all 56 assertions hit pure functions defined inside the test file, not `src` |
| `createOrganization`/`setFeatureFlag`/`transitionOrgStatus` handlers | No `role !== 'super'` check (only session check) | FIX-001 | Verified by reading each handler; non-super callers succeeded |
| `createInvite.ts` | only user + orgId checks; no officer-term gate | FIX-003 | Any active member received 201 with a token |
| RED test runs after adding negative tests | FIX-001: 9 fail (3 handlers × 3 cases); FIX-002: 1 fail (President-no-2FA returned `null`); FIX-003: 1 fail (member got 201) | FIX-001/002/003 | Each RED failure confirmed for the expected reason before implementing the fix |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-001 | Added `callerAdmin.role !== 'super'` → 403 guard (mirrors `createAssociation.ts:20-24`) to all **5** super-only handlers. The first 3 were gated during the platform-admin pass; the remaining 2 (`deleteFeatureFlag`, `updateOrganization`) were gated in the security follow-up (2026-06-11) | `handlers/platformadmin/createOrganization.ts`, `setFeatureFlag.ts`, `transitionOrgStatus.ts`, **`deleteFeatureFlag.ts`, `updateOrganization.ts`** | No (module-local platformadmin) | Guard placed immediately after the session check, before not-found/body validation. All 5 mirror the identical `callerAdmin`/`role !== 'super'` pattern |
| FIX-002 | Added 2FA branch to inline `requireOfficerTerm`: inspects already-fetched `terms[].positionTitle` against `PRIVILEGED_POSITIONS`, enforces 2FA in production (mirrors `require-officer.ts:59-68`) | `core/auth/officer-checks.ts` | `[SHARED DEPENDENCY]` — consumed by 14 inline `requireOfficerTerm` caller handlers | Honored correction: `requireOfficerTerm` takes NO title arg; the privileged check reads the DB-sourced titles already fetched, not a passed title list. Direct `OfficerTermRepository` import left unchanged (no port migration — kept minimal per plan) |
| FIX-003 | Added inline `requireOfficerTerm(ctx)` after orgId resolution; returns its 403 when caller is not an officer | `handlers/invite/createInvite.ts` | `[CROSS-MODULE RISK]` — file is invite's, rule is auth-rbac's | Reuses the FIX-002-hardened helper, so privileged-title officers also get 2FA enforcement for free |
| FIX-004 | Rewrote matrix §2 (middleware stack), §4 (2FA enforced-by), §5 (`hasMinimumRole` NOT WIRED), §3.28 (`requireCommitteeRole` flagged unverified); fixed stale provenance line + date | `docs/product/ROLE_PERMISSION_MATRIX.md` | shared doc (consumed by all module audits) | Describes mechanisms that actually run; phantom `officerAuthMiddleware`/`hasMinimumRole`/`requireCommitteeRole` flagged dead/unverified. No product decision made on §3.28 |
| FIX-005 | New deterministic regression test: count of `x-require-officer`/`x-require-position` in OpenAPI spec must equal `requireOfficerMiddleware()`/`requirePositionMiddleware()` mounts in `routes.ts`; imports asserted | `middleware/route-registry-rbac.test.ts` (new) | Reads `routes.ts` + OpenAPI JSON read-only | Proven RED by removing one officer mount; restored |
| FIX-007 | Rewrote the fake-green RBAC matrix test to assert REAL `src` enforcement (`requireOfficerTerm`, `requirePosition`, `transitionOrgStatus`, `setFeatureFlag`, `impersonationWriteBlock`) instead of locally-redefined pure functions | `handlers/auth-gate-coverage.test.ts` | uses shared `core/auth` + platformadmin handlers + middleware | Proven non-fake-green: weakening the real `transitionOrgStatus` super gate made the test go RED; restored |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `handlers/platformadmin/createOrganization.test.ts` | permission/RBAC | analyst/support/no-platformAdmin → 403; super → 201 | FIX-001 |
| `handlers/platformadmin/setFeatureFlag.test.ts` | permission/RBAC | analyst/support/no-platformAdmin → 403; super → 200 (incl. all positive paths re-scoped to super) | FIX-001 |
| `handlers/platformadmin/transitionOrgStatus.test.ts` | permission/RBAC | analyst/support/no-platformAdmin → 403; super → 200 across the valid-transition matrix | FIX-001 |
| `handlers/platformadmin/ac-m03.platform-admin.test.ts` | permission/RBAC | Updated 3 AC-M03-005 org-lifecycle tests to provide super context (would otherwise 403 post-FIX-001) | FIX-001 (regression preservation) |
| `core/auth/officer-checks.test.ts` | permission/RBAC | President-no-2FA in prod → 403; Treasurer-with-2FA → allowed; Secretary in dev → allowed; non-privileged (Board Member) in prod → allowed | FIX-002 |
| `handlers/invite/createInvite.test.ts` | permission/RBAC | member (no officer term) → 403; officer (active term) → 201; existing positive paths stub the officer term | FIX-003 |
| `middleware/route-registry-rbac.test.ts` (new) | regression | Every `x-require-officer`/`x-require-position` op emits the matching middleware in `routes.ts`; imports present; ≥1 of each to protect | FIX-005 |
| `handlers/auth-gate-coverage.test.ts` (rewrite) | permission/RBAC + regression | Real officer/position/2FA/super/impersonation-write-block enforcement; RED if any real gate is weakened | FIX-007 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/platformadmin/{createOrganization,setFeatureFlag,transitionOrgStatus}.test.ts` (RED) | Failed (9) | Expected — confirmed RED before FIX-001 (non-super returned 200/201) |
| same (after FIX-001) | Passed (37) | Non-super → 403, super → success |
| `bun test src/core/auth/officer-checks.test.ts` (RED) | Failed (1) | President-no-2FA returned `null` before FIX-002 |
| same (after FIX-002) | Passed (12) | 2FA branch enforced |
| `bun test src/handlers/invite/createInvite.test.ts` (RED) | Failed (1) | member got 201 before FIX-003 |
| same (after FIX-003) | Passed (13) | member → 403, officer → 201 |
| `bun test src/handlers/auth-gate-coverage.test.ts` (rewrite) | Passed (17) | Real enforcement; proven RED (16/1) when real super gate weakened, then restored |
| `bun test src/middleware/route-registry-rbac.test.ts` | Passed (5) | Proven RED (4/1) when one officer mount removed, then restored |
| `bun test src/handlers/platformadmin` (full module suite) | Passed (378) | After updating AC-M03-005 contexts to super |
| `bun test src/handlers/member/governance src/handlers/documents src/handlers/invite src/middleware src/core/auth` | Passed (701) | FIX-002 blast-radius: no inline `requireOfficerTerm` caller regressed |
| `bun test src/handlers/invite src/handlers/communication src/handlers/member/membership/subscription src/handlers/member/duesspecialassessments` | Passed (750) | Remaining inline callers — clean |
| Final consolidated: 8 touched/new RBAC files | Passed (103) | 103 pass / 0 fail |
| `bunx tsc --noEmit` (api-ts) | Passed | Exit 0, 0 `error TS` |

## 7. Validation Summary

- **Passed:** All RED→GREEN cycles for FIX-001/002/003. The rewritten fake-green test (FIX-007) and the new regression net (FIX-005) both pass and were each proven to go RED under a simulated weakening/regression, then restored. Module-level blast-radius suites (platformadmin, governance, documents, invite, communication, subscription, duesspecialassessments, middleware, core/auth) all pass with the changes. `bunx tsc --noEmit` passes with 0 errors.
- **Failed:** None outstanding. Three pre-existing AC-M03-005 tests failed transiently after FIX-001 (they called `transitionOrgStatus` without super context); fixed by adding `platformAdmin: super` to those functional tests (they test the state machine, not the role gate).
- **Not run:** Whole-repo suite (E2E / all 514 unit files) — out of scope per the focused-validation directive. Contract (Hurl) negative tests were not added this pass.
- **Blocked:** None for the selected batch.
- **Pre-existing/unrelated:** `pg-pool` connection stderr noise in some integration tests (0 test failures) is pre-existing (no local Postgres) and unrelated.

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| `core/auth/officer-checks.ts` (`requireOfficerTerm` 2FA branch) | `core/auth/officer-checks.ts` | 14 inline callers: governance (open/close/update election, candidates), documents (create/search), invite (createInvite, after FIX-003), duesspecialassessments (listDuesPayments), membership subscription (3) | `officer-checks.test.ts` (12), plus 701-pass + 750-pass caller-suite sweeps | `[SHARED DEPENDENCY]`. 2FA only triggers on privileged title + no-2FA + production; test contexts default `twoFactorEnabled:true` and non-prod, so no caller regressed. Direct `OfficerTermRepository` import intentionally left (port migration deferred, kept minimal) |
| `docs/product/ROLE_PERMISSION_MATRIX.md` | §2/§4/§5/§3.28 + provenance | Every downstream module audit cites it as acceptance criteria | n/a (doc) | High informational reach, zero code risk. Phantom layers flagged dead/unverified; no product decision made |
| `handlers/invite/createInvite.ts` | createInvite | invite/onboarding module | `createInvite.test.ts` (13) | `[CROSS-MODULE RISK]` — enforcement rule owned by auth-rbac, file owned by invite |
| `generated/openapi/routes.ts` | (read-only assertion target of FIX-005) | n/a | `route-registry-rbac.test.ts` | NOT modified by this pass. Its `M` git status is pre-existing AHA work; the file is byte-identical to its pre-session state |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| TypeSpec session-role gates unassignable in production | G3 / FIX (not assigned) | `[NEEDS PRODUCT DECISION]` — provision roles vs. strip gates; touches TypeSpec + generator regen | Get product decision on role model, then a dedicated `04` pass with regen review |
| `bulkImportMembers` lacks president/secretary title filter + 2FA | FIX-006 (Batch C) | Out of selected batch | Run a later `04` pass for Batch C |
| org-context admin bypass grants full org-member access to all admin tiers | FIX-008 (Batch C) | Depends on FIX-001 (now landed) + analyst-scope product decision | Batch C, after analyst-scope decision |
| Public-path exemption uses `startsWith` prefix match | FIX-009 (Batch C) | Out of selected batch (low-risk hardening) | Batch C |
| `INVITE_TOKEN_SECRET` dev-default fallback | FIX-010 (Batch E) | Touches shared `core/config.ts`; isolated to Batch E | Batch E after confirming config-validation convention |
| Dead `officerAuthMiddleware` + `requireOrgRole`/`hasMinimumRole` still present | Batch B (deferred) | Cleanup only; matrix now correctly flags them dead (FIX-004) | Batch B cleanup pass |
| Contract (Hurl) negative-RBAC coverage | G6 (partial) | Focused unit/permission tests used this pass; Hurl pack deferred | Add Hurl negatives in a follow-up (analyst-403, member-invite-403, position-title-403) |
| ~~`updateOrganization` / `deleteFeatureFlag` super gates~~ — **NOW CLOSED** | FIX-001 (full 5-handler scope) | Originally narrowed out of the Batch-A pass (only the 3 fully-uncovered handlers were gated then) | **DONE** — gated in the security follow-up (2026-06-11) with the identical super-only pattern + RED→GREEN tests. No longer a gap. |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| G3 — TypeSpec session-role gates | `[NEEDS PRODUCT DECISION]` `[SHARED DEPENDENCY]` | Provision roles vs. remove gates; touches TypeSpec + whole-`routes.ts` regen | Product decision on canonical role model |
| Impersonation super-vs-support divergence | `[NEEDS PRODUCT DECISION]` | Code allows support; matrix/admin-UI say super only | Product decision |
| 403 security-event logging on privileged routes | `[NEEDS PRODUCT DECISION]` | Conflicts with audit-on-success design | THREAT_MODEL confirmation |
| Committee-scoped role guard (matrix §3.28) | `[NEEDS CONFIRMATION]` `[CROSS-MODULE RISK]` | `requireCommitteeRole` doesn't exist; actual guard unverified; owned by committee-management | committee-management (M19) audit confirms the real guard |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Matrix §5 hierarchy enforcement (wire `hasMinimumRole`) | `DO NOT ADD` `[DO NOT OVERBUILD]` | Position-title model already covers needs; parallel hierarchy = duplicate authority |
| Generic policy engine (Casbin-style) | `DO NOT ADD` `[DO NOT OVERBUILD]` | Declarative-extension + port model adequate |
| Resurrect/mount `officerAuthMiddleware` | `DO NOT ADD` | Live enforcement already exists; mounting dead middleware duplicates it |
| Seed extra roles to make G3 gates pass | `DO NOT ADD` | Would mask the production gap, not fix it |
| Swap `officer-checks.ts` direct repo import for governance port | `V2 DEFERRED` `[DO NOT OVERBUILD]` | Architecturally nice; not required for the G2 fix — kept minimal |
| Delete dead `officerAuthMiddleware`/`requireOrgRole`/`hasMinimumRole` | `V1 RECOMMENDED` (cleanup) | Batch B — only after matrix rewrite landed (it now has, via FIX-004) |
| ~~`updateOrganization` / `deleteFeatureFlag` super gates~~ — **CLOSED 2026-06-11 (no longer deferred)** | (was: out of narrowed scope) | The Batch-A pass narrowed FIX-001 to the 3 handlers that had NO check (`createOrganization`, `setFeatureFlag`, `transitionOrgStatus`). `updateOrganization`/`deleteFeatureFlag` were noted in the raw gap plan and have **now been gated** in the security follow-up — same super-only `role !== 'super'` → 403 pattern, locked by RED→GREEN tests. FIX-001 is now fully closed across all 5 handlers. |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/platformadmin/createOrganization.ts` | Added super-only role guard after session check | FIX-001 |
| `services/api-ts/src/handlers/platformadmin/setFeatureFlag.ts` | Added super-only role guard after session check | FIX-001 |
| `services/api-ts/src/handlers/platformadmin/transitionOrgStatus.ts` | Added super-only role guard after session check | FIX-001 |
| `services/api-ts/src/handlers/platformadmin/deleteFeatureFlag.ts` | **Security follow-up (2026-06-11)** — added super-only role guard after session check, before not-found (completes FIX-001's 5-handler scope) | FIX-001 |
| `services/api-ts/src/handlers/platformadmin/updateOrganization.ts` | **Security follow-up (2026-06-11)** — added super-only role guard after session check, before not-found (completes FIX-001's 5-handler scope) | FIX-001 |
| `services/api-ts/src/handlers/platformadmin/deleteFeatureFlag.test.ts` | **Security follow-up** — added analyst/support/no-admin → 403 cases; scoped positive paths to super | FIX-001 |
| `services/api-ts/src/handlers/platformadmin/updateOrganization.test.ts` | **Security follow-up** — added analyst/support/no-admin → 403 cases; scoped positive paths to super | FIX-001 |
| `services/api-ts/src/core/auth/officer-checks.ts` | Added 2FA enforcement branch to `requireOfficerTerm` (DB-title inspection, prod-gated) | FIX-002 |
| `services/api-ts/src/handlers/invite/createInvite.ts` | Added inline `requireOfficerTerm(ctx)` gate after orgId resolution | FIX-003 |
| `services/api-ts/src/handlers/platformadmin/createOrganization.test.ts` | Added analyst/support/no-admin 403 cases; scoped positive paths to super | FIX-001 |
| `services/api-ts/src/handlers/platformadmin/setFeatureFlag.test.ts` | Added analyst/support/no-admin 403 cases; scoped positive paths to super | FIX-001 |
| `services/api-ts/src/handlers/platformadmin/transitionOrgStatus.test.ts` | Added analyst/support/no-admin 403 cases; scoped positive paths to super | FIX-001 |
| `services/api-ts/src/handlers/platformadmin/ac-m03.platform-admin.test.ts` | Updated 3 AC-M03-005 org-lifecycle contexts to super (regression preservation) | FIX-001 |
| `services/api-ts/src/core/auth/officer-checks.test.ts` | Added 4 `requireOfficerTerm` 2FA cases (prod/dev × privileged/non-privileged) | FIX-002 |
| `services/api-ts/src/handlers/invite/createInvite.test.ts` | Added member-403 + officer-201 cases; stubbed officer term in positive paths | FIX-003 |
| `services/api-ts/src/middleware/route-registry-rbac.test.ts` (new) | Route-registry RBAC regression net (spec extensions ↔ emitted middleware) | FIX-005 |
| `services/api-ts/src/handlers/auth-gate-coverage.test.ts` | Full rewrite: fake-green pure functions → real `src` enforcement assertions | FIX-007 |
| `docs/product/ROLE_PERMISSION_MATRIX.md` | Rewrote §2/§4/§5/§3.28 to actual mechanisms; flagged phantom layers dead/unverified | FIX-004 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED baseline + GREEN counts | This report §3/§6 (test-run transcripts) | FIX-001/002/003 |
| Fake-green proof (weakened real gate → test RED → restored) | §6 (auth-gate-coverage 16/1 under weakened super gate) | FIX-007 |
| Regression-net proof (dropped officer mount → test RED → restored) | §6 (route-registry-rbac 4/1 under removed mount) | FIX-005 |
| Typecheck clean | §6 (`bunx tsc --noEmit` exit 0, 0 errors) | all |

No browser/Playwright/Webwright evidence — static unit/permission tests gave deterministic proof; no screenshots saved.

## 14. Completion Decision

**COMPLETE**

The selected batch (Batch D RED tests + Batch A enforcement + Batch G matrix rewrite) was fully implemented with TDD discipline: each enforcement fix was locked by a failing test confirmed RED for the right reason, then made GREEN by the smallest correct change. No existing check was weakened — every fix proves non-privileged callers are now rejected (403) AND privileged callers still succeed. The fake-green RBAC test was rewritten to assert real enforcement (proven to go RED against weakened gates), and a new regression net protects the generated officer/position middleware. Module-level validation (103 RBAC tests + 750/701-pass blast-radius sweeps) and `bunx tsc --noEmit` all pass. No product decisions were made; blocked/deferred items (G3, Batch C/E, cleanup) were left untouched.

## 15. Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for **Batch C** (FIX-006 import-roster title filter + 2FA, FIX-008 tier-aware org-context bypass — now unblocked since FIX-001 landed, FIX-009 exact-match public allowlist), then **Batch E** (FIX-010 `INVITE_TOKEN_SECRET` fail-fast). Separately, resolve the **G3 product decision** (provision session roles vs. strip `x-security-required-roles`) before its dedicated regen pass, and schedule the **Batch B cleanup** (delete dead `officerAuthMiddleware` + `requireOrgRole`/`hasMinimumRole`) now that the matrix (FIX-004) no longer documents them as live.

- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
- Module slug: `auth-rbac`
- Input fix-ready plan: `docs/aha/module-fix-plans/auth-rbac-fix-ready-plan.md`
- Recommended next batch: Batch C (then Batch E)

---

## Batch C Addendum — low-risk decision-free subset (2026-06-11)

Executed the roadmap §8 order-8 decision-free subset: **FIX-006** (bulkImportMembers title+2FA gate) and **FIX-009** (public-path exact/boundary match). **FIX-008** (tier-aware org-context analyst bypass) was **left blocked** — gated on the analyst data-access product decision (fix-ready §8), not decision-free. **FIX-010** (Batch E) untouched.

### Batch executed

| Fix ID | Gap | Severity | Status |
| --- | --- | --- | --- |
| FIX-006 | `bulkImportMembers` checked any officer term — no President/Secretary title filter, no 2FA (m01 §6) | P2 | Fixed |
| FIX-009 | Public-path exemption used `startsWith` prefix match — a sibling route under a public prefix could be accidentally exempted | P3 | Fixed |

### TDD evidence (RED → GREEN)

- FIX-006: `403 when caller holds a non-import officer title (e.g. Treasurer)` — RED resolved 200 (any term passed), now rejects `ForbiddenError`. `403 in production when a privileged importer lacks 2FA` — RED resolved 200 (no 2FA check), now rejects. `Secretary is permitted` regression guard stays green.
- FIX-009: extracted the inline `app.ts` exemption logic to a unit-testable helper using the **current** `startsWith` behavior, wrote boundary tests (`/public-verify-admin` sibling and `/searchInternal` must NOT be exempt) → confirmed RED (both returned true), then tightened to `path === p || path.startsWith(p + '/')` → GREEN. Subtree `/search/:personId/public` and exact paths stay exempt.

### Changes made

| File | Change | Fix ID |
| --- | --- | --- |
| `handlers/invite/bulkImportMembers.ts` | After the active-term check, require an officer term titled President/Secretary (case-insensitive, DB-sourced) and enforce 2FA in production (parity with `requirePosition`/P1-3). Inline because this handler scopes by request-body `orgId`, not ctx organizationId | FIX-006 |
| `middleware/association-public-paths.ts` (new) | Centralized `ASSOCIATION_PUBLIC_PATHS` + boundary-aware `isAssociationPublicPath(path)` (exact or `p + '/'` subtree) | FIX-009 |
| `app.ts` | Import + use `isAssociationPublicPath` in both `/association/*` auth and org-context middleware; removed the inline array + `startsWith` matchers | FIX-009 |
| `handlers/invite/bulkImportMembers.test.ts` | Updated `asOfficer()` to a President term; +`asOfficerTitled()`; +3 FIX-006 tests | FIX-006 |
| `middleware/association-public-paths.test.ts` (new) | 5 boundary-match tests | FIX-009 |

### Design notes

- **FIX-006:** no platform-admin (`role:'admin'`) bypass was added — the fix-ready plan scopes this to `requirePosition(['President','Secretary'])` semantics and the prior handler had no admin bypass; title+2FA-only is the minimal correct change. 2FA enforcement is production-only (skipped in dev/test), matching `officer-checks.ts`.
- **FIX-009:** behavior preserved for all currently-listed public subtrees (incl. `/directory/search/:personId/public`); only an unanchored sibling prefix (e.g. `/public-verify-admin`, `/searchInternal`) is now correctly NOT exempted. Preventive hardening, not a live-bug fix.

### Validation

- Invite + middleware (`auth`, `custom-routes-auth`, `association-public-paths`) targeted run: **102 pass / 0 fail**.
- API typecheck: 0 errors.

### Still open in auth-rbac

| Item | Reason |
| --- | --- |
| FIX-008 tier-aware org-context analyst bypass | `[NEEDS PRODUCT DECISION]` — analyst read-everything posture; NOT decision-free |
| FIX-010 `INVITE_TOKEN_SECRET` fail-fast (Batch E) | Separate Batch E pass |
| G3 session-role provisioning | Separate product decision + regen pass |

### Completion decision — Batch C (decision-free subset)

**COMPLETE** for FIX-006 + FIX-009. Both implemented test-first (RED confirmed, then GREEN), minimal correct changes, no weakened assertions, regression + typecheck clean. FIX-008 correctly left blocked.

---

## Batch E (FIX-010) + Batch B cleanup — decision-free subset (2026-06-12)

Executed roadmap §8 A3: **FIX-010** (`INVITE_TOKEN_SECRET` prod fail-fast, Batch E) + the **Batch B dead-code cleanup**. TDD (RED→GREEN) for FIX-010; grep-proven delete for Batch B. **FIX-008** (analyst tier-aware bypass) and **G3** (session-role provisioning) remain blocked on product decisions and were not touched.

### Batch executed

| Fix ID | Gap | Severity | Status |
| --- | --- | --- | --- |
| FIX-010 | `INVITE_TOKEN_SECRET` falls back to `'dev-secret-change-in-production'`; a misconfigured prod = forgeable invite/payment tokens | P2 | Fixed |
| Batch B — `requireOrgRole` / `hasMinimumRole` (+ now-dead `ROLE_HIERARCHY` / `OrgRole`) dead-code deletion (`utils/org-auth.ts`) | P3 (cleanup) | Fixed (deleted) |
| Batch B — `officerAuthMiddleware` (`middleware/officer-auth.ts`) + its test deletion | P3 (cleanup) | **Deferred / `[NEEDS CONFIRMATION]`** — NOT pure-dead (live test consumer found); see Design notes |

### Discoveries vs. the fix-ready plan (plan mismatches, handled per 04-prompt §7.9)

1. **FIX-010 is wider than the plan's single `createInvite.ts:40` site.** The `INVITE_TOKEN_SECRET || 'dev-secret-change-in-production'` pattern is read in **four** invite handlers — `createInvite.ts:47`, `bulkImportMembers.ts:196`, `validateInvite.ts:21`, `claimInvite.ts:28` — and the dues `utils/payment-token.ts:50` falls back to `INVITE_TOKEN_SECRET` as well. The **root-cause fix is the boot-time config fail-fast**, which protects *all* of them at once: `parseConfig()` runs at startup (`index.ts`), so production can never boot with an unset/default secret regardless of which handler later reads it. This is the minimal correct fix and avoids touching five handler files across two modules. `INVITE_TOKEN_SECRET` was **not present in the env schema at all** before this pass — it was read via raw `process.env` — so the fix also brings it under the single validation surface.
2. **`officerAuthMiddleware` is not cleanly dead.** The plan's deletion gate was "grep-prove zero `app.use`/route mounts first." It has **zero production mounts** (not wired in `app.ts`), but `src/tests/route-protection-handwired.test.ts` (198 LOC, currently passing — 14 assertions) **imports it and mounts it in mock apps** as the reference "correct wiring" for 6 officer-only routes. Deleting `officer-auth.ts` + `officer-auth.test.ts` would break that file's import (load error → ~14 tests error). The CONTINUE prompt scoped the delete to "`officer-auth.ts` + its test ONLY — never a broad clean," so gutting/removing the additional 198-LOC `route-protection-handwired.test.ts` is out of this pass's authorized scope. Per 04-prompt §7.9 (plan incomplete → do not broaden scope, document the mismatch), `officerAuthMiddleware` deletion is **deferred** and reclassified as not-decision-free.

### TDD evidence (RED → GREEN)

- **FIX-010** — added 4 cases to `core/config.test.ts` first. RED: `bun test src/core/config.test.ts` → **73 pass / 2 fail** — the two "throws in production when `INVITE_TOKEN_SECRET` is unset / equals the dev default" cases failed for the right reason (`parseConfig()` *returned a config object* instead of throwing, because prod did not yet require the var). Implemented the `superRefine` prod check + schema field → GREEN **75 pass / 0 fail**. The other two new cases (succeeds-with-real-secret, dev-default-allowed-outside-prod) guard the non-prod fallback and passed pre- and post-fix.
- **Determinism hardening:** the pre-existing "succeeds when all required vars present in production" test did not set `INVITE_TOKEN_SECRET`, so it only stayed green by inheriting an ambient `process.env` value (would flake in a clean CI). Set `INVITE_TOKEN_SECRET` explicitly on all four existing prod-validation tests and extended the "ALL missing vars" regex to `…INTERNAL_SERVICE_TOKEN.*INVITE_TOKEN_SECRET` — strengthening, not weakening.
- **Batch B (org-auth):** drove by grep-proving **zero production callers** of `requireOrgRole` / `hasMinimumRole` (only docstring comments in `officer-checks.ts` + `route-protection-association.test.ts`, plus their own tests). Deleted the two functions and the now-unreferenced `ROLE_HIERARCHY` / `OrgRole` they dragged. Post-delete grep confirms no surviving import/caller (remaining matches are comments and unrelated local `OrgRole` types in `ac-m13.professional-feed.test.ts` + `apps/memberry/OrgProvider.tsx`). `org-auth.test.ts` dropped from 12 → 9 (removed the 3 `requireOrgRole` tests; `hasMinimumRole` had no tests). `requireActiveStatus` / `requireTenantAccess` (BR-49 coverage, out of cleanup scope) preserved — they have zero prod callers too but were explicitly excluded by the plan and retain their tests.

### Changes made

| File | Change | Fix ID |
| --- | --- | --- |
| `services/api-ts/src/core/config.ts` | Added `INVITE_TOKEN_SECRET` to the env schema; added `INVITE_TOKEN_DEV_DEFAULT` const; added prod `superRefine` issue when the var is unset OR equals the dev default (mirrors the `INTERNAL_SERVICE_TOKEN` `Required in production` pattern) `[SHARED DEPENDENCY: core/config.ts]` | FIX-010 |
| `services/api-ts/src/core/config.test.ts` | New `describe('INVITE_TOKEN_SECRET production validation (FIX-010)')` (4 cases); hardened the 4 existing prod-validation tests to set `INVITE_TOKEN_SECRET` explicitly; extended the all-missing regex | FIX-010 |
| `services/api-ts/src/utils/org-auth.ts` | Deleted dead `requireOrgRole`, `hasMinimumRole`, and the now-orphaned `ROLE_HIERARCHY` const + `OrgRole` type. Kept `requireActiveStatus` / `requireTenantAccess` | Batch B |
| `services/api-ts/src/utils/org-auth.test.ts` | Removed the `requireOrgRole` describe block (3 tests) + its import | Batch B |

### Implementation note — FIX-010 read-site consolidation NOT done (deliberate)

The plan's "then have `createInvite.ts` consume the validated secret" was **not** implemented as a handler change. Rationale (smallest correct change): the boot-time fail-fast already makes the security guarantee for every consumer; routing only `createInvite` through a new `config.invite.tokenSecret` field would (a) leave the other three invite handlers + `payment-token.ts` still reading `process.env`, i.e. inconsistent, and (b) the dev round-trip test (`claimInvite.test.ts` relies on the literal `'dev-secret-change-in-production'`) constrains the dev fallback. Consolidating all five read sites into one helper is a low-risk consistency refactor recorded below as a follow-up, **not** a security gap (the boot validation closes the hole).

### Validation

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/core/config.test.ts` (RED) | Failed (73 pass / 2 fail) | Confirmed RED for the right reason before the fix |
| `bun test src/core/config.test.ts` (GREEN) | Passed (75 / 0) | After schema + superRefine + determinism hardening |
| `bun test src/utils/org-auth.test.ts` | Passed (9 / 0) | 12 → 9 after removing dead `requireOrgRole` tests |
| `bun test src/handlers/invite` | Passed (53 / 0) | FIX-010 consumers unaffected (dev fallback retained) |
| `bun test src/middleware src/core/auth src/utils` | Passed (474 / 0) | `officerAuthMiddleware` + `route-protection-handwired.test.ts` still green (not deleted) |
| `bun test` (full api-ts) | 6079 pass / 1 fail / 4 todo | Net **+1** vs the 6078 baseline (+4 config, −3 org-auth). The 1 fail is the PRE-EXISTING, UNRELATED `registerEmailJobs > registers email.processor as interval job` (30000 vs 1000) — unchanged by this pass |
| `bun run --filter '*' typecheck` (monorepo) | Passed (0 errors) | All 5 workspaces (ui, admin, sdk-ts, api-ts, memberry) exit 0 |

**Suite-count note:** the CONTINUE prompt anticipated the full count would *drop* by the deleted `officerAuthMiddleware` test (~155–169 LOC). Because that deletion was correctly deferred (live consumer), the drop did **not** occur; the only net change is the org-auth test removal (−3) offset by the new config tests (+4) = **+1**. Not a regression.

### Still open in auth-rbac after this pass

| Item | Label | Reason |
| --- | --- | --- |
| `officerAuthMiddleware` + `officer-auth.test.ts` deletion | `[NEEDS CONFIRMATION]` | Not pure-dead — `src/tests/route-protection-handwired.test.ts` is a live passing test that imports/mounts it as reference wiring. Deletion requires a decision on whether that 198-LOC test (which documents a never-adopted wiring; real route protection is now covered by `route-registry-rbac.test.ts` + inline `requireOfficerTerm` tests) should also be removed or migrated. Out of this pass's "officer-auth.ts + its test only" scope |
| FIX-010 read-site consolidation (5 sites → one `config.invite.tokenSecret` or shared helper) | `V2 DEFERRED` `[DO NOT OVERBUILD]` | Pure consistency; the boot fail-fast already closes the security hole. Touches two modules + a dev round-trip test |
| Stale `requireOrgRole` references in `officer-checks.ts` docstring (lines 5, 8) + `route-protection-association.test.ts` comments | `[NEEDS CONFIRMATION]` (doc) | Now reference a deleted symbol; harmless (comments, not calls). Left untouched to avoid churn on a shared file modified in a prior pass |
| FIX-008 analyst tier-aware org-context bypass | `[NEEDS PRODUCT DECISION]` | Analyst read-everything posture — not decision-free |
| G3 session-role provisioning; impersonation super-vs-support; 403 security-event logging | `[NEEDS PRODUCT DECISION]` | Separate product decisions + (G3) TypeSpec regen pass |

### Completion decision — Batch E + Batch B cleanup

**PARTIALLY COMPLETE.** FIX-010 (the security-relevant fix) is **fully done** — TDD RED→GREEN, deterministic, minimal, no weakened assertions, full suite + monorepo typecheck clean. The `requireOrgRole` / `hasMinimumRole` half of Batch B is **done** (grep-proven dead, deleted, suite green). The `officerAuthMiddleware` half is **correctly deferred** — discovery showed it is not pure-dead (a live test mounts it), and deleting it would exceed this pass's authorized file scope. No product decisions were made; FIX-008 / G3 / impersonation / 403-logging remain blocked.

### Recommended next step

- Decide the `officerAuthMiddleware` cleanup: either (a) confirm `src/tests/route-protection-handwired.test.ts` is obsolete and remove the dead triplet together, or (b) keep `officerAuthMiddleware` and update `ROLE_PERMISSION_MATRIX.md` to stop calling it deletable. A short eng-confirm, not a product decision.
- Continue Track A: **A4 — Billing Batch B remainder** (FIX-007 `updateInvoice` txn, FIX-008 void path) via a fresh `04` pass.
- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md` · Module slug: `billing` (or `auth-rbac` again if the `officerAuthMiddleware` eng-confirm lands first).

---

## `officerAuthMiddleware` dead-triplet — DELETE decision executed (2026-06-12)

**Pass id:** `auth-officer-triplet`. This pass resolves the exact item the prior (Batch E + Batch B) pass deferred and listed as its top "Recommended next step": the DELETE-vs-AMEND decision on the dead `officerAuthMiddleware` triplet. It is an **eng-confirm, not a product decision** (confirmed below), so no product-decision gate was hit.

### The decision: DELETE (with certainty), not AMEND/keep

The "triplet" investigated:
1. `services/api-ts/src/middleware/officer-auth.ts` — the `officerAuthMiddleware` function (75 LOC).
2. `services/api-ts/src/middleware/officer-auth.test.ts` — its unit test.
3. `services/api-ts/src/tests/route-protection-handwired.test.ts` — the only live consumer; imports + mounts `officerAuthMiddleware()` in self-built mock Hono apps.

**Evidence that DELETE is the safe, certain action (not a guess):**

- **Zero production mounts.** Repo-wide grep (`grep -rn officerAuthMiddleware`) found no `app.use`/route mount anywhere. `app.ts` does not import it. The only non-triplet references were three doc-comment lines (`core/auth/officer-checks.ts:4,18`, `middleware/require-position.test.ts:6`) and one `readFileSync` boundary-list entry in `core/ports/ports.test.ts:57` — no code importers.
- **The middleware's target routes were migrated away.** The 6 routes the middleware was written to protect (`/membership/org-profile`, `/membership/members`, `/membership/applications`, `/dues/dashboard`, `/credit-compliance`, `/officer-terms`) are **not hand-wired in `app.ts`** (grep returned nothing). They now exist as **TypeSpec-generated routes** in `generated/openapi/routes.ts` (e.g. `PUT /membership/org-profile/:organizationId` → `requirePositionMiddleware({titles:["President"]})` at routes.ts:3039-3041; `GET /credit-compliance/:organizationId` at :2873; `GET /officer-terms/:organizationId` at :3076), protected by the ADR-0007 generated middleware + inline handler checks — **never** by `officerAuthMiddleware`.
- **The consumer test is fake-green and its premise is obsolete.** `route-protection-handwired.test.ts`'s own header (lines 1-22) declares it a "RED phase" test documenting "target behavior that **Plan 03 (GREEN) will achieve by adding officerAuthMiddleware() to the real app.ts inline routes**." That plan was **superseded** — the routes moved to TypeSpec instead of receiving inline `officerAuthMiddleware`. The test builds its OWN mock apps with `officerAuthMiddleware()` wired in and asserts the mock returns 403/200; it therefore proves nothing about the real `app.ts`. This is the identical fake-green pattern that **FIX-007 already remediated** for `auth-gate-coverage.test.ts` in the first auth-rbac pass.
- **Real coverage for these routes exists elsewhere** (so deleting the fake-green test leaves no gap): `src/tests/route-protection-association.test.ts` (live-API **integration** test, `API_AVAILABLE`-gated, asserts real generated routes return non-2xx to members), the FIX-005 `middleware/route-registry-rbac.test.ts` regression net (every officer/position extension emits the matching generated middleware), `core/auth/officer-checks.test.ts`, `src/tests/position-rbac.test.ts`, and `middleware/require-position.test.ts`.
- **Fix-ready plan + matrix already point to DELETE.** §10 lists "Delete dead `officerAuthMiddleware` + its test" as the deferred cleanup (gated only on the matrix rewrite, which FIX-004 landed). §11 "Do Not Build" explicitly rejects resurrecting/mounting it. The corrected `ROLE_PERMISSION_MATRIX.md` (FIX-004) already flags it dead. Gap-plan open-question #3 ("intended future architecture or stale doc?") is answered **stale-dead** by the route-migration evidence above.

**Why this was NOT a product decision (no gate hit):** the question is purely "is this code reachable / is its test meaningful," answerable from routing + git + test evidence. No money/compliance semantics are involved — live officer/2FA enforcement is unchanged and fully covered by the generated `requireOfficer`/`requirePosition` middleware and the inline `requireOfficerTerm` (2FA branch added by FIX-002). Deleting unmounted code + a fake-green test removes a misleading trust signal; it does not weaken any enforcement.

### Mandatory follow-on edit (not scope creep)

The prior pass correctly noted the triplet is "not a clean single-file delete." The blast radius is small and bounded:
- `core/ports/ports.test.ts` had a boundary test doing `readFileSync(join(MIDDLEWARE_DIR, 'officer-auth.ts'))` over a `middlewareFiles` list. Deleting the file alone would make that test throw `ENOENT`. Removing `'officer-auth.ts'` from that list (the file is gone, so the "must not import from handlers/*" boundary no longer applies to it) is **required** for the delete to be correct — the remaining live boundary (`platform-admin-auth.ts`, `impersonation-guard.ts`, `org-context.ts`) is preserved and still asserted.
- Four dangling doc-comment references to the deleted symbol/file were updated to describe the live mechanism instead (same class of doc-drift FIX-004 fixed): `core/auth/officer-checks.ts` (2 comments), `core/ports/governance.port.ts` (2 comments), `middleware/require-position.test.ts` (1 comment). No logic changed.

### Test-supported proof (RED-equivalent for a deletion)

A deletion's "test-first" is proving (a) the removed test proved nothing real, and (b) nothing real breaks:
- Baseline: `bun test officer-auth.test.ts route-protection-handwired.test.ts` → **25 pass / 0 fail** (the triplet's own tests, all green — but fake-green for the consumer).
- Proof the `ports.test.ts` boundary test fails-without / passes-with the list edit: deleting `officer-auth.ts` makes its `readFileSync` ENOENT; after removing the list entry, `bun test src/core/ports/ports.test.ts src/middleware/require-position.test.ts src/core/auth/officer-checks.test.ts` → **28 pass / 0 fail**.
- Proof of no new failure in the touched neighborhood: `bun test src/middleware src/tests src/core` → **717 pass / 2 fail / 2 todo**; the 2 fails are **pre-existing and unrelated** (`route-registry RBAC regression` = spec↔`routes.ts` count drift, reads neither officer-auth nor any file this pass touched, reproduces in isolation 4 pass/1 fail; `BillingService secret-key redaction` = untracked billing-pass test, 0 officer-auth refs).

### Changes made

| File | Change | Decision |
| --- | --- | --- |
| `services/api-ts/src/middleware/officer-auth.ts` | **Deleted** (`git rm`) — dead `officerAuthMiddleware`, zero mounts | DELETE |
| `services/api-ts/src/middleware/officer-auth.test.ts` | **Deleted** — test of the dead middleware | DELETE |
| `services/api-ts/src/tests/route-protection-handwired.test.ts` | **Deleted** — fake-green test of self-mounted mock apps; premise (inline `app.ts` wiring) obsoleted by TypeSpec migration | DELETE |
| `services/api-ts/src/core/ports/ports.test.ts` | Removed `'officer-auth.ts'` from the `middlewareFiles` boundary list (mandatory — else `readFileSync` ENOENT); added explanatory comment | required follow-on |
| `services/api-ts/src/core/auth/officer-checks.ts` | Updated 2 doc-comments that named the deleted `officerAuthMiddleware` to describe the live generated middleware instead | doc-drift cleanup |
| `services/api-ts/src/core/ports/governance.port.ts` | Updated 2 doc-comments referencing `officer-auth.ts` to reference the officer/position middleware (preserving S-C4-014 provenance) | doc-drift cleanup |
| `services/api-ts/src/middleware/require-position.test.ts` | Removed a comment clause referencing `officerAuthMiddleware deps` | doc-drift cleanup |

### Validation

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/middleware/officer-auth.test.ts src/tests/route-protection-handwired.test.ts` (baseline) | 25 pass / 0 fail | Pre-delete state of the triplet's own tests |
| `bun test src/core/ports/ports.test.ts src/middleware/require-position.test.ts src/core/auth/officer-checks.test.ts` | 28 pass / 0 fail | Boundary test green after list edit; no ENOENT |
| `bun test src/middleware src/tests src/core` (touched-file neighborhood) | 717 pass / 2 fail / 2 todo | Both fails pre-existing + unrelated (route-registry spec drift; billing redaction) — neither imports officer-auth |
| `bun test` (full api-ts) | 5955 pass / 134 fail / 4 todo / 2 errors | The 134 fails are pre-existing DB-integration tests from OTHER AHA passes failing in this no-live-DB env (Postgres `42703`/connection); **none reference officer-auth**. Delta vs. prior pass's 6079-pass baseline is from intervening passes adding DB-dependent tests, NOT this deletion. This pass's only count effect is −25 (the deleted triplet's passing tests). The task baseline (~6205 pass / 1 fail) assumes a live DB this env lacks |
| `bun run --filter '*' typecheck` (monorepo) | 4/5 workspaces pass (ui, admin, sdk-ts, memberry exit 0); api-ts has 7 errors | All 7 api-ts errors are in **untracked files from other AHA passes** (missing generated validators/repo methods needing `bun run generate`) — pre-existing dirty-tree regen-debt. **Zero type errors in any file this pass touched/deleted** (verified by grep). Deleting unmounted middleware + a never-imported test cannot produce generated-validator errors |

### Completion decision — dead-triplet

**COMPLETE.** The DELETE-vs-AMEND decision was resolved to **DELETE** on conclusive evidence (zero mounts, routes migrated to TypeSpec, the consumer test is fake-green with a superseded premise, real coverage exists elsewhere, and the fix-ready plan/matrix already designate it dead). It is an eng-confirm, not a product decision — **no product-decision gate hit**. The three triplet files were removed and the one mandatory follow-on edit (`ports.test.ts` boundary list) plus four doc-comment cleanups were applied. No live enforcement changed; no real test coverage was lost; no new failure or type error was introduced by this pass. Pre-existing, unrelated DB-integration failures and api-ts regen-debt typecheck errors (both from the intentionally-dirty tree / other passes) are documented and not attributed to this pass.

### Recommended next step

- Auth-rbac cleanup is now closed; only product-decision-gated items remain (G3 session-role provisioning, FIX-008 analyst org-context bypass, impersonation super-vs-support, 403 security-event logging).
- Independently, the pre-existing `route-registry-rbac.test.ts` spec↔`routes.ts` count drift (expected 53 `x-require-position`, found 42 mounts) should be triaged in a **TypeSpec regen / spec-sync** pass (`cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`), not here — it predates and is orthogonal to this pass.
