# AHA Fix-Ready Plan: Membership Lifecycle

Date: 2026-06-11
Prompt: `docs/aha/prompts/03-organize-gap-plan-for-fixing.md`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Membership Lifecycle |
| Module slug | membership-lifecycle |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/membership-lifecycle-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/membership-lifecycle-fix-ready-plan.md` |
| Audit decision | FAIL (carried from gap plan §24) |
| Superpowers used | No (not invoked; organize-only static reasoning was sufficient; recorded per shared-rules §12) |
| Organizer decision | PARTIALLY READY |
| Reason | A clean, independent first batch (G-01 P0) and a mechanical security batch (G-02/G-03 P1) are fully fix-ready now with strong evidence verified against source. However, the largest P1 cluster (state-machine integrity: G-04/G-05/G-06/G-12 and the record-safety/delete shape of G-09) is gated on six unresolved product decisions (reinstate semantics, RESIGNED actor, EXPIRED threshold, expulsion-in-V1, re-application strategy, delete-op existence). Those cannot enter the active fix sequence until decided. So the module is partially ready: Batches A, B, and parts of D can run now; Batches covering state-machine integrity and funnel side-effects are blocked or split. |
| Limitations | Static review only — gap plan based on no server boot / no test execution / no DB introspection (migrations used as DB ground truth). Organizer re-verified only the load-bearing evidence: `statusRecomputeCron.ts:59–79` SQL selects nonexistent `is_expired`/`is_pending_payment` (G-01 confirmed P0), zero migration hits for `is_expired`/`is_pending_payment`/`resigned_at`/`expelled_at` (G-01/G-04 confirmed), `createDisciplinaryAction.ts` present but at unrouted path (G-06 confirmed), `getMembership.ts:28–30` has the org-compare guard that is the G-02 fix model. KG (`.understand-anything`, 2026-06-06) used as secondary context only and is partially stale; cross-cutting and database-schema audits do not exist yet, so no consolidated context was available. |

## 2. Fix Strategy Summary

**What to fix first.** Fix **G-01 alone and first** (Batch A). It is a contained SQL repair on `statusRecomputeCron.ts` — strip the two nonexistent columns (`is_expired`, `is_pending_payment`), derive pendingPayment from the stored status, and switch OFFSET pagination to keyset. It is the module's foundational invariant (BR-01/WF-032) and silently fails every night. Write the failing real-DB integration test before touching the cron — mocked tests are exactly why this shipped broken. Bundle the G-10 read-consistency policy into the same batch because both answer "where does membership status truth live"; do the cron repair purely, then apply `withComputedStatus` on `getMembership`/`listMemberships` and route `updateMembership` through `persistWithComputedStatus`.

**Second.** Batch B is the security batch (G-02 cross-org mutation guards + G-03 application IDOR). These are ~10 handlers each receiving a 2–4-line org/ownership guard copied from the in-repo pattern (`getMembership.ts:28–30`, `bulkApproveMembershipApplications.ts:56`), plus a cross-org 403 test matrix. No shared-file changes. Mechanical, low-risk, high trust value.

**What not to fix now / major risk.** The **state-machine integrity cluster (G-04/G-05/G-06/G-12)** and the **delete-op safety shape (G-09)** are partially blocked on product decisions (see §8). Do NOT start them until the reinstate semantics, RESIGNED actor, EXPIRED threshold, expulsion-V1, re-application strategy, and delete-op-existence questions are answered. The G-04 migration (`add resigned_at`) touches the heavily shared `membership` table — additive columns only, no renames (`computeMembershipStatus` is the most-imported util in the mega-module; its signature must stay additive). The **invoice half of G-07** is a cross-module dependency with the dues-payments audit (next in queue) and should be coordinated, not built solo; the **event-emission half of G-07 + history-writes G-08** are safe to do now because the consumer already exists.

**One pass or multiple.** Multiple batches. Batch A and Batch B can run in the current `04` pass (independent, low blast radius). The state-machine batch must wait for product decisions and a schema migration. Doc-sync is a cheap independent batch.

**Shared/platform/database work.** One additive migration (`resigned_at`, later `expelled_at`) is required for the state-machine batch (Batch F) — isolated, additive-only. No shared-platform code changes are required for Batches A/B; the global-role model is flagged for the auth-rbac audit, not fixed here.

**Product decisions / environment blockers.** Six product decisions block the state-machine and funnel-completeness work (§8). One environment limitation: perf assertions (§16 of spec) are `[BLOCKED BY ENVIRONMENT]` and out of scope.

## 3. Active Fix Scope

Only P0/P1/selected P2 and V1 REQUIRED / selected V1 RECOMMENDED items.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G-01: `statusRecomputeCron` raw SQL selects nonexistent `is_expired` / `is_pending_payment` columns → nightly recompute fails; automatic ACTIVE→GRACE→LAPSED chain dead; primary reads serve stale stored status | P0 | V1 REQUIRED | A | Foundational BR-01/WF-032 invariant silently fails every night; everything downstream (dues reminders, dunning, voting eligibility, roster) reads stale status | `statusRecomputeCron.ts:59–79` (verified: selects `is_expired`/`is_pending_payment`); zero migration hits for those columns (verified); `graceToLapsed.ts:83`; `getMembership.ts`/`listMemberships.ts` return stored rows |
| FIX-002 | G-10: dual status semantics — `listMemberships`/`getMembership` serve stored cache; legacy `listOrgMembers` computes on read (omits `dateOfDeath` + terminal inputs); `updateMembership` changes `duesExpiryDate` without recomputing cache | P2 | V1 REQUIRED (policy) | A | Same member shows different status in member app vs admin surface; must define one truth policy alongside the cron repair | `listMemberships.ts:30–38`; `membership/listOrgMembers.ts:78–96`; `updateMembership.ts:33` |
| FIX-003 | G-02: single `approveMembershipApplication`/`denyMembershipApplication` and all lifecycle mutations (`resign`/`terminate`/`decease`/`reinstate`/`renew`/`updateMembership`/`deleteMembership`/`updateMembershipApplication`) never verify the target record's `organizationId` vs caller org → cross-org tampering | P1 | V1 REQUIRED | B | Officer/admin of org A can mutate org B's member records by ID; violates BR-21/M5-R10 multi-org trust | handlers in gap §5/§14; contrast `bulkApproveMembershipApplications.ts:56` (has guard); fix model `getMembership.ts:28–30` (verified) |
| FIX-004 | G-03: `getMembershipApplication` IDOR — route allows `user:owner`, middleware delegates ownership to handler, handler checks only session → any authenticated user can read any application's PII (person, tier, denial reason) | P1 | V1 REQUIRED | B | Applicant PII exposed object-level to any logged-in user | `routes.ts:715–719`; `middleware/auth.ts:205–212`; `getMembershipApplication.ts:16–17` |
| FIX-005 | G-07 (event half): approval emits no `membership.created`/`membership.approved` event (only `invite/claimInvite.ts:118` emits it) — the welcome consumer never fires on the main funnel | P1 | V1 REQUIRED | C | Core join→approve funnel produces a silent member; the consumer already exists so the emit is cheap and safe module-local | `approveMembershipApplication.ts:46–72`; `domain-event-consumers.ts:310` (consumer exists, never fired) |
| FIX-006 | G-08: officer-initiated transitions (approve/resign/terminate/decease/reinstate/renew) write no `membership_status_history` rows; only graceToLapsed + dues settle do | P1 | V1 REQUIRED | C | Spec §7 compliance/audit requirement; disputes unresolvable without a transition trail | grep `membershipStatusHistory` consumers → `graceToLapsed.ts:111–121`, `dues-payments.repo` only; `status-history.schema.ts` |
| FIX-007 | G-04: no `resigned_at`/`expelled_at` columns; `resignMembership` stores `removedAt` → recompute reports `removed`; `reinstateMembership` can resurrect a resigned member | P1 | V1 REQUIRED | F + E2 | Terminal-state irreversibility (spec invariant) broken; status reporting wrong on recompute paths. Schema migration is additive on shared `membership` table | `resignMembership.ts:59–63`; `compute-membership-status.ts:59–62`; `reinstateMembership.ts:30`; zero migration hits for `resigned_at` (verified) |
| FIX-008 | G-05: reinstate semantics 3-way conflict (m05: lapsed-only/terminal-removed; TypeSpec: suspended+lapsed; impl: removed+suspended; transitions table allows `expired→active`) | P1 | V1 REQUIRED (after decision) | E2 | Officers can reinstate spec-terminal REMOVED members; lapsed members cannot be reinstated despite WF-035 | `reinstateMembership.ts:30`; `membership.tsp:930`; m05 §8; `status-transitions.ts:86–87` |
| FIX-009 | G-06 (suspend only): SUSPENDED unreachable — no API writes `suspendedAt`, no suspend/unsuspend op exists; member-detail renders a `suspended` badge that can never occur | P1 | V1 REQUIRED (suspend) | E2 | Spec P0 officer action (suspend/restore) cannot be performed; downstream consumers reference a state that can never occur. (Expel/expired automation is V2 — see §10) | grep `suspendedAt` writes → only `reinstateMembership` clears it; `member-detail.tsx:52` |
| FIX-010 | G-12: re-application after a terminal state hits the `(organizationId, personId)` unique index → approve throws raw unique-violation 500 | P1 | V1 REQUIRED (after decision) | E2 | Spec-defined re-entry path (m05 §8/§13) fails with an opaque error | `membership.schema.ts:128–131`; `approveMembershipApplication.ts:60–70`; `createMembership.ts:41–45` |
| FIX-011 | G-09: `deleteMembership` hard-deletes with no org-scope/terminal/position check; `membership_status_history` FK `restrict` → 500 for members with history, silent loss for members without | P1 | V1 REQUIRED (after decision on op existence) | E2 | Destroys financial-linked records or 500s on FK; record-safety violation | `deleteMembership.ts:26`; `database.repo.ts:160–168`; `status-history.schema.ts` |
| FIX-012 | G-11: duplicate-application check filters only `status='submitted'` — an `underReview` application doesn't block a duplicate | P2 | V1 RECOMMENDED | C | M5-R5 partially enforced; 1-line filter widen | `createMembershipApplication.ts:34–40` |
| FIX-013 | G-15: `createMembershipApplication` doesn't validate tier belongs to org and doesn't bind `body.personId` to session user (spoofing); `updateMembershipApplication` lets admin rewrite personId/orgId | P2 | V1 RECOMMENDED | B | Foreign-tier memberships + application spoofing; field-level integrity | `createMembershipApplication.ts:29–47`; `validators.ts:6613–6618`; `updateMembershipApplication.ts:25–29` |
| FIX-014 | G-16: `renewMembership` hardcodes +1 year, ignoring org `billingFrequency` honored by `extendMembershipExpiry`/`settlePayment` | P2 | V1 RECOMMENDED | C | Quarterly/semi-annual orgs get a year of membership; financial correctness | `renewMembership.ts:38–41` vs `membership-lifecycle.ts:144–175` |
| FIX-015 | G-18: `deleteMembershipTier` lacks the BR-04 member-assignment gate (FK failure surfaces as raw 500); `countMembersInCategory` repo gate has zero consumers | P2 | V1 RECOMMENDED | C | FK 500 instead of guided 409 "retire instead"; unwired BR-04 gate | `deleteMembershipTier.ts:25`; `membership.repo.ts:309–316` |
| FIX-016 | G-13/G-14 (subset): bulk import has no row cap, no per-row structured validation, no existing-email link — JSON-array raw insert only | P2 | V1 RECOMMENDED (cap + per-row validation + email-match link only) | C | Pilot roster imports will duplicate accounts; cap+validation+email-match is the V1 floor (CSV wizard + license normalization are V2 — see §10) | `importRosterMembers.ts:37–46`; no import UI under `apps/memberry/src` |
| FIX-017 | §12: `q` search filter declared in `MembershipFilters` but `buildWhereConditions` builds no condition (no-op search) | P3 | V1 RECOMMENDED | C | Roster search appears supported but silently does nothing | `membership.repo.ts:40` (`q` in interface; condition ignored) |
| FIX-018 | §11: frontend `MemberStatus` union lacks resigned/deceased/expelled/expired → terminal members fall through styling/labels | P3 | V1 RECOMMENDED | C | Terminal-status members render without correct badge/label; pairs with FIX-007 | `member-detail.tsx:46` |
| FIX-019 | G-20 + CLAUDE.md + STATE_MACHINES: m05 §10/§20 describe pre-cutover topology; CLAUDE.md module map stale (nonexistent `certificates/` dir, stale counts); STATE_MACHINES↔m05 reinstate/resign unreconciled | P3 | V1 RECOMMENDED (doc fix) | D-docs | Misleads every future agent; cheap, high leverage; STATE_MACHINES reconciliation must follow the §8 product decisions | m05 §10/§20 vs `MODULE_SPEC.member.membership.md`; CLAUDE.md module map |
| FIX-020 | BR-02: `gracePeriodDays` has no 0–90 range validation (`MembershipUpdateRequestSchema` is bare `z.number().int()`) | P3 | V1 RECOMMENDED | C | Out-of-range grace periods accepted silently; spec says 0–90 | `validators.ts:6847` (TypeSpec min/max needed) |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| A — P0 status-truth (cron + read consistency) | Repair broken nightly recompute and define single status-truth policy | FIX-001, FIX-002 | Medium (touches the BR-01 read surface; `computeMembershipStatus` is platform-shared — do not change its signature) | **run in current `04` pass — FIRST** |
| B — P1 security/permission guards | Cross-org mutation guards + application IDOR + application-create integrity | FIX-003, FIX-004, FIX-013 | Low (additive per-handler guards; in-repo pattern exists) | **run in current `04` pass — second** (FIX-013 may need a small TypeSpec regen for update-body field removal; keep that piece isolated) |
| C — P2/P3 workflow completeness | Approve event emit, history writes, duplicate-app filter, renew billing-cycle, tier-delete gate, import hardening, q-search, frontend status union, grace-range validation | FIX-005, FIX-006, FIX-012, FIX-014, FIX-015, FIX-016, FIX-017, FIX-018, FIX-020 | Low–Medium (FIX-016 import touches data paths; FIX-014/FIX-015/FIX-020 may need TypeSpec regen) | **later** — run after Batch A and B land; can be split (event/history vs import vs validation) |
| D-docs — doc sync | Reconcile m05 §10/§20, CLAUDE.md map, STATE_MACHINES | FIX-019 | None (docs only) | **later** — STATE_MACHINES reconciliation only after §8 product decisions; topology/map fixes anytime |
| E2 — state-machine integrity | Reinstate semantics, suspend/unsuspend ops, re-application strategy, delete-op safety | FIX-007 (handler side), FIX-008, FIX-009, FIX-010, FIX-011 | High (terminal-state correctness, shared-table semantics, TypeSpec new ops) | **only after product decision** (§8) — then split into its own `04` pass; depends on Batch F migration |
| F — database/schema dependency | Additive migration: `resigned_at` (and `expelled_at` only when/if expulsion becomes V1) + backfill from `removed_at` where `status='resigned'` | FIX-007 (schema side) | Medium (additive on heavily shared `membership` table; backfill must be correct) | **only after database/schema dependency is resolved** — must land before E2 handler wiring; additive only, NO renames |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | `statusRecomputeCron` runs against a real schema; seed an expired membership, run the cron handler, assert no SQL error and stored status transitions | integration / data-schema | The cron query references only real columns and actually flips ACTIVE→GRACE on a real `membership` table (a mock cannot catch the SQL/schema mismatch) | NEW: `services/api-ts/src/handlers/member/membership/jobs/statusRecomputeCron.integration.test.ts` |
| FIX-001 | End-to-end clock test: active → (cron) grace → (graceToLapsed job) lapsed with stored-status assertions | integration / domain workflow | The whole automatic chain the P0 unblocks works against stored status | extend the new `statusRecomputeCron.integration.test.ts` or co-locate with `graceToLapsed.test.ts` |
| FIX-002 | Dual-surface consistency: same membership read via `getMembership`/`listMemberships` and via legacy `listOrgMembers` returns the same status; `updateMembership` changing `duesExpiryDate` recomputes cache | integration / regression | Member app and admin surface agree; update no longer leaves a stale cache | extend `member/membership/listMemberships`/`getMembership` test area; new `listOrgMembers` consistency test in `handlers/membership/` |
| FIX-003 | Cross-org 403 matrix: org-A officer calls approve/deny/resign/terminate/decease/reinstate/renew/update/deleteMembership/updateMembershipApplication with an org-B record id → 403/404 | permission/RBAC + regression | Target-record org is enforced on every lifecycle mutation | extend colocated `member/membership/*.test.ts` per handler; model on `bulkApproveMembershipApplications.test.ts` |
| FIX-004 | `getMembershipApplication` ownership: a foreign authenticated user (not owner, not org officer) → 403/404 | permission/RBAC | Application PII is object-level protected | NEW colocated `member/membership/getMembershipApplication.test.ts` |
| FIX-005 | Approve → assert `membership.created`/`membership.approved` domain event emitted (and welcome consumer invoked) | integration | The funnel fires the event the existing consumer already handles | extend `approveMembershipApplication.test.ts`; assert against `domain-event-consumers.test.ts` hook |
| FIX-006 | Each officer transition writes a `membership_status_history` row (fromStatus, toStatus, changedBy, reason) | backend/unit | Officer transitions leave an audit trail | extend `approve/resign/terminate/decease/reinstate/renewMembership` colocated tests |
| FIX-007 | Resign → status survives recompute as `resigned` (not `removed`); reinstate of a resigned member → 4xx | backend/unit + regression + data/schema | Terminal integrity: `resigned_at` distinguishes resign from remove; reinstate cannot resurrect terminal | extend `resignMembership.test.ts` + `reinstateMembership.test.ts`; migration verified by FIX-001-style real-schema assertion |
| FIX-008 | Reinstate allowlist + transitions table match the decided semantics (one canonical matrix) | backend/unit | Reinstate accepts exactly the decided set and rejects the rest | extend `status-transitions.test.ts` + `reinstateMembership.test.ts` |
| FIX-009 | Suspend → status computes `suspended`; unsuspend/restore → returns to computed active/grace | backend/unit + E2E (one journey) | The new suspend/restore officer action works end to end | NEW colocated `suspendMembership.test.ts`/`unsuspendMembership.test.ts`; one Playwright journey only |
| FIX-010 | Terminal member re-applies → approve → handled outcome (no 500, friendly result) | contract (Hurl) | Spec §13 re-entry path no longer hits the raw unique-violation | extend `specs/api/tests/contract/member/membership/application-approval-flow.hurl` (new scenario) |
| FIX-011 | `deleteMembership` on a member with history → friendly 409 (not FK 500); cross-org/position guard enforced | backend/unit | Delete is safe and guarded (or the op is removed) | extend/NEW `member/membership/deleteMembership.test.ts` |
| FIX-012 | Duplicate application while an `underReview` one exists → 409 | backend/unit | M5-R5 covers underReview too | extend `createMembershipApplication` test area (NEW colocated test) |
| FIX-013 | createMembershipApplication: foreign-org tier → reject; caller cannot set arbitrary personId | backend/unit | Tier-org binding + self-person binding enforced | NEW colocated `createMembershipApplication.test.ts` |
| FIX-014 | Renew on a quarterly-billing org extends by 3 months (not 12) | backend/unit | Renewal honors org billing frequency | extend `renewMembership` test (NEW colocated) |
| FIX-015 | `deleteMembershipTier` with assigned members → 409 (not FK 500) | backend/unit | BR-04 gate enforced with friendly error | NEW colocated `deleteMembershipTier.test.ts` |
| FIX-016 | Import: row cap enforced; per-row validation errors returned; existing-email row links instead of duplicating | backend/unit | Import hardening floor before any pilot import | extend `importRosterMembers.test.ts` |
| FIX-017 | Roster `q` search returns filtered rows (or filter is removed) | backend/unit (repo) | Search is real, not a silent no-op | extend `repos/membership.repo.test.ts` |
| FIX-018 | Member-detail renders correct badge/label for resigned/deceased/expelled/suspended | frontend/component | Terminal/suspended statuses display correctly | extend `apps/memberry/src/features/membership/components/member-detail.test.tsx` |
| FIX-020 | `gracePeriodDays` outside 0–90 → validation rejects | backend/unit (validator) | Range enforced per BR-02 | extend validator/`updateMembership` test after TypeSpec min/max regen |
| FIX-019 | n/a (docs only) | n/a | n/a | n/a |

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `member/membership/jobs/statusRecomputeCron.ts` (SQL + keyset pagination) | module-local | Low (job-internal); but corrects status feeding many consumers |
| FIX-002 | `member/membership/getMembership.ts`, `listMemberships.ts`, `updateMembership.ts`; `handlers/membership/listOrgMembers.ts`; reuse `compute-membership-status.ts`/`persistWithComputedStatus` (read-only) | module-local | Medium (two read surfaces + update path) |
| FIX-003 | `approveMembershipApplication.ts`, `denyMembershipApplication.ts`, `resignMembership.ts`, `terminateMembership.ts`, `deceaseMembership.ts`, `reinstateMembership.ts`, `renewMembership.ts`, `updateMembership.ts`, `deleteMembership.ts`, `updateMembershipApplication.ts` | module-local | Low per file (additive guard); copies `getMembership.ts:28–30` |
| FIX-004 | `member/membership/getMembershipApplication.ts` | module-local | Low |
| FIX-005 | `approveMembershipApplication.ts`; reuse `core/domain-event-consumers.ts` (read-only, do not modify consumer) | module-local | Low |
| FIX-006 | approve/resign/terminate/decease/reinstate/renew handlers; `status-history.schema.ts` (read), `status-history` repo write | module-local | Low |
| FIX-007 | `services/api-ts/src/handlers/association:member/repos/membership.schema.ts` (add column); NEW migration; `resignMembership.ts`, `reinstateMembership.ts`, `compute-membership-status.ts` inputs, `statusRecomputeCron.ts` query | database/schema + module-local | **High** — `membership` table + `computeMembershipStatus` are platform-shared; additive only |
| FIX-008 | `reinstateMembership.ts`, `status-transitions.ts`, `specs/api/src/association/member/membership.tsp` (doc), `docs/product/STATE_MACHINES.md` | module-local + TypeSpec | Medium (regen + transitions semantics) |
| FIX-009 | NEW `suspendMembership.ts`/`unsuspendMembership.ts` handlers, `membership.tsp` (new ops → regen routes/validators), `status-history` write, `member-detail.tsx` badge | module-local + TypeSpec | Medium |
| FIX-010 | `approveMembershipApplication.ts`, `createMembership.ts`; possibly `membership.schema.ts` index (only if archive strategy chosen) | module-local (+ database/schema if archive) | Medium–High (depends on strategy decision) |
| FIX-011 | `deleteMembership.ts`; `core/database.repo.ts` (only if soft-delete pattern adopted — flag as shared) | module-local (+ shared if soft-delete base method) | Medium (FK behavior) |
| FIX-012 | `createMembershipApplication.ts` | module-local | Low |
| FIX-013 | `createMembershipApplication.ts`, `updateMembershipApplication.ts`, `membership.tsp` (strip personId/orgId from update body → regen) | module-local + TypeSpec | Low–Medium |
| FIX-014 | `renewMembership.ts`; reuse `utils/expiry-extension.ts` / `membership-lifecycle.ts` | module-local | Low |
| FIX-015 | `deleteMembershipTier.ts`; wire `membership.repo.ts:309–316` `countMembersInCategory` | module-local | Low |
| FIX-016 | `importRosterMembers.ts`; possibly `membership.tsp` request shape | module-local | Medium (data path) |
| FIX-017 | `member/membership` repo / `membership.repo.ts` `buildWhereConditions` | module-local | Low |
| FIX-018 | `apps/memberry/src/features/membership/components/member-detail.tsx`; `MemberStatus` type from `@monobase/api-spec` | module-local (frontend) | Low |
| FIX-019 | `docs/product/modules/m05-membership/MODULE_SPEC.md`, `CLAUDE.md`, `docs/product/STATE_MACHINES.md` | docs | None |
| FIX-020 | `specs/api/src/association/member/membership.tsp` (min/max) → regen validators | module-local + TypeSpec | Low |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001, FIX-002, FIX-007 | cross-module | `computeMembershipStatus` is the mega-module's most-imported util (elections `castVote.ts:46`, governance `castBallot`/`createCandidate.ts:56`, credentials, dues, marketplace, booking, email) | Any change to status computation has platform-wide blast radius; treat the pure fn as a frozen, additive-only contract | Not before — but signature must stay additive; add inputs, never remove |
| FIX-007 | database/schema | `membership` table at `handlers/association:member/repos/membership.schema.ts`, consumed by seeds, ports, events module | Adding `resigned_at` touches a heavily shared table | Migration (Batch F) must land BEFORE E2 handler wiring; additive only, no renames |
| FIX-005, FIX-006 | shared/platform | `core/domain-event-consumers.ts` membership hooks (`:310–363,1075`) — `membership.created` consumer exists but only invite-claim emits it | G-07 emit reuses an existing consumer; do NOT modify the consumer | No — emit is module-local; consumer is read-only |
| FIX-005 (invoice half) | cross-module | Dues settle/refund path owns the payment→status side; `membership-lifecycle.ts` lazy-imports `@/handlers/dues/repos/dues-payments.repo` | Invoice generation on approve belongs partly to the dues-payments audit (next in queue) | Coordinate; the invoice half is OUT of this module's active scope until dues audit — only emit the event now |
| FIX-003 | shared/platform | `orgContextMiddleware` + `requirePosition` + global comma-separated role model (`middleware/auth.ts`, `core/auth/officer-checks.ts`) | The handler-local guards are safe; the global-role-model question is the auth-rbac audit's scope, not this fix | No — fix handlers locally; flag role-model to auth-rbac audit |
| FIX-011 | shared/platform (conditional) | `core/database.repo.ts` `deleteOneById` hard-delete default | If a soft-delete base pattern is adopted, it touches a shared base method (blast radius across modules) | Conditional — prefer module-local guard/soft-delete; do not change the base method without isolating it |
| FIX-008, FIX-009, FIX-010, FIX-013, FIX-020 | shared/platform (build pipeline) | TypeSpec → OpenAPI → routes/validators regen (`specs/api` build + `services/api-ts generate`) | New ops / body-field / range changes require regeneration; never hand-edit generated files | Regen must run after the `.tsp` edits, before handler work |
| FIX-007 (chapters), member transfer | cross-module | Member transfer (WF-036) lives in `member/chapters/`; directory (WF-034) in `member/directory/` | Out of this module's scope; verification belongs to chapters-directory audit | No — hand off |
| FIX-008, FIX-009, FIX-010, FIX-011 | product decision | Reinstate semantics, RESIGNED actor, EXPIRED threshold, expulsion-V1, re-application strategy, delete-op existence | Determines the fix shape; cannot safely build without answers | YES — see §8; required before E2 |
| (spec §16 perf) | environment/tooling | No server boot / load harness available in static review | Perf assertions cannot be verified | `[BLOCKED BY ENVIRONMENT]` — out of scope |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Reinstate semantics: lapsed-only (m05/WF-035) vs suspended+lapsed (TypeSpec) vs removed+suspended (impl); is REMOVED reversible? | `[NEEDS PRODUCT DECISION]` | FIX-008, FIX-007 | Defines reinstate allowlist + transitions table + TypeSpec doc + STATE_MACHINES; blocks state-machine batch | Decide one canonical set, then align all four artifacts in E2 + FIX-019 |
| RESIGNED actor: member self-service (STATE_MACHINES, claims precedence) vs officer-recorded (m05) | `[NEEDS PRODUCT DECISION]` | FIX-007, (new self-resign route?) | Determines whether a self-resign route/UI is V1 scope | Decide; if self-service, scope a guarded self-resign op separately |
| EXPIRED state: define lapse→expired threshold (per-org configurable?) or drop EXPIRED from V1 vocabulary | `[NEEDS PRODUCT DECISION]` | FIX-009 (expired sibling), FIX-001 inputs | EXPIRED can never occur today; analytics counting `expired` always read 0 | Define threshold+job (V2) or drop from V1 docs now (cheap) |
| Is expulsion (disciplinary) V1 for the pilot, and does it route through M04? | `[NEEDS PRODUCT DECISION]` | FIX-009 (expel sibling), `createDisciplinaryAction.ts` wiring | Decides whether to wire the unrouted handler + add `expelled_at`, or formally defer | Defer to V2 unless pilot needs it (see §10) |
| Re-application strategy after a terminal membership: reuse existing row vs archive-old + insert-new (needs index change) | `[NEEDS PRODUCT DECISION]` | FIX-010 | Fix shape touches the shared `(organizationId, personId)` unique index | Decide; reuse-row avoids a schema change |
| Should `deleteMembership`/`deleteMembershipApplication` exist outside platform-admin at all? | `[NEEDS PRODUCT DECISION]` | FIX-011 | Determines whether to guard+soft-delete or remove the op | Decide; if removal, FIX-011 becomes a route/op deletion |
| Does approve auto-generate the first dues invoice when org dues config exists (m05 §13 [VERIFY])? | `[NEEDS CONFIRMATION]` | FIX-005 (invoice half) | Cross-module with dues-payments; scopes the invoice side of G-07 | Confirm with dues audit; keep invoice half out of this pass |
| Do existing E2E specs (`cross-org-isolation.spec.ts`, `role-boundaries.spec.ts`) already exercise the G-02 mutation endpoints? | `[NEEDS CONFIRMATION]` | FIX-003 | Determines regression-test reuse vs new tests | Verify at the start of Batch B (read the specs) |
| Is `membership_tier.code` meant to be unique per org (index is non-unique today)? | `[NEEDS CONFIRMATION]` | (FIX-015 adjacency) | Data-integrity expectation in SCOPE §10.H | Confirm; out of active scope unless confirmed |
| Applications without accounts: spec §7 wants applicantEmail/license; impl requires signup-first | `[NEEDS PRODUCT DECISION]` | FIX-013 adjacency | Schema change vs doc amendment | Decide; likely accept account-first and amend spec (cheap) |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-008 reinstate semantics alignment | `[NEEDS PRODUCT DECISION]` | Three conflicting definitions; cannot pick an allowlist without a decision | Reinstate-semantics decision (§8) |
| FIX-009 EXPIRED/EXPEL siblings of suspend | `[NEEDS PRODUCT DECISION]` | EXPIRED threshold undefined; expulsion-V1 undecided | EXPIRED + expulsion decisions (§8). (The SUSPEND part of FIX-009 is buildable once Batch F lands and the suspend op is approved.) |
| FIX-010 re-application strategy | `[NEEDS PRODUCT DECISION]` | Reuse-vs-archive determines whether the shared unique index changes | Re-application strategy decision (§8) |
| FIX-011 delete-op safety | `[NEEDS PRODUCT DECISION]` | Guard-and-keep vs remove-the-op are different fixes | Delete-op-existence decision (§8) |
| FIX-007 `resigned_at` migration | `[SHARED DEPENDENCY]` (database/schema) | Additive column on a heavily shared table; backfill must be correct | Batch F migration designed + reviewed; must land before E2 handler wiring |
| Spec §16 performance assertions (roster <500ms, import 500 rows <30s) | `[BLOCKED BY ENVIRONMENT]` | No server boot / load harness in this pass | Out of scope; verify during a perf pass, not in `04` |
| Invoice generation half of G-07 | `[CROSS-MODULE RISK]` / `[NEEDS CONFIRMATION]` | Belongs partly to dues-payments | dues-payments audit + the §13 [VERIFY] confirmation |

## 10. Deferred Items

Items not included in the active fix sequence.

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Full multi-step CSV import wizard UI (upload/preview/confirm/results, invalid-row CSV download) | G-13 | `V2 DEFERRED` | Backend correctness (cap/validation/email-match = FIX-016) must land first; wizard is UX on top |
| PRC license normalization + ambiguous-match human-review queue (BR-22/AC-M05-004 full scope) | G-14 | `V2 DEFERRED` | Needs a match-staging data model; email matching (FIX-016) covers the dominant V1 dedupe case |
| LAPSED→EXPIRED automation (threshold config + job + column) | G-06/G-01 | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | No operational definition exists; building now is guesswork |
| Expulsion workflow (route `createDisciplinaryAction`, `expelled_at` column, M04 integration) | G-06 | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | Trust-sensitive; needs M04 disciplinary-process design |
| `underReview` / `waitlisted` application sub-states + capacity logic | G-19 | `V2 DEFERRED` | Approve/deny direct from submitted is sufficient for V1 |
| Membership status-history read API/UI | G-08 read side | `V2 DEFERRED` | Write side (FIX-006) is the V1 requirement; read UI can follow |
| Spec §17 metrics suite (4 Prometheus metrics) | §17 | `V2 DEFERRED` | x-audit + structured logs cover the V1 observability floor; metrics need platform conventions first |
| Migrate inline `requirePosition` to `x-require-position` extension | §14 convention | `[DO NOT OVERBUILD]` | Behavior is correct today; opportunistic-only, not a bug |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Feature flags `membership.transferEnabled` / `membership.bulkImportV2` | spec §18 | No flag-infrastructure consumer in this module; spec §18 is aspirational `[DO NOT OVERBUILD]` |
| Relocating membership schemas out of `association:member/repos/` | §16 KG | Cutover §4.2 deliberately kept them there; moving thrashes seeds/ports/events for zero behavior gain `[DO NOT OVERBUILD]` |
| Renaming/merging the legacy `/membership/*` admin surface into new org-profile ops | §6 | Documented intentional stay (MODULE_SPEC §7.1); forcing migration risks admin-app regression |
| Directory caching (1-min TTL, spec §16) | §23 | Directory is another module's scope; premature optimization |
| Changing the `computeMembershipStatus` signature or rewriting it | §16 KG | Most-imported mega-module util; fix the inputs/schema/cron around it, do not rewrite |
| Modifying the shared `core/database.repo.ts` `deleteOneById` base method as part of FIX-011 | §15 | Prefer a module-local guard/soft-delete; changing the base method is a cross-module refactor, not a membership fix |
| Broad migration of all ~20 untested membership handlers to full coverage in one pass | §20 | Add tests during the respective fixes only; do not blanket-backfill |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Cron SQL references columns that were never added to the schema; mock-only tests hid it. Fix the query + add a real-schema integration test (the missing test IS the root-cause enabler) |
| FIX-002 | Root cause | No single status-truth policy — some reads serve the stored cache, some compute live, update skips recompute. Pick one policy and apply it uniformly |
| FIX-003 | Root cause | Authorization checks only the caller's own org membership (orgContext) but never the target record's org; pattern exists in `bulkApprove`/`getMembership` but wasn't applied uniformly |
| FIX-004 | Root cause | Ownership delegated by middleware to the handler, but the handler never performs the object-level check |
| FIX-005 | Root cause | Approve path never emits the domain event the consumer is built to handle |
| FIX-006 | Root cause | Officer transitions omit the history-insert that the cron/dues paths perform |
| FIX-007 | Root cause | Schema never caught up to the compute-fn's `resigned`/`expelled` inputs; `removedAt` overloaded for three terminal states. Additive migration is the real fix |
| FIX-008 | Unclear (pending decision) | Three artifacts disagree; the "right" semantics is a product choice, not a code bug — do not pick unilaterally |
| FIX-009 | Root cause (suspend) | No write path for `suspendedAt`; the restore half already exists in reinstate. Expired/expel siblings are unclear (pending decision) |
| FIX-010 | Root cause (with decision) | Unique `(organizationId, personId)` index blocks re-entry; the strategy to resolve it is a product/eng decision |
| FIX-011 | Root cause (with decision) | Hard-delete default + restrict FK produce inconsistent outcomes; whether the op should exist at all is a product decision |
| FIX-012 | Root cause | Duplicate check filter too narrow (`submitted` only) |
| FIX-013 | Root cause | No tier-org validation and no session-person binding on application create; update body exposes personId/orgId |
| FIX-014 | Root cause | Renewal duplicates expiry math instead of reusing the billing-frequency-aware util |
| FIX-015 | Root cause | BR-04 gate (`countMembersInCategory`) exists but is unwired; FK violation surfaces raw |
| FIX-016 | Root cause | Import does raw inserts with no cap/validation/matching |
| FIX-017 | Symptom→root | Declared filter with no condition built; implement the condition or remove the declared filter |
| FIX-018 | Root cause | Frontend status union out of sync with the API's 10-state enum |
| FIX-019 | Root cause (docs) | Docs describe pre-cutover topology; reconcile to as-built + post-decision state machine |
| FIX-020 | Root cause | TypeSpec lacks the 0–90 range constraint on `gracePeriodDays` |

## 13. Recommended First Fix Batch

**Batch name:** Batch A — P0 status-truth (cron + read consistency)

**Included Fix IDs:** FIX-001 (G-01 broken nightly recompute), FIX-002 (G-10 read-consistency policy).

**Why this batch comes first:**
- FIX-001 is the only P0 and the module's foundational invariant (BR-01/WF-032). The automatic ACTIVE→GRACE→LAPSED chain is dead and every downstream consumer (dues reminders, dunning, voting eligibility, roster views) reads stale status. The domain finding in the gap plan is explicit: fix order is **G-01 → G-07 → G-02**, and G-01 must be first and alone.
- The fix is contained (verified): the cron SQL at `statusRecomputeCron.ts:59–79` selects `is_expired`/`is_pending_payment`, which do not exist in any migration. Strip them, derive pendingPayment from stored status, switch OFFSET→keyset pagination. No schema change required for FIX-001.
- FIX-002 belongs in the same batch because the cron repair and the read-consistency policy both answer "where does status truth live." Decide the policy once, apply to `getMembership`/`listMemberships`/`updateMembership` and feed full inputs to legacy `listOrgMembers`.

**Tests to write first (RED before any source change):**
1. `statusRecomputeCron` integration test against a real schema — seed an expired membership, run the cron handler, assert no SQL error and a real status transition. This is the test whose absence let the P0 ship.
2. End-to-end clock test: active → (cron) grace → (graceToLapsed job) lapsed with stored-status assertions.
3. Dual-surface consistency test: `getMembership`/`listMemberships` agree with `listOrgMembers`; `updateMembership` changing `duesExpiryDate` recomputes the cache.

**Explicit out-of-scope for Batch A:**
- All security guards (FIX-003/FIX-004/FIX-013) → Batch B.
- All state-machine integrity work (FIX-007/008/009/010/011) → Batch E2, blocked on §8 product decisions + Batch F migration.
- Funnel side-effects (FIX-005/006), import (FIX-016), and all P2/P3 completeness items → Batch C.
- Do NOT change the `computeMembershipStatus` signature. Do NOT add `resigned_at` or any column in this batch (FIX-001 needs none). Do NOT touch the legacy `/membership/*` surface beyond the read-consistency policy.

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Membership Lifecycle
- **Exact module slug:** `membership-lifecycle`
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/membership-lifecycle-fix-ready-plan.md`
- **Raw gap plan (context only):** `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/membership-lifecycle-gap-plan.md`
- **Exact batch to execute first:** **Batch A — P0 status-truth (cron + read consistency)** — FIX-001 and FIX-002 only. Do not start any other batch in the same pass unless explicitly instructed; Batch B is the natural next pass.
- **Tests to prioritize (write RED first):**
  1. NEW `services/api-ts/src/handlers/member/membership/jobs/statusRecomputeCron.integration.test.ts` — real-schema cron run (no mock); must fail before the SQL repair.
  2. Active→grace→lapsed clock chain assertion (integration).
  3. Dual-surface status consistency (`getMembership`/`listMemberships` vs `listOrgMembers`; `updateMembership` recompute).
- **Files likely to touch (Batch A):** `member/membership/jobs/statusRecomputeCron.ts`; `member/membership/getMembership.ts`, `listMemberships.ts`, `updateMembership.ts`; `handlers/membership/listOrgMembers.ts`. Reuse (do not modify) `compute-membership-status.ts` and `persistWithComputedStatus`.
- **Shared/database cautions:**
  - `computeMembershipStatus` is the mega-module's most-imported util (elections/governance/credentials/dues/marketplace/booking/email). Treat it as a frozen, additive-only contract — do NOT change its signature.
  - Batch A needs **no schema migration**. The only migration in the whole plan (`resigned_at`) belongs to Batch F and must NOT be done in Batch A.
  - Any TypeSpec edit (later batches) requires `cd specs/api && bun run build` then `cd services/api-ts && bun run generate`; never hand-edit generated files. Not needed for Batch A.
- **Items NOT to implement (this pass or at all):**
  - Do NOT implement Batch E2 (FIX-007/008/009/010/011) — blocked on the six product decisions in §8 and on the Batch F migration.
  - Do NOT build the invoice half of G-07 (cross-module with dues-payments); FIX-005 emits the event only.
  - Do NOT build: CSV import wizard UI, PRC license normalization, EXPIRED automation, expulsion workflow, underReview/waitlisted sub-states, status-history read UI, metrics suite, feature flags, schema relocation, legacy `/membership/*` merge, or any change to the shared `computeMembershipStatus` / `core/database.repo.ts` base method (see §10 and §11).
  - Do NOT blanket-backfill tests for all ~20 untested handlers; add tests only for the fixes in the executing batch.
- **Stop condition:** after Batch A lands and its tests pass, save the fix report at `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/membership-lifecycle-fix-report.md` and stop; do not continue to Batch B without instruction.

---

Next recommended step:
Module/group: Membership Lifecycle
Module slug: membership-lifecycle
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/membership-lifecycle-fix-ready-plan.md
Recommended batch: Batch A — P0 status-truth (cron + read consistency)

---

## Product Decisions — RESOLVED (2026-06-12)

The six §8 product decisions that gated Batch E2/F were surfaced to the user, who
deferred them to engineering judgment ("best for long term"). Resolved below.
These now **unblock E2/F + Batch F** for a future `04` pass — they were NOT
implemented this session (the session's scope stopped at the decision-free
batches; E2/F is a large shared-table migration + 5 fixes and should be its own
pass). Revisit any decision if the pilot association's needs contradict it.

| # | Decision | Resolution | Long-term rationale | Affects |
| --- | --- | --- | --- | --- |
| 1 | Reinstate semantics | **Lapsed only.** REMOVED (resigned/terminated/deceased) is terminal + irreversible; SUSPENDED is restored via a dedicated unsuspend op, not reinstate. Re-entry after a terminal state goes through re-application (#5), not reinstate. | Terminal-state irreversibility is an audit/trust invariant; resurrecting removed members corrupts history + dues/voting eligibility. Align all 4 artifacts (reinstate allowlist, `status-transitions.ts`, `membership.tsp`, STATE_MACHINES.md) to lapsed-only. | FIX-008, FIX-007, FIX-019 |
| 2 | RESIGNED actor | **Officer-recorded only (V1).** No member self-resign route/UI in V1. | Keeps the V1 mutation surface tight + auditable (clear actor trail). A guarded self-resign op can be added in V2 without breaking the officer path. | FIX-007 (no new self-resign route) |
| 3 | EXPIRED state | **Drop from V1 vocabulary.** Remove EXPIRED from docs/labels/analytics now; no threshold or job. | Don't ship a state that can never occur + always-zero analytics. LAPSED already covers "past grace." Define a real lapse→expired rule deliberately in V2 only if a business need emerges. | FIX-009 (no expired sibling), FIX-018, FIX-019 |
| 4 | Expulsion (disciplinary) | **Defer to V2.** Leave `createDisciplinaryAction` unrouted; do NOT add `expelled_at`. | Trust-sensitive; needs proper M04 disciplinary-process design that does not exist yet. Wiring it now is premature. **NOTE:** the user signaled possible interest in V1 ("2?") — revisit first if the pilot explicitly requires expulsion; then wire the route + add `expelled_at` + M04 integration. | FIX-009 (no expel sibling) |
| 5 | Re-application strategy | **Reuse existing row.** Re-approval after a terminal state flips the existing `(organizationId, personId)` row back through a proper transition + writes a status-history row. | Avoids changing the heavily-shared unique index (high blast radius); keeps one canonical membership row per person/org with continuous status history. Archive-old+insert-new fragments history and needs an index migration for little pilot-scale benefit. | FIX-010 (no index change) |
| 6 | delete* scope | **Remove the officer-facing op.** `deleteMembership` / `deleteMembershipApplication` are removed from the officer surface; officers use terminal states (resign/terminate) which preserve history. Any genuinely-needed hard delete stays platform-admin-only and soft/guarded. | Hard-deleting membership destroys financial-linked + audit records (and FK `restrict` 500s anyway). Record-safety: terminal states + soft-delete only. | FIX-011 becomes route/op removal |

### Resulting Batch F migration shape (additive only)

- Add `resigned_at` to `membership`; backfill from `removed_at` where `status = 'resigned'`.
- **Do NOT** add `expelled_at` (expulsion deferred to V2 per #4).
- **No** unique-index change (reuse-row per #5).
- Additive only, no renames; `computeMembershipStatus` signature stays additive (most-imported util in the mega-module). Must land before E2 handler wiring.

### Recommended E2/F execution order (future pass, now unblocked)

1. **Batch F** migration (`resigned_at` + backfill), verified real-schema (FIX-001-style data test).
2. **E2** handler wiring: FIX-007 (resign stores `resigned_at`; reinstate rejects terminal), FIX-008 (reinstate allowlist = lapsed-only; align transitions + TypeSpec + STATE_MACHINES), FIX-009 (suspend/unsuspend op only — no expired/expel siblings), FIX-010 (reuse-row re-application), FIX-011 (remove officer delete op).
3. FIX-019 doc reconciliation to match the decided semantics.

Adjacent decision (§8, lower priority): "applications without accounts" — recommend **accept account-first + amend spec** (cheap), unless the pilot needs pre-account applications.

---

## Decisions — Step 29 (2026-06-12) — Track B RATIFIED, CLOSED

User was asked TB-1…TB-5 (AskUserQuestion); user delegated to engineering judgment
("your call whats best"). All five eng defaults from the "Product Decisions —
RESOLVED" addendum are **ratified as-is**. No override → **no E2.1 reopen**.

| ID | Decision | Outcome |
| --- | --- | --- |
| TB-1 | Reinstate semantics | **RATIFIED: LAPSED-only.** REMOVED terminal/irreversible; SUSPENDED restored via unsuspend op. |
| TB-2 | RESIGNED actor | **RATIFIED: officer-recorded only (V1).** No member self-resign route/UI. |
| TB-3 | EXPIRED state | **RATIFIED: dropped from V1 vocabulary.** No state, no job; LAPSED covers past-grace. |
| TB-4 | Expulsion-V1 | **RATIFIED: deferred to V2.** `createDisciplinaryAction` stays unrouted; no `expelled_at`. (User's earlier "2?" interest does not reopen for the pilot.) |
| TB-5 | Re-application | **RATIFIED: reuse existing row.** No unique-index change. |

**Track B CLOSED.** E2/F already implemented on these defaults (migrations 0065/0066,
fix-report COMPLETE). No new membership `04` pass required. `expelled_at` / EXPIRED job /
self-resign route remain **V2 DEFERRED** per §16 of the consolidated roadmap.

---

## Decisions — Step 44 (2026-06-13) — Track B EXPLICIT ratification (confirms Step 29)

The consolidated roadmap (§13) still listed Track B as the open HALT despite the Step 29
closure (which was by delegation, "your call whats best"). This pass re-presented TB-1…TB-5
to the user via `AskUserQuestion` — **explicit, per-decision, interactive ratification** —
with TB-4 (expulsion) flagged for an explicit V1-vs-V2 confirm per the standing "2?" signal.

**Outcome: all five RATIFIED AS-IS — identical to Step 29.** No override → **no E2.1 reopen.**

| ID | Explicit answer (2026-06-13) |
| --- | --- |
| TB-1 | Ratify as-is — reinstate **LAPSED-only**; REMOVED terminal/irreversible; SUSPENDED via unsuspend op. |
| TB-2 | Ratify as-is — RESIGNED **officer-recorded only (V1)**; no member self-resign. |
| TB-3 | Ratify as-is — **EXPIRED dropped from V1**; LAPSED covers past-grace. |
| TB-4 | Ratify as-is — **expulsion deferred to V2** (explicitly confirmed; `createDisciplinaryAction` stays unrouted, no `expelled_at`). |
| TB-5 | Ratify as-is — **reuse existing row**; no unique-index change. |

**Track B is now CLOSED by explicit user ratification.** FIX-019 terminal/reinstate
vocabulary already reconciled across `STATE_MACHINES.md` §1, `MODULE_SPEC.member.membership.md`,
and `membership.tsp` — verified consistent this pass; no doc-vocab edits required.
Roadmap §13/§18/§19 updated: Track B HALT → RESOLVED/CLOSED. Lead gate is now the 3 standing
P0 product decisions (elections G2, documents Q1, realtime PD-1).
