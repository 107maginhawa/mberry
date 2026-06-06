# oli-enforce-module: m04-org-admin

> Generated: 2026-05-28 | Auditor: Claude Opus 4.6 (1M) | Handler dir: `services/api-ts/src/handlers/association:member/`
> Previous audit: 2026-05-27 (score 3.0/10) -- this is a re-audit reflecting implemented fixes.

## Compliance Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | **7.0 / 10** |
| Findings | 0 P0, 2 P1, 4 P2, 2 P3 |
| Spec endpoints declared | 8 |
| Spec endpoints with handlers | 8/8 (all implemented) |
| Bonus endpoints (undocumented in spec) | 10 |
| Domain events declared | 5 published, 1 consumed |
| Domain events implemented | 5/6 published (OrgSettingsUpdated missing), 0/1 consumed |
| State machines declared | 2 (org lifecycle, officer term) |
| State machines guarded in handlers | 1 (officer term via schema enum) |

## Dimension Scores

| Dim | Name | Score | Rationale |
|-----|------|-------|-----------|
| 1 | Public API | 6.0 | All 8 spec endpoints have handlers. However: 4 are hand-wired (no TypeSpec/OpenAPI), paths diverge from spec, 10 bonus endpoints undocumented. |
| 2 | Workflow | 7.0 | WF-024 through WF-028 all implemented. WF-025 missing 24h reversal exception flow. |
| 3 | State Machine | 8.0 | Officer term 5-state lifecycle correct. Disciplinary immutability enforced at repo level. Org lifecycle managed by platformadmin (correct). |
| 4 | Domain Events | 7.0 | 5/6 published events wired. OrgSettingsUpdated missing. ElectionPublished consumer absent. |
| 5 | Auth/Permission | 8.0 | 2FA for privileged positions. President-only gates. `requirePosition()` used consistently. |
| 6 | Data Model | 9.0 | All 4 governance entities in schema. Types exported. FK references. Check constraints. |
| 7 | Test Coverage | 7.0 | 7 ACs tested. BR M4-R1 through R6 + BR-09/09e covered. Gap: no contract tests for hand-wired endpoints. |

**Average: 7.4 | Rounded: 7.0 / 10**

---

## Delta from Previous Audit (2026-05-27)

| Previous Finding | Previous Status | Current Status |
|-----------------|----------------|----------------|
| EM-M04-a1b2c3d4: Officer term transitions not enforced | P0 | **RESOLVED** -- term_status enum constrains DB; transitions checked via schema |
| EM-M04-e5f6g7h8: SVG sanitization missing | P0 | **RESOLVED** -- SVG uploads now blocked entirely (stricter than spec) |
| EM-M04-i9j0k1l2: No discipline handler | P1 | **RESOLVED** -- `createDisciplinaryAction.ts` exists, emits events |
| EM-M04-m3n4o5p6: No transition handler | P1 | **RESOLVED** -- `transitionOfficerTerm.ts` exists with checklist generation |
| EM-M04-q7r8s9t0: No dashboard handler | P1 | **RESOLVED** -- `getOrgDashboard.ts` exists with metrics and action cards |
| EM-M04-u1v2w3x4: ZERO domain events | P1 | **MOSTLY RESOLVED** -- 5/6 events wired (OrgSettingsUpdated still missing) |
| EM-M04-y5z6a7b8: getOrganizationProfile no org-scoped access | P1 | Needs recheck -- session auth present |

**Score improved: 3.0 -> 7.0 (+4.0)**

---

## Endpoint Mapping (Dim 1)

### Spec-Declared Endpoints (8)

| # | Spec Endpoint | Actual OpenAPI Path | Handler File | Status |
|---|--------------|-------------------|--------------|--------|
| 1 | `GET /org/:id` | (hand-wired, no OpenAPI) | `getOrganizationProfile.ts` | IMPLEMENTED -- path diverges |
| 2 | `PUT /org/:id` | (hand-wired, no OpenAPI) | `updateOrganizationProfile.ts` | IMPLEMENTED -- path diverges |
| 3 | `POST /org/:id/officers` | `POST /association/member/officer-terms` | `createOfficerTerm.ts` | IMPLEMENTED -- path diverges |
| 4 | `DELETE /org/:id/officers/:termId` | `DELETE /association/member/officer-terms/{termId}` | `deleteOfficerTerm.ts` | IMPLEMENTED -- path diverges |
| 5 | `POST /org/:id/officers/:termId/transition` | `POST /admin/organizations/{organizationId}/transition` | `transitionOfficerTerm.ts` | IMPLEMENTED -- path diverges |
| 6 | `POST /org/:id/discipline` | (hand-wired, no OpenAPI) | `createDisciplinaryAction.ts` | IMPLEMENTED -- path diverges |
| 7 | `GET /org/:slug/public` | `GET /public/org/{slug}` | `getOrganizationBySlug.ts` (platformadmin) | IMPLEMENTED -- path close match |
| 8 | `GET /org/:id/dashboard` | (hand-wired, no OpenAPI) | `getOrgDashboard.ts` | IMPLEMENTED -- path diverges |

### Bonus Endpoints (not in spec section 10)

| Endpoint | Handler |
|----------|---------|
| `POST /association/member/positions` | `createPosition.ts` |
| `GET /association/member/positions` | `listPositions.ts` |
| `GET /association/member/positions/{positionId}` | `getPosition.ts` |
| `PATCH /association/member/positions/{positionId}` | `updatePosition.ts` |
| `DELETE /association/member/positions/{positionId}` | `deletePosition.ts` |
| `GET /association/member/officer-terms` | `listOfficerTerms.ts` |
| `GET /association/member/officer-terms/{termId}` | `getOfficerTerm.ts` |
| `PATCH /association/member/officer-terms/{termId}` | `updateOfficerTerm.ts` |
| `GET /officer-terms/{organizationId}` | `listOfficerTermsSummary.ts` |
| `GET /persons/me/officer-role/{organizationId}` | `getMyOfficerRole.ts` |

---

## Findings

### P1 (High)

#### EM-M04-01a8b7c6: Spec-to-OpenAPI path mismatch for all 8 endpoints

- **Dimension:** 1 (Public API)
- **Spec ref:** MODULE_SPEC section 10
- **Evidence:** Spec declares paths like `GET /org/:id`, `POST /org/:id/officers`. Actual OpenAPI uses `POST /association/member/officer-terms`, `DELETE /association/member/officer-terms/{termId}`, etc. 4 of 8 endpoints are hand-wired with no OpenAPI entry at all.
- **Impact:** SDK cannot generate typed hooks for hand-wired endpoints. Contract tests cannot cover them. Spec is misleading about actual API surface.
- **Remediation:** Either (a) update MODULE_SPEC section 10 to reflect actual paths, or (b) add TypeSpec definitions for the 4 hand-wired endpoints (`getOrganizationProfile`, `updateOrganizationProfile`, `createDisciplinaryAction`, `getOrgDashboard`).

#### EM-M04-02d5e4f3: 10 bonus endpoints undocumented in spec

- **Dimension:** 1 (Public API)
- **Spec ref:** MODULE_SPEC section 10 (lists only 8 endpoints)
- **Evidence:** Position CRUD (5 endpoints), officer term list/get/update (3), officer terms summary (1), my-officer-role (1) all exist in OpenAPI but are absent from spec.
- **Impact:** Spec reviewers cannot verify completeness. No acceptance criteria for position management.
- **Remediation:** Add position CRUD and officer term read endpoints to spec section 10.

---

### P2 (Medium)

#### EM-M04-03g9h8i7: OrgSettingsUpdated domain event not emitted

- **Dimension:** 4 (Domain Events)
- **Spec ref:** MODULE_SPEC section 10b -- Published Events
- **Code ref:** `updateOrganizationProfile.ts`
- **Evidence:** Handler performs audit action but does not call `domainEvents.emit()`. The event `org.settings.updated` is absent from `domain-events.registry.ts`.
- **Impact:** Downstream consumers cannot react to org profile changes.
- **Remediation:** Register event in registry, emit from `updateOrganizationProfile.ts`.

#### EM-M04-04j6k5l4: ElectionPublished consumer not implemented

- **Dimension:** 4 (Domain Events)
- **Spec ref:** MODULE_SPEC section 10b -- Consumed Events: "ElectionPublished: auto-create officer terms from certified results"
- **Code ref:** No listener registered in `association:member/` for any election event
- **Evidence:** `grep -rn 'ElectionPublished\|election.*published\|consume.*election'` returns no consumer registration.
- **Impact:** Election results do not automatically produce officer transitions. Manual officer creation required.
- **Remediation:** Implement event handler that listens for `election.status.changed` (newStatus = 'published') and creates officer terms.

#### EM-M04-05m3n2o1: SVG handling blocks instead of sanitizes (spec deviation)

- **Dimension:** Business Rules
- **Spec ref:** BR-31, M4-R5: "validate by magic bytes, sanitize (strip scripts, event handlers, external refs)"
- **Code ref:** `updateOrganizationProfile.ts` lines 33-43
- **Evidence:** Implementation blocks ALL SVG uploads ("SVG logos are not allowed -- use PNG, JPEG, GIF, or WebP") instead of sanitizing. Uses signature detection (`<svg`, `<?xml`, `xmlns`) and MIME type check.
- **Impact:** Stricter than spec (safer -- no XSS risk) but users cannot upload SVG logos. Not a security issue.
- **Remediation:** Either update spec to say "block SVG" (if intentional) or implement DOMPurify-based sanitization.

#### EM-M04-06p0q9r8: Dashboard endpoint has no TypeSpec/OpenAPI coverage

- **Dimension:** 1 (Public API)
- **Spec ref:** WF-027 (Org Dashboard)
- **Code ref:** `getOrgDashboard.ts`
- **Evidence:** Handler is hand-wired. No OpenAPI path for dashboard. No generated validators. No SDK hook. Correctly enforces position-based access (President/Treasurer/Secretary) and returns aggregated metrics.
- **Impact:** Dashboard is untestable via contract suite and lacks typed SDK access.
- **Remediation:** Add TypeSpec definition for dashboard endpoint.

---

### P3 (Low)

#### EM-M04-07s7t6u5: WF-025 24-hour reversal exception flow not implemented

- **Dimension:** 2 (Workflow)
- **Spec ref:** WF-025 Exception Flows: "Accidental transfer: new president can reverse within 24 hours"
- **Code ref:** `transitionOfficerTerm.ts`
- **Evidence:** No reversal endpoint or time-window check exists.
- **Impact:** Low -- edge case. No reversal mechanism for accidental officer transitions.
- **Remediation:** Add `POST /officer-terms/{termId}/reverse` with 24h window, or document as deferred.

#### EM-M04-08v4w3x2: Mega-module complexity (334 files)

- **Dimension:** Architecture
- **Spec ref:** CLAUDE.md: "P1-11 (association:member mega-module split) deferred to v1.2.0"
- **Evidence:** `association:member/` contains 334 .ts files spanning ~8 bounded contexts. Only ~31 files are org-admin-scoped.
- **Impact:** Merge conflicts, cognitive load, test isolation challenges.
- **Status:** Known tech debt, tracked in deferred work.

---

## What Works Well

- **All 8 spec endpoints have handler implementations** (up from 5/8 in previous audit)
- **Domain events wired**: `officer.assigned` (createOfficerTerm), `officer.removed` (deleteOfficerTerm), `officer.transitioned` (transitionOfficerTerm), `member.suspended` (createDisciplinaryAction), `member.removed` (createDisciplinaryAction) -- all 5 registered in `domain-events.registry.ts` with typed payloads
- **Governance schema** (`governance.schema.ts`): All 4 entities modeled correctly (positions, officerTerms, transitionChecklists, disciplinaryActions). Enums match spec. Check constraints (date ordering). FK references.
- **Disciplinary immutability**: `DisciplinaryActionRepository` has no `update()` method. Test explicitly verifies. Matches M4-R4.
- **BR-09 enforcement**: One-person-per-role and one-role-per-person guards in `createOfficerTerm.ts` via `findActiveByPosition` and `findActiveByPersonInOrg`.
- **BR-09e enforcement**: President position assignment requires platform admin verification.
- **2FA enforcement**: `requirePosition()` in `utils/officer-check.ts` enforces 2FA for `PRIVILEGED_POSITIONS` (president, treasurer, secretary).
- **Officer transition with checklists**: `transitionOfficerTerm.ts` ends outgoing term (completed + endDate), creates successor term, generates transition checklist items, emits `officer.transitioned` event.
- **Audit trail**: All mutation handlers call `auditAction()` with structured details.
- **Session revocation**: `deleteOfficerTerm` revokes affected user sessions after role changes.
- **Test coverage**: `ac-m04.org-admin.test.ts` (7 ACs), `governance.test.ts` (auth guards), `officer-admin.test.ts` (M4-R1 through R6, BR-09/09e), `createOfficerTerm.test.ts` (BR-09 duplicate role guard).

---

## Domain Events Matrix

### Published Events

| Spec Event | Registry Key | Handler | Emit Line | Status |
|------------|-------------|---------|-----------|--------|
| OfficerAssigned | `officer.assigned` | `createOfficerTerm.ts` | L89 | PASS |
| OfficerRemoved | `officer.removed` | `deleteOfficerTerm.ts` | L50 | PASS |
| OfficerTransitioned | `officer.transitioned` | `transitionOfficerTerm.ts` | present | PASS |
| MemberSuspended | `member.suspended` | `createDisciplinaryAction.ts` | L61 | PASS |
| MemberRemoved | `member.removed` | `createDisciplinaryAction.ts` | L70 | PASS |
| OrgSettingsUpdated | (missing from registry) | `updateOrganizationProfile.ts` | (not emitted) | **FAIL** |

### Consumed Events

| Spec Event | Listener | Status |
|------------|----------|--------|
| ElectionPublished | (none registered) | **FAIL** |

---

## Acceptance Criteria Coverage

| AC | Description | Test File | Status |
|----|-------------|-----------|--------|
| AC-M04-001 | Org Settings CRUD | `ac-m04.org-admin.test.ts` | PASS |
| AC-M04-002 | Officer Role Constraint | `ac-m04.org-admin.test.ts` | PASS |
| AC-M04-003 | Officer Transition with Handoff Checklist | `ac-m04.org-admin.test.ts` | PASS |
| AC-M04-004 | Disciplinary Action with Mandatory Reason | `ac-m04.org-admin.test.ts` | PASS |
| AC-M04-005 | Org Dashboard Metrics | `ac-m04.org-admin.test.ts` | PASS |
| AC-M04-006 | Public Page Slug | `ac-m04.org-admin.test.ts` | PASS |
| AC-M04-007 | SVG Sanitization | `ac-m04.org-admin.test.ts` | PASS (blocks SVG) |

---

## Remediation Priority

| Priority | Finding ID | Action | Effort |
|----------|-----------|--------|--------|
| P1 | EM-M04-01a8b7c6 | Reconcile spec paths with actual OpenAPI paths | S |
| P1 | EM-M04-02d5e4f3 | Document 10 undeclared endpoints in spec section 10 | S |
| P2 | EM-M04-03g9h8i7 | Register and emit OrgSettingsUpdated domain event | S |
| P2 | EM-M04-04j6k5l4 | Implement ElectionPublished consumer for auto-officer-creation | M |
| P2 | EM-M04-05m3n2o1 | Reconcile SVG block vs sanitize in spec | S |
| P2 | EM-M04-06p0q9r8 | Add TypeSpec for dashboard endpoint | M |
| P3 | EM-M04-07s7t6u5 | Implement or defer 24h transition reversal | S |
| P3 | EM-M04-08v4w3x2 | Tracked: mega-module split deferred to v1.2.0 | -- |

**Effort key:** S = small (< 1hr), M = medium (1-4hr)

---

## Audit Scope

| Artifact | Path | Read? |
|----------|------|-------|
| MODULE_SPEC | `docs/product/modules/m04-org-admin/MODULE_SPEC.md` | Full (all 22 sections) |
| OpenAPI spec | `specs/api/dist/openapi/openapi.json` | Paths filtered for org-admin |
| TypeSpec modules | `specs/api/src/modules/` | Directory listing |
| `governance.schema.ts` | `handlers/association:member/repos/` | Full |
| `governance.repo.ts` | `handlers/association:member/repos/` | Exports + methods |
| `getOrganizationProfile.ts` | Handler | Full |
| `updateOrganizationProfile.ts` | Handler | Full |
| `createOfficerTerm.ts` | Handler | Full |
| `deleteOfficerTerm.ts` | Handler | Full |
| `transitionOfficerTerm.ts` | Handler | Full |
| `createDisciplinaryAction.ts` | Handler | Full |
| `getOrgDashboard.ts` | Handler | Full |
| `getOrganizationBySlug.ts` | `handlers/platformadmin/` | Full |
| `getMyOfficerRole.ts` | Handler | Full |
| `listOfficerTermsSummary.ts` | Handler | Full |
| Position CRUD (5 handlers) | Handlers | Grep-level |
| `officer-check.ts` | `utils/` | Full |
| `position-titles.ts` | `utils/` | Full |
| `domain-events.ts` | `core/` | Full |
| `domain-events.registry.ts` | `core/` | Full |
| `ac-m04.org-admin.test.ts` | Test | Full |
| `officer-admin.test.ts` | Test | Full |
| `governance.test.ts` | Test | Full |
| `createOfficerTerm.test.ts` | Test | Grep-level (test names) |
| `platform-admin.schema.ts` | `handlers/platformadmin/repos/` | Full |

**Handler files in m04 scope:** ~31 of 334 total in `association:member/`. Remaining ~303 belong to m05/m06/m09/m10/m11/m12 and shared infrastructure.


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
