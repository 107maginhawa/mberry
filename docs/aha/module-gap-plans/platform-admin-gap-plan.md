# AHA Module/Group Gap Plan: Platform Admin (+ admin app)

Date: 2026-06-11
Prompt: `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Platform Admin (+ admin app) |
| Module slug | platform-admin |
| Type | Business Module + Frontend Route Group (privileged surface) |
| Output file | `docs/aha/module-gap-plans/platform-admin-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/m03-platform-admin.md` + `docs/product/modules/m03-platform-admin/MODULE_SPEC.md` |
| Supporting PRDs/specs used | `docs/product/ROLE_PERMISSION_MATRIX.md`; `specs/api/src/modules/audit.md` (MODULE_SPEC: audit); `docs/product/modules/m03-platform-admin/{API_CONTRACTS.md,NAVIGATION_MAP.md}`; m14 (national dashboard, touched only where it lives in `platformadmin/`) |
| PRD/spec coverage quality | Strong (m03 PRD + MODULE_SPEC with AC-M03-001..007); NAVIGATION_MAP is `INFERRED — needs human review` and stale |
| Paths inspected | `services/api-ts/src/handlers/platformadmin/` (handlers, repos, jobs, utils), `services/api-ts/src/handlers/audit/`, `services/api-ts/src/middleware/{platform-admin-auth,impersonation-guard}.ts`, `services/api-ts/src/app.ts` (hand-wired /admin, /support routes), `services/api-ts/src/generated/openapi/routes.ts`, `services/api-ts/src/core/{ports,feature-flags.ts,domain-events.registry.ts}`, `specs/api/src/modules/{platform-admin.tsp,platform-admin-custom.tsp,audit.tsp}`, `apps/admin/src/` (all routes, role-gate, main.tsx, tests), `specs/api/tests/contract/{admin-flow,impersonation-flow,feature-flags-flow,platformadmin-extended-flow,audit,audit-side-effects}.hurl` |
| PRDs/specs inspected | m03 PRD (capabilities 3.1+, journeys PA-1..PA-10, rules M3-R1..M3-R13, UX screen specs), m03 MODULE_SPEC (workflows WF-015/016/018/019/022, permissions §6, AC §11, test expectations §12, edge cases §13), ROLE_PERMISSION_MATRIX (platform_admin enum: super/support/analyst), MODULE_SPEC: audit |
| KG used | Yes (status notes only; `.understand-anything/` graph used as secondary evidence per `docs/aha/kg/knowledge-graph-status.md`) |
| KG refreshed | No |
| `/understand-domain` used | No (no domain-knowledge-status content found; direct code + PRD inspection sufficient) |
| `/understand-domain` refreshed | No |
| Webwright used | No — Static review sufficient; browser tooling skipped for batch run. |
| Playwright/E2E inspected | Yes (statically) — admin app has **zero** Playwright/E2E specs; only vitest route tests under `apps/admin/src/test/routes/` |
| Existing tests inspected | ~35 unit test files in `handlers/platformadmin/`, 4 in `handlers/audit/`, 8 admin-app vitest route tests, 6 relevant Hurl files |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | No server boot / live HTTP verification ([BLOCKED BY ENVIRONMENT] for runtime behavior); a parallel auth-rbac audit owns the broad RBAC layer — RBAC findings here are scoped to platform-admin operations only |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| M03 PRD | `docs/product/modules/m03-platform-admin.md` | PRD (capabilities, journeys PA-1..PA-10, rules M3-R1..R13, UX screens) | Current | Primary expected-behavior source |
| M03 MODULE_SPEC | `docs/product/modules/m03-platform-admin/MODULE_SPEC.md` | Module spec (workflows, permissions, AC-M03-001..007, test expectations) | Current, but §6 permissions use role names `super/admin/support` that don't match code enum `super/support/analyst` | Acceptance criteria + permission matrix |
| Role/Permission Matrix | `docs/product/ROLE_PERMISSION_MATRIX.md` | RBAC reference | Current | Defines platform_admin levels: `super` (full), `support` (impersonate/tickets), `analyst` (read-only, no impersonation) |
| MODULE_SPEC: audit | `specs/api/src/modules/audit.md` | Module spec for audit handler | Current | `listAuditLogs` contract, retention jobs (365d archive / 7y purge) |
| M03 API_CONTRACTS | `docs/product/modules/m03-platform-admin/API_CONTRACTS.md` | API contract notes | Unknown (not deeply diffed) | Secondary |
| M03 NAVIGATION_MAP | `docs/product/modules/m03-platform-admin/NAVIGATION_MAP.md` | Route ownership anchor | **Stale** — declares 7 routes; admin app has 15 route groups; header says `INFERRED — needs human review` | Journeys-dimension anchor is wrong |
| ver-3 platform-admin screens | `docs/ver-3/ux/screens/platform-admin/*` (pricing, dashboard, national, feature-flags, system-health, …) | UX screens | Secondary/possibly superseded by m03 UX spec | Confirms pricing + system-health screens were planned |
| ADR-0007 | `docs/architecture/adr/` | x-audit/x-require extension pattern | Current | Audit middleware generation for /admin routes |

## 3. Expected vs Actual

**Expected (m03 PRD + MODULE_SPEC):** A super/support/analyst-tiered platform-ops surface: provision associations/orgs (PA-1/2), manage subscriptions+pricing (PA-3, M3-R8), actionable dashboard (PA-4), feature-flag matrix with org overrides that take effect immediately (PA-5, M3-R9), read-only banner-visible 30-min impersonation (PA-6, M3-R1..R5), revenue dashboard (PA-7), SLA-tracked support inbox (PA-8, M3-R12), org health outreach (PA-9), admin team management with last-super protection and mandatory MFA (PA-10, M3-R6/R7), DPA-2012 breach tracking (M3-R11), immutable audit trail (M3-R13).

**Actual:** Backend is broad and mostly present — 40+ handlers, full schema (`platform-admin.schema.ts`: associations, organizations, featureFlags, platformAdmins, impersonationSessions, breachIncidents, supportTickets, ticketComments, pricingTiers, subscriptions), 4 background jobs (ticket SLA escalation, breach 72h deadline, trial expiry, past-due), org-lifecycle state machine (M3-R10 ✓), last-super protection in `revokeAdmin`/`updateAdmin` (M3-R6 ✓), API-level impersonation write-block middleware (M3-R4 ✓), 30-min impersonation expiry + admin-impersonation block (M3-R3/R5 ✓), per-route x-audit middleware on mutations (M3-R13 largely ✓).

But five things hollow out the V1 workflows:

1. **Tier RBAC is membership-only.** `platformAdminAuthMiddleware` (`middleware/platform-admin-auth.ts`) only checks the user exists in `platform_admin`; only 9 of ~40 handlers check `callerAdmin.role`. Analyst/support can mutate feature flags, orgs, subscriptions, breaches — violating MODULE_SPEC §6 and the explicit edge case "Support admin attempts feature flag change: blocked by permissions".
2. **Feature flags are written but never read.** No middleware, service, or frontend consumes the `feature_flag` table. M3-R9 ("changes take effect immediately") is unimplemented; PA-5 is a misleading control.
3. **Impersonation never produces an impersonated view.** Nothing consumes `ctx.impersonationSession` to swap identity; memberry app has zero impersonation code (no banner — M3-R1 missing); the admin impersonate page's user search reads `org.members` which `listOrganizations` does not return.
4. **Admin invite is a dead end.** `inviteAdmin.ts` creates the row with `userId: crypto.randomUUID()` and emits `admin.invited`, which has **no subscriber** — no email, no claim flow, no userId binding, so an invited admin can never pass `platformAdminAuthMiddleware`.
5. **PRD-P0 money/support workflows have no UI.** Tickets, pricing, subscriptions, revenue, org-health, breaches have working endpoints but zero admin-app consumers (root cause: most are hand-wired in `app.ts` outside TypeSpec → no SDK hooks).

MFA (M3-R7/AC-M03-006) is enforced nowhere in production code; the AC test suite (`ac-m03.platform-admin.test.ts`) tests **test-local helper functions**, not real middleware/handlers — fake-green coverage.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3.1 Association provisioning (P0, PA-1) | Create/configure associations | CRUD handlers + delete-blocked-with-active-orgs | `apps/admin/src/routes/associations/{index,$associationId}.tsx` | `createAssociation.ts` (super check ✓), `updateAssociation.ts`, `deleteAssociation.ts` | `associations` table | unit tests ✓, `admin-flow.hurl`, `associations.test.tsx` | Implemented | Minor |
| 3.2 Organization provisioning (P0, PA-2) | Super/admin create org, officer invite, trial | create/update/get/list/transition handlers; trial-expiry job | `routes/organizations/` | `createOrganization.ts` (**no role check**), `transitionOrgStatus.ts` (state machine ✓, **no role check**) | `organizations` table | unit tests ✓, `admin-flow.hurl` | Partially Implemented | Yes (RBAC) |
| 3.3 Subscription billing (P0, PA-3) | View/manage subs, failed-payment retry, trial→paid | list/get/cancel handlers; `trialExpiryMonitor`, `pastDueMonitor` jobs | **None** — no admin route consumes Subscription | hand-wired in `app.ts` (lines ~165-169 imports); `cancelSubscription.ts` no role check | `subscriptions` table | `getSubscription.test.ts`, `listSubscriptions.test.ts`; `cancelSubscription` **untested**; `assoc-subscriptions-flow.hurl` | Partially Implemented | Yes (no UI, RBAC) |
| 3.4 Pricing & plans (P0, M3-R8) | Tier brackets; changes apply to new subs only | create/update/list handlers (create/update check super ✓) | **None** — no pricing route (ver-3 `pricing.md` screen never built) | `createPricingTier.ts`, `updatePricingTier.ts`, `listPricingTiers.ts` (hand-wired) | `pricing_tier` table | create/update tested; `listPricingTiers` untested; M3-R8 renewal semantics untested | Partially Implemented | Yes (no UI) |
| 3.5 Feature flags (PA-5, M3-R9, AC-M03-002) | Matrix + org overrides; immediate effect; auth always-on; disable warning | set/list/delete handlers; auth-module block ✓ (`setFeatureFlag.ts` WF-018) | `routes/feature-flags/index.tsx` exists | **No enforcement consumer anywhere**; no role check on set/delete | `feature_flag` table | `setFeatureFlag.test.ts` etc.; `feature-flags-flow.hurl` only tests the *env-var* `/feature-flags` endpoint | Partially Implemented | **Yes — flags not enforced; no disable warning** |
| PA-6 Impersonation (M3-R1..R5, AC-M03-001/007) | Read-only, banner, 30-min, no admin targets, view-as | start/end handlers ✓ (30-min, R5 block, cookie); `impersonationWriteBlock` ✓ | `routes/impersonate/index.tsx` (super-only; search reads nonexistent `org.members`); **no banner anywhere; memberry has zero impersonation code** | No identity swap — nothing consumes `impersonationSession` to serve target's data | `impersonation_session` table | start/end unit tests; AC tests are stubs; `impersonation-flow.hurl` accepts 401/403 | Partially Implemented | **Yes — journey broken** |
| PA-7 Revenue dashboard | MRR, churn, revenue analytics | `getRevenueAnalytics.ts` + test | **None** — no admin UI consumer | handler exists | dashboard snapshots | `getRevenueAnalytics.test.ts` | Partially Implemented (Implemented but Unwired) | Yes |
| PA-8 Support tickets (M3-R12) | Inbox, priority+age sort, SLA, escalation, reopen-on-reply, reply notifications | create/list/get/status/comment handlers; SLA matrix at create; `ticketSlaMonitor` escalates to supers ✓ | **None** — no `/admin/support` route in admin app | hand-wired `app.ts` ~366-375; `listTickets.ts` sorts `createdAt` only; `addTicketComment.ts` has **no reopen / no notify**; `updateTicketStatus.ts` sets `resolvedAt` only | `support_ticket`, `ticket_comment` | `createTicket.test.ts` only; list/get/status/comment **untested** | Partially Implemented | Yes (no UI, missing behaviors) |
| PA-9 Org health | Health scores, outreach flags | `getOrgHealthScores.ts` + test | **None** — no UI consumer | handler exists | snapshots | `getOrgHealthScores.test.ts` | Implemented but Unwired | Yes |
| PA-10 Admin team (M3-R6, AC-M03-004) | Invite/update/revoke; last-super protection | handlers with super checks ✓; last-super block in revoke + update ✓ | `routes/operators/index.tsx` (SDK hooks ✓) | `inviteAdmin.ts` creates **random userId**; `admin.invited` event has **no consumer** | `platform_admin` table | invite/update/revoke unit tests ✓ | Partially Implemented | **Yes — invite dead end** |
| PA-4 Dashboard (AC-M03-003) | Actionable items first (pending setup, SLA, payment failures, trials) | `getPlatformSummary.ts` exists (`/admin/national/platform`) | `routes/index.tsx` computes from 6 list queries (limit 100) — no actionable-items cards per spec | summary handler unused by dashboard | — | `getPlatformSummary.test.ts`; `dashboard.test.tsx`; AC-M03-003 test is a stub | Partially Implemented | Yes |
| M3-R7 / AC-M03-006 MFA mandatory | Admins must have MFA; cannot disable | **Not enforced** — no MFA check in `platform-admin-auth.ts` or anywhere in `handlers/platformadmin/` | — | grep `mfa|twoFactor` over middleware+handlers: empty | — | AC-M03-006 test asserts a **test-local helper** (`canAccessAdminPanel`), not production code | Missing | **Yes** |
| M3-R10 / AC-M03-005 Org lifecycle | Strict state machine, 90-day cancelled window | `VALID_TRANSITIONS` + 90-day reactivation check | — | `transitionOrgStatus.ts:10-53` | org status enum | `transitionOrgStatus.test.ts` ✓ | Implemented | No |
| M3-R11 Breach 72h (DPA 2012) | Track timeline, alert near deadline | report/list/updateStatus handlers + `breachDeadlineMonitor` (notifies supers <24h to deadline) ✓ | **None** — `routes/compliance/index.tsx` is a static placeholder (no hooks) | hand-wired `app.ts` ~118-120, 358-363 | `breach_incident` | `updateBreachStatus.test.ts`; report/list **untested** | Partially Implemented | Yes (no UI) |
| M3-R13 Immutable audit trail | All admin actions logged | x-audit on TypeSpec mutations; per-route audit middleware; hand-wired routes rely on `/admin/*` audit context; retention jobs (365d/7y) | `routes/audit/index.tsx` uses `listAuditLogsOptions` ✓ | `handlers/audit/listAuditLogs.ts`, `audit/jobs/index.ts` | `audit_log_entries` (hash-chained per repo) | audit unit tests ✓; `audit.hurl`, `audit-side-effects.hurl` | Implemented | Minor (R2 nav-logging below) |
| M3-R2 Impersonation actions logged w/ both IDs | Navigation/read log during impersonation | start/end audited with both IDs ✓; but per-request reads during impersonation are **not** audit-logged (audit middleware is mutation-focused; writes are blocked anyway) | — | `audit-events.ts` only has `impersonation-started/ended` | — | none | Partially Implemented | Yes (P2) |
| MODULE_SPEC In Scope: platform announcements | Platform-wide announcements | Lives in `communication` module | — | — | — | — | Not Required for V1 here — [SHARED DEPENDENCY] | No |
| MODULE_SPEC In Scope: member account merge | Merge duplicate accounts | **No code found** (grep `merge` in platformadmin/person handlers: empty) | — | — | — | — | Missing | Yes ([NEEDS PRODUCT DECISION] — V2?) |
| MODULE_SPEC In Scope: data export/deletion processing | Admin processes DSRs | Person-module deletion cascade exists ([SHARED DEPENDENCY]); no admin queue UI | `routes/compliance/` placeholder | `core/domain-event-consumers.ts` (person.deleted) | — | — | Partially Implemented | [CROSS-MODULE RISK] |
| m14 National dashboard (hosted here) | National analytics, chapters, export | getNationalDashboard/listNationalChapters/getNationalChapterDetail/exportDashboardReport | `routes/national-dashboard/index.tsx` (custom useQuery + `listAssociationsOptions`) | handlers ✓; `getPlatformSummary` route uses `authMiddleware({roles:["platform_admin"]})` | snapshots | `ac-m14`, `br-36` tests, `national-endpoints.test.ts`, `platformadmin-extended-flow.hurl` | Implemented (audit fully under m14 scope) | Minor |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| MODULE_SPEC §6 permissions; ROLE_PERMISSION_MATRIX (analyst = read-only) | Mutating /admin handlers don't check admin tier — only 9 of ~40 handlers check `callerAdmin.role` (`createAssociation`, `createPricingTier`, `deleteAssociation`, `getAdminRole`, `inviteAdmin`, `revokeAdmin`, `startImpersonation`, `updateAdmin`, `updatePricingTier`). `setFeatureFlag`, `deleteFeatureFlag`, `createOrganization`, `updateOrganization`, `transitionOrgStatus`, `cancelSubscription`, `updateBreachStatus`, `reportBreach`, `updateTicketStatus` accept any platform admin incl. `analyst` | P1 | V1 REQUIRED | `middleware/platform-admin-auth.ts` (membership-only); grep `callerAdmin.role` across `handlers/platformadmin/*.ts`; MODULE_SPEC edge case "Support admin attempts feature flag change: blocked by permissions" | Add tier check (middleware option or per-handler) for mutating ops per MODULE_SPEC §6, after resolving the role-taxonomy mismatch (see §25 Q1). Coordinate with auth-rbac audit `[CROSS-MODULE RISK]` |
| M3-R9 / PA-5 | DB feature flags never enforced — no API middleware or frontend reads `feature_flag` table; toggles have zero product effect | P1 | V1 REQUIRED | grep `featureFlags` outside platformadmin: only `seed/layer-7-platform.ts`, env-var-based `core/feature-flags.ts` (different system), `app.ts` (registers env route) | Add a module-gate (API middleware or memberry module-visibility check) that consults `FeatureFlagRepository` with org-override-over-tier precedence |
| M3-R1 / AC-M03-001 / PA-6 | Impersonation view never happens: no identity swap (nothing consumes `ctx.impersonationSession` beyond write-block), no orange banner (memberry has zero impersonation code), impersonate-page search reads `org.members` which `listOrganizations.ts` doesn't return | P1 | V1 REQUIRED | `middleware/impersonation-guard.ts` (only sets context + blocks writes); grep `impersonat` in `apps/memberry/src`: empty; `apps/admin/src/routes/impersonate/index.tsx:46-56`; `handlers/platformadmin/listOrganizations.ts` | Implement identity resolution for impersonated requests, memberry banner w/ countdown + Exit, and a real user-search source (person search endpoint) |
| WF-022 / PA-10 | `inviteAdmin` creates `userId: crypto.randomUUID()`; `admin.invited` has no subscriber → no invite email, no claim flow, invited admin can never pass `platformAdminAuthMiddleware.findByUserId` | P1 | V1 REQUIRED | `handlers/platformadmin/inviteAdmin.ts:39,50-51`; grep `admin.invited` consumers: only registry + emit | Add invite-claim flow (bind real user id on accept) + email consumer for `admin.invited` |
| M3-R7 / AC-M03-006 | MFA not enforced for platform admins anywhere in production code | P1 | V1 REQUIRED | grep `mfa|twoFactor` in `middleware/platform-admin-auth.ts` + `handlers/platformadmin/`: empty; AC-M03-006 test only exercises a test-local helper | Enforce MFA in `platformAdminAuthMiddleware` (or Better-Auth policy) `[SHARED DEPENDENCY]` (Better-Auth twoFactor) |
| PA-8 / M3-R12 | No support-inbox UI: admin app has no tickets route; backend tickets reachable only via raw API | P1 | V1 REQUIRED | `apps/admin/src/routes/` listing (15 groups, no support/tickets); grep `Ticket` in admin routes: empty | Build `/admin/support` per m03 UX spec (after exposing ticket routes via TypeSpec → SDK) |
| PA-3 / 3.3, 3.4, PA-7 | No subscriptions/pricing/revenue UI — PRD-P0 billing capabilities unmanageable from the admin app | P1 | V1 REQUIRED (subscriptions/pricing); V1 RECOMMENDED (revenue dashboard) | grep `PricingTier|Subscription|Revenue` in `apps/admin/src`: empty; ver-3 `platform-admin/pricing.md` screen | Build subscriptions + pricing screens; wire `getRevenueAnalytics` |
| AC-M03-002 | Disable-module warning with affected-data count: no UI warning, no backend count endpoint | P2 | V1 RECOMMENDED | `routes/feature-flags/index.tsx`; no `affected` count API | Add after flag enforcement lands (warning is meaningless while flags do nothing) |
| AC-M03-003 / PA-4 | Dashboard lacks actionable-item cards; client-side aggregation over `limit:100` lists (wrong at scale); `getPlatformSummary` endpoint unused by dashboard | P2 | V1 RECOMMENDED | `apps/admin/src/routes/index.tsx:31-36` | Drive dashboard from `getPlatformSummary` + dedicated actionable-items payload |
| M3-R2 | Per-request audit of navigation during impersonation absent (only start/end logged) | P2 | V1 RECOMMENDED | `utils/audit-events.ts:55-56`; audit middleware is mutation-oriented | Log reads when `impersonationSession` present (both IDs) |
| PA-8 error paths | Reopen-on-officer-reply and reply notifications (in-app + email) missing | P2 | V1 RECOMMENDED | `addTicketComment.ts` (insert only); `updateTicketStatus.ts` (no notify) | Add reopen transition + notification emit |
| M3-R11 UI | Breach endpoints unwired; `routes/compliance/index.tsx` is a static placeholder | P2 | V1 RECOMMENDED | grep `Breach` in admin routes: empty; compliance route has no hooks | Wire breach list/report/status into compliance page |
| MODULE_SPEC In Scope "Member account merge" | No code exists | P2 | V2 DEFERRED / [NEEDS PRODUCT DECISION] | grep `merge` in platformadmin + person handlers: empty | Defer; confirm V1 necessity |
| PA-8 sort | Tickets sorted by `createdAt` only, not priority-then-age | P3 | V1 RECOMMENDED | `listTickets.ts:61` | Order by priority, then createdAt |
| PA-6 roles | Impersonate UI gated `['super']` but PRD/backend allow super+support | P3 | V1 RECOMMENDED | `routes/impersonate/index.tsx:15`; `startImpersonation.ts` `IMPERSONATION_ALLOWED_ROLES=['super','support']` | Align UI gate to super+support |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Env-var feature-flag system (`FF_*`) with public `/feature-flags` endpoint | `core/feature-flags.ts`; `app.ts:304`; `feature-flags-flow.hurl` | Not in m03 PRD (deployment-level flags) | Duplicate source of truth with DB `feature_flag` table; the only Hurl "feature flag" coverage tests this system, masking the unenforced DB one | Keep but clarify — rename/route-comment to avoid conflation; do not expand `[DO NOT OVERBUILD]` |
| Dashboard snapshot subsystem | `repos/dashboard-snapshot.schema.ts`, `dashboard.repo.ts` | m14-adjacent | Low | Keep |
| `getCommittee` / `listAllCommittees` under platformadmin | handlers + `platformadmin-extended-flow.hurl` | m19 committees surfaced at platform tier | Module-boundary blur | Keep but clarify ownership vs m19 `[NEEDS CONFIRMATION]` |
| `listPublicOrgs` (public org directory) | `listPublicOrgs.ts` + test | Not in m03 | Public-exposure surface | Keep; confirm intended public fields `[NEEDS CONFIRMATION]` |
| 2-hour `MAX_IMPERSONATION_DURATION_MS` ceiling in guard | `impersonation-guard.ts:~30` | PRD says 30 min (sessions are created with 30-min expiry; ceiling is defense-in-depth) | None — secondary bound | Keep |
| `exportDashboardReport` | handler + test; no UI consumer | m14 | Unwired | Keep; wire in m14/national audit scope |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| WF-015 Onboard association (PA-1) | Super | New association signs | create → configure locale/license/credit defaults → first org | Implemented (API+UI) | Minor | `createAssociation.ts` (super ✓), `routes/associations/` |
| WF-016 Provision org (PA-2) | Super | Association adds org | create org → invite officer → trial clock | Implemented; trial job ✓; officer-invite linkage `[NEEDS CONFIRMATION]` | RBAC (no role check) | `createOrganization.ts`, `jobs/trialExpiryMonitor.ts` |
| PA-3 Subscription trial→paid | Super | Trial nears end | view sub → record payment state → transition | Backend partial; **no UI** | Yes | `listSubscriptions.ts`, `cancelSubscription.ts`, `pastDueMonitor.ts` |
| WF-018 Feature flags (PA-5) | Super | Tier/org module change | toggle → immediate effect → data preserved | Write path only; **no effect** | Yes (P1) | `setFeatureFlag.ts`; no consumers |
| WF-019 Impersonation (PA-6) | Super/Support | Support diagnosis | search user → confirm → view-as w/ banner → exit/30-min | Session + write-block only; **no view-as, no banner, search broken** | Yes (P1) | `startImpersonation.ts`, `impersonation-guard.ts`, `routes/impersonate/index.tsx` |
| PA-8 Ticket resolution | Super/Support | Officer files ticket | inbox → reply/notes/status → SLA → resolve | Backend mostly; escalation job ✓; **no UI**, no reopen/notify | Yes (P1) | `app.ts:365-375`, `ticketSlaMonitor.ts` |
| WF-022 Admin team (PA-10) | Super | Staff change | invite → claim → role change → revoke (last-super guard) | Guards ✓; **invite dead end** | Yes (P1) | `inviteAdmin.ts:39`, no `admin.invited` consumer |
| M3-R11 Breach notification | Super | Breach discovered | report → 72h timeline → status updates → NPC notify | Backend + deadline job ✓; **no UI** | Yes (P2) | `reportBreach.ts`, `jobs/breachDeadlineMonitor.ts`, `routes/compliance/` placeholder |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| PA-6 step 2: find user by name/email/license | Working search | Missing | impersonate page filters `org.members` — field not in `listOrganizations` response | V1 REQUIRED | Search always empty `[NEEDS CONFIRMATION]` (static read; verify at runtime) |
| PA-6 step 5: switch to impersonated view + banner | API serves target's data; persistent banner | Missing | no `impersonationSession` identity consumer; no banner component | V1 REQUIRED | Core of the journey |
| PA-6 step 7: exit / auto-terminate | Exit button + countdown; expiry redirect | Partially Implemented | `endImpersonation.ts` ✓; admin page keeps session only in React state — lost on refresh, can't end | V1 RECOMMENDED | Add active-session lookup |
| PA-6 write attempt | 403 at API | Implemented | `impersonationWriteBlock` blocks POST/PUT/PATCH/DELETE | — | M3-R4 ✓ |
| PA-8 step 1: inbox sorted priority+age | Sorted inbox UI | Missing (UI) / Partially (sort) | no UI; `listTickets.ts:61` createdAt-only | V1 REQUIRED | |
| PA-8 reopen on officer reply | Auto-reopen resolved ticket | Missing | `addTicketComment.ts` insert-only | V1 RECOMMENDED | |
| PA-8 SLA breach auto-escalation | Notify supers | Implemented | `ticketSlaMonitor.ts:48-73` | — | Untested job behavior `[TEST GAP]` (job has `jobs/` tests? none found for ticketSlaMonitor) |
| PA-10 invite → claim | Invitee binds account | Missing | random userId; no consumer | V1 REQUIRED | |
| M3-R6 last-super removal/downgrade | Blocked | Implemented | `revokeAdmin.ts` countByRole; `updateAdmin.ts:36-49` | — | Tested ✓ |
| M3-R10 transitions | State machine + 90-day rule | Implemented | `transitionOrgStatus.ts:10-53` | — | Tested ✓ |
| M3-R11 72h alerting | Alert when deadline near | Implemented | `breachDeadlineMonitor.ts` | — | UI missing |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Provision association/org | Super | CRUD + lifecycle | Implemented (RBAC gap) | Yes | V1 REQUIRED | §4 rows 3.1/3.2 |
| Manage subscriptions/pricing | Super | UI-driven billing ops | Partially (API only) | Yes | V1 REQUIRED | §5 |
| Toggle modules per tier/org | Super | Effective flags | Partially (write-only) | Yes | V1 REQUIRED | §5 |
| Impersonate user read-only | Super/Support | View-as w/ banner | Partially | Yes | V1 REQUIRED | §5 |
| Resolve support tickets | Super/Support | Inbox + SLA | Partially (API only) | Yes | V1 REQUIRED | §5 |
| Manage admin team | Super | Invite/claim/change/revoke | Partially (invite dead) | Yes | V1 REQUIRED | §5 |
| Monitor platform health | Any admin | Actionable dashboard | Partially | Yes | V1 RECOMMENDED | §5 AC-M03-003 |
| Track breach 72h | Super | Report + countdown + UI | Partially (API+job) | Yes | V1 RECOMMENDED | §5 |
| Review audit trail | Super/compliance | Filterable log UI | Implemented | No | — | `routes/audit/index.tsx` + `listAuditLogs` |
| Org health outreach (PA-9) | Super/Support | Scores + outreach list | Partially (API only) | Yes | V1 RECOMMENDED | `getOrgHealthScores.ts`; no UI |
| Revenue analytics (PA-7) | Super | Revenue dashboard | Partially (API only) | Yes | V1 RECOMMENDED | `getRevenueAnalytics.ts`; no UI |
| National dashboard (m14) | Super/national officer | Analytics + export | Implemented (UI partial export) | Minor | V1 RECOMMENDED | audited fully under m14 scope |
| Member account merge | Super | Merge duplicates | Missing | Yes | V2 DEFERRED | MODULE_SPEC In Scope; no code; [NEEDS PRODUCT DECISION] |
| Platform-wide announcements | Super | Broadcast | In communication module | No | — | [SHARED DEPENDENCY] |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| G1: Admin-tier RBAC not enforced on ~30 mutating handlers (analyst/support can mutate flags, orgs, subs, breaches, tickets) | API/permissions | P1 | V1 REQUIRED | `platform-admin-auth.ts` membership-only; only 9 handlers check `callerAdmin.role`; MODULE_SPEC §6 | Privileged surface violates its own permission spec; insider misuse risk | Tier-check middleware/param per MODULE_SPEC §6 after role-taxonomy decision (§25 Q1). Overlap with auth-rbac audit noted — scope here is platform-admin ops only |
| G2: DB feature flags written but never enforced | API/backend + frontend | P1 | V1 REQUIRED | no consumer of `feature_flag` table outside platformadmin/seed | PA-5/M3-R9 control is a no-op; admins are misled about org access | Module-gate consulting flags (org override > tier) |
| G3: Impersonation journey non-functional end-to-end (no identity swap, no banner M3-R1, broken search, state lost on refresh) | API + both frontends | P1 | V1 REQUIRED | §5 rows; `apps/memberry/src` zero impersonation code | A flagship support capability silently does nothing except set a cookie that blocks the admin's own writes | Identity resolution + memberry banner + person-search; active-session endpoint |
| G4: Admin invite dead end (random userId; `admin.invited` unconsumed) | API/backend | P1 | V1 REQUIRED | `inviteAdmin.ts:39,50`; grep consumers | Team management (PA-10) cannot onboard a real second admin | Claim flow + email consumer |
| G5: MFA mandatory (M3-R7/AC-M03-006) unenforced | Security | P1 | V1 REQUIRED | grep empty; AC test is a stub | Spec-mandated control absent on the most privileged accounts | Enforce in admin middleware via Better-Auth twoFactor `[SHARED DEPENDENCY]` |
| G6: No admin UI for tickets, subscriptions, pricing, revenue, breaches, org-health (backend exists) | Frontend | P1 (tickets/subs/pricing) / P2 (rest) | V1 REQUIRED / V1 RECOMMENDED | grep across `apps/admin/src/routes`: zero consumers | PRD-P0 capabilities unusable by the actual persona | Expose hand-wired routes via TypeSpec first (G7), then build screens |
| G7: Ticket/breach/pricing/subscription routes hand-wired outside TypeSpec → absent from OpenAPI/SDK | API contract | P2 | V1 REQUIRED (enabler for G6) | `app.ts:358-375,165-169` `@hand-wired` comments | Spec-first violation; no generated hooks is the root cause of missing UI | Migrate to TypeSpec (`platform-admin.tsp`) per CLAUDE.md pipeline `[SHARED DEPENDENCY]` |
| G8: AC test suite is fake-green (tests test-local helpers, not production code) for AC-M03-001/003/005/006/007 | Tests | P1 | V1 REQUIRED | `ac-m03.platform-admin.test.ts:99-216` (`impersonationAccessLevel`, `canAccessAdminPanel` defined in-file) | Creates false confidence that ACs are met; makes safe fixing impossible | Rewrite ACs against real middleware/handlers before fixes `[TEST GAP]` |
| G9: AC-M03-002 disable warning missing | UI+API | P2 | V1 RECOMMENDED | no count endpoint/UI dialog | Data-loss-perception risk for org users | After G2 |
| G10: Dashboard not actionable (AC-M03-003); client aggregation over limit-100 lists | Frontend | P2 | V1 RECOMMENDED | `routes/index.tsx:31-36` | Wrong numbers at scale; misses PRD intent | Use `getPlatformSummary`/dedicated payload |
| G11: M3-R2 navigation logging during impersonation absent | Audit | P2 | V1 RECOMMENDED | only start/end events | PRD promises full navigation log | Read-audit when impersonation context present |
| G12: Ticket reopen-on-reply + reply notifications missing | API | P2 | V1 RECOMMENDED | `addTicketComment.ts`, `updateTicketStatus.ts` | SLA/officer-trust behavior in PRD | Add transition + notify emit |
| G13: MODULE_SPEC §6 role names (`super/admin/support`) vs code enum (`super/support/analyst`) mismatch | Spec | P2 | V1 REQUIRED (decision) | MODULE_SPEC §6; ROLE_PERMISSION_MATRIX | Can't implement G1 correctly until taxonomy is settled | [NEEDS PRODUCT DECISION] |
| G14: 10 handlers without unit tests (`addTicketComment`, `cancelSubscription`, `getCommittee`, `getNationalChapterDetail`, `getTicket`, `listBreaches`, `listPricingTiers`, `listTickets`, `reportBreach`, `updateTicketStatus`) | Tests | P2 | V1 REQUIRED (before fixes touching them) | dir listing `handlers/platformadmin/` | Unsafe to fix G1/G12 without coverage | `[TEST GAP]` |
| G15: Admin app zero E2E; Hurl admin/impersonation flows tolerate 401/403 ("route is wired and doesn't crash") | Tests | P2 | V1 RECOMMENDED | `impersonation-flow.hurl:11-14`, `platformadmin-extended-flow.hurl:10-11`; no Playwright in `apps/admin` | Privileged surface ships with no journey-level proof | `[TEST GAP]` add role-asserting contract runs + minimal admin E2E |
| G16: NAVIGATION_MAP stale (7 routes vs 15 groups, `INFERRED`) | Docs/verification | P3 | V1 RECOMMENDED | `NAVIGATION_MAP.md` frontmatter | Journeys verification rolls up wrong | Regenerate + human review |
| G17: listTickets sort createdAt-only | API | P3 | V1 RECOMMENDED | `listTickets.ts:61` | PA-8 step 1 | Order priority then age |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| PA-6 impersonation (admin → /impersonate → "View as" → memberry shows target's view with banner) | View-as with banner, countdown, exit | Search yields nothing (`org.members` absent from `listOrganizations` response); if started via API, API still serves the *admin's* identity on GETs; no banner exists; session state lost on page refresh so Exit becomes impossible until 30-min expiry | `routes/impersonate/index.tsx:46-66`; `handlers/platformadmin/listOrganizations.ts:28`; grep memberry: empty | P1 | E2E: start → assert target data + banner → write blocked (403) → exit; backend integration: identity swap on GET with imp cookie |
| PA-5 flag toggle (admin disables Events for an org) | Org users lose Events immediately; data preserved; warning shown | Flag row upserted; nothing anywhere reads it; org users unaffected; no warning | `setFeatureFlag.ts`; no consumers | P1 | Integration: org request to flagged-off module returns gated response; UI warning dialog test |
| PA-10 invite admin (operators page → Invite → invitee logs in) | Invitee receives email, claims, gains access | Row created with random `userId`; no email (no `admin.invited` consumer); invitee's login never matches → 403 "User is not a platform admin" | `inviteAdmin.ts:39`; `platform-admin-auth.ts` findByUserId | P1 | Integration: invite → claim → invitee passes admin middleware |
| PA-8 support inbox (/admin/support) | Two-panel SLA inbox | Route does not exist in admin app — 404/no nav entry | `apps/admin/src/routes/` listing | P1 | Route test + E2E once built |
| PA-4 dashboard actionable cards | "3 associations pending setup", SLA counts, payment failures | Generic counts computed client-side from capped list queries | `routes/index.tsx:31-36` | P2 | Component test asserting actionable cards from summary payload |
| Compliance page (/compliance) | Breach tracker with 72h countdown | Static placeholder, no data | `routes/compliance/index.tsx` (no hooks); `compliance.test.tsx` exists but can only assert placeholder | P2 | Wire + assert breach list render |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `feature_flag` table writes | fields saved but not enforced | no read consumers | Misleading admin control | Enforce (G2) |
| `getRevenueAnalytics`, `getOrgHealthScores`, `exportDashboardReport`, `getPlatformSummary` (dashboard), tickets/breach/pricing/subscription endpoints | APIs with no frontend consumers | grep `apps/admin/src`: zero hits | PRD personas can't reach P0 capabilities | Wire via TypeSpec→SDK→UI (G6/G7) |
| `impersonationSession` context | service set but not consumed (beyond write-block) | `types/app.ts:54`; no identity consumer | Journey broken | G3 |
| `admin.invited` domain event | event with no subscriber | `domain-events.registry.ts:471`; emit only | Invite dead end | G4 |
| Env-var `/feature-flags` endpoint | duplicate state source vs DB flags | `core/feature-flags.ts:57` | Conflation; hurl tests wrong system | Keep but clarify (§6) |
| Admin impersonate page member search | UI with no backend effect | filters nonexistent `org.members` | Always-empty search | Replace data source |
| `getAdminRole` "Security: platformAdminAuthMiddleware" | OK — wired and used by `apps/admin/src/main.tsx:40` | — | — | Keep |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `platform_admin.userId` not FK-bound to Better-Auth user at invite time (random UUID inserted) | schema/model + backend | `inviteAdmin.ts:39`; `platform-admin.schema.ts` platformAdmins | P1 | Claim flow binds verified user id (G4) |
| Ticket/breach/pricing/subscription endpoints absent from OpenAPI (`specs/api/dist/openapi/openapi.json`) — hand-wired with inline zod in `app.ts` | API contract | `app.ts:358-375` `@hand-wired` markers | P2 | Migrate to TypeSpec (G7) `[SHARED DEPENDENCY]` |
| Two feature-flag systems (env `FF_*` vs DB `feature_flag`) | API/state | `core/feature-flags.ts` vs `platform-admin.schema.ts` | P2 | Document separation; only DB flags are product flags |
| Admin dashboard derives metrics from `limit:100` list queries | UI/state | `routes/index.tsx:31-36` | P2 | Server-side summary |
| Impersonation session has no active-session lookup endpoint (find by token only, server-side) | API | `platform-admin.repo.ts:187-201`; no `GET /admin/impersonate/active` | P2 | Add active-session read or return session in `getAdminRole` |
| `listOrganizations` response lacks `members` that UI expects | API/UI contract mismatch | `listOrganizations.ts` vs `impersonate/index.tsx:46` | P1 (part of G3) | Person-search endpoint |
| Seed creates 1 ended impersonation session only | seed data | `seed/layer-7-platform.ts:280-291` | P3 | Add active-session fixture when testing G3 |
| Org lifecycle + 90-day cancelled window enforced in handler, not DB constraint | schema | `transitionOrgStatus.ts` | P3 | Acceptable for V1; note for db audit |

## 14. Permission / RBAC / Security Findings

(Scoped to platform-admin surface; broad RBAC is owned by the parallel auth-rbac audit — overlap flagged, not duplicated.)

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Analyst (read-only per ROLE_PERMISSION_MATRIX) can mutate feature flags, orgs, org status, subscriptions, breaches, tickets | admin tiers | §10 G1 | P1 | Tier checks per MODULE_SPEC §6 `[CROSS-MODULE RISK]` |
| MFA not enforced for platform admins (M3-R7) | admin auth | grep empty; AC-M03-006 stub | P1 | Better-Auth twoFactor gate in `platformAdminAuthMiddleware` `[SHARED DEPENDENCY]` |
| Impersonation write-block correctly applied globally (`app.use('*', impersonationWriteBlock())` at `app.ts:294`) before route handlers | impersonation | `app.ts:293-294` | — (positive) | Keep; add regression test against real middleware |
| `/admin/*` membership gate registered at `app.ts:343` ahead of generated + hand-wired admin routes | route guard | `app.ts:343`; generated routes mount `/admin/...` paths | — (positive) | Keep; add test that a non-admin user gets 403 on every /admin route (route-walk test) |
| `POST /support/tickets` deliberately authMiddleware-only (any user files ticket) | tickets | `app.ts:373` | P3 | Matches PRD; rate-limit exists globally — OK |
| Impersonation cookie `secure: true, sameSite Strict, httpOnly` ✓; token random 32B ✓ | impersonation | `startImpersonation.ts:60-67` | — (positive) | — |
| Admin app role gating is client-side only (`RequireRole`) — acceptable only if G1 server checks land | frontend | `apps/admin/src/lib/role-gate.tsx` | P2 | Server-side is the fix (G1); UI gate is UX |
| `getPlatformSummary` uses `authMiddleware({roles:["platform_admin"]})` (Better-Auth role string) while sibling routes rely on table lookup — two RBAC mechanisms on one surface | consistency | `generated/openapi/routes.ts` getPlatformSummary block | P2 | Converge on one mechanism during G1 `[CROSS-MODULE RISK]` |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Mutation auditing solid: x-audit per-route middleware on TypeSpec admin ops; handlers set auditResourceId/Description | admin actions (M3-R13) | `generated/openapi/routes.ts` audit wrappers; handlers | — (positive) | — |
| Hand-wired ticket/breach/pricing routes bypass the generated x-audit registry — audit coverage of these mutations depends on global audit middleware only | audit completeness | `app.ts:358-375` vs ADR-0007 pattern | P2 | Verify these mutations produce audit entries; migrate to TypeSpec (G7) `[NEEDS CONFIRMATION]` |
| Audit retention jobs: archive >365d, purge >7y; hash-chained entries | audit store | `handlers/audit/jobs/index.ts`, `audit.repo.ts:163` (sha256 chain) | — (positive) | — |
| Impersonation navigation (reads) not recorded (M3-R2) | impersonation history | §10 G11 | P2 | Read-audit under impersonation context |
| Breach timeline tracked with `notificationDeadline` + monitor | DPA 2012 | `breachDeadlineMonitor.ts:37` | — (positive) | UI exposure pending (G6) |

## 16. Knowledge Graph Findings

KG (`.understand-anything/knowledge-graph.json`, 2026-06-06) used as secondary evidence only; module boundaries it reports for platformadmin match the filesystem. Claims below were re-verified by direct inspection.

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Audit-index KG row: platform-admin = `handlers/platformadmin/ + audit/ + jobs/`, 45+1+7 handlers, apps/admin 15 route groups | `docs/aha/outputs/module-audit-index.md` §8/§10 | Matches direct count | — |
| Admin app "only 3 shared components, near-zero E2E" | audit index fe-admin row; `apps/admin/src/components/` (page-shell, skeletons) | Thin frontend platform; consistent with missing screens | Factor into G6 sizing |
| `feature_flag` table has no inbound edges from non-platformadmin modules | verified by grep (KG corroborates) | Confirms G2 | — |
| Post-Jun-6 changes not in KG | `docs/aha/kg/knowledge-graph-status.md` | KG-only claims would be unsafe | All findings re-verified in code `[NEEDS CONFIRMATION]` flags applied where static-only |

## 17. Domain Knowledge Findings

`/understand-domain` output not available for this run (`docs/aha/kg/domain-knowledge-status.md` present but no platform-admin-specific domain graph consulted). Domain expectations were taken from m03 PRD journeys + MODULE_SPEC workflows instead.

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Platform admin is the tenant-provisioning + monetization actor; its failures gate every other module's rollout (flags, subscriptions) | m03 PRD capabilities 3.1–3.5 all P0 | G2/G6 are not cosmetic — they block the platform business model | Prioritize G2, G6 enablers |
| Support impersonation is the primary diagnosis tool for a 3-person ops team | PA-6/PA-8 linkage ("Impersonate" button in ticket detail spec) | G3+G6 compound: no inbox and no working impersonation = support runs entirely outside the product | Treat G3 as one vertical slice with the inbox |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run.

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| No browser run executed; no evidence files saved | — | — | Runtime confirmations (impersonate search emptiness, dashboard numbers) remain static-inference | Re-verify G3 search behavior in a live run during fix phase `[BLOCKED BY ENVIRONMENT]` for this batch |
| Admin app has zero Playwright specs to inspect | Playwright (static) | `apps/admin/` (no e2e dir; only vitest `src/test/`) | Privileged surface unproven end-to-end | `[TEST GAP]` G15 |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `handlers/platformadmin/*.test.ts` (~30 files: createAssociation, createOrganization, transitionOrgStatus, inviteAdmin, updateAdmin, revokeAdmin, startImpersonation, endImpersonation, setFeatureFlag, deleteFeatureFlag, listFeatureFlags, getNationalDashboard, getPlatformSummary, getRevenueAnalytics, getOrgHealthScores, exportDashboardReport, createTicket, createPricingTier, updatePricingTier, getSubscription, listSubscriptions, updateBreachStatus, listPublicOrgs, …) | backend/unit | Handler logic incl. M3-R5/R6/R10 guards | Medium-High |
| `ac-m03.platform-admin.test.ts` | backend/unit (**stub**) | AC-M03-001/003/005/006/007 via **test-local helper functions**, not production code | Low — fake-green (G8) |
| `ac-m14.national-dashboard.test.ts`, `br-36.national-dashboard.test.ts`, `national-endpoints.test.ts`, `platformadmin.test.ts` | backend/unit | National/m14 + module smoke | Medium |
| `handlers/audit/{listAuditLogs,retention-compliance,repos/audit.repo,jobs/index}.test.ts` | backend/unit | Audit handler, retention, hash chain, jobs | High |
| `middleware` tests (platform-admin-auth / impersonation-guard) | not found in those dirs | — | Unknown `[NEEDS CONFIRMATION]` — guard behavior may be covered indirectly |
| `apps/admin/src/test/routes/{associations,audit,compliance,dashboard,events,feature-flags,members,verifications}.test.tsx` + `role-gate.test.tsx`, `router.test.ts`, `skeletons.test.tsx`, `utils.test.ts` | frontend/component | 8 of 15 route groups render/data states; role gate | Medium |
| `specs/api/tests/contract/{admin-flow,impersonation-flow,feature-flags-flow,platformadmin-extended-flow,audit,audit-side-effects,assoc-subscriptions-flow}.hurl` | contract | Route wiring; admin-flow does org/assoc/admin CRUD; impersonation/extended flows explicitly accept 401/403 ("don't crash") | Low-Medium |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Real AC-M03-006: non-MFA admin rejected by `platformAdminAuthMiddleware` | backend/unit + permission | Replace stub; gate G5 | Before |
| Real AC-M03-001/007: identity swap + write-block against actual middleware (request-level) | integration | Gate G3; current write-block has no direct middleware test found | Before |
| Tier-RBAC matrix test: analyst/support 403 on each mutating /admin op per MODULE_SPEC §6 | permission/RBAC | Gate G1; prevents regression | Before |
| Feature-flag enforcement: org request to disabled module gated; org override beats tier | integration | Gate G2 | Before |
| Invite→claim→login integration | integration | Gate G4 | Before |
| `addTicketComment` reopen-on-reply; `updateTicketStatus` notifications; `listTickets` priority sort | backend/unit | G12/G17; handlers currently untested | Before/During |
| Unit tests for the 10 uncovered handlers (G14 list) | backend/unit | Safe-fix baseline | Before touching each |
| `ticketSlaMonitor` / `breachDeadlineMonitor` job tests (escalation recipients, 72h window) | backend/unit | Jobs guard M3-R11/R12 with no coverage found | During |
| Admin E2E happy paths: login→dashboard, create org, toggle flag, audit log view; later support inbox + impersonation | E2E/Playwright | G15; privileged surface has zero browser proof | During (after UI fixes) |
| Contract: authenticated-super assertions for impersonation + extended flows (stop accepting 401/403) | contract | Hurl currently proves only "doesn't 500" | During |
| Route-walk test: non-admin gets 403 on every `/admin/*` path | permission/regression | Guards the `app.use` ordering invariant | Before |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| Better-Auth twoFactor for admin MFA (G5) | shared/platform | `core/auth.ts`, generated better-auth | MFA gate must hook auth core | `[SHARED DEPENDENCY]` coordinate with auth-rbac audit |
| Role taxonomy decision (super/admin/support vs super/support/analyst) | product decision | MODULE_SPEC §6 vs schema enum | Blocks G1 implementation shape | `[NEEDS PRODUCT DECISION]` |
| TypeSpec migration of hand-wired ticket/breach/pricing/subscription routes (G7) | shared/platform | `app.ts` hand-wired block; CLAUDE.md spec-first rule | Regenerates routes/validators/SDK; unblocks all G6 UI | `[SHARED DEPENDENCY]` follow `specs/api` pipeline |
| Feature-flag enforcement point (G2) touches request pipeline for all modules | cross-module | flags gate other modules' routes | Blast radius = every module router | `[CROSS-MODULE RISK]` design as opt-in middleware keyed by module name |
| Impersonation identity resolution (G3) touches `authMiddleware`/session resolution used platform-wide | cross-module | `middleware/impersonation-guard.ts` flow comment | Must not weaken normal auth | `[CROSS-MODULE RISK]` add only behind validated imp session |
| `admin.invited` email delivery via email/notifs module | cross-module | `handlers/email/`, `core/domain-event-consumers.ts` pattern | Consumer belongs in domain-event-consumers per CLAUDE.md P1.6 | module-local subscriber + email queue |
| Committees/national endpoints overlap m19/m14 | cross-module | `getCommittee`, `getNationalDashboard` in platformadmin | Ownership clarity for future split | document only; no move now `[DO NOT OVERBUILD]` |
| `feature_flag`, `platform_admin`, `impersonation_session`, `support_ticket`, `breach_incident`, `pricing_tier`, `subscription` tables | database/schema | `platform-admin.schema.ts` | Module-owned; G4 may need a claim-token column | flag for db audit if schema changes |

## 22. Raw Recommended Fix Ideas

(Not the fix order — input for prompt 03.)

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Settle role taxonomy; encode MODULE_SPEC §6 as tier middleware (e.g. `requireAdminTier(['super'])`) and apply to mutating admin ops | G1, G13 | P1 | V1 REQUIRED | RBAC matrix test | Decision first |
| Rewrite `ac-m03` tests against real middleware/handlers | G8 | P1 | V1 REQUIRED | the tests themselves | Do this first — it converts other fixes to TDD |
| Enforce MFA in `platformAdminAuthMiddleware` | G5 | P1 | V1 REQUIRED | unit + integration | `[SHARED DEPENDENCY]` |
| Feature-flag gate middleware + memberry module-visibility consumption; org-override precedence | G2 | P1 | V1 REQUIRED | integration | Design doc first re enforcement point |
| Impersonation vertical slice: person-search endpoint for impersonate page, identity resolution on imp-cookie GETs, memberry banner w/ countdown + Exit, active-session lookup | G3 | P1 | V1 REQUIRED | integration + E2E | One slice, per VERTICAL_TDD |
| Invite claim flow (claim token, bind userId) + `admin.invited` email subscriber | G4 | P1 | V1 REQUIRED | integration | |
| Migrate tickets/breaches/pricing/subscriptions to TypeSpec; regenerate SDK | G7 (enables G6) | P2 | V1 REQUIRED | contract | Mechanical but wide |
| Build admin screens: support inbox, subscriptions, pricing; wire compliance breaches; wire revenue + org health | G6 | P1/P2 | V1 REQUIRED / V1 RECOMMENDED | component + E2E | After G7 |
| Ticket reopen-on-reply, reply notifications, priority+age sort | G12, G17 | P2/P3 | V1 RECOMMENDED | unit | |
| Dashboard from `getPlatformSummary` + actionable cards | G10 | P2 | V1 RECOMMENDED | component | |
| Read-audit during impersonation (both IDs) | G11 | P2 | V1 RECOMMENDED | unit | |
| Backfill 10 missing handler unit tests | G14 | P2 | V1 REQUIRED (pre-fix) | unit | |
| Regenerate NAVIGATION_MAP; sync MODULE_SPEC §6 role names | G16, G13 | P3/P2 | V1 RECOMMENDED | — | Doc-only |
| Align impersonate UI gate to super+support | §5 last row | P3 | V1 RECOMMENDED | component | One-liner |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Member account merge | `V2 DEFERRED` + `[NEEDS PRODUCT DECISION]` | In MODULE_SPEC scope but zero code, zero journey pressure; complex person-graph surgery |
| LaunchDarkly/Unleash-style targeting, gradual rollouts, percentage flags | `DO NOT ADD` `[DO NOT OVERBUILD]` | core/feature-flags.ts comment is right — tier+org boolean matrix is the V1 spec |
| Full SLA analytics bar (avg response/resolution, compliance rate) on support inbox | `V2 DEFERRED` | Build the inbox first; metrics need accumulated data |
| Auto-escalation policies UI / configurable SLA matrices | `DO NOT ADD` | Hard-coded SLA matrix in `createTicket.ts` matches M3-R12 |
| Impersonation session extension / longer windows | `DO NOT ADD` | M3-R3 explicitly forbids extension |
| Moving committees/national handlers out of platformadmin | `DO NOT ADD` (now) `[DO NOT OVERBUILD]` | Mega-module-split class of work; deferred per ROADMAP/ADR-0010 |
| Mobile layouts for admin app | `DO NOT ADD` | MODULE_SPEC Out of Scope (desktop only) |
| Replacing env-var FF system | `V2 DEFERRED` | Harmless once documented; removal is churn |

## 24. Audit Decision

**FAIL**

The backend skeleton is substantial and several hard rules are genuinely enforced (M3-R3/R4/R5/R6/R10 with real tests; SLA + breach + trial jobs; audit retention with hash chaining). But the module's defining V1 workflows are not reliable: admin-tier permissions exist on paper only for ~30 mutating endpoints (G1); feature flags — the platform's monetization lever — are write-only (G2); impersonation cannot actually impersonate and shows no banner (G3); admin invites can never log in (G4); spec-mandated MFA is absent (G5); and the PRD-P0 billing/support capabilities have no UI (G6). Compounding this, the AC test suite is fake-green (G8), so the module *appears* verified while none of AC-M03-001/002/003/006 hold in production code. That combination — P1 permission/security gaps plus untrustworthy acceptance coverage on the platform's most privileged surface — blocks reliable V1 use.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Is the admin role taxonomy `super/support/analyst` (code + ROLE_PERMISSION_MATRIX) or `super/admin/support` (MODULE_SPEC §6)? Which tier maps to each §6 row? | `[NEEDS PRODUCT DECISION]` | G1 cannot be implemented until the matrix is unambiguous | Product (Elad) |
| Q2: Where should DB feature flags be enforced — API request gate, frontend module visibility, or both — and what does a "gated" response look like? | `[NEEDS PRODUCT DECISION]` | Shapes G2's blast radius across all module routers | Product + Eng |
| Q3: Is impersonation V1 expected to render the target's memberry view (identity swap), or is a read-only data console acceptable for V1? | `[NEEDS PRODUCT DECISION]` | Determines G3 size (auth-core change vs admin-only viewer) | Product |
| Q4: Should support-inbox/pricing/subscription UIs land in V1, given the 3-person ops team currently operates via API/seed? | `[NEEDS CONFIRMATION]` | G6 is the largest UI work block | Product |
| Q5: Do hand-wired ticket/breach/pricing mutations actually emit audit entries today (global middleware vs per-route registry)? | `[NEEDS CONFIRMATION]` | M3-R13 completeness | Eng (verify at runtime) |
| Q6: Is the impersonate-page member search confirmed empty at runtime (static read says `org.members` is never returned)? | `[NEEDS CONFIRMATION]` `[BLOCKED BY ENVIRONMENT]` | Confirms G3 severity; needs a live run | Eng |
| Q7: Member account merge — V1 or V2? | `[NEEDS PRODUCT DECISION]` | MODULE_SPEC lists it In Scope with zero code | Product |
| Q8: Is `analyst` meant to see national/revenue analytics only, or all read endpoints? | `[NEEDS PRODUCT DECISION]` | Read-side of the G1 matrix | Product |

## 26. Notes for Gap Plan Organizer

- **Write tests first, and fix the fake-green suite before anything else**: rewriting `ac-m03.platform-admin.test.ts` against real middleware/handlers (G8) plus the RBAC-matrix, MFA, flag-enforcement, and invite-claim integration tests (§20) converts every P1 fix into honest TDD. Do not let existing green AC tests be cited as evidence.
- **Truly-V1 P1 fixes, suggested grouping**: (1) G8 test rewrite → (2) G1 tier RBAC (blocked by Q1) + G5 MFA (shared Better-Auth dependency) → (3) G4 invite claim → (4) G2 flag enforcement (blocked by Q2, cross-module blast radius) → (5) G3 impersonation slice (blocked by Q3) → (6) G7 TypeSpec migration → (7) G6 UI screens.
- **Product decisions that block fixing**: Q1 (role taxonomy) blocks G1; Q2 blocks G2; Q3 blocks G3; Q4 scopes G6. Batch them into one decision session.
- **Risky shared dependencies**: G2 and G3 touch the global request pipeline (`app.use` chain in `app.ts:231-294,343`) — sequence them as isolated middleware with route-walk regression tests; G5 touches Better-Auth config; G7 regenerates `routes.ts`/SDK (never hand-edit generated files).
- **Selected P2s that are V1-completeness**: G7 (enabler), G14 (test backfill for files being touched), G12 (ticket reopen/notify), G13 (spec sync — cheap, do with G1).
- **Do not implement**: §23 items — especially no feature-flag platform upgrade, no impersonation extensions, no module relocation.
- **Database note**: only schema change anticipated is an invite-claim token/binding column on `platform_admin` (G4) — flag to the database-schema audit if/when it runs.
- **Cross-cutting candidates observed (do not expand here)**: dual RBAC mechanisms on one surface (table lookup vs `authMiddleware({roles})`), hand-wired-route audit coverage, and stub-AC test pattern may recur in other modules — feed to prompt 05.

---

Next recommended step:
Module/group: Platform Admin (+ admin app)
Module slug: platform-admin
Primary PRD/spec: docs/product/modules/m03-platform-admin.md + docs/product/modules/m03-platform-admin/MODULE_SPEC.md
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/platform-admin-gap-plan.md
