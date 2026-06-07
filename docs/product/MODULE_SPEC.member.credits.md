# MODULE_SPEC: member/credits

Second sub-domain of the mega-module decomposition's post-R4 phase,
cut over directly after member/certificates. Follows the same FULL-
migration-with-consolidation pattern but with three credits-specific
wrinkles: cross-namespace retag (Member.Credits + Operations.Training),
1 hand-wired duplicate killed, 2 hand-wired holdouts relocated.

## 1. Purpose

Owns the CPD-credits surface of an association: manual award + officer
adjustment + bulk event void + member self-service summary + officer
compliance reporting + per-org CPD configuration. Eight TypeSpec
interfaces, 11 generated operations, plus 2 hand-wired routes (cross-
org transcript export, WF-070).

- **Credit Compliance** — `getCreditCompliance` (officer-scoped
  org compliance report) and `getComplianceReport` (paginated standings
  table). `refreshCompliance` triggers the materialized-view recompute.
- **Credit Award** — `awardManualCredit` (officer awards self-reported
  manual credit, handler self-enforces President | Secretary | Treasurer),
  `adjustCreditEntry` (officer manual adjustment with reason),
  `voidCreditEntry` (bulk-void by activityName).
- **Peer view** — `listMemberCreditsForPeer` (directory profile
  cross-member view scoped by org).
- **CPD Config** — `getOrgCpdConfig` / `updateOrgCpdConfig` (per-org
  required credits + cycle length + SDL cap + cycle start month).
  The on-disk handlers are `getCpdConfig.ts` and `updateCpdConfig.ts`;
  the typespec-allocated names `getOrgCpdConfig` / `updateOrgCpdConfig`
  are 1-line re-export shims kept post-cutover for spec/code wire
  symmetry.
- **Officer-terms summary** — `listOfficerTermsSummary` (credits-tagged
  officer-terms reporting; same handler, retagged under Member/Credits
  for spec coherence).

Plus, by design hand-wired (kept, relocated):
- **Credit Transcript** (`/persons/me/credit-transcript` +
  `/persons/me/credit-transcript/pdf`) — `getCreditTranscript` +
  `getCreditTranscriptPdf` (WF-070, Wave-2b). Cross-org consolidated
  credit transcript; inline Zod query schema (registrationDate,
  cycleStartMonth, cycleStartDay) intentionally not in TypeSpec.

## 2. Bounded Context

In scope (cut over by `0f25bcef`):
- The 8 TypeSpec interfaces wired in `main.tsp` under
  `@tag("Member/Credits")` (2 from `Association.Member.Credits.*`,
  6 from `Association.Operations.Training.*` route-mounted under
  `/association/member/*`):
  - `CreditComplianceManagement` (`/credit-compliance`)
  - `OfficerTermsManagement` (`/officer-terms`)
  - `AssocCpdConfigManagement` (`/association/member/cpd-config`)
  - `AssocManualCreditManagement` (`/association/member/credits/manual`)
  - `AssocCreditAdjustmentManagement` (`/association/member/credits/adjust`)
  - `AssocEventCreditVoidManagement` (`/association/member/credits/void-event`)
  - `AssocMemberPeerCreditsManagement` (`/association/member/credits`)
  - `AssocComplianceManagement` (`/association/member/compliance`)
- The 11 generated routes (one per operation: see §3 inventory).
- The 2 hand-wired transcript routes (relocated to new path; still
  registered in `app.ts`).
- The owned `services/credit.service.ts` facade (consumed by Person-
  namespaced handlers across the module boundary).
- The owned `utils/credit-cycle.ts` (registration-based cycle
  calculation per BR-11, carryover per BR-12) and
  `utils/transcript-template.ts` (cross-org PDF rendering).

Out of scope (intentionally untouched by the credits cutover):
- `PersonMyCreditsManagement` (Person tag, `/persons/me/credits`,
  `getMyCredits`) — stays in Person-domain.
- `PersonCustomManagement.createMyCreditEntry / listMyCreditEntries /
  getMyCreditSummary` (person-custom.tsp) — Person-namespaced custom
  interface; handlers stay at `handlers/person/`.
- `AssocOfficerTermManagement` (Member/Governance tag) — already
  migrated under R2 governance.
- `transitionOfficerTerm` (governance hand-wired at `app.ts:573`,
  M4-R3 officer transition checklist) — not part of credits domain.
- `repos/credits.{repo,schema}.ts` + `repos/credentials.repo.ts` +
  `repos/governance.repo.ts` + `repos/compliance.repo.ts` — hybrid
  files (credits.repo.ts co-locates ProfessionalLicenseRepository +
  LicenseRenewalAlertRepository); stay at the OLD path per the
  `SCOPE.credits.md §10.B amendment` (mirrors the cert pattern where
  `credentials.repo.ts` stayed at the old path post-R3).

Adjacent modules and the seams between them:

| Adjacent module | Seam |
| --- | --- |
| `handlers/person/*` | 6 person handlers cross-import `CreditService` (createMyCreditEntry) and `CreditEntryRepository` / `creditEntries` / `orgCpdConfig` / `getCycleForDate`. Module boundary respected; Person handlers stay where they are. |
| `core/domain-event-consumers` | 3 credit hooks: `credit.awarded` (notification), `credit.adjusted` (notification), `person.deleted` cascade (anonymize `createdBy`/`updatedBy` on retained `credit_entry` rows). Cutover preserved all 3; smoke-checked under `bun test`. |
| `core/jobs/credit.issue` | `processCreditIssue` (handlers/association:member/jobs/creditIssue.ts) — auto-credits from training/event completion. Stays at old path with `jobs/`-dir convention (same as R3 credentials — jobs do not move with handlers). Handler imports `creditEntries` + `orgCpdConfig` from old-path schema, unchanged. |
| `association:member/repos/{credits,credentials,compliance,governance}.repo` | Cross-module read pattern — credit handlers at new path import via `@/handlers/association:member/repos/<name>` absolute paths. Cert-pattern coupling, tech debt documented for a future credentials/credits repo split. |
| `core/audit/audit-action` | Per-route audit middleware via `@extension("x-audit", ...)`. `createMyCreditEntry` declares an audit extension (Person namespace, not migrated). Officer-side credit operations rely on TypeSpec-injected audit middleware. |
| `seed/layer-{3,5}-*` | Seed paths import `creditEntries` + `orgCpdConfig` from the unchanged schema. No path rewrite needed beyond Cr.6 which only touched references that moved. |

## 3. Files (post-cutover, baseline `0f25bcef`)

`services/api-ts/src/handlers/member/credits/`:

| File | LOC | Role |
| --- | --- | --- |
| `awardManualCredit.ts` | 51 | TypeSpec-generated; officer-scoped; handler self-enforces position; idempotent on `(sourceType, sourceId, personId)` via `uq_credit_source_person`. |
| `adjustCreditEntry.ts` | 101 | TypeSpec-generated; officer adjustment with reason. |
| `voidCreditEntry.ts` | 53 | TypeSpec-generated; bulk-void by `activityName`; hand-wired duplicate (`app.ts:580`) killed in Cr.7. |
| `listMemberCreditsForPeer.ts` | 50 | TypeSpec-generated; directory cross-member view. |
| `getCreditCompliance.ts` | 103 | TypeSpec-generated; officer org compliance report. |
| `getComplianceReport.ts` | ~70 | TypeSpec-generated; paginated standings table. |
| `refreshCompliance.ts` | ~30 | TypeSpec-generated; triggers materialized-view recompute. |
| `getOrgCpdConfig.ts` | 1 | Wire-name shim re-exporting `getCpdConfig`. |
| `updateOrgCpdConfig.ts` | 1 | Wire-name shim re-exporting `updateCpdConfig`. |
| `getCpdConfig.ts` | ~30 | Real impl backing the `getOrgCpdConfig` shim; officer-scoped (President | Secretary | Treasurer); auto-creates default (60/3/40/1) on first read. |
| `updateCpdConfig.ts` | ~60 | Real impl backing the `updateOrgCpdConfig` shim; restricted to President | Secretary. |
| `listOfficerTermsSummary.ts` | ~60 | TypeSpec-generated; credits-tagged officer-terms summary. |
| `getCreditTranscript.ts` | 76 | Hand-wired WF-070 (cross-org export); registered at `app.ts:556`. |
| `getCreditTranscriptPdf.ts` | 137 | Hand-wired WF-070 (PDF analog); registered at `app.ts:557`. |
| `createCreditEntry.ts` | 77 | Pre-Phase-35 service-helper. NOT registered. Consumed only by `credits.test.ts` dynamic imports. Kept with marker semantics matching cert's `listCertificates.ts` decision. |
| `services/credit.service.ts` | 53 | Public credit-service facade; consumed by Person-namespaced `createMyCreditEntry`. |
| `utils/credit-cycle.ts` | 172 | BR-11 + BR-12 cycle math (registration-based, configurable cycle start, carryover capped at 50%). |
| `utils/transcript-template.ts` | – | Cross-org PDF rendering for the transcript route. |

Cross-module dependencies (stay at OLD path per `SCOPE.credits.md §10.B`):
- `handlers/association:member/repos/credits.repo.ts` — hybrid:
  `CreditEntryRepository` + `ProfessionalLicenseRepository` +
  `LicenseRenewalAlertRepository` (tech debt; documented for future split).
- `handlers/association:member/repos/credits.schema.ts` — `credit_entry`
  + `org_cpd_config` Drizzle schema + 5 enums (entry type, source
  type, status, CPD category, verification status). Unique constraint
  `uq_credit_source_person (sourceType, sourceId, personId)` is the
  idempotency anchor for manual + job-side credit writes.
- `handlers/association:member/repos/compliance.repo.ts` —
  `ComplianceRepository` (read-only materialized-view access).
- `handlers/association:member/repos/governance.repo.ts` —
  `OfficerTermRepository` (used by `listOfficerTermsSummary`).

Tests (colocated at new path):
- `awardManualCredit.test.ts` (182)
- `adjustCreditEntry.test.ts` (245)
- `voidCreditEntry.test.ts` (164)
- `listMemberCreditsForPeer.test.ts` (87)
- `getComplianceReport.test.ts` (~70)
- `refreshCompliance.test.ts` (~30)
- `getCpdConfig.test.ts` + `updateCpdConfig.test.ts` (~100 each)
- `getCreditTranscriptPdf.test.ts` (188)
- `credits.test.ts` (871) — **hybrid**: 7 credentials-domain
  describes (Professional Licence + Renewal Alert auth guards) + 13
  credits-domain describes (cycle BR-11/12, auto-credits BR-13,
  cross-org BR-14, transcript AC-M10-001, compliance AC-M10-001,
  carryover AC-M10-003, toggle independence AC-M10-004). Move-as-is
  decision documented in `SCOPE.credits.md §10.E`; scheduled split
  for when the credentials post-R3 test paths consolidate.
- `utils/credit-cycle.test.ts` (271) + `utils/transcript-template.test.ts`

Totals at cutover: 178 credits-isolated tests pass / 0 fail / 12 files.

## 4. Contract test layout

`specs/api/tests/contract/`:
- `credit-compliance-flow.hurl` (38 LOC, baseline) — skeletal
  compliance fetch.
- `credits-flow.hurl` (65 LOC, baseline) — indirect: training listing
  (credits awarded on training completion).

`specs/api/tests/contract/member/credits/` (post-cutover supplements `193c52e8`):
- `credits-manual-award.hurl` (52 LOC) — officer signs in, awards a
  manual credit to themselves (officer is a seeded member so the
  `person_id` FK is satisfied), asserts envelope shape + the
  `sourceType: 'manual_award'` round-trip. `idempotencyKey` uses
  Hurl's built-in `{{newUuid}}` — REQUIRED because the underlying
  `credit_entry.source_id` column is uuid-typed; the handler writes
  `body.idempotencyKey` directly into `source_id`, so the key MUST
  parse as a valid UUID. Random-per-run keeps
  `uq_credit_source_person` clean across re-runs without DB resets.
- `credits-void-event.hurl` (74 LOC) — officer awards a manual
  credit, then bulk-voids it by `activityName` via the now-generated
  `/credits/void-event` route. Asserts `{data:{voidedCount}}` >= 1
  on the void, and 404 on the re-void idempotency check.
- `credits-cpd-config.hurl` (~75 LOC) — get + update CPD config
  (60/3/40/1 default). Probe-and-assert on initial GET (200 if config
  exists, 201 if auto-created). PATCH to `requiredCredits=90`,
  assert, then PATCH back to 60 so the file is restorative for
  sibling hurl scenarios. Negative path: `cycleLengthYears=99` → 400
  ValidationError.

DB invariant note: `credit_entry.uq_credit_source_person =
(sourceType, sourceId, personId)`. Hurl-side fresh UUIDs via
`{{newUuid}}` sidestep the constraint on every gate run; manual award
+ void are officer-self-award flows because seed users in the test
runner don't always have backing `person` rows (FK constraint).

## 5. Decisions resolved during the cutover

| Decision | Resolution | Rationale |
| --- | --- | --- |
| Cross-namespace retag mechanic | Per-interface `@tag` edit in `main.tsp` (NOT bulk find/replace) | 8 sibling Operations.Training extending interfaces (training, courses, quizzes, enrollments, lifecycle, providers) carry `@tag("Association:Member")` and would have been over-retagged by a bulk replace. |
| Hand-wired duplicate `POST /association/member/credits/void-event` (`app.ts:580`) | Killed | §10.A pre-flight confirmed `registerOpenAPIRoutes` runs at `app.ts:468` BEFORE the HAND-WIRED ROUTES block (`:471+`), so the hand-wired registration was already dead code (Hono first-wins). Handler's self-enforced position check stacks on top of the generated middleware unchanged. |
| `getCpdConfig` / `updateCpdConfig` (real impls) + `getOrgCpdConfig` / `updateOrgCpdConfig` (1-line shims) | Both moved together to new path; shim pattern preserved | Generated registry imports the shim names from the new path; shims re-export the real impls via `./getCpdConfig`. Keeping both names lets spec and code wire-names diverge gracefully without leaking shim logic into the registry. |
| `repos/credits.{repo,schema}.ts` + sibling hybrid repo files | Stay at OLD path | `credits.repo.ts` co-locates `ProfessionalLicenseRepository` + `LicenseRenewalAlertRepository` (R3-era hybrid). Splitting the file mid-credits-cutover blows scope. Documented for a future hygiene split. Mirrors the cert pattern (`credentials.repo` stayed at old path). |
| `createCreditEntry.ts` service-helper (77 LOC, not registered) | Kept with explicit semantics | Consumed only by `credits.test.ts:148, 155` dynamic imports. Matches cert's `listCertificates.ts` decision. |
| `credits.test.ts` hybrid (7 credentials-domain describes + 13 credits-domain) | Moved as-is; split deferred | `await import('./repos/credits.repo')` dynamic-import paths rewritten to `@/handlers/association:member/repos/credits.repo` so the test continues to bind to the unmoved repo at the OLD path. |
| 5 orphan `app.ts` imports (`getCpdConfig`, `updateCpdConfig`, `awardManualCredit`, `getComplianceReport`, `refreshCompliance`) | Deleted | Imported but not registered anywhere — pre-Phase-35 residue. |
| `transitionOfficerTerm` at `app.ts:573` | Not touched | Governance domain (M4-R3 officer transition checklist); cross-cutting concern stays. |

## 6. Gates posture at cutover commit `0f25bcef` (cutover atomic) → `193c52e8` (hurl supplements)

| Gate | Result vs baseline `c649683e` (post-certs) |
| --- | --- |
| typecheck | 5/5 (api-ts, sdk-ts, ui, memberry, admin) |
| unit | 5918 pass + 1 env-flake (`registerEmailJobs` env-flake — pre-existing per cert MODULE_SPEC, not introduced by this cutover). Net code regressions: zero. |
| credits-isolated tests | 178 pass / 0 fail / 12 files |
| Contract (Hurl) | **138/138 (100%)** including 3 new credits scenarios — `credits-manual-award.hurl`, `credits-void-event.hurl`, `credits-cpd-config.hurl`. Cert baseline 135 was 100% pre-credits; credits cutover added 3, all pass. |
| SDK drift | 0 / 454 operations (unchanged) |
| Observability | 94% (257/274 handlers at full coverage; matches cert baseline) |
| Contract coverage | 82% global; `Member/Credits` at 60% covered (6/10 of credits-tagged ops; 4 uncovered are the smaller-surface ops like `adjustCreditEntry`, `listMemberCreditsForPeer`, `getComplianceReport`, `refreshCompliance` — Hurl scaffolding to be added incrementally) |

## 7. Open follow-ups

- [ ] Extend hurl coverage for the remaining 4 credits ops
  (`adjustCreditEntry`, `listMemberCreditsForPeer`,
  `getComplianceReport`, `refreshCompliance`) to lift `Member/Credits`
  contract coverage from 60% to 90%+.
- [ ] Split `credits.test.ts` (871 LOC hybrid) into a credits-only
  suite + a credentials-domain suite when the credentials post-R3
  test-path consolidation runs. Track in next decomposition wave.
- [ ] Split `handlers/association:member/repos/credits.repo.ts`
  (3-class hybrid) into credits-only + credentials-only repos. Tech
  debt documented; not blocking next decomposition (dues/special-
  assessments).
- [ ] Address the 1 env-flake on `registerEmailJobs` (passes with
  default `EMAIL_PROCESSOR_INTERVAL_MS`; fails when overridden in
  `.env`). Pre-existing per cert MODULE_SPEC; not in scope here but
  worth surfacing.
- [x] Tag `member-credits-cutover` once final gates pass. — done at
  `193c52e8` (the post-cutover hurl-supplement commit). Cutover atomic
  itself is `0f25bcef`; the tag covers the whole closure for ease of
  reference, matching the cert convention of tagging at the
  observability-gate refresh commit.
