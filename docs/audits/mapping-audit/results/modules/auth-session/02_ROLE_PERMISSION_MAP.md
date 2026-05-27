# Module 1: Auth/Session — Role Permission Map Audit

**Scope**: middleware/, core/auth.ts, utils/auth.ts, utils/org-auth.ts, utils/officer-check.ts, frontend auth guards
**Date**: 2026-05-26 (revised with spec gap-fill)
**Coverage Target**: 90%+

---

## 1. Role Inventory

| Role | Source | Frontend Usage | Backend Usage | Notes |
|------|--------|---------------|---------------|-------|
| `user` | Better-Auth default | Session context, `_authenticated.tsx` | `authMiddleware({ required: true })` | Base authenticated role |
| `admin` | Better-Auth admin plugin | Not directly used in memberry app | `authMiddleware({ roles: ['admin'] })`, `platformAdminAuthMiddleware()` | Platform-level admin |
| `member` | `orgContextMiddleware` sets `role='member'` for ALL users | Sidebar/nav conditionals via org membership queries | `requireOrgRole()` checks org membership | [CURRENT BEHAVIOR] — orgContextMiddleware sets role='member' for everyone, making requireOrgRole unable to distinguish members from officers |
| `officer` | Derived from `officer_terms` table | `officerQueries` in `_authenticated.tsx` detect officer orgs | `officerAuthMiddleware()`, `requireOfficerTerm()` | Active term in org required |
| Position: `president` | `officer_terms.positionTitle` | Not enforced on frontend | `requirePosition(ctx, ['president'])`, 2FA enforcement in `PRIVILEGED_POSITIONS` | Privileged — requires 2FA |
| Position: `treasurer` | `officer_terms.positionTitle` | Not enforced on frontend | `requirePosition(ctx, ['treasurer'])`, 2FA enforcement | Privileged — requires 2FA |
| Position: `secretary` | `officer_terms.positionTitle` | Not enforced on frontend | `requirePosition(ctx, ['secretary'])`, 2FA enforcement | Privileged — requires 2FA |
| Position: other | `officer_terms.positionTitle` | Not enforced on frontend | `requirePosition(ctx, [title])` | No 2FA requirement |
| `platform_admin` | `platform_admin` DB table | `apps/admin/` only | `platformAdminAuthMiddleware()` checks table membership | Separate from Better-Auth roles |
| `impersonator` | Admin impersonation flow | N/A (admin app only) | `impersonationResolver()` reads cookie, `impersonationWriteBlock()` blocks mutations | Write operations blocked during impersonation |

---

## 2. Auth Middleware Stack (4 Layers)

| Layer | Middleware | File | Applied To | Mechanism |
|-------|-----------|------|-----------|-----------|
| 1 — Session | `authMiddleware()` | `middleware/auth.ts` | All non-public routes | Session validation via Better-Auth; optional `roles` array (OR logic); supports `role:permission` syntax |
| 2 — Officer | `officerAuthMiddleware()` | `middleware/officer-auth.ts` | `/association/*` mutations (selectively) | Verifies active officer term via `OfficerTermRepository.findActiveByPersonAndOrg()`; 2FA for president/treasurer/secretary |
| 3 — Platform Admin | `platformAdminAuthMiddleware()` | `middleware/platform-admin-auth.ts` | `/admin/*` routes | Checks `platform_admin` table membership |
| 4 — Handler Guards | `requireOfficerTerm()`, `requirePosition()`, `requireOrgRole()` | `utils/officer-check.ts`, `utils/org-auth.ts` | Per-handler | Returns 403 Response or null (not middleware — handler-level) |

---

## 3. Role Access Matrix

| Role | Route/Action | Expected Access | Frontend Enforcement | Backend Enforcement | Status | Severity |
|------|-------------|----------------|---------------------|--------------------|---------|----|
| Unauthenticated | `/public/orgs` | ALLOW | No guard | No auth middleware | Working | — |
| Unauthenticated | `/og/events/:slug` | ALLOW | No guard | No auth middleware | Working | — |
| Unauthenticated | `/credentials/lookup/:num` | ALLOW | No guard | No auth middleware | Working | — |
| Unauthenticated | `/certificates/verify/:num` | ALLOW | No guard | No auth middleware | Working | — |
| Unauthenticated | `/pay/:token/validate` | ALLOW | No guard | No auth middleware | Working | — |
| Unauthenticated | `/pay/:token/process` | ALLOW | No guard | No auth middleware | Working | — |
| Unauthenticated | `/email/unsubscribe` (GET+POST) | ALLOW | No guard | No auth middleware | Working | — |
| Unauthenticated | `/email/suppressions` | ALLOW | No guard | No auth middleware | [LIKELY BUG] — suppressions list should require auth | P1 |
| Unauthenticated | `/invite/validate/:token` | ALLOW | No guard | No auth middleware | Working | — |
| Unauthenticated | Association public paths (6) | ALLOW | No guard | `ASSOCIATION_PUBLIC_PATHS` bypass in `app.use('/association/*')` | Working | — |
| Unauthenticated | `/auth/*` (Better-Auth) | ALLOW | No guard | Better-Auth handles | Working | — |
| Unauthenticated | Any `/_authenticated/*` route | BLOCK → redirect to sign-in | `requireAuth()` in `beforeLoad` | `authMiddleware()` → 401 | Working | — |
| Authenticated user | `/association/*` (non-public) | ALLOW (session valid) | `requireAuth()` | `authMiddleware()` global on `/association/*` | Working | — |
| Authenticated user | Officer-only mutations | BLOCK (no officer term) | No frontend block — UI visible | `officerAuthMiddleware()` or `requireOfficerTerm()` → 403 | [NEEDS MANUAL CONFIRMATION] — some officer routes may be visible to non-officers in frontend | P2 |
| Officer | Officer mutations in own org | ALLOW | Officer sidebar visible when `officerOrgIds.has(orgId)` | `officerAuthMiddleware()` + org check | Working | — |
| Officer (president/treasurer/secretary) | Privileged operations | ALLOW only with 2FA | No 2FA check on frontend — backend-only | `PRIVILEGED_POSITIONS` check in `officerAuthMiddleware()` + `requirePosition()` | [CURRENT BEHAVIOR] — no frontend prompt for 2FA before privileged actions | P2 |
| Platform Admin | `/admin/*` routes | ALLOW | `apps/admin/` app only | `authMiddleware()` + `platformAdminAuthMiddleware()` | Working | — |
| Impersonator (admin) | Read operations | ALLOW | N/A (admin app) | `impersonationResolver()` sets context | Working | — |
| Impersonator (admin) | Write operations (POST/PUT/PATCH/DELETE) | BLOCK | N/A (admin app) | `impersonationWriteBlock()` → 403 | Working | — |
| Any authenticated | Internal service token bypass | ALLOW (bypasses role checks) | N/A | `authMiddleware` checks `X-Internal-Service-Token` header via timing-safe compare | Working — used for service-to-service calls | — |

---

## 4. Permission Gap Report

| ID | Gap | Role | Route/API/Component | Evidence | Risk | Severity | Recommended Test Type |
|----|-----|------|--------------------|---------|----- |----------|-----------------------|
| AUTH-GAP-01 | `/email/suppressions` has no auth middleware | Unauthenticated | `app.ts` line: `app.get('/email/suppressions', listEmailSuppressions)` | No `authMiddleware()` on this route | Data leak — anyone can see suppression list | P1 | API integration test: GET /email/suppressions without auth should return 401 |
| AUTH-GAP-02 | orgContextMiddleware sets role='member' for ALL users — `requireOrgRole()` cannot distinguish members from officers | All | `middleware/org-context.ts`, `utils/org-auth.ts` | Comment in `officer-check.ts`: "orgContextMiddleware sets role='member' for ALL users, making requireOrgRole() unable to distinguish members from officers" | `requireOrgRole()` may be ineffective for officer-only restrictions | P1 | Unit test: verify requireOrgRole behavior when user is not an org member |
| AUTH-GAP-03 | Frontend does not enforce officer position restrictions — all officers see same UI regardless of position | president/treasurer/secretary vs other officers | `_authenticated.tsx` — only checks `officerOrgIds` set, not position titles | Frontend shows all officer features to any officer; backend enforces position-specific access | Usability — officer sees actions they'll get 403 on | P2 | E2E test: non-treasurer officer attempts finance action, verify graceful error |
| AUTH-GAP-04 | No frontend 2FA prompt before privileged actions | president/treasurer/secretary | Frontend officer pages | Backend enforces 2FA for PRIVILEGED_POSITIONS but frontend doesn't prompt/check | User gets unexpected 403 when 2FA not configured | P2 | E2E test: privileged officer without 2FA attempts action, verify helpful error message |
| AUTH-GAP-05 | Hand-wired routes (24 pre-migration) may have inconsistent auth middleware application | Various | `app.ts` pre-migration routes section | Some hand-wired routes use `authMiddleware()` but may miss `orgContextMiddleware()` or officer checks | Inconsistent authorization enforcement | P1 | API integration test: verify each hand-wired route enforces expected auth |
| AUTH-GAP-06 | Internal service token bypass has no rate limiting or audit logging | N/A | `middleware/auth.ts` — `X-Internal-Service-Token` check | Token bypass skips role checks entirely; if token leaked, full API access | Service token compromise = full bypass | P2 | Security test: verify internal token is logged in audit trail |
| AUTH-GAP-07 | `accredited-providers/*` auth applied via `app.use()` before generated routes due to "codegen gap" | Authenticated users | `app.ts`: `app.use('/accredited-providers/*', authMiddleware())` | Comment: "generated routes omit authMiddleware due to codegen gap" | Relies on middleware ordering; could break if route registration order changes | P2 | Integration test: verify accredited-provider routes require auth |

---

## 5. Module Spec Permission Requirements (Gap Analysis)

Per `docs/product/modules/m01-auth-onboarding/MODULE_SPEC.md` — 9 workflows with explicit permission gates:

| Workflow | Spec Requirement | Implementation Status | Gap |
|----------|-----------------|----------------------|-----|
| WF-001 Self-Register | Public | Better-Auth handles | — |
| WF-002 Account Claim | Token-gated, public | Better-Auth + token | — |
| WF-003 Login | Public → GA | Better-Auth handles | — |
| WF-004 Forgot Password | Public | Better-Auth handles | — |
| WF-005 Onboarding Wizard | **GA + HG (officer + org access)** | [NEEDS MANUAL CONFIRMATION] — wizard endpoints not found in app.ts | P1 — spec defines wizard but implementation unclear |
| WF-006 Magic Link | Public | Better-Auth magicLink plugin | — |
| WF-008 Invite Member | **GA + HG (president, secretary, officer)** | `authMiddleware()` + `orgContextMiddleware()` on `/invite` in app.ts | [NEEDS MANUAL CONFIRMATION] — no `requirePosition` check for invite |
| WF-009 Bulk CSV Import | **GA + HG + 2FA (president 2FA, secretary 2FA, super, admin)** | [NEEDS MANUAL CONFIRMATION] — import endpoint and 2FA enforcement not verified | P1 — spec requires 2FA for import |

---

## 6. Test Coverage Assessment

| Permission Rule | Existing Test | Test Quality | Missing Test | Recommended Test Type |
|----------------|--------------|-------------|-------------|----------------------|
| Session validation (authMiddleware) | `middleware/auth.test.ts` | STRONG — tests required/optional auth, role checks, token bypass | — | — |
| Officer term check | `middleware/officer-auth.test.ts` [NEEDS MANUAL CONFIRMATION], `utils/officer-check.test.ts` | STRONG — tests deny/allow branches | Missing: 2FA enforcement for privileged positions | API integration |
| Platform admin guard | `middleware/platform-admin-auth.test.ts` | STRONG — tests table membership check | — | — |
| Impersonation write block | `middleware/impersonation-guard.test.ts` | STRONG — tests read allow, write block | — | — |
| Org context resolution | `middleware/org-context.test.ts` | STRONG — tests org resolution | Missing: edge case where user has no membership | Unit |
| Route protection coverage | `handlers/auth-gate-coverage.test.ts` | STRONG — comprehensive pure domain function tests covering BR-02, BR-04, BR-11, BR-14, BR-33, BR-34 | Missing: coverage for 24 hand-wired pre-migration routes | API integration |
| Frontend auth redirect | None found | NONE | No E2E test for unauthenticated user redirect to sign-in | E2E |
| Frontend officer UI gating | None found | NONE | No test that non-officer users don't see officer features | E2E |
| Account lockout | `core/auth-session-hardening.test.ts` | STRONG — tests lockout after MAX_FAILED_ATTEMPTS | — | — |
| Session limit enforcement | `core/auth-session-hardening.test.ts` | STRONG — tests concurrent session limits | — | — |

---

## Summary (Revised)

- **Total roles identified**: 10 (user, admin, member, officer, 4 officer positions, platform_admin, impersonator)
- **Auth layers**: 4 (session → officer → platform admin → handler guards)
- **P0 findings**: 0
- **P1 findings**: 5 (AUTH-GAP-01, AUTH-GAP-02, AUTH-GAP-05, WF-005 wizard permission, WF-009 import 2FA)
- **P2 findings**: 4 (AUTH-GAP-03, AUTH-GAP-04, AUTH-GAP-06, AUTH-GAP-07)
- **Backend test coverage**: MIXED — 4/11 files STRONG, 6/11 WEAK (shallow assertions)
- **Frontend test coverage**: NONE — no auth-related E2E tests
- **Spec BR coverage**: 0/15 fully tested, 2/15 partially tested
- **Spec workflow coverage**: 0/9 fully tested E2E
