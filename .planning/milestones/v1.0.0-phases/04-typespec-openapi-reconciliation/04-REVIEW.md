---
phase: 04-typespec-openapi-reconciliation
reviewed: 2026-05-06T00:00:00Z
depth: quick
files_reviewed: 99
files_reviewed_list:
  - specs/api/src/association/member/certificates.tsp
  - specs/api/src/association/member/dues.tsp
  - specs/api/src/association/member/membership.tsp
  - specs/api/src/association/operations/events.tsp
  - specs/api/src/association/operations/training.tsp
  - specs/api/src/main.tsp
  - services/api-ts/src/app.ts
  - services/api-ts/src/generated/openapi/routes.ts
  - services/api-ts/src/generated/openapi/validators.ts
  - services/api-ts/src/generated/openapi/registry.ts
  - services/api-ts/src/handlers/association:member/addRosterMember.ts
  - services/api-ts/src/handlers/association:member/castBallot.ts
  - services/api-ts/src/handlers/association:member/certifyElection.ts
  - services/api-ts/src/handlers/association:member/createCandidate.ts
  - services/api-ts/src/handlers/association:member/createElection.ts
  - services/api-ts/src/handlers/association:member/deleteCandidate.ts
  - services/api-ts/src/handlers/association:member/deleteElection.ts
  - services/api-ts/src/handlers/association:member/disconnectDuesGateway.ts
  - services/api-ts/src/handlers/association:member/generateDuesReport.ts
  - services/api-ts/src/handlers/association:member/getCandidate.ts
  - services/api-ts/src/handlers/association:member/getCertificate.ts
  - services/api-ts/src/handlers/association:member/getDuesFinancialDashboard.ts
  - services/api-ts/src/handlers/association:member/getDuesGatewayConfig.ts
  - services/api-ts/src/handlers/association:member/getDuesPayment.ts
  - services/api-ts/src/handlers/association:member/getElection.ts
  - services/api-ts/src/handlers/association:member/getOrganizationProfile.ts
  - services/api-ts/src/handlers/association:member/getRosterMember.ts
  - services/api-ts/src/handlers/association:member/importRosterMembers.ts
  - services/api-ts/src/handlers/association:member/listBallots.ts
  - services/api-ts/src/handlers/association:member/listCandidates.ts
  - services/api-ts/src/handlers/association:member/listDuesFunds.ts
  - services/api-ts/src/handlers/association:member/listDuesPayments.ts
  - services/api-ts/src/handlers/association:member/listElections.ts
  - services/api-ts/src/handlers/association:member/listMyCertificates.ts
  - services/api-ts/src/handlers/association:member/listRosterMembers.ts
  - services/api-ts/src/handlers/association:member/openElectionNominations.ts
  - services/api-ts/src/handlers/association:member/openElectionVoting.ts
  - services/api-ts/src/handlers/association:member/recordDuesPayment.ts
  - services/api-ts/src/handlers/association:member/refundDuesPayment.ts
  - services/api-ts/src/handlers/association:member/testDuesGatewayConnection.ts
  - services/api-ts/src/handlers/association:member/updateCandidate.ts
  - services/api-ts/src/handlers/association:member/updateElection.ts
  - services/api-ts/src/handlers/association:member/updateOrganizationProfile.ts
  - services/api-ts/src/handlers/association:member/updateRosterMember.ts
  - services/api-ts/src/handlers/association:member/upsertDuesFunds.ts
  - services/api-ts/src/handlers/association:member/upsertDuesGatewayConfig.ts
  - services/api-ts/src/handlers/association:member/upsertMembershipCategory.ts
  - services/api-ts/src/handlers/association:operations/cancelCustomTraining.ts
  - services/api-ts/src/handlers/association:operations/checkInCustomEvent.ts
  - services/api-ts/src/handlers/association:operations/checkInCustomTraining.ts
  - services/api-ts/src/handlers/association:operations/completeCustomTraining.ts
  - services/api-ts/src/handlers/association:operations/enrollInCustomTraining.ts
  - services/api-ts/src/handlers/association:operations/listCustomEventAttendance.ts
  - services/api-ts/src/handlers/association:operations/listCustomEventRegistrations.ts
  - services/api-ts/src/handlers/association:operations/listCustomTrainingEnrollments.ts
  - services/api-ts/src/handlers/association:operations/listMyCustomEvents.ts
  - services/api-ts/src/handlers/association:operations/listMyCustomTrainings.ts
  - services/api-ts/src/handlers/association:operations/registerForCustomEvent.ts
  - packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts
  - packages/sdk-ts/src/generated/index.ts
  - packages/sdk-ts/src/generated/sdk.gen.ts
  - packages/sdk-ts/src/generated/types.gen.ts
  - apps/memberry/src/features/certificates/components/certificate-list.tsx
  - apps/memberry/src/features/certificates/components/certificate-preview.tsx
  - apps/memberry/src/features/dues/components/dues-config-form.tsx
  - apps/memberry/src/features/dues/components/financial-dashboard.tsx
  - apps/memberry/src/features/dues/components/gateway-setup.tsx
  - apps/memberry/src/features/dues/components/payment-history-table.tsx
  - apps/memberry/src/features/dues/components/record-payment-form.tsx
  - apps/memberry/src/features/dues/components/refund-form.tsx
  - apps/memberry/src/features/elections/components/election-detail.tsx
  - apps/memberry/src/features/elections/components/election-form.tsx
  - apps/memberry/src/features/elections/components/election-list.tsx
  - apps/memberry/src/features/events/components/attendance-view.tsx
  - apps/memberry/src/features/events/components/event-form.tsx
  - apps/memberry/src/features/events/components/event-list.tsx
  - apps/memberry/src/features/membership/components/application-list.tsx
  - apps/memberry/src/features/membership/components/category-editor.tsx
  - apps/memberry/src/features/membership/components/member-detail.tsx
  - apps/memberry/src/features/membership/components/member-table.tsx
  - apps/memberry/src/features/training/components/completion-table.tsx
  - apps/memberry/src/features/training/components/training-list.tsx
  - apps/memberry/src/routes/_authenticated/dashboard.tsx
  - apps/memberry/src/routes/_authenticated/my/events.tsx
  - apps/memberry/src/routes/_authenticated/my/training.tsx
  - apps/memberry/src/routes/_authenticated/org/$orgId/events/$eventId.tsx
  - apps/memberry/src/routes/_authenticated/org/$orgId/home.tsx
  - apps/memberry/src/routes/_authenticated/org/$orgId/officer/events/$eventId.tsx
  - apps/memberry/src/routes/_authenticated/org/$orgId/officer/events/$eventId/attendance.tsx
  - apps/memberry/src/routes/_authenticated/org/$orgId/officer/payments/$paymentId.tsx
  - apps/memberry/src/routes/_authenticated/org/$orgId/officer/payments/index.tsx
  - apps/memberry/src/routes/_authenticated/org/$orgId/officer/reports/financial.tsx
  - apps/memberry/src/routes/_authenticated/org/$orgId/officer/roster/import.tsx
  - apps/memberry/src/routes/_authenticated/org/$orgId/officer/roster/index.tsx
  - apps/memberry/src/routes/_authenticated/org/$orgId/officer/settings/funds.tsx
  - apps/memberry/src/routes/_authenticated/org/$orgId/officer/training/$trainingId.tsx
  - apps/memberry/src/routes/_authenticated/org/$orgId/officer/training/$trainingId/attendance.tsx
  - apps/memberry/src/routes/_authenticated/org/$orgId/training/$trainingId.tsx
findings:
  critical: 4
  warning: 4
  info: 1
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-06
**Depth:** quick
**Files Reviewed:** 99
**Status:** issues_found

## Summary

Phase 04 introduced TypeSpec definitions for elections, certificates, dues, membership, events, and training modules; ran a 3-step build pipeline to regenerate routes and SDK hooks; decommissioned 6 hand-wired routes; and migrated 26 frontend files from manual `api.get/post` to generated SDK hooks.

Auth annotations on new TypeSpec interfaces are generally correct — all new interfaces carry `@useAuth(bearerAuth)` and `@extension("x-security-required-roles", ...)`. Route decommission was verified with 269 auth references in generated routes. No hardcoded secrets, eval, or XSS vectors found in changed files.

Four blockers found: a data-integrity bug in the election form (client IDs sent as DB references), a security gap (any member can fetch any certificate by ID), an unvalidated date input causing a runtime crash vector, and a broken import in all 48 generated handler stubs. Four warnings cover org ownership bypass, stale `isPending` check variable, and the `as any` cast proliferation masking a type/runtime contract divergence that will surface at handler implementation time.

---

## Critical Issues

### CR-01: Election form sends client-generated random IDs as position references

**File:** `apps/memberry/src/features/elections/components/election-form.tsx:37,331`

**Issue:** `generateId()` produces `Math.random().toString(36).slice(2,10)` — a local ephemeral ID. These IDs are then sent as `positions: positions.filter(...).map((p) => p.id)` in the `createElection` mutation body. The `ElectionCreateRequest.positions` field is `Array<string>` of **existing position IDs** referencing the `positions` DB table. The server will either reject these unknown IDs with a foreign-key error or, if the handler doesn't validate, silently link the election to non-existent positions — rendering the election broken at nomination/voting time.

**Fix:** Replace local position creation with a fetch of existing positions for the org, then let users select from real DB records. If the intent is to create new positions inline, the positions must be created server-side first (POST /positions) and the returned IDs used.

```tsx
// WRONG — sends fake IDs
const [positions, setPositions] = useState<Position[]>([
  { id: generateId(), title: '', sortOrder: 0 },  // id is a random string, not a DB record
])
// ...
positions: positions.filter((p) => p.title.trim()).map((p) => p.id),  // sends fake IDs to API

// CORRECT — fetch real positions then let user pick
const { data: orgPositions } = useQuery(listPositionsOptions({ query: { organizationId: orgId } }))
// ...
positions: selectedPositionIds,  // IDs from actual DB records
```

---

### CR-02: getCertificate has no ownership enforcement — any member can read any certificate

**File:** `specs/api/src/association/member/certificates.tsp:65-76`

**Issue:** `getCertificate` requires only `association:member` role. There is no `personId` constraint or owner check in the TypeSpec definition. Any authenticated member who guesses or enumerates a `certificateId` (UUIDs are not secret if IDs are leaked via other endpoints) can retrieve another member's certificate, including their name, training completion, and certificate number.

`listMyCertificates` is correctly scoped to the authenticated user server-side (by convention), but the single-get path has no such constraint documented in the spec — and the generated stub has no ownership check implemented.

**Fix:** Add `association:member:owner` to the role extension for `getCertificate`, and ensure the handler implementation filters `WHERE certificate.personId = authenticatedUser.id`.

```typespec
@extension("x-security-required-roles", #["association:member:owner"])
getCertificate(
  @path certificateId: string
): ApiOkResponse<Certificate>
  | ApiNotFoundResponse
  | ApiUnauthorizedResponse
  | ApiForbiddenResponse;
```

---

### CR-03: Unvalidated date input causes uncaught exception in credit-entries handler

**File:** `services/api-ts/src/app.ts:246`

**Issue:** `body.activityDate ? new Date(body.activityDate) : now` — `body` is raw `ctx.req.json()` with no schema validation (line 229). If a client sends `activityDate: "not-a-date"`, `new Date("not-a-date")` returns an `Invalid Date` object; passing it to Drizzle's `insert` will throw a runtime error producing an unhandled 500. More critically, `body.organizationId` is accepted without verifying the authenticated user is a member of that organization (line 236) — a user can log credits against any org by supplying `organizationId: <victimOrgId>`.

**Fix:**

```typescript
// 1. Validate activityDate
const rawDate = body.activityDate;
const activityDate = rawDate ? new Date(rawDate) : now;
if (isNaN(activityDate.getTime())) {
  return ctx.json({ error: 'Invalid activityDate' }, 400);
}

// 2. Reject org IDs the user doesn't belong to
const [membership] = await db.select({ organizationId: memberships.organizationId })
  .from(memberships)
  .where(and(eqOp(memberships.personId, user.id), eqOp(memberships.organizationId, body.organizationId ?? '')))
  .limit(1);
const orgId = membership?.organizationId ?? firstMembership?.organizationId;
if (!orgId) return ctx.json({ error: 'No organization membership found' }, 400);
```

---

### CR-04: All 48 generated handler stubs import a non-existent `{ db }` export

**File:** `services/api-ts/src/handlers/association:member/*.ts` (all 37 files), `services/api-ts/src/handlers/association:operations/*.ts` (all 11 files) — line 2 in each

**Issue:** Every generated stub contains:
```typescript
import { db } from '@/core/database';
```
`@/core/database` does not export `db` — it exports factory functions (`createDatabase`, `getDatabaseFromContext`) and types. This is a dead import today (stubs throw before using `db`) but will cause a TypeScript compilation error the moment any stub is filled in and actually references `db`. The established pattern — used by every real handler like `createPerson.ts` — is `const db = ctx.get('database') as DatabaseInstance`.

**Fix:** Remove the stale `import { db }` line from all 48 stubs. When implementing, use:
```typescript
const db = ctx.get('database') as DatabaseInstance;
```

---

## Warnings

### WR-01: Credit-entries handler allows cross-org credit assignment

**File:** `services/api-ts/src/app.ts:236`

**Issue:** `const orgId = body.organizationId || firstMembership?.organizationId` — if `body.organizationId` is provided and the user is NOT a member of that org, the code proceeds to insert a credit entry anyway. This is an authorization gap: users can assign credits to organizations they do not belong to. (Overlaps with CR-03 but distinct — CR-03 is the crash, this is the logic error when no crash occurs.)

**Fix:** Only allow `body.organizationId` if it matches one of the user's actual memberships (see CR-03 fix).

---

### WR-02: Stale `isPending` loading indicator in attendance.tsx targets wrong variable

**File:** `apps/memberry/src/routes/_authenticated/org/$orgId/officer/events/$eventId/attendance.tsx:143-144`

**Issue:**
```tsx
{checkInMutation.isPending &&
(checkInMutation.variables as any)?.memberId === memberId ? (
  <Loader2 className="w-3 h-3 animate-spin" />
) : (
  'Mark Present'
)}
```
`checkInMutation.variables` is the full `reg` object passed to `mutate(reg)`. The check-in call uses `reg.personId ?? reg.memberId` internally, but the comparison here uses `.memberId` directly — if the registration object uses `personId` (not `memberId`), this comparison always evaluates `false`, and the spinner never shows for any row during a pending mutation. All "Mark Present" buttons also disable while any mutation is pending (`disabled={checkInMutation.isPending}`), causing a confusing frozen UI with no per-row loading indicator.

**Fix:**
```tsx
const pendingForThisRow = checkInMutation.isPending &&
  ((checkInMutation.variables as any)?.memberId === memberId ||
   (checkInMutation.variables as any)?.personId === memberId);

{pendingForThisRow ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Mark Present'}
```

---

### WR-03: Pervasive `as any` casts mask TypeSpec/runtime contract divergence

**File:** Multiple — `dues-config-form.tsx:53,79`, `gateway-setup.tsx:36`, `financial-dashboard.tsx:15`, `member-detail.tsx:76`, `category-editor.tsx:67,81`, `refund-form.tsx:98`, `record-payment-form.tsx:179`, `completion-table.tsx:109,196`

**Issue:** The summary acknowledges TypeSpec-generated types diverge from what hand-wired endpoints actually return. The fix applied is to cast both query options and mutation calls to `as any`. This means type checking is fully disabled at these call sites — invalid field names, missing required fields, or changed API shapes will not produce compile-time errors. When Phase 05 implements the handler stubs, the runtime responses may differ from the `as any`-cast assumptions, and the mismatch will surface only at runtime.

**Fix:** After Phase 05 handler implementation, reconcile the TypeSpec models with the actual handler response shapes and remove `as any` casts. Until then, add a comment on each cast pointing to the specific field mismatch so it can be tracked.

---

### WR-04: `electionType` mapping inverts bylaw/officer semantics

**File:** `apps/memberry/src/features/elections/components/election-form.tsx:330`

**Issue:**
```tsx
electionType: form.type === 'bylaw' ? 'special' : 'general',
```
The UI labels `officer` elections as `'general'` and `bylaw` elections as `'special'`. This is a business-logic mapping choice that is undocumented and untested — if the backend uses `electionType` to determine voting rules (quorum, passage threshold, ballot structure), inverting the mapping here produces wrong behavior silently. There is no comment explaining why this mapping was chosen.

**Fix:** Add an inline comment or constant explaining the mapping rationale:
```tsx
// 'officer' -> 'general' election (standard officer voting)
// 'bylaw'   -> 'special' election (requires quorum + passage threshold)
electionType: form.type === 'bylaw' ? 'special' : 'general',
```
If this mapping is not intentional, correct it to match backend semantics.

---

## Info

### IN-01: `internalServiceToken` regenerates on every server restart

**File:** `services/api-ts/src/app.ts:63`

**Issue:** `const internalServiceToken = crypto.randomUUID()` is called inside `createApp()`. In production with multiple instances or rolling restarts, tokens issued before restart become invalid mid-flight. The `TODO` comment acknowledges this should move to config/env but it remains unfixed in this phase.

**Fix:** Read from `config.internalServiceToken` (set via env var `INTERNAL_SERVICE_TOKEN`). Generate once on first deploy and persist it.

---

_Reviewed: 2026-05-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
