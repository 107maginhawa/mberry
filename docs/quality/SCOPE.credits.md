# Credits — Scope (decomposition step 2)

**Date:** 2026-06-07
**Branch baseline:** `feature/member-rebuild` @ `c649683e` (post-certificates cutover + § 7 close-out)
**Sub-domain:** credits
**Target tag:** `Member/Credits`
**Tag-on-completion:** `member-credits-cutover`
**Classification:** FULL migration with cross-namespace retag + 1 hand-wired duplicate to resolve + 2 hand-wired holdouts to relocate (not a vanilla R-pattern; cleaner than certs but the cross-namespace wrinkle is real)

---

## §1 — Why this isn't a vanilla R-pattern

The R-series (R1 chapters → R4 directory) used a single-source-namespace retag. Credits is different on three axes:

1. **Cross-namespace surface.** Per `REMAINING_SCOPE.md` §1.B + §1.C, the credits scope spans **two source namespaces**: 2 interfaces from `Association.Member.Credits.*` and 6 from `Association.Operations.Training.*` (route-mounted under `/association/member/*`). All 8 currently carry `@tag("Association:Member")` in `main.tsp`. The `@tag` retag operates per extending interface in `main.tsp`, not on source namespaces, so a bulk find/replace of `Operations.Training` would over-reach into 8 sibling training/events interfaces that stay under their existing tags.

2. **Hand-wired duplicate.** `voidCreditEntry` is registered **twice**: by the generated route (`AssocEventCreditVoidManagement` → `/association/member/credits/void-event`) and by the hand-wired post in `app.ts:580` at the same path. The TypeSpec interface (`training.tsp:1561-1573`) declares only `x-security-required-roles`, no `x-require-position` extension, so the generated route enforces role-only; the handler self-enforces `President|Secretary|Treasurer` via `requirePosition(ctx, ...)` inside the body. The hand-wired duplicate exists from the pre-extension era and is now dead code (handler enforcement remains valid under either route).

3. **Hand-wired holdouts that ride along.** `getCreditTranscript` + `getCreditTranscriptPdf` (`app.ts:556-557`, WF-070) live in the credits handler dir but use an inline Zod query schema that is intentionally not in TypeSpec (cross-org consolidated export). They MUST stay hand-wired and at their import paths, but the imports they pull resolve into the credits handler dir, which moves in this cutover.

The good news: **no orphan handler** (cert had `listCertificates.ts` — none here), **no shim layer at the destination** (cert had two 1-LOC re-exports in `association:member/` — none here), and **no dynamic-import test traps** (cert had `slice-023` doing `await import(...)` — grep confirms zero dynamic imports of credit handlers across the tree).

---

## §2 — TypeSpec interfaces (8, source: 2 files)

### §2.A `Association.Member.Credits.*` (2 interfaces, `specs/api/src/association/member/credits.tsp`)

```tsp
// main.tsp:290-296 — to be retagged
@tag("Association:Member")
@route("/credit-compliance")
interface CreditComplianceManagement extends Association.Member.Credits.CreditComplianceManagement {}

@tag("Association:Member")
@route("/officer-terms")
interface OfficerTermsManagement extends Association.Member.Credits.OfficerTermsManagement {}
```

Operations:
- `CreditComplianceManagement`: `getCreditCompliance` (GET `/credit-compliance/{organizationId}`)
- `OfficerTermsManagement`: `listOfficerTermsSummary` (GET `/officer-terms/{organizationId}/{termId}` — credits-tagged officer-terms reporting)

### §2.B `Association.Operations.Training.*` (6 interfaces, `specs/api/src/association/operations/training.tsp`, route-mounted under member)

```tsp
// main.tsp:552-600 — to be retagged
@tag("Association:Member")
@route("/association/member/cpd-config")
interface AssocCpdConfigManagement extends Association.Operations.Training.CpdConfigManagement {}

@tag("Association:Member")
@route("/association/member/credits/manual")
interface AssocManualCreditManagement extends Association.Operations.Training.ManualCreditManagement {}

@tag("Association:Member")
@route("/association/member/credits/adjust")
interface AssocCreditAdjustmentManagement extends Association.Operations.Training.CreditAdjustmentManagement {}

@tag("Association:Member")
@route("/association/member/credits/void-event")
interface AssocEventCreditVoidManagement extends Association.Operations.Training.EventCreditVoidManagement {}

@tag("Association:Member")
@route("/association/member/credits")
interface AssocMemberPeerCreditsManagement extends Association.Operations.Training.MemberPeerCreditsManagement {}

@tag("Association:Member")
@route("/association/member/compliance")
interface AssocComplianceManagement extends Association.Operations.Training.ComplianceManagement {}
```

Operations:
- `AssocCpdConfigManagement`: `getCpdConfig`, `updateCpdConfig`
- `AssocManualCreditManagement`: `awardManualCredit`
- `AssocCreditAdjustmentManagement`: `adjustCreditEntry`
- `AssocEventCreditVoidManagement`: `voidCreditEntry`
- `AssocMemberPeerCreditsManagement`: `listMemberCreditsForPeer`
- `AssocComplianceManagement`: per existing routes (verify with regen)

Retag plan (per-interface, both files): `@tag("Association:Member")` → `@tag("Member/Credits")` on **exactly these 8** wrapping interfaces. Source namespace declarations stay untouched. Sibling Operations.Training extending interfaces (training/courses/quizzes/enrollments/lifecycle/providers — main.tsp:516-544) stay `Association:Member` or move to their own decomposition step later.

### §2.C OUT OF SCOPE (don't touch in this cutover)

| Interface | Tag | Route | Reason for exclusion |
| --- | --- | --- | --- |
| `PersonMyCreditsManagement extends Operations.Training.MyCreditsManagement` | `Person` | `/persons/me/credits` | Person-namespaced, member-facing self-view; stays in Person domain decomposition. |
| `PersonCustomManagement.createMyCreditEntry / listMyCreditEntries / getMyCreditSummary` (`person-custom.tsp`) | `Person` | `/persons/me/credit-entries`, `/persons/me/credit-summary` | Person-namespaced custom interface (not via training.tsp); same exclusion. |
| `AssocOfficerTermManagement extends Member.Governance.OfficerTermManagement` (main.tsp:372) | `Member/Governance` | `/officer-terms` (governance-side) | Already migrated under R2 governance; do not disturb. |

### §2.D Generated registry imports (`services/api-ts/src/generated/openapi/registry.ts`)

Current paths (all under `association:member/`):
- `listMemberCreditsForPeer` ← `/association:member/listMemberCreditsForPeer`
- `adjustCreditEntry` ← `/association:member/adjustCreditEntry`
- `awardManualCredit` ← `/association:member/awardManualCredit`
- `voidCreditEntry` ← `/association:member/voidCreditEntry`
- `getCreditCompliance` ← `/association:member/getCreditCompliance`
- `listOfficerTermsSummary` ← `/association:member/listOfficerTermsSummary`
- (plus `AssocCpdConfigManagement` + `AssocComplianceManagement` ops — confirm at regen)
- `createMyCreditEntry`, `listMyCreditEntries`, `getMyCreditSummary`, `getMyCredits` ← `/person/...` (STAY at person/, out of scope)

Post-cutover, the 6 credits-domain (non-Person) imports should resolve to `'../../handlers/member/credits/<name>'`.

---

## §3 — Hand-wired holdouts (`services/api-ts/src/app.ts`)

### §3.A Stay hand-wired but relocate imports

| Line | Handler | Current import path | Post-cutover path | Reason |
| --- | --- | --- | --- | --- |
| `app.ts:556` | `getCreditTranscript` | `@/handlers/association:member/getCreditTranscript` | `@/handlers/member/credits/getCreditTranscript` | WF-070 cross-org consolidated transcript; inline Zod query schema not in TypeSpec. |
| `app.ts:557` | `getCreditTranscriptPdf` | `@/handlers/association:member/getCreditTranscriptPdf` | `@/handlers/member/credits/getCreditTranscriptPdf` | WF-070 PDF analog; same inline schema reason. |
| `app.ts:580` | `voidCreditEntry` (hand-wired duplicate) | — | **DELETE** | Generated route covers same path with same handler. See §4.1. |

### §3.B Untouched (NOT part of credits domain)

| Line | Handler | Reason |
| --- | --- | --- |
| `app.ts:573` | `transitionOfficerTerm` | Governance officer transition checklist (M4-R3); already lives in `association:member/` but belongs to the governance decomposition (handled by R2). No move, no path rewrite for this cutover. |

---

## §4 — Decisions baked in (no further checkpoint needed for these)

### §4.1 Hand-wired duplicate `POST /association/member/credits/void-event` (`app.ts:580`)

**Decision:** kill the hand-wired duplicate. Use the generated route.

**Why:**
- Both routes resolve to the same handler (`voidCreditEntry`).
- The handler self-enforces position (`requirePosition(ctx, [PRESIDENT, SECRETARY, TREASURER])`) regardless of which route invokes it — generated or hand-wired.
- The TypeSpec interface (`training.tsp:EventCreditVoidManagement`) carries `@useAuth(bearerAuth)` + `@extension("x-security-required-roles", #["association:admin", "association:staff"])` so the generated route enforces role + auth via middleware; the handler-level position check stacks correctly on top.
- The hand-wired duplicate is a pre-extension-era artifact; killing it removes route-order ambiguity (cert §4.1 analog).
- **Pre-flight verification** required: confirm Hono first-wins order (does `app.ts:580` shadow the later `routes.ts` registration, or do they coexist at request time?). If shadow, the generated route was dead; if both live, only one resolves per request. Either way, killing the hand-wired one is safe because the generated one is the canonical contract surface.

### §4.2 `listOfficerTermsSummary` fold-in

**Decision:** include in the credits cutover (move to `handlers/member/credits/`).

**Why:**
- It's tagged `Member/Credits` semantically (credits-tagged officer-terms reporting per `REMAINING_SCOPE.md` §1.B), even though the data is officer-terms.
- The credits interface `OfficerTermsManagement` in `Association.Member.Credits.*` defines the operation; the handler at `handlers/association:member/listOfficerTermsSummary.ts` matches that interface.
- Separating it from credits would leave a one-handler orphan under another tag.
- The sibling `transitionOfficerTerm` (hand-wired, governance) stays where it is — different domain.

### §4.3 `AssocCpdConfigManagement` + `AssocComplianceManagement` fold-in

**Decision:** fold both into the credits cutover.

**Why:**
- `cpd-config` defines required credits + cycle length — pure credits-domain config, not training-domain.
- `compliance` aggregates credit-entry totals against cpd-config — same domain.
- Source namespace is `Operations.Training` only because the original tsp authors batched config + reporting models there; the API surface routes them under `/association/member/*` and the handler dir already has them under `association:member/getCreditCompliance.ts`.
- Leaving these in a future "operations:training" decomposition would split the credits domain across two cutovers and break the move-the-schema rule (compliance reads `org_cpd_config` which lives in the credits schema file).

### §4.4 Person-namespaced credit operations OUT OF SCOPE

**Decision:** do not touch `createMyCreditEntry`, `listMyCreditEntries`, `getMyCreditSummary`, `getMyCredits`, or `PersonMyCreditsManagement`.

**Why:**
- Person namespace, Person tag, Person handler dir.
- They cross-import `CreditService` + `CreditEntryRepository` + `credits.schema` — those imports need rewriting to the new path (`@/handlers/member/credits/...`), but the handlers themselves stay at `handlers/person/`.
- Same pattern as cert (`getMyIdCard` stayed in `person/`).

### §4.5 Schema + repo + utilities relocation

**Decision:** move all of these into `handlers/member/credits/` at the same relative paths.

| Current | Post-cutover |
| --- | --- |
| `handlers/association:member/repos/credits.schema.ts` | `handlers/member/credits/repos/credits.schema.ts` |
| `handlers/association:member/repos/credits.repo.ts` | `handlers/member/credits/repos/credits.repo.ts` |
| `handlers/association:member/services/credit.service.ts` (53 LOC) | `handlers/member/credits/services/credit.service.ts` |
| `handlers/association:member/utils/credit-cycle.ts` (172 LOC) + `.test.ts` (271 LOC) | `handlers/member/credits/utils/credit-cycle.ts` + test |

**Caveat:** `CreditEntryRepository` co-locates `ProfessionalLicense` + `LicenseRenewalAlert` schemas. If those bleed across repo boundaries, isolate the credits-only methods at move-time (or leave the repo file structurally intact and document the cross-domain coupling for the next decomposition). Pre-flight (§5.B) decides.

---

## §5 — Pre-flight verifications needed (3 items)

### §5.A Route-order check on the `void-event` duplicate

```sh
# Confirm whether the hand-wired app.ts:580 registration runs BEFORE the
# generated routes.ts registration (Hono first-wins). If yes → hand-wired
# is currently serving and generated is dead. If no → both coexist and
# request resolution is non-deterministic on the trailing slash.
grep -n "registerGeneratedRoutes\\|app.post('/association/member/credits/void-event'" services/api-ts/src/app.ts services/api-ts/src/generated/openapi/routes.ts | head
```

Expected outcome: identify the dead route. Either way, the §4.1 decision (kill hand-wired) is safe.

### §5.B Repo isolation check on `credits.repo.ts`

```sh
# Confirm whether CreditEntryRepository is the only class in credits.repo.ts
# or whether ProfessionalLicense + LicenseRenewalAlert classes share the file.
grep -nE 'export class|^class' services/api-ts/src/handlers/association:member/repos/credits.repo.ts
```

Expected outcome: if shared, move whole file as a unit but flag the cross-domain coupling in the resulting MODULE_SPEC so the next decomposition (membership / credentials) knows to relocate the non-credit classes.

### §5.C Hurl idempotency check on `uq_credit_source_person`

The schema constraint `unique('uq_credit_source_person').on(sourceType, sourceId, personId)` (in `credits.schema.ts`) is the analog of cert's `certificate_training_person_unique`. Re-issuing a credit with the same `(sourceType, sourceId, personId)` triple hits the constraint. For Hurl scenarios, randomize `sourceId` per `{{suffix}}` (or use distinct `manual_award` events) so re-runs stay idempotent. Document this inline in each new credit hurl file (mirror the cert pattern from `a59ecdd9`).

---

## §6 — Execution sequence

10 atomic steps, each followed by `bun run --filter '*' typecheck`. Commit after each.

### Step Cr.1 — Pre-flight verifications (§5.A, §5.B, §5.C)

### Step Cr.2 — Retag main.tsp (per-interface) + regenerate

```sh
# Edit specs/api/src/main.tsp:
#   line 290-296 (2 interfaces, Member.Credits scope) → @tag("Member/Credits")
#   line 552-600 (6 interfaces, Operations.Training scope) → @tag("Member/Credits")
# Total: 8 @tag annotations changed, per-interface, NOT bulk find/replace.
cd specs/api && bun run build
cd ../../services/api-ts && bun run generate
```

Sibling training/events interfaces (main.tsp:516-544) retain their existing tags.

### Step Cr.3 — Restore canonical impls from baseline at new path

Per cert pattern. Restore 9 handlers + 22 tests under `handlers/member/credits/`. Source from baseline `c649683e`:

```sh
# Generated handlers (8 ops + 1 fold-in)
for f in listMemberCreditsForPeer adjustCreditEntry awardManualCredit voidCreditEntry getCreditCompliance listOfficerTermsSummary; do
  git show c649683e:services/api-ts/src/handlers/association:member/$f.ts > services/api-ts/src/handlers/member/credits/$f.ts
  git show c649683e:services/api-ts/src/handlers/association:member/$f.test.ts > services/api-ts/src/handlers/member/credits/$f.test.ts 2>/dev/null || true
done
# Hand-wired (relocated, not killed)
for f in getCreditTranscript getCreditTranscriptPdf; do
  git show c649683e:services/api-ts/src/handlers/association:member/$f.ts > services/api-ts/src/handlers/member/credits/$f.ts
  git show c649683e:services/api-ts/src/handlers/association:member/$f.test.ts > services/api-ts/src/handlers/member/credits/$f.test.ts 2>/dev/null || true
done
# Plus credits.test.ts (871 LOC integration suite) and createCreditEntry.ts (service-helper, confirm scope)
```

The `credits.test.ts` (871 LOC integration tests) and `createCreditEntry.ts` (77 LOC, called by Person handlers via CreditService) need scope confirmation at this step — they may be the credit analogs of cert's `listCertificates.ts` service-helper.

### Step Cr.4 — Move repos + utils + service to new path

```sh
mkdir -p services/api-ts/src/handlers/member/credits/{repos,utils,services}
git mv services/api-ts/src/handlers/association:member/repos/credits.schema.ts services/api-ts/src/handlers/member/credits/repos/
git mv services/api-ts/src/handlers/association:member/repos/credits.repo.ts services/api-ts/src/handlers/member/credits/repos/
git mv services/api-ts/src/handlers/association:member/services/credit.service.ts services/api-ts/src/handlers/member/credits/services/
git mv services/api-ts/src/handlers/association:member/utils/credit-cycle.ts services/api-ts/src/handlers/member/credits/utils/
git mv services/api-ts/src/handlers/association:member/utils/credit-cycle.test.ts services/api-ts/src/handlers/member/credits/utils/
```

### Step Cr.5 — Delete moved originals

```sh
# Delete the 9 generated/hand-wired handler files at the old path.
# (NOT credits.repo.ts / credit.service.ts / etc — those were git-mv'd in Cr.4.)
for f in listMemberCreditsForPeer adjustCreditEntry awardManualCredit voidCreditEntry getCreditCompliance listOfficerTermsSummary getCreditTranscript getCreditTranscriptPdf; do
  git rm services/api-ts/src/handlers/association:member/$f.ts
  git rm services/api-ts/src/handlers/association:member/$f.test.ts 2>/dev/null || true
done
```

### Step Cr.6 — Rewrite cross-module imports

Hot spots (5 + 2 + 1 + 2 files):
- `services/api-ts/src/app.ts:556-557` — `@/handlers/association:member/getCreditTranscript{,Pdf}` → `@/handlers/member/credits/...`
- `services/api-ts/src/app.ts:580` — DELETE entire hand-wired registration (§4.1)
- 6× `services/api-ts/src/handlers/person/{createMyCreditEntry,exportMyData,getMyCredits,listMyCreditEntries,requestDataExport,getMyCreditSummary}.ts` — imports of `CreditService` + `CreditEntryRepository` + `credits.schema` → new paths
- `services/api-ts/src/core/domain-event-consumers.ts:34` + ~1147-1180 (person.deleted cascade) — `creditEntries` import path
- `services/api-ts/src/seed/layer-3-modules.ts` + `layer-5-gap-fill.ts` — `creditEntries`, `orgCpdConfig` imports
- `services/api-ts/src/test-utils/preload-pristine.ts` — `CreditEntryRepository` import

Verify with:
```sh
grep -rn '@/handlers/association:member/\(repos/credits\|services/credit\|utils/credit\|getCreditTranscript\|listMemberCreditsForPeer\|adjustCreditEntry\|awardManualCredit\|voidCreditEntry\|getCreditCompliance\|listOfficerTermsSummary\)' services/api-ts/src/ --include='*.ts'
```

Should return zero hits after Cr.5 + Cr.6.

### Step Cr.7 — Kill hand-wired void-event duplicate

Delete `app.ts:580-586` (the `app.post('/association/member/credits/void-event', ...)` block + its `@hand-wired` comment).

### Step Cr.8 — typecheck gate

```sh
cd services/api-ts && bun run typecheck
```

Must be 5/5.

### Step Cr.9 — Hurl scenarios

Current baseline: `credit-compliance-flow.hurl` (38 LOC) + `credits-flow.hurl` (65 LOC). Both pass. Extend with **≥ 3 new files** under `specs/api/tests/contract/member/credits/`:

1. `credits-manual-award.hurl` — officer awards a manual credit → recipient sees it in their credit list. Per-suffix `sourceId` to avoid `uq_credit_source_person`.
2. `credits-void-event.hurl` — officer bulk-voids by activityName → status=voided. Pre-condition: at least one active manual credit for the targeted person; idempotent via suffix.
3. `credits-cpd-config.hurl` — get + update cpd-config (60 credits / 3-year cycle defaults). Idempotent via PATCH.

Optional 4th + 5th to match cert depth: `credits-compliance-report.hurl`, `credits-adjust.hurl` (officer adjusts with reason).

**Prereqs to call out in the file headers** (carry-forward from cert lessons):
- CSRF + Origin auto-injected; do not double-add.
- Seed officer `test@memberry.ph` = President (matches `Treasurer|Secretary|President` allow list on void).
- Probe response envelopes before asserting jsonpath — `{data: ...}` vs `{data: []}` vs `{data: {...}}`.
- MinIO running not required (no storage paths in credits).

### Step Cr.10 — `MODULE_SPEC.member.credits.md` + gates + tag

Mirror the cert MODULE_SPEC's 7-section layout. Run all gates:

```sh
cd services/api-ts && bun test                      # unit
API_URL=http://localhost:7213 bun run scripts/run-contract-tests.ts  # ≥ 135 + new
bun run scripts/check-sdk-compat.ts                 # 0 drift / 454 ops
bun run scripts/audit-observability.ts              # ≥ 94 %
bun run scripts/contract-coverage-gap.ts            # ≥ 81 %
git tag -a member-credits-cutover -m "Credits sub-domain cut over to handlers/member/credits/"
```

Tag only the cutover atomic — post-cutover hygiene commits (hurl supplements, marker comments, MODULE_SPEC close-out) intentionally not retagged (cert pattern).

---

## §7 — Risk register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Bulk @tag find/replace catches sibling training interfaces | high if attempted, low with per-interface edits | §6 Cr.2 mandates per-interface edits; pre-step diff review before regen. |
| Generator emits to wrong path for cross-namespace ops | low | Proven mechanic from R1-R4. Generated registry imports use operationId → handler path mapping which is per-operation, not per-namespace. |
| `domain-event-consumers.ts` credit hooks break (3 consumers) | high — silent runtime failure, no compile-time guard for dynamic event names | Restore + path-rewrite of these 3 hooks is mechanical; ADD a unit test (or run existing `domain-event-consumers.test.ts`) before final typecheck pass. |
| Hurl scenarios hit `uq_credit_source_person` on re-run | medium | §5.C documents per-suffix `sourceId` randomization; mirror cert `a59ecdd9` pattern (fresh recipient sign-up per `{{suffix}}`). |
| `credits.repo.ts` co-locates non-credit classes (`ProfessionalLicense`, `LicenseRenewalAlert`) | low for cutover, medium for future | §5.B pre-flight catches; document in MODULE_SPEC for next decomposition. |
| `voidCreditEntry` route-order ambiguity persists after hand-wired delete | very low | §4.1 verification at §5.A confirms only one registration remains. |
| Person handlers compile but break at runtime due to repo path | medium | §6 Cr.6 grep verification + run `bun test src/handlers/person/createMyCreditEntry.test.ts` before final typecheck. |
| `listOfficerTermsSummary` operation-id mismatch (per Explore Discrepancy #4) | low | Confirm during Cr.2 regen — registry.ts line will surface mismatch via TypeScript error. |
| MinIO infra dep (carry-forward from cert) | n/a for credits | Credits domain doesn't touch storage. Skip. |

---

## §8 — Gates (post-cert floor, raised by certs cutover)

| Gate | Floor |
| --- | --- |
| typecheck | 5/5 |
| unit | ≥ post-cert baseline (verify at Cr.10 by running once; baseline established at `c649683e`) |
| contract | ≥ 135 / 135 + new credits scenarios (cert cutover lifted floor to 135) |
| SDK drift | 0 / 454 |
| observability | ≥ 94 % |
| contract coverage | ≥ 81 % |

---

## §9 — Awaiting checkpoint

Three explicit user-sign-offs before Step Cr.1 begins:

1. **Scope** — 8 interfaces as listed in §2.A + §2.B. Out-of-scope per §2.C confirmed. `transitionOfficerTerm` (governance, hand-wired) and `Person.*` credit operations stay untouched.

2. **Decisions** — §4.1 (kill hand-wired void duplicate), §4.2 (fold-in `listOfficerTermsSummary`), §4.3 (fold-in `cpd-config` + `compliance`), §4.4 (Person out of scope), §4.5 (relocate schema/repo/utilities at same relative paths). Any objection or amendment?

3. **Sequence** — §6's 10-step atomic execution with per-step typecheck + commit. Tag `member-credits-cutover` only on the cutover atomic; post-cutover hygiene commits stay untagged (cert pattern).

---

## §10 — Cr.1 pre-flight findings (resolved)

### §10.A — Route order on `POST /association/member/credits/void-event`

`app.ts:468` calls `registerOpenAPIRoutes(app, ...)`; the `HAND-WIRED ROUTES` section begins at `app.ts:471+`; the duplicate hand-wired `app.post('/association/member/credits/void-event', ...)` is at `app.ts:580`. Hono first-wins → **generated route wins**, hand-wired is dead code. §4.1 (kill hand-wired) is safe — zero runtime impact.

### §10.B — `credits.repo.ts` class inventory

Three classes in one file (`services/api-ts/src/handlers/association:member/repos/credits.repo.ts`):

| Line | Class | Domain |
| --- | --- | --- |
| 35 | `CreditEntryRepository` | credits ✓ in scope |
| 215 | `ProfessionalLicenseRepository` | credentials ✗ out of scope |
| 264 | `LicenseRenewalAlertRepository` | credentials ✗ out of scope |

The file imports `./credentials.schema` (same dir, also hybrid). **Decision: leave `credits.repo.ts` AND `credits.schema.ts` at the OLD path**; credit handlers at `handlers/member/credits/<name>.ts` cross-import via `@/handlers/association:member/repos/credits.{repo,schema}`. Mirrors the cert pattern (certs cross-imports from `credentials.repo` at the old path). Tech debt documented for a future credentials/credits repo split.

**Amendment to §4.5:** the original §4.5 said "move all of these into `handlers/member/credits/` at the same relative paths." Override: move ONLY `services/credit.service.ts` + `utils/credit-cycle{,.test}.ts` to the new path. Keep `repos/credits.{repo,schema}.ts` at the old path.

### §10.C — `uq_credit_source_person` Hurl idempotency plan

Manual-credit writers consume `body.idempotencyKey`:
- `adjustCreditEntry.ts:47` — `body.idempotencyKey ?? randomUUID()` (sourceId)
- `awardManualCredit.ts:36` — `body.idempotencyKey` (sourceId, required)

Hurl scenarios pass `"idempotencyKey": "{{suffix}}-<scenario>"` to keep `(sourceType, sourceId, personId)` unique per run.

`createCreditEntry.ts` (service-helper, not registered) doesn't set sourceId — null safe under the unique constraint.

Job-side `processCreditIssue` (`handlers/association:member/jobs/creditIssue.ts:42`) swallows the constraint via `err.code === '23505'` — Hurl indirectly testing event-driven credits won't see a 500.

### §10.D — Operation inventory (11 ops across 8 interfaces)

| # | Interface | OperationId | Handler file (current path) |
| --- | --- | --- | --- |
| 1 | `CreditComplianceManagement` | `getCreditCompliance` | `getCreditCompliance.ts` |
| 2 | `OfficerTermsManagement` | `listOfficerTermsSummary` | `listOfficerTermsSummary.ts` |
| 3 | `CpdConfigManagement` | `getOrgCpdConfig` | `getOrgCpdConfig.ts` |
| 4 | `CpdConfigManagement` | `updateOrgCpdConfig` | `updateOrgCpdConfig.ts` |
| 5 | `ManualCreditManagement` | `awardManualCredit` | `awardManualCredit.ts` |
| 6 | `CreditAdjustmentManagement` | `adjustCreditEntry` | `adjustCreditEntry.ts` |
| 7 | `EventCreditVoidManagement` | `voidCreditEntry` | `voidCreditEntry.ts` |
| 8 | `MemberPeerCreditsManagement` | `listMemberCreditsForPeer` | `listMemberCreditsForPeer.ts` |
| 9 | `ComplianceManagement` | `getComplianceReport` | `getComplianceReport.ts` |
| 10 | `ComplianceManagement` | `refreshCompliance` | `refreshCompliance.ts` |
| H1 | hand-wired | `getCreditTranscript` (WF-070) | `getCreditTranscript.ts` |
| H2 | hand-wired | `getCreditTranscriptPdf` (WF-070) | `getCreditTranscriptPdf.ts` |

**Potential dead handlers** (`getCpdConfig.ts`, `updateCpdConfig.ts` — sit alongside the `getOrgCpdConfig.ts` / `updateOrgCpdConfig.ts` pair). Confirm during Cr.3: if they have no registry references and no other importers, delete with the cutover (cert `listCertificates`-style decision — but here, dead means dead).

### §10.E — `credits.test.ts` + `createCreditEntry.ts` scope

`credits.test.ts` (871 LOC) has 20 `describe` blocks:
- **7 credentials-domain**: `createProfessionalLicense`, `getProfessionalLicense`, `listProfessionalLicenses`, `updateProfessionalLicense`, `deleteProfessionalLicense`, `listLicenseRenewalAlerts`, `acknowledgeLicenseRenewalAlert`
- **13 credits-domain**: `createCreditEntry`, `getCreditTranscript`, `[BR-11]` cycle (×2), `[BR-12]` carryover, `[BR-13]` auto-credits, `summarizeCycle`, `[PRC-03]` batch, `[BR-14]` cross-org, `[AC-M10-001]` transcript, `[AC-M10-001]` compliance, `[AC-M10-003]` excess carryover, `[AC-M10-004]` toggle independence

`createCreditEntry.ts` (77 LOC) is consumed only by `credits.test.ts:148, 155` dynamic imports. No registry presence. Service-helper.

**Decision (deferred split):** at Cr.3 + Cr.4, MOVE `credits.test.ts` AS-IS to `handlers/member/credits/`; MOVE `createCreditEntry.ts` with a marker comment matching cert's `listCertificates.ts` pattern ("service-helper, not a registered route"). Document the credentials describes inside `credits.test.ts` as cross-domain tech debt in the MODULE_SPEC; schedule the file split for when the credentials post-R3 test-path consolidation runs.

---

## §11 — Net §4/§6 amendments (post-Cr.1)

- §4.5 → see §10.B amendment: schema + repo stay at OLD path; only `services/` + `utils/` move.
- §6 Cr.4 → only `git mv` `services/credit.service.ts` + `utils/credit-cycle{,.test}.ts` (not `repos/`).
- §6 Cr.5 → leave `repos/credits.{repo,schema}.ts` untouched at the OLD path.
- §6 Cr.6 → grep verification updated:
  ```sh
  grep -rn '@/handlers/association:member/\(services/credit\|utils/credit\|getCreditTranscript\|listMemberCreditsForPeer\|adjustCreditEntry\|awardManualCredit\|voidCreditEntry\|getCreditCompliance\|listOfficerTermsSummary\|getOrgCpdConfig\|updateOrgCpdConfig\|getComplianceReport\|refreshCompliance\)' services/api-ts/src/ --include='*.ts'
  ```
  Should return zero hits. `repos/credits` import paths intentionally stay.
- §6 Cr.3 → restore handler file list expanded to 11 generated ops + 2 hand-wired transcripts + 1 service-helper (`createCreditEntry`) + 1 test (`credits.test.ts`). Dead `getCpdConfig.ts` / `updateCpdConfig.ts` confirmed-or-deleted during this step.

Cr.1 closed. Cr.2 (per-interface main.tsp retag + regen) is next.

On confirmation: proceed to Step Cr.1 (pre-flight §5.A, §5.B, §5.C).
