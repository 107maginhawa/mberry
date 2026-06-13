# AHA Module/Group Gap Plan: Membership Lifecycle

Date: 2026-06-11
Prompt: `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Membership Lifecycle |
| Module slug | membership-lifecycle |
| Type | Business Module |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/membership-lifecycle-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/m05-membership/MODULE_SPEC.md` (Spec v2.0, 2026-05-21) |
| Supporting PRDs/specs used | `docs/product/MODULE_SPEC.member.membership.md` (post-cutover, current), `docs/product/STATE_MACHINES.md` §1, `docs/quality/SCOPE.membership.md` (cutover plan, FINAL), `docs/product/modules/m05-membership/API_CONTRACTS.md` (not deep-read), CLAUDE.md handler-verb + extension conventions |
| PRD/spec coverage quality | Strong (but m05 MODULE_SPEC §10/§20 file-topology guidance is **Stale** — see §2) |
| Paths inspected | `services/api-ts/src/handlers/member/membership/` (handlers, utils, jobs, subscription), `services/api-ts/src/handlers/membership/` (4 legacy handlers + repos), `services/api-ts/src/handlers/association:member/repos/` (membership, institutional, status-history, chapters schemas/repos), `services/api-ts/src/generated/openapi/routes.ts` (membership route registrations + middleware chains), `services/api-ts/src/middleware/{auth,org-context}.ts`, `services/api-ts/src/core/auth/officer-checks.ts`, `services/api-ts/src/core/domain-event-consumers.ts`, `services/api-ts/src/generated/migrations/` (column greps), `specs/api/src/association/member/membership.tsp`, `specs/api/tests/contract/` (membership .hurl inventory), `apps/memberry/src/routes/{join,_authenticated/org/$orgSlug/officer}/`, `apps/memberry/src/features/membership/components/` |
| PRDs/specs inspected | m05 MODULE_SPEC (full), MODULE_SPEC.member.membership.md (full), STATE_MACHINES.md (full), SCOPE.membership.md (full) |
| KG used | Yes (status notes at `docs/aha/kg/knowledge-graph-status.md`; used as secondary context only — all claims below verified by direct code inspection) |
| KG refreshed | No |
| `/understand-domain` used | Yes (status notes at `docs/aha/kg/domain-knowledge-status.md`; product docs used as primary domain reference per its recommendation) |
| `/understand-domain` refreshed | No |
| Webwright used | No — static review sufficient; browser tooling skipped for batch run |
| Playwright/E2E inspected | Yes (inventory only — `apps/memberry/tests/e2e/cross-org-isolation.spec.ts`, `role-boundaries.spec.ts` etc.; not executed) |
| Existing tests inspected | ~22 colocated unit tests in `handlers/member/membership/`, `compute-membership-status.test.ts`, `graceToLapsed.test.ts`, `jobs/index.test.ts`, `handlers/membership/*.test.ts` (4 + repo tests), 9 Hurl files in `specs/api/tests/contract/member/membership/` + 8 legacy `assoc-*`/`membership-*` Hurl files |
| Cross-cutting audit reviewed | Not Available (none exists yet) |
| Database/schema audit reviewed | Not Available (none exists yet) |
| Limitations | Static review only — no server boot, no test execution, no DB introspection (migration files used as DB ground truth). Subscription sub-handlers (`subscription/`) and institutional/seat handlers inspected at inventory level, not line-by-line. Member transfer audited only to ownership-boundary depth (lives in `member/chapters/`). |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| m05 Membership MODULE_SPEC | `docs/product/modules/m05-membership/MODULE_SPEC.md` | PRD/module spec | Current for product rules; **Stale** in §10/§20 (describes 157-handler `association:member/` + 12–15 legacy handlers; actual topology is post-cutover `handlers/member/membership/`) | Primary source for workflows (WF-029–037), business rules (BR-01..23, M5-R*), state machine, ACs, permissions |
| member/membership handler spec | `docs/product/MODULE_SPEC.member.membership.md` | module spec (as-built) | Current (post-`member-membership-cutover`) | Authoritative file/route/ownership map; documents intentional legacy holdouts |
| State Machines | `docs/product/STATE_MACHINES.md` §1 | workflow spec | Current; **conflicts with m05 on RESIGNED actor** (self-service vs officer) | Authoritative state machine ("this document takes precedence") |
| Membership cutover scope | `docs/quality/SCOPE.membership.md` | implementation plan | Current (executed; § 10/§ 11 findings match code) | Explains why repos stay at `association:member/repos/` and `membership/repos/`; confirms hand-wired holdouts |
| m05 API contracts | `docs/product/modules/m05-membership/API_CONTRACTS.md` | API contract | Unknown (not deep-read; route shapes verified against generated routes.ts instead) | Secondary |
| Role/Permission Matrix | `docs/product/ROLE_PERMISSION_MATRIX.md` | acceptance criteria | Current (referenced via m05 §6) | Permission expectations (president/secretary 2FA on import/approve) |

Conflict to resolve: m05 §8 says LAPSED→ACTIVE reinstatement and EXPIRED/REMOVED terminal; TypeSpec `membership.tsp:930` says reinstate is for "suspended or lapsed"; the implementation reinstates `removed`/`suspended` only. Three different answers — see Gap G-05.

## 3. Expected vs Actual

**Expected (m05 + STATE_MACHINES):** membership status is computed at query time from `dues_expiry_date` + flags, never stored as mutable (BR-01); full 10-state machine with terminal states EXPIRED/RESIGNED/DECEASED/EXPELLED irreversible; application workflow submit→review→approve (creates member, sends welcome email, generates dues invoice)/deny/waitlist; bulk CSV import with email/license cross-org matching and preview; reinstatement = lapsed member pays dues → active; officer suspension/restore; status history with changedBy/reason; per-org isolation (BR-21/M5-R10); import/approve restricted to President/Secretary with 2FA.

**Actual:**

- The 8 TypeSpec interfaces and ~40 generated operations exist and are routed (`routes.ts:691–1921`), plus 4 legacy admin-tier handlers at `handlers/membership/` and 3 hand-wired subscription routes — matches MODULE_SPEC.member.membership.md exactly. Structure is healthy; the split-brain flagged in the audit index is **documented intentional state**, not drift.
- BR-01 is implemented as a *hybrid*: a stored `status` column used by reads (`getMembership`, `listMemberships` return raw rows) + a pure `computeMembershipStatus()` + a write-side cache updater (`persistWithComputedStatus`) + a nightly recompute cron as "safety net". **The safety-net cron is broken**: its raw SQL selects `is_expired` and `is_pending_payment` columns that do not exist in the `membership` table (schema `membership.schema.ts:104–137` has neither; no migration adds them) — every nightly run will fail on the first batch query (G-01).
- Because `graceToLapsed` only selects rows already stored as `'gracePeriod'` (`graceToLapsed.ts:83`) and nothing else transitions stored `active`→`gracePeriod`, the automatic ACTIVE→GRACE→LAPSED chain is dead end-to-end on the primary read surface.
- Terminal states are partially modeled: schema has `dateOfDeath` but **no `resignedAt`/`expelledAt` columns**; `resignMembership` reuses `removedAt`, so every status recomputation reports a resigned member as `removed`, and `reinstateMembership` will happily resurrect them (G-04).
- SUSPENDED and EXPELLED are unreachable: no handler writes `suspendedAt` (only `reinstateMembership` clears it), `updateMembership` body excludes it, and `createDisciplinaryAction.ts` is unrouted (G-06).
- Approval creates a `pendingPayment` membership in a transaction but emits no event, generates no dues invoice, and triggers no welcome email (G-07).
- Org isolation is enforced by `orgContextMiddleware` (caller must be a member of the org they claim) but several mutation handlers never compare the *target record's* org to the caller's org (G-02), and `getMembershipApplication` has no ownership check at all (G-03).
- Bulk CSV import per WF-031 is not implemented: `importRosterMembers` accepts a JSON array, with no CSV parsing, no email/license matching, no preview step, no row cap, and there is no frontend import wizard (G-13).

`[INFERRED]` items and open conflicts are labeled inline below.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BR-01 / WF-032 status computation | Computed at query time from dues_expiry_date; never stored mutable | Hybrid: pure fn + stored cache; primary reads return stored cache; nightly recompute cron SQL references nonexistent columns | roster/member views read API status | `compute-membership-status.ts`; `getMembership.ts` / `listMemberships.ts` return raw rows; `statusRecomputeCron.ts:59–79` broken SQL | `membership.status` column (`membership.schema.ts:119`); no `is_expired`/`is_pending_payment` in any migration | `compute-membership-status.test.ts` (strong, pure fn only); **no cron test** | Partially Implemented | **G-01, G-10** |
| BR-02 grace period 0–90, per org | Per-org configurable, default 30 | Per-membership `gracePeriodDays` int, default 30, no 0–90 range validation in validator (`MembershipUpdateRequestSchema` has bare `z.number().int()`) | — | `graceToLapsed.ts:84` SQL uses per-row value | `grace_period_days` default 30 | BR-02 tests in compute fn test | Implemented (validation gap minor) | P3 |
| BR-03 / M5-R1 state machine | Only valid transitions allowed | `MEMBERSHIP_VALID_TRANSITIONS` exists; used by `terminateMembership` only; resign/decease use ad-hoc TERMINAL_STATUSES guard; reinstate uses its own allowlist contradicting the table (`expired→active`, `removed→active` in table vs spec terminal) | — | `status-transitions.ts:81–92`; `terminateMembership.ts`; `reinstateMembership.ts:30` | — | `status-transitions.test.ts` | Partially Implemented | **G-04, G-05** |
| BR-04 tier/category cannot delete with members | Block delete, deactivate instead | `deleteMembershipTier` does a hard delete with no member-count gate; `countMembersInCategory` (BR-04 gate) exists in repo but has **zero consumers**; no category delete op exists | — | `deleteMembershipTier.ts:25`; `membership.repo.ts:310` unwired | FK `memberships.tierId → membership_tier.id` will make the delete fail with raw FK error (500) instead of friendly 409 | none | Partially Implemented | **G-18** |
| BR-21 / M5-R10 cross-org isolation | Status change in org A never affects org B; no leakage | orgContext verifies caller's own org membership, but approve/deny/resign/terminate/decease/reinstate/renew/update/delete handlers do not check target record's org | — | `approveMembershipApplication.ts` (no org compare; contrast `bulkApproveMembershipApplications.ts:56` which does), lifecycle handlers (none compare) | — | `bulkApproveMembershipApplications.test.ts` covers bulk org scope; nothing for single ops | Partially Implemented | **G-02** |
| BR-22 / M5-R2 / WF-037 / AC-M05-004 cross-org matching + license normalization | Match by email (case-insensitive) or normalized license; ambiguous → human review | **Not implemented anywhere** (grep for normalization/matching: zero hits) | no import wizard | `importRosterMembers.ts` does raw inserts only | no match-staging table | none | Missing | **G-14** |
| BR-23 license format validation | PRC regex validation | Not in membership module (license entities live in credentials module) `[CROSS-MODULE RISK]` | — | — | — | — | Unclear | defer to documents-credentials audit |
| M5-R5 duplicate application block | One pending application per org per member | Duplicate check filters `status: 'submitted'` only — an `underReview` application does not block a duplicate | join flow | `createMembershipApplication.ts:34–40` | no unique constraint on applications (`membership.schema.ts:140–162`) | none for this handler | Partially Implemented | **G-11** |
| WF-029 application review (approve → member + welcome email + dues invoice) | Approve creates member, sends welcome email, generates first dues invoice | Approve creates `pendingPayment` membership in tx; **no invoice generation, no welcome email, no domain event** (`membership.created` is only emitted by `invite/claimInvite.ts:118`) | `application-list.tsx` approve/deny/bulk UI exists | `approveMembershipApplication.ts:46–72` | — | `approveMembershipApplication.test.ts`; `application-approval-flow.hurl` | Partially Implemented | **G-07** |
| WF-030 member roster | List/search/filter/bulk actions | `listMemberships` (org-filtered, status filter, pagination; no `q` search wired) + legacy `listOrgMembers` (joined person data, computed status); frontend `member-table.tsx` exists | `officer/roster` routes + `member-table.tsx` | `listMemberships.ts`; `membership/listOrgMembers.ts` | — | `member-table.test.tsx`, `roster-crud.hurl` | Implemented (two surfaces disagree on status — see G-10) | G-10 |
| WF-031 / AC-M05-003 bulk CSV import | CSV upload, per-row validation, preview (new/linked/invalid), confirm, claim emails, 500-row cap, <30 s | JSON-array import; no CSV, no preview, no matching, no row cap; emits `membership.imported` (welcome consumer exists at `domain-event-consumers.ts:335`); no frontend wizard | **no import UI found** in `apps/memberry` | `importRosterMembers.ts:37–46` | — | `importRosterMembers.test.ts` | Partially Implemented | **G-13** |
| WF-033 membership categories | CRUD per org | `listMembershipCategories` + `upsertMembershipCategory` only (delete intentionally dropped post-Wave-7 per MODULE_SPEC.member.membership §7) | `membership-categories.tsx` + `category-editor.tsx` | routes.ts category ops | `membership_category` table | `category-editor.test.tsx`, `category-upsert.hurl` | Implemented | — |
| WF-034 member directory | Privacy-filtered searchable list | Lives in `handlers/member/directory/` `[SHARED DEPENDENCY]` — out of scope here | `directory/` routes | — | — | — | Not audited here | defer to chapters-directory audit |
| WF-035 / AC reinstatement | Lapsed member pays dues → Active | Payment path: `membershipLifecycle.settlePayment` extends expiry + recomputes (implemented). `reinstateMembership` op instead reinstates `removed`/`suspended` — contradicts m05 (removed is terminal) and TypeSpec doc ("suspended or lapsed") | member-detail has reinstate action | `reinstateMembership.ts:30–43`; `membership-lifecycle.ts:111–178` | — | `reinstateMembership.test.ts`, `membership-lifecycle.hurl` | Partially Implemented / Unclear | **G-05** |
| WF-036 / M5-R6 / AC-M05-006 member transfer | Inter-org transfer, dual approval, history preserved | Implemented as **chapter affiliation transfer** in `handlers/member/chapters/` (create/approveBySource/approveByTarget/deny/complete) `[CROSS-MODULE RISK]` — whether it satisfies m05's inter-org semantics not audited here | — | `member/chapters/*AffiliationTransfer*.ts`; `chapters.schema.ts:51` | `affiliation_transfer` table | `transfer-lifecycle.test.ts`, `assoc-affiliation-transfers-flow.hurl` | Implemented (ownership: chapters module) | defer verification to chapters-directory audit |
| Suspension (ACTIVE/GRACE/LAPSED→SUSPENDED, SUSPENDED→ACTIVE) | Officer suspends/restores | **No write path sets `suspendedAt`** — no suspend op in TypeSpec; `updateMembership` body excludes it; `createDisciplinaryAction.ts` unrouted | member-detail renders 'suspended' badge it can never see | grep: only `reinstateMembership` clears `suspendedAt` | column exists | none | Missing | **G-06** |
| EXPELLED via disciplinary process | President expels after M04 process | No write path; no `expelledAt` column; `createDisciplinaryAction.ts` exists but is not in registry/routes/app.ts | — | grep `'expelled'` writes: zero | enum value exists, no column | none | Missing | **G-06** |
| RESIGNED terminal + actor | Terminal; actor conflict (m05: officer / STATE_MACHINES: member self-service) | `resignMembership` works but stores `removedAt` (no `resignedAt` column) → recomputation reports `removed`; reinstate can resurrect; route requires `association:admin` so members cannot self-resign | no self-resign UI | `resignMembership.ts:59–63`; `reinstateMembership.ts:30` | no `resigned_at` column | `resignMembership.test.ts` | Partially Implemented | **G-04** + `[NEEDS PRODUCT DECISION]` (actor) |
| EXPIRED state (LAPSED→EXPIRED threshold) | Automatic after configurable threshold; terminal | `isExpired` exists only as a computed-fn input flag; no schema column, no job sets it, no configurable threshold; transitions table even allows `expired→active` | — | `compute-membership-status.ts:36`; cron selects nonexistent `is_expired` | no column | compute fn tests reference flag | Missing (state unreachable) | **G-01/G-06**, `[NEEDS PRODUCT DECISION]` on threshold |
| MembershipStatusHistory (changedBy, reason) | Every transition recorded; reason required for officer changes | Table + schema exist; **only** `graceToLapsed` job and dues payment repo write it; resign/terminate/decease/reinstate/approve write nothing | — | `status-history.schema.ts`; grep consumers | `membership_status_history` migration 0032 | none for officer paths | Partially Implemented | **G-08** |
| 10b domain events (MembershipApproved, Suspended, StatusChanged, Resigned, Deceased, Imported) | Published per spec | `membership.status.changed` emitted by resign + decease; `membership.imported` by import; `membership.created` only by invite-claim; Approved/Suspended events absent | — | handlers + `domain-event-consumers.ts:310–363,1075` | — | `domain-event-consumers.test.ts` | Partially Implemented | G-07 |
| Permissions §6 (import/approve = president/secretary + 2FA) | 403 otherwise; 2FA enforced | `requirePosition([SECRETARY, PRESIDENT])` on create/approve/bulk/deny/import/update membership; 2FA enforced for privileged titles in production (`officer-checks.ts:99–107`). But renew/reinstate/delete tier/delete membership rely only on global `association:admin` role | — | routes.ts middleware chains; handler-level requirePosition | — | `officer-admin.test.ts` (cross-domain) | Partially Implemented | G-02 |
| AC-M05-001 no duplicate accounts on import | Existing email → link not duplicate | Missing (no matching at all) | — | `importRosterMembers.ts` | — | none | Missing | G-14 |
| AC-M05-002 status computation correctness | Life always active, zero grace, suspended override, pending | Pure fn correct and well tested; broken at the integration layer (G-01/G-10) | — | compute fn | — | strong unit tests | Implemented but Untested (integration) | G-01 |
| AC-M05-007 bulk approve org scope | Per-record rejection of other-org applications | Implemented in bulk handler (OPS-03) — but the **single** approve/deny lack the same check | applications UI | `bulkApproveMembershipApplications.ts:56–62` | — | bulk test exists | Partially Implemented | G-02 |
| §15 error: duplicate application → 409 | 409 with message | 409 ConflictError (submitted-only check) | join flow shows error | `createMembershipApplication.ts:39` | — | none | Implemented (scope gap G-11) | G-11 |
| §16 perf (roster <500 ms, import 500 rows <30 s) | — | Not measurable in static review | — | — | — | none | Unclear `[BLOCKED BY ENVIRONMENT]` | — |
| §17 observability events/metrics | membership.* log events + 4 metrics | Audit middleware via x-audit on all ops (routes.ts); spec-named structured log events/metrics not implemented as specified | — | `@extension("x-audit", ...)` in membership.tsp | — | — | Partially Implemented | P3 |
| §18 feature flags (transferEnabled, bulkImportV2) | Flags exist | Not found in membership handlers | — | grep: none | — | — | Missing | Not Required for V1 (flags premature) `[DO NOT OVERBUILD]` |
| Application waitlisted / underReview transitions | officer opens → underReview; capacity → waitlisted | No write path sets `underReview` or `waitlisted` (update body only personId/orgId/tierId/date) | — | `validators.ts:6613–6618`; approve/deny accept both submitted and underReview | enum values exist | none | Partially Implemented | **G-19** (P3) |
| Institutional membership + seats (member.membership spec §1) | CRUD + allocate/revoke seats | Implemented with tests + hurl | institutional-membership-form/table, seat-management-panel | handlers + routes | `institutional-membership.schema.ts` | colocated tests + `seat-allocation-flow.hurl` | Implemented | — |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| BR-01 safety net (WF-032) | G-01: `statusRecomputeCron` raw SQL selects `is_expired`, `is_pending_payment` — columns that do not exist in `membership` (no schema field, no migration) → job fails every nightly run; with reads serving the stored cache, automatic ACTIVE→GRACE→LAPSED transitions never happen on the primary surface | **P0** | V1 REQUIRED | `statusRecomputeCron.ts:59–79` vs `membership.schema.ts:104–137`; `grep is_expired src/generated/migrations/` → 0 hits; `graceToLapsed.ts:83` requires stored `'gracePeriod'`; `getMembership.ts`/`listMemberships.ts` return stored rows | Fix cron SQL to select only real columns (derive pendingPayment from stored status, drop isExpired until modeled); add an integration test that runs the query against a real schema; decide stored-cache vs compute-on-read policy (G-10) |
| BR-21/M5-R10 + ROLE_PERMISSION_MATRIX | G-02: single `approveMembershipApplication`/`denyMembershipApplication` and all membership lifecycle mutations (`resign`, `terminate`, `decease`, `reinstate`, `renew`, `updateMembership`, `deleteMembership`, `updateMembershipApplication`) never verify the target record's `organizationId` equals the caller's org → an officer/admin of org A can mutate org B's records by ID | **P1** | V1 REQUIRED | `approveMembershipApplication.ts` (no compare) vs `bulkApproveMembershipApplications.ts:56–62` (has it); lifecycle handlers (none compare); `middleware/auth.ts` roles are global (`userHasRole` splits `session.user.role`); `org-context.ts` validates only the caller's own org claim | Add `record.organizationId !== ctx.get('organizationId') → 403/404` to each handler (pattern already exists in `getMembership.ts:30–33`); add cross-org regression tests |
| Application privacy | G-03: `getMembershipApplication` route allows `user:owner` and the middleware delegates ownership to the handler, but the handler checks only session → IDOR: any authenticated user can read any application (personId, tier, denialReason) | **P1** | V1 REQUIRED | `routes.ts:715–719` (`roles: ["association:admin", "user:owner"]`); `middleware/auth.ts:205–212` (ownership delegated); `getMembershipApplication.ts:16–17` (no further check) | Enforce `application.personId === session person OR caller org-officer of application.organizationId` |
| State machine integrity (BR-03) | G-04: no `resignedAt`/`expelledAt` columns; `resignMembership` stores `status='resigned'` + `removedAt` → every recomputation (`withComputedStatus`, legacy `listOrgMembers`) reports `removed`; `reinstateMembership` accepts computed `removed` → resigned members can be resurrected and their terminal status silently overwritten | **P1** | V1 REQUIRED | `resignMembership.ts:59–63`; `compute-membership-status.ts:59–62`; `reinstateMembership.ts:30`; `membership-status-middleware.ts:32–34` ("LIF-04 fields — not yet in schema") | Add `resigned_at` (and `expelled_at` when expulsion lands) columns + migration; map handlers/computation to them; block reinstate from terminal stored statuses |
| WF-035 + STATE_MACHINES terminal rules | G-05: reinstate semantics 3-way conflict — spec says reinstatement is LAPSED→ACTIVE and REMOVED/EXPIRED are terminal; TypeSpec doc says "suspended or lapsed"; impl reinstates `removed`/`suspended` and rejects `lapsed`; transitions table additionally allows `expired→active` | **P1** | V1 REQUIRED (decide + align) | `reinstateMembership.ts:30`; `membership.tsp:930`; m05 §8; `status-transitions.ts:86–87` | `[NEEDS PRODUCT DECISION]` pick one semantics, then align TypeSpec doc, handler allowlist, transitions table, and STATE_MACHINES.md |
| Suspension + expulsion workflows | G-06: SUSPENDED and EXPELLED are unreachable — no API writes `suspendedAt`; no suspend/unsuspend operation exists; `createDisciplinaryAction.ts` is unrouted; EXPIRED equally unreachable (no column, no job, no threshold config) | **P1** | V1 REQUIRED (suspend); V2 DEFERRED (expelled/expired automation unless product confirms V1) | grep `suspendedAt` writes → only `reinstateMembership` clears it; `createDisciplinaryAction` absent from `registry.ts`/`routes.ts`/`app.ts`; no `expired` write path | Add `suspendMembership`/`unsuspendMembership` TypeSpec ops (or wire disciplinary flow); decide EXPIRED threshold or remove the state from V1 docs |
| WF-029 step 3 / 10b events | G-07: approval has no downstream effects — no dues invoice generated, no welcome email, no `MembershipApproved`/`membership.created` event (only `invite/claimInvite.ts:118` emits it); spec's M06/M07 integration dead on the main funnel | **P1** | V1 REQUIRED | `approveMembershipApplication.ts:46–72`; `domain-event-consumers.ts:310` (consumer exists, never fired on this path) | Emit `membership.created` (or a new `membership.approved`) after the tx; invoice generation behind dues-config presence (m05 §13 [VERIFY] case) `[CROSS-MODULE RISK]` with dues-payments |
| §7 MembershipStatusHistory | G-08: officer-initiated transitions (approve, resign, terminate, decease, reinstate, renew) write no `membership_status_history` rows; only the graceToLapsed job and dues settle path do | **P1** | V1 REQUIRED | grep `membershipStatusHistory` consumers → `graceToLapsed.ts:111–121`, `dues-payments.repo.ts` only | Insert history rows (fromStatus, toStatus, changedBy, reason) inside each transition tx |
| Record safety | G-09: `deleteMembership` hard-deletes a membership with no org-scope, no terminal-state, no position check; `membership_status_history.membershipId` FK is `onDelete: 'restrict'` so deletes 500 for any member with history and silently destroy records for members without | **P1** | V1 REQUIRED | `deleteMembership.ts:26`; `database.repo.ts:160–168` (hard delete); `status-history.schema.ts` restrict FK; m05 defines no delete-membership operation | Restrict to platform-admin or remove the op; soft-delete at minimum; map FK violation to friendly 409 |
| §13 re-entry from terminal states | G-12: re-application after resign/decease/expel → approve calls `createOne` with `(organizationId, personId)` unique index still occupied by the terminal row → raw unique-violation 500; `approveMembershipApplication` does no existing-membership check; `createMembership`'s check whitelists `removed`/`expired` but the insert still hits the same index | P1 | V1 REQUIRED | `membership.schema.ts:128–131` unique index; `approveMembershipApplication.ts:60–70`; `createMembership.ts:41–45` | Decide reuse-row vs archive-old-row strategy; handle in approve + create with friendly 409/recovery; add test |
| M5-R5 | G-11: duplicate-application check filters only `status='submitted'`; an `underReview` application doesn't block a duplicate; no DB uniqueness backstop | P2 | V1 RECOMMENDED | `createMembershipApplication.ts:34–40` | Check `inArray(status, ['submitted','underReview'])`; consider partial unique index |
| Application integrity | G-15: `createMembershipApplication` doesn't verify the tier belongs to the claimed org, and doesn't bind `body.personId` to the session user (any user can file applications for any personId); `updateMembershipApplication` lets `association:admin` rewrite `personId`/`organizationId` freely | P2 | V1 RECOMMENDED | `createMembershipApplication.ts:29–47`; `validators.ts:6613–6618`; `updateMembershipApplication.ts:25–29` | Validate `tier.organizationId === orgId`; force `personId = session person` for self-service path; drop personId/organizationId from update body in TypeSpec |
| WF-031 / AC-M05-001/003/004 | G-13: bulk import is JSON-array only — no CSV, no preview, no per-row field errors, no 500-row cap, no email/license matching, no frontend wizard | P2 | V1 RECOMMENDED (cap + per-row validation + matching); V2 DEFERRED (full multi-step wizard UI) | `importRosterMembers.ts:37–46`; no import UI under `apps/memberry/src` | Add row cap + structured row validation + email-match link (subset of G-14) before any pilot import |
| BR-22 / WF-037 | G-14: cross-org member matching and license normalization wholly missing | P2 | V1 RECOMMENDED (email match), V2 DEFERRED (license normalization + ambiguity queue) | grep normalization/matching → 0 hits | Implement email-based linking inside import first; defer license matching |
| BR-01 read consistency | G-10: two read surfaces disagree — `listMemberships`/`getMembership` return the stored cache; legacy `listOrgMembers` computes on read but omits `dateOfDeath` (deceased members would compute `removed`) and stored terminal statuses; `updateMembership` changes `duesExpiryDate` without recomputing the cache | P2 | V1 REQUIRED (pick one policy) | `listMemberships.ts:30–38`; `membership/listOrgMembers.ts:78–96`; `updateMembership.ts:33` | Apply `withComputedStatus` on the generated read paths (or commit to cache-on-write everywhere incl. updateMembership); feed full terminal inputs |
| Billing-cycle correctness | G-16: `renewMembership` hardcodes +1 year, ignoring org `billingFrequency` that `extendMembershipExpiry`/`settlePayment` honor | P2 | V1 RECOMMENDED | `renewMembership.ts:38–41` vs `membership-lifecycle.ts:144–175` | Route renew through `membershipLifecycle.extendMembershipExpiry` |
| BR-04 | G-18: `deleteMembershipTier` lacks the member-assignment gate (FK failure surfaces as 500, not friendly 409); `countMembersInCategory` repo gate unwired | P2 | V1 RECOMMENDED | `deleteMembershipTier.ts:25`; `membership.repo.ts:309–316` | Count memberships on tier before delete; return 409 with "retire instead" message |
| Application FSM completeness | G-19: `underReview` and `waitlisted` unreachable (no op sets them) | P3 | V2 DEFERRED | `validators.ts:6613–6618`; grep waitlisted writes → 0 | Defer unless officers need explicit "open/waitlist" actions |
| m05 §10/§20 doc accuracy | G-20: m05 MODULE_SPEC implementation sections describe pre-cutover topology (157-handler `association:member/`, `officerAuthMiddleware`) | P3 | V1 RECOMMENDED (doc fix) | m05 §10/§20 vs `MODULE_SPEC.member.membership.md` | Sync m05 implementation notes to post-cutover reality |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `deleteMembership` (hard delete of membership records) | `deleteMembership.ts`; routes.ts:1620 | Not in m05 §10 API list; spec stresses record preservation for terminal states | Record loss / FK 500s (G-09) | Keep but clarify — restrict to platform-admin and soft-delete, or Consider removal later |
| `deleteMembershipApplication` | routes.ts:730 | Not in m05 (spec has approve/reject/request-info) | Erases review trail | Keep but clarify (audit middleware attached); do not expand |
| Institutional memberships + seat allocation (8 ops) | handlers + `institutional-membership.schema.ts` | In MODULE_SPEC.member.membership.md §1, not in m05 | Low — tested + contract-covered | Keep |
| Subscription trio (`getMySubscription`, `upgradeSubscription`, `createSubscriptionCheckout`) hand-wired | `member/membership/subscription/`; `app.ts:590-595` per spec | Documented in MODULE_SPEC.member.membership.md (UJ-M03) | Low | Keep; do not expand |
| `MEMBERSHIP_VALID_TRANSITIONS` allowing `expired→active`, `pendingPayment→expired` | `status-transitions.ts:82–87` | Contradicts m05 §8 (EXPIRED terminal) | Confusion; table barely enforced anyway | `[NEEDS CONFIRMATION]` align with G-05 decision |
| `isExpired`/`isPendingPayment`/`expelledAt`/`resignedAt` as compute-fn inputs without schema backing | `compute-membership-status.ts:18–37` | Spec-shaped but schema never caught up ("LIF-04 fields — not yet in schema") | Phantom states; G-01/G-04 root cause | Keep the fn; finish the schema (G-04) — `[DO NOT OVERBUILD]` beyond resigned_at until expulsion is a real workflow |
| Legacy `/membership/*` admin-tier surface (4 handlers) | `routes.ts:3016–3044`; MODULE_SPEC.member.membership §7.1 | Documented intentional stay | Dual status semantics vs new surface (G-10) | Keep but clarify status-computation policy |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Join → active member (WF-029) | Prospect, Secretary/President | Signup + apply | signup → list public tiers → apply → officer review → approve → pendingPayment member → pay dues → active | Implemented through approve; post-approve invoice/welcome missing (G-07); pay path via dues module settlePayment works | Yes | `join/$slug.tsx:96–106`; `application-approval-flow.hurl`; `membership-lifecycle.ts:111–178` |
| Automatic status lifecycle (WF-032) | System | Daily crons | active→grace (recompute) → lapsed (graceToLapsed) → expired | **Broken**: recompute cron SQL invalid (G-01); grace→lapsed job starved; expired unreachable | Yes (P0) | `statusRecomputeCron.ts:59–79`; `graceToLapsed.ts:83` |
| Roster management (WF-030) | Officer | Officer opens roster | list/filter/search → member detail → actions | Implemented (list + detail + terminate/reinstate UI); search `q` filter not wired in repo; no suspend/resign/decease UI | Partial | `member-table.tsx`, `member-detail.tsx:10–11`; `membership.repo.ts:135–159` (no `q` condition) |
| Bulk import (WF-031) | President/Secretary (2FA) | CSV upload | upload → validate → preview → confirm → claim emails | JSON import endpoint + welcome-event consumer only; no CSV/preview/matching/UI | Yes | `importRosterMembers.ts`; `domain-event-consumers.ts:335` |
| Reinstatement (WF-035) | Member/Officer | Dues payment or officer action | lapsed + payment → active | Payment path implemented; explicit op semantics conflict (G-05) | Yes | `membership-lifecycle.ts`; `reinstateMembership.ts:30` |
| Member transfer (WF-036) | Source/target officers | Transfer request | request → dual approval → complete | Implemented in chapters module `[CROSS-MODULE RISK]` | Verify elsewhere | `member/chapters/*Transfer*.ts` |
| Cross-org matching (WF-037) | System | Import/add | normalize → match → flag ambiguous | Missing | Yes | grep → 0 hits |
| Terminal transitions (resign/decease/expel) | Officer/President | Officer action | guard → set status → void invoices → revoke sessions → history | resign/decease implemented (minus history G-08, resignedAt G-04); expel missing (G-06) | Yes | `resignMembership.ts`, `deceaseMembership.ts` |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Applicant lists tiers pre-membership | Public/pre-auth tier visibility | Implemented | `app.ts:322` `/public/org/:orgId/tiers` + org-context exemption `org-context.ts:41–42` | V1 REQUIRED | Working by design |
| Submit application | 409 on duplicate pending; bind to self | Partially Implemented | `createMembershipApplication.ts` (G-11, G-15) | V1 REQUIRED | |
| Officer opens application (→ underReview) | Status moves to underReview | Missing | no write path | V2 DEFERRED | Approve/deny accept submitted directly — acceptable V1 |
| Approve → member created | Member pendingPayment + history + events + invoice | Partially Implemented | `approveMembershipApplication.ts` (G-07, G-08, G-12) | V1 REQUIRED | |
| Deny with reason | Status denied + denialReason | Implemented | `denyMembershipApplication.ts` | V1 REQUIRED | Org-scope gap G-02 applies |
| Bulk approve with org scope | Per-record validation | Implemented | `bulkApproveMembershipApplications.ts:56` | V1 REQUIRED | The model for fixing single ops |
| First dues payment → active | Expiry extended, status recomputed, cache updated | Implemented | `membership-lifecycle.ts:111–178` (settlePayment via dues) | V1 REQUIRED | `[SHARED DEPENDENCY]` dues-payments |
| active→gracePeriod (automatic) | Daily recompute updates cache | Missing (broken) | G-01 | V1 REQUIRED | |
| gracePeriod→lapsed (automatic) | Daily job + history + notification | Implemented but starved upstream | `graceToLapsed.ts` | V1 REQUIRED | Works only if G-01 fixed |
| lapsed→expired (automatic) | Configurable threshold | Missing | no job/column/config | V2 DEFERRED | `[NEEDS PRODUCT DECISION]` threshold |
| Officer suspends / restores | suspendedAt set/cleared | Missing | G-06 | V1 REQUIRED | reinstate already handles restore half |
| Officer records resignation | resigned terminal + history | Partially Implemented | G-04, G-08 | V1 REQUIRED | actor conflict `[NEEDS PRODUCT DECISION]` |
| Officer marks deceased | deceased terminal, record preserved, invoices voided, sessions revoked | Implemented (minus history) | `deceaseMembership.ts` | V1 REQUIRED | Good pattern |
| President expels (disciplinary) | expelled terminal | Missing | `createDisciplinaryAction.ts` unrouted | V2 DEFERRED | `[NEEDS PRODUCT DECISION]` if pilot needs it |
| Re-application after terminal | New application → approve → new membership | Missing (DB conflict) | G-12 | V1 REQUIRED | |
| Renewal reminders | Reminder offsets from expiry | Implemented elsewhere | `findMembersExpiringOn` (`membership.repo.ts:206`) consumed by reminder processor | V1 REQUIRED | Relies on stored status filter — G-01 dependent |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Apply to join org | Prospective member | Signup → apply → track status | Implemented | G-11/G-15 minor | V1 REQUIRED | `join/$slug.tsx` |
| Review/approve/deny applications | Secretary/President | List, approve (full downstream), deny w/ reason, bulk | Partially Implemented | G-02, G-07 | V1 REQUIRED | `application-list.tsx` + handlers |
| View own membership status | Member | Accurate computed status | Partially Implemented | G-01/G-10 staleness | V1 REQUIRED | `getMembership.ts` |
| Officer roster view | Officer | Accurate statuses, filters, search | Partially Implemented | G-10; `q` unwired | V1 REQUIRED | `listMemberships.ts`, `member-table.tsx` |
| Manual member add | Officer | Create membership w/ tier validation | Implemented | G-12 edge | V1 REQUIRED | `createMembership.ts` |
| Bulk import roster | President/Secretary | CSV + matching + preview | Partially Implemented | G-13/G-14 | V1 RECOMMENDED (cap+validation+email match); V2 DEFERRED (wizard) | `importRosterMembers.ts` |
| Tier CRUD | Officer | CRUD + BR-04 delete gate | Partially Implemented | G-18 | V1 REQUIRED | tier handlers |
| Category list/upsert | Officer | Per-org categories | Implemented | — | V1 REQUIRED | category handlers |
| Suspend / restore member | Officer | suspendedAt set/cleared | Missing | G-06 | V1 REQUIRED | — |
| Resign / decease member | Officer | Terminal + record preserved | Partially Implemented | G-04/G-08 | V1 REQUIRED | resign/decease handlers |
| Expel member | President | Disciplinary terminal | Missing | G-06 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | unrouted handler |
| Renew membership manually | Officer | Extend per billing cycle | Partially Implemented | G-16 | V1 RECOMMENDED | `renewMembership.ts` |
| Reinstate member | Officer | Per decided semantics | Unclear | G-05 | V1 REQUIRED | `reinstateMembership.ts` |
| Institutional membership + seats | Officer | CRUD + allocate/revoke | Implemented | — | V1 REQUIRED | handlers + hurl |
| Org profile get/update | Officer (president for update) | Per-org profile | Implemented | — | V1 REQUIRED | org-profile handlers |
| Member self-resign | Member | Self-service resignation | Missing | actor conflict | `[NEEDS PRODUCT DECISION]` | STATE_MACHINES vs m05 |
| Subscription (org SaaS tier) | Officer | View/upgrade/checkout | Implemented (hand-wired) | — | V1 REQUIRED | `subscription/` |
| Status history visibility | Officer | View transition history | Missing (no read API; writes sparse) | G-08 | V1 RECOMMENDED (write side first) | status-history schema |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| G-01 broken nightly status recompute (nonexistent `is_expired`/`is_pending_payment` columns in raw SQL) | jobs / BR-01 | **P0** | V1 REQUIRED | `statusRecomputeCron.ts:59–79`; `membership.schema.ts`; migrations grep = 0 | The module's foundational invariant (WF-032/BR-01) silently fails nightly; expired members read as `active`; grace→lapsed starves; dues reminders/dunning/eligibility built on stale statuses | Repair SQL to actual columns; add real-DB integration test; reconcile with G-10 policy |
| G-02 missing target-org checks on single approve/deny + all lifecycle mutations | permissions / cross-org | P1 | V1 REQUIRED | handlers listed in §5; contrast `bulkApprove...ts:56` | Cross-org tampering of member records by any other org's admin/officer violates BR-21/M5-R10 and platform trust | Org-compare guard per handler + regression tests |
| G-03 application IDOR (`getMembershipApplication`) | permissions / PII | P1 | V1 REQUIRED | `routes.ts:715`; `getMembershipApplication.ts:16` | Applicant PII (person, tier, denial reason) readable by any logged-in user | Ownership/org check in handler |
| G-04 resigned state stored via `removedAt`; no `resigned_at` column; reinstate resurrects resigned members | schema / state machine | P1 | V1 REQUIRED | `resignMembership.ts:59–63`; `reinstateMembership.ts:30` | Terminal-state irreversibility (spec invariant) broken; status reporting wrong on recompute paths | Add column + migration; honor in compute + guards |
| G-05 reinstate semantics conflict (spec/TypeSpec/impl disagree; `expired→active` in transitions table) | workflow | P1 | V1 REQUIRED | `reinstateMembership.ts:30`; `membership.tsp:930`; m05 §8 | Officers can "reinstate" REMOVED (spec-terminal) members; lapsed members cannot be reinstated despite WF-035 | Product decision, then align 4 artifacts |
| G-06 SUSPENDED unreachable (no suspend op); EXPELLED/EXPIRED unreachable | API surface | P1 | V1 REQUIRED (suspend) / V2 DEFERRED (expel, expired) | grep suspendedAt writes; unrouted `createDisciplinaryAction.ts` | Spec P0 officer workflow (suspend/restore) cannot be performed; downstream consumers (dunning exclusions, eligibility) reference states that can never occur | Add suspend/unsuspend ops |
| G-07 approval emits no event, generates no invoice/welcome email | cross-module funnel | P1 | V1 REQUIRED | `approveMembershipApplication.ts`; `domain-event-consumers.ts:310` | New members approved via the main funnel get no payment instructions and no welcome — the core join→pay→active loop stalls | Emit event + invoice hook `[CROSS-MODULE RISK]` dues |
| G-08 officer transitions write no status history | audit/record | P1 | V1 REQUIRED | grep `membershipStatusHistory` consumers | Compliance/audit requirement in spec §7; disputes unresolvable | History insert in each transition tx |
| G-09 `deleteMembership` hard delete, unguarded | record safety | P1 | V1 REQUIRED | `deleteMembership.ts`; `database.repo.ts:160` | Destroys membership records (financial linkage) or 500s on FK restrict | Restrict/soft-delete/remove op |
| G-12 re-application after terminal state hits unique-index 500 | workflow edge | P1 | V1 REQUIRED | `membership.schema.ts:128`; `approveMembershipApplication.ts` | Spec-defined re-entry path (m05 §8/§13) fails with an opaque error | Reuse-or-archive strategy + friendly 409 |
| G-10 dual status semantics across read surfaces; updateMembership skips cache recompute | data consistency | P2 | V1 REQUIRED (policy) | `listMemberships.ts` vs `listOrgMembers.ts:78–96`; `updateMembership.ts:33` | Same member shows different statuses in member app vs admin surface | One policy, applied to both |
| G-11 duplicate application check misses `underReview` | validation | P2 | V1 RECOMMENDED | `createMembershipApplication.ts:34` | M5-R5 partially enforced | Widen filter |
| G-13/G-14 import: no CSV/preview/cap/matching | import workflow | P2 | V1 RECOMMENDED (cap, row validation, email match) / V2 DEFERRED (wizard, license normalization) | `importRosterMembers.ts` | Pilot onboarding (real associations import rosters) will duplicate accounts | Incremental hardening |
| G-15 application create/update integrity (tier-org, personId binding, org rewrite) | validation | P2 | V1 RECOMMENDED | §5 row | Foreign-tier memberships; application spoofing | Field-level guards |
| G-16 renew ignores billing frequency | financial correctness | P2 | V1 RECOMMENDED | `renewMembership.ts:38` | Quarterly/semi-annual orgs get a year of membership | Reuse expiry-extension util |
| G-18 tier delete lacks BR-04 gate | validation | P2 | V1 RECOMMENDED | `deleteMembershipTier.ts` | FK 500 instead of guided 409 | Count + 409 |
| G-19 underReview/waitlisted unreachable | workflow polish | P3 | V2 DEFERRED | validators | Minor FSM incompleteness | Defer |
| G-20 m05 §10/§20 stale topology | docs | P3 | V1 RECOMMENDED | m05 vs as-built spec | Misleads future implementers | Doc sync |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Member's dues expire → status shows Grace then Lapsed | Roster + member app reflect grace/lapsed within a day | Recompute cron fails (G-01); stored status stays `active` indefinitely on `listMemberships`/`getMembership`; legacy admin surface computes differently (G-10) | `statusRecomputeCron.ts:59–79`; `listMemberships.ts` | P0 | Integration test: seed expired membership, run cron handler against real schema, assert status + graceToLapsed pickup |
| Approve application → applicant pays → active | Approval triggers invoice + welcome; applicant sees payment path | Approval creates silent `pendingPayment` record; nothing notifies or bills the applicant | `approveMembershipApplication.ts` | P1 | Integration: approve → assert event emitted + invoice exists `[CROSS-MODULE RISK]` |
| Officer resigns a member, later another officer views roster | Member shows Resigned, cannot be reinstated | Recomputed surfaces show `removed`; reinstate succeeds and erases the resignation | `resignMembership.ts`; `reinstateMembership.ts:30` | P1 | Unit + contract: resign → reinstate must 4xx; status reads `resigned` everywhere |
| Resigned/deceased member re-applies (spec §13) | New application → approve → new PENDING membership | Approve throws unique-index violation → 500 | `membership.schema.ts:128`; `approveMembershipApplication.ts` | P1 | Contract test: terminal member re-applies → approve → expected handled outcome |
| Org A officer pastes org B membershipId into terminate call | 403/404 | 200 — membership removed, member's sessions revoked | `terminateMembership.ts` (no org compare) | P1 | Cross-org E2E/unit: foreign-org id → 403 |
| Officer suspends misbehaving member | Suspend action available | No API or UI path; member-detail renders a `suspended` badge that can never occur | grep suspendedAt; `member-detail.tsx:52` | P1 | After fix: suspend → status computed `suspended` → restore |
| Officer imports roster with an email that already has an account | Existing account linked, shown in preview | Duplicate person/membership rows or raw insert errors; no matching | `importRosterMembers.ts` | P2 | Import with known-email fixture → assert link-not-duplicate |
| Frontend member detail for resigned/deceased member | Correct terminal badge | `MemberStatus` type lacks resigned/deceased/expelled/expired → falls through styling/labels | `member-detail.tsx:46` | P3 | Component test with terminal statuses |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `createDisciplinaryAction.ts` | handler with no route | absent from `registry.ts`/`routes.ts`/`app.ts`; consumed only by `officer-admin.test.ts` | Expulsion workflow appears built but isn't | Wire via TypeSpec when expulsion becomes V1, else mark deferred in docs |
| `countMembersInCategory` (BR-04 gate) | repo method, zero consumers | `membership.repo.ts:309–316`; grep consumers = 0 | BR-04 believed enforced but isn't | Wire into tier/category delete path (G-18) or delete method |
| `isExpired` / `expelledAt` / `resignedAt` compute inputs | phantom fields | `compute-membership-status.ts:18–37`; no schema columns | States computed only from inputs nothing can supply | Finish schema (G-04) or trim inputs |
| `MEMBERSHIP_VALID_TRANSITIONS` | barely-enforced FSM table | only `terminateMembership.ts` calls `assertValidTransition` for membership | FSM exists on paper, guards are ad-hoc per handler | Adopt uniformly in lifecycle handlers during G-04/G-05 fix |
| `suspended` UI badge + `suspendedReason` field | frontend dead states | `member-detail.tsx:23,52` | Misleading UI affordances | Resolve with G-06 |
| `q` filter in `MembershipFilters` | declared filter, no condition built | `membership.repo.ts:40` (`q` in interface; `buildWhereConditions` ignores it) | Search appears supported but is a no-op | Implement or remove |
| `membership.bulkImportV2` / `membership.transferEnabled` flags (spec §18) | spec-only flags | grep = 0 | None | Do not add until needed `[DO NOT OVERBUILD]` |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Raw SQL in cron references columns absent from schema/migrations | jobs/migration | G-01 | P0 | Fix + integration test |
| `status` stored as mutable enum column while spec says compute-only; cache update is opt-in per handler (`updateMembership` skips it) | schema/state | `membership.schema.ts:119`; `updateMembership.ts:33` | P1 | Single write-path policy: all mutations through `persistWithComputedStatus` |
| No `resigned_at` / `expelled_at` columns; `removedAt` overloaded for three different terminal states | schema | `resignMembership.ts:59`; `deceaseMembership.ts` | P1 | Add columns + backfill migration (distinguish via current stored status) |
| `membership_application` lacks email/license columns (spec §7 says applicantEmail/license required; personId optional) — applications require pre-existing account by design of join flow | schema vs spec | `membership.schema.ts:140–162` vs m05 §7 | P2 | `[NEEDS PRODUCT DECISION]` accept account-first flow and amend spec, or add applicant fields |
| Unique `(organizationId, personId)` index blocks spec's re-entry path | schema | G-12 | P1 | Strategy decision + handler handling |
| `membership_tier_org_code_idx` is a plain index, not unique (SCOPE §10.H assumed unique) | schema | `membership.schema.ts:80–84` | P3 | Make unique if code uniqueness is a real invariant `[NEEDS CONFIRMATION]` |
| Cron OFFSET pagination over a result set it mutates (and FOR UPDATE SKIP LOCKED outside any transaction) | backend/jobs | `statusRecomputeCron.ts:71–79,134` | P2 | Keyset pagination (`WHERE id > last`) when fixing G-01 |
| `renewMembership` duplicate expiry math vs `expiry-extension.ts` | backend | G-16 | P2 | Consolidate |
| Legacy `listOrgMembers` computes status without `dateOfDeath`/stored-terminal inputs | API | `membership/listOrgMembers.ts:78–96` | P2 | Feed full inputs when fixing G-10 |
| `gracePeriodDays` unvalidated range (spec: 0–90) | API validation | `validators.ts:6847` | P3 | Add min/max in TypeSpec |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Target-record org never checked on single approve/deny + lifecycle mutations (cross-org write) | org isolation | G-02 | P1 | Org-compare guards + tests |
| `getMembershipApplication` IDOR via `user:owner` delegation with no handler check | object-level auth | G-03 | P1 | Ownership check |
| `deleteMembership`, `deleteMembershipTier`, `renewMembership`, `reinstateMembership` gated only by global `association:admin` role — no `requirePosition`, unlike create/approve/import/update | position enforcement | routes.ts:1634–1647,1916; handlers lack `requirePosition` | P1 | Apply position checks consistently (President for destructive ops per spec §6) |
| `association:admin` is a global comma-separated role on the user row (`utils/auth.ts:86–105`); one grant spans all orgs — org binding only via orgContext self-membership | role model | `middleware/auth.ts`; `seed/layer-2-users.ts:350` | P2 | `[SHARED DEPENDENCY]` auth-rbac audit should own this; membership handlers must not rely on the role for org scoping (reinforces G-02) |
| 2FA enforcement present for privileged titles in production via `requirePosition` (`officer-checks.ts:99–107`) — but ops missing `requirePosition` (above) also miss 2FA | 2FA | `officer-checks.ts` | P2 | Same fix as position gap |
| `createMembershipApplication` lets caller set arbitrary `personId` (application spoofing) | self-service binding | G-15 | P2 | Bind to session person |
| Inline `requirePosition` instead of `x-require-position` extension (CLAUDE.md P1.5 prefers extension for static title lists) | convention | `membership.tsp` has 0 `x-require-*`; handlers call inline | P3 | Migrate to extensions opportunistically — not a behavior bug |
| Session revocation on resign/terminate/decease implemented (P1-4) | positive finding | handlers' `revokeUserSessions` blocks | — | Keep |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Officer-initiated status transitions unrecorded in `membership_status_history` | membership lifecycle | G-08 | P1 | History insert in each tx; reason required for officer changes per spec |
| `deleteMembership`/`deleteMembershipTier` are hard deletes despite `baseEntityFields`-style audit posture; history FK `restrict` makes outcomes inconsistent (500 vs silent loss) | record retention | G-09; `database.repo.ts:160` | P1 | Soft-delete or restrict |
| Reinstate can overwrite a terminal stored status with a recomputed one (record falsification by accident) | terminal integrity | G-04 | P1 | Terminal guard on stored status |
| Deceased flow correctly preserves record, voids invoices, revokes sessions | positive finding | `deceaseMembership.ts` | — | Use as the template for resign/expel |
| x-audit middleware attached to every membership route (create/update/delete/approve/...) | audit trail | `membership.tsp:733–920`; routes.ts middleware | — | Keep |

## 16. Knowledge Graph Findings

KG (2026-06-06, `.understand-anything/knowledge-graph.json`) used as orientation only; it predates the final membership cutover commits, so file-level wiring below was verified by direct inspection. Not regenerated (per shared rules — direct inspection answered all wiring questions).

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| `computeMembershipStatus` is the mega-module's most-imported util — consumers in elections (`castVote.ts:46`), governance (`castBallot`, `createCandidate.ts:56`), credentials, dues, marketplace, booking, email | SCOPE.membership §10.E; verified greps | Any change to status computation has platform-wide blast radius; G-01/G-04 fixes must not change the pure fn's signature lightly | Treat `compute-membership-status.ts` as a frozen contract; fix inputs/schema around it |
| Eligibility checks (elections castVote, governance castBallot) compute status live from row flags, not the stored cache | `castVote.ts:46` | Voting eligibility is *less* affected by G-01 than roster views — partial mitigation | Note in fix plan; still test post-G-04 (resigned→computed `removed` blocks voting, which is acceptable) |
| Schemas intentionally live at `handlers/association:member/repos/` + `handlers/membership/repos/` (cutover § 4.2) while handlers live at `handlers/member/membership/` | SCOPE.membership §4.2; MODULE_SPEC.member.membership §3 | The audit-index "split-brain" concern is resolved/intentional for this module; CLAUDE.md module map remains stale `[CROSS-MODULE RISK]` (docs) | Doc-sync batch item; do not relocate schemas during fixes |
| `domain-event-consumers.ts` membership hooks consume repos at old paths — `membership.created` consumer can fire today but only invite-claim emits it | `domain-event-consumers.ts:310–363` | G-07 fix is cheap: emit the event the consumer already handles | Prefer emitting `membership.created` over new event types |

## 17. Domain Knowledge Findings

Domain reference: product docs (per `docs/aha/kg/domain-knowledge-status.md` recommendation); domain-graph.json not regenerated.

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| The join→approve→pay→active funnel is the platform's core loop; every downstream domain (dues, credits, governance, comms targeting, events gating BR-16) keys off membership status | m05 §22; STATE_MACHINES cross-module table | G-01 (status staleness) and G-07 (silent approval) degrade every downstream module | Fix order: G-01 → G-07 → G-02 |
| RESIGNED actor conflict: STATE_MACHINES §1 row says "Member (self-service)"; m05 §1/§5 says officer records resignation; impl is officer-only | both docs; routes.ts | Self-service resignation is a real association workflow (members quit); currently impossible | `[NEEDS PRODUCT DECISION]` — STATE_MACHINES claims precedence, but self-resign needs UI + safeguards |
| EXPIRED-vs-LAPSED distinction (m05 priority 5.5, configurable threshold) has no operational definition anywhere (no config key, no job) | m05 §8 vs code | State exists in enum/UI vocab but can never occur; analytics dashboards counting `expired` will always read 0 | `[NEEDS PRODUCT DECISION]` define threshold or drop EXPIRED from V1 vocabulary |
| PH dental association reality: rosters arrive as spreadsheets; cross-org license matching (PRC numbers) is the dedupe key | m05 AC-M05-004, MASTER_PRD context | G-13/G-14 will bite at first real pilot import | Email-match first (V1 RECOMMENDED), PRC normalization next |
| Honorary/Life membership = null expiry → always active; implemented | `compute-membership-status.ts:74`; tests | Spec's "sentinel 2099-12-31 preferred" diverges (impl prefers null) | Accept null-expiry convention; note in doc sync (P3) |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run. No Webwright/Playwright executed; no new evidence files saved. Existing Playwright specs were inventoried only (`apps/memberry/tests/e2e/cross-org-isolation.spec.ts`, `role-boundaries.spec.ts`, `_golden-path.spec.ts`) — whether they cover the G-02 mutation surface was not executed/verified `[NEEDS CONFIRMATION]`.

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| Not used this audit | — | — | — | Run targeted Playwright on join→approve→pay funnel during fix verification (prompt 04), not before |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `member/membership/utils/compute-membership-status.test.ts` | backend/unit | BR-01/BR-02 pure fn: all statuses, grace boundaries, terminal precedence, zero-grace | High |
| `member/membership/utils/status-transitions.test.ts` + `membership-status-middleware.test.ts` + `expiry-extension.test.ts` + `fund-math.test.ts` | backend/unit | FSM tables, cache writer, expiry math, fund splits | High |
| `member/membership/*.test.ts` (~19: approve, bulkApprove, deny, createMembership, resign, terminate, decease, reinstate, allocateSeat, revokeSeat, institutional CRUD, importRosterMembers, listRosterMembers, listSeatAllocations, updateOrganizationProfile, graceToLapsed, jobs/index) | backend/unit | Handler logic incl. bulk org-scope (OPS-03), terminal guards, invoice voiding | Medium (mock-heavy; none would catch G-01's SQL/schema mismatch or G-02 cross-org) |
| `handlers/membership/*.test.ts` (getOrgProfile, listOrgApplications, listOrgMembers, updateOrgProfile) + `repos/membership.repo.test.ts` + `membership.cross-module-sql.test.ts` | backend/unit + SQL | Legacy admin surface + query-rich repo | Medium |
| `association:member/membership.test.ts`, `officer-admin.test.ts`, `ac-m04.org-admin.test.ts` | integration | Cross-domain officer/org-admin flows | Medium |
| `specs/api/tests/contract/member/membership/` (9 .hurl: membership-lifecycle, application-approval-flow, application-deny-bulk, seat-allocation-flow, roster-crud, tier-crud-deep, category-upsert, org-profile-flow, terminate-decease-flow) | contract | Happy-path operation coverage of the new surface | Medium (≈38% op coverage per MODULE_SPEC §7.3; happy paths only) |
| `assoc-{applications,memberships,roster,tiers,org-profile,institutional}-flow.hurl`, `membership-flow.hurl`, `membership-custom-flow.hurl` | contract | Legacy/baseline flows | Medium |
| `apps/memberry/src/features/membership/components/*.test.tsx` (application-list, category-editor, member-detail, member-table, membership-list) | frontend/component | UI states | Medium |
| `apps/memberry/tests/e2e/cross-org-isolation.spec.ts`, `role-boundaries.spec.ts`, `_golden-path.spec.ts` | E2E | Org isolation + role boundaries at UI level (depth unverified) | Unknown |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| `statusRecomputeCron` integration test against real schema (would have caught G-01) | integration / data-schema | The P0 is a SQL/schema mismatch invisible to mocks | **Before** G-01 fix (red first) |
| End-to-end lifecycle clock test: active → (cron) grace → (job) lapsed with stored-status assertions | integration | Verifies the whole automatic chain G-01 unblocks | During G-01 |
| Cross-org 403 tests for single approve/deny + resign/terminate/decease/reinstate/renew/update/deleteMembership | backend/unit + permission/RBAC | G-02 surface unprotected | Before G-02 fix |
| `getMembershipApplication` ownership test (foreign user → 403/404) | permission/RBAC | G-03 IDOR | Before G-03 fix |
| Resign → reinstate must fail; resigned status survives recompute | backend/unit + regression | G-04 terminal integrity | Before G-04 fix |
| Terminal member re-applies → approve → handled outcome (no 500) | contract (Hurl) | G-12 spec edge §13 | Before G-12 fix |
| Approve → `membership.created`/invoice side-effect assertions | integration | G-07 funnel | During G-07 |
| History row written per officer transition | backend/unit | G-08 | During G-08 |
| `deleteMembershipTier` with assigned members → 409 (not FK 500) | backend/unit | G-18 | During G-18 |
| Duplicate application while `underReview` → 409 | backend/unit | G-11 | During G-11 |
| Import: row cap, per-row validation errors, existing-email link behavior | backend/unit | G-13/G-14 | During import hardening |
| Renew on quarterly-billing org extends by 3 months | backend/unit | G-16 | During G-16 |
| Untested handlers: `createMembershipApplication`, `getMembership`, `listMemberships`, `renewMembership`, `updateMembership(+Application)`, tier CRUD, `deleteMembership`, roster get/update/add, category ops, subscription trio | backend/unit | ~20 handlers have no colocated test | During respective fixes (do not blanket-backfill) |
| Officer suspends/restores member journey (after G-06) | E2E/Playwright | New op verification | During G-06 |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| `computeMembershipStatus` consumed by elections/governance/credentials/dues/marketplace/booking/email | cross-module | SCOPE.membership §10.E | G-04 input changes ripple platform-wide | `[CROSS-MODULE RISK]` keep fn signature additive-only |
| Dues settle/refund path owns the payment→status side of BR-07 | cross-module | `membership-lifecycle.ts` lazy-imports `@/handlers/dues/repos/dues-payments.repo` | G-07 invoice generation belongs partly to dues-payments audit (next in queue) | `[SHARED DEPENDENCY]` coordinate G-07 fix with dues gap plan |
| `orgContextMiddleware` + `requirePosition` + global role model | shared/platform | `middleware/org-context.ts`, `core/auth/officer-checks.ts`, `middleware/auth.ts` | G-02 fix is handler-local, but the role model itself is the auth-rbac audit's scope | Fix handlers locally; flag role-model question to auth-rbac audit `[SHARED DEPENDENCY]` |
| `membership` schema at `handlers/association:member/repos/` consumed by seeds, ports, events module | database/schema | SCOPE.membership §4.2 | G-04 migration touches a heavily-shared table | `[SHARED DEPENDENCY]` additive columns only; no renames |
| `domain-event-consumers.ts` membership hooks | shared/platform | `core/domain-event-consumers.ts:310–363,1075` | G-07 fix should reuse existing consumers | module-local emit |
| Member transfer lives in `member/chapters/` | cross-module | `member/chapters/*Transfer*.ts` | WF-036 verification belongs to chapters-directory audit | `[CROSS-MODULE RISK]` hand off |
| Member directory (WF-034) lives in `member/directory/` | cross-module | m05 §3 | Same | hand off |
| CLAUDE.md module map + m05 §10/§20 stale topology | product decision / docs | §2 | Misleads every future agent | Doc-sync fix batch |
| EXPIRED threshold, reinstate semantics, RESIGNED actor, applicant-without-account flow | product decision | §25 | Block G-05/G-06 scoping | Resolve before fix planning |

## 22. Raw Recommended Fix Ideas

This section is not the final fix order.

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Repair `statusRecomputeCron` SQL (real columns only; pendingPayment from stored status; drop is_expired); switch to keyset pagination | G-01 | P0 | V1 REQUIRED | real-DB integration test (red first) | Smallest correct fix; no schema change needed |
| Add org-compare guard (403/404) to approve/deny/resign/terminate/decease/reinstate/renew/updateMembership/deleteMembership/updateMembershipApplication | G-02 | P1 | V1 REQUIRED | per-handler cross-org tests | Copy `getMembership.ts:30–33` pattern |
| Ownership check in `getMembershipApplication` | G-03 | P1 | V1 REQUIRED | RBAC test | 3-line fix |
| Migration: add `resigned_at` (nullable timestamptz); backfill from rows where `status='resigned'` using `removed_at`; stop setting `removedAt` on resign; include in compute inputs and cron query | G-04 | P1 | V1 REQUIRED | resign/reinstate regression suite | Coordinate with G-05 |
| Product decision then align reinstate allowlist + transitions table + TypeSpec doc + STATE_MACHINES | G-05 | P1 | V1 REQUIRED | transition matrix test | Blocked on decision |
| Add `suspendMembership`/`unsuspendMembership` TypeSpec ops + handlers (set/clear suspendedAt, write history, position-gated) | G-06 | P1 | V1 REQUIRED | unit + hurl | reinstate already half-implements restore |
| Emit `membership.created` after approve tx; optional invoice hook when org dues config exists | G-07 | P1 | V1 REQUIRED | event-emission integration test | Consumer already exists |
| Write `membership_status_history` rows in approve/resign/terminate/decease/reinstate/renew/suspend | G-08 | P1 | V1 REQUIRED | per-transition history assertions | Reuse graceToLapsed insert shape |
| Guard or remove `deleteMembership`; soft-delete; friendly FK 409 | G-09 | P1 | V1 REQUIRED | delete-guard tests | `[NEEDS PRODUCT DECISION]` keep vs drop op |
| Handle terminal-row conflict on approve/createMembership (archive-or-reuse + 409) | G-12 | P1 | V1 REQUIRED | re-application contract test | Strategy decision needed |
| Apply `withComputedStatus` to `getMembership`/`listMemberships` responses; route `updateMembership` through `persistWithComputedStatus`; feed full inputs to legacy `listOrgMembers` | G-10 | P2 | V1 REQUIRED | dual-surface consistency test | Do with/after G-01 |
| Widen duplicate-application filter to submitted+underReview | G-11 | P2 | V1 RECOMMENDED | unit test | 1-line |
| Tier-org validation + session-person binding in createMembershipApplication; strip personId/orgId from update body (TypeSpec) | G-15 | P2 | V1 RECOMMENDED | unit tests | TypeSpec regen required |
| Import hardening: 500-row cap, structured per-row errors, email-match-link | G-13/G-14 | P2 | V1 RECOMMENDED | import fixtures | Defer wizard UI + license normalization to V2 |
| renew via `extendMembershipExpiry` (billing cycle aware) | G-16 | P2 | V1 RECOMMENDED | quarterly-org test | |
| BR-04 gate on deleteMembershipTier (count + 409); wire or delete `countMembersInCategory` | G-18 | P2 | V1 RECOMMENDED | unit test | |
| Implement or remove `q` search filter in MembershipRepository | §12 | P3 | V1 RECOMMENDED | repo test | |
| Frontend `MemberStatus` union → full 10-state enum from `@monobase/api-spec` | §11 | P3 | V1 RECOMMENDED | component test | |
| Doc sync: m05 §10/§20, CLAUDE.md module map, STATE_MACHINES reconciliation | G-20 | P3 | V1 RECOMMENDED | n/a | Batch with other doc fixes |
| `gracePeriodDays` 0–90 range validation in TypeSpec | BR-02 | P3 | V1 RECOMMENDED | validator test | |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Full multi-step CSV import wizard UI (upload/preview/confirm/results, invalid-row CSV download) | `V2 DEFERRED` | Backend correctness (cap, validation, matching) must land first; wizard is UX layer on top |
| PRC license normalization + ambiguous-match human-review queue (BR-22/AC-M05-004 full scope) | `V2 DEFERRED` | Needs match-staging data model; email matching covers the dominant dedupe case for V1 |
| LAPSED→EXPIRED automation (threshold config, job, column) | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | No operational definition exists; building it now would be guesswork |
| Expulsion workflow (route disciplinary action, `expelled_at` column, M04 integration) | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | Trust-sensitive; needs the disciplinary process design from M04 |
| `underReview` / `waitlisted` application sub-states + capacity logic | `V2 DEFERRED` | Approve/deny direct from submitted is sufficient V1 |
| Feature flags `membership.transferEnabled` / `membership.bulkImportV2` | `DO NOT ADD` `[DO NOT OVERBUILD]` | No flag infrastructure consumer in this module; spec §18 is aspirational |
| Directory caching (1-min TTL per spec §16) | `DO NOT ADD` (here) | Directory is another module's scope; premature optimization |
| Spec §17 metrics suite (4 Prometheus metrics) | `V2 DEFERRED` | x-audit + structured logs cover V1 observability floor; metrics need platform conventions first |
| Relocating membership schemas out of `association:member/repos/` | `DO NOT ADD` `[DO NOT OVERBUILD]` | Cutover §4.2 deliberately kept them; moving now thrashes seeds/ports/events for zero behavior gain |
| Renaming/merging legacy `/membership/*` admin surface into the new org-profile ops | `DO NOT ADD` (now) | Documented intentional stay (MODULE_SPEC §7.1); forcing migration risks admin-app regression |
| Membership status-history read API/UI | `V2 DEFERRED` | Write-side (G-08) is the V1 requirement; read UI can follow |

## 24. Audit Decision

**FAIL**

The module's structure, test volume, and contract coverage are genuinely good, and the application/institutional/roster CRUD surface works. But P0/P1 gaps block reliable V1 use of the *lifecycle* this module exists to manage:

1. **G-01 (P0)**: the BR-01 recompute cron queries columns that don't exist, so the automatic ACTIVE→GRACE→LAPSED chain is dead and primary reads serve stale stored statuses — the module's foundational invariant fails silently every night.
2. **G-02/G-03 (P1)**: cross-org mutation and application-read authorization gaps undermine the platform's multi-org trust model.
3. **G-04/G-05/G-06 (P1)**: terminal-state integrity is broken (resigned members resurrectable), reinstate semantics contradict the authoritative state machine, and SUSPENDED — a spec P0 officer action — is unreachable.
4. **G-07/G-08/G-12 (P1)**: the core approve→pay funnel stalls silently, officer transitions leave no history, and the spec's re-application path 500s.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Reinstate semantics: which set is correct — lapsed-only (m05/WF-035), suspended+lapsed (TypeSpec), or removed+suspended (impl)? Is REMOVED reversible? | `[NEEDS PRODUCT DECISION]` | Blocks G-05 fix direction; affects transitions table + TypeSpec + docs | Product (Elad) |
| RESIGNED actor: member self-service (STATE_MACHINES, which claims precedence) or officer-recorded (m05)? | `[NEEDS PRODUCT DECISION]` | Determines whether a self-resign route/UI is V1 scope | Product |
| EXPIRED state: define the lapse→expired threshold (and per-org configurability) or drop EXPIRED from V1 vocabulary? | `[NEEDS PRODUCT DECISION]` | G-06/G-01 scope; analytics correctness | Product |
| Is expulsion (disciplinary) V1 for the pilot association, and does it route through M04? | `[NEEDS PRODUCT DECISION]` | Decides whether `createDisciplinaryAction` gets wired or formally deferred | Product |
| Re-application strategy after terminal membership: reuse the existing row (clear flags, new start date) or archive old + insert new (needs index change)? | `[NEEDS PRODUCT DECISION]` | G-12 fix shape touches the shared unique index | Product + Eng |
| Should `deleteMembership`/`deleteMembershipApplication` exist at all outside platform-admin? | `[NEEDS PRODUCT DECISION]` | G-09 record-safety fix shape | Product |
| Applications without accounts: spec §7 wants applicantEmail/license on the application; impl requires signup-first. Accept account-first and amend spec? | `[NEEDS PRODUCT DECISION]` | Schema change vs doc change | Product |
| Should approve auto-generate the first dues invoice when org dues config exists (m05 §13 [VERIFY] case)? | `[NEEDS CONFIRMATION]` | G-07 scope; cross-module with dues | Product + dues audit |
| Do existing E2E specs (`cross-org-isolation.spec.ts`, `role-boundaries.spec.ts`) exercise the G-02 mutation endpoints? | `[NEEDS CONFIRMATION]` | Determines regression-test reuse vs new tests | Eng (verify during prompt 03/04) |
| Is `membership_tier.code` meant to be unique per org (index is non-unique today)? | `[NEEDS CONFIRMATION]` | Data-integrity expectation in SCOPE §10.H | Eng |

## 26. Notes for Gap Plan Organizer

- **Fix G-01 first and alone.** It's a contained SQL repair + integration test, but write the failing real-DB test before touching the cron (mocked tests are why it shipped broken). Bundle the G-10 read-consistency policy decision into the same batch since both define "where does status truth live".
- **G-02 + G-03 are one mechanical batch**: ~10 handlers each get a 2–4-line org/ownership guard plus a cross-org test. Use `bulkApproveMembershipApplications.ts:56` and `getMembership.ts:30` as in-repo patterns. No shared-file changes needed.
- **G-04/G-05/G-06 form the "state machine integrity" batch** and are partially **blocked on product decisions** (reinstate semantics, RESIGNED actor, EXPIRED definition, expulsion V1?). Sequence the decisions before this batch. The migration (add `resigned_at`) is additive on a heavily shared table — `[SHARED DEPENDENCY]`, additive only, no renames.
- **G-07/G-08/G-12 are the funnel batch** — approve-side events/history/re-application. G-07's invoice half is `[CROSS-MODULE RISK]` with dues-payments (next audit); the event-emission half is safe to do now because the consumer already exists.
- **Tests to write first** (red): cron-against-real-schema, cross-org 403 matrix, resign→reinstate rejection, terminal re-application contract test.
- **Do not implement**: schema relocation, legacy `/membership/*` surface merge, CSV wizard UI, license normalization, feature flags, metrics suite, expulsion (until decided) — see §23.
- **Doc-sync batch (cheap, high leverage)**: m05 §10/§20 topology, CLAUDE.md module map (nonexistent `certificates/` dir, stale counts — flagged by audit index too), STATE_MACHINES↔m05 reinstate/resign reconciliation after the product decisions.
- Possible **cross-cutting signals** for prompt 05 (do not expand here): global comma-separated role model with no org scoping (`middleware/auth.ts`), hard-delete default in `DatabaseRepository.deleteOneById`, handlers skipping `requirePosition` on destructive ops, raw-SQL jobs untested against real schema.

---

Next recommended step:
Module/group: Membership Lifecycle
Module slug: membership-lifecycle
Primary PRD/spec: docs/product/modules/m05-membership/MODULE_SPEC.md
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/membership-lifecycle-gap-plan.md
