# MODULE_SPEC: member/membership

**FINAL** sub-domain of the mega-module decomposition. Cut over directly
after `member/duesspecialassessments`. 8 TypeSpec interfaces under one
`@tag` group (`Member/Membership`), ~40 generated operations + 3
hand-wired subscription routes (UJ-M03), ~120 file ops. Single-namespace
retag for the in-scope tag set, zero hand-wired duplicates at completion.
Closes ROADMAP P1-11 mega-module decomposition.

## 1. Purpose

Owns the membership lifecycle surface of an association: per-org
membership tiers + categories, member lifecycle (create, renew, resign,
reinstate, terminate, decease), application workflow (submit, approve,
deny, bulk-approve), institutional/group memberships + seat allocation,
roster CRUD + import, and per-org organization profile. Eight TypeSpec
interfaces, ~40 generated operations, plus 3 hand-wired UJ-M03
subscription routes (not in TypeSpec).

- **Tier CRUD** — `createMembershipTier`, `getMembershipTier`,
  `listMembershipTiers`, `updateMembershipTier`, `deleteMembershipTier`.
- **Membership Lifecycle** — `createMembership`, `getMembership`,
  `listMemberships`, `updateMembership`, `deleteMembership`,
  `deceaseMembership`, `reinstateMembership`, `renewMembership`,
  `resignMembership`, `terminateMembership`.
- **Application Workflow** — `createMembershipApplication`,
  `getMembershipApplication`, `listMembershipApplications`,
  `updateMembershipApplication`, `deleteMembershipApplication`,
  `approveMembershipApplication`, `denyMembershipApplication`,
  `bulkApproveMembershipApplications`.
- **Institutional + Seat Allocation** —
  `createInstitutionalMembership`, `getInstitutionalMembership`,
  `listInstitutionalMemberships`, `updateInstitutionalMembership`,
  `deleteInstitutionalMembership`, `allocateSeat`, `listSeatAllocations`,
  `revokeSeat`.
- **Roster** — `addRosterMember`, `getRosterMember`,
  `importRosterMembers`, `listRosterMembers`, `updateRosterMember`.
- **Category** — `listMembershipCategories`, `upsertMembershipCategory`.
- **Org Profile** — `getOrganizationProfile`, `updateOrganizationProfile`.

Plus, by design hand-wired (kept, relocated, NOT in scope-set above):
- **3 subscription routes** (UJ-M03 wave) — `getMySubscription`,
  `upgradeSubscription`, `createSubscriptionCheckout`. Not in TypeSpec
  (split admin-tier + org-context auth chains; @extension composition
  blocked). Handlers moved to `handlers/member/membership/subscription/`
  sub-subdir. `app.ts:173-175` import paths rewritten.
- **`/public/org/:orgId/tiers`** at `app.ts:322` — pre-OpenAPI workaround
  for applicants who lack `association:member` role. Inline dynamic-import
  of `repos/membership.schema` (stays at OLD path per § 4.2). UNCHANGED.

## 2. Bounded Context

In scope (cut over by `5f0c374d`):
- 8 TypeSpec interfaces wired in `main.tsp:254-284` under
  `@tag("Member/Membership")` (all from
  `Association.Member.Membership.*`):
  - `AssocMembershipTierManagement`
  - `AssocMembershipManagement`
  - `AssocMembershipApplicationManagement`
  - `AssocInstitutionalMembershipManagement`
  - `AssocSeatAllocationManagement`
  - `AssocMemberRosterManagement`
  - `AssocMembershipCategoryManagement`
  - `AssocOrganizationProfileManagement` (org-profile fold-in)
- ~40 generated routes (one per operation).
- 3 hand-wired subscription routes at `app.ts:590-595` (relocated
  handler files; routes still registered post-OpenAPI).
- 6 utils (`compute-membership-status`, `membership-lifecycle`,
  `membership-status-middleware`, `status-transitions`, `fund-math`,
  `expiry-extension`) — moved with the domain.
- 2 jobs (`statusRecomputeCron` BR-01 + `graceToLapsed` GAP-015) +
  single `jobs/index.ts` re-exporting both registrars.

Out of scope (intentionally untouched):
- `repos/membership.{schema,repo}.ts` +
  `repos/institutional-membership.{schema,repo}.ts` — canonical at
  `handlers/association:member/repos/`; stay there per § 4.2.
- `handlers/membership/repos/membership.repo.ts` (query-rich JOIN/search
  per CLAUDE.md) + tests — canonical at `handlers/membership/repos/`;
  stay there.
- 4 LIVE legacy handlers at `handlers/membership/`: `getOrgProfile`,
  `updateOrgProfile`, `listOrgMembers`, `listOrgApplications`. These
  back DIFFERENT operationIds than the new `getOrganizationProfile` /
  `updateOrganizationProfile` (which serve OrganizationProfileManagement
  interface). Future cleanup wave handles overlap.
- `handlers/association:member/getOrgDashboard.ts` — M4-DASHBOARD,
  cross-domain (reads dues + credits + governance). UNCHANGED.
- `handlers/association:member/transitionOfficerTerm.ts` — governance
  domain (M4-R3), not membership. UNCHANGED.
- `handlers/association:member/jobs/{creditIssue,complianceThreshold,
  directoryAutoPopulate}` — other domains' jobs. STAY.
- 6 platformadmin subscription handlers (`listPricingTiers`,
  `createPricingTier`, `updatePricingTier`, `listSubscriptions`,
  `getSubscription`, `cancelSubscription`) — administered at
  platformadmin tier. UNCHANGED.

Adjacent modules and the seams between them:

| Adjacent module | Seam |
| --- | --- |
| `core/domain-event-consumers.ts` | 3 membership hooks: `membership.created` (welcome notification), `membership.imported` (bulk welcome async), `membership.status.changed` (member ID card refresh). Consumers import REPOS at OLD paths — zero rewrite required. |
| `handlers/association:member/jobs/index.ts` | `registerDuesJobs` stays at OLD path (still wires credit pipeline + cert delayed-jobs). After Cr.7 closeout, the previous `registerStatusRecomputeJob` re-export at L15 was REMOVED — it's now exported from `@/handlers/member/membership/jobs` directly. |
| `app.ts:43 + 45` | Both registrar imports converge: `@/handlers/member/membership/jobs` now exports BOTH `registerStatusRecomputeJob` + `registerMembershipJobs`. |
| `seed/layer-{1,3,4,5,6,7}-*.ts` | Seed paths import `memberships`, `membershipTiers`, `membershipCategories`, `membershipStatusHistory` from the unchanged schemas at OLD path. Zero rewrite at Cr.6. |
| `handlers/member/{duesspecialassessments,governance,credentials}/` | Cross-domain consumers of `computeMembershipStatus` + sibling utils. Heaviest Cr.6 step — 9 import paths rewritten in: `refundDuesPayment`, `deleteDuesInvoice`, `markDuesInvoicePaid`, `castBallot`, `createCandidate`, `updateOfficerTerm`, `issueDigitalCredential`. |
| `handlers/elections/castVote.ts` | Cross-domain consumer of `computeMembershipStatus`. Import path rewritten at Cr.6. |
| `handlers/association:member/{repos/dues.repo, utils/settle-payment}` | OLD-path utility/repo files needed import-path updates after `status-transitions` + `membership-lifecycle` moved. Rewritten to absolute `@/handlers/member/membership/utils/`. |
| `core/audit/audit-action` | Per-route audit middleware via `@extension("x-audit", ...)`. Membership lifecycle operations rely on TypeSpec-injected audit middleware. |

## 3. Files (post-cutover, baseline `5f0c374d`)

`services/api-ts/src/handlers/member/membership/`:

| Category | Count | Notes |
| --- | --- | --- |
| Generated handlers | 40 | Routed via main.tsp:254-284. Includes `getOrganizationProfile` + `updateOrganizationProfile` (NEW operationIds for org-profile fold-in; pre-existing impl files at OLD path before regen). |
| Hand-wired subscription (UJ-M03) | 3 | `subscription/getMySubscription.ts`, `subscription/upgradeSubscription.ts`, `subscription/createSubscriptionCheckout.ts`. Sub-subdir makes hand-wired status visually distinct. |
| Tests | 19 | Colocated `*.test.ts` for moved handlers + 3 utils tests + 1 graceToLapsed test + 1 jobs/index test + 3 subscription tests. Total at new path: ~22 test files. |
| `jobs/` | 3 | `statusRecomputeCron.ts` (BR-01) + `graceToLapsed.ts` (GAP-015) + new `index.ts` re-exporting BOTH registrars (`registerStatusRecomputeJob` + `registerMembershipJobs`). |
| `utils/` | 6 | `compute-membership-status.ts` (heaviest cross-handler consumer), `membership-lifecycle.ts`, `membership-status-middleware.ts`, `status-transitions.ts`, `fund-math.ts`, `expiry-extension.ts`. |

Schema/repo files at OLD canonical paths (unchanged):

| File | Path |
| --- | --- |
| `membership.{repo,schema}.ts` | `handlers/association:member/repos/` |
| `institutional-membership.{repo,schema}.ts` | `handlers/association:member/repos/` |
| `status-history.schema.ts` | `handlers/association:member/repos/` |
| `membership.repo.ts` (query-rich) | `handlers/membership/repos/` |

Legacy `handlers/membership/` post-cutover holds only:
- 4 LIVE handlers (`getOrgProfile`, `updateOrgProfile`, `listOrgMembers`,
  `listOrgApplications`) + their tests — back DIFFERENT non-OrgProfile-
  Management ops; future cleanup wave.
- `repos/` directory (query-rich JOIN/search + tests).

## 4. Contract test layout

Pre-existing membership contract suite (8 files at
`specs/api/tests/contract/`) untouched:
- `assoc-applications-flow.hurl`, `assoc-institutional-flow.hurl`,
  `assoc-memberships-flow.hurl`, `assoc-org-profile-flow.hurl`,
  `assoc-roster-flow.hurl`, `assoc-tiers-flow.hurl`,
  `membership-custom-flow.hurl`, `membership-flow.hurl`.

Three new contract scenarios at
`specs/api/tests/contract/member/membership/`:

| File | Operation IDs covered | Notes |
| --- | --- | --- |
| `membership-lifecycle.hurl` | `createMembership`, `resignMembership`, `reinstateMembership`, `getMembership` | Officer creates membership for fresh applicant → resign → reinstate → get. Per-`{{suffix}}` applicant signup satisfies the `(organization_id, person_id)` unique index. `terminationReason` (not `reason`) for resignMembership per `MembershipResignRequest`. |
| `seat-allocation-flow.hurl` | `createInstitutionalMembership`, `allocateSeat`, `listSeatAllocations`, `revokeSeat` | Officer creates institutional membership (uses seeded org as both child + parent for FK satisfaction) → allocates seat to fresh person → lists allocations → revokes seat. Uses `HTTP *` + `[Asserts] status >= 200 / status < 300` for create/allocate (handler may return 200 or 201). |
| `application-approval-flow.hurl` | `createMembershipApplication`, `getMembershipApplication`, `approveMembershipApplication` | Applicant signs up → fetches public tier list (pre-auth, via hand-wired `/public/org/:orgId/tiers`) → creates application → officer fetches + approves. Per-`{{suffix}}` applicant satisfies application uniqueness. |

Contract suite total: 144 files (was 141 at baseline) → 100% pass at
`5f0c374d`-derived post-tag commit.

## 5. Decisions resolved during the cutover

| Decision | Outcome |
| --- | --- |
| Tag closeout | Single `@tag("Member/Membership")`. Single git tag `member-membership-cutover` — **FINAL** of the mega-module decomposition. |
| Exhaustive interface scan at Cr.0 | Explore agent missed `AssocOrganizationProfileManagement` at main.tsp:282-284. SCOPE doc § 2 corrected pre-Cr.2 to 8 interfaces (not 7). No mid-cutover surprises. |
| Legacy `handlers/membership/*.ts` (13 files) | Per § 10.A audit: 4 LIVE handlers (`getOrgProfile`, `updateOrgProfile`, `listOrgMembers`, `listOrgApplications`) STAY at OLD path (back DIFFERENT ops than the new OrganizationProfileManagement interface). 9 DEAD handlers + 7 integration tests + import-types.ts DELETED at Cr.5. |
| Hand-wired subscription routes (UJ-M03) | STAY hand-wired; 3 handler files at `handlers/association:member/` MOVED to `handlers/member/membership/subscription/` (clear hand-wired sub-subdir). § 4.8 added at § 11. |
| Hand-wired `/public/org/:orgId/tiers` | STAYS at `app.ts:322`. Inline dynamic-import of `repos/membership.schema` (repo unchanged). Zero rewrite required. |
| Schemas + repos relocation | STAY at OLD canonical paths (`handlers/association:member/repos/` + `handlers/membership/repos/`) — cert + credits + dues precedent. Cross-handler imports rewritten to absolute `@/handlers/.../repos/`. |
| Jobs registrar convergence | `statusRecomputeCron` (BR-01) + `graceToLapsed` (GAP-015) both moved into `handlers/member/membership/jobs/`. New `jobs/index.ts` re-exports BOTH registrars. `app.ts:43` (was `registerStatusRecomputeJob` import) + `app.ts:45` (was `registerMembershipJobs` from legacy path) both converge to `@/handlers/member/membership/jobs`. |
| `handlers/membership/jobs/` legacy directory | RETIRED — entire directory removed (graceToLapsed + tests + registrar all moved). |
| `fund-math` + `expiry-extension` utils | MOVED with membership (called from membership-lifecycle). Earlier hesitation about cross-domain coupling resolved — dues test imports rewritten at Cr.6 to absolute path. |
| Two stale test files at OLD `association:member/` | `membership.test.ts` + `jobs/directoryAutoPopulate.integration.test.ts` — broken imports after move. Fixed at Cr.10 via path rewrite to `@/handlers/member/membership/`. |
| `Association:Member` namespace dissolution | PARTIAL — `getOrgDashboard`, `transitionOfficerTerm`, 3 cross-domain jobs (creditIssue, complianceThreshold, directoryAutoPopulate), all repos/, and 1 cross-domain util (settle-payment) remain at OLD path. Future cleanup wave handles final dissolution. |

## 6. Gates posture at cutover commit `5f0c374d`

| Gate | Floor | Result |
| --- | --- | --- |
| typecheck | 5/5 | 5/5 ✓ |
| unit | ≥ 5751 pass + ≤ 3 pre-existing env-flake | 5751 / 5758 ✓ (delta from 5797 post-dues baseline = 16 deleted dead-legacy test files at `handlers/membership/` — 9 per-handler tests + 7 integration/flow tests) |
| contract | ≥ 141 / 141 | 144 / 144 ✓ (3 new scenarios added) |
| SDK drift | 0 / 454 | 0 / 454 ✓ |
| observability | ≥ 94 % | 94 % ✓ (257 / 274 full-coverage) |
| contract coverage | ≥ 83 % | 85 % ✓ (387 / 454 ops covered) |

## 7. Open follow-ups

### 7.1 Legacy `handlers/membership/` 4 LIVE handlers — INTENTIONAL STAY (Wave 7 decision)

`getOrgProfile`, `updateOrgProfile`, `listOrgMembers`, `listOrgApplications`
back the **`/membership/*/{organizationId}` admin-tier URL surface**
(routes.ts:3016/3024/3031/3038), distinct from the new
`OrganizationProfileManagement` ops which route at
`/association/member/org-profile/{organizationId}`. The two surfaces serve
different consumers: legacy `/membership/*` for admin app, new
`/association/member/org-profile/*` for member app. Migrating the legacy 4
would force admin-app refactor + risk regression. Decision: **STAY at OLD
path indefinitely** as the canonical admin-tier surface. Documented here
to preserve context for future maintainers.

### 7.2 `Association:Member` namespace — INTENTIONAL CROSS-DOMAIN LEFTOVER (Wave 7 decision)

After Wave 7 closeout, `handlers/association:member/` retains:
- 2 cross-domain handlers: `getOrgDashboard.ts` (M4-DASHBOARD,
  reads dues+credits+governance), `transitionOfficerTerm.ts` (governance
  M4-R3)
- 3 cross-domain jobs at `jobs/`: `creditIssue`, `complianceThreshold`,
  `directoryAutoPopulate` + registrar `index.ts`
- 1 util at `utils/settle-payment.ts` (dues, consumes
  membership-lifecycle) + ~10 single-domain utils not yet relocated
  (dunning-escalation, gateway-adapter, payment-token, paymongo.adapter,
  receipt-number, refund-validation, reminder-schedule, trust-signals,
  credential-token, gateway-adapter)
- All `repos/` (canonical schemas + repositories per § 4.2)
- 3 cross-domain integration tests: `ac-m04.org-admin.test.ts`,
  `membership.test.ts`, `officer-admin.test.ts` (cross-domain governance
  + platformadmin coverage)
- 1 unrouted handler: `createDisciplinaryAction.ts` (operationId defined
  but no registry/route wire; consumed by officer-admin test only;
  deferred TypeSpec authoring)

**Decision: `association:member/` is NOT a sub-module dir.** Treat as
a cross-domain leftover holding shared repos + utils + cross-domain
handlers. Naming kept as-is for historical continuity and to avoid
re-thrashing seed-layer import paths. Future "dissolve" wave can split
the utils per domain if/when a single-domain cleanup project justifies
the ripple.

### 7.3 Other follow-ups

| Item | Notes |
| --- | --- |
| 3 pre-existing unit test failures | `email/jobs/index.test.ts` (30000 vs 1000 env-flake), 2 others. Triage and either pin env-var defaults or amend tests. |
| Contract coverage of `Member/Membership` | 38% covered (15/40 ops). Wave 8 target: 60%+ via 5 new Hurl files (roster-crud, application-deny-bulk, category-crud (post-Wave-7 dead-code cleanup uses only listMembershipCategories + upsertMembershipCategory), terminate-decease, tier-crud-deep). |
| Contract coverage of `Member/DuesSpecialAssessments` | 32% covered (16/50 ops). Wave 8 target: 60%+ via 5 new Hurl files. |
| Observability margin (94 % floor met by 0 %) | 17 partial-coverage handlers continue to risk dragging score below floor. Includes `member/membership/utils/membership-status-middleware.ts` (score=1). Triage. |
| `fund-math` + `expiry-extension` cross-domain coupling | Dues test (`dues-config-handlers.test.ts`) imports `fund-math` from new membership path. Could be relocated to a `@/lib/finance` shared spot to break the cross-domain dependency. |
| ROADMAP P1-11 closeout | Wave 7 marks P1-11 complete. SPLIT-PLAN.md superseded by `member-*-cutover` tag series. |
