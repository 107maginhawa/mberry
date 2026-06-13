# AHA Fix-Ready Plan: Platform Admin (+ admin app)

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Platform Admin (+ admin app) |
| Module slug | platform-admin |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/platform-admin-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/platform-admin-fix-ready-plan.md` |
| Audit decision | FAIL |
| Superpowers used | No (not invoked; this is organize-only triage. `/using-superpowers` should be invoked by prompt 04 before implementation) |
| Organizer decision | PARTIALLY READY |
| Reason | The gap plan is high-quality and evidence-rich, and several P1 fixes are immediately TDD-able (G8 test rewrite, G4 invite claim, G14 test backfill). But the three biggest P1s are gated by product decisions: G1 (RBAC) is blocked by Q1 role-taxonomy, G2 (flag enforcement) by Q2 enforcement-point, G3 (impersonation) by Q3 identity-swap scope. Those cannot enter the active fix order until decided. The module is therefore fix-ready in part (test hardening + invite + MFA + cheap aligns) and blocked in part (RBAC + flags + impersonation + the UI block behind them). |
| Limitations | No server boot / live HTTP verification was available during audit ([BLOCKED BY ENVIRONMENT] for runtime confirmation of empty impersonate search and dashboard numbers). Broad RBAC layer is owned by a parallel auth-rbac audit; RBAC items here are scoped to platform-admin operations only. KG generated 2026-06-06 (5 days stale); all load-bearing claims were re-verified in code by the auditor and re-confirmed by this organizer (inviteAdmin random userId, no `admin.invited` consumer, impersonation-guard sets context + write-block only, memberry zero impersonation code). |

## 2. Fix Strategy Summary

**What to fix first:** Make the acceptance coverage honest, then ship the small, decision-free P1s. Batch D (test hardening) comes first because the AC suite is fake-green (G8) — it tests test-local helper functions, not production middleware/handlers — so every downstream fix is currently un-TDD-able. Rewriting `ac-m03` against real code plus backfilling the 10 uncovered handlers (G14) creates the RED baseline that makes the rest safe. With that baseline, the decision-free P1s — G4 (admin invite claim flow) and G5 (MFA enforcement) — and the cheap aligns (G13 spec sync, impersonate UI gate, G17 ticket sort) can land as honest TDD.

**What NOT to fix (now / ever):** Do not start G1 (RBAC tiers), G2 (flag enforcement), or G3 (impersonation slice) until their product decisions (Q1/Q2/Q3) are made — implementing them on guesses risks building the wrong permission matrix or the wrong impersonation model. Do not build the §23 wishlist (LaunchDarkly-style flag targeting, SLA analytics bars, configurable SLA matrices, impersonation extensions, mobile admin layouts, committee/national relocation). Do not migrate hand-wired routes (G7) or build UI screens (G6) before Q4 confirms which screens are V1.

**Major risks:** (a) G2 and G3 touch the global request pipeline (`app.ts` `app.use` chain) — must be isolated middleware with route-walk regression tests, never buried in module-local batches. (b) G5 touches Better-Auth config (shared). (c) G7 regenerates `routes.ts` + SDK — generated files must never be hand-edited. (d) G8 must land before G1/G5/G12 so those fixes are not validated against a fake-green suite.

**One pass or multiple:** Multiple batches. The module is too large and too decision-gated for one safe pass. Batch D runs now. Batches B-now (decision-free P1s) run next. The decision-gated P1s (G1/G2/G3) and the contract/UI block (G7/G6) are separate later passes after the Q1-Q4 decision session.

**Shared/platform/database work required:** Yes — G5 (Better-Auth twoFactor, shared), G7 (TypeSpec regen, shared pipeline), G2/G3 (global request pipeline, cross-module), and a likely G4 schema column (invite-claim token on `platform_admin`). These are isolated into Batches E and F.

**Product decisions / environment blockers:** Q1-Q4 block G1/G2/G3/G6. Runtime confirmations (Q6 impersonate search, dashboard scale) are [BLOCKED BY ENVIRONMENT] until a live run during the fix phase.

## 3. Active Fix Scope

Only P0/P1/selected P2 and V1 REQUIRED/selected V1 RECOMMENDED items. (No P0s in this module — backend skeleton is present; failures are P1 reliability/trust/permission/test gaps.) Decision-gated P1s are listed here as active scope but explicitly marked "execute only after decision" and routed to later batches; their blocking decisions are tracked in §8.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G8: AC test suite is fake-green — `ac-m03.platform-admin.test.ts` exercises test-local helpers (`impersonationAccessLevel`, `canAccessAdminPanel`) instead of real middleware/handlers for AC-M03-001/003/005/006/007 | P1 | V1 REQUIRED | D | Must land first: false confidence blocks safe TDD for every other P1; converts later fixes to honest RED→GREEN | `handlers/platformadmin/ac-m03.platform-admin.test.ts:99-216` |
| FIX-002 | G14: 10 handlers have no unit tests (`addTicketComment`, `cancelSubscription`, `getCommittee`, `getNationalChapterDetail`, `getTicket`, `listBreaches`, `listPricingTiers`, `listTickets`, `reportBreach`, `updateTicketStatus`) | P2 | V1 REQUIRED (pre-fix baseline) | D | Safe-fix baseline before touching G1/G12/G17 handlers; prevents silent regressions | `handlers/platformadmin/` dir listing |
| FIX-003 | G4: Admin invite dead end — `inviteAdmin` inserts `userId: crypto.randomUUID()`; `admin.invited` has no subscriber → no email, no claim, invitee can never pass `platformAdminAuthMiddleware.findByUserId` | P1 | V1 REQUIRED | B | Decision-free P1; PA-10 team management cannot onboard a second admin without it; root-cause fixable | `handlers/platformadmin/inviteAdmin.ts:39,51` (verified `crypto.randomUUID()`); `core/domain-events.registry.ts:471` (registry only, no consumer — verified) |
| FIX-004 | G5: MFA mandatory (M3-R7/AC-M03-006) not enforced anywhere in production code for platform admins | P1 | V1 REQUIRED | B (gate in middleware) + E (Better-Auth wiring) | Spec-mandated control absent on the most privileged accounts; decision-free (spec is explicit); test rewrite (FIX-001) covers the real assertion | grep `mfa\|twoFactor` in `middleware/platform-admin-auth.ts` + `handlers/platformadmin/`: empty; `middleware/platform-admin-auth.ts` is 42 LOC, membership-only (verified) |
| FIX-005 | G13: MODULE_SPEC §6 role names (`super/admin/support`) vs code enum (`super/support/analyst`) mismatch — spec-sync | P2 | V1 REQUIRED (decision-coupled) | B (doc/spec sync portion) | Cheap; must be settled to implement G1 correctly. The decision itself is Q1 (§8); the doc-sync execution is decision-free once Q1 lands | MODULE_SPEC §6 vs ROLE_PERMISSION_MATRIX vs `platform-admin.schema.ts` enum |
| FIX-006 | G17: `listTickets` sorts by `createdAt` only, not priority-then-age (PA-8 step 1) | P3→active | V1 RECOMMENDED | B | Low-risk one-liner; directly improves PA-8 inbox correctness; testable in isolation | `handlers/platformadmin/listTickets.ts:61` |
| FIX-007 | §5 last row: impersonate UI gated `['super']` but PRD + backend (`IMPERSONATION_ALLOWED_ROLES=['super','support']`) allow super+support | P3→active | V1 RECOMMENDED | B | Low-risk one-liner align; support tier currently locked out of a tool it is entitled to | `apps/admin/src/routes/impersonate/index.tsx:15`; `handlers/platformadmin/startImpersonation.ts` |
| FIX-008 | G1: Admin-tier RBAC not enforced on ~30 mutating handlers — only 9 check `callerAdmin.role`; analyst/support can mutate flags, orgs, status, subs, breaches, tickets | P1 | V1 REQUIRED | B (execute only after Q1) | Privileged surface violates its own permission spec (MODULE_SPEC §6); insider-misuse risk. Active scope, but blocked by Q1 role taxonomy | `middleware/platform-admin-auth.ts` (membership-only, verified); 5 handler files reference `callerAdmin.role` (verified by grep); MODULE_SPEC §6 |
| FIX-009 | G2: DB feature flags written but never enforced — no API middleware or frontend reads `feature_flag` table; PA-5/M3-R9 is a no-op | P1 | V1 REQUIRED | E | ✅ **FIXED 2026-06-13** (Q2 decided = opt-in API middleware keyed by module name + frontend visibility). API-side half built: `middleware/feature-flag-gate.ts` + `core/ports/feature-flag.port.ts` + `featureFlagRepoPort` adapter; precedence org-override > org > association > tier; wired on `/association/marketplace/*` as proof-of-enforcement; route-walk regression. See fix-report §E. Frontend visibility + rollout to other routers = staged. | grep `featureFlags` outside platformadmin: only `seed/layer-7-platform.ts` + env-var `core/feature-flags.ts` (different system); `setFeatureFlag.ts` |
| FIX-010 | G3: Impersonation journey — broken search (`org.members` not in `listOrganizations`) + no identity swap + no banner + state lost on refresh | P1 | V1 REQUIRED | E | ✅ **V1 SLICE FIXED 2026-06-13** (Q3 decided = read-only data console for V1; identity-swap DEFERRED V2). Built the module-local slice: repointed the impersonate picker to `listPersons` search (was reading never-populated `org.members`) so a support admin can actually select a target. Full memberry identity-swap + banner + refresh-persistence = **V2 DEFERRED `[CROSS-MODULE RISK]`** (touches platform-wide session resolution). See fix-report 2026-06-13 §4. | `middleware/impersonation-guard.ts` (verified); `apps/admin/src/routes/impersonate/index.tsx` (repointed); `listOrganizations.ts` (no `members`); grep `impersonat` in `apps/memberry/src`: empty (V2) |
| FIX-011 | G7: Ticket/breach/pricing/subscription routes hand-wired outside TypeSpec → absent from OpenAPI/SDK; no generated hooks is the root cause of missing UI | P2 | V1 REQUIRED (enabler for FIX-013) | E (execute only after Q4) | Spec-first violation; mechanical but wide; unblocks all PRD-P0 admin UI. Active scope, but should not run before Q4 confirms which UIs are V1 | `app.ts:358-375,165-169` `@hand-wired` markers | **DONE 2026-06-13** (Q4 decided V1). All 13 `/admin/{tickets,breaches,pricing,subscriptions}` ops migrated to TypeSpec (`specs/api/src/modules/platform-admin-support.tsp` + main.tsp bridge); regen + SDK regen; hand-wired blocks removed from app.ts; `createTicket` (public `/support/tickets`) intentionally left hand-wired. See fix-report §FIX-011. |
| FIX-012 | G12: Ticket reopen-on-officer-reply + reply notifications (in-app + email) missing | P2 | V1 RECOMMENDED | B (after FIX-002 covers the handlers) | SLA/officer-trust behavior in PA-8/M3-R12; root-cause fixable; needs FIX-002 test baseline first | `addTicketComment.ts` (insert only); `updateTicketStatus.ts` (no notify) |
| FIX-013 | G6: No admin UI for tickets / subscriptions / pricing (P1) and revenue / org-health / breaches (P2) — backend exists, zero admin-app consumers | P1 (tickets/subs/pricing) / P2 (rest) | V1 REQUIRED / V1 RECOMMENDED | C (execute only after FIX-011 + Q4) | PRD-P0 capabilities unusable by the actual persona. Largest UI block; must follow G7 (SDK hooks) and Q4 (V1 scope confirmation) | grep `Ticket\|PricingTier\|Subscription\|Revenue\|Breach` in `apps/admin/src/routes`: zero consumers |
| FIX-014 | G10: Dashboard not actionable (AC-M03-003) — client-side aggregation over `limit:100` lists; `getPlatformSummary` endpoint unused | P2 | V1 RECOMMENDED | C | Wrong numbers at scale; misses PRD intent; root-cause is wrong data source | `apps/admin/src/routes/index.tsx:31-36`; `getPlatformSummary.ts` |
| FIX-015 | G9: AC-M03-002 disable-module warning with affected-data count missing (no UI dialog, no count endpoint) | P2 | V1 RECOMMENDED | C (only after FIX-009 — flag enforcement) | Data-loss-perception safety for org users. Meaningless until flags actually do something (FIX-009) | `routes/feature-flags/index.tsx`; no `affected` count API |
| FIX-016 | G11/M3-R2: Per-request audit of navigation during impersonation absent (only start/end logged) | P2 | V1 RECOMMENDED | B | ✅ **FIXED 2026-06-13.** New `impersonationReadAudit()` middleware emits one `data-access` audit entry per read-only request under an active impersonation session, carrying BOTH admin id + target id (+ method/path). Wired in `app.ts` between resolver and write-block; additive, fire-and-forget. RED→GREEN unit-tested. See fix-report 2026-06-13 §4. | `middleware/impersonation-guard.ts` (now has read-audit); `app.ts:297-299` |
| FIX-017 | G15: Admin app zero E2E; Hurl admin/impersonation flows tolerate 401/403 ("doesn't crash") | P2 | V1 RECOMMENDED | D (E2E portion runs during/after UI fixes) | Privileged surface ships with no journey-level proof; convert tolerant Hurl to role-asserting | `impersonation-flow.hurl:11-14`, `platformadmin-extended-flow.hurl:10-11`; no Playwright in `apps/admin` |
| FIX-018 | G16: NAVIGATION_MAP stale (7 routes vs 15 groups, header `INFERRED — needs human review`) | P3→active | V1 RECOMMENDED | B (doc-only) | Journeys-dimension verification rolls up against wrong anchor; cheap doc regen | `docs/product/modules/m03-platform-admin/NAVIGATION_MAP.md` frontmatter |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| D — Test hardening / honest baseline | Replace fake-green AC suite + backfill uncovered handlers + tighten tolerant contract/E2E so all later fixes are real TDD | FIX-001, FIX-002, FIX-017 (contract-tightening portion now; admin E2E portion during/after UI fixes) | Low (tests only, no prod-code change) | **Run now, in the current `04` pass** — prerequisite for every other batch |
| B — Decision-free P1s + cheap aligns + module-local trust gaps | Invite claim flow, MFA gate (middleware portion), spec-sync, ticket sort, impersonate UI gate, ticket reopen/notify, nav-map regen | FIX-003, FIX-004 (middleware gate), FIX-005 (doc-sync, after Q1), FIX-006, FIX-007, FIX-012 (after FIX-002), FIX-016 (after FIX-010), FIX-018 | Low-Medium (module-local; FIX-012 emits notifications cross-module) | **Run after Batch D.** FIX-005 needs Q1; FIX-016 needs FIX-010 (Batch E). Everything else runs immediately after D |
| E — Shared/platform + cross-module dependency fixes | MFA Better-Auth wiring, feature-flag enforcement middleware, impersonation identity resolution, TypeSpec migration of hand-wired routes | FIX-004 (Better-Auth wiring), FIX-009 (after Q2), FIX-010 (after Q3), FIX-011 (after Q4) | High (global request pipeline + Better-Auth + generated-file regen) | **Run in separate later `04` passes, one fix per pass.** FIX-009 after Q2; FIX-010 after Q3; FIX-011 after Q4. Each needs route-walk regression tests; never bury in module-local batch |
| B-gated — RBAC tier enforcement | Apply admin-tier checks to ~30 mutating handlers per MODULE_SPEC §6 | FIX-008 (after Q1) | Medium-High (touches ~30 handlers; cross-module overlap with auth-rbac audit) | **Run only after Q1 (role taxonomy) is decided.** Coordinate with auth-rbac audit. Validate against the FIX-001 RBAC-matrix test |
| C — UI completeness (PRD-P0 screens) | Build support inbox / subscriptions / pricing / breaches / revenue / org-health screens; actionable dashboard; disable-module warning | FIX-013 (after FIX-011 + Q4), FIX-014, FIX-015 (after FIX-009) | Medium (frontend; depends on SDK hooks from FIX-011) | **Run last, after Batch E (FIX-011) + Q4.** FIX-015 also needs FIX-009. Largest block; split per screen |
| F — Database/schema | Invite-claim token/binding column on `platform_admin` if FIX-003 needs persisted claim state | (supports FIX-003) | Medium (schema migration; module-owned table) | **Run with FIX-003 in Batch B** only if the claim flow requires a persisted token column; isolate the migration. Flag to `06` database-schema audit |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | Rewrite AC-M03-001/003/005/006/007 to assert against real middleware/handlers (not in-file helpers) | backend/unit + integration | The actual `platformAdminAuthMiddleware` / impersonation / dashboard code satisfies (or fails) each AC — no test-local helper functions | Rewrite `services/api-ts/src/handlers/platformadmin/ac-m03.platform-admin.test.ts` |
| FIX-002 | Add unit tests for the 10 uncovered handlers | backend/unit | Each handler's happy path + key guard behaves as written (RED baseline before edits) | New: `handlers/platformadmin/{addTicketComment,cancelSubscription,getCommittee,getNationalChapterDetail,getTicket,listBreaches,listPricingTiers,listTickets,reportBreach,updateTicketStatus}.test.ts` |
| FIX-003 | Invite → claim → invitee passes `platformAdminAuthMiddleware` integration test | integration | Invited admin binds a real Better-Auth userId on claim and can then access /admin; `admin.invited` triggers an email consumer | New: `handlers/platformadmin/inviteAdmin.claim.test.ts` (extend existing `inviteAdmin.test.ts` for emit assertion) |
| FIX-004 | Non-MFA admin rejected by `platformAdminAuthMiddleware`; MFA-enabled admin passes | backend/unit + permission | M3-R7/AC-M03-006 enforced in production middleware, not a stub | Replace stub assertions in `ac-m03.platform-admin.test.ts` (AC-M03-006) + new `middleware/platform-admin-auth.test.ts` |
| FIX-005 | n/a (doc/spec sync) — covered by FIX-008's RBAC-matrix test once role names align | — | Spec role names match code enum so the matrix test compiles against one taxonomy | (no new test; validated via FIX-008 test) |
| FIX-006 | `listTickets` returns priority-desc then createdAt-asc ordering | backend/unit | PA-8 step 1 sort correctness | New/extend: `handlers/platformadmin/listTickets.test.ts` (created in FIX-002) |
| FIX-007 | Impersonate page renders for a `support` role user | frontend/component | UI gate allows super+support, not super-only | Extend `apps/admin/src/test/routes/` (add impersonate route test) |
| FIX-008 | RBAC matrix: analyst/support get 403 on each mutating /admin op per MODULE_SPEC §6; super passes | permission/RBAC | Tier enforcement on ~30 mutating handlers; prevents regression | New: `handlers/platformadmin/rbac-tier-matrix.test.ts` |
| FIX-009 | Org request to a disabled module returns gated response; org override beats tier default | integration | Feature-flag enforcement actually gates module access with correct precedence | New: `services/api-ts/src/middleware/feature-flag-gate.test.ts` |
| FIX-010 | Start imp → GET serves target's data + banner present → write blocked (403) → exit ends session | integration + E2E/Playwright | Identity swap on imp-cookie GETs; memberry banner; write-block; exit works | New integration: `middleware/impersonation-guard.identity.test.ts`; E2E: `apps/admin` + `apps/memberry` impersonation journey spec |
| FIX-011 | Contract: ticket/breach/pricing/subscription endpoints present in OpenAPI and reachable via generated SDK | contract | Hand-wired routes successfully migrated to TypeSpec without losing behavior | Extend `specs/api/tests/contract/{admin-flow,assoc-subscriptions-flow,platformadmin-extended-flow}.hurl` |
| FIX-012 | `addTicketComment` reopens a resolved ticket on officer reply + emits notification; `updateTicketStatus` notifies | backend/unit | Reopen transition + notify emit per M3-R12 | Extend `handlers/platformadmin/addTicketComment.test.ts` + `updateTicketStatus.test.ts` (from FIX-002) |
| FIX-013 | Component tests: support inbox / subscriptions / pricing render real data + empty/loading/error states | frontend/component + E2E/Playwright (core journeys only) | Screens consume SDK hooks and render PRD-P0 capabilities | New `apps/admin/src/test/routes/{support,subscriptions,pricing}.test.tsx`; E2E for support-inbox journey only |
| FIX-014 | Dashboard component asserts actionable-item cards sourced from `getPlatformSummary` | frontend/component | Dashboard driven by server summary, not capped client aggregation | Extend `apps/admin/src/test/routes/dashboard.test.tsx` |
| FIX-015 | Disable-module dialog shows affected-data count before confirming | frontend/component | AC-M03-002 warning present and accurate | Extend `apps/admin/src/test/routes/feature-flags.test.tsx` |
| FIX-016 | Read request under active impersonation produces an audit entry with both admin + target IDs | backend/unit | M3-R2 navigation logging during impersonation | New: `handlers/audit/impersonation-read-audit.test.ts` (or extend impersonation-guard tests) |
| FIX-017 | Route-walk: non-admin gets 403 on every `/admin/*` path; Hurl impersonation/extended flows assert authed-super behavior (stop accepting 401/403) | permission/regression + contract | Privileged-surface guard invariant + real journey assertions | New route-walk test `handlers/__tests__/admin-route-walk.test.ts`; tighten `impersonation-flow.hurl`, `platformadmin-extended-flow.hurl` |
| FIX-018 | n/a (doc regen) | — | NAVIGATION_MAP reflects the 15 real route groups | (no test; doc review) |

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `handlers/platformadmin/ac-m03.platform-admin.test.ts` | module-local | Tests only; none on prod |
| FIX-002 | 10 new `handlers/platformadmin/*.test.ts` | module-local | Tests only |
| FIX-003 | `handlers/platformadmin/inviteAdmin.ts`, new claim handler, `core/domain-event-consumers.ts` (new `admin.invited` subscriber), `handlers/email/` (invite email), possibly `platform-admin.schema.ts` (claim token) | module-local + cross-module (email) + database/schema (if token column) | Adds an email consumer + possible 1-column migration |
| FIX-004 | `middleware/platform-admin-auth.ts`, `core/auth.ts` (Better-Auth twoFactor policy) | shared/platform (Better-Auth) | All /admin routes; coordinate with auth-rbac audit |
| FIX-005 | `docs/product/modules/m03-platform-admin/MODULE_SPEC.md` (§6 role names) | module-local (doc) | Doc only; unblocks FIX-008 |
| FIX-006 | `handlers/platformadmin/listTickets.ts` | module-local | Single handler ordering |
| FIX-007 | `apps/admin/src/routes/impersonate/index.tsx` | module-local | One UI gate |
| FIX-008 | ~30 mutating handlers in `handlers/platformadmin/`, `middleware/platform-admin-auth.ts` or a new `requireAdminTier` helper | module-local + cross-module (overlaps auth-rbac) | Wide within module; auth-rbac overlap |
| FIX-009 | New feature-flag-gate middleware in `services/api-ts/src/middleware/`, `app.ts` (`app.use` chain), `FeatureFlagRepository`, possibly memberry module-visibility | shared/platform + cross-module | Every module router (gate keyed by module name) |
| FIX-010 | `middleware/impersonation-guard.ts`, `core/auth` session resolution, new person-search endpoint, new active-session endpoint, `apps/admin/src/routes/impersonate/`, new memberry banner component | shared/platform + cross-module (both apps) | Platform-wide auth/session path; both frontends |
| FIX-011 | `specs/api/src/modules/platform-admin.tsp` (+ custom), regenerate `services/api-ts/src/generated/openapi/*` + SDK, remove hand-wired blocks in `app.ts` | shared/platform (generated pipeline) | OpenAPI + SDK + routes regen — DO NOT hand-edit generated files |
| FIX-012 | `handlers/platformadmin/addTicketComment.ts`, `updateTicketStatus.ts`, notification emit | module-local + cross-module (notifs/email) | Two handlers + notification fan-out |
| FIX-013 | New `apps/admin/src/routes/{support,subscriptions,pricing}/`, wire compliance/revenue/org-health pages; depends on SDK hooks from FIX-011 | module-local (frontend) | Admin app surface; depends on FIX-011 |
| FIX-014 | `apps/admin/src/routes/index.tsx`, `getPlatformSummary` consumption | module-local | Dashboard route |
| FIX-015 | `apps/admin/src/routes/feature-flags/index.tsx`, new affected-count endpoint | module-local + cross-module (count source) | Flags page + count API; needs FIX-009 |
| FIX-016 | `utils/audit-events.ts`, audit middleware or impersonation-guard read path | module-local + shared (audit pipeline) | Read-path audit when imp context present |
| FIX-017 | New route-walk test; `specs/api/tests/contract/impersonation-flow.hurl`, `platformadmin-extended-flow.hurl` | module-local (tests/contract) | Tests/contract only |
| FIX-018 | `docs/product/modules/m03-platform-admin/NAVIGATION_MAP.md` | module-local (doc) | Doc only |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-004 | shared/platform | Better-Auth twoFactor (`core/auth.ts`, generated better-auth) | MFA gate must hook auth core; coordinate with auth-rbac audit | Wiring is part of the fix (Batch E); middleware gate (Batch B) can land first |
| FIX-003 | cross-module + database/schema | `admin.invited` email delivery via email/notifs + possible `platform_admin` claim-token column | Consumer belongs in `core/domain-event-consumers.ts` per CLAUDE.md P1.6; claim needs persisted state | Email consumer + (if needed) migration are part of the fix |
| FIX-008 | product decision + cross-module | Q1 role taxonomy; overlaps auth-rbac audit | Cannot implement matrix until taxonomy settled; avoid double-owning RBAC | Q1 required before fix |
| FIX-009 | product decision + cross-module | Q2 enforcement point; gate touches every module router | Blast radius = all module routers; wrong design breaks unrelated modules | Q2 required before fix; design as opt-in middleware keyed by module name |
| FIX-010 | product decision + cross-module | Q3 identity-swap vs read-only console; touches platform-wide session resolution | Determines size (auth-core change vs admin-only viewer); must not weaken normal auth | Q3 required before fix |
| FIX-011 | shared/platform | TypeSpec → OpenAPI → routes/validators/SDK regeneration pipeline | Regenerates generated files; never hand-edit; unblocks all FIX-013 UI | Q4 should scope which routes are V1 first |
| FIX-013 | cross-module | SDK hooks from FIX-011; Q4 V1-scope confirmation | UI cannot consume endpoints without generated hooks | FIX-011 + Q4 required before fix |
| FIX-015 | cross-module | Affected-data count source; depends on FIX-009 flag enforcement | Warning is meaningless while flags do nothing | FIX-009 required before fix |
| FIX-016 | shared | Audit pipeline (`utils/audit-events.ts`, audit middleware) | Read-path auditing extends mutation-oriented middleware | FIX-010 (imp identity) recommended first |
| FIX-005, FIX-018 | module-local (docs) | MODULE_SPEC §6 / NAVIGATION_MAP | Doc accuracy; FIX-005 gated by Q1 decision content | Q1 for FIX-005 |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Admin role taxonomy — `super/support/analyst` (code + ROLE_PERMISSION_MATRIX) or `super/admin/support` (MODULE_SPEC §6)? Which tier maps to each §6 row? | ✅ **DECIDED 2026-06-13** | FIX-008, FIX-005 | RBAC matrix cannot be implemented until unambiguous | **Canonicalized on code enum `super/support/analyst`; MODULE_SPEC §6 synced (FIX-005); enforcement built (FIX-008). See fix-report §C.** |
| Q2: Where are DB feature flags enforced — API request gate, frontend module visibility, or both — and what is a "gated" response? | ✅ **DECIDED 2026-06-13** | FIX-009, FIX-015 | Shapes blast radius across all module routers | **Decided = opt-in API middleware keyed by module name + frontend visibility; "gated" = 403 `{error, moduleName}`. API-side half built (FIX-009); frontend visibility + multi-router rollout staged. See fix-report §E.** |
| Q3: Is impersonation V1 expected to render the target's memberry view (identity swap), or is a read-only data console acceptable? | ✅ **DECIDED 2026-06-13** | FIX-010, FIX-016 | Determines G3 size (auth-core change vs admin-only viewer) | **Decided = read-only data console for V1; identity-swap DEFERRED V2 `[CROSS-MODULE RISK]`. V1 slice built: fixed broken member search (`listPersons`) + per-read impersonation audit (FIX-016). Memberry identity-swap/banner NOT built. See fix-report 2026-06-13.** |
| Q4: Should support-inbox / pricing / subscription UIs land in V1, given the 3-person ops team currently operates via API/seed? | `[NEEDS CONFIRMATION]` | FIX-011, FIX-013 | Largest UI work block; scopes G6/G7 | Confirm V1 screen set before starting FIX-011/FIX-013 |
| Q5: Do hand-wired ticket/breach/pricing mutations actually emit audit entries today (global middleware vs per-route registry)? | `[NEEDS CONFIRMATION]` | FIX-011 (audit-completeness check) | M3-R13 completeness during migration | Verify at runtime during FIX-011 |
| Q6: Is the impersonate-page member search confirmed empty at runtime? | `[NEEDS CONFIRMATION]` `[BLOCKED BY ENVIRONMENT]` | FIX-010 | Confirms G3 severity; static read says `org.members` never returned | Verify in a live run during the fix phase |
| Q7: Member account merge — V1 or V2? | `[NEEDS PRODUCT DECISION]` | (deferred — see §10) | MODULE_SPEC lists it In Scope with zero code | Decide; recommend V2 |
| Q8: Is `analyst` meant to see national/revenue analytics only, or all read endpoints? | ✅ **DECIDED 2026-06-13** | FIX-008 (read-side of matrix) | Read-side of the RBAC matrix | **`analyst` = read-only: all `get*`/`list*`/`export*` reads, NO mutation, NO impersonation. Enforced in FIX-008. See fix-report §C.** |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-008 (G1 RBAC tiers) | `[NEEDS PRODUCT DECISION]` `[CROSS-MODULE RISK]` | Role taxonomy ambiguous; overlaps auth-rbac audit | Q1 (+ Q8 read-side) decided; coordinate with auth-rbac audit; FIX-001 RBAC-matrix test in place |
| ~~FIX-009 (G2 flag enforcement)~~ ✅ **FIXED 2026-06-13** | resolved | Q2 decided; opt-in middleware + route-walk regression built (fix-report §E) | — (rollout to other routers + frontend visibility = staged) |
| ~~FIX-010 (G3 impersonation V1 slice)~~ ✅ **V1 SLICE FIXED 2026-06-13** | resolved (V1) / `V2 DEFERRED` `[CROSS-MODULE RISK]` (identity-swap) | Q3 decided = read-only console; broken member search fixed (`listPersons`) + per-read audit (FIX-016) shipped | — for V1. Identity-swap + memberry banner = V2: needs a dedicated `04` pass touching platform-wide session resolution |
| FIX-011 (G7 TypeSpec migration) + FIX-013 (G6 UI) | `[NEEDS CONFIRMATION]` `[SHARED DEPENDENCY]` | V1 screen set unconfirmed; FIX-013 depends on SDK hooks from FIX-011 | Q4 confirmed; FIX-011 lands before FIX-013 |
| Runtime confirmations (impersonate search empties; dashboard scale numbers) | `[BLOCKED BY ENVIRONMENT]` | No server boot / live HTTP available during audit | Live run during fix phase |
| FIX-015 (G9 disable-module warning) | depends on FIX-009 — ✅ **UNBLOCKED 2026-06-13** | FIX-009 landed (fix-report §E); flags now enforce, so an affected-count warning is meaningful | Schedule its own Batch-C `04` pass (affected-count endpoint + admin-app dialog) |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Member account merge | §4/§9 MODULE_SPEC In Scope; G (no code) | `V2 DEFERRED` + `[NEEDS PRODUCT DECISION]` (Q7) | In spec but zero code, zero journey pressure; complex person-graph surgery |
| Full SLA analytics bar (avg response/resolution, compliance rate) on support inbox | §23 | `V2 DEFERRED` | Build the inbox (FIX-013) first; metrics need accumulated data |
| Replacing env-var `FF_*` feature-flag system | §6 / §23 | `V2 DEFERRED` | Harmless once documented (DB flags are the product flags); removal is churn |
| `getRevenueAnalytics` / `getOrgHealthScores` / `exportDashboardReport` wiring | §12 / G6 (P2 portion) | `V1 RECOMMENDED` → deferred behind FIX-013 (P2 sub-items) | Lower priority than P0 billing/support UI; wire after the P1 screens land |
| Committee/national handler relocation out of platformadmin | §21 / §23 | `DO NOT ADD` (now) `[DO NOT OVERBUILD]` | Mega-module-split class of work; deferred per ROADMAP/ADR-0010 |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| LaunchDarkly/Unleash-style flag targeting, gradual rollouts, percentage flags | §23 | `[DO NOT OVERBUILD]` — tier + org boolean matrix is the V1 spec; `core/feature-flags.ts` comment is correct |
| Auto-escalation policies UI / configurable SLA matrices | §23 | Hard-coded SLA matrix in `createTicket.ts` already matches M3-R12 |
| Impersonation session extension / longer windows | §23 | M3-R3 explicitly forbids extension |
| Moving committees/national handlers out of platformadmin | §21/§23 | Mega-module-split work, deferred per ADR-0010; out of this module's fix scope |
| Mobile layouts for admin app | §23 | MODULE_SPEC Out of Scope (desktop only) |
| Second/parallel RBAC mechanism | §14 | Surface already has dual mechanisms (table lookup vs `authMiddleware({roles})`); converge during FIX-008, do not add a third |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | AC tests assert against in-file helper functions, not production code — fixing the tests fixes the false-confidence root cause |
| FIX-002 | Root cause (coverage gap) | Handlers shipped without unit tests; backfill is the root-cause baseline |
| FIX-003 | Root cause | `inviteAdmin` inserts a random `userId` and emits an event with no subscriber — the binding never happens; claim flow + consumer fix the cause, not a symptom |
| FIX-004 | Root cause | MFA check absent from the only admin auth gate; add it at the gate |
| FIX-005 | Root cause | Spec/code taxonomy divergence; sync the spec (after Q1) |
| FIX-006 | Symptom-adjacent → root | `listTickets` orders by wrong column; correct the ORDER BY |
| FIX-007 | Root cause | UI gate hardcoded narrower than backend allow-list |
| FIX-008 | Root cause | Auth middleware checks membership only, never tier; add tier enforcement (after Q1) — not a per-handler patch but a shared gate |
| FIX-009 | Root cause | No consumer of `feature_flag` table; add an enforcement point (after Q2) rather than papering over individual modules |
| FIX-010 | Root cause | Nothing consumes `impersonationSession` for identity; add identity resolution (after Q3) — symptom patches (e.g., fixing only the search) would leave the journey broken |
| FIX-011 | Root cause | Hand-wired routes bypass the spec-first pipeline → no SDK hooks → no UI; migration removes the root cause of FIX-013 |
| FIX-012 | Root cause | `addTicketComment`/`updateTicketStatus` never implemented reopen/notify; add the transitions |
| FIX-013 | Symptom of FIX-011 | UI absence is downstream of missing SDK hooks; do not build UI against hand-wired routes (workaround) — fix FIX-011 first |
| FIX-014 | Root cause | Dashboard aggregates capped client lists instead of using `getPlatformSummary`; switch the data source |
| FIX-015 | Root cause (gated) | No affected-count endpoint/dialog; meaningful only after FIX-009 |
| FIX-016 | Root cause | Audit middleware is mutation-oriented; add read-path audit under imp context |
| FIX-017 | Root cause | Contract/E2E tolerate 401/403 and admin has zero E2E — tighten assertions + add route-walk |
| FIX-018 | Symptom (doc drift) | Regenerate NAVIGATION_MAP from the 15 real route groups |

## 13. Recommended First Fix Batch

**Batch name:** Batch D — Test hardening / honest baseline

**Included Fix IDs:** FIX-001 (rewrite fake-green `ac-m03` against real middleware/handlers), FIX-002 (backfill 10 uncovered handler unit tests), FIX-017 (contract-tightening portion: route-walk test + convert tolerant `impersonation-flow.hurl` / `platformadmin-extended-flow.hurl` to authed-super assertions — admin E2E portion deferred until UI fixes land).

**Why this batch comes first:** The audit returned FAIL largely because the acceptance suite is fake-green (G8) — it tests test-local helper functions, so the module *appears* verified while AC-M03-001/002/003/006 do not hold in production. Until that suite asserts against real code and the 10 uncovered handlers have a baseline, every P1 fix (RBAC, MFA, invite, flags, impersonation) would be validated against untrustworthy green tests. Batch D is also the only batch with zero product-decision and zero shared-pipeline risk, so it can run immediately and unblocks honest TDD for all subsequent batches.

**Tests to write first:** (1) Rewrite `handlers/platformadmin/ac-m03.platform-admin.test.ts` so AC-M03-006 asserts a non-MFA admin is rejected by the real `platformAdminAuthMiddleware`, and AC-M03-001/007 assert real impersonation write-block/identity behavior — these will go RED, which is correct and expected. (2) Add the 10 handler unit tests (FIX-002). (3) Add the route-walk permission test (non-admin → 403 on every `/admin/*`) and tighten the two tolerant Hurl flows.

**Explicit out-of-scope items for this batch:** Do NOT implement FIX-008 (RBAC — blocked by Q1), FIX-009 (flag enforcement — blocked by Q2), FIX-010 (impersonation — blocked by Q3), FIX-011/FIX-013 (TypeSpec migration + UI — blocked by Q4), or any §11 Do-Not-Build item. Do NOT write production code in this batch beyond what is strictly needed to make a rewritten test compile against real symbols — the RED state is the deliverable. Decision-free production fixes (FIX-003 invite, FIX-004 MFA gate, FIX-006/007 aligns) belong to Batch B, the next pass.

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Platform Admin (+ admin app)
- **Exact module slug:** platform-admin
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/platform-admin-fix-ready-plan.md`
- **Exact batch to execute first:** Batch D — Test hardening / honest baseline (FIX-001, FIX-002, and the contract-tightening portion of FIX-017). Stop after Batch D; do not auto-continue to Batch B.
- **Tests to prioritize (write/RED first):**
  1. Rewrite `services/api-ts/src/handlers/platformadmin/ac-m03.platform-admin.test.ts` to assert against real `middleware/platform-admin-auth.ts`, impersonation guard, and dashboard handlers — replacing the in-file `impersonationAccessLevel` / `canAccessAdminPanel` helpers. Expect RED on AC-M03-001/006.
  2. Add 10 handler unit tests (FIX-002 list: `addTicketComment`, `cancelSubscription`, `getCommittee`, `getNationalChapterDetail`, `getTicket`, `listBreaches`, `listPricingTiers`, `listTickets`, `reportBreach`, `updateTicketStatus`).
  3. Add route-walk permission test (non-admin → 403 on every `/admin/*`) and convert `specs/api/tests/contract/impersonation-flow.hurl` + `platformadmin-extended-flow.hurl` from 401/403-tolerant to authed-super assertions.
- **Files likely to touch (Batch D):** `handlers/platformadmin/ac-m03.platform-admin.test.ts`; 10 new `handlers/platformadmin/*.test.ts`; new `handlers/__tests__/admin-route-walk.test.ts`; `specs/api/tests/contract/{impersonation-flow,platformadmin-extended-flow}.hurl`. No production source edits beyond what is needed to compile rewritten tests against real symbols.
- **Shared/database cautions:** Batch D is tests/contract only — no shared/platform or schema changes. For later batches: FIX-004 touches Better-Auth (`core/auth.ts`) — coordinate with the auth-rbac audit; FIX-009 and FIX-010 touch the global `app.ts` `app.use` request pipeline — isolate as opt-in middleware with route-walk regression and never bury in a module-local batch; FIX-011 regenerates `src/generated/openapi/*` + SDK — NEVER hand-edit generated files; FIX-003 may add an invite-claim token column to `platform_admin` — isolate the migration and flag it to the `06` database-schema audit.
- **Items NOT to implement (any batch):** FIX-008/FIX-009/FIX-010/FIX-011/FIX-013 until Q1/Q2/Q3/Q4 are decided (§8); every §11 Do-Not-Build item (LaunchDarkly-style flag targeting, SLA analytics bar, configurable SLA matrices, impersonation extensions, committee/national relocation, mobile admin layouts, a third RBAC mechanism); §10 deferred items (member account merge, env-var FF replacement). Do not promote any V2 DEFERRED item into the active fix order.

---

Next recommended step:
Module/group: Platform Admin (+ admin app)
Module slug: platform-admin
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/platform-admin-fix-ready-plan.md
Recommended batch: Batch D — Test hardening / honest baseline
