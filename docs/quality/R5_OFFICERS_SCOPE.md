# R5 — Officers Scope (SKIP CASE)

**Date:** 2026-06-07
**Branch baseline:** `feature/member-rebuild` @ `612a3f20` (post-R5-elections-skip)
**Conclusion:** **R5 = SKIP.** The R2 governance cutover already absorbed the entire typespec-generated officers/positions surface. The one remaining officer-related interface (`Credits.OfficerTermsManagement`) belongs to R6 (credits), not R5.

---

## TL;DR

- TypeSpec interfaces `AssocPositionManagement` and `AssocOfficerTermManagement` were retagged `@tag("Member/Governance")` in **R2** (Wave 1) and their 12 handlers already live under `services/api-ts/src/handlers/member/governance/`.
- One extra interface exists for officers — `Credits.OfficerTermsManagement` at `/officer-terms/{organizationId}` — but it is **credit-compliance reporting**, tagged `@tag("Association:Member")` and lexically defined in `credits.tsp`. It will be retagged in **R6 (credits)**, not R5.
- Two hand-wired officer-domain routes (`transitionOfficerTerm`, `voidCreditEntry`) are deferred by design and stay in `handlers/association:member/` until the mega-module-split phase.
- Repos `governance.repo.ts` + `governance.schema.ts` stay in `association:member/repos/` — they are cross-consumed by 30+ files (middleware, seed, multiple module handlers) and out of the R-series rename scope.

**Action:** No tsp retag, no wipe, no regenerate, no Hurl, no tag cutover. Proceed to R6 (credits) as the next real step.

---

## §A — WHAT EXISTS (full inventory)

### A.1 TypeSpec interfaces

`specs/api/src/main.tsp`:

```tsp
// Lines 363–372 — Wave 1 governance (positions + officer terms) — IN-SCOPE OF R5
// (already migrated in R2)
@tag("Member/Governance")
@route("/association/member/positions")
interface AssocPositionManagement extends Association.Member.Governance.PositionManagement {}

@tag("Member/Governance")
@route("/association/member/officer-terms")
interface AssocOfficerTermManagement extends Association.Member.Governance.OfficerTermManagement {}

// Lines 294–296 — credit-compliance officer-term reporting — OUT OF R5 SCOPE
// (R6 credits will retag this)
@tag("Association:Member")
@route("/officer-terms")
interface OfficerTermsManagement extends Association.Member.Credits.OfficerTermsManagement {}
```

Sources:
- `specs/api/src/association/member/governance.tsp` — `Position`, `OfficerTerm`, `PositionRequest`, `OfficerTermRequest` models + `PositionManagement`, `OfficerTermManagement` interfaces.
- `specs/api/src/association/member/credits.tsp:139` — `OfficerTermsManagement` interface, single op `listOfficerTermsSummary`. This is credit-compliance, not governance.

### A.2 Generated handlers (already in `handlers/member/governance/`)

Migrated by R2 governance cutover — present at baseline `612a3f20`:

- `createOfficerTerm.ts` + `.test.ts`
- `createPosition.ts`
- `deleteOfficerTerm.ts`
- `deletePosition.ts`
- `getOfficerTerm.ts`
- `getPosition.ts`
- `listOfficerTerms.ts`
- `listPositions.ts`
- `updateOfficerTerm.ts` + `.test.ts`
- `updatePosition.ts`

(10 generated officer/position handlers — already cut over. Plus `election-role-enforcement.test.ts` covers the position/officer interplay.)

Generated route file:
- `services/api-ts/src/generated/openapi/routes.ts:1669-1700` — five officer-term routes
- `services/api-ts/src/generated/openapi/routes.ts:3076` — `/officer-terms/:organizationId` (credits-side, R6)

### A.3 Hand-wired officer-domain routes (DEFERRED, not in R5)

In `services/api-ts/src/app.ts`:

```
// L163-164:
import { transitionOfficerTerm } from '@/handlers/association:member/transitionOfficerTerm';

// L168-170:
// Void credit entry — S-G1-07 phantom #4 (hand-wired, handler self-enforces officer position)
import { voidCreditEntry } from '@/handlers/association:member/voidCreditEntry';

// L572-578:
// @hand-wired reason="officer transition checklist handover, not in TypeSpec" wave="M4-R3"
app.post('/association/member/org/:organizationId/officers/:termId/transition', ...);

// L583-585:
// @hand-wired reason="bulk-void manual credit awards by activityName, handler self-enforces officer position" wave="S-G1-07"
app.post('/association/member/credits/void-event', ...);
```

Both stay where they are. `transitionOfficerTerm` is the M4-R3 checklist-driven handover — deliberately outside TypeSpec. `voidCreditEntry` is S-G1-07 credit-bulk-void — belongs to credits domain.

### A.4 R6-credits-scope items (held back, surfaced here for context)

These will be retagged in R6, not R5:

| Location | Item | R6 action |
| --- | --- | --- |
| `main.tsp:294-296` | `OfficerTermsManagement extends Credits.OfficerTermsManagement` at `/officer-terms` | retag `@tag("Member/Credits")` and migrate handler |
| `association:member/listOfficerTermsSummary.ts` | hand-restored handler for the above | move to `member/credits/` in R6 wipe-and-restore |
| `app.ts:170 + 585` | `voidCreditEntry` hand-wired | re-evaluate during R6 — may stay hand-wired |

### A.5 Cross-module consumers of `governance.repo` / `governance.schema`

These imports keep `association:member/repos/governance.{repo,schema}.ts` LIVE — they are out of R5 scope:

- `middleware/officer-auth.ts`, `middleware/require-officer.ts`
- `test-utils/preload-pristine.ts`
- `seed/layer-2-users.ts`, `seed/layer-5-gap-fill.ts`
- `core/auth/officer-checks.ts`
- `core/ports/governance.port.ts`
- `core/domain-event-consumers.ts`
- `handlers/dues/downloadReceipt.ts`
- `handlers/person/getMyOfficerRole.ts`, `handlers/person/requestMyAccountDeletion.ts`
- `handlers/member/governance/*` (12 handlers + tests)
- `handlers/test-isolation.ts`
- `handlers/invite/bulkImportMembers.ts`
- `handlers/association:member/listOfficerTermsSummary.ts`, `transitionOfficerTerm.ts`, `getOrgDashboard.ts`

Repo relocation belongs to the mega-module-split work tracked in `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md`.

---

## §B — WHAT MOVES IN R5

**Nothing.** No handler relocation, no tsp retag, no regenerate, no wipe.

---

## §C — WHAT STAYS DEFERRED

### C.1 `transitionOfficerTerm` (hand-wired M4-R3)

By-design deferral. Checklist-based officer-handover flow with cross-cutting side effects (notification, audit-trail, credit-roll-forward) that don't lend themselves to a stateless OpenAPI operation. Stays at `handlers/association:member/transitionOfficerTerm.ts`. Wave M4-R3 owns any future migration.

### C.2 `voidCreditEntry` (hand-wired S-G1-07)

Bulk-void by activityName — credits-domain, may become an R6 candidate but currently hand-wired with inline officer-position enforcement. R6 scope will decide.

### C.3 Repos at `association:member/repos/`

`governance.repo.ts` + `governance.schema.ts` — 30+ live consumers. Relocation = mega-module-split phase, not R-series.

---

## §D — Updated R-series sequence

| Step | Sub-domain | Status |
| --- | --- | --- |
| R1 | chapters | ✅ cut over (`member-chapters-cutover`) |
| R2 | governance (elections + candidates + ballots + positions + officer-terms) | ✅ cut over (`member-governance-cutover`) |
| R3 | credentials | ✅ cut over (`member-credentials-cutover`) |
| R4 | directory | ✅ cut over (`member-directory-cutover`) |
| ~~R5 (elections)~~ | (skipped — absorbed by R2) | `member-elections-skip` |
| ~~R5 (officers)~~ | (skipped — absorbed by R2; credits-side deferred to R6) | `member-officers-skip` (after this doc) |
| **R5 (was R7)** | **credits** | **next up** |
| R6 (was R8) | dues | pending |
| R7 (was R9) | membership | pending |

Net: 4 sub-domains cut over, 2 SKIP, 3 remain. Two consecutive SKIPs validate the scope-first discipline — silent wipe would have corrupted state both times.

**Recommended next:** `/oli-base-domain`-style retro on the R-series sequence — the original 9-step plan over-estimated independence between governance, elections, and officers. Reality: R2 governance is a single fused sub-domain. R5 = credits with R6's `listOfficerTermsSummary` retag bundled in.

---

## §E — Verification commands run

```sh
# A.1 confirm tsp interfaces
grep -B2 -A4 -i 'AssocPositionManagement\|AssocOfficerTermManagement' specs/api/src/main.tsp

# A.2 confirm generated handlers in place
ls services/api-ts/src/handlers/member/governance/ | grep -iE 'officer|position|term'

# A.3 confirm hand-wired routes
grep -n -i 'transitionOfficerTerm\|voidCreditEntry' services/api-ts/src/app.ts

# A.4 confirm credits-side interface
grep -B2 -A20 'interface OfficerTermsManagement' specs/api/src/association/member/credits.tsp

# A.5 confirm cross-module consumers
grep -rln 'governance.repo\|governance.schema\|OfficerTermRepo\|PositionRepo' services/api-ts/src/ --include='*.ts'
```

All verifications match the conclusions above.

---

## §F — Gate posture

No gates need to run for R5 (no code change). R4 gates remain the floor for R6 (credits, formerly R7):

| Gate | R4 floor | R6 target |
| --- | --- | --- |
| typecheck | 5/5 | ≥ 5/5 |
| unit | 6027 pass (1 pre-existing fail) | ≥ 6027 |
| contract | 130/132 (2 pre-existing email flake) | ≥ 130 + new |
| SDK drift | 0/454 | 0/454 |
| observability | 94 % | ≥ 94 % |
| contract coverage | 81 % | ≥ 81 % |

---

## §G — Decision required

**Confirm:** proceed to credits (formerly R7, now the next real step, may or may not be relabeled R5 in the sequence — recommend keeping it labeled "credits" rather than re-numbering further) with the same R5.0-style scope-inventory pattern.

R6/credits scope-inventory should specifically address:
1. Which credits interfaces are tagged `Association:Member` vs `Member/Credits`?
2. Does `listOfficerTermsSummary` retag cleanly with the rest of credits, or does it need its own micro-step?
3. What's the boundary with `voidCreditEntry` (hand-wired) and `markCreditsForPeer` family?

Awaiting user checkpoint.
