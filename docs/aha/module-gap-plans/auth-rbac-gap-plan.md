# AHA Module/Group Gap Plan: Auth/RBAC enforcement

Date: 2026-06-11 · Prompt: 02-module-or-group-audit-gap-plan.md · Audit-only (no fixes applied)

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Auth/RBAC enforcement |
| Module slug | auth-rbac |
| Type | Auth/RBAC/Security Group |
| Output file | `docs/aha/module-gap-plans/auth-rbac-gap-plan.md` |
| Primary PRD/spec used | `docs/product/ROLE_PERMISSION_MATRIX.md` |
| Supporting PRDs/specs used | `docs/product/modules/m01-auth-onboarding/MODULE_SPEC.md` (§6 Permissions), `docs/architecture/adr/0007-audit-officer-position-via-typespec-extension.md`, CLAUDE.md §P1.5 |
| PRD/spec coverage quality | Strong but **partially stale** — matrix §2/§4/§5 describe enforcement mechanisms that do not exist in code (see §5, §14 below) |
| Paths inspected | `services/api-ts/src/middleware/{auth,officer-auth,platform-admin-auth,org-context,require-officer,require-position,impersonation-guard}.ts` (+tests), `services/api-ts/src/core/auth/officer-checks.ts` (+test), `services/api-ts/src/utils/{org-auth,auth}.ts`, `services/api-ts/src/app.ts` (auth wiring, public allowlists), `services/api-ts/src/generated/openapi/routes.ts`, `services/api-ts/scripts/generate.ts` (extension emission), `specs/api/src/**/*.tsp` (x-require-* usage), `services/api-ts/src/handlers/platformadmin/*`, `services/api-ts/src/handlers/invite/createInvite.ts`, `services/api-ts/src/handlers/auth-gate-coverage.test.ts`, `apps/memberry/src/utils/guards.ts`, `apps/memberry/src/routes/_authenticated.tsx`, `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer.tsx`, `apps/admin/src/routes/__root.tsx`, `apps/admin/src/lib/role-gate.tsx`, `specs/api/tests/contract/{security-officer-auth,admin-flow,assoc-positions-flow,platformadmin-extended-flow}.hurl` |
| PRDs/specs inspected | ROLE_PERMISSION_MATRIX.md (full), m01 MODULE_SPEC (§6, §11), ADR-0007 (full) |
| KG used | Yes (status notes only; `.understand-anything/` graph from 2026-06-06 used as secondary evidence per `docs/aha/kg/knowledge-graph-status.md`) |
| KG refreshed | No |
| `/understand-domain` used | Yes (status notes only, per `docs/aha/kg/domain-knowledge-status.md`) |
| `/understand-domain` refreshed | No |
| Webwright used | No |
| Playwright/E2E inspected | Hurl contract files inspected statically; not executed |
| Existing tests inspected | `middleware/{auth,officer-auth,platform-admin-auth,org-context,require-officer,require-position}.test.ts`, `core/auth/officer-checks.test.ts`, `middleware/custom-routes-auth.test.ts`, `handlers/auth-gate-coverage.test.ts`, 4 RBAC-relevant Hurl files |
| Cross-cutting audit reviewed | Not Available (not yet run) |
| Database/schema audit reviewed | Not Available (not yet run) |
| Limitations | Static review sufficient; browser tooling skipped for batch run. Better-Auth plugin internals (`core/auth.ts`, 10 plugins) treated as auth-onboarding scope; only enforcement surface audited here. NODE_ENV-gated 2FA paths cannot be exercised without production env. |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| Role Permission Matrix | `docs/product/ROLE_PERMISSION_MATRIX.md` | acceptance criteria | **Partially stale** | Primary RBAC reference. §1, §3, §6 largely accurate; §2 (middleware stack), §4 (2FA enforced-by), §5 (hasMinimumRole) describe code paths that are dead or absent |
| M01 Auth & Onboarding spec | `docs/product/modules/m01-auth-onboarding/MODULE_SPEC.md` | PRD/module spec | Current | §6 Permissions table — invite/import role requirements audited here |
| ADR-0007 | `docs/architecture/adr/0007-audit-officer-position-via-typespec-extension.md` | implementation decision | Current | Governs x-audit / x-require-officer / x-require-position generated-middleware pattern and the inline fallback |
| CLAUDE.md §P1.5 / §verb conventions | `CLAUDE.md` | implementation plan | Current | Middleware chain order: auth → position\|officer(path) → audit → validators → position\|officer(body) → handler — confirmed in `generate.ts:524-580` |
| Business rules registry | `docs/ver-3/business/br-registry.json` | business rules | Current | BR-09 (officer-only endpoints) cited by `security-officer-auth.hurl` |

## 3. Expected vs Actual

**Expected (per ROLE_PERMISSION_MATRIX + ADR-0007 + m01):** a four-layer stack — (1) Better-Auth session validation on all non-public routes; (2) `officerAuthMiddleware` on `/association/*` mutations with 2FA for president/treasurer/secretary; (3) `platformAdminAuthMiddleware` on `/admin/*` checking `platform_admin` table; (4) per-handler guards `requirePosition()`, `requireOrgRole()`, `requireActiveStatus()`, `requireTenantAccess()` plus hierarchy access via `hasMinimumRole()`. Platform-admin actions split by `super`/`support`/`analyst` (matrix §3.7: create org, transition org status, feature flags, impersonation = super only; analyst read-only).

**Actual:**
- Layer 1 works: `authMiddleware` (`middleware/auth.ts`) validates Better-Auth session, rejects banned users, supports `{required:false}` and `roles:[...]`. `/association/*` auth+org-context wildcard with explicit public allowlist (`app.ts:408-431`); `/admin/*` gets `authMiddleware() + platformAdminAuthMiddleware()` (`app.ts:343`).
- Layer 2 **does not exist as documented**: `officerAuthMiddleware` (`middleware/officer-auth.ts`) is **never mounted** — zero non-test, non-comment references. Officer gating actually happens via (a) generated `requireOfficerMiddleware`/`requirePositionMiddleware` on 6 + 43 of 454 generated routes, and (b) inline `requireOfficerTerm`/`requirePosition` calls in 64 handler files.
- Layer 3 works as documented, but is **role-blind**: any `platform_admin` row (super, support, or analyst) passes; super-only enforcement is per-handler and **missing on several super-only mutations** (see §5).
- Layer 4 is **half fiction**: `requireOrgRole`/`hasMinimumRole` (`utils/org-auth.ts`) have **zero call sites** — `orgContextMiddleware` hardcodes `role: 'member'` for all members and `role: 'admin'` for platform admins (`middleware/org-context.ts`), so the 8-level ROLE_HIERARCHY is unenforceable as written. Real granularity comes from officer-term + position-title checks.
- 2FA: enforced (production only) in `requirePosition` (inline), `requirePositionMiddleware`, `requireOfficerMiddleware`. **Not enforced in inline `requireOfficerTerm`** despite that file's docstring claiming "Both functions enforce 2FA" (`core/auth/officer-checks.ts:10-11` vs body lines 26-46). The dead `officerAuthMiddleware` enforces 2FA unconditionally (no NODE_ENV gate) — divergent from all live paths.
- TypeSpec-declared session roles (`x-security-required-roles` → `authMiddleware({roles:[...]})`) reference role strings (`association:admin`, `association:staff`, `platform_admin`, `national_officer`) that **no production code path assigns** to `user.role` — only `seed/layer-2-users.ts:350` sets `association:admin`. [NEEDS CONFIRMATION] whether the Better-Auth admin plugin assigns any of these in production flows.
- Frontend: memberry guards (`requireAuth`, `requireOrgOfficer` in `apps/memberry/src/utils/guards.ts`) and admin `RequireRole`/`ROUTE_ROLES` (`apps/admin/src/lib/role-gate.tsx`, used in 16 route files) are correct defense-in-depth; backend remains source of truth.
- Impersonation: resolver + write-block mounted globally (`app.ts:293-294`); `startImpersonation.ts` restricts to super/support — matches matrix §3.7 partially (matrix says super only, code allows support) [NEEDS PRODUCT DECISION].

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Matrix §2 L1: global session auth, public allowlist | All non-public routes 401 unauthenticated | `authMiddleware` + wildcards in `app.ts:343,401,418,440,448,453`; allowlist `app.ts:408-415` matches matrix §2 public routes | n/a | `middleware/auth.ts` | better-auth tables (generated) | `middleware/auth.test.ts`, `custom-routes-auth.test.ts`, `admin-flow.hurl` step 0 (401) | Implemented | No |
| Matrix §2 L2: `officerAuthMiddleware` on `/association/*` mutations | Officer term verified by dedicated middleware | Middleware exists but unmounted; gating via generated x-require-* (49 routes) + 64 inline handler files | n/a | `middleware/officer-auth.ts` (dead); `generated/openapi/routes.ts` | officer_term via `governance.repo` | `officer-auth.test.ts` (tests dead code) | Partially Implemented (mechanism differs from spec) | **Yes — P1** |
| Matrix §2 L3: `/admin/*` platform-admin table check | Non-admins 403 on all `/admin/*` | `app.ts:343` + `middleware/platform-admin-auth.ts` | admin app redirect | `platformAdminAuthMiddleware` | `platform_admin` table, `adminRoleEnum` | `platform-admin-auth.test.ts` | Implemented | No (role-blindness covered below) |
| Matrix §2 L4: `requireOrgRole`/`requireActiveStatus`/`requireTenantAccess` handler guards | Org-role-based handler guards | `requireOrgRole`/`hasMinimumRole` have 0 call sites; org-context hardcodes role | n/a | `utils/org-auth.ts`, `middleware/org-context.ts` ("role granularity comes from governance module") | membership table | `utils/org-auth.test.ts` (tests dead exports) | Missing (as specified) / superseded by position checks | **Yes — P1 (spec)** |
| Matrix §3.7: create org / transition org status / feature flags / create-update-delete assoc = super only | analyst & support 403 on these | `createAssociation/deleteAssociation/inviteAdmin/updateAdmin/revokeAdmin` check `callerAdmin.role !== 'super'`; **`createOrganization.ts`, `setFeatureFlag.ts`, `deleteFeatureFlag.ts`, `transitionOrgStatus.ts`, `updateOrganization.ts` have no admin-role check** | admin UI hides via ROUTE_ROLES (client-side only) | `handlers/platformadmin/*.ts` | `platform_admin.role` | No negative tests for analyst/support on these handlers | Partially Implemented | **Yes — P1** |
| Matrix §3.7: impersonation = super only | Only super may impersonate | `startImpersonation.ts:11` allows `['super','support']` | `/impersonate` ROUTE_ROLES super-only | handler check | impersonation_session | `endImpersonation.test.ts` etc. | Implemented but diverges from matrix (support allowed) | Yes — P2 [NEEDS PRODUCT DECISION] |
| Matrix §4: 2FA for president/treasurer/secretary, "enforced by requirePosition() + officerAuthMiddleware" | Privileged officers without 2FA → 403 in production | Live: `requirePosition` (inline), `requirePositionMiddleware`, `requireOfficerMiddleware` (prod-only). **`requireOfficerTerm` (inline, used in part of 64 handler files) never checks 2FA.** `officerAuthMiddleware` (cited by matrix) dead | n/a | `core/auth/officer-checks.ts:26-46` | user.twoFactorEnabled | `require-position.test.ts`, `require-officer.test.ts`, `officer-auth.test.ts:142` (dead path); **no contract test** | Partially Implemented | **Yes — P1** |
| Matrix §5: `hasMinimumRole` hierarchy access | 8-level org-role hierarchy comparisons | Function exists, **never called** | n/a | `utils/org-auth.ts:hasMinimumRole` | n/a | unit test of dead function | Missing (dead code documented as live) | Yes — P2 (doc) |
| Matrix §6.1: "all mutation routes protected" | No unguarded mutations | Spot-checked: generated routes all carry auth (generator `generate.ts:512` adds auth for any secured op); hand-wired routes in `app.ts` carry `authMiddleware()`; public paths are GET/captcha-POST by design | n/a | `app.ts`, `routes.ts` | n/a | `custom-routes-auth.test.ts` | Implemented | No [NEEDS CONFIRMATION — full route-by-route sweep not re-run] |
| ADR-0007: generated routes declare audit/auth via @extension; handlers must not hand-call | Extensions on TypeSpec ops; chain order fixed | 47 x-require-* declarations across 9 .tsp files → 6 officer + 43 position middlewares + 196 audit middlewares in `routes.ts`; chain order confirmed. 64 handler files still hand-call `requirePosition`/`requireOfficerTerm` (permitted for runtime-branching per ADR, but volume suggests drift) | n/a | `scripts/generate.ts:507-580`, `specs/api/src/association/**.tsp` | n/a | middleware unit tests | Partially Implemented | Yes — P2 |
| m01 §6: Send invite = president, secretary, officer | Member/user blocked from POST /invite | `app.ts:448` gives `/invite` auth + org-context (membership only); `createInvite.ts` checks only user + orgId — **any active member can invite** | join/invite UI officer-side only (client) | `handlers/invite/createInvite.ts` | invitation table | No negative test | Missing | **Yes — P1** |
| m01 §6: Import roster = president(2FA)/secretary(2FA)/super | Non-privileged blocked | `handlers/invite/bulkImportMembers.ts:88-89` checks officer terms (no title filter, no 2FA) | officer UI | bulkImportMembers | n/a | none found | Partially Implemented | Yes — P2 |
| TypeSpec session-role gates (`x-security-required-roles`) | Roles map to real assignable user roles | `authMiddleware({roles:["association:admin","association:staff"]})` on `/accredited-providers/*` (routes.ts:23-52), `["platform_admin","national_officer"]` on national-dashboard ops (routes.ts:128-204); only seed assigns `association:admin`; no assignment path for `platform_admin`/`national_officer` to `user.role` found | n/a | `generated/openapi/routes.ts`, `seed/layer-2-users.ts:350`, `utils/auth.ts:userHasRole` | user.role column | `auth.test.ts` role tests (synthetic roles) | Unclear / Partially Implemented | **Yes — P1 [NEEDS CONFIRMATION]** |
| Matrix §3.28: committee-scoped roles via `requireCommitteeRole()` | Committee role lookup guard | **No `requireCommitteeRole` function exists** in `services/api-ts/src` (grep: only `committee_member` schema refs) | n/a | absent | committee_member.role | n/a | Missing or differently named | Yes — P2 [NEEDS CONFIRMATION] [CROSS-MODULE RISK: committee-management] |
| Impersonation write-block (matrix §3.7 / THREAT_MODEL) | Writes blocked during impersonation, 2h cap | `impersonationResolver` + `impersonationWriteBlock` mounted `app.ts:293-294`; 2h max | admin /impersonate | `middleware/impersonation-guard.ts` | impersonation_session | `impersonation-guard.test.ts` | Implemented | No |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| Matrix §3.7 super-only ops | `createOrganization`, `setFeatureFlag`, `deleteFeatureFlag`, `transitionOrgStatus`, `updateOrganization` accept **any** platform-admin role (analyst/support can mutate) | P1 | `V1 REQUIRED` | `handlers/platformadmin/createOrganization.ts` (only session check); grep of `setFeatureFlag.ts`/`deleteFeatureFlag.ts`/`transitionOrgStatus.ts` finds zero `role`/`super` checks; contrast `createAssociation.ts:22` | Add `callerAdmin.role !== 'super'` guard (same pattern as `createAssociation.ts:21-23`) to the 5 handlers; or centralize a `requireAdminRole(ctx, ['super'])` helper |
| Matrix §4 2FA | Inline `requireOfficerTerm` performs no 2FA check although file docstring (P1-3) claims both functions enforce it; routes guarded only by `requireOfficerTerm` let privileged officers without 2FA act | P1 | `V1 REQUIRED` | `core/auth/officer-checks.ts:10-11` (claim) vs `:26-46` (no check); compare `middleware/require-officer.ts` (has check) | Port the privileged-title 2FA block from `requireOfficerMiddleware` into `requireOfficerTerm`; align NODE_ENV gating |
| Matrix §2 layer 2 | `officerAuthMiddleware` documented as live enforcement layer but mounted nowhere | P1 (doc/trust) + P3 (dead code) | `V1 REQUIRED` (fix doc) | grep: only comment refs in `core/auth/officer-checks.ts:4,18`; no import in `app.ts` | Update matrix §2/§4 to name actual mechanisms (`requireOfficerMiddleware`/`requirePositionMiddleware`/inline checks); delete or explicitly archive `middleware/officer-auth.ts` + test |
| m01 §6 Send invite | Any active org member can create invitations (spec: president/secretary/officer) | P1 | `V1 REQUIRED` | `handlers/invite/createInvite.ts:17-21` (user+orgId only); `app.ts:448` (membership-only middleware) | Add officer-term check (inline `requireOfficerTerm` or migrate POST /invite to TypeSpec with `x-require-officer` body/header mode) |
| TypeSpec session-role strings | `association:admin`/`association:staff`/`platform_admin`/`national_officer` gates depend on `user.role` values assigned only by seeds — in production either legit users are 403'd (accredited-providers) or the gate is dead weight | P1 | `V1 REQUIRED` | `routes.ts:23,32,41,50` (accredited-providers), `:128-204` (platform_admin/national_officer); `seed/layer-2-users.ts:350` sole assignment; `userHasRole` exact-match (`utils/auth.ts:96-103`) | Decide canonical model: either provision these roles on user.role during admin/officer onboarding, or drop `x-security-required-roles` from those TypeSpec ops and rely on requirePosition/platformAdminAuthMiddleware. [NEEDS PRODUCT DECISION] |
| Matrix §5 hierarchy | `hasMinimumRole`/`requireOrgRole` + 8-level ROLE_HIERARCHY documented but dead (0 call sites; org-context hardcodes `member`/`admin`) | P2 | `V1 RECOMMENDED` (doc fix) | `utils/org-auth.ts`; `middleware/org-context.ts` comment "role granularity comes from governance module"; grep zero callers | Rewrite matrix §5 to describe officer-term/position-title model; mark org-auth exports deprecated or remove in cleanup |
| Matrix §3.7 impersonation | Code allows `support` to impersonate; matrix says super only (admin app ROUTE_ROLES also super-only) | P2 | `V1 RECOMMENDED` | `handlers/platformadmin/startImpersonation.ts:11` | [NEEDS PRODUCT DECISION] — align matrix or code |
| m01 §6 import roster 2FA | bulkImportMembers checks any officer term — no president/secretary title filter, no 2FA | P2 | `V1 RECOMMENDED` | `handlers/invite/bulkImportMembers.ts:88-89` | Use `requirePosition(ctx, ['President','Secretary'])` per m01 §6 |
| Matrix §3.28 | `requireCommitteeRole()` cited by matrix does not exist | P2 | `V1 RECOMMENDED` | grep `services/api-ts/src` — no definition | Verify committee handlers' actual guard ([CROSS-MODULE RISK: committee-management]); correct matrix |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Internal service-token expand bypass in authMiddleware (timing-safe, rotating tokens) | `middleware/auth.ts:~104-130` | Not in matrix; referenced as P1-2 fix | Low — fails through to normal auth on mismatch with security log | Keep but clarify (add to matrix §2) |
| `client`/`host` role machinery + `:owner` syntax in authMiddleware | `middleware/auth.ts` (role docs), `auth.test.ts:226-310` | Matrix §6.5 calls them unused template leftovers | Dead complexity; healthcare-template residue | Do not expand; consider removal later `[DO NOT OVERBUILD]` |
| `officerAuthMiddleware` (dead) | `middleware/officer-auth.ts` + 155-line test | Matrix cites it as live (incorrectly) | Misleading docs; maintenance of dead 2FA semantics | Consider removal later (after matrix updated) |
| `requireOrgRole`/`requireActiveStatus`/`requireTenantAccess`/`hasMinimumRole` | `utils/org-auth.ts` — `requireOrgRole`/`hasMinimumRole` have no callers | Matrix §2 L4/§5 cite them | Doc-vs-code drift | Keep `requireActiveStatus`/`requireTenantAccess` if called elsewhere [NEEDS CONFIRMATION]; mark the rest deprecated |
| org-context UUID-from-path + body fallback orgId extraction | `middleware/org-context.ts` (regex UUID match, body parse) | Not specified | Fails closed (membership verified against extracted org) — acceptable | Keep but clarify |
| Impersonation 2h hard cap | `middleware/impersonation-guard.ts:26` | Not in matrix | None | Keep |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Role/position change → permission effect | Officer, Admin | Officer term created/ended | term row in governance → next request re-queried (no session cache) → x-require-* / inline checks reflect immediately | Implemented — checks hit DB per request via `GovernancePort.findActiveOfficerTermsByPersonAndOrg` | No | `middleware/require-position.ts`, `core/ports` |
| Privileged officer w/o 2FA attempts gated action | President/Treasurer/Secretary | Request to gated route | 403 with enable-2FA message (production) | Implemented on 3 of 4 live check paths; missing on inline `requireOfficerTerm` | **Yes** | §5 row 2 |
| Member attempts officer action | Member | Request to officer route | 403 "Officer access required" | Implemented | No | `security-officer-auth.hurl` (8× HTTP 403) |
| Non-admin attempts /admin/* | Member | Request | 403 via platform_admin table check | Implemented | No (no contract test for authenticated-non-admin case — see §20) | `app.ts:343` |
| Platform admin acts inside an org | super/support/analyst | /association/* request | org-context bypass grants `role:'admin'` membership in **any** org | Implemented; analyst granularity lost at this layer | Yes — P2 | `middleware/org-context.ts` (admin bypass block) |
| Admin impersonates member | super (+support in code) | POST startImpersonation | cookie session, read-only enforced, 2h cap, end session | Implemented | Minor (role divergence §5) | `impersonation-guard.ts`, `startImpersonation.ts` |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Session validation (all routes) | 401 without session; banned users rejected | Implemented | `middleware/auth.ts` | `V1 REQUIRED` | Solid |
| Org membership resolution | 403 if not member of requested org; fails closed | Implemented | `middleware/org-context.ts` + tests | `V1 REQUIRED` | Solid |
| Officer term gate (generated) | x-require-officer routes 403 non-officers | Implemented | `require-officer.ts`, routes.ts (6 routes) | `V1 REQUIRED` | |
| Position title gate (generated) | x-require-position routes filter by DB title, OR semantics, case-insensitive | Implemented | `require-position.ts`, routes.ts (43 routes) | `V1 REQUIRED` | |
| Officer/position gate (inline, 64 handler files) | Same semantics as generated | Partially Implemented | `core/auth/officer-checks.ts` — `requireOfficerTerm` lacks 2FA | `V1 REQUIRED` | P1 fix |
| Super-only platform mutations | analyst/support 403 | Partially Implemented | §5 row 1 | `V1 REQUIRED` | P1 fix |
| Session-role gates from TypeSpec | Roles assignable in production | Unclear | §5 row 5 | `V1 REQUIRED` | Needs decision |
| Org-role hierarchy (matrix §5) | hasMinimumRole comparisons | Missing — and **not needed** for V1 (position-title model covers it) | `utils/org-auth.ts` | `DO NOT ADD` (don't build hierarchy enforcement; fix docs instead) | `[DO NOT OVERBUILD]` |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Sign-in gate on product app | Member | Redirect to /auth/sign-in when unauthenticated | Implemented | No | `V1 REQUIRED` | `apps/memberry/src/utils/guards.ts:requireAuth`; `_authenticated.tsx` |
| Officer area gate (frontend) | Officer | Non-officers redirected from /org/$orgSlug/officer | Implemented | No | `V1 REQUIRED` | `officer.tsx:10 beforeLoad: requireOrgOfficer` |
| Admin app gate | Platform admin | Non-admins can't use admin app | Implemented (session check + per-route `RequireRole` in 16/17 route files; backend 403 authoritative) | Minor — `__root.tsx` only checks session existence, an authenticated member sees the shell before API 403s | `V1 RECOMMENDED` | `apps/admin/src/routes/__root.tsx:49-54`, `lib/role-gate.tsx` |
| Officer-only mutations rejected for members (API) | Member | 403 | Implemented | No | `V1 REQUIRED` | `security-officer-auth.hurl` |
| Position-title-restricted mutations (e.g. President-only deleteDocument) | Officer non-matching title | 403 | Implemented | Untested at contract level | `V1 REQUIRED` | routes.ts:361-364; `assoc-positions-flow.hurl` has **0** 403 assertions |
| 2FA-gated privileged actions | President w/o 2FA | 403 in production | Partially Implemented | Yes | `V1 REQUIRED` | §5 row 2 |
| Analyst read-only platform access | analyst | Mutations 403 | Partially Implemented | Yes | `V1 REQUIRED` | §5 row 1 |
| Cross-org data isolation | Officer of org A vs org B | 403 | Implemented (membership + term checks scoped by orgId) | No | `V1 REQUIRED` | `security-officer-auth.hurl` ("cross-org data leakage"), org-context |
| Invite issuance restricted to officers | Member | 403 | Missing | Yes | `V1 REQUIRED` | `createInvite.ts` |
| Centralized permission management UI | Admin | n/a | Not Required for V1 | — | `V2 DEFERRED` | No spec demand |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| G1: Super-only platform mutations unguarded by admin role (createOrganization, setFeatureFlag, deleteFeatureFlag, transitionOrgStatus, updateOrganization) | platformadmin | P1 | `V1 REQUIRED` | `handlers/platformadmin/createOrganization.ts` (no role check); grep of flag/status handlers (no matches for role/super/Forbidden); matrix §3.7 | analyst (read-only by spec) can create orgs, flip feature flags, transition org lifecycle — privilege escalation inside admin tier | Per-handler super check (pattern: `createAssociation.ts:21-23`) or shared `requireAdminRole` helper |
| G2: `requireOfficerTerm` missing 2FA enforcement while claiming it | core/auth | P1 | `V1 REQUIRED` | `core/auth/officer-checks.ts:10-11` vs `:26-46`; inline path used by subset of 64 handler files | Privileged officers without 2FA can execute officer-gated actions on inline-checked routes in production — defeats matrix §4 | Add privileged-title 2FA block mirroring `require-officer.ts` |
| G3: TypeSpec session-role strings unassignable in production | generated routes / auth | P1 | `V1 REQUIRED` | routes.ts:23-52 (`association:admin`/`association:staff` on /accredited-providers), :128-204 (`platform_admin`/`national_officer`); sole assignment `seed/layer-2-users.ts:350` | Either blocks legitimate officers (accredited-providers CRUD 403s everyone un-seeded) or gives false sense of role enforcement; seeds mask it in CI | [NEEDS PRODUCT DECISION] choose role-provisioning vs removing the role gates; then align TypeSpec |
| G4: Any member can create invitations | invite | P1 | `V1 REQUIRED` | `createInvite.ts`; m01 §6 | Spam/abuse vector; violates m01 permission table | Officer-term gate on POST /invite [SHARED DEPENDENCY: invite module handler — enforcement logic is auth-rbac's] |
| G5: ROLE_PERMISSION_MATRIX documents dead enforcement (officerAuthMiddleware §2/§4; hasMinimumRole §5; requireCommitteeRole §3.28) | spec | P1 | `V1 REQUIRED` | greps in §3/§5 above | Matrix is the primary RBAC acceptance reference for every other module audit; auditors and devs will trust phantom layers | Update matrix to describe the actual mechanism set; archive dead code |
| G6: No negative RBAC contract tests beyond one file | tests | P1 [TEST GAP] | `V1 REQUIRED` | `assoc-positions-flow.hurl`, `admin-flow.hurl`, `platformadmin-extended-flow.hurl`: 0 × `HTTP 403`; only `security-officer-auth.hurl` (8) | Permission regressions (incl. G1-G4 fixes) cannot be safely verified | Add contract scenarios (see §20) before/with fixes |
| G7: `auth-gate-coverage.test.ts` tests locally re-defined pure functions, not production code | tests | P2 [TEST GAP] | `V1 RECOMMENDED` | `handlers/auth-gate-coverage.test.ts` defines `canPublishAnnouncement` etc. inside the test file | Coverage metric counts it as auth-gate protection; it protects nothing in `src` | Rebind tests to real handlers/middleware or relabel as documentation tests |
| G8: org-context platform-admin bypass grants full org-member role to all admin tiers | org-context | P2 | `V1 RECOMMENDED` | `middleware/org-context.ts` admin block (`role:'admin'`, any orgId) | analyst gets member-level org access everywhere; combined with G1 widens analyst surface | After G1, decide whether analyst should bypass membership at all |
| G9: 2FA dev-skip divergence (dead middleware always enforces; live paths skip unless production) | core/auth | P3 | `V1 RECOMMENDED` | `officer-auth.ts` (no NODE_ENV) vs `require-*.ts`/`officer-checks.ts` (NODE_ENV-gated) | Confusing precedent when resurrecting code; tests assert dead semantics | Resolve when removing dead middleware |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Officer manages accredited providers (`/accredited-providers/:organizationId` CRUD) | Officer with "Society Officer"/"President" title succeeds | `authMiddleware({roles:["association:admin","association:staff"]})` runs first; production users have role `user` → 403 before position check ever runs (works only for seeded users) | routes.ts:21-52; `userHasRole` exact match; seed-only assignment | P1 | Contract: sign in as real officer (no seeded role), expect 200 on list — currently would fail [NEEDS CONFIRMATION via runtime] |
| Analyst clicks mutation in admin UI sections hidden client-side, or calls API directly | 403 | 200 on createOrganization/feature flags/org status | G1 evidence | P1 | Contract: analyst token → POST /admin/organizations expects 403 |
| Privileged officer without 2FA hits inline-gated officer route in production | 403 (enable 2FA) | Allowed (requireOfficerTerm has no 2FA branch) | G2 evidence | P1 | Unit: prod-env requireOfficerTerm with president-without-2FA expects 403 |
| Member sends org invite | 403 | 201 with token | G4 evidence | P1 | Contract: member token → POST /invite expects 403 |
| Authenticated member opens admin app URL | Access denied screen | Shell renders; data calls 403; some pages without RequireRole may flash empty states | `apps/admin/src/routes/__root.tsx:49-54` | P3 | E2E: member session loads admin route → asserts denied UI |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `officerAuthMiddleware` | dead middleware + live test suite | `middleware/officer-auth.ts`; zero mounts | Misleads matrix readers; dead 2FA semantics maintained | Remove after matrix update (keep git history) |
| `requireOrgRole`, `hasMinimumRole` | dead exports + tests | `utils/org-auth.ts`; zero callers | Doc drift | Deprecate/remove; fix matrix §5 |
| `client`/`host`/`:owner` role machinery | legacy template code | `middleware/auth.ts`, `auth.test.ts:226-310`; matrix §6.5 "not currently used" | Complexity | Do not expand; `[DO NOT OVERBUILD]` |
| `x-security-required-roles` gates w/o role-provisioning | decorative/blocking security config | G3 evidence | False security or feature-block | Resolve per G3 decision |
| `requireCommitteeRole` (referenced, absent) | phantom spec reference | matrix §3.28 | Spec mismatch | Verify committee handlers' real guard [CROSS-MODULE RISK] |
| `ORPHANED: /dues/funds/{orgId}` note in security hurl | orphaned contract target | `security-officer-auth.hurl` comment | Contract suite tests a route with "no spec equivalent" | Reconcile with HAND_WIRED_ROUTES.yaml [SHARED DEPENDENCY: api-contract-pipeline] |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `user.role` is a comma-separated string carrying mixed vocabularies (better-auth `user`/`admin`, template `client`/`host`, seeded `association:admin`, asserted-but-unassigned `platform_admin`/`national_officer`) | schema/model | `utils/auth.ts:hasRole` (split(',')); `seed/layer-2-users.ts:350` | P2 | Define canonical user.role vocabulary; document in matrix §1 |
| Officer authority resolved per-request from governance DB (no session caching) — correct revocation semantics, N+1 risk acceptable | backend/service | `core/ports` governance port usage in 3 middlewares | P3 | Keep; note in PERFORMANCE.md if hot |
| org-context falls back to consuming request body JSON to find orgId in wildcard middleware | API | `middleware/org-context.ts` body-parse block | P3 | Keep (Hono caches body); covered by org-context.test.ts:141 |
| `INVITE_TOKEN_SECRET` falls back to `'dev-secret-change-in-production'` | backend/config | `handlers/invite/createInvite.ts:40` | P2 | Fail-fast in production config validation [SHARED DEPENDENCY: core/config.ts] |
| platform_admin role enum (`super`,`support`,`analyst`) matches matrix §1 | schema | `platformadmin/repos/platform-admin.schema.ts:39-42` | — | OK |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Super-only platform mutations callable by analyst/support (G1) | platform admin tiers | §10 G1 | P1 | Per-handler super guard |
| Inline `requireOfficerTerm` lacks 2FA (G2) | officer 2FA | §10 G2 | P1 | Add 2FA branch |
| TypeSpec session-role gates unassignable (G3) | session roles | §10 G3 | P1 | Product decision + alignment |
| Any member can create invites (G4) | invite issuance | §10 G4 | P1 | Officer gate |
| Matrix documents phantom layers (G5) | documentation-as-spec | §10 G5 | P1 | Rewrite matrix §2/§4/§5/§3.28 |
| Platform-admin bypass in org-context ignores admin tier (G8) | analyst scope | §10 G8 | P2 | Tier-aware bypass or read-only flag |
| Impersonation: code allows support, matrix/admin-UI say super only | impersonation | `startImpersonation.ts:11`; `role-gate.tsx ROUTE_ROLES['/impersonate']` | P2 | [NEEDS PRODUCT DECISION] |
| Public path exemption uses `startsWith` prefix match | public allowlist | `app.ts:419-423` | P3 | Currently safe (all listed prefixes are public-by-design subtrees); prefer exact/regex match to avoid future accidental exemptions |
| Positive: titles always DB-sourced (T-13-01), case-insensitive, OR semantics; CSRF + rate-limit + impersonation write-block global; banned-user rejection; timing-safe internal token compare | core posture | `require-position.ts`, `app.ts:256-294`, `auth.ts` | — | Keep |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| 196 generated routes carry per-route audit middleware (x-audit); skipped on 4xx/5xx by design | audit trail | `grep -c createPerRouteAuditMiddleware routes.ts` = 196; ADR-0007 | — | OK |
| Denied authorization attempts (403s) produce no audit events (audit skips non-2xx by design) | security event log | ADR-0007 "Skipped on 4xx/5xx" | P2 | Consider security-event logging for repeated 403s on privileged routes — `V2 DEFERRED` unless THREAT_MODEL requires it [NEEDS PRODUCT DECISION] |
| Impersonation sessions persisted with admin/target/expiry | impersonation audit | `impersonation-guard.ts` resolver | — | OK |

## 16. Knowledge Graph Findings

KG (2026-06-06, 3,474 nodes) used as secondary evidence only; all findings below re-verified by direct inspection.

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Audit-index §13 lists `core/auth.ts` + lockout/hardening/session-limit as Better-Auth core cluster with tests | `docs/aha/outputs/module-audit-index.md` rows 207-208 | Session-layer health belongs to auth-onboarding audit; not re-audited here | Cover lockout/session-hardening depth in auth-onboarding gap plan |
| Index row 208 maps officer/position enforcement to generator + routes.ts + governance/finance/admin consumers | same | Matches code reality (49 generated gates) | None |
| KG predates Jun 6-11 commits (doc restructure) | `docs/aha/kg/knowledge-graph-status.md` | Low for this module — middleware files unchanged since Jun 6-7 (mtimes) | Refresh before prompt 05 as planned |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Real authority model is term-based (officer terms + position titles per org), not static role hierarchy | `MODULE_SPEC.member.governance.md` domain refs; org-context comment "role granularity comes from governance module" | Matrix's role-column framing (VP/board-member/staff columns) maps to position **titles**, enforceable only via requirePosition title lists | When fixing matrix (G5), express rows as required position titles, not hierarchy levels |
| BR-09/BR-21: roles are per-org, not global — enforced (term lookups always org-scoped) | `guards.ts requireOrgOfficer` docstring; `findActiveOfficerTermsByPersonAndOrg` | Positive confirmation | None |
| 2FA-for-privileged is a product trust commitment (P1-3) spanning matrix §4 + m01 | matrix §4; `officer-checks.ts` P1-3 refs | G2 directly undermines it | Fix G2 |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run.

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| Hurl inspection only (static): negative-RBAC assertions concentrated in `security-officer-auth.hurl` (8× HTTP 403); `assoc-positions-flow.hurl` / `admin-flow.hurl` / `platformadmin-extended-flow.hurl` contain 0 | Hurl (read) | `specs/api/tests/contract/` | Permission regressions unverifiable for position-title and admin-tier scenarios | Add scenarios per §20; no evidence files saved (no runtime run) |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `middleware/auth.test.ts` | backend/unit | required/optional auth, role OR-logic, multi-role strings, :owner syntax, banned users | High |
| `middleware/org-context.test.ts` | backend/unit | 401/403 paths, membership pass, platform-admin bypass, body orgId resolution | High |
| `middleware/require-position.test.ts` / `require-officer.test.ts` | backend/unit + permission | generated middleware incl. 2FA branches (env-gated), body mode | High |
| `middleware/platform-admin-auth.test.ts` | backend/unit | non-admin 403, all three admin roles pass | High |
| `middleware/officer-auth.test.ts` | backend/unit | **dead middleware** incl. 2FA case-insensitivity | Low (tests unwired code) |
| `core/auth/officer-checks.test.ts` | backend/unit | requireOfficerTerm/requirePosition allow/deny, 401/403 | Medium (no 2FA case for requireOfficerTerm — masks G2) |
| `middleware/custom-routes-auth.test.ts` | backend/unit | auth wired on custom module route prefixes (mirrored app, not real app.ts) | Medium |
| `middleware/impersonation-guard.test.ts` | backend/unit | resolver + write block | High [NEEDS CONFIRMATION — not read in full] |
| `handlers/auth-gate-coverage.test.ts` | backend/unit | pure functions **defined in the test file itself** (BR-02/04/11/14/33/34) | Low (does not exercise src code) |
| `specs/api/tests/contract/security-officer-auth.hurl` | contract/permission | non-officer 403 on dues/events/roster/training/election/announcement; officer positive path | High |
| `specs/api/tests/contract/admin-flow.hurl` | contract | anonymous 401, admin happy path | Medium (no authenticated-non-admin 403) |
| `apps/memberry` E2E (102 specs) | E2E | auth funnel journeys (per audit index) | Unknown for RBAC-specific denials |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| analyst/support token → 403 on createOrganization, setFeatureFlag, deleteFeatureFlag, transitionOrgStatus, updateOrganization | backend/unit + contract (permission) | Locks G1 fix; currently zero coverage | Before (RED first) |
| `requireOfficerTerm` privileged-officer-without-2FA → 403 (production env) | backend/unit (permission) | Locks G2; absence of this test is why G2 survived | Before |
| Real (non-seeded-role) officer on `/accredited-providers/*` → expected success | contract | Exposes/locks G3 decision | Before G3 fix |
| member token → POST /invite → 403 | contract (permission) | Locks G4 | Before |
| Position-title negative: treasurer attempts President-only op (e.g. DELETE /association/documents/:id) → 403 | contract (permission) | 43 requirePositionMiddleware routes have zero contract-level negative checks | During |
| Authenticated non-admin member → /admin/* → 403 | contract (permission) | admin-flow.hurl only covers anonymous 401 | During |
| Route-registry assertion: every officer-gated TypeSpec op (per matrix) emits requireOfficer/requirePosition middleware in routes.ts | backend/unit (regression) | Prevents silent loss of extensions on regeneration | During |
| Rebind/replace `auth-gate-coverage.test.ts` to production functions | backend/unit | Removes fake-green coverage (G7) | During |
| Impersonating admin write attempt → 403 (contract) | contract | Write-block only unit-tested | During (V1 RECOMMENDED) |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| `GovernancePort` / `OfficerTermRepository` (association:member governance schema) | cross-module | `core/ports` used by 3 middlewares; `officer-checks.ts:14` imports repo directly | All officer/position enforcement reads governance data; mega-module split (P1-11) will move it | [CROSS-MODULE RISK] — keep port indirection; officer-checks.ts direct repo import should migrate to port during fix |
| `platform_admin` table + `MembershipPort` | database/schema | org-context, platform-admin-auth | Admin bypass + membership checks | [SHARED DEPENDENCY] — no schema change needed for fixes |
| Generator `scripts/generate.ts` | shared/platform | emits all auth/officer/position/audit middleware | G3 fix may require TypeSpec + regeneration across modules | [SHARED DEPENDENCY] — regenerate after .tsp edits; review diff of routes.ts |
| `handlers/invite/createInvite.ts` | cross-module | G4 fix touches invite module | Enforcement rule owned by auth-rbac, file owned by invite | [CROSS-MODULE RISK] — coordinate with invite/auth-onboarding audit |
| `seed/layer-2-users.ts:350` | environment/tooling | seeds assign `association:admin`, masking G3 in CI/E2E | Tests pass while production behavior differs | Note for test-infrastructure audit; do not "fix" by seeding more roles |
| ROLE_PERMISSION_MATRIX.md rewrite | product decision | G5 | Other module audits cite it as acceptance criteria | Update early so downstream audits don't inherit phantom claims |
| `core/config.ts` production validation (INVITE_TOKEN_SECRET) | shared/platform | §13 | Fail-fast secrets | [SHARED DEPENDENCY] |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Add super-role guard to 5 platformadmin handlers (or shared `requireAdminRole` helper) | G1 | P1 | `V1 REQUIRED` | unit + contract negatives | Follow `createAssociation.ts:21-23` pattern; helper preferable (6th+ usage exists) |
| Add 2FA branch to `requireOfficerTerm` | G2 | P1 | `V1 REQUIRED` | unit (prod env) | Mirror `require-officer.ts`; align NODE_ENV gating |
| Resolve session-role model: provision roles or strip `x-security-required-roles` from accredited-providers/national-dashboard ops | G3 | P1 | `V1 REQUIRED` | contract for real officer | [NEEDS PRODUCT DECISION] first; touches .tsp + regen [SHARED DEPENDENCY] |
| Officer gate on POST /invite | G4 | P1 | `V1 REQUIRED` | contract negative | Smallest fix: inline `requireOfficerTerm(ctx)` in createInvite |
| Rewrite matrix §2/§4/§5/§3.28 to actual mechanisms | G5 | P1 | `V1 REQUIRED` | n/a (doc) | Do before other module audits consume it |
| Add negative RBAC contract pack (analyst, position-title, non-admin /admin, member-invite) | G6 | P1 | `V1 REQUIRED` | the tests themselves | Extend `security-officer-auth.hurl` family |
| Rebind auth-gate-coverage tests to src functions | G7 | P2 | `V1 RECOMMENDED` | rewritten tests | Or relabel file to avoid fake coverage |
| Delete `officer-auth.ts` (+test), deprecate `requireOrgRole`/`hasMinimumRole` | G5/G9, §12 | P2 | `V1 RECOMMENDED` | typecheck only | After matrix rewrite |
| Tier-aware org-context admin bypass (analyst read-only) | G8 | P2 | `V1 RECOMMENDED` | unit | Pair with G1 |
| Position-title filter + 2FA on bulkImportMembers | m01 §6 | P2 | `V1 RECOMMENDED` | unit | |
| Align impersonation roles with matrix (or matrix with code) | §14 | P2 | `V1 RECOMMENDED` | unit | [NEEDS PRODUCT DECISION] |
| Exact-match public-path allowlist | §14 | P3 | `V1 RECOMMENDED` | unit | Low risk, low cost |
| Fail-fast on INVITE_TOKEN_SECRET default in production | §13 | P2 | `V1 RECOMMENDED` | config test | [SHARED DEPENDENCY: core/config.ts] |
| Security-event logging for repeated 403s on privileged routes | §15 | P3 | `V2 DEFERRED` | — | Needs THREAT_MODEL confirmation |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Implement matrix §5 hierarchy enforcement (hasMinimumRole wiring, 8-level org roles) | `DO NOT ADD` `[DO NOT OVERBUILD]` | Position-title model already covers real product needs; building a parallel hierarchy creates duplicate sources of authority |
| Generic policy-engine / centralized RBAC service (Casbin-style) | `DO NOT ADD` `[DO NOT OVERBUILD]` | Current declarative-extension + port model is adequate; no evidence of need |
| Expanding `client`/`host`/`:owner` role machinery | `DO NOT ADD` | Template leftovers, unused per matrix §6.5 |
| 403 security-event audit stream | `V2 DEFERRED` | Useful, but audit-on-success is the designed contract; needs THREAT_MODEL driver |
| Session-cached officer roles (perf) | `V2 DEFERRED` | Per-request DB lookup gives correct instant revocation; no perf evidence yet |
| Committee-scoped role middleware generalization | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | First confirm what committee handlers actually do (G/§5 row 9) |
| Admin-app server-side route gating (SSR/edge) | `V2 DEFERRED` | Client gate + backend 403 is acceptable defense-in-depth for V1 |

## 24. Audit Decision

**PARTIAL PASS**

The core enforcement chain is real and tested: Better-Auth session validation with banned-user rejection, fail-closed org-membership resolution, DB-sourced officer-term and position-title checks (generated via ADR-0007 extensions on 49 routes + 64 inline handler files), platform-admin table gating on `/admin/*`, impersonation write-blocking, CSRF/rate-limit hardening, and a passing negative-authorization contract file. Members cannot perform officer actions; non-admins cannot reach `/admin/*`; cross-org isolation holds.

It is not a PASS because the module's own primary spec is partially fiction (dead `officerAuthMiddleware`, dead `hasMinimumRole`, phantom `requireCommitteeRole`), and four concrete P1 enforcement gaps exist: super-only platform mutations open to analyst/support (G1), missing 2FA on the inline `requireOfficerTerm` path (G2), TypeSpec session-role gates that production users can't satisfy or that enforce nothing (G3), and member-issuable invitations (G4) — with near-zero negative contract coverage to catch regressions (G6). It is not a FAIL because none of these break the primary member/officer/admin separation that V1 workflows depend on.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Is there any production flow (Better-Auth admin plugin, admin invite acceptance) that sets `user.role` to `platform_admin` / `national_officer` / `association:admin`? Only `seed/layer-2-users.ts:350` found | `[NEEDS CONFIRMATION]` | Decides whether G3 is feature-blocking (accredited-providers 403 for everyone) or dead-gate | Eng |
| Should `support` admins be allowed to impersonate (code) or super only (matrix + admin UI)? | `[NEEDS PRODUCT DECISION]` | Privileged capability divergence | Product |
| Is matrix §2 layer-2 (`officerAuthMiddleware`) intended future architecture or stale doc? | `[NEEDS CONFIRMATION]` | Determines fix direction for G5 (delete code vs mount it) | Eng |
| What guard do committee handlers actually use for committee-scoped roles (matrix §3.28 cites nonexistent `requireCommitteeRole`)? | `[NEEDS CONFIRMATION]` `[CROSS-MODULE RISK]` | Matrix accuracy + committee-management audit input | Eng (committee-management audit) |
| Should denied (403) attempts on privileged routes emit security/audit events, given audit-on-success-only design? | `[NEEDS PRODUCT DECISION]` | Compliance posture for a healthcare-adjacent AMS | Product/Security |
| Should analyst retain the org-context membership bypass at all (read-everything posture)? | `[NEEDS PRODUCT DECISION]` | Scope of analyst data access across all orgs | Product |
| Are `requireActiveStatus`/`requireTenantAccess` called anywhere (not verified in this pass)? | `[NEEDS CONFIRMATION]` | Cleanup scope for org-auth.ts | Eng |

## 26. Notes for Gap Plan Organizer

- **True V1 P1 fixes, suggested order:** (1) G1 super-only guards — small, isolated, 5 handlers + helper; (2) G2 requireOfficerTerm 2FA — single function; (3) G4 invite officer gate — single handler; (4) G6 negative contract pack — write RED tests first for 1-3; (5) G5 matrix rewrite — doc-only but **do it early** because every subsequent module audit consumes the matrix; (6) G3 — **blocked on product decision** (role provisioning vs gate removal); do not batch with 1-4.
- **Tests to write first:** §20 rows 1-4 (analyst-403, 2FA-403, member-invite-403, real-officer-accredited-providers). G2's unit test needs production-env simulation (NODE_ENV) — follow the pattern in `require-officer.test.ts`.
- **Blocked items:** G3 (product decision), impersonation role divergence (product decision), 403 security events (product decision), committee role guard (needs confirmation, belongs to committee-management audit).
- **Must NOT be implemented:** matrix §5 hierarchy enforcement, policy engine, client/host expansion — see §23.
- **Risky shared dependencies:** any G3 fix touches TypeSpec + `scripts/generate.ts` regeneration (whole routes.ts diff); officer-checks.ts fix should also swap its direct `OfficerTermRepository` import for the governance port (S-C4-014 pattern) but keep that minimal.
- **Cleanup batch (after doc fix):** delete `middleware/officer-auth.ts` + test, deprecate `requireOrgRole`/`hasMinimumRole`, rebind `auth-gate-coverage.test.ts`.
- **Cross-cutting signals for prompt 05:** seeds masking production role gaps (G3 pattern may recur in other modules); audit-skips-4xx design; fake-green pure-function test pattern (G7) may exist in other `*-coverage.test.ts` files.

---

Next recommended step:
Module/group: Auth/RBAC enforcement
Module slug: auth-rbac
Primary PRD/spec: docs/product/ROLE_PERMISSION_MATRIX.md
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/auth-rbac-gap-plan.md
