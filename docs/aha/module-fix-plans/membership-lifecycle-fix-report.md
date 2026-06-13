# AHA Module/Group Fix Report: Membership Lifecycle

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Membership Lifecycle |
| Module slug | membership-lifecycle |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/membership-lifecycle-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/membership-lifecycle-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/membership-lifecycle-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | **Batch A** (FIX-001, FIX-002) + **Batch B** (FIX-003, FIX-004, FIX-013) |
| Superpowers used | Yes (`superpowers:using-superpowers` invoked before implementation; TDD/RED-first discipline, root-cause validation, scope control) |
| Working tree status checked | Yes (`git status --short` at start: only `docs/aha/` changes present; no pre-existing source changes; safe to proceed) |
| Fix scope | P0 (FIX-001), P1 (FIX-003, FIX-004), P2 (FIX-002, FIX-013), all V1 REQUIRED / selected V1 RECOMMENDED |
| Out of scope | Batch C (P2/P3 completeness), Batch D-docs, Batch E2 (state-machine integrity — blocked on §8 product decisions), Batch F (resigned_at migration); all V2 DEFERRED / DO NOT ADD / `[DO NOT OVERBUILD]` items |
| Shared files touched | No platform/shared base files modified. One legacy cross-handler file (`handlers/membership/listOrgMembers.ts`) touched for FIX-002 read-consistency (module-local concern). |
| Schema/migration touched | No — Batch A/B require no schema change (confirmed `computeMembershipStatus` signature unchanged, no columns added) |
| Limitations | The unit-test layer is mock-only by design; FIX-001 required a real-Postgres integration test (the bug is a SQL/schema mismatch a mock cannot catch). Postgres was reachable (port 5432, default `monobase` DB) so the integration test ran; it self-skips with a logged message if PG is unreachable. FIX-013's TypeSpec body-field removal (stripping personId/orgId from the generated update schema) was deliberately NOT regenerated — identity-field stripping is enforced at the handler layer instead, keeping generated files untouched per the fix-ready plan's "keep that piece isolated" note. |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G-01: `statusRecomputeCron` raw SQL selects nonexistent `is_expired` / `is_pending_payment` columns → nightly recompute throws and aborts; automatic ACTIVE→GRACE→LAPSED chain dead | P0 | V1 REQUIRED | A | Only P0; foundational BR-01/WF-032 invariant; everything downstream reads stale status | **Fixed** |
| FIX-002 | G-10: dual status semantics — `getMembership`/`listMemberships` serve stored cache; `listOrgMembers` computes on read but omits `dateOfDeath`; `updateMembership` changed `duesExpiryDate` without recomputing cache | P2 | V1 REQUIRED (policy) | A | Same member could show different status across surfaces; one truth policy alongside the cron repair | **Fixed** |
| FIX-003 | G-02: lifecycle mutations never verify the target record's `organizationId` vs caller org → cross-org tampering | P1 | V1 REQUIRED | B | Officer/admin of org A could mutate org B's records by id; BR-21/M5-R10 multi-org trust | **Fixed** |
| FIX-004 | G-03: `getMembershipApplication` IDOR — handler checks only session, not ownership/org → any authenticated user reads any application's PII | P1 | V1 REQUIRED | B | Applicant PII exposed object-level to any logged-in user | **Fixed** |
| FIX-013 | G-15: `createMembershipApplication` doesn't validate tier belongs to org; `updateMembershipApplication` lets admin rewrite personId/orgId | P2 | V1 RECOMMENDED | B | Foreign-tier memberships + application identity rewrite; field-level integrity | **Partially Fixed** (tier-org binding + update identity-lock done; create personId self-binding NOT enforced — officer-on-behalf is a product decision) |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `statusRecomputeCron.integration.test.ts` (new) | **Failed** — `error: column "is_expired" does not exist` (Postgres code 42703) on the real `membership` table | FIX-001 | Confirms the P0 against the live `monobase` DB. Live `membership` columns verified: NO `is_expired` / `is_pending_payment` (queried `information_schema.columns`). Zero migration hits for those columns. |
| `getMembership.consistency.test.ts` (new) | **Failed** (getMembership case) — handler returned stored `active` instead of computed `lapsed` | FIX-002 | RED-proven: reverting the `withComputedStatus` line reproduced the failure (`3 pass, 1 fail`), restoring made it green again |
| `crossOrgGuard.test.ts` (new) | **Failed** — 10/11 cross-org mutations allowed foreign-org records (1 positive control passed) | FIX-003 | Every lifecycle mutation accepted an org-B record from an org-A caller |
| `getMembershipApplication.test.ts` (new) | **Failed** (foreign-user case) — handler returned 200 with PII for a stranger | FIX-004 | Owner / same-org cases already returned 200 (the IDOR is that EVERYONE did) |
| `createMembershipApplication.integrity.test.ts` (new) | **Failed** — foreign-org tier create succeeded; update rewrote personId/org | FIX-013 | Same-org create already passed |
| Existing membership module suite | 581 pass / 0 fail (pre-change) | all | Mock-based; none catch the FIX-001 SQL/schema mismatch (root-cause enabler of the P0) |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-001 | Stripped phantom `is_expired` / `is_pending_payment` from the cron SELECT; derive `isPendingPayment` from stored status (`status === 'pendingPayment'`); leave `isExpired` unset (no source column; LAPSED→EXPIRED automation deferred); switched OFFSET→keyset (seek) pagination | `jobs/statusRecomputeCron.ts` | No | `computeMembershipStatus` signature unchanged (frozen). No schema change. |
| FIX-002 | `getMembership`/`listMemberships` now wrap rows with `withComputedStatus` (compute on read); `updateMembership` routes the write through `persistWithComputedStatus` (recomputes cached status from merged state); `listOrgMembers` now SELECTs + passes `dateOfDeath` so it agrees with the other surfaces | `getMembership.ts`, `listMemberships.ts`, `updateMembership.ts`, `handlers/membership/listOrgMembers.ts` | No (reuses existing `membership-status-middleware.ts` helpers read-only) | Single truth policy: compute-on-read + recompute-on-write |
| FIX-003 | Added module-local `assertRecordInCallerOrg(ctx, record.organizationId, label)` guard (modeled on `getMembership.ts:28-30`) after the not-found check in all 10 lifecycle mutations | NEW `utils/assert-record-org.ts`; `approveMembershipApplication.ts`, `denyMembershipApplication.ts`, `resignMembership.ts`, `terminateMembership.ts`, `deceaseMembership.ts`, `reinstateMembership.ts`, `renewMembership.ts`, `updateMembership.ts`, `deleteMembership.ts`, `updateMembershipApplication.ts` | No | No-op when caller has no org context (platform-admin surfaces) or record has no org; throws `ForbiddenError` (403) on mismatch |
| FIX-004 | Object-level authorization: allow read if owner (`application.personId === user.id`) OR same-org (`application.organizationId === ctx.organizationId`); else `ForbiddenError` | `getMembershipApplication.ts` | No | Closes the IDOR; route's `user:owner` ownership decision now actually enforced in the handler |
| FIX-013 | `createMembershipApplication`: tier must belong to caller org (`tier.organizationId === orgId`), surfaced as `NotFoundError` to avoid leaking foreign-tier existence. `updateMembershipApplication`: strip `personId` / `organizationId` from the update body before forwarding to the repo (identity-field lock) | `createMembershipApplication.ts`, `updateMembershipApplication.ts` | No | Handler-layer identity strip avoids generated-file churn (`[deferred]` TypeSpec regen). Create personId self-binding NOT enforced — see §10. |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `jobs/statusRecomputeCron.integration.test.ts` (NEW) | integration / data-schema | Cron runs against the REAL `membership` columns (no phantom cols) and corrects a stale `active`→`lapsed`; leaves a still-active row untouched. A mock cannot catch the SQL/schema mismatch. | FIX-001 |
| `getMembership.consistency.test.ts` (NEW) | integration / regression | getMembership & listMemberships compute status on read (not stale cache); updateMembership recomputes the cached status when `duesExpiryDate` changes; computed status matches the canonical fn for a deceased member (and the OLD listOrgMembers omission would have mis-reported) | FIX-002 |
| `crossOrgGuard.test.ts` (NEW) | permission/RBAC + regression | 10-mutation cross-org 403 matrix (resign/terminate/decease/reinstate/renew/delete/update/approve/deny/updateApplication) + 1 positive control (same-org passes) | FIX-003 |
| `getMembershipApplication.test.ts` (NEW) | permission/RBAC | Foreign authenticated user → 403; owner → 200; same-org caller → 200 | FIX-004 |
| `createMembershipApplication.integrity.test.ts` (NEW) | backend/unit | Foreign-org tier create rejected; same-org tier create succeeds; update does not forward personId/organizationId to the repo | FIX-013 |
| `resignMembership.test.ts` (UPDATED) | backend/unit | Fixture org aligned to ctx default (`tenant-1`) so the new FIX-003 same-org guard is satisfied; event-org assertion updated to match | FIX-003 |
| `deceaseMembership.test.ts` (UPDATED) | backend/unit | Same fixture-org alignment + event-org assertion update | FIX-003 |
| `reinstateMembership.test.ts` (UPDATED) | backend/unit | Fixture org aligned to `tenant-1` | FIX-003 |
| `approveMembershipApplication.test.ts` (UPDATED) | backend/unit | Fixture org aligned to `tenant-1` + created-membership-org assertion update | FIX-003 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/member/membership/jobs/statusRecomputeCron.integration.test.ts` | Passed (2/2) | RED first (`column "is_expired" does not exist`), then GREEN after SQL repair |
| `bun test src/handlers/member/membership/getMembership.consistency.test.ts` | Passed (4/4) | RED-proven by temporary revert |
| `bun test src/handlers/member/membership/crossOrgGuard.test.ts` | Passed (11/11) | RED first (10 fail), GREEN after guards |
| `bun test src/handlers/member/membership/getMembershipApplication.test.ts` | Passed (3/3) | RED first (foreign-user case), GREEN after authz |
| `bun test src/handlers/member/membership/createMembershipApplication.integrity.test.ts` | Passed (3/3) | RED first (2 fail), GREEN after tier-org + identity-lock |
| All 5 new test files together | Passed (23/23) | — |
| `bun test src/handlers/member/membership/` (full module) | Passed (598/598 across 31 files) | Up from 581 baseline; 4 existing test files updated for fixture-org alignment, 0 regressions |
| `bun test src/handlers/membership/` (legacy dir incl. listOrgMembers) | Passed (41/41 across 6 files) | FIX-002 listOrgMembers change verified |
| `bunx tsc --noEmit` (entire api-ts workspace) | Passed | 0 TypeScript errors repo-wide |

## 7. Validation Summary

- **Passed:** All 23 new tests; full membership module (598/598); legacy membership dir (41/41); repo-wide typecheck (0 errors). Each fix followed RED→GREEN; FIX-001 and FIX-002 were additionally RED-proven (FIX-001 against the live Postgres schema; FIX-002 by temporary handler revert).
- **Failed:** None.
- **Not run:** Full repo test suite (intentionally — too slow per 04 §11; ran the new tests, the touched module, the legacy dir, and a full typecheck instead). Hurl contract suite not run (requires a booted API; the changed surfaces are covered by unit/integration tests; no contract scenarios were added in this batch).
- **Blocked:** None for Batch A/B.
- **Pre-existing/unrelated failures:** None observed. The 4 existing test-file edits were fixture-org alignments caused by the new FIX-003 guard (the fixtures used `org-1` while `makeCtx` defaults the caller org to `tenant-1` — a pre-existing mismatch that was harmless before the guard); no assertions were weakened, only the org value was made consistent and two event-org assertions updated to track the fixture.

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| `computeMembershipStatus` (pure util) | `utils/compute-membership-status.ts` | Most-imported mega-module util (elections, governance, credentials, dues, marketplace, booking, email) | Not modified | Signature UNCHANGED (frozen additive-only contract honored). FIX-001/002 only change inputs fed to it, never the function. |
| `membership` table | `association:member/repos/membership.schema.ts` | Seeds, ports, events, many handlers | Not modified | No columns added, no migration. FIX-001 reads only real columns. |
| `membership-status-middleware.ts` (`withComputedStatus` / `persistWithComputedStatus`) | `utils/membership-status-middleware.ts` | Membership lifecycle handlers | Used read-only (not modified) | FIX-002 reuses existing helpers |
| Legacy officer surface | `handlers/membership/listOrgMembers.ts` | Officer dashboards (`GET /members/{orgId}`) | `handlers/membership/` suite (41 tests) pass | FIX-002: added `dateOfDeath` to SELECT + compute inputs; module-local read-consistency, not a shared-base change |

No shared/platform base methods (`core/database.repo.ts`, middleware, generated files) were modified. `[SHARED DEPENDENCY]` and `[CROSS-MODULE RISK]` items from the fix-ready plan (resigned_at migration, soft-delete base method) were NOT touched — they belong to Batch E2/F.

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| `createMembershipApplication` does not bind `body.personId` to the session user | FIX-013 (G-15) partial | Enforcing self-only would break the legitimate officer-on-behalf create flow — a product decision, not a clear bug | `[NEEDS PRODUCT DECISION]`: decide self-apply vs officer-on-behalf; if officer-on-behalf, gate `personId != user.id` behind an officer/position check |
| TypeSpec update-application body still exposes `personId` / `organizationId` | FIX-013 (G-15) | Identity strip enforced at handler layer; generated-file regen deliberately deferred to keep this pass free of generated churn | Optional follow-up: remove the fields from `membership.tsp` update request, then `bun run build` + `bun run generate` |
| Spec §16 performance assertions (roster <500ms, import <30s) | fix-ready §9 | `[BLOCKED BY ENVIRONMENT]` — no load harness in this pass | Verify in a dedicated perf pass |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Batch E2 — state-machine integrity (FIX-007 handler, FIX-008, FIX-009, FIX-010, FIX-011) | `[NEEDS PRODUCT DECISION]` | Six unresolved product decisions (reinstate semantics, RESIGNED actor, EXPIRED threshold, expulsion-V1, re-application strategy, delete-op existence) — fix-ready §8 | Product decisions, then a separate `04` pass |
| Batch F — `resigned_at` (and later `expelled_at`) additive migration + backfill | `[SHARED DEPENDENCY]` (database/schema) | Additive column on heavily shared `membership` table; must land before E2 handler wiring | Migration designed + reviewed |
| Invoice-generation half of G-07 (FIX-005 invoice side) | `[CROSS-MODULE RISK]` / `[NEEDS CONFIRMATION]` | Belongs partly to the dues-payments audit (next in queue) | dues-payments audit + the m05 §13 [VERIFY] confirmation |
| createMembershipApplication personId self-binding | `[NEEDS PRODUCT DECISION]` | Officer-on-behalf vs self-apply is a product choice | See §9 |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Batch C (FIX-005 event emit, FIX-006 history writes, FIX-012 dup-filter, FIX-014 renew billing-cycle, FIX-015 tier-delete gate, FIX-016 import hardening, FIX-017 q-search, FIX-018 FE status union, FIX-020 grace range) | (later batch) | Out of the selected Batch A/B scope; run after A/B land |
| Batch D-docs (FIX-019 doc sync) | (later batch) | STATE_MACHINES reconciliation depends on §8 product decisions |
| Batch E2 / F (FIX-007/008/009/010/011) | `[NEEDS PRODUCT DECISION]` / `[SHARED DEPENDENCY]` | Blocked — see §10 |
| CSV import wizard UI, PRC license normalization, LAPSED→EXPIRED automation, expulsion workflow, underReview/waitlisted sub-states, status-history read UI, metrics suite | `V2 DEFERRED` | Out of V1 scope per fix-ready §10 |
| Feature flags, schema relocation, legacy `/membership/*` merge, `computeMembershipStatus` rewrite, `core/database.repo.ts` base-method change, blanket test backfill | `DO NOT ADD` / `[DO NOT OVERBUILD]` | Explicitly prohibited by fix-ready §11 |
| Migrate inline `requirePosition` to `x-require-position` extension | `[DO NOT OVERBUILD]` | Behavior correct today; opportunistic-only |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/member/membership/jobs/statusRecomputeCron.ts` | Removed phantom cols from SELECT; derive pendingPayment from stored status; keyset pagination | FIX-001 |
| `services/api-ts/src/handlers/member/membership/jobs/statusRecomputeCron.integration.test.ts` | NEW real-Postgres integration test | FIX-001 |
| `services/api-ts/src/handlers/member/membership/getMembership.ts` | Wrap result with `withComputedStatus` | FIX-002 |
| `services/api-ts/src/handlers/member/membership/listMemberships.ts` | Map rows through `withComputedStatus` | FIX-002 |
| `services/api-ts/src/handlers/member/membership/updateMembership.ts` | Route write through `persistWithComputedStatus`; respond with computed status; + FIX-003 guard | FIX-002, FIX-003 |
| `services/api-ts/src/handlers/membership/listOrgMembers.ts` | Add `dateOfDeath` to SELECT + compute inputs | FIX-002 |
| `services/api-ts/src/handlers/member/membership/getMembership.consistency.test.ts` | NEW read-consistency test | FIX-002 |
| `services/api-ts/src/handlers/member/membership/utils/assert-record-org.ts` | NEW cross-org guard helper | FIX-003 |
| `services/api-ts/src/handlers/member/membership/{approve,deny}MembershipApplication.ts` | Add cross-org guard | FIX-003 |
| `services/api-ts/src/handlers/member/membership/{resign,terminate,decease,reinstate,renew,delete}Membership.ts` | Add cross-org guard | FIX-003 |
| `services/api-ts/src/handlers/member/membership/updateMembershipApplication.ts` | Add cross-org guard + strip identity fields | FIX-003, FIX-013 |
| `services/api-ts/src/handlers/member/membership/crossOrgGuard.test.ts` | NEW cross-org 403 matrix | FIX-003 |
| `services/api-ts/src/handlers/member/membership/{resign,decease,reinstate}Membership.test.ts`, `approveMembershipApplication.test.ts` | Fixture-org alignment for the new guard | FIX-003 |
| `services/api-ts/src/handlers/member/membership/getMembershipApplication.ts` | Object-level authorization (owner OR same-org) | FIX-004 |
| `services/api-ts/src/handlers/member/membership/getMembershipApplication.test.ts` | NEW IDOR test | FIX-004 |
| `services/api-ts/src/handlers/member/membership/createMembershipApplication.ts` | Tier must belong to caller org | FIX-013 |
| `services/api-ts/src/handlers/member/membership/createMembershipApplication.integrity.test.ts` | NEW integrity test | FIX-013 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| Live-DB column proof | Queried `information_schema.columns` on the running `monobase` Postgres: `membership` has NO `is_expired` / `is_pending_payment` (only id, …, dues_expiry_date, grace_period_days, status, joined_at, note, suspended_at, date_of_death, removed_at, removal_reason). Captured in this report §3. | FIX-001 |
| RED test output | `error: column "is_expired" does not exist` (Postgres 42703) before the SQL repair; `2 pass` after. Captured in §6. | FIX-001 |
| RED-by-revert proof | Temporarily reverted `withComputedStatus` in `getMembership.ts` → `3 pass, 1 fail`; restored → `4 pass`. Captured in §3/§6. | FIX-002 |
| Test run logs | All commands + pass/fail counts recorded in §6 (no separate evidence files created — inline per 04 anti-waste). | all |

## 14. Completion Decision

**PARTIALLY COMPLETE**

Batch A (FIX-001, FIX-002) is fully COMPLETE: the P0 nightly-recompute bug is fixed and proven against the live Postgres schema, and the single status-truth policy is applied across all read/write surfaces with passing regression. Batch B's FIX-003 (cross-org mutation guards) and FIX-004 (application IDOR) are fully COMPLETE with RED→GREEN coverage. FIX-013 is PARTIALLY FIXED: the two unambiguous integrity bugs (tier-org binding on create, identity-field lock on update) are done, but the `createMembershipApplication` personId self-binding is intentionally left as `[NEEDS PRODUCT DECISION]` (officer-on-behalf flow) rather than guessed. All relevant validation passed (598/598 module tests, 41/41 legacy, 0 typecheck errors); no regressions; no schema/shared-base changes; `computeMembershipStatus` signature untouched. The overall decision is PARTIALLY COMPLETE only because of the one deferred FIX-013 sub-item that requires a product decision — every other selected fix landed and is verified.

## 15. Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for **Batch C — P2/P3 workflow completeness** (FIX-005 event emit, FIX-006 history writes, FIX-012, FIX-014, FIX-015, FIX-016, FIX-017, FIX-018, FIX-020), which is independent and unblocked now that Batch A and B have landed. Keep Batch E2/F deferred until the six §8 product decisions are made (request product decision). The single FIX-013 remainder (create personId self-binding) should be folded into the product-decision request.

- Exact prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
- Input fix-ready plan: `docs/aha/module-fix-plans/membership-lifecycle-fix-ready-plan.md`
- Recommended batch: **Batch C — P2/P3 workflow completeness**
- Before Batch E2: request the six product decisions in fix-ready §8 (plus the FIX-013 personId-binding decision).

---

# Batch F + E2 (2026-06-12)

> This section records a later `04` TDD pass that executed **Batch F** (the
> `resigned_at` additive migration) and **Batch E2** (state-machine integrity:
> FIX-007, FIX-008, FIX-009, FIX-010, FIX-011, FIX-019), plus the previously
> deferred **FIX-013** sub-item. These were unblocked by the six §8 product
> decisions RESOLVED 2026-06-12 (fix-ready-plan §"Product Decisions — RESOLVED").

## 1. Fix Scope

| Item | Details |
|---|---|
| Batch executed | **Batch F** (resigned_at migration) + **Batch E2** (FIX-007/008/009/010/011/019) + **FIX-013** completion |
| Fix date | 2026-06-12 |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked before tests; RED-first per fix) |
| Driving decisions | The six RESOLVED §8 decisions: reinstate=lapsed-only; resign=officer-only; EXPIRED dropped from V1; expulsion deferred to V2; re-application=reuse-row; delete\*=remove officer op |
| Schema/migration touched | Yes — additive only: `0065_membership_resigned_at` (column + backfill), `0066_audit_action_suspend_unsuspend` (enum values). No renames, no index change, no `expelled_at`, no EXPIRED automation |
| TypeSpec touched | Yes — removed `deleteMembership`/`deleteMembershipApplication` ops; added `suspendMembership`/`unsuspendMembership` ops + `MembershipSuspendRequest`; reinstate `@doc` → lapsed-only. Regenerated (never hand-edited generated files) |
| `computeMembershipStatus` | Signature UNCHANGED (already additive-ready: `resignedAt`/`expelledAt`/`isExpired` were pre-existing optional inputs) |

## 2. Fixes Selected

| Fix ID | Gap | Decision | Status |
|---|---|---|---|
| Batch F | `resigned_at` column missing; a resignation could not survive a status recompute | R-5 / additive migration + backfill from `removed_at` where status='resigned' | **Fixed** |
| FIX-007 | `resignMembership` stamped `removed_at` (not `resigned_at`) → recompute decayed status to `removed`; reinstate could resurrect terminal | resign stamps `resigned_at`; reinstate rejects terminal (#1/#2) | **Fixed** |
| FIX-008 | Reinstate allowlist (`removed`+`suspended`) contradicted m05/WF-035 and the transitions matrix | reinstate = **lapsed-only**; all 4 artifacts aligned (#1) | **Fixed** |
| FIX-009 | No dedicated suspend/unsuspend ops; suspended exit went through reinstate | add `suspendMembership` + `unsuspendMembership` ops only — no EXPIRED/expel siblings (#3/#4) | **Fixed** |
| FIX-010 | Terminal member re-applies → approve unconditionally `createOne` → `(org,person)` unique-violation 500 | reuse-row: flip the existing row to `pendingPayment` + status-history; conflict→409 for in-standing (#5) | **Fixed** |
| FIX-011 | Officer-facing hard-delete destroys financial+audit history (FK RESTRICT 500s anyway) | remove `deleteMembership`/`deleteMembershipApplication` ops from the officer surface (#6) | **Fixed** |
| FIX-019 | `STATE_MACHINES.md` §1 claimed EXPIRED-auto, RESIGNED self-service, "new record" re-entry | reconcile to decided semantics | **Fixed** |
| FIX-013 (remainder) | `createMembershipApplication` did not bind `body.personId` to the caller → self-apply-as-other IDOR | gate `personId != user.id` behind an officer position check (conservative engineering default; preserves officer-on-behalf) | **Fixed** |

## 3. Baseline Before Changes (post F-3/F-5 session)

- Full `bun test` (api-ts) = **6009 pass / 1 fail / 4 todo** (the 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs > registers email.processor as interval job`, interval 30000 vs 1000).
- Full monorepo `tsc` = **0 errors** (ui/admin/sdk-ts/api-ts/memberry).
- Hurl = **152–153/155** (pre-existing: impersonation 403→400, platformadmin committees 403→200, `member/governance/position-crud.hurl` flaky/intermittent).
- DB migrated through `0064` + seeded. Live `membership` had NO `resigned_at` column.

## 4. Changes Made

- **Batch F:** added `resigned_at timestamptz NULL` to `membership.schema.ts`; hand-authored idempotent migration `0065_membership_resigned_at.sql` (`ADD COLUMN IF NOT EXISTS` + `UPDATE … SET resigned_at = removed_at WHERE status='resigned' AND resigned_at IS NULL`) following the repo's established hand-written-migration pattern (drizzle-kit generate is unavailable here — see 0061–0064); journal entry 65; applied to the live DB.
- **FIX-007:** `resignMembership.ts` now stamps `resignedAt` (not `removedAt`).
- **FIX-008:** `reinstateMembership.ts` allowlist → `['lapsed']`; restores standing via `computeNewExpiry` (BR-07, resets from today for severe lapse → computed `active`). Four artifacts aligned: handler, `status-transitions.ts` (doc reconciled — the matrix already encoded terminal-irreversibility + lapsed→active; the old handler was the violator), `membership.tsp` reinstate `@doc`, `STATE_MACHINES.md`.
- **FIX-009:** new `suspendMembership.ts` (active/grace/lapsed → suspended) + `unsuspendMembership.ts` (suspended → recomputed standing). New TypeSpec ops + `MembershipSuspendRequest`. Dedicated audit actions `suspend`/`unsuspend` added to the `audit_action` enum (`0066`) + the three TS action unions (`per-route-audit.ts`, `core/audit/audit-action.ts`, `core/audit.ts`).
- **FIX-010:** `approveMembershipApplication.ts` now `findByPersonAndOrg` before insert — reuses a terminal/lapsed/expired/removed row (UPDATE to `pendingPayment` + clear flags + `membership_status_history` row) and returns `409 ConflictError` for an in-standing existing membership (no raw 500).
- **FIX-011:** removed the two delete ops from `membership.tsp`; regenerated routes/validators/registry + SDK; deleted the orphaned `deleteMembership.ts`/`deleteMembershipApplication.ts` handlers; updated `crossOrgGuard.test.ts` + the two Hurl contracts that exercised the removed ops.
- **FIX-019:** `STATE_MACHINES.md` §1 rewritten — reinstate lapsed-only, suspend/unsuspend, terminal-irreversible re-entry via reuse-row, EXPIRED removed from V1, expulsion deferred to V2.
- **FIX-013:** `createMembershipApplication.ts` gates on-behalf creation behind `requirePosition([SECRETARY, PRESIDENT])`.

## 5. Tests Added / Updated

- NEW `resignedAtBackfill.integration.test.ts` — real-Postgres data test (mirrors the FIX-001 pattern): asserts the column exists + is nullable on `public.membership`, the backfill copies `removed_at`→`resigned_at` for resigned rows only, and is idempotent. (RED before the migration; GREEN after.)
- `resignMembership.test.ts` — rewrote the `removedAt` assertion to `resignedAt`; added a "survives recompute as resigned" test (FIX-007).
- `reinstateMembership.test.ts` — rewritten for lapsed-only: lapsed→active succeeds + expiry pushed to future; removed/resigned/deceased/suspended/active/grace/pending all reject.
- NEW `suspendMembership.test.ts` / `unsuspendMembership.test.ts` (FIX-009).
- `approveMembershipApplication.test.ts` — added reuse-row + conflict-not-500 tests (FIX-010); added `findByPersonAndOrg: null` to the existing create-path stubs.
- `crossOrgGuard.test.ts` — removed the `deleteMembership` import + case (FIX-011).
- `createMembershipApplication.integrity.test.ts` — added self-apply-allowed / on-behalf-rejected / officer-on-behalf-allowed (FIX-013).
- Hurl: `application-approval-flow.hurl` (+FIX-010 re-application → 409 scenario); `membership-lifecycle.hurl` (resign→reinstate now 422, status persists `resigned`); `application-deny-bulk.hurl` + `terminate-decease-flow.hurl` (removed-op DELETE now asserts `status >= 400`; deny-bulk restructured to officer-on-behalf creation).

## 6. Tests Run

- Per-fix RED→GREEN verified for every fix (RED captured before each implementation; e.g., Batch F Part A `expect(rowCount).toBe(1)` got `0` before the migration → `1` after).
- Membership module: **619 pass / 0 fail** (34 files).
- Full `bun test` (api-ts): **6030 pass / 1 fail / 4 todo** — delta `+21` tests vs baseline; the 1 fail is the same PRE-EXISTING unrelated `registerEmailJobs` interval test.
- `tsc` (all 5 workspaces): **0 errors**.
- F-2 `generated-route-integrity.test.ts`: **12 pass**.
- `check:sdk-compat`: exit 1 (expected) — `+suspendMembership`/`+unsuspendMembership` are additive (non-blocking); `-deleteMembership`/`-deleteMembershipApplication` are the intentional FIX-011 breaking removals. The other 22 "changed" entries (marketplace/jobs/advertising path moves) are PRE-EXISTING baseline drift, untouched by this pass. Baseline **NOT** refreshed (frozen until milestone Step 6).
- Hurl (live API on :7213, migrations applied on boot): **152/155** — the 3 failures are exactly the known pre-existing flakies (impersonation, position-crud, platformadmin). The 4 touched membership contracts pass.

## 7. Validation Summary

All in-scope fixes landed and are verified RED→GREEN with no regressions. Test count up `+21`; the only failing api-ts test and the only 3 failing Hurl files are pre-existing and unrelated. Type safety holds across every workspace. Migrations are additive and were proven against the live schema.

## 8. Shared / Cross-Module / Database Impact

- `membership` table: additive `resigned_at` only; the unique index and all other columns are untouched. `computeMembershipStatus` (the mega-module's most-imported util) signature unchanged.
- `audit_action` enum: two additive values (`suspend`, `unsuspend`).
- SDK surface: `suspendMembership`/`unsuspendMembership` added; `deleteMembership`/`deleteMembershipApplication` removed. No app or SDK code consumed the removed ops (verified by grep), so no app breakage.
- `membership_status_history` now receives a row on reuse-row re-application (pre-existing table; additive use).

## 9. Remaining Gaps

- The reuse-row→200 (terminal re-application) path is fully covered by unit tests; the Hurl contract covers the conflict-not-500 (in-standing) branch only, because a membership id cannot be retrieved by person through the public API inside a Hurl flow.
- Dedicated suspend/unsuspend frontend UI (FIX-018 badge/labels) is Batch C / frontend scope, not done here.

## 10. Blocked Items

None remain for Batch E2/F — all six gating decisions were resolved and implemented.

## 11. Deferred / Not Implemented (by decision)

- **EXPIRED** state automation (decision #3) — enum value retained, no threshold/job; dropped from V1 vocabulary.
- **Expulsion / `expelled_at`** (decision #4) — deferred to V2; `createDisciplinaryAction` stays unrouted.
- **Member self-resign route/UI** (decision #2) — V1 is officer-recorded only.
- **Unique-index change** (decision #5) — not made; reuse-row keeps one canonical row per `(org, person)`.
- Adjacent "applications without accounts" §8 item — recommend accept account-first + amend spec (not implemented here).

## 12. Files Changed

- Schema/migrations: `membership.schema.ts`, `audit.schema.ts`, `0065_membership_resigned_at.sql`, `0066_audit_action_suspend_unsuspend.sql`, `meta/_journal.json`.
- Handlers: `resignMembership.ts`, `reinstateMembership.ts`, `suspendMembership.ts` (new), `unsuspendMembership.ts` (new), `approveMembershipApplication.ts`, `createMembershipApplication.ts`; deleted `deleteMembership.ts`, `deleteMembershipApplication.ts`.
- Utils/middleware/core: `utils/status-transitions.ts`, `middleware/per-route-audit.ts`, `core/audit/audit-action.ts`, `core/audit.ts`.
- TypeSpec + regenerated: `specs/api/src/association/member/membership.tsp` → regenerated `generated/openapi/*` (api-ts) + `packages/sdk-ts/src/generated/*` + `specs/api/dist`.
- Docs: `docs/product/STATE_MACHINES.md`.
- Tests: the membership test files listed in §5 + the 4 Hurl contracts.

## 13. Evidence Saved

- Batch F RED: `expect(received).toBe(expected) Expected: 1 Received: 0` (column absent) → GREEN `3 pass` after migration. Live-DB enum proof: `enum_range(NULL::audit_action)` now contains `suspend`,`unsuspend`.
- FIX-013 root-cause trace (peeled a layer): the deny-bulk Hurl 403 was a pre-existing cookie-jar bleed (request authenticated as applicant B while submitting `personId`=A) that FIX-013 correctly rejects as on-behalf — confirmed via `hurl --verbose` showing the mismatched `session_token` vs body `personId`. Fixed the contract to officer-on-behalf creation.
- All counts captured inline in §6 (per 04 anti-waste — no separate evidence files).

## 14. Completion Decision

**COMPLETE.** Batch F + all of Batch E2 (FIX-007/008/009/010/011/019) and the FIX-013 remainder are implemented, verified RED→GREEN, and free of regressions (6030/1/4, tsc 0, F-2 12/12, Hurl 152/155 = baseline, check:sdk-compat breaking entries all intentional/pre-existing). All schema changes are additive; the frozen SDK baseline was not refreshed.

## 15. Recommended Next Step

Run a dedicated **product-decision pass** to clear the remaining ~106 gated decisions across the other modules — prioritize the P0/P1 ones: elections G2 position-identity (P0), training paid-training/manual-entry, person gender-scrub Q-4, documents Q8/cert — then per-module `04` passes, then re-run `07-consolidate-roadmap.md`. Membership Batch C (FIX-005/006/012/014/015/016/017/018/020) remains independently unblocked and can be scheduled any time. Note: a live API instance from this pass is running on `:7213`; the frozen `check:sdk-compat` baseline still must NOT be `--update`d until milestone Step 6.

---

# Batch C — P2/P3 workflow completeness (2026-06-12)

> This section records the `04` TDD pass that executed **Batch C** (fix-ready §4),
> the last decision-free membership batch. Every fix was driven RED→GREEN against
> the module's existing mock-based handler-test harness (`makeCtx`/`stubRepo`).
> The only Track-A item still open afterward is none — Batch C completes the
> membership module's decision-free work. Batch E2/F already landed (see prior section).

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Membership Lifecycle |
| Module slug | membership-lifecycle |
| Fix date | 2026-06-12 |
| Batch executed | **Batch C** — FIX-005, FIX-006, FIX-012, FIX-014, FIX-015, FIX-016, FIX-017, FIX-018, FIX-020 |
| Superpowers used | Yes (`superpowers:test-driven-development` — RED-first per fix) |
| Working tree status checked | Yes — pre-existing dirty tree (~225 files from prior AHA passes) preserved; only Batch-C lines touched |
| Fix scope | selected P2 (FIX-005/006 are P1 emit/audit; FIX-012/014/015/016 P2) + selected P3 (FIX-017/018/020) — all V1 REQUIRED / V1 RECOMMENDED |
| Out of scope | Batch E2/F (done in prior pass), Batch D-docs, all V2 DEFERRED / DO NOT ADD; the **email-match-link half of FIX-016** (deferred — see §11) |
| Shared files touched | Yes — `src/test-utils/make-ctx.ts` (test-only, additive `insert` capture) |
| Schema/migration touched | No DB migration. TypeSpec only (FIX-020 `@minValue/@maxValue` → regen) |
| Limitations | Mock-based handler harness (module convention) — assertions verify real handler behavior (event emitted, history row written, filter widened, billing-cycle honored), not mock internals. Real-DB proof for these P2/P3 items deferred to the existing integration tests. |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Status |
| --- | --- | --- | --- | --- | --- |
| FIX-005 | G-07: approve emits no `membership.created` → welcome consumer never fires on the main funnel | P1 | V1 REQUIRED | C | Fixed |
| FIX-006 | G-08: officer transitions (resign/terminate/decease/reinstate/renew) write no `membership_status_history` rows | P1 | V1 REQUIRED | C | Fixed |
| FIX-012 | G-11: duplicate-application check filtered only `submitted` (missed `underReview`) | P2 | V1 RECOMMENDED | C | Fixed |
| FIX-014 | G-16: `renewMembership` hardcoded +1 year, ignoring org `billingFrequency` | P2 | V1 RECOMMENDED | C | Fixed |
| FIX-015 | G-18: `deleteMembershipTier` lacked the BR-04 member-assignment gate (FK 500) | P2 | V1 RECOMMENDED | C | Fixed |
| FIX-016 | G-13/14: bulk import had no row cap, no per-row validation, no email-match link | P2 | V1 RECOMMENDED | C | **Partially Fixed** (cap + per-row validation; email-match deferred — §11) |
| FIX-017 | §12: `q` roster-search filter declared but built no condition (silent no-op) | P3 | V1 RECOMMENDED | C | Fixed |
| FIX-018 | §11: frontend `MemberStatus` union lacked resigned/deceased → terminal members rendered the wrong badge | P3 | V1 RECOMMENDED | C | Fixed |
| FIX-020 | BR-02: `gracePeriodDays` had no 0–90 range validation | P3 | V1 RECOMMENDED | C | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `approveMembershipApplication.test.ts` (new emit test) | RED — `evt` undefined (no emit) | FIX-005 | Watched fail before impl |
| `resign/terminate/decease/reinstate` history test | RED — `_inserted` empty | FIX-006 | 3 watched fail (terminate/decease/reinstate); resign verified via specific assertions |
| `createMembershipApplication.integrity` underReview dup | RED — no ConflictError (handler queried only `submitted`) | FIX-012 | Watched fail |
| `deleteMembershipTier.test.ts` gate | RED — 204 instead of ConflictError | FIX-015 | Watched fail |
| `importRosterMembers.test.ts` cap + per-row | RED — 200/imported-2 instead of 400/failed-1 | FIX-016 | Watched fail |
| `membership.repo.test.ts` q-condition | RED — `build({q})` returned undefined | FIX-017 | Watched fail |
| `gracePeriodDays.validation.test.ts` | RED — 200 accepted (no bounds) | FIX-020 | Watched fail before TypeSpec regen |
| `member-detail.test.tsx` resigned/deceased badge | RED — "Unable to find text: Resigned/Deceased" (fell back to Pending Payment) | FIX-018 | Watched fail |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared? | Notes |
| --- | --- | --- | --- | --- |
| FIX-005 | Capture the new/reused membership id in both approve branches; emit `membership.created` `{membershipId, personId, organizationId, source:'application'}` after commit (consumer unchanged) | `approveMembershipApplication.ts` | No | Mirrors `claimInvite.ts:118` |
| FIX-006 | Write a `membership_status_history` row (fromStatus = computed pre-change status, toStatus, reason, changedBy = officer, changedAt) in each of resign/terminate/decease/reinstate/renew; atomic inside the existing tx where one exists | `resign/terminate/decease/reinstate/renewMembership.ts` | No | personId-guarded (notNull FK) |
| FIX-012 | Widen the duplicate-application check to ANY pre-decision status (`submitted` + `underReview`) | `createMembershipApplication.ts` | No | Handler-local loop; no repo-type change |
| FIX-014 | Replace hardcoded +1 year with `computeNewExpiry({currentExpiry, billingCycle: toBillingCycle(duesConfig?.billingFrequency)})` (lazy DuesRepository import, no circular dep) | `renewMembership.ts` | No | Renewal now agrees with payment-settlement math |
| FIX-015 | New `MembershipTierRepository.countMembersInTier`; gate `deleteMembershipTier` → friendly 409 when members assigned | `membership.repo.ts`, `deleteMembershipTier.ts` | No | Replaces raw FK 500 |
| FIX-016 | Row cap (500, spec §16) → 400; per-row required-field validation → structured `{index,error}` | `importRosterMembers.ts` | No | Email-match link deferred — §11 |
| FIX-017 | Add `q` → `ilike(memberships.memberNumber, %q%)` in `MembershipRepository.buildWhereConditions` | `membership.repo.ts` | No | Person-name search stays in the hand-wired rich roster repo (no join in schema-only repo) |
| FIX-018 | Add `resigned` + `deceased` to `MemberStatus` union + `STATUS_BADGE` + `STATUS_BANNER` (NOT expired/expelled — decisions #3/#4) | `apps/memberry/.../member-detail.tsx` | No | |
| FIX-020 | `@minValue(0) @maxValue(90)` on `gracePeriodDays` in `MembershipCreateRequest` + `MembershipUpdateRequest` → regen | `specs/api/.../membership.tsp` → regenerated `generated/openapi/*` | `[SHARED DEPENDENCY]` (generated) | Regen via `specs/api build` + `api-ts generate`; never hand-edited generated files |
| (test infra) | Additive `insert(...).values()` capture + `_inserted` on `makeMockDb` | `src/test-utils/make-ctx.ts` | `[SHARED DEPENDENCY]` (test-only) | Additive; existing `transaction`/`update` unchanged; full suite confirms no regression |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Fix ID |
| --- | --- | --- | --- |
| `approveMembershipApplication.test.ts` (+2) | integration | `membership.created` emitted (new + re-application paths) | FIX-005 |
| `resign/terminate/decease/reinstate/renewMembership.test.ts` (+1 each) | backend/unit | status-history row written with correct from/to/changedBy | FIX-006 |
| `renewMembership.test.ts` (NEW, 7) | backend/unit | quarterly/annual/no-config billing-cycle + history + guards | FIX-014, FIX-006 |
| `createMembershipApplication.integrity.test.ts` (+2) | backend/unit | underReview + submitted duplicates both blocked | FIX-012 |
| `deleteMembershipTier.test.ts` (NEW, 4) | backend/unit | 409 when members assigned, 204 when none, guards | FIX-015 |
| `importRosterMembers.test.ts` (+2) | backend/unit | row cap → 400; per-row structured error | FIX-016 |
| `repos/membership.repo.test.ts` (NEW, 3) | data/schema | `q` builds a real WHERE condition | FIX-017 |
| `gracePeriodDays.validation.test.ts` (NEW, 5) | data/schema | create/update reject out-of-range, accept 0–90 | FIX-020 |
| `member-detail.test.tsx` (+2) | frontend/component | resigned/deceased render correct badge, not the fallback | FIX-018 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| Per-fix focused `bun test <file>` | Passed | RED captured before each impl; GREEN after |
| `bun test src/handlers/member/membership/` + repo test | **648 pass / 0 fail** | Full membership module |
| `bun test` (full api-ts) | **6059 pass / 1 fail / 4 todo** | +29 tests vs 6030 baseline; the 1 fail is the pre-existing unrelated `registerEmailJobs` interval test (30000 vs 1000) |
| `bun test apps/memberry/.../member-detail.test.tsx` (from root) | 9 pass / 0 fail | FIX-018 |
| `bun run --filter '*' typecheck` | **0 errors** (all 5 workspaces) | Matches baseline |

## 7. Validation Summary

All Batch-C fixes pass focused + module + full-suite tests with zero new failures; monorepo tsc is clean. The single full-suite failure (`registerEmailJobs`) is pre-existing and unrelated (documented in the baseline). The shared `makeMockDb` change is additive and confirmed regression-free across all 552 test files. TypeSpec regen (FIX-020) changed only the `gracePeriodDays` validators to `.gte(0).lte(90)`; no operation signatures changed, so SDK types and `check:sdk-compat` are unaffected (baseline still NOT refreshed, per milestone Step 6).

## 8. Shared / Cross-Module / Database Impact

| Area | Files | Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Test harness | `src/test-utils/make-ctx.ts` | All api-ts tests | Full suite 6059 pass | Additive `insert` capture only |
| Generated validators | `generated/openapi/*` (FIX-020 regen) | Membership create/update request validation | `gracePeriodDays.validation.test.ts` | Additive constraint; no op-shape change `[SHARED DEPENDENCY]` |
| DuesRepository (read) | lazy import in `renewMembership.ts` | Renewal reads org dues config | renew tests | Read-only; mirrors settlePayment pattern `[CROSS-MODULE RISK]` (low) |

## 9. Remaining Gaps

| Gap | Source | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| FIX-016 email-match link (existing-person dedupe by email) | G-13/14 | Import rows are personId-based; email matching needs an `email` field added to `AddMemberRequest` (TypeSpec) + a `persons.contactInfo->>'email'` JSONB lookup — larger than the row-cap/validation floor and not mock-testable | Add the import `email` field + person-by-email resolver in a follow-up (pairs naturally with the V2 CSV-import wizard) `[NEEDS PRODUCT DECISION]` (is email-keyed import a V1 need, or is personId-keyed sufficient for the pilot?) |

## 10. Blocked Items

None new. (Batch E2/F decisions already resolved + implemented in the prior pass.)

## 11. Deferred / Not Implemented

| Item | Label | Why |
| --- | --- | --- |
| FIX-016 email-match link | `[NEEDS PRODUCT DECISION]` | Needs a TypeSpec import-row `email` field + JSONB person lookup; out of the minimal cap+validation floor (see §9) |
| Full CSV import wizard UI, PRC license normalization | `V2 DEFERRED` | Per fix-ready §10 — backend floor first |
| `q` person-name (firstName/lastName) search in the schema-only repo | `[DO NOT OVERBUILD]` | The hand-wired rich roster repo already joins persons for name search; the generated repo correctly searches its own `member_number` only |

## 12. Files Changed

| File | Change | Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/member/membership/approveMembershipApplication.ts` | emit `membership.created` | FIX-005 |
| `.../resignMembership.ts`, `terminateMembership.ts`, `deceaseMembership.ts`, `reinstateMembership.ts`, `renewMembership.ts` | status-history write | FIX-006 |
| `.../renewMembership.ts` | billing-frequency-aware expiry | FIX-014 |
| `.../createMembershipApplication.ts` | pre-decision dup filter | FIX-012 |
| `.../deleteMembershipTier.ts` + `association:member/repos/membership.repo.ts` | tier-delete gate + `countMembersInTier` | FIX-015 |
| `.../importRosterMembers.ts` | row cap + per-row validation | FIX-016 |
| `association:member/repos/membership.repo.ts` | `q` → memberNumber ilike | FIX-017 |
| `apps/memberry/src/features/membership/components/member-detail.tsx` | resigned/deceased badge + banner | FIX-018 |
| `specs/api/src/association/member/membership.tsp` → regenerated `generated/openapi/*` | gracePeriodDays 0–90 | FIX-020 |
| `services/api-ts/src/test-utils/make-ctx.ts` | additive `insert` capture | (test infra) |
| + the 9 test files in §5 | tests | all |

## 13. Evidence Saved

- Per-fix RED captured inline before each implementation (e.g. FIX-005 `evt` undefined → defined; FIX-012 no-throw → ConflictError; FIX-020 `200 accepted` → rejected after regen; FIX-018 "Unable to find text: Resigned" → 9 pass). Counts captured inline in §6 (per 04 anti-waste — no separate evidence files).
- FIX-020 regen proof: `generated/openapi/validators.ts` MembershipCreate/UpdateRequestSchema `gracePeriodDays` now `z.number().int().gte(0).lte(90)`.

## 14. Completion Decision

**COMPLETE** (with one documented partial). All nine Batch-C fixes are implemented and verified RED→GREEN with zero regressions (membership module 648/0; full api-ts 6059/1/4 — the 1 pre-existing+unrelated; tsc 0 across all workspaces). FIX-016 is **Partially Fixed** by design: the row-cap + per-row-validation floor landed; the email-match-link half is deferred as it requires a TypeSpec schema field + product decision (§9/§11). This completes the membership-lifecycle module's entire decision-free (Track-A) scope; only the cross-module decision-gated work remains platform-wide.

## 15. Recommended Next Step

Per the consolidated roadmap (§8), proceed down the Track-A decision-free list with the next module's `04` pass — **elections-governance Batch B** (FIX-003 ballot secrecy + FIX-005 immutability, both decision-free). In parallel, resolve the 3 P0 product decisions (elections G2, documents Q1, realtime PD-1) to unblock the high-value gated passes. The frozen `check:sdk-compat` baseline still must NOT be `--update`d until milestone Step 6.

---

## Step 44 — Track B ratification (2026-06-13) — RATIFIED / CLOSED (doc-only, no code)

**Trigger.** The consolidated roadmap (§13/§18/§19) still named **Track B — Membership E2
state-machine ratification** as the open HALT, even though the fix-ready-plan recorded it
closed at Step 29. Step 29's closure was by **delegation** ("your call whats best"); the
E2/F state-machine had been implemented on engineering-chosen defaults (migrations 0065/0066)
but never *explicitly* product-ratified. This pass closes that gap.

**Action.** Re-presented TB-1…TB-5 to the user via `AskUserQuestion` — explicit, per-decision,
interactive ratification — with **TB-4 (expulsion)** flagged for an explicit V1-vs-V2 confirm
per the standing "2?" signal (it is the only item that would *add* member-facing capability
and reopen build via an E2.1 pass: `expelled_at` migration + routing `createDisciplinaryAction`
+ M04 disciplinary integration).

**Decisions captured (verbatim outcome).** All five **RATIFIED AS-IS** — identical to the
Step 29 eng defaults. No override.

| ID | Decision | Ratified outcome |
| --- | --- | --- |
| TB-1 | Reinstate semantics | **LAPSED-only** restorable; REMOVED (resigned/terminated/deceased) terminal + irreversible; SUSPENDED restored via dedicated unsuspend op. |
| TB-2 | RESIGNED actor | **Officer-recorded only (V1)**; no member self-resign route/UI. |
| TB-3 | EXPIRED threshold | **Dropped from V1 vocabulary**; LAPSED covers past-grace; no state, no job. |
| TB-4 | Expulsion-V1 ⚠️ | **Deferred to V2** (explicitly confirmed); `createDisciplinaryAction` stays unrouted; no `expelled_at`. |
| TB-5 | Re-application strategy | **Reuse existing `(org, person)` row**; re-approval transitions it back with a status-history write; no unique-index change. |

**Branch taken: Path (A) — Track B CLOSED, doc-only.** No code change, no migration, no new
`04` pass. The E2/F implementation already in the tree (this report's main body) is the
final, ratified behavior.

**Doc reconciliation (FIX-019).** Verified the terminal/reinstate vocabulary already agrees
across all three sources — **no edits required**:
- `docs/product/STATE_MACHINES.md` §1 (lines 48–54): EXPIRED dropped from V1, EXPELLED V2-deferred,
  reinstate LAPSED-ONLY, terminal = REMOVED/RESIGNED/DECEASED (+V2 EXPELLED), reuse-row re-application.
- `docs/product/MODULE_SPEC.member.membership.md`: lifecycle ops (resign/reinstate/terminate/decease)
  consistent; no contradicting EXPIRED/EXPELLED claims.
- `specs/api/src/association/member/membership.tsp`: `MembershipStatus` enum retains `expired`/`expelled`
  values, documented by STATE_MACHINES as V2-only definitions (not a contradiction).

**Roadmap updated.** §13 Track B → RATIFIED/CLOSED; §18 Roadmap Decision + §19 Immediate Next
Step rewritten so the lead gate is the 3 standing P0 product decisions (elections G2, documents
Q1, realtime PD-1), Track B removed from the open-gate list.

**Validation.** No code touched → no test/typecheck run needed for this pass; the E2/F GREEN
baseline in §6 (membership 648/0; api-ts 6059/1/4; tsc 0/5 workspaces) stands unchanged.

**Completion.** Track B is **CLOSED by explicit user ratification**. `expelled_at` / EXPIRED job /
member self-resign route remain **V2 DEFERRED** (roadmap §16). Next gates: the 3 standing P0
product decisions, then the P1 cluster — each its own `[NEEDS PRODUCT DECISION]` session. STOP.
