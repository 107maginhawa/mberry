<!-- oli-version: 1.1 -->
<!-- based-on: docs/product/modules/m03-platform-admin/MODULE_SPEC.md -->
<!-- generated: 2026-05-27T07:30:00Z -->

# Module Enforcement Report: m03-platform-admin

**Generated:** 2026-05-27T07:30:00Z
**Module:** m03-platform-admin
**Source Directory:** services/api-ts/src/handlers/platformadmin/
**Spec:** docs/product/modules/m03-platform-admin/MODULE_SPEC.md

---

## Compliance Summary
| | |
|-|-|
| **Overall Score** | 6.0/10 |
| **Compliance Label** | PARTIAL |
| **Total Findings** | 19 (1 P0, 6 P1, 8 P2, 4 P3) |
| **Dimensions Evaluated** | 6/6 |
| **Blocking Issues** | 7 |

---

## Dimension Scores
| Dimension | Score | P0 | P1 | P2 | P3 | Status |
|-----------|-------|----|----|----|-----|--------|
| Public API Completeness | 8/10 | 0 | 2 | 1 | 0 | MOSTLY |
| Workflow Implementation | 5/10 | 0 | 1 | 2 | 0 | PARTIAL |
| Domain Term Consistency | 7/10 | 0 | 0 | 2 | 2 | MOSTLY |
| State Machine Enforcement | 6/10 | 0 | 1 | 2 | 1 | PARTIAL |
| Event Publishing | 3/10 | 0 | 2 | 1 | 1 | CRITICAL |
| Auth/Permission Enforcement | 5/10 | 1 | 0 | 0 | 0 | PARTIAL |

---

## Findings

### P0 -- Critical (Fix Immediately)

| ID | Dimension | Finding | File | Confidence | Recommendation |
|----|-----------|---------|------|------------|----------------|
| EM-M03-f1g2h3i4 | Auth/Permission | Handler-level role guards missing for super-only endpoints. `inviteAdmin`, `revokeAdmin`, `updateAdmin`, `deleteAssociation`, and `startImpersonation` do NOT verify the caller's admin role level. They check `session` but rely solely on `platformAdminAuthMiddleware` which permits ANY platform admin (super/admin/support). Spec and ROLE_PERMISSION_MATRIX require super-only for: admin team CRUD, delete association, impersonation. Any `support` or `admin`-level PA can currently perform super-only actions. | inviteAdmin.ts, revokeAdmin.ts, updateAdmin.ts, deleteAssociation.ts, startImpersonation.ts | HIGH | Add `const admin = ctx.get('platformAdmin'); if (admin.role !== 'super') throw new ForbiddenError(...)` to each super-only handler. |

### P1 -- Major (Fix Before New Work)

| ID | Dimension | Finding | File | Confidence | Recommendation |
|----|-----------|---------|------|------------|----------------|
| EM-M03-a1b2c3d4 | Public API | `GET /admin/analytics/revenue` and `GET /admin/analytics/health` endpoints declared in spec (section 10, API_CONTRACTS 2.6) but no handlers exist. Only `getNationalDashboard.ts` and `exportDashboardReport.ts` exist for dashboard-related functions, but neither provides MRR/ARR/churn or org health scores. | N/A (missing) | HIGH | Implement `getRevenueAnalytics.ts` (MRR, ARR, churn, growth) and `getOrgHealthScores.ts`. |
| EM-M03-a1b2c3d5 | Public API | `PUT /admin/pricing` endpoint declared in spec (API_CONTRACTS 2.7) but no handler, route, or pricing entity exists. M3-R8 (pricing changes apply to new subs only) has no implementation. | N/A (missing) | HIGH | Implement pricing handler with M3-R8 guard. Requires Subscription entity first. |
| EM-M03-c9d0e1f2 | Workflow | WF-017 (Manage Subscriptions: trial-to-paid, payment management) and WF-020 (Support Ticket Resolution: ticket inbox, SLA tracking, auto-escalation) are completely unimplemented. No Subscription entity in schema, no support ticket entity. These are declared workflows in WORKFLOW_MAP.md for M03. | N/A (missing) | HIGH | Implement Subscription entity + lifecycle (WF-017). WF-020 may be deferred but should be tracked explicitly. |
| EM-M03-d3e4f5a6 | State Machine | Spec org lifecycle declares `trial -> cancelled` (trial expired, no conversion) as valid. Code's `VALID_TRANSITIONS` for `trial` only allows `['active']`. Missing transition path. | transitionOrgStatus.ts:9 | HIGH | Add `'cancelled'` to `VALID_TRANSITIONS.trial` array. |
| EM-M03-e1f2g3h4 | Event Publishing | `OrgStatusTransitioned` domain event not emitted. `transitionOrgStatus.ts` logs to audit via `auditAction()` but does NOT call any event bus. Spec declares M04, M05, M07 as consumers. This blocks cross-module reactivity. | transitionOrgStatus.ts | HIGH | Implement `domainEvents.emit('OrgStatusTransitioned', { orgId, oldStatus, newStatus })` after successful transition. |
| EM-M03-e1f2g3h5 | Event Publishing | `AssociationCreated`, `OrganizationCreated`, `FeatureFlagChanged` domain events not emitted. All three creation/toggle handlers use `auditAction()` only. Spec declares these events with specific consumers (M01, M04, All modules). Zero of 7 spec-declared events are published via event bus. | createAssociation.ts, createOrganization.ts, setFeatureFlag.ts | HIGH | Add event publishing to all three handlers. `auditAction` is audit logging, not domain event publishing. |

### P2 -- Medium (Fix When Touching)

| ID | Dimension | Finding | File | Confidence | Recommendation |
|----|-----------|---------|------|------------|----------------|
| EM-M03-a1b2c3d6 | Public API | Route path drift: spec uses `PUT /admin/orgs/:id/status`; generated routes use `POST /admin/organizations/:organizationId/transition`. Functionally equivalent but shapes diverge from spec. | transitionOrgStatus.ts | MEDIUM | Align TypeSpec definition with API_CONTRACTS route shape, or update API_CONTRACTS to match generated routes. |
| EM-M03-11223344 | Workflow | WF-018 (Feature Flag Management): Spec requires M01 (Auth) always-on block -- disabling M01 should be blocked. `setFeatureFlag.ts` has zero guard for this. Any module including auth can be toggled off. | setFeatureFlag.ts | HIGH | Add guard: `if (body.moduleName === 'authentication' && !body.enabled) throw new BusinessLogicError('Cannot disable authentication module')`. |
| EM-M03-55667788 | Workflow | WF-022 (Admin Team Management): `inviteAdmin.ts` creates admin DB record directly but does not send email invitation. Spec step 2 says "Invite new admin: email, role" implying email delivery. | inviteAdmin.ts | MEDIUM | Wire email trigger after admin creation (via email queue or domain event consumer). |
| EM-M03-99aabb00 | Domain Term | `admin_role` enum inconsistency: DOMAIN_MODEL.md says `super`, `support`, `analyst`. Schema code defines `super`, `support`, `admin`. MODULE_SPEC section 6 says `super`, `admin`, `support`. Code and spec agree on `admin`, DOMAIN_MODEL is stale with `analyst`. | repos/platform-admin.schema.ts:39, DOMAIN_MODEL.md | HIGH | Update DOMAIN_MODEL.md to match code/spec: `super`, `admin`, `support`. |
| EM-M03-ccddee11 | Domain Term | Subscription entity declared in spec (section 7: id, orgId, plan, status, stripeSubscriptionId, currentPeriodStart, currentPeriodEnd) is not implemented anywhere in schema or code. | N/A (missing) | HIGH | Implement when tackling WF-017. |
| EM-M03-ccddee22 | State Machine | `deleteAssociation.ts` does NOT check for active organizations before deletion. Spec and API_CONTRACTS say DELETE returns 409 if association has active orgs. Current code deletes unconditionally after finding the record. | deleteAssociation.ts:30 | HIGH | Add guard: query org count, throw ConflictError('Association has active organizations') if > 0. |
| EM-M03-d1e2f3h1 | State Machine | Subscription lifecycle state machine (trial -> active -> past_due -> cancelled) declared in spec section 8 has no implementation at all. No Subscription table, no status tracking, no transition guards. | N/A (missing) | HIGH | Implement with WF-017 subscription management. |
| EM-M03-e1f2g3h7 | Event Publishing | `ImpersonationStarted` / `ImpersonationEnded` events: handlers log to audit with correct `eventSubType` tags and `startImpersonation` correctly writes to `impersonation_sessions` table, but neither handler emits via domain event bus. `AdminInvited` event also not emitted. | startImpersonation.ts, endImpersonation.ts, inviteAdmin.ts | MEDIUM | Add event publishing after audit logging for all three. |

### P3 -- Advisory (Track)

| ID | Dimension | Finding | File | Confidence | Recommendation |
|----|-----------|---------|------|------------|----------------|
| EM-M03-aabb0011 | Domain Term | `exportDashboardReport.ts:55` and `getNationalDashboard.ts:87` reference `user?.role === 'platform_admin'` which is not a valid `admin_role` enum value. Should check via `ctx.get('platformAdmin')`. | exportDashboardReport.ts, getNationalDashboard.ts | MEDIUM | Replace with `ctx.get('platformAdmin')` check. |
| EM-M03-ccdd2233 | Domain Term | Impersonation middleware uses `MAX_IMPERSONATION_DURATION_MS = 2 * 60 * 60 * 1000` (2 hours), but spec M3-R3 says "IF impersonation session > 30 min THEN auto-terminate". Significant discrepancy (4x). | middleware/impersonation-guard.ts:21 | HIGH | Reduce to 30 minutes per spec, or update spec if 2 hours is intentional. |
| EM-M03-d1e2f3g5 | State Machine | Code adds `cancelled -> active` transition not in original spec state machine. Spec allows reactivation only from `suspended -> active`. Code allows cancelled-to-active within 90 days. The 90-day guard is well-implemented but the transition itself is undeclared. | transitionOrgStatus.ts | MEDIUM | Either add `cancelled -> active` to spec state machine (with 90-day window note) or remove from code. |
| EM-M03-eeff4455 | Event Publishing | `endImpersonation.ts` response does not include `pagesVisited` field as specified in API_CONTRACTS.md. Returns raw repo record instead of `{ ended: true, duration, pagesVisited }`. | endImpersonation.ts | MEDIUM | Shape response to match API contract. |

### Unverifiable (Manual Review Required)

| ID | Dimension | Finding | Confidence | Why Unverifiable |
|----|-----------|---------|------------|------------------|
| EM-M03-mfa00001 | Auth/Permission | M3-R7: MFA mandatory for all platform admins. Cannot verify from handler code whether Better-Auth enforces MFA at login for PA users. | LOW | Requires inspection of Better-Auth configuration and login flow middleware. |
| EM-M03-mfa00002 | Workflow | WF-022 step 2: Inviting new admin should send email. `inviteAdmin.ts` creates DB record only. Cannot determine if a domain event consumer or background job handles email dispatch. | LOW | Requires inspection of event consumers and job queue for admin invite email trigger. |

---

## Stabilization Plan

### Fix Now (P0)
1. **EM-M03-f1g2h3i4** -- Add per-handler role guards for super-only endpoints. Without this, any platform admin can perform privileged actions (invite/remove admins, delete associations, start impersonation).

### Fix Before New Work (P1)
1. **EM-M03-f7a8b9c0** / **EM-M03-e1f2g3h4** / **EM-M03-e1f2g3h5** -- Implement domain event publishing infrastructure and emit all 7 spec-declared events. This is the single largest compliance gap.
2. **EM-M03-a1b2c3d4** -- Implement revenue analytics and health score endpoints.
3. **EM-M03-a1b2c3d5** -- Implement pricing management handler.
4. **EM-M03-c9d0e1f2** -- Implement subscription lifecycle (WF-017). Defer WF-020 (support tickets) with explicit tracking.
5. **EM-M03-d3e4f5a6** -- Add `cancelled` to `VALID_TRANSITIONS.trial`.

### Fix When Touching (P2)
1. **EM-M03-11223344** -- Add M01 always-on guard in `setFeatureFlag.ts`.
2. **EM-M03-ccddee22** -- Add active-org check before association deletion.
3. **EM-M03-99aabb00** -- Reconcile `admin_role` enum in DOMAIN_MODEL.md (change `analyst` to `admin`).
4. **EM-M03-a1b2c3d6** -- Align transition route path with spec.
5. **EM-M03-55667788** -- Wire email delivery for admin invitations.
6. **EM-M03-ccddee11** / **EM-M03-d1e2f3h1** -- Implement Subscription entity and state machine with WF-017.
7. **EM-M03-e1f2g3h7** -- Add event publishing for impersonation and admin invite events.

### Track (P3)
1. **EM-M03-aabb0011** -- Fix `platform_admin` role string references in dashboard handlers.
2. **EM-M03-ccdd2233** -- Reconcile impersonation timeout (2h code vs 30min spec).
3. **EM-M03-d1e2f3g5** -- Reconcile `cancelled -> active` transition with spec.
4. **EM-M03-eeff4455** -- Shape endImpersonation response per API contract.

---

## Audit Scope
| Artifact | Available | Used |
|----------|-----------|------|
| MODULE_SPEC.md | YES | YES |
| API_CONTRACTS.md | YES | YES |
| DOMAIN_MODEL.md | YES | YES |
| WORKFLOW_MAP.md | YES | YES |
| ROLE_PERMISSION_MATRIX.md | YES | YES |
