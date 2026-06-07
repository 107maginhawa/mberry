# Membership — Scope (decomposition step 4, FINAL)

**Date:** 2026-06-07
**Branch baseline:** `feature/member-rebuild` @ `9bff0d2f` (post-dues + special-assessments cutover; tag `member-dues-cutover` applied)
**Sub-domain:** membership (lifecycle, applications, tiers, categories, institutional, seats, roster, org-profile)
**Target tag:** `Member/Membership`
**Tag-on-completion:** `member-membership-cutover` (**FINAL** tag of the mega-module decomposition — `association:member` namespace dissolves after this cutover)
**Classification:** FULL migration, single-namespace retag, **LAST + biggest-ripple cutover**. 8 interfaces (NOT 7 — Explore agent miss; § 2 lists all 8), ~47 generated handlers across `association:member/` + 13 legacy `handlers/membership/*.ts` siblings + 4 utils + 1 jobs file (statusRecomputeCron) + 1 jobs registrar at `handlers/membership/jobs/`. Schemas + repos stay at OLD canonical paths (cert + credits + dues precedent). Hand-wired holdouts: 3 subscription routes (UJ-M03, not in TypeSpec) + 1 public-tiers route (pre-OpenAPI applicant visibility) — disposition decided at pre-flight (§ 5.D).

---

## § 1 — Why this isn't a vanilla R-pattern

R-series (chapters → directory) and credits + dues cutovers all used per-interface retag with cross-namespace wrinkles. Membership differs on five axes:

1. **Single namespace, biggest ripple.** All 8 interfaces source from one TypeSpec namespace (`Association.Member.Membership.*`) via one `.tsp` file (`specs/api/src/association/member/membership.tsp`). The retag window in `main.tsp:254-284` is compact (8 wrappers, all `@tag("Association:Member")`). Per-interface edits, NOT bulk find/replace.

2. **Legacy `handlers/membership/*.ts` sibling** — 13 hand-wired-era handler files at `services/api-ts/src/handlers/membership/` that predate the `association:member` consolidation. CLAUDE.md notes "membership/ — query-rich repo (JOINs, search) — complementary to association:member/ CRUD repo. Both use same schema. No consolidation needed." Pre-flight § 5.A inventories each file's wiring status (generated-route impl vs dead code vs cross-handler import).

3. **statusRecomputeCron moves with membership.** Until now, `handlers/association:member/jobs/statusRecomputeCron.ts` stayed at OLD path through cert + credits + dues cutovers because it's the BR-01 safety net for membership status. With membership cutting over, the cron migrates with its domain. `app.ts:43` import path rewrites; `app.ts:676` invocation untouched. After this cutover, the `handlers/association:member/jobs/` directory holds only credits-domain remnants (creditIssue, complianceThreshold) + ops-domain remnants (directoryAutoPopulate) — clean-up decided at § 4.6.

4. **3 hand-wired subscription routes + 1 public-tiers route, UJ-M03 wave, not in TypeSpec.** Per CLAUDE.md note. Routes at `app.ts:322` (`/public/org/:orgId/tiers`), `app.ts:576-578` (admin pricing CRUD), `app.ts:581-583` (admin subscription CRUD), `app.ts:590-595` (org-facing subscription). Handler locations split between `handlers/platformadmin/` (admin-tier) and `handlers/association:member/` (org-facing). Pre-flight § 5.D probes each handler path + decides relocate-vs-stay.

5. **3 cross-handler consumers of `computeMembershipStatus`** (governance + legacy `handlers/membership/` handlers). The utility moves with membership domain — these consumers' import paths rewrite at Cr.6. Pre-flight § 5.E + Cr.1 grep confirms full consumer list.

The good news: **no cross-namespace fold-ins** (org-profile already in `Association.Member.Membership` per main.tsp:282-284), **no hand-wired duplicates of generated routes** (Cr.1 § 5.B confirms), **no Stripe-style infra dep** (membership doesn't need stripe-mock). The bad news: biggest legacy sibling (13 handlers), highest cross-handler ripple (computeMembershipStatus is the single most-imported util in the mega-module), and this is the LAST cutover so any drifted import path surfaces NOW.

---

## § 2 — TypeSpec interfaces (8, source: 1 file)

### § 2.A `Association.Member.Membership.*` (8 interfaces)

Source: `specs/api/src/association/member/membership.tsp`. Wrapped in `main.tsp:254-284`:

```tsp
// main.tsp:254-284 — to be retagged
@tag("Association:Member")
@route("/association/member/tiers")
interface AssocMembershipTierManagement extends Association.Member.Membership.MembershipTierManagement {}

@tag("Association:Member")
@route("/association/member/memberships")
interface AssocMembershipManagement extends Association.Member.Membership.MembershipManagement {}

@tag("Association:Member")
@route("/association/member/applications")
interface AssocMembershipApplicationManagement extends Association.Member.Membership.MembershipApplicationManagement {}

@tag("Association:Member")
@route("/association/member/institutional-memberships")
interface AssocInstitutionalMembershipManagement extends Association.Member.Membership.InstitutionalMembershipManagement {}

@tag("Association:Member")
@route("/association/member/institutional-memberships/{institutionalMembershipId}/seats")
interface AssocSeatAllocationManagement extends Association.Member.Membership.SeatAllocationManagement {}

@tag("Association:Member")
@route("/association/member/roster")
interface AssocMemberRosterManagement extends Association.Member.Membership.MemberRosterManagement {}

@tag("Association:Member")
@route("/association/member/membership-categories")
interface AssocMembershipCategoryManagement extends Association.Member.Membership.MembershipCategoryManagement {}

@tag("Association:Member")
@route("/association/member/org-profile")
interface AssocOrganizationProfileManagement extends Association.Member.Membership.OrganizationProfileManagement {}
```

Generated route count: ≥ 30 across these 8 interfaces (verified at Cr.1 § 5.C).

Retag plan (per-interface): all 8 `@tag("Association:Member")` → `@tag("Member/Membership")`. Sibling interfaces in the same main.tsp window stay untouched:
- credits (290-296) already `@tag("Member/Credits")`
- dues + SA (302-340) already `@tag("Member/DuesSpecialAssessments")`
- chapters (346-360) `@tag("Member/Chapters")`
- governance + downstream (366+) `@tag("Member/Governance")` etc.

Per-interface edits, NOT bulk find/replace. **Lesson from dues**: exhaustive interface scan at Cr.1 confirms no `@tag("Association:Member")` leftover outside main.tsp:254-284. If found, bundle into Cr.2 retag.

### § 2.B OUT OF SCOPE (don't touch in this cutover)

| Interface / handler | Tag / Path | Reason for exclusion |
| --- | --- | --- |
| Subscription system (3 hand-wired routes at app.ts:576-595) | hand-wired UJ-M03 | Not in TypeSpec; handler locations split admin (`platformadmin/`) vs org-facing — § 5.D probes + decides per-handler. Default: stay hand-wired. |
| `/public/org/:orgId/tiers` (app.ts:322) | hand-wired G12 wave | Pre-auth public endpoint — applicants lack `association:member` role, by-design workaround. Cannot move under TypeSpec auth chain. Stays hand-wired; **import rewrite only** (`@/handlers/association:member/repos/membership.schema` → unchanged since repos stay). |
| Governance/officer-term tables (`organization_officer_term`, `position`) | Member/Governance | Handled by member-governance cutover (already complete at chapters wave). |
| Credits domain (credit-compliance, officer-terms) | Member/Credits | Handled by credits cutover. |
| Disciplinary | n/a | No `Disciplinary` interface in scope (Cr.1 § 5.B grep confirms — Explore agent flagged the keyword but no actual TypeSpec interface owns it). |

---

## § 3 — Hand-wired holdouts (`services/api-ts/src/app.ts`)

### § 3.A Stay hand-wired, rewrite imports if handler moves (4 routes)

| Line | Route | Handler import (current) | Disposition |
| --- | --- | --- | --- |
| `app.ts:322-328` | `GET /public/org/:orgId/tiers` | inline dynamic-import: `@/handlers/association:member/repos/membership.schema` (repo, stays per § 4.2) | Repo path UNCHANGED. Body inline (no handler file). No rewrite needed. |
| `app.ts:576-578` | `GET/POST /admin/pricing`, `PUT /admin/pricing/:tierId` | `@/handlers/platformadmin/{list,create,update}PricingTier` | Handler in `platformadmin/` (NOT membership domain). Pre-flight § 5.D confirms. **Untouched** by membership cutover. |
| `app.ts:581-583` | `GET /admin/subscriptions`, `GET/:id`, `PUT/:id/cancel` | `@/handlers/platformadmin/{listSubscriptions,getSubscription,cancelSubscription}` | Handler in `platformadmin/` per pre-flight § 5.D. **Untouched** by membership cutover. |
| `app.ts:590-595` | `GET /association/member/org/:organizationId/subscription`, `POST/upgrade`, `POST/checkout` | `@/handlers/platformadmin/{getMySubscription,upgradeSubscription,createSubscriptionCheckout}` (verify at § 5.D) | If handler in `platformadmin/`: untouched. If in `association:member/`: relocate to `handlers/member/membership/` OR stay at OLD path with rewrite — pre-flight decides. |

### § 3.B Hand-wired routes that ARE membership domain (transition + dashboard)

| Line | Route | Handler import (current) | Disposition |
| --- | --- | --- | --- |
| `app.ts:559` | `POST /association/member/org/:organizationId/officers/:termId/transition` | `@/handlers/association:member/transitionOfficerTerm` | **Governance domain** (M4-R3 officer transition checklist). NOT membership — owned by member-governance future cutover. UNTOUCHED. |
| `app.ts:562` | `GET /association/member/org/:organizationId/dashboard` | `@/handlers/association:member/getOrgDashboard` | Cross-domain org-wide dashboard (M4-DASHBOARD). NOT pure-membership. UNTOUCHED in this cutover. Pre-flight § 5.D confirms dashboard reads from multiple domains. |

### § 3.C Untouched by membership cutover

| Line | Route | Reason |
| --- | --- | --- |
| `app.ts:96, 98-100, 113-114` | dues hand-wired holdouts (downloadReceipt, stripeWebhook, validate/checkoutPaymentToken) | Already migrated to `handlers/member/duesspecialassessments/` (dues cutover Cr.6). |
| `app.ts:417-422` `ASSOCIATION_PUBLIC_PATHS` | public path list for credentials/ethics/directory | No membership entries. |

---

## § 4 — Decisions baked in (no further checkpoint needed for these)

### § 4.1 Single tag: `Member/Membership`

**Decision:** all 8 interfaces carry `@tag("Member/Membership")`. Git tag `member-membership-cutover` (FINAL).

**Why:**
- Single TypeSpec namespace (`Association.Member.Membership.*`).
- Org-profile already folded in (main.tsp:282-284) — no separate `OrgProfile` tag.
- Roster + seats + applications cross-FK to memberships — fusion under one tag is correct.
- Last cutover — `association:member` namespace dissolves. Tag namespace closes cleanly: `Member/{Credits, DuesSpecialAssessments, Chapters, Directory, Credentials, Certificates, Governance, Membership}`.

### § 4.2 Schemas + repos STAY at OLD path (cert + credits + dues precedent)

**Decision:** all schema + repo files remain where they are.

| Current path | Status | Reason |
| --- | --- | --- |
| `handlers/association:member/repos/membership.schema.ts` | STAY (canonical) | Tables: `membershipTiers`, `memberships`, `membershipApplications`, `membershipCategories`. Heavy seed-layer + cross-handler consumer. |
| `handlers/association:member/repos/membership.repo.ts` | STAY (canonical) | Classes: `MembershipTierRepository`, `MembershipRepository`, `MembershipApplicationRepository`, `MembershipCategoryRepository`. |
| `handlers/association:member/repos/institutional-membership.schema.ts` | STAY (canonical) | Tables: `institutionalMemberships`, `seatAllocations`. |
| `handlers/association:member/repos/institutional-membership.repo.ts` | STAY (canonical) | Classes: `InstitutionalMembershipRepository`, `SeatAllocationRepository`. |
| `handlers/membership/repos/*` (query-rich JOIN/search repo per CLAUDE.md) | STAY (canonical) | Complementary to `association:member/repos/`. Same schema, different query surface. § 5.F confirms file count + boundary. |
| Any `org-profile.schema.ts` / repo if present | STAY (canonical) | § 5.F probes location. |

**Why:**
- Cert + credits + dues precedent: moving schemas with handlers thrashes seed + test imports unnecessarily.
- Cross-FK coupling between memberships ↔ institutionalMemberships ↔ seatAllocations ↔ applications + cross-domain consumers (dues uses `membership.duesExpiryDate`, credits + governance reference memberships) make moving the central PII spine high-risk.
- Final cleanup wave (TBD) can relocate all schemas to canonical per-domain paths — deferred to a follow-up, not bundled with this cutover.

### § 4.3 Handler structure: subdirectories under new path

**Decision:** group handlers under `handlers/member/membership/` with these subdirs:

```
handlers/member/membership/
├── *.ts                              (~30 generated handlers: tier/membership/application/institutional/seat/roster/category/orgProfile)
├── jobs/
│   ├── index.ts                      (registerMembershipJobs — splits from handlers/membership/jobs/ + handlers/association:member/jobs/)
│   ├── statusRecomputeCron.ts        (BR-01 safety net — moves from association:member/jobs/)
│   └── graceToLapsed.ts              (membership lifecycle — moves from handlers/membership/jobs/, IF file confirmed at § 5.G)
├── utils/
│   ├── compute-membership-status.ts  (moves from association:member/utils/; most-imported util in mega-module)
│   ├── membership-lifecycle.ts       (moves from association:member/utils/)
│   ├── membership-status-middleware.ts (moves from association:member/utils/)
│   └── status-transitions.ts         (moves from association:member/utils/)
└── legacy/                           (IF retained — § 5.A decides per-file)
    ├── addMember.ts                  (from handlers/membership/)
    ├── csvImport.ts
    ├── getMember.ts
    ├── getOrgProfile.ts
    ├── listApplications.ts
    ├── listCategories.ts
    ├── listMembers.ts
    ├── listOrgApplications.ts
    ├── listOrgMembers.ts
    ├── reviewApplication.ts
    ├── updateMember.ts
    ├── updateOrgProfile.ts
    └── upsertCategory.ts
```

**Why `legacy/` subdir provisional:** the 13 legacy `handlers/membership/*.ts` predate the consolidation. Some may be:
- live impls referenced by generated routes (e.g. `listOrgMembers` may be the impl for `AssocMembershipManagement.list`)
- dead code (zero consumers)
- query-rich extensions complementary to the generated CRUD set (CLAUDE.md note)

Pre-flight § 5.A audits each — kept-and-relocated land in `legacy/` subdir until naming-collision is resolved at a future cleanup wave (or get renamed-and-merged into the parent dir during Cr.3). If a file is dead, it gets deleted at Cr.5.

### § 4.4 Hand-wired duplicates: expected ZERO

**Decision:** no kill step for generated-vs-hand-wired duplicates expected. Cr.1 § 5.B confirms with route-grep.

Carry-forward lesson: cert had `cert-verify`, credits had `void-event`, dues had none. Membership should pattern-match dues (no duplicates) — but pre-flight verifies because the 13 legacy `handlers/membership/*.ts` may include orphaned hand-wired registrations that registerOpenAPIRoutes shadows.

### § 4.5 Subscription routes stay hand-wired

**Decision:** do NOT migrate subscription routes (UJ-M03 wave) to TypeSpec.

**Why:**
- Per CLAUDE.md: "UJ-M03" wave handles subscription routes; not in TypeSpec backlog.
- Routes split across `/admin/*` (platformadmin auth) and `/association/member/org/*` (org-context auth). Composing both under one TypeSpec interface would force a refactor.
- All 3 routes use Zod-validated bodies inline; no @extension benefit.

Pre-flight § 5.D probes whether ANY subscription handler lives at `handlers/association:member/` (i.e. is structurally membership-domain). If so, decide at § 11 amendment: relocate-with-stays-hand-wired vs leave-at-platformadmin.

### § 4.6 Jobs registrar split — final closeout of `handlers/association:member/jobs/`

**Decision:** after Cr.5 + Cr.6:
- `handlers/association:member/jobs/index.ts` retains: `registerDuesJobs` import surface compatibility (no — dues already migrated; dues exports moved at dues Cr.7). Re-check.
- Confirmed via § 0 baseline read of jobs/index.ts: current state already imports dues processors from `@/handlers/member/duesspecialassessments/jobs/*` AND consumes `creditIssue`, `complianceThreshold` from local `./` paths. After membership cutover:
  - `statusRecomputeCron.ts` MOVES to new path. Import at `app.ts:43` rewrites.
  - `creditIssue.ts`, `complianceThreshold.ts` STAY at `association:member/jobs/` (credits domain — would have moved at credits cutover but didn't; leave per cert+credits+dues "stay at OLD" pattern unless pre-flight § 5.G surfaces consumer risk).
  - `directoryAutoPopulate.ts` STAYS (directory cutover done; this file is the cron registrar at OLD path).
  - `index.ts` — after statusRecomputeCron leaves, this becomes a thin re-export of {creditIssue, complianceThreshold, directoryAutoPopulate} + the `registerDuesJobs` legacy export (which now lives in `handlers/member/duesspecialassessments/jobs/index.ts` per dues cutover).

  Pre-flight § 5.G probes the exact current shape of `handlers/association:member/jobs/index.ts` post-dues + reconciles with this plan.

### § 4.7 `handlers/membership/jobs/registerMembershipJobs` — moves with membership

**Decision:** the legacy `handlers/membership/jobs/index.ts` (registers `membership.graceToLapsed` cron per Explore § 12) MOVES to `handlers/member/membership/jobs/`. Import at `app.ts:45` rewrites; invocation at `app.ts:678` untouched.

**Why:** single-domain (membership lifecycle), no cross-domain consumer, opportunity to retire the legacy `handlers/membership/jobs/` directory.

---

## § 5 — Pre-flight verifications needed (7 items)

### § 5.A Legacy `handlers/membership/*.ts` wiring audit (per-file)

For each of the 13 source handlers + 6 flow/br tests + 9 per-handler tests:

```sh
# Per-handler consumer audit
for f in addMember csvImport getMember getOrgProfile listApplications listCategories \
         listMembers listOrgApplications listOrgMembers reviewApplication \
         updateMember updateOrgProfile upsertCategory; do
  echo "=== $f ==="
  grep -rn "from '@/handlers/membership/$f'" services/api-ts/src/ --include='*.ts' 2>/dev/null | head -5
done
```

Classify each file:
- **Live (generated-route impl):** referenced by `generated/openapi/registry.ts` or `routes.ts` as handler impl → relocate to new path, rewrite registry references (auto-regen at Cr.2).
- **Live (cross-handler):** referenced by other handlers (not via generated routes) → relocate, rewrite imports.
- **Dead code:** zero consumers → delete at Cr.5.

Append per-file classification to § 10.A.

### § 5.B Route-order check (zero hand-wired duplicates expected)

```sh
# Confirm no app.ts registration shadows a generated membership route path
grep -nE "app\.(get|post|put|patch|delete)\\('/association/member/(tiers|memberships|applications|institutional-memberships|roster|membership-categories|org-profile|members|categories)" \
  services/api-ts/src/app.ts services/api-ts/src/generated/openapi/routes.ts | head -40

# Plus the legacy /membership/* paths
grep -nE "app\.(get|post|put|patch|delete)\\('/(membership|members|memberships)/" \
  services/api-ts/src/app.ts | head -20
```

Expected: hits only in `routes.ts` (generated) for `/association/member/*`. Zero hand-wired registrations in `app.ts` for those paths. Legacy `/membership/*` paths probe for orphaned hand-wired routes.

### § 5.C Generated handler file count + boundary check

```sh
# Total file count under association:member/ matching membership domain patterns
find services/api-ts/src/handlers/association:member -maxdepth 1 -type f -name '*.ts' -not -name '*.test.ts' \
  | xargs grep -lE 'membershipTiers|memberships|institutionalMemberships|seatAllocations|membershipApplications|membershipCategories|organizationProfiles' 2>/dev/null \
  | wc -l

# Plus list, for Cr.3 restore
find services/api-ts/src/handlers/association:member -maxdepth 1 -type f -name '*.ts' -not -name '*.test.ts' \
  | xargs grep -lE 'membershipTiers|memberships|institutionalMemberships|seatAllocations|membershipApplications|membershipCategories|organizationProfiles' 2>/dev/null \
  | sort
```

Expected: ~30 source handlers (tier CRUD, membership lifecycle ops, application workflow, institutional CRUD, seat allocate/revoke/list, roster CRUD + import, category list/upsert, org-profile get/update). Confirm exact list for Cr.3 restore. Cross-check against the post-credits + post-dues file list to filter out already-cut-over files.

### § 5.D Hand-wired subscription handler locations

```sh
# Probe location of each subscription handler
for h in listPricingTiers createPricingTier updatePricingTier \
         listSubscriptions getSubscription cancelSubscription \
         getMySubscription upgradeSubscription createSubscriptionCheckout; do
  echo "=== $h ==="
  find services/api-ts/src/handlers -name "$h.ts" -not -path '*/node_modules/*' 2>/dev/null
done
```

For each handler:
- If under `handlers/platformadmin/` → § 4.5 holds (stays hand-wired at platformadmin path, untouched by membership cutover).
- If under `handlers/association:member/` → decide at § 11 amendment: relocate to `handlers/member/membership/subscription/` OR leave at OLD path for a future UJ-M03 TypeSpec migration.

### § 5.E `computeMembershipStatus` + sibling utils consumer audit

```sh
# Most-imported util in mega-module — full consumer list
grep -rn "compute-membership-status\\|computeMembershipStatus\\|membership-lifecycle\\|membership-status-middleware\\|status-transitions" \
  services/api-ts/src/ --include='*.ts' | grep -v ' utils/' | sort | uniq
```

Expected consumers (per Explore § 9):
- `handlers/member/governance/createCandidate.ts` (cross-domain — rewrites)
- `handlers/association:member/utils/membership-lifecycle.ts` (intra-utils — moves together)
- `handlers/association:member/utils/membership-status-middleware.ts` (intra-utils — moves together)
- `handlers/association:member/jobs/statusRecomputeCron.ts` (moves with cron)
- `handlers/membership/*.ts` (legacy — relocates per § 5.A)

All consumers' import paths rewrite at Cr.6. Document full list at § 10.D.

### § 5.F Repo + schema location audit (membership + institutional + legacy)

```sh
# Confirm schema + repo files for membership domain
ls -la services/api-ts/src/handlers/association:member/repos/ | grep -iE "membership|institutional|tier|application|category|profile|seat|roster"
ls -la services/api-ts/src/handlers/membership/repos/ 2>&1

# Hybrid check — does any file co-locate cross-domain classes?
head -50 services/api-ts/src/handlers/association:member/repos/membership.schema.ts
head -50 services/api-ts/src/handlers/association:member/repos/institutional-membership.schema.ts
head -30 services/api-ts/src/handlers/membership/repos/*.ts 2>/dev/null
```

**Known from Explore § 5:** no cross-domain co-location in membership/institutional schemas. Confirm.

### § 5.G Jobs registrar shape audit

```sh
# Current shape of jobs/index.ts post-dues cutover
cat services/api-ts/src/handlers/association:member/jobs/index.ts | head -40

# Plus legacy registrar
cat services/api-ts/src/handlers/membership/jobs/index.ts 2>/dev/null | head -30
ls services/api-ts/src/handlers/membership/jobs/ 2>/dev/null
```

Reconcile with § 4.6 + § 4.7 plans. Document exact registrar surface area for Cr.7 split step.

---

## § 6 — Execution sequence

10 atomic steps. typecheck after each. Commit after each.

### Step Cr.1 — Pre-flight verifications (§ 5.A through § 5.G)

Findings appended to § 10. Commit: `docs(member-membership): SCOPE § 10 — Cr.1 pre-flight findings`.

### Step Cr.2 — Retag main.tsp (per-interface) + regenerate

```sh
# Edit specs/api/src/main.tsp lines 254-284:
#   8 @tag("Association:Member") annotations → @tag("Member/Membership")
#   per-interface, NOT bulk find/replace
cd specs/api && bun run build
cd ../../services/api-ts && bun run generate
```

Verify no sibling interface (credits 290-296, dues 302-340, chapters 346-360) retagged.

### Step Cr.3 — Restore canonical handler files at new path

```sh
mkdir -p services/api-ts/src/handlers/member/membership/{jobs,utils,legacy}

# Generated handlers from association:member/ → restore at new path
# (exact list compiled at Cr.1 § 5.C; baseline source is 9bff0d2f)
git show 9bff0d2f:services/api-ts/src/handlers/association:member/<file>.ts \
  > services/api-ts/src/handlers/member/membership/<file>.ts

# statusRecomputeCron + sibling utils
git show 9bff0d2f:services/api-ts/src/handlers/association:member/jobs/statusRecomputeCron.ts \
  > services/api-ts/src/handlers/member/membership/jobs/statusRecomputeCron.ts
for u in compute-membership-status membership-lifecycle membership-status-middleware status-transitions; do
  git show 9bff0d2f:services/api-ts/src/handlers/association:member/utils/$u.ts \
    > services/api-ts/src/handlers/member/membership/utils/$u.ts
done

# Legacy handlers/membership/*.ts kept-and-relocated → restore at new path/legacy/
# (per § 5.A classification)
```

### Step Cr.4 — Move tests + jobs registrar

```sh
# Tests for moved handlers + utils
git mv services/api-ts/src/handlers/association:member/utils/compute-membership-status.test.ts \
       services/api-ts/src/handlers/member/membership/utils/
# (similarly for membership-status-middleware, status-transitions, etc.)

# Legacy jobs registrar (graceToLapsed)
git mv services/api-ts/src/handlers/membership/jobs/index.ts \
       services/api-ts/src/handlers/member/membership/jobs/legacyMembershipJobs.ts
# (rename to avoid collision with new membership-domain registrar)
# OR fold its contents directly into handlers/member/membership/jobs/index.ts at Cr.7
```

Schema + repo files NOT moved (per § 4.2).

### Step Cr.5 — Delete moved originals + dead-code kills

```sh
# Delete the ~30 generated handler files at OLD paths (NOT repos/, NOT schema files)
# Compiled list from Cr.1 § 5.C
for f in <list-from-section-5C>; do
  git rm services/api-ts/src/handlers/association:member/$f.ts
  git rm services/api-ts/src/handlers/association:member/$f.test.ts 2>/dev/null || true
done

# Delete moved utils + their tests
for u in compute-membership-status membership-lifecycle membership-status-middleware status-transitions; do
  git rm services/api-ts/src/handlers/association:member/utils/$u.ts
  git rm services/api-ts/src/handlers/association:member/utils/$u.test.ts 2>/dev/null || true
done

# Delete moved statusRecomputeCron + its test (if any)
git rm services/api-ts/src/handlers/association:member/jobs/statusRecomputeCron.ts

# Delete legacy handlers/membership/*.ts files per § 5.A classification
# (kept-and-relocated already moved at Cr.3; this step removes ORIGINALS)
# (dead-code files deleted with no relocation)

# Delete legacy handlers/membership/jobs/ directory (registrar moved at Cr.4)
git rm -r services/api-ts/src/handlers/membership/jobs/

# If handlers/membership/ is now empty (or only repos/ remains), document at § 11
```

### Step Cr.6 — Rewrite cross-module imports

Hot spots:
- `services/api-ts/src/app.ts:43` — `registerStatusRecomputeJob` from `@/handlers/association:member/jobs` → `@/handlers/member/membership/jobs`
- `services/api-ts/src/app.ts:45` — `registerMembershipJobs` from `@/handlers/membership/jobs` → `@/handlers/member/membership/jobs/legacyMembershipJobs` (or fold-in)
- `services/api-ts/src/generated/openapi/registry.ts` — auto-regenerated by Cr.2 (no manual edit)
- Cross-handler consumers of `computeMembershipStatus` + sibling utils (per § 5.E):
  - `handlers/member/governance/createCandidate.ts`
  - any other consumer documented at § 10.D
- Cross-handler consumers of `handlers/membership/*.ts` files (per § 5.A) — rewrite to new `handlers/member/membership/legacy/` path

Verify with:
```sh
grep -rn "@/handlers/\(association:member\|membership\)/\(<all-moved-files>\)" \
  services/api-ts/src/ --include='*.ts'
```
Expected: zero hits after Cr.5 + Cr.6. `repos/membership*` / `repos/institutional-membership*` import paths intentionally stay (per § 4.2).

### Step Cr.7 — Jobs registrar split + dead-code closeout

If § 5.G surfaces complex split logic, this step handles:
- Splitting `handlers/association:member/jobs/index.ts` — extract any membership-domain exports; leave credits + directory remnants.
- Fold-in of `handlers/membership/jobs/` legacy registrar (per Cr.4 rename).
- Final check: is `handlers/membership/` directory removable (zero files)? If yes, `git rm -r`.

If no split logic needed (legacy registrar fold-in only), Cr.7 reserved for kill of any hand-wired duplicate surfaced at § 5.B.

### Step Cr.8 — typecheck gate

```sh
bun run --filter '*' typecheck
```
Must be 5/5.

### Step Cr.9 — Hurl scenarios

Current baseline: 8 contract files (per Explore § 7 + verified):
- `assoc-applications-flow.hurl`
- `assoc-institutional-flow.hurl`
- `assoc-memberships-flow.hurl`
- `assoc-org-profile-flow.hurl`
- `assoc-roster-flow.hurl`
- `assoc-tiers-flow.hurl`
- `membership-custom-flow.hurl`
- `membership-flow.hurl`

Extend with **≥ 3 new files** under `specs/api/tests/contract/member/membership/`:

1. `membership-lifecycle.hurl` — officer creates membership → renew → resign → reinstate. Verifies state machine transitions + computeMembershipStatus reconciliation. Idempotency: fresh person per `{{suffix}}`.
2. `seat-allocation-flow.hurl` — officer creates institutional-membership → allocates seats to N persons → revoke seat → re-allocate. Verifies seat double-allocation prevention (uq on `(institutionalMembershipId, personId)`).
3. `application-approval-flow.hurl` — public applicant submits application → officer approves → membership created with correct tier + status. Cross-references application → membership FK chain.

Optional 4th + 5th: `tier-crud.hurl` (tier_org_code unique), `org-profile-update.hurl` (single-org profile upsert).

**Prereqs (carry-forward):**
- CSRF + Origin auto-injected; do not double-add.
- Seed officer `test@memberry.ph` = President.
- All membership tables use uuid PKs (per Explore § 10) — `{{newUuid}}` safe; person_id FK still needs seeded officer for self-target scenarios.
- `(organization_id, person_id)` unique on memberships — per-`{{suffix}}` random person OR pre-cleanup.
- `(organization_id, code)` unique on tiers — per-`{{suffix}}` randomization on code.

### Step Cr.10 — `MODULE_SPEC.member.membership.md` + gates + tag

Mirror dues MODULE_SPEC 7-section layout. Run all gates:

```sh
bun run --filter '*' typecheck                          # 5/5
cd services/api-ts && bun test                          # ≥ post-dues baseline
API_URL=http://localhost:7213 bun run scripts/run-contract-tests.ts  # ≥ 141 + new membership
bun run scripts/check-sdk-compat.ts                     # 0 drift / 454 ops
bun run scripts/audit-observability.ts                  # ≥ 94 %
bun run scripts/contract-coverage-gap.ts                # ≥ 83 %
git tag -a member-membership-cutover -m "Membership sub-domain cut over to handlers/member/membership/ — FINAL mega-module decomposition"
```

Tag at MODULE_SPEC + observability refresh commit (cert + credits + dues convention). Post-tag hygiene commits (supplemental hurl, MODULE_SPEC close-out) untagged.

After this tag, `association:member` namespace is **dissolved**. ROADMAP P1-11 mega-module split is complete.

---

## § 7 — Risk register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Bulk @tag find/replace catches sibling credits/dues/chapters interfaces | high if attempted, low with per-interface edits | § 6 Cr.2 mandates per-interface edits; pre-step diff review before regen. |
| Exhaustive interface scan misses a stray `@tag("Association:Member")` outside main.tsp:254-284 | medium — dues hit this with 5 missed @tag("Dues") interfaces | § 5.B grep wider net (full main.tsp + all modules/*.tsp); Cr.2 re-grep post-edit. |
| Legacy `handlers/membership/*.ts` includes orphaned hand-wired registrations | medium — pre-OpenAPI era | § 5.A per-file audit; Cr.1 grep app.ts for any `import * from '@/handlers/membership'`. |
| `computeMembershipStatus` cross-handler consumers missed at Cr.6 | medium-high — most-imported util | § 5.E exhaustive grep BEFORE Cr.6; post-Cr.6 typecheck catches missed paths. |
| `(organization_id, person_id)` unique on memberships → Hurl 409 on re-run | medium | § 5.F + Cr.9 prereq: fresh person per `{{suffix}}`. |
| Seat `(institutionalMembershipId, personId)` unique → Hurl 409 on re-run | medium | Per-`{{suffix}}` person + fresh institutional-membership per scenario. |
| `domain-event-consumers.ts` has membership.* event handlers consuming moved utils | low — events consume repos (stay), not utils | § 5.E grep covers domain-event-consumers.ts. |
| `jobs/index.ts` split corrupts cron registration on restart | medium — last cutover is highest-stakes | Cr.7 explicit registrar split; Cr.8 typecheck + Cr.9 contract gate catches registration errors. |
| `handlers/membership/jobs/` legacy graceToLapsed cron drops registration during move | medium | Cr.4 rename-vs-fold-in handled atomically; Cr.6 verifies `app.ts:45,678` calls right symbol. |
| Subscription routes (`getMySubscription` etc.) actually live at `handlers/association:member/` | medium-low | § 5.D probe; § 11 amendment if surfaced. |
| `/public/org/:orgId/tiers` (inline dynamic import) breaks after schema repo path rename | n/a — repos stay per § 4.2 | None. |
| `handlers/membership/repos/` query-rich repo has imports that break post-cleanup | low — repo stays at OLD path | § 5.F confirms; no rewrite. |
| FINAL cutover — any drift accumulated from prior 6 cutovers surfaces now | high | Cr.8 typecheck + Cr.9 contract gate at full surface area. |
| ROADMAP P1-11 close-out documentation lag | low | Cr.10 MODULE_SPEC explicitly notes namespace dissolution + ROADMAP updates. |

---

## § 8 — Gates (post-dues floor)

| Gate | Floor |
| --- | --- |
| typecheck | 5/5 |
| unit | ≥ 5797 pass, 1 pre-existing env-flake accepted (post-dues baseline) |
| contract | ≥ 141 / 141 + new membership scenarios (dues cutover lifted floor to 141) |
| SDK drift | 0 / 454 |
| observability | ≥ 94 % |
| contract coverage | ≥ 83 % |

---

## § 9 — Awaiting checkpoint

Three explicit user sign-offs before Step Cr.1 begins:

1. **Scope** — 8 interfaces as listed in § 2.A. Out-of-scope per § 2.B confirmed (subscription routes stay hand-wired, governance + dashboard + credits + dues untouched, no Disciplinary interface).

2. **Decisions** — § 4.1 (single tag `Member/Membership`), § 4.2 (schemas + repos STAY at OLD canonical paths in `handlers/association:member/repos/` + `handlers/membership/repos/`), § 4.3 (handler subdir structure with provisional `legacy/` subdir for the 13 retained legacy handlers, finalized at § 5.A), § 4.4 (no kill step expected; Cr.7 reserved for jobs split), § 4.5 (subscription routes stay hand-wired), § 4.6 (jobs registrar closeout: statusRecomputeCron moves, creditIssue + complianceThreshold + directoryAutoPopulate stay at OLD path), § 4.7 (legacy membership jobs registrar moves with membership). Any objection or amendment?

3. **Sequence** — § 6's 10-step atomic execution with per-step typecheck + commit. Tag `member-membership-cutover` (FINAL) only on the cutover atomic; post-tag hygiene commits stay untagged (cert + credits + dues pattern).

---

## § 10 — Cr.1 pre-flight findings (PENDING)

Sections § 10.A through § 10.G appended after Cr.1 verifications run.

---

## § 11 — Amendments (PENDING)

Sections appended after Cr.1 surfaces deviations from § 4 decisions.

---

**Cr.0 closed. Cr.1 (pre-flight verifications per § 5.A through § 5.G) is next.**

On user confirmation of § 9 checkpoint (scope + decisions + sequence): proceed to Step Cr.1.
