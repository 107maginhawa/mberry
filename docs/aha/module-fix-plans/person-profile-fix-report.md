# AHA Module/Group Fix Report: Person & Profile (+ deletion cascade)

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Person & Profile (+ deletion cascade) |
| Module slug | person-profile |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/person-profile-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/person-profile-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/person-profile-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A (FIX-001) + Batch D RED slice (FIX-006) + Batch B (FIX-002, FIX-003, FIX-004, FIX-005) |
| Superpowers used | Yes (`superpowers:using-superpowers` invoked before implementation) |
| Working tree status checked | Yes |
| Fix scope | P0 + P1 + test hardening (V1 REQUIRED) |
| Out of scope | G-02 (privacy-model product decision), directory publish (cross-module), `gender` scrub (Q-4), generated-Zod required→optional bug (prompt 05), domain-events reliability (core-platform audit), all Batch C (FIX-007…FIX-014), V2 DEFERRED / DO NOT ADD |
| Shared files touched | No (one new module-local util; no `core/*` edits). `core/config.ts` was inspected but NOT modified — see §4/§8. |
| Schema/migration touched | No |
| Limitations | (1) Hurl contract suite (`persons-extended-flow.hurl`) was NOT executed — it requires a live API server + seeded DB which is unavailable in this static environment; the assertions were tightened from fake-green to real 2xx + readback and verified by inspection only. (2) No E2E/Playwright run (the privacy-toggle persistence journey, FIX-001's optional E2E, was not added — backend/unit + contract layers prove the fix; E2E reserved per plan but not run here, no browser env). (3) `gender` is a real stored column but remains unscrubbed pending Q-4 (`[NEEDS PRODUCT DECISION]`); `bio` proceeded. (4) FIX-004 fails closed by reading env directly (precedence `ID_CARD_HMAC_SECRET` → `AUTH_SECRET`, throw if unset) rather than threading a new `core/config.ts` key through two callers — see §4/§8 rationale. |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G-01: `PATCH /persons/me/privacy` handler read `b['organizationId']` but contract/validator/frontend send `orgId` → 100% of contract-valid requests 400 | P0 | V1 REQUIRED | A | Only P0; a spec workflow (Privacy Settings) is fully non-functional in the PII hub | Fixed |
| FIX-006 | Test hardening: handler unit tests hand-built `_body` and bypassed the generated Zod validator (why G-01/G-05 were invisible); Hurl privacy assert was `status < 500` | P1 | V1 REQUIRED `[TEST GAP]` | D | RED slice that proves FIX-001 and protects Batch B | Fixed |
| FIX-002 | G-03: anonymization scrub omitted `bio` (free-text PII) at both scrub sites | P1 | V1 REQUIRED | B | DPA right-to-erasure incomplete; residual PII survives "deletion" | Fixed (`bio`); `gender` Blocked on Q-4 |
| FIX-003 | G-17: dead/unrouted `executeAccountDeletion.ts` duplicated the scrub list (root cause of the double `bio` miss) | P1 | V1 REQUIRED | B | Removes the two-list drift at the source | Fixed |
| FIX-004 | G-04: ID-card QR HMAC fell back to literal `'fallback-secret'` when `AUTH_SECRET` unset | P1 | V1 REQUIRED | B | Forgeable ID cards in any env missing the secret (BR-18) | Fixed |
| FIX-005 | G-05: `updateMyProfile` silently dropped contract field `phone` (200 OK) and carried dead mappings for 6 validator-stripped fields | P1 | V1 REQUIRED | B | Silent data loss with a 200; dead code masking the real contract | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `updateMyPrivacySettings.test.ts` (validator-inclusive `orgId` cases, new) | Failed (RED) — handler threw `organizationId is required` on a validator-parsed `orgId` body | FIX-001 / FIX-006 | RED for the right reason: handler read the wrong key |
| `updateMyProfile.test.ts` `phone` round-trip + dead-field cases (new) | Failed (RED) — `phone` never mapped; `primaryAddress`/`languagesSpoken`/`licenseNumber`/`prcId`/`avatar`/`contactInfo` still written from raw body | FIX-005 | RED confirmed silent drop + dead mappings |
| `id-card-data.test.ts` "throws when no HMAC secret" (new) | Failed (RED) — resolved (signed with `'fallback-secret'`) instead of throwing | FIX-004 | RED confirmed insecure fallback |
| `deletionProcessor.test.ts` `bio` + canonical-field-set cases (new) | Failed (RED) — `bio` was `undefined` (never scrubbed) | FIX-002 / FIX-003 | RED confirmed `bio` omission |
| `profile-spec-compliance.test.ts` privacy + avatar blocks (pre-existing) | Passed before (fake-green: hardcoded `organizationId`, asserted dead avatar mapping) | FIX-001 / FIX-005 | These were the fake-green tests; updated to assert fixed behavior (§5) |
| `bun test src/handlers/person/` (whole module, pre-change) | 178 tests passing (incl. fake-green) | — | Baseline before edits |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-001 | Handler now reads validated `orgId` (was `organizationId`) for the missing-field guard, membership lookup, existing-row lookup, insert value, and audit detail | `services/api-ts/src/handlers/person/updateMyPrivacySettings.ts` | No | One-key root-cause fix; error message updated to `orgId is required` |
| FIX-006 | (a) Rewrote `updateMyPrivacySettings.test.ts` to parse bodies through `UpdatePrivacySettingsRequestSchema` (kills the validator-bypass class); (b) tightened Hurl §11 from `status < 500` to 2xx + `jsonpath` flag assertions + a new §11b GET readback; (c) added validator-inclusive cases to `updateMyProfile.test.ts` | `updateMyPrivacySettings.test.ts`, `updateMyProfile.test.ts`, `specs/api/tests/contract/persons-extended-flow.hurl` | No | Hurl uses `orgId` now and reads back the persisted flags |
| FIX-002 | Added `bio: null` to the canonical scrub set; `gender` intentionally NOT added (Q-4) | `services/api-ts/src/handlers/person/utils/anonymize-person.ts` (new), `jobs/deletionProcessor.ts` | No | `[NEEDS PRODUCT DECISION]` on `gender` documented in the helper |
| FIX-003 | Consolidated the scrub field list into one `anonymizePersonFields(completedAt)` helper used by the processor; deleted the dead, unrouted `executeAccountDeletion.ts` (+ its test) | `utils/anonymize-person.ts` (new), `jobs/deletionProcessor.ts`, removed `executeAccountDeletion.ts` + `executeAccountDeletion.test.ts` | No | Verified zero consumers before removal (grep across `services/apps/specs/packages`) |
| FIX-004 | Replaced `process.env['AUTH_SECRET'] ?? 'fallback-secret'` with fail-closed read: `ID_CARD_HMAC_SECRET` → `AUTH_SECRET`, throw if neither set | `services/api-ts/src/handlers/person/utils/id-card-data.ts` | No `[SHARED DEPENDENCY]` avoided | Did NOT thread a new `core/config.ts` key through `getIdCardData` + its 2 callers (`getMyIdCard`, `getMyIdCardPdf`) — that is a wider signature change. `core/config.ts` already requires `AUTH_SECRET` in every env, so production never hits the throw. The dedicated key name is now honored if set. |
| FIX-005 | Map contract `phone` → `contactInfo.phone` (merging existing `contactInfo` to preserve email); removed the 6 dead mappings for validator-stripped fields (`contactInfo` passthrough, `primaryAddress`, `languagesSpoken`, `licenseNumber`, `prcId`, `avatar`) | `services/api-ts/src/handlers/person/updateMyProfile.ts` | No | Only the 9 `PersonMeUpdateRequest` fields are now mapped |
| FIX-001 / FIX-005 (test alignment) | Updated the fake-green `profile-spec-compliance.test.ts`: privacy bodies use `orgId` + assert `orgId is required`; the 3 AC-M02-001 avatar tests rewritten to assert the REAL contract (avatar is not a `/persons/me` field; updateMyProfile must not write it) | `services/api-ts/src/handlers/person/profile-spec-compliance.test.ts` | No | Not a weakening — they were asserting the bug; now assert fixed behavior |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `handlers/person/updateMyPrivacySettings.test.ts` | backend/unit (validator-inclusive) | A validator-parsed `orgId` body persists; insert/update capture the right org + flipped flags; `orgId is required` guard; non-member 403 | FIX-001, FIX-006 |
| `handlers/person/updateMyProfile.test.ts` | backend/unit (validator-inclusive) + regression | `phone` round-trips into `contactInfo.phone` preserving email; dead/validator-stripped fields are not written | FIX-005, FIX-006 |
| `handlers/person/utils/id-card-data.test.ts` | backend/unit + regression | Fails closed (throws) when no HMAC secret; uses `ID_CARD_HMAC_SECRET` when set; no hardcoded fallback | FIX-004 |
| `handlers/person/jobs/deletionProcessor.test.ts` | backend/unit + regression | `bio` is nulled; full canonical PII scrub field set asserted explicitly (not a self-mirror) | FIX-002, FIX-003 |
| `handlers/person/profile-spec-compliance.test.ts` | backend/unit | Updated 6 fake-green assertions to the fixed contract (`orgId` key, avatar boundary) | FIX-001, FIX-005 |
| `specs/api/tests/contract/persons-extended-flow.hurl` | contract | §2 asserts `phone` round-trip; §11 asserts privacy PATCH 2xx with persisted flags; §11b GET readback (was `status < 500` fake-green) | FIX-005, FIX-001, FIX-006 |
| `handlers/person/executeAccountDeletion.test.ts` | (removed) | Dead handler's test removed with the handler | FIX-003 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/person/updateMyPrivacySettings.test.ts` | Passed (5/5) after fix; Failed 4/5 before (RED confirmed) | FIX-001 |
| `bun test src/handlers/person/updateMyProfile.test.ts` | Passed (5/5) after fix; Failed 2/5 before (RED confirmed) | FIX-005 |
| `bun test src/handlers/person/utils/id-card-data.test.ts` | Passed (4/4) after fix; Failed 1/4 before (RED confirmed) | FIX-004 |
| `bun test src/handlers/person/jobs/deletionProcessor.test.ts` | Passed (13/13) after fix; Failed 2/13 before (RED confirmed) | FIX-002, FIX-003 |
| `bun test src/handlers/person/` (whole module) | Passed (177/177, 32 files) | Full module green post-fix (was 178 pre-fix; −1 net from removing the dead handler's test) |
| `bun test src/core/domain-event-consumers.test.ts src/handlers/person/accountDeletionCascade.test.ts` | Passed (21/21) | Confirms scrub consolidation + dead-handler removal had no cascade collateral |
| `bun run typecheck` (`tsc --noEmit`, whole api-ts workspace) | Passed (0 errors) | No new type errors anywhere |
| Hurl contract suite (`persons-extended-flow.hurl`) | Not Run | Requires live API server + seeded DB (unavailable here). Assertions tightened + verified by inspection — see §7/Limitations |
| E2E/Playwright (privacy-toggle persistence) | Not Run | No browser/live-backend env; reserved per plan, backend+contract layers prove FIX-001 |

## 7. Validation Summary

- **Passed:** All RED tests turned GREEN for the right reason after the minimal fix in each case (recorded baselines in §3). The whole person module (177 tests, 32 files) passes. Cascade + domain-event-consumers (21 tests) pass, proving the scrub consolidation and dead-handler removal caused no regression in the `person.deleted` cascade. Full-workspace `tsc --noEmit` is clean (0 errors).
- **Failed:** None remaining. The 7 transient failures observed mid-pass were the pre-existing fake-green tests in `profile-spec-compliance.test.ts` (4 privacy tests hardcoding `organizationId`, 3 avatar tests asserting a dead mapping). They were updated to assert the now-correct behavior, not weakened — they had been encoding the bug.
- **Not run:** The Hurl contract suite and E2E were not executed (no live API server / browser in this static environment). The Hurl privacy assertion was upgraded from the fake-green `status < 500` to a real `2xx + jsonpath` flag check plus a GET readback, and the profile flow now asserts the `phone` round-trip; these were verified by inspection against the fixed handler + the `getMyPrivacySettings` readback path (which already reads `orgId` from the query).
- **Blocked:** `gender` scrub (Q-4 product decision) — `bio` shipped, `gender` left unscrubbed and documented.
- **Pre-existing/unrelated:** The working tree already held in-flight AHA changes from 8 earlier modules (migrations `0062`/`0063`, generated regen, `app.ts`, etc.). None were touched or reverted.

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| ID-card HMAC secret resolution | `handlers/person/utils/id-card-data.ts` | Consumed by `getMyIdCard`, `getMyIdCardPdf` (2 callers) | `id-card-data.test.ts` (fail-closed + dedicated-key cases) | `[SHARED DEPENDENCY]` deliberately AVOIDED: did not add a `core/config.ts` key threaded through callers (wider signature change). Fail-closed env read keeps the change module-local. `core/config.ts` already enforces `AUTH_SECRET` in every env. |
| Person anonymization scrub set | NEW `handlers/person/utils/anonymize-person.ts`; `jobs/deletionProcessor.ts` | Single source of truth for the `persons` PII scrub; the `person.deleted` cascade is unaffected (separate path in `core/domain-event-consumers.ts`, not edited) | `deletionProcessor.test.ts`, `domain-event-consumers.test.ts`, `accountDeletionCascade.test.ts` all green | Module-local util. Removing the dead `executeAccountDeletion.ts` eliminated the only second scrub list. |
| Dead `person.anonymized` emit | (removed with `executeAccountDeletion.ts`) | Event had zero consumers; `domain-events.registry.ts` still declares it | n/a | `[NEEDS CONFIRMATION]` Registry still lists `person.anonymized`; the only emitter (dead handler) is gone, so it is now never emitted — no behavior change (it had no consumers). Cleaning the registry entry / re-emitting from the processor is FIX-007 territory (Batch C, OUT this pass). |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Hurl + E2E proof for FIX-001 privacy persistence and FIX-005 phone round-trip | FIX-001, FIX-005, FIX-006 | No live API server / browser env in this pass | Run `persons-extended-flow.hurl` against a booted impl (`scripts/run-contract-tests.ts` / `.github/workflows/contract.yml`) and add the reserved E2E privacy-toggle-after-reload case in CI |
| `gender` field-level erasure | FIX-002 / G-03 | Gated on Q-4 (`[NEEDS PRODUCT DECISION]`) | Once Q-4 lands, add `gender: null` to `anonymizePersonFields` (one line) |
| `person.anonymized` registry entry now has no emitter | FIX-003 side effect | Re-wiring emits/consumers is FIX-007 (Batch C) | In Batch C: either re-emit `person.anonymized` from `deletionProcessor` with a real consumer, or drop the registry entry |
| All Batch C items (FIX-007…FIX-014) | Batch C | Not in selected scope | Run a later `04` pass for Batch C |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| `gender` scrub at anonymization | `[NEEDS PRODUCT DECISION]` (Q-4) | DPA field-level erasure policy call; `bio` is unambiguous, `gender` is a policy decision | Product decides Q-4 |
| G-02: enforce/remove the 4 unenforced privacy toggles | `[NEEDS PRODUCT DECISION]` `[CROSS-MODULE RISK]` (Q-1) | Privacy-model decision (M02 toggles vs directory-profile curation) not made | Q-1 answered, then a coordinated directory-module batch |
| G-06: publish-to-directory duplicate profiles | `[CROSS-MODULE RISK]` | Root cause is in the chapters-directory module | Coordinate with the chapters-directory audit/fix |
| Generated Zod marks required `orgId` `.optional()` | `[SHARED DEPENDENCY]` | TypeSpec→Zod generator bug, cross-cutting | Prompt 05 cross-cutting audit (the handler fix here is correct regardless) |
| `core/domain-events.ts` per-subscriber retry / aggregation | `[SHARED DEPENDENCY]` | Changing bus delivery semantics affects every consumer | Core-platform audit (only the EVENT_CONTRACTS doc correction is in scope, and it is in Batch C) |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| FIX-007…FIX-014 (officer-notification consumers, export shape/certificates, export purge job, grace banner, id-card org selector, PII log line, notif-pref org scoping, doc fixes) | Batch C | Out of the selected batch; later pass |
| New `core/config.ts` `ID_CARD_HMAC_SECRET` typed key threaded through callers | `[DO NOT OVERBUILD]` | Fail-closed env read is the minimal correct fix; threading config through `getIdCardData` + 2 callers is a wider change not required for FIX-004 |
| `gender: null` in scrub | V2 DEFERRED (until Q-4) | Product decision pending |
| Consent fields, websocket privacy propagation, new `person.*` events, pg-boss/DLQ bus, admin update-any in person module, ZIP export, share-link flag, email-change OTP UI, license regex, cascade-scope extension, `subSpecialization`/`yearsOfPractice`/`affiliation`, server-side DELETE-confirmation body | DO NOT ADD / V2 DEFERRED | Per fix-ready plan §10/§11 |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/person/updateMyPrivacySettings.ts` | Read validated `orgId` instead of `organizationId` (guard, membership lookup, row lookup, insert, audit) | FIX-001 |
| `services/api-ts/src/handlers/person/updateMyProfile.ts` | Map `phone` → `contactInfo.phone` (merge existing); remove 6 dead validator-stripped mappings | FIX-005 |
| `services/api-ts/src/handlers/person/utils/id-card-data.ts` | Fail-closed HMAC secret (`ID_CARD_HMAC_SECRET` → `AUTH_SECRET`, throw); removed `'fallback-secret'` literal | FIX-004 |
| `services/api-ts/src/handlers/person/utils/anonymize-person.ts` | NEW: canonical `anonymizePersonFields(completedAt)` scrub set incl. `bio: null` | FIX-002, FIX-003 |
| `services/api-ts/src/handlers/person/jobs/deletionProcessor.ts` | Use shared `anonymizePersonFields()` (replaces inline scrub list) | FIX-002, FIX-003 |
| `services/api-ts/src/handlers/person/executeAccountDeletion.ts` | REMOVED (dead/unrouted, zero consumers) | FIX-003 |
| `services/api-ts/src/handlers/person/executeAccountDeletion.test.ts` | REMOVED (with its handler) | FIX-003 |
| `services/api-ts/src/handlers/person/updateMyPrivacySettings.test.ts` | Rewrote to validator-inclusive `orgId` cases + persistence capture | FIX-006 |
| `services/api-ts/src/handlers/person/updateMyProfile.test.ts` | Added validator-inclusive `phone` round-trip + dead-field-not-written cases | FIX-005, FIX-006 |
| `services/api-ts/src/handlers/person/utils/id-card-data.test.ts` | Added fail-closed-secret + dedicated-key cases | FIX-004 |
| `services/api-ts/src/handlers/person/jobs/deletionProcessor.test.ts` | Added `bio` + explicit canonical-scrub-set assertions | FIX-002, FIX-003 |
| `services/api-ts/src/handlers/person/profile-spec-compliance.test.ts` | Fixed fake-green privacy (`orgId`) + avatar-boundary assertions | FIX-001, FIX-005 |
| `specs/api/tests/contract/persons-extended-flow.hurl` | §2 phone round-trip; §11 privacy PATCH 2xx + flag asserts; §11b GET readback (was `< 500`) | FIX-001, FIX-005, FIX-006 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED/GREEN test output + baselines | This report §3 / §6 (inline command results) | All |
| No external screenshots/Playwright/Webwright run (static fix pass) | n/a | — |

## 14. Completion Decision

**PARTIALLY COMPLETE**

All six selected fixes (FIX-001, FIX-002, FIX-003, FIX-004, FIX-005, FIX-006) are implemented, each driven by a RED-first test that turned GREEN for the right reason, with the full person module (177 tests) and the cascade/consumers suites green and a clean full-workspace typecheck (0 errors). The reason this is **PARTIALLY COMPLETE** rather than **COMPLETE**: (1) the contract-layer (Hurl) and E2E proofs could not be executed in this environment (no live API/DB/browser) — they were tightened and inspection-verified but not run; and (2) the `gender` portion of FIX-002 is intentionally Blocked on the Q-4 product decision (`bio` shipped). No fix introduced an unresolved failure or regression.

## 15. Recommended Next Step

1. **Run the contract + E2E proofs in CI:** boot the impl and run `specs/api/tests/contract/persons-extended-flow.hurl` (via `scripts/run-contract-tests.ts` / `.github/workflows/contract.yml`) to confirm the tightened §2/§11/§11b assertions pass against a live backend; add the reserved privacy-toggle-after-reload E2E.
2. **Request the Q-4 product decision** (`gender` field-level erasure) — then add `gender: null` to `anonymizePersonFields` (one line).
3. **Then run another `04-module-or-group-fix-tdd.md` pass for Batch C** (FIX-007…FIX-014) for this module:
   - Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
   - Input fix-ready plan: `docs/aha/module-fix-plans/person-profile-fix-ready-plan.md`
   - Selected batch: Batch C (note: FIX-007 should also clean the now-emitterless `person.anonymized` registry entry).

---

# Batch C backend slice — FIX-007 + FIX-008 + FIX-009 + FIX-012 + FIX-014 (2026-06-12)

> Appended pass. The prior Batch A/B/D sections above are unchanged. This pass executed the **backend, decision-free** subset of Batch C (FIX-007 dead deletion/export event consumers, FIX-008 export shape/certificates/prcId, FIX-009 export-payload purge job, FIX-012 PII-in-log, FIX-014 doc reconciliation). The frontend slice (FIX-010 grace banner, FIX-011 id-card org selector → A8b) and FIX-013 (`notification_preference` orgId, blocked on Q-7) were **out of scope** and remain unfixed.

## C.1 Fix Scope

| Item | Details |
| --- | --- |
| Fix date | 2026-06-12 |
| Batch executed | Batch C — backend decision-free slice (FIX-007, FIX-008, FIX-009, FIX-012, FIX-014) |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked; RED→GREEN per fix) |
| Working tree status checked | Yes — 277 dirty files on `main` (prior AHA passes + A7); preserved, nothing committed/reverted |
| Fix scope | selected P2 / V1 RECOMMENDED (all five) |
| Out of scope | FIX-010/FIX-011 (frontend+E2E → A8b), FIX-013 (Q-7), `gender` (Q-4), G-02 (Q-1), G-06 (cross-module), domain-events bus reliability (core-platform), generated-Zod required→optional (prompt 05) |
| Shared files touched | Yes — `core/domain-event-consumers.ts` (additive consumers), `core/domain-events.registry.ts` (drop dead `person.anonymized`), `specs/api/src/modules/person-custom.tsp` (MyDataExport +2 fields → confined regen) |
| Schema/migration touched | No (FIX-009 is a purge *job*, not a schema change) |
| Limitations | (1) No live API/contract (Hurl) or E2E run — all five proven at backend/unit + typecheck + contract-source (OpenAPI) layers; the slice was scoped unit-provable. (2) FIX-008 required a `.tsp` change (the `MyDataExport` model genuinely lacked `certificates` + `prcId`); the regen is confined to the `MyDataExportSchema` (verified by before/after working-tree diff-of-diffs) and adds **no new operationId**. `packages/sdk-ts` was NOT regenerated (outside the prompt's `build`+`generate` regen scope; SDK baseline updates at milestone Step 6). (3) `check:sdk-compat` still exits 1 by design — all 25 breaking ops are pre-existing (advertising/jobs/marketplace/memberships); `exportMyData`/`MyDataExport` is **not** among them. Baseline NOT `--update`d. |

## C.2 Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- |
| FIX-007 | G-07: `person.deletion.requested` / `.cancelled` / `data-export.ready` emitted with zero consumers; `person.anonymized` declared but emitterless + consumerless | P2 | V1 RECOMMENDED | Spec 10b officer notifications + export-ready notice never fired; dead contract surface | Fixed |
| FIX-008 | G-08: `exportMyData` response ≠ `MyDataExport` model (missing `payments`/`notifications`/`categories`, wrong keys); no certificates, no `prcId` | P2 | V1 RECOMMENDED | DPA portability incomplete; SDK types lied about the shape | Fixed |
| FIX-009 | §13: `data_export.payload` (full PII JSONB) retained indefinitely after the 7-day link expires — no purge job | P2 | V1 RECOMMENDED | DPA data-minimization violation | Fixed |
| FIX-012 | G-14: `createPerson` logged the raw email at info | P2 | V1 RECOMMENDED | CLAUDE.md no-PII-logs + DPA-05 | Fixed |
| FIX-014 | G-15 + path drift: EVENT_CONTRACTS claims pg-boss at-least-once for domain events; m02 API_CONTRACTS documents `/my/*` vs real `/persons/me/*` | P2/P3 | V1 RECOMMENDED (doc) | Misleading ops/contract docs | Fixed (doc) |

## C.3 Baseline Before Changes (RED)

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `createPerson.test.ts` `[FIX-012]` log-shape (new) | Failed (RED) — captured info log contained `email: 'alice@example.com'`; no `hasEmail` | FIX-012 | RED for the right reason: raw PII in log |
| `dataExportPurge.test.ts` (new) | Failed (RED) — stub job purged 0; no payload nulled | FIX-009 | RED: no purge logic |
| `jobs/index.test.ts` (updated to expect 2 crons) | Failed (RED) — `registerCron` called once, not twice | FIX-009 | RED: purge job not registered |
| `domain-event-consumers.test.ts` GDPR block (new, 3 of 4) | Failed (RED) — 0 notifications inserted on `person.deletion.requested`/`.cancelled`/`data-export.ready` | FIX-007 | RED: emits had no consumer (the no-org skip test was vacuously green) |
| `exportMyData.test.ts` `[FIX-008]` shape + EF-M01 (updated) | Failed (RED) — handler returned `person`/`creditEntries`, no `profile`/`categories`/`certificates`/`prcId` | FIX-008 | RED: shape ≠ `MyDataExport` |
| Full `bun test` (api-ts) pre-pass | 6110 pass / 1 fail (pre-existing `registerEmailJobs`) / 4 todo | — | Baseline (per CONTINUE-14) |

## C.4 Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-007 | Wired 3 dead emits as additive consumers reusing the raw-`db.insert(notifications)` pattern: `person.deletion.requested`/`.cancelled` notify active officers of the member's orgs (org resolved from active memberships; self excluded; fire-and-forget bulk); `data-export.ready` notifies the requester (skips if no active org since `notifications.organizationId` is NOT NULL). Dropped the dead `person.anonymized` registry entry (emitterless + consumerless; anonymization is already audited inline in `deletionProcessor`). | `core/domain-event-consumers.ts`, `core/domain-events.registry.ts` | `[SHARED DEPENDENCY]` — additive consumers + one dead-type removal; no event-name/payload/bus-semantics change | Verified zero refs to `person.anonymized` before removal |
| FIX-008 | Added `certificates: unknown[]` + `prcId?: string` to the `MyDataExport` TypeSpec model (model genuinely lacked both); ran the confined regen. Introduced a shared `buildMyDataExport()` builder (kills the sync/async drift, FIX-003 lesson) returning the model-shaped envelope (`profile`/`categories`/`memberships`/`payments`/`credits`/`notifications`/`certificates`/top-level `prcId`); `exportMyData` + `requestDataExport` both use it. | `specs/api/src/modules/person-custom.tsp`, regen (`generated/openapi/validators.ts`, `specs/api/dist/openapi/openapi.json`, `dist/typescript-types/api.d.ts`), NEW `handlers/person/utils/build-data-export.ts`, `handlers/person/exportMyData.ts`, `handlers/person/requestDataExport.ts` | `[SHARED DEPENDENCY]` (regen) | EF-M01 preserved: `profile` still strips internal fields + `prcId`; `prcId` surfaced top-level. Regen confined to `MyDataExportSchema`; no new operationId |
| FIX-009 | New scheduled job `processExpiredDataExports` (deletionProcessor style): selects exports still holding a payload with a set TTL, filters expired in JS, nulls `payload`+`downloadUrl` and flips `status: 'expired'` per row. Registered as `person.dataExportPurge` cron (`0 3 * * *`). | NEW `handlers/person/jobs/dataExportPurge.ts`, `handlers/person/jobs/index.ts` | No | No schema change |
| FIX-012 | `createPerson` info log now emits `hasEmail: !!body.contactInfo?.email` instead of the raw email. | `handlers/person/createPerson.ts` | No | Audit `details` already used `hasEmail` (PII-safe) |
| FIX-014 | Corrected EVENT_CONTRACTS §0.1–0.3 to describe the real in-process `Promise.allSettled` bus (best-effort/at-most-once, no retry/timeout/DLQ, concurrent — pg-boss confined to the Background-Jobs column) + marked `PersonAnonymized` removed. Corrected m02 API_CONTRACTS base path `/my`→`/persons/me`, added an authoritative route-mapping banner in §2 (prefix + PUT→PATCH + `/notifications`→`/notification-preferences` + `/delete-account`→`/delete`+`/cancel-delete` + not-implemented flags for id-card + the POST/`:id` data-export pair), and fixed §3 Published Events. | `docs/product/EVENT_CONTRACTS.md`, `docs/product/modules/m02-member-profile/API_CONTRACTS.md` | `[SHARED DEPENDENCY]` (doc-only) | Doc-only; bus reliability change is core-platform, OUT of scope |

## C.5 Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `handlers/person/createPerson.test.ts` | backend/unit (log-shape) | No raw email in any info-log payload; `hasEmail: true` logged instead (capturing pino-`child()` logger) | FIX-012 |
| `handlers/person/jobs/dataExportPurge.test.ts` (new) | backend/unit | Expired export payload nulled (`payload/downloadUrl: null`, `status: 'expired'`); fresh export retained; no-op when none expired | FIX-009 |
| `handlers/person/jobs/index.test.ts` | backend/unit | `person.dataExportPurge` cron registered (`0 3 * * *`) alongside the deletion processor (2 crons) | FIX-009 |
| `core/domain-event-consumers.test.ts` | backend/unit (consumer) | Officers notified on `person.deletion.requested`/`.cancelled` (self excluded); requester notified on `data-export.ready`; skip when no org | FIX-007 |
| `handlers/person/exportMyData.test.ts` | backend/unit | Response matches `MyDataExport` (`profile`/`categories`/`memberships`/`payments`/`credits`/`notifications`/`certificates`) + top-level `prcId`; legacy `person`/`creditEntries` keys gone; EF-M01 profile-strip preserved | FIX-008 |

## C.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/person/createPerson.test.ts` | Passed (10/10) after fix; 1 RED before | FIX-012 |
| `bun test src/handlers/person/jobs/` | Passed (19/19) after fix; RED before (purge + registration) | FIX-009 |
| `bun test src/core/domain-event-consumers.test.ts` | Passed (26/26) after fix; 3 RED before | FIX-007 |
| `bun test src/handlers/person/exportMyData.test.ts` + `requestDataExport.test.ts` | Passed (9/9) after fix; 2 RED before | FIX-008 |
| `bun test src/handlers/person src/core/domain-event-consumers.test.ts` | Passed (209/209, 34 files) | Affected-dir gate |
| `bun test` (full api-ts) | Passed (6120 pass / 1 fail / 4 todo) | +10 vs 6110 baseline; the 1 fail is the PRE-EXISTING, UNRELATED `registerEmailJobs` (30000 vs env 1000) |
| `bun run --filter '*' typecheck` (monorepo) | Passed (0 errors, 5/5 workspaces) | Clean after fixing 2 `Handler<>` return-type + 1 jsonb-cast error introduced mid-pass |
| `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate` | Passed | FIX-008 regen; confined to `MyDataExportSchema` (before/after diff-of-diffs) |
| `check:sdk-compat` | Exits 1 (by design) | 25 breaking ops are ALL pre-existing (advertising/jobs/marketplace/memberships); `exportMyData`/`MyDataExport` NOT among them. Baseline NOT `--update`d |

## C.7 Validation Summary

- **Passed:** Every fix RED→GREEN for the right reason. Full api-ts suite 6120 pass (+10, no regression); affected dirs 209/209; monorepo typecheck 0 errors (5/5). FIX-008 regen verified confined to the `MyDataExport` schema via a before/after working-tree diff-of-diffs (the only real content change is `certificates`/`prcId` on `MyDataExportSchema`); OpenAPI source-of-truth now carries all 9 props (`certificates` required, `prcId` optional).
- **Failed:** None new. The single full-suite failure (`registerEmailJobs > registers email.processor as interval job`) is pre-existing and unrelated (documented in CONTINUE-14).
- **Not run:** Hurl/contract + E2E (no live server/browser; slice scoped unit-provable). FIX-008's contract correctness is evidenced at the OpenAPI + validator layer.
- **`check:sdk-compat`:** Exits 1 by design from prior frozen-baseline pending ops; this pass adds no new operationId. Do not `--update` until milestone Step 6.

## C.8 Shared / Cross-Module / Database Impact

| Area | Files / Components | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Domain-event consumers | `core/domain-event-consumers.ts` | 3 additive subscribers; existing 9 cascade + ~30 notify subscribers untouched | `domain-event-consumers.test.ts` (26/26) | `[SHARED DEPENDENCY]` additive only; raw-insert pattern reused; no event-name/payload/bus change |
| Domain-event registry | `core/domain-events.registry.ts` | `person.anonymized` key removed from `DomainEventMap` | typecheck (no refs anywhere); grep confirmed | Type-only removal; emitterless + consumerless |
| TypeSpec model → regen | `person-custom.tsp` `MyDataExport`; `generated/openapi/validators.ts`; `dist/openapi/openapi.json`; `dist/typescript-types/api.d.ts` | SDK consumers of `MyDataExport` gain `certificates` + optional `prcId` | `exportMyData.test.ts`; OpenAPI prop check | `[SHARED DEPENDENCY]` (regen). No new operationId. `packages/sdk-ts` NOT regenerated (prompt's regen scope = build+generate only) |
| Export envelope builder | NEW `handlers/person/utils/build-data-export.ts` | Single source for sync (`exportMyData`) + async (`requestDataExport`) export shape | both export tests (9/9) | Kills the sync/async payload drift (same root-cause lesson as FIX-003) |

## C.9 Remaining Gaps (after this pass)

| Gap | Source Fix ID | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Hurl + E2E proof for the export shape + GDPR consumer notifications | FIX-007/008 | No live server/browser this pass | Boot a throwaway impl (`SERVER_PORT=7299`) and assert `GET /persons/me/export` shape + a notification-row readback after a deletion request |
| FIX-010 grace banner + FIX-011 id-card org selector | Batch C frontend | Excluded (frontend + Playwright) | Run pass A8b (memberry app + browser env) |
| FIX-013 `notification_preference` orgId scoping | Batch C | Blocked on Q-7 (global vs per-org + legacy-handler wiring) | Confirm Q-7 (eng+product), then a gated pass |
| `requestDataExport` POST route wiring + id-card route absence | FIX-014 (surfaced) | Doc now flags them as not-in-generated-routes | Verify whether `POST /persons/me/data-export` and id-card routes should exist; wire or remove the handlers |

## C.10 Files Changed (this pass)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/person/createPerson.ts` | Log `hasEmail` boolean instead of raw email | FIX-012 |
| `services/api-ts/src/handlers/person/createPerson.test.ts` | Added capturing-logger PII-log-shape test | FIX-012 |
| `services/api-ts/src/handlers/person/jobs/dataExportPurge.ts` | NEW: `processExpiredDataExports` purge job | FIX-009 |
| `services/api-ts/src/handlers/person/jobs/dataExportPurge.test.ts` | NEW: purge/retain/no-op tests | FIX-009 |
| `services/api-ts/src/handlers/person/jobs/index.ts` | Register `person.dataExportPurge` cron | FIX-009 |
| `services/api-ts/src/handlers/person/jobs/index.test.ts` | Assert 2 crons incl. the purge job | FIX-009 |
| `services/api-ts/src/core/domain-event-consumers.ts` | Wire 3 GDPR consumers (officers + requester) | FIX-007 |
| `services/api-ts/src/core/domain-event-consumers.test.ts` | `makeGdprDb` + 4 GDPR consumer tests | FIX-007 |
| `services/api-ts/src/core/domain-events.registry.ts` | Drop dead `person.anonymized` event | FIX-007 |
| `specs/api/src/modules/person-custom.tsp` | `MyDataExport` += `certificates`, `prcId?` | FIX-008 |
| `services/api-ts/src/generated/openapi/validators.ts` + `specs/api/dist/*` | Regen (confined to `MyDataExportSchema`) | FIX-008 |
| `services/api-ts/src/handlers/person/utils/build-data-export.ts` | NEW: shared `buildMyDataExport()` | FIX-008 |
| `services/api-ts/src/handlers/person/exportMyData.ts` | Use shared builder; return model-shaped envelope | FIX-008 |
| `services/api-ts/src/handlers/person/requestDataExport.ts` | Use shared builder for the stored payload | FIX-008 |
| `services/api-ts/src/handlers/person/exportMyData.test.ts` | `[FIX-008]` shape test + EF-M01 `person`→`profile` | FIX-008 |
| `docs/product/EVENT_CONTRACTS.md` | §0.1–0.3 in-process-bus reality; `PersonAnonymized` removed | FIX-014 |
| `docs/product/modules/m02-member-profile/API_CONTRACTS.md` | Base path + route-mapping banner + §3 events corrected | FIX-014 |

## C.11 Completion Decision

**COMPLETE** (for the selected backend decision-free slice).

All five selected fixes (FIX-007, FIX-008, FIX-009, FIX-012, FIX-014) were implemented RED→GREEN (FIX-014 doc-only, no test), with the full api-ts suite green except the one pre-existing unrelated failure, a clean monorepo typecheck (0/5 workspaces), and a confined FIX-008 regen that adds no new operationId. The frontend slice (FIX-010/011) and FIX-013 (Q-7-blocked) were explicitly out of this slice and remain for A8b / a gated pass.

## C.12 Recommended Next Step

Run pass **A8b** — Person Batch C frontend slice (FIX-010 grace banner + FIX-011 id-card org selector) via `docs/aha/prompts/04-module-or-group-fix-tdd.md` with `person-profile-fix-ready-plan.md`, in an environment with the memberry app + Playwright. Then A8c (FIX-013) once Q-7 is eng+product confirmed. Optionally boot a throwaway impl (`SERVER_PORT=7299`) to add a live contract/notification readback proof for this slice.

---

# Batch C frontend slice — FIX-010 + FIX-011 (2026-06-12) — pass A8b

> Appended pass. All prior Batch A/B/D and Batch C **backend** sections above are unchanged. This pass executed only the **frontend** subset of Batch C: FIX-010 (deletion-grace banner) and FIX-011 (id-card org selector). No backend handler, TypeSpec, DB migration, or regen was touched. Env gate satisfied: API live on :7213, memberry app on :3004 (vite), Playwright 1.58.2 + Playwright-MCP browser available.

## D.1 Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Person & Profile (+ deletion cascade) |
| Module slug | `person-profile` |
| Fix date | 2026-06-12 |
| Batch executed | Batch C — frontend slice (FIX-010, FIX-011) |
| Superpowers used | Yes (`superpowers:test-driven-development` — RED→GREEN per fix) |
| Working tree status checked | Yes (pre-existing ~290-file dirty tree preserved; no resets; only ADDs + 2 small frontend edits) |
| Fix scope | selected P2 / V1 RECOMMENDED (Batch C frontend) |
| Out of scope | FIX-013 (Q-7 `[NEEDS CONFIRMATION]`, → A8c); all §10 Deferred / §11 Do-Not-Build; backend/spec/regen |
| Shared files touched | No (frontend-only; one shared *layout* route + one page) |
| Schema/migration touched | No |
| Limitations | FIX-011 multi-org **E2E** not added — no 2-org member exists in the seed (`member@memberry.ph` is single-org; only `idor-officer` lives in a 2nd org, with one membership). The org-switch behaviour is instead proven by a vitest/RTL component test that drives a real 2-org switch and asserts the second org's card renders. Single-org regression proven live in the browser. |

## D.2 Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-010 | G-09 / AC-M02-003: no persistent deletion-grace banner; `deletionScheduledAt` surfaced only inside Settings → Account | P2 | V1 RECOMMENDED | C (frontend) | Member can forget a pending deletion → surprise data loss; DPA/healthcare trust requirement | Fixed |
| FIX-011 | G-12 / WF-012: id-card hardcodes `memberships[0]`; multi-org members cannot view other orgs' cards despite a per-org backend | P2 | V1 RECOMMENDED | C (frontend) | Multi-org members blocked from a core artifact (their other-org ID card) | Fixed |

## D.3 Baseline Before Changes (RED)

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `deletion-grace-banner.test.tsx` | **RED** — `Cannot find module './deletion-grace-banner'` | FIX-010 | Component absent → banner never rendered app-wide (right-reason failure) |
| `id-card.test.tsx` (selector + switch) | **RED** — 2 fail (`getByRole('combobox', {name:/organization/i})` not found) | FIX-011 | No selector existed; `memberships[0]` hardcoded. Single-org "no selector" case passed pre-fix (guard) |
| Pre-flight: per-org id-card route | Confirmed `GET /persons/me/id-card/:orgId` **exists** (hand-wired `services/api-ts/src/app.ts:508-509`, not in generated routes) | FIX-011 | FIX-011 is **NOT** backend-blocked — the carry-forward risk resolved. Page fetches via raw `@/lib/api`, card body is derived client-side from the memberships list (the `:orgId` route is used only for the PDF download) |

## D.4 Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-010 | New `DeletionGraceBanner` reads `getPerson('me').deletionScheduledAt` (cast — field not yet in TypeSpec, mirrors `settings/account.tsx`), renders a warning banner with day-count + "Cancel deletion" CTA wired to `cancelMyAccountDeletionMutation` (POST `/persons/me/cancel-delete`), `sonner` toast on success/error. Rendered in the `_authenticated` layout above `MemberHeader` so it shows on every member route. | `apps/memberry/src/components/layout/deletion-grace-banner.tsx` (new), `apps/memberry/src/routes/_authenticated.tsx` (import + 1 render line) | No (member layout shell) | Used generated SDK hooks, not hand-rolled fetch (per plan). Officer-only routes (`return <Outlet/>` early-branch) do not show the banner — documented minor edge (member shell covers /dashboard + all /my/* + /settings). |
| FIX-011 | Replaced `memberships[0]` hardcode with `selectedOrgId` state; the rendered card + PDF `orgId` derive from `find(selectedOrgId) ?? memberships[0]`. A native `<select aria-label="Select organization">` (one `<option>` per membership) is shown only when the member has >1 membership and drives the selection. | `apps/memberry/src/routes/_authenticated/my/id-card.tsx` (`useState`, selected-membership derivation, selector JSX) | No | Chose a **native `<select>`** over the Radix `@monobase/ui` Select: there is no precedent for driving the Radix Select in the bun:test/happy-dom harness (pointer/portal flakiness), so a native select is the smallest *provable* control. Accessible (combobox role, labelled), styled with design tokens. Matches the prompt's literal "org `<select>`". |

## D.5 Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `apps/memberry/src/components/layout/deletion-grace-banner.test.tsx` | frontend/component (vitest/RTL via bun:test) | (a) renders nothing with no `deletionScheduledAt`; (b) renders warning + "Cancel deletion" CTA during grace; (c) clicking Cancel fires the cancel mutation | FIX-010 |
| `apps/memberry/src/routes/_authenticated/my/id-card.test.tsx` | frontend/component | (a) 2-org member sees a selector with one option per org; (b) **switching org re-renders the selected org's card** (category swaps Regular→Associate); (c) single-org member shows no selector but the card still renders | FIX-011 |
| `apps/memberry/tests/e2e/member/deletion-grace-banner.spec.ts` | E2E/Playwright | Full journey on a fresh signed-up user: request deletion (Settings→Account) → **banner visible on /dashboard** (app-wide, off-Settings) → click "Cancel deletion" in the banner → reload → banner gone (state really persisted server-side) | FIX-010 |

## D.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test …/deletion-grace-banner.test.tsx` | **Passed** — 3 pass / 0 fail | RED first (module-missing), GREEN after component+wire |
| `bun test …/my/id-card.test.tsx` | **Passed** — 3 pass / 0 fail (isolated; polluter mocks `@/lib/api`) | RED first (2 fail, no selector), GREEN after native-select |
| `cd apps/memberry && bun run typecheck` (`tsc --noEmit`) | **Passed** — 0 errors | App typecheck stayed green after both edits |
| `bun run test:e2e member/deletion-grace-banner.spec.ts --project=chromium` | **Passed** — 7 passed (6 setup personas + the journey), 11.1s, live stack | 2 benign 403 console logs from fresh-user no-org endpoints; not failures |

## D.7 Validation Summary

- **Passed:** both component test files (3+3), app typecheck (0 errors), the FIX-010 E2E journey against the live stack, and a manual eyes-on browse of both pages.
- **Manual browse (Playwright-MCP, real browser):** signed in as `member@memberry.ph`. (1) `/my/id-card` — single-org member's card renders (org, Active status, valid-until, QR) with **no selector** (correct guard) → `fix-011-id-card-single-org.png`. (2) Requested deletion via Settings→Account, navigated to `/dashboard` — the grace banner appeared app-wide ("…scheduled for deletion in 30 days…") with the Cancel CTA → `fix-010-deletion-grace-banner-dashboard.png`; clicked Cancel; verified via `GET /persons/me` that `deletionScheduledAt` is back to `null` (seeded member restored — no state pollution).
- **Not run:** a multi-org **E2E** for FIX-011 (no 2-org member in the seed). Covered by the component test (real switch) + single-org live browse.
- **api-ts unit count:** unchanged (no backend edit), as required.
- **No pre-existing/unrelated failures introduced.**

## D.8 Shared / Cross-Module / Database Impact

None. Frontend-only. The one shared surface touched is the `_authenticated` **layout route** (additive `<DeletionGraceBanner/>` render line); no shared backend/schema/event code. `check:sdk-compat` baseline untouched (no `.tsp`/regen this pass).

## D.9 Remaining Gaps / Blocked / Deferred (after this pass)

| Item | Label | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| FIX-011 multi-org **E2E** proof | `[BLOCKED BY ENVIRONMENT]` (test fixture only — the fix itself shipped) | No 2-org member exists in the seed | Seed a 2-org member (or extend `layer-2-users.ts` / isolated-fixture) then add a `digital-id-card` 2-org spec; behaviour already proven by the component test |
| Banner on officer-only routes | (minor edge) | Officer routes short-circuit to bare `<Outlet/>` in `_authenticated.tsx`; banner lives in the member shell | Optional: render the banner in the officer layout too if product wants it truly everywhere |
| FIX-013 `notification_preference` orgId scoping | `[NEEDS CONFIRMATION]` Q-7 | Global-vs-per-org pref store undecided | Pass A8c after Q-7 eng+product confirmation |
| All §10 Deferred / §11 Do-Not-Build | V2 DEFERRED / DO NOT ADD | Out of scope | Per fix-ready plan |

## D.10 Files Changed (this pass)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `apps/memberry/src/components/layout/deletion-grace-banner.tsx` | NEW — app-wide grace banner component | FIX-010 |
| `apps/memberry/src/components/layout/deletion-grace-banner.test.tsx` | NEW — 3 component tests | FIX-010 |
| `apps/memberry/src/routes/_authenticated.tsx` | Import + render `<DeletionGraceBanner/>` above `MemberHeader` | FIX-010 |
| `apps/memberry/tests/e2e/member/deletion-grace-banner.spec.ts` | NEW — app-wide banner journey E2E | FIX-010 |
| `apps/memberry/src/routes/_authenticated/my/id-card.tsx` | `useState` selected org; selected-membership derivation; native `<select>` org switcher (shown when >1 membership) | FIX-011 |
| `apps/memberry/src/routes/_authenticated/my/id-card.test.tsx` | NEW — 3 component tests (selector, switch, single-org guard) | FIX-011 |

## D.11 Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| Dashboard grace banner (live, app-wide) | `docs/aha/evidence/screenshots/fix-010-deletion-grace-banner-dashboard.png` | FIX-010 |
| Single-org id-card renders, no selector (live) | `docs/aha/evidence/screenshots/fix-011-id-card-single-org.png` | FIX-011 |
| E2E pass output (7 passed, 11.1s) | inline above (D.6) | FIX-010 |

## D.12 Completion Decision

**COMPLETE** (for the selected Batch C frontend slice).

Both selected fixes were implemented RED→GREEN with component tests, a live E2E journey, a green app typecheck, and manual browser verification of both pages (with the seeded member's deletion state restored afterward). The only gap is a 2-org **E2E fixture** for FIX-011 (env: no multi-org seed) — the fix itself is shipped and proven by a real-switch component test.

## D.13 Recommended Next Step

Per the remaining-work sequence: run **A9 — Marketplace Batch B** (backend, decision-free) via `docs/aha/prompts/04-module-or-group-fix-tdd.md`, OR **A8c** (Person FIX-013) once Q-7 (notification-pref store: global vs per-org) is eng+product confirmed. Do not commit the working tree until milestone Step 6 (then `--update` the frozen `check:sdk-compat` baseline). STOP.

---

# Step 46 — Person/Profile privacy: Q-4 gender scrub + Q-1 directory privacy model / G-02 (2026-06-13)

> Appended decision+build pass. All prior sections above are unchanged. This was a **decision-capture** session for the two remaining person-profile product gates (Q-4, Q-1), followed by building **only the unblocked, module-local slice** (Q-4). Q-1's chosen model lands enforcement in a **cross-module** module (chapters-directory), so it is captured + carried forward, **not** half-built here.

## E.1 Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Person & Profile (+ deletion cascade) |
| Module slug | `person-profile` |
| Fix date | 2026-06-13 |
| Batch executed | Step 46 — Q-4 gender scrub (build) + Q-1/G-02 (decision captured, cross-module carry-forward) |
| Superpowers used | Yes (`superpowers:test-driven-development` — RED→GREEN for Q-4) |
| Working tree status checked | Yes (pre-existing dirty tree from recovery-2025 + AHA Steps 31–45 preserved; FORBIDDEN reset/checkout/clean commands not used) |
| Fix scope | Q-4 (P1, V1 REQUIRED — field-level erasure completeness) |
| Out of scope | Q-1/G-02 enforcement (cross-module → chapters-directory `04`); all §10 Deferred / §11 Do-Not-Build; FIX-013 (Q-7) |
| Shared files touched | No (one module-local util + its test) |
| Schema/migration touched | No (`gender` is an already-existing nullable enum column — `person.schema.ts:28`) |
| TypeSpec/regen touched | No (Q-4 needs no contract change) |
| Limitations | Q-4 proven at the backend/unit layer (the anonymization processor runs in a job, no live API/browser path). Q-1 build deliberately deferred — enforcement is not in a person-owned read path. |

## E.2 Decisions Captured (verbatim)

| ID | Decision | Answer | Action Taken |
| --- | --- | --- | --- |
| Q-4 | Scrub `gender` at anonymization alongside `bio`? | **"Yes — scrub it"** (engineering recommendation) | Built: `gender: null` added to the canonical scrub set, RED→GREEN regression test. |
| Q-1 | Which privacy model wins for the 4 toggles (`emailVisible`/`phoneVisible`/`photoVisible`/`addressVisible`)? | **"Enforce the M02 toggles"** (directory read/projection honors them) | Captured. Preflight confirmed enforcement is **CROSS-MODULE**: the directory read path (`searchDirectory`, `directory.repo.ts`, `directory.schema.ts`) lives in `association:member`/chapters-directory, gating only on its own 3-level `directoryVisibilityEnum`. No person-owned module-local enforcement slice exists. Marked `[CROSS-MODULE RISK]` → coordinated chapters-directory `04`. |

## E.3 Q-1 Preflight Finding (why no module-local build)

The four M02 toggles are stored in `person/repos/privacy-settings.schema.ts` (`person_privacy_setting`) and exposed self-only via `getMyPrivacySettings`. The member-facing directory:

- Read handlers: `handlers/member/directory/searchDirectory.ts`, `listDirectoryProfiles.ts`, `getDirectoryProfile.ts`; repo `handlers/association:member/repos/directory.repo.ts`.
- Schema: `handlers/association:member/repos/directory.schema.ts` — `directoryVisibilityEnum` (`public`/`memberOnly`/`hidden`, ~line 38) and its **own** PII copy (`photoUrl`/`contactEmail`/`contactPhone`).
- The directory projection reads **none** of `emailVisible`/`phoneVisible`/`photoVisible`/`addressVisible` (grep across `handlers/member/directory/` + `handlers/association:member/` = no matches outside the schema).

Enforcing the toggles requires the **directory** projection to read `person_privacy_setting` and gate `contactEmail`/`contactPhone`/`photoUrl` per the member's per-org toggles — a change in chapters-directory, not person. (Read access of `person_privacy_setting` from that side already has precedent: `trust-signals.ts` + `lookupCredentialPublic.ts` read the `duesStatusVisible`/`credentialsVisible`/`ceComplianceVisible` toggles.) Per prompt 04 §4 + the CONTINUE-46 cross-module rule, this is captured and carried forward — **not** half-built.

## E.4 Baseline Before Changes (RED)

| Check/Test | Result Before Changes | Related | Notes |
| --- | --- | --- | --- |
| `deletionProcessor.test.ts` — `[DPA-02] nulls gender` (new) | Failed (RED) — `gender` was `undefined` (never scrubbed) | Q-4 | RED for the right reason: gender omitted from the scrub set |
| `deletionProcessor.test.ts` — canonical-field-set test + `expect(s.gender).toBeNull()` | Failed (RED) — `gender: undefined` | Q-4 | Explicit field-set assertion, not a self-mirror |
| `bun test deletionProcessor.test.ts` pre-change | 12 pass / 2 fail | Q-4 | RED confirmed |

## E.5 Changes Made

| Item | Implemented | Files Changed | Shared? | Notes |
| --- | --- | --- | --- | --- |
| Q-4 | Added `gender: null` to `anonymizePersonFields(completedAt)`; replaced the `[NEEDS PRODUCT DECISION]` helper note with the DECIDED-scrub rationale | `services/api-ts/src/handlers/person/utils/anonymize-person.ts` | No | One-line scrub addition in the single source of truth |
| Q-4 (test) | Added a dedicated `nulls gender` test + a `gender` assertion to the canonical-field-set test | `services/api-ts/src/handlers/person/jobs/deletionProcessor.test.ts` | No | RED→GREEN; explicit field set |

## E.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/person/jobs/deletionProcessor.test.ts` | Passed (14/14) after; Failed 2/14 before (RED) | Q-4 |
| `bun test src/handlers/person/ src/core/domain-event-consumers.test.ts src/handlers/person/accountDeletionCascade.test.ts` | Passed (229/229, 36 files) | No cascade collateral from the scrub addition |
| `bunx tsc --noEmit` (api-ts workspace) | Passed (0 errors) | No new type errors |
| Hurl / E2E | Not Run | Q-4 is a background-job scrub; no live API/browser path. Unit-provable. |

## E.7 Validation Summary

- **Passed:** Q-4 RED→GREEN for the right reason; full person module + cascade/consumers green (229/229); api-ts typecheck clean (0 errors).
- **Not run:** Hurl/E2E (not applicable — anonymization is a scheduled job, not a request path).
- **Blocked/Carried forward:** Q-1/G-02 enforcement — cross-module (chapters-directory). No person-module work remained.
- **Pre-existing/unrelated:** Dirty working tree (recovery-2025 + AHA Steps 31–45) preserved; nothing reverted/committed.

## E.8 Remaining Gaps / Blocked (after this pass)

| Item | Label | Why Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| G-02: enforce the 4 M02 toggles in the directory projection | `[CROSS-MODULE RISK]` (Q-1 decided: enforce) | Enforcement lives in chapters-directory (`searchDirectory`/`directory.repo.ts`/`directory.schema.ts`), not person | A coordinated **chapters-directory `04`** pass: directory projection reads `person_privacy_setting` and gates `contactEmail`/`contactPhone`/`photoUrl` per the member's per-org toggles (reuse the `trust-signals.ts` read precedent). Do NOT touch `directory_profiles` schema from person. |
| FIX-013 `notification_preference` orgId scoping | `[NEEDS CONFIRMATION]` Q-7 | Global-vs-per-org pref store undecided | Pass A8c after Q-7 eng+product confirmation |

## E.9 Completion Decision

**COMPLETE** (for the unblocked Q-4 slice; Q-1 captured + carried forward as designed).

Q-4 (gender scrub) shipped RED→GREEN, person module + cascade green, typecheck clean. Q-1 was answered ("enforce M02 toggles") and, per the CONTINUE-46 cross-module rule, the enforcement is captured + marked `[CROSS-MODULE RISK]` for a coordinated chapters-directory `04` — there was no person-owned module-local slice to half-build.

## E.10 Recommended Next Step

Continue the post-46 P1-gate pipeline (each its own `[NEEDS PRODUCT DECISION]` session): **training TC-DEC-01/02** → **platform-admin Q1/Q8** → **notifications Q3/Q1** → **realtime PD-2/PD-3**. The chapters-directory G-02 enforcement pass should be slotted when the chapters-directory module is next opened for a `04`. Re-run `07-consolidate-roadmap.md` once a few of these land. STOP.
