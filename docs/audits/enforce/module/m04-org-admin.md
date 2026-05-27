# oli-enforce-module: m04-org-admin

> Generated: 2026-05-27 | Auditor: Claude Opus 4.6 (1M) | Handler dir: `services/api-ts/src/handlers/association:member/`

## Compliance Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | **3.0 / 10** (capped by P0) |
| Findings | 2 P0, 5 P1, 3 P2, 1 P3 |
| Spec endpoints declared | 8 |
| Spec endpoints with handlers | 5 (partial -- see below) |
| Spec endpoints fully missing | 3 (discipline, transition, dashboard) |
| Domain events declared | 5 published, 2 consumed |
| Domain events implemented | 0 published, 1 consumed (dues only) |
| State machines declared | 2 (org lifecycle, officer term) |
| State machines guarded in handlers | 0 |

## Dimension Scores

| Dim | Name | Raw Score | Cap | Final | Rationale |
|-----|------|-----------|-----|-------|-----------|
| 1 | Public API | 5.0 | -- | 5.0 | 5/8 spec endpoints have handlers. Missing: `POST /org/:id/discipline`, `POST /org/:id/officers/:termId/transition`, `GET /org/:id/dashboard`. |
| 2 | Workflow | 4.0 | -- | 4.0 | WF-024 PARTIAL (CRUD exists, SVG sanitization missing), WF-025 PARTIAL (assignment only, no handoff), WF-026 MISSING (no discipline handler), WF-027 MISSING (no dashboard), WF-028 PARTIAL (public handler naming unclear). |
| 3 | Domain Terms | 8.0 | -- | 8.0 | Correct terms throughout m04-scoped code. 2 grep hits in unrelated files (transcript/receipt). |
| 4 | State Machine | 3.0 | P0 cap | 3.0 | `TERM_VALID_TRANSITIONS` defined in `status-transitions.ts` but `updateOfficerTerm.ts` does NOT call `isValidTermTransition()`. No org lifecycle transitions defined. |
| 5 | Events | 1.0 | -- | 1.0 | Zero of 5 declared events emitted. Registry missing all m04 event types. Only `dues.payment.recorded` consumer wired. |
| 6 | Auth/Permission | 3.0 | P0 cap | 3.0 | Officer mutation handlers properly guarded with `requirePosition(PRESIDENT)`. But: `getOrganizationProfile` has no org-scoped access check; `updateOrganizationProfile` missing SVG sanitization (BR-31 / P0 security); spec allows super+admin but handler only allows President. |

**Average (raw):** 4.0 | **Capped by P0:** 3.0

---

## Endpoint Mapping (Dim 1)

| # | Spec Endpoint | Handler File | Status |
|---|--------------|--------------|--------|
| 1 | `GET /org/:id` | `getOrganizationProfile.ts` | FOUND -- session-only auth, no org-scoped check |
| 2 | `PUT /org/:id` | `updateOrganizationProfile.ts` | FOUND -- President-only, missing SVG sanitize |
| 3 | `GET /org/:slug/public` | `getPublicDirectoryProfile.ts` (probable) | UNVERIFIED -- path match unclear without route registration |
| 4 | `POST /org/:id/officers` | `createOfficerTerm.ts` | FOUND -- BR-09, BR-09e enforced |
| 5 | `DELETE /org/:id/officers/:termId` | `deleteOfficerTerm.ts` | FOUND -- President-only + session revocation |
| 6 | `POST /org/:id/officers/:termId/transition` | NONE | MISSING |
| 7 | `POST /org/:id/discipline` | NONE | MISSING |
| 8 | `GET /org/:id/dashboard` | NONE | MISSING |

**Additional m04-related handlers** (not in spec but present):
- `listOfficerTerms.ts`, `listOfficerTermsSummary.ts`, `getOfficerTerm.ts`, `updateOfficerTerm.ts`
- `createPosition.ts`, `listPositions.ts`, `getPosition.ts`, `updatePosition.ts`, `deletePosition.ts`
- `getMyOfficerRole.ts`

---

## Findings

### P0 (Blocker) -- caps score to 3.0

#### EM-M04-a1b2c3d4: Officer term status transitions not enforced in handler

- **Dimension:** 4 (State Machine)
- **Spec ref:** MODULE_SPEC section 8 -- Officer Term: `upcoming -> active`, `active -> completed|resigned|removed`
- **Code ref:** `services/api-ts/src/handlers/association:member/updateOfficerTerm.ts`
- **Evidence:** `TERM_VALID_TRANSITIONS` is correctly defined in `status-transitions.ts`:
  ```
  upcoming: ['active', 'removed']
  active: ['completed', 'resigned', 'removed']
  completed: []   // terminal
  resigned: []    // terminal
  removed: []     // terminal
  ```
  However, `updateOfficerTerm.ts` does NOT import or call `isValidTermTransition()`. The handler passes `body` directly to `repo.update(termId, body)` without validating the status transition. Confirmed: `grep -n 'isValidTermTransition\|TERM_VALID_TRANSITIONS' updateOfficerTerm.ts` returns zero matches.
- **Impact:** Any President can set any term status including impossible reverse transitions (`completed -> active`, `removed -> upcoming`). Data corruption of governance state.
- **Fix:** Add guard: `if (body.status && !isValidTermTransition(existing.status, body.status)) return ctx.json({ error: termTransitionError(existing.status, body.status) }, 422);`

#### EM-M04-e5f6g7h8: SVG/logo sanitization missing from updateOrganizationProfile (XSS)

- **Dimension:** 6 (Auth/Permission)
- **Spec ref:** MODULE_SPEC BR-31, M4-R5, AC-M04-007
- **Code ref:** `services/api-ts/src/handlers/association:member/updateOrganizationProfile.ts`
- **Evidence:** Handler does `db.update(organizations).set({ ...body })` with zero input sanitization. `grep -n 'sanitize\|svg\|SVG\|script\|strip' updateOrganizationProfile.ts` returns only the word "description" at line 43 (audit action). The `sanitizeSvg()` function exists only inside `ac-m04.org-admin.test.ts` as a test-local helper -- it is NOT exported or used by the handler.
- **Impact:** Stored XSS via malicious SVG content in `logoUrl` or other fields. Any org member viewing the profile renders attacker-controlled scripts.
- **Fix:** Extract `sanitizeSvg()` to shared utility, apply to `logoUrl` field before persistence.

---

### P1 (High) -- caps score to 6.0

#### EM-M04-i9j0k1l2: No discipline handler -- WF-026 unimplemented

- **Dimension:** 1 (Public API)
- **Spec ref:** API_CONTRACTS section 2.5: `POST /org/:id/discipline`
- **Code ref:** `ls handlers/association:member/*disciplin*` returns empty
- **Evidence:** The `DisciplinaryActionRepository` with `create`, `findById`, `findByOrg`, `findByPerson` methods exists in `governance.repo.ts`. The `disciplinaryActions` table exists in `governance.schema.ts` with `actionType` enum (`warning`, `suspension`, `removal`, `probation`), mandatory `reason` field, and immutability design (no update method). But NO handler wires these to an HTTP endpoint.
- **Impact:** WF-026 (Disciplinary Action) workflow entirely absent. Presidents cannot suspend/remove members via API.

#### EM-M04-m3n4o5p6: No officer transition handler -- WF-025 incomplete

- **Dimension:** 1 (Public API)
- **Spec ref:** API_CONTRACTS section 2.4: `POST /org/:id/officers/:termId/transition`
- **Code ref:** `ls handlers/association:member/*transition* *Transition*` returns empty (handler-level)
- **Evidence:** `TransitionChecklistRepository` exists with `create`, `findByTerm`, `findPendingByTerm`, `markCompleted` methods. Schema has `transition_checklist` table. But no handler orchestrates the full handoff workflow: mark outgoing term as completed, generate checklist, create incoming term, enforce reversal window.
- **Impact:** Officer transitions cannot be formally executed with handoff checklists.

#### EM-M04-q7r8s9t0: No org dashboard handler -- WF-027 unimplemented

- **Dimension:** 1 (Public API)
- **Spec ref:** API_CONTRACTS section 2.6: `GET /org/:id/dashboard`
- **Code ref:** `getDuesDashboard.ts` and `getDuesFinancialDashboard.ts` exist but serve m06 dues scope
- **Evidence:** No handler returns the org admin dashboard with member counts, officer summary, recent activities, and smart action cards as specified. The dues dashboards serve financial data only.
- **Impact:** WF-027 (Org Dashboard) workflow absent.

#### EM-M04-u1v2w3x4: ZERO domain events emitted -- all 5 missing

- **Dimension:** 5 (Events)
- **Spec ref:** MODULE_SPEC section 10b -- `OfficerAssigned`, `OfficerRemoved`, `OfficerTransitioned`, `MemberSuspended`, `MemberRemoved`
- **Code ref:** `core/domain-events.registry.ts`
- **Evidence:** Registry defines only: `dues.payment.recorded`, `membership.status.changed`, `invite.claimed`. None of the 5 m04 events exist. `grep -rn 'domainEvents\|emit(' handlers/association:member/ --include='*.ts'` returns zero matches in handler code. The `DomainEventBus.emit()` method works correctly -- it is simply never called.
- **Impact:** M07 (Communications), M12 (Elections), M05 (Membership) cannot react to officer changes or disciplinary actions. All cross-module integration broken for m04.

#### EM-M04-y5z6a7b8: getOrganizationProfile missing org-scoped access control

- **Dimension:** 6 (Auth/Permission)
- **Spec ref:** ROLE_PERMISSION_MATRIX section 3.2; MODULE_SPEC section 6
- **Code ref:** `services/api-ts/src/handlers/association:member/getOrganizationProfile.ts`
- **Evidence:** Handler checks `if (!session) throw new UnauthorizedError()` but performs no org membership or role check. Any authenticated user can read any org's internal profile by guessing/enumerating org IDs.
- **Impact:** Information disclosure of internal org data beyond public page scope.

---

### P2 (Medium)

#### EM-M04-c9d0e1f2: updateOrganizationProfile auth too restrictive vs spec

- **Dimension:** 6 (Auth/Permission)
- **Spec ref:** MODULE_SPEC section 6: "Edit org profile: super, admin, president (2FA)"
- **Code ref:** `updateOrganizationProfile.ts` line 20: `requirePosition(ctx, [POSITION_TITLES.PRESIDENT])`
- **Evidence:** Handler only allows President position. Spec also allows `super` and `admin` platform admin roles to edit org profiles. Platform admins managing multiple orgs cannot edit profiles without being officers.
- **Fix:** Add platform admin bypass check before `requirePosition`.

#### EM-M04-g3h4i5j6: Public page handler endpoint path unverified

- **Dimension:** 1 (Public API)
- **Spec ref:** API_CONTRACTS section 2.2: `GET /org/:slug/public`
- **Code ref:** `getPublicDirectoryProfile.ts`, `lookupCredentialPublic.ts`, `verifyCertificatePublic.ts`
- **Evidence:** Multiple "public" handlers exist but use credential/directory naming. Without reading generated route registration files, the actual path mapping cannot be confirmed.

#### EM-M04-k7l8m9n0: Organization lifecycle state machine not defined

- **Dimension:** 4 (State Machine)
- **Spec ref:** MODULE_SPEC section 8: "Organization Lifecycle: pending -> active -> suspended -> dissolved"
- **Code ref:** `status-transitions.ts`
- **Evidence:** File defines transitions for 6 domains (invoice, payment, membership, license, booking, officer term) but NOT organization lifecycle. No `ORG_VALID_TRANSITIONS` constant exists.

---

### P3 (Low)

#### EM-M04-o1p2q3r4: Incidental synonym matches in non-m04 files

- **Dimension:** 3 (Domain Terms)
- **Code ref:** `utils/transcript-template.ts`, `generatePaymentReceipt.ts`
- **Evidence:** `grep '\bhead\b\|\bmanager\b'` matched in 2 files unrelated to m04 governance (receipt/transcript generation). No m04-scoped code uses forbidden synonyms for spec domain terms.

---

### Unverifiable

#### EM-M04-s5t6u7v8: Route registration paths

- **Dimension:** 1 (Public API)
- **Reason:** Route registration is in generated OpenAPI files (`services/api-ts/src/generated/openapi/`) which CLAUDE.md forbids editing/reading. Cannot confirm actual HTTP paths match API_CONTRACTS.

---

## What Works Well

- **Governance schema** (`governance.schema.ts`): All 5 entities modeled correctly (Position, OfficerTerm, TransitionChecklist, DisciplinaryAction + Organization shared with M03). Enums match spec. Check constraints present (date ordering).
- **Governance repositories** (`governance.repo.ts`): Full CRUD for positions and officer terms. Transition checklist repo has `markCompleted`. Disciplinary action repo is correctly immutable (no update method).
- **BR-09 enforcement** in `createOfficerTerm.ts`: One-person-per-role and one-role-per-person guards implemented via `findActiveByPosition` and `findActiveByPersonInOrg`.
- **BR-09e enforcement**: President position assignment correctly requires platform admin verification.
- **Auth guards**: All officer mutation handlers (`create/update/deleteOfficerTerm`) use `requirePosition(ctx, [POSITION_TITLES.PRESIDENT])`.
- **Session revocation** (P1-4): `deleteOfficerTerm` and `updateOfficerTerm` revoke affected user sessions after role changes.
- **Audit trail**: All mutation handlers call `auditAction()` with structured details including previous state.
- **Test coverage**: `officer-admin.test.ts` has comprehensive tests for auth guards (president-only), BR-09e, audit trail, SVG defense-in-depth. `createOfficerTerm.test.ts` covers BR-09, BR-09e, status defaults, date handling.
- **Status transitions defined**: `TERM_VALID_TRANSITIONS` correctly models the spec state machine (just not enforced in handler).

---

## Stabilization Plan

### Wave 1: P0 fixes (blocks ship)

| # | Finding ID | Fix | Effort | Files |
|---|-----------|-----|--------|-------|
| 1 | EM-M04-a1b2c3d4 | Add `isValidTermTransition` guard to `updateOfficerTerm.ts` before `repo.update()` | S | `updateOfficerTerm.ts` |
| 2 | EM-M04-e5f6g7h8 | Extract `sanitizeSvg()` to utility, apply in `updateOrganizationProfile.ts` to `logoUrl` | S | `updateOrganizationProfile.ts`, new `utils/svg-sanitize.ts` |

### Wave 2: P1 fixes (blocks m04 completeness)

| # | Finding ID | Fix | Effort | Files |
|---|-----------|-----|--------|-------|
| 3 | EM-M04-i9j0k1l2 | Create `createDisciplinaryAction.ts`: President-only, mandatory reason, immutable record, side-effect on membership status | M | New handler, route registration, TypeSpec if needed |
| 4 | EM-M04-m3n4o5p6 | Create `transitionOfficerTerm.ts`: mark outgoing completed, generate checklist, create incoming term | M | New handler, route registration |
| 5 | EM-M04-q7r8s9t0 | Create `getOrgDashboard.ts`: aggregate member stats, officer summary, recent activities | M | New handler, route registration |
| 6 | EM-M04-u1v2w3x4 | Add 5 event types to `domain-events.registry.ts`, emit from `createOfficerTerm`, `deleteOfficerTerm`, future `transitionOfficerTerm`, future `createDisciplinaryAction` | M | `domain-events.registry.ts`, 4+ handler files |
| 7 | EM-M04-y5z6a7b8 | Add org membership check to `getOrganizationProfile.ts` | S | `getOrganizationProfile.ts` |

### Wave 3: P2 hardening

| # | Finding ID | Fix | Effort | Files |
|---|-----------|-----|--------|-------|
| 8 | EM-M04-c9d0e1f2 | Add platform admin bypass in `updateOrganizationProfile.ts` | S | `updateOrganizationProfile.ts` |
| 9 | EM-M04-g3h4i5j6 | Verify/create public page route at `GET /org/:slug/public` | S | Route files |
| 10 | EM-M04-k7l8m9n0 | Add `ORG_VALID_TRANSITIONS` to `status-transitions.ts` | S | `status-transitions.ts` |

**Effort key:** S = small (< 1hr), M = medium (1-4hr), L = large (4-8hr)

---

## Audit Scope

| Artifact | Path | Read? |
|----------|------|-------|
| MODULE_SPEC | `docs/product/modules/m04-org-admin/MODULE_SPEC.md` | Full |
| API_CONTRACTS | `docs/product/modules/m04-org-admin/API_CONTRACTS.md` | Full |
| DOMAIN_MODEL | `docs/product/DOMAIN_MODEL.md` | Sections 10-13 |
| WORKFLOW_MAP | `docs/product/WORKFLOW_MAP.md` | WF-024 through WF-028 |
| ROLE_PERMISSION_MATRIX | `docs/product/ROLE_PERMISSION_MATRIX.md` | Full |
| `getOrganizationProfile.ts` | Handler | Full |
| `updateOrganizationProfile.ts` | Handler | Full |
| `createOfficerTerm.ts` | Handler + test | Full |
| `createOfficerTerm.test.ts` | Test | Full |
| `deleteOfficerTerm.ts` | Handler | Full |
| `updateOfficerTerm.ts` | Handler + test | Full |
| `updateOfficerTerm.test.ts` | Test | Full |
| `listOfficerTerms.ts` | Handler | Full |
| `listOfficerTermsSummary.ts` | Handler | Full |
| `getOfficerTerm.ts` | Handler | Full |
| `getMyOfficerRole.ts` | Handler | Full |
| `createPosition.ts` | Handler | Full |
| `listPositions.ts` | Handler | Full |
| `getPosition.ts` | Handler | Full |
| `updatePosition.ts` | Handler | Full |
| `deletePosition.ts` | Handler | Full |
| `governance.schema.ts` | Schema | Full |
| `governance.repo.ts` | Repository | Full |
| `status-transitions.ts` | State machine | Full |
| `status-transitions.test.ts` | Tests | Full |
| `officer-check.ts` | Auth utility | Full |
| `domain-events.ts` | Event bus | Full |
| `domain-events.registry.ts` | Event types | Full |
| `domain-event-consumers.ts` | Consumers | Full |
| `ac-m04.org-admin.test.ts` | AC tests (7 ACs) | Full |
| `officer-admin.test.ts` | Handler tests | Full |

**Handler files in m04 scope:** 15 of ~157 total in `association:member/`. Remaining ~142 belong to m05/m06/m09/m10/m11/m12.
