# AHA Fix-Ready Plan: Person & Profile (+ deletion cascade)

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Person & Profile (+ deletion cascade) |
| Module slug | person-profile |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/person-profile-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/person-profile-fix-ready-plan.md` |
| Audit decision | FAIL |
| Superpowers used | No (organizer ran statically; the gap plan is already evidence-rich. `/using-superpowers` is recommended for the `04` fix pass, especially to keep the consolidated-scrub refactor (FIX-003) and the directory publish fix (FIX-006) from drifting into broad refactors). |
| Organizer decision | PARTIALLY READY |
| Reason | One P0 (G-01 privacy PATCH 100%-broken) and four genuinely fix-ready P1s (G-03 bio/gender scrub, G-04 HMAC fail-closed, G-05 updateMyProfile phone drop, plus the dead-code scrub consolidation G-17) are module-local, low-risk, and test-first friendly — they can start immediately. Two further high-value items are NOT ready: G-02 (4 unenforced privacy toggles) is blocked on the privacy-model product decision (Q-1), and G-06 (duplicate directory-profile publish) is a cross-module fix that must be coordinated with the chapters-directory module. Several selected P2 completeness items (officer-notification consumers, export shape/certificates, grace banner, id-card org selector, PII log line) are ready but should follow the P0/P1 pass. |
| Limitations | No source edited, no tests created, no audit redone. The gap plan's primary evidence chains were spot-checked against the referenced files; no contradictions found. Items still carrying gap-plan uncertainty are preserved verbatim: M2-R1 email-change Better-Auth internals (`[NEEDS CONFIRMATION]`, Q-2), legacy `updatePrivacySettings.ts`/`updateNotificationPreferences.ts` route wiring (`[NEEDS CONFIRMATION]`, Q-7), `gender` scrub policy (`[NEEDS PRODUCT DECISION]`, Q-4), and "pending payments" guard scope (`[NEEDS PRODUCT DECISION]`, Q-3). The generated-Zod `required→optional` bug (§13) is a shared/platform/generator issue routed to prompt 05, not fixed here. No runtime/browser verification was performed (gap plan was static-only). |

## 2. Fix Strategy Summary

**Fix first (Batch A, P0):** G-01 — the m02 Privacy Settings workflow (a P0 spec workflow) returns 400 on 100% of real requests because the handler reads `b['organizationId']` while the contract/validator/frontend all carry `orgId`. The fix is a one-key read change, but the existing tests are fake-green (hand-built `_body` bypasses the Zod validator; the Hurl assert only checks `status < 500`). The first action is a **RED test that exercises the handler through the generated Zod validator** so the bug is reproduced before the one-line fix lands.

**Fix next (Batch B, P1 module-local):** G-03 + G-17 (consolidate the two duplicated scrub lists into one `anonymizePerson()` used by the `deletionProcessor`, add `bio` — and `gender` if Q-4 is answered — then remove/gut the dead `executeAccountDeletion.ts`), G-04 (fail-closed HMAC secret via `core/config.ts`), G-05 (map `phone → contactInfo.phone` in `updateMyProfile`, delete the dead field mappings the validator already strips). These are small, root-cause, module-local, and each gets a RED test first.

**Test hardening (Batch D, P1):** the recurring **fake-green pattern** is itself a P1 testability gap — handler unit tests hand-build `_body` and bypass the generated validators, which is why G-01 and G-05 stayed invisible. Each touched handler in Batches A/B gets at least one validator-inclusive test, plus the Hurl privacy-PATCH assertion is tightened to 2xx + GET readback.

**Selected P2 V1-completeness (Batch C, run after A/B):** G-14 (stop logging raw email — one-liner, can piggyback), G-07 (wire the four dead `person.deletion.*` / `data-export.ready` emits to consumers, or drop them), G-08 (align export response to the `MyDataExport` model + add certificates/prcId; export-payload purge job from §13), G-09 (grace-period banner in the `_authenticated` layout), G-12 (id-card org selector — backend already per-org). Doc fixes (G-15 EVENT_CONTRACTS delivery-guarantee correction, m02 API_CONTRACTS `/persons/me/*` paths) are doc-only and bundle into Batch C.

**What is NOT ready / NOT in scope now:** G-02 (4 unenforced privacy toggles) is **blocked on Q-1** (which privacy model wins) — coding cannot start until the product decision lands. G-06 (publish-to-directory duplicate creation) and the `directory_profiles` PII duplication are **cross-module** (chapters-directory) and gated on the same privacy decision; coordinate, do not fix here. G-10 license regex needs a regex source (Q-3-adjacent product input). G-15's *reliability* upgrade (per-subscriber retry/aggregation) belongs to the core-platform audit; only the doc correction + smallest failure-audit step is in V1 scope. The generated-Zod required→optional bug is a generator/platform issue for prompt 05.

**One pass or multiple:** Multiple batches. Batch A + the first slice of Batch D run in the first `04` pass. Batch B follows (can be same pass if capacity allows — all module-local). Batch C is a later pass. G-02/G-06 are separate, decision-gated passes outside the normal `04` flow.

**Major risks:** (1) The scrub consolidation (FIX-003) must stay a refactor-into-one-function, not a rewrite of the deletion lifecycle — the lifecycle is already well-tested. (2) Wiring the dead deletion/export events (FIX-007) must reuse the existing consumer pattern in `domain-event-consumers.ts` and not introduce a new event class. (3) The `core/domain-events.ts` delivery semantics are a shared dependency — only the EVENT_CONTRACTS *doc* is corrected in this module; the bus change is out of scope.

## 3. Active Fix Scope

Only P0 / P1 / selected P2 / V1 REQUIRED / selected V1 RECOMMENDED items.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G-01: `PATCH /persons/me/privacy` rejects every contract-valid request — handler reads `b['organizationId']` but contract/validator/frontend send `orgId` → 100% of real requests throw `ValidationError('organizationId is required')` | P0 | V1 REQUIRED | A | A P0 spec workflow (Privacy Settings) is fully non-functional; UI optimistically flips toggles that never persist (`photoVisible` defaults true and cannot be turned off) — direct privacy harm in the PII hub | `updateMyPrivacySettings.ts:26` vs `person-custom.tsp:200-203`; `validators.ts:9523`; `my/settings.tsx:317`; fake-green `updateMyPrivacySettings.test.ts:28` passes `organizationId` directly; `persons-extended-flow.hurl` §11 asserts only `status < 500` |
| FIX-002 | G-03: anonymization scrub omits `bio` (free-text PII, can hold clinic address/phone) and `gender` in **both** scrub sites | P1 | V1 REQUIRED | B | DPA 2012 right-to-erasure incomplete — residual PII survives "deletion" in the PII hub | `jobs/deletionProcessor.ts:73-91`; `executeAccountDeletion.ts:70-86`; `person.schema.ts:40` |
| FIX-003 | G-17: `executeAccountDeletion.ts` is a dead/unrouted handler duplicating the scrub field list — the two lists already drifted (both miss `bio`) | P1 | V1 REQUIRED | B | Root cause of G-03's double miss; two scrub lists guarantee future drift | grep: only own test references it; `routes.ts`/`app.ts` clean; in-file SECURITY NOTE confirms unrouted |
| FIX-004 | G-04: ID-card QR HMAC falls back to literal `'fallback-secret'` when `AUTH_SECRET` is unset, and reuses the auth secret | P1 | V1 REQUIRED | B | Forgeable member ID cards (BR-18 broken) in any env missing the secret; security/trust | `handlers/person/utils/id-card-data.ts:77` |
| FIX-005 | G-05: `updateMyProfile` silently drops the contract field `phone` (returns 200) and carries dead mappings for 6+ fields the validator strips | P1 | V1 REQUIRED | B | Contract/SDK clients lose data with a 200 OK — silent data loss + dead code masking the real contract | `person-custom.tsp:285`; `validators.ts:7591-7601`; `updateMyProfile.ts:32-45` |
| FIX-006 | Test hardening: kill the fake-green class — handler unit tests hand-build `_body` and bypass generated Zod validators (why G-01/G-05 were invisible); Hurl privacy assert is `status < 500` | P1 | V1 REQUIRED `[TEST GAP]` | D | Without validator-inclusive + readback tests, the same bug class recurs and the privacy fix can't be proven | `updateMyPrivacySettings.test.ts:28` (validator-bypassing); `persons-extended-flow.hurl` §11 (`< 500`); gap plan §19/§20 |
| FIX-007 | G-07: `person.deletion.requested` / `person.deletion.cancelled` / `person.anonymized` / `data-export.ready` events are emitted with **zero consumers** | P2 | V1 RECOMMENDED | C | Spec 10b officer notifications and export-ready notification never happen; dead contract surface | emits at `requestMyAccountDeletion.ts:99`, `cancelMyAccountDeletion.ts:39`, `requestDataExport.ts:116`, `executeAccountDeletion.ts:112`; `domain-event-consumers.ts` registers none of the four |
| FIX-008 | G-08: data-export content/contract drift — no certificates, no `prcId`; `exportMyData` response shape ≠ its own `MyDataExport` TypeSpec model (missing `payments`/`notifications`/`categories`, key names differ) | P2 | V1 RECOMMENDED | C | DPA portability incomplete; SDK types lie about the response shape | `exportMyData.ts:56-91` vs `person-custom.tsp:52-72`; spec WF-014 step 2 |
| FIX-009 | §13: export payload (full PII JSONB) is retained in `data_export.payload` indefinitely after the 7-day download link expires — no purge job | P2 | V1 RECOMMENDED | C | DPA data-minimization violation; PII snapshot persists with no cleanup | `data-export.schema.ts:32`; no cleanup job in `EVENT_CONTRACTS` §2 or `person/jobs/index.ts` |
| FIX-010 | G-09: no persistent deletion-grace banner (AC-M02-003); `deletionScheduledAt` surfaces only inside Settings → General | P2 | V1 RECOMMENDED | C | Member may forget a pending deletion → surprise data loss; domain trust requirement (healthcare/DPA) | grep `deletionScheduledAt` → only `my/settings.tsx`, `settings/account.tsx`; nothing in `_authenticated.tsx` layout |
| FIX-011 | G-12: ID card has no org selector for multi-org members (hardcodes `memberships[0]`) despite a per-org backend | P2 | V1 RECOMMENDED | C | Multi-org members cannot get cards for their other orgs (WF-012 step 1) | `my/id-card.tsx:57,80` |
| FIX-012 | G-14: `createPerson` logs the raw email address in an info log | P2 | V1 RECOMMENDED | C | Violates CLAUDE.md no-PII-logs + DPA-05 | `createPerson.ts:101` (`email: body.contactInfo?.email`) |
| FIX-013 | §13: `notification_preference.organizationId` is `notNull` but the insert relies on fail-open `ctx.get('organizationId')` and the lookup ignores org (unique index is per person+category+org) | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` | C | Notification-pref writes can fail or mis-scope when no org context is present | `updateMyNotificationPreferences.ts:22,56`; `app.ts:437-441`; `notification-preferences.schema.ts:17,23` |
| FIX-014 | G-15 (doc) + m02 API_CONTRACTS path drift: EVENT_CONTRACTS §0.1-0.3 claims pg-boss at-least-once for domain events (actual bus is in-process `Promise.allSettled`, log-only); API_CONTRACTS documents `/my/*` vs actual `/persons/me/*` | P2/P3 | V1 RECOMMENDED (doc) `[SHARED DEPENDENCY]` | C | Misleading ops/contract docs; the delivery-guarantee claim hides silent partial DPA cleanup | `core/domain-events.ts:58-82` vs EVENT_CONTRACTS §0.1; API_CONTRACTS.md §2 vs `routes.ts:3164+` |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| A | P0 core-workflow blocker (Privacy Settings persists) | FIX-001 | Low (one-key read change) but high-impact | Run in current `04` pass. No product decision needed. Must land its RED validator-inclusive test (from Batch D) first. |
| B | P1 reliability / trust / security gaps (module-local) | FIX-002, FIX-003, FIX-004, FIX-005 | Low-Medium | Run now (may share the same `04` pass as A — all module-local, no shared/db dependency). FIX-002 + FIX-003 are one delivery story (consolidate scrub, add `bio`, gut dead handler). FIX-004 and FIX-005 are independent small fixes. |
| C | Selected P2 V1-completeness + doc fixes | FIX-007, FIX-008, FIX-009, FIX-010, FIX-011, FIX-012, FIX-013, FIX-014 | Low-Medium | Run later, after A and B land. FIX-012 (PII log) and FIX-014 (docs) can piggyback any pass. FIX-007/FIX-008/FIX-009 touch the export+events surface together. FIX-013 needs the per-org-vs-global confirmation (Q-7-adjacent). |
| D | Test hardening / regression coverage (kills fake-green) | FIX-006 | Low (test-only, but reveals the P0) | Run now, RED-first — drives Batch A and protects Batch B. Add ≥1 validator-inclusive test per touched handler; tighten the Hurl privacy assert to 2xx + GET readback. |
| E | Shared/platform dependency fix | (none isolated for active fixes) | — | No standalone shared/platform *code* change in active scope. FIX-014 corrects only the EVENT_CONTRACTS doc. The `core/domain-events.ts` reliability change (per-subscriber retry/aggregation) and the generated-Zod required→optional bug are routed OUT to the core-platform audit / prompt 05 — do not pull them into a module-local batch. |
| F | Database/schema dependency fix | (none in active scope) | — | No schema/migration change is required for the active fixes. (FIX-009 adds a purge *job*, not a schema change; FIX-013 may need a schema/insert-semantics decision but is gated on confirmation — see §8.) The cross-module `directory_profiles` uniqueness/PII-duplication work belongs to the chapters-directory module, not this module's DB batch. |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | `updateMyPrivacySettings` invoked **through the generated Zod validator** (route-level), asserting 2xx with an `orgId` body and a persisted/readback row | backend/unit + integration | Reproduces the 400 RED, then proves the privacy toggle persists end-to-end (not validator-bypassed) | Replace fake-green logic in `handlers/person/updateMyPrivacySettings.test.ts:28`; add a validator-inclusive case (route-level harness) |
| FIX-001 | Hurl: privacy PATCH expects 200 + follow-up GET readback of the flipped flag | contract | Tighten `persons-extended-flow.hurl` §11 from `status < 500` to a real 2xx + state assertion | `specs/api/tests/contract/persons-extended-flow.hurl` (§11, rewrite in place) |
| FIX-001 | E2E: flip a privacy toggle → reload → state persisted (real backend) | E2E/Playwright | UI optimism currently masks the failure; prove persistence after reload | Extend `apps/memberry/tests/e2e/settings.spec.ts` (currently C2 covers empty-state only) |
| FIX-002 | Anonymization scrubs `bio` (and `gender` if Q-4 = yes) — assert the **full** field list, not a self-mirroring snapshot | backend/unit (regression) | `bio` (and decided `gender`) are nulled after the processor runs | Extend `handlers/person/jobs/deletionProcessor.test.ts` (current assertion mirrors impl, so it must assert the explicit field set) |
| FIX-003 | One shared `anonymizePerson()` field list is used by the processor; the dead `executeAccountDeletion` path is removed/reduced to that function | backend/unit (regression) | A single scrub source of truth exists; no second list can drift | Update `handlers/person/jobs/deletionProcessor.test.ts`; remove/trim `executeAccountDeletion.test.ts` accordingly |
| FIX-004 | `id-card-data` throws when the HMAC secret is missing (no `'fallback-secret'`) | backend/unit | Fail-closed on missing secret; QR cannot be signed with a known string | Extend `handlers/person/utils/id-card-data.test.ts` (currently does not test the missing-secret path) |
| FIX-005 | `updateMyProfile` round-trips `phone` (→ `contactInfo.phone`) and silently drops nothing | contract + backend/unit | Contract field `phone` is saved and read back; no 200-with-silent-loss | `specs/api/tests/contract/persons-extended-flow.hurl` (add phone round-trip) + extend `handlers/person/updateMyProfile.test.ts` (validator-inclusive) |
| FIX-006 | At least one validator-inclusive (route-level) test per handler touched in A/B; document the fake-green anti-pattern in the new tests | regression + integration | Hand-built `_body` no longer hides validator-stripped fields; the bug class is closed | New cases in `updateMyPrivacySettings.test.ts`, `updateMyProfile.test.ts`; tighten `persons-extended-flow.hurl` |
| FIX-007 | Consumer unit tests for `person.deletion.requested` / `.cancelled` notifying active officers of the person's orgs (pattern already exists for the 9 subscribers) | backend/unit (consumer) | Officers receive an in-app notification on request/cancel; emits are no longer dead | Extend `core/domain-event-consumers.test.ts` (mirror existing failure-isolation/consumer style) |
| FIX-008 | `exportMyData` response matches the `MyDataExport` model and includes certificates + `prcId` | contract + backend/unit | The export shape stops violating its own TypeSpec model; portability is complete | Extend `handlers/person/exportMyData.test.ts` + add a contract assertion in a person Hurl flow |
| FIX-009 | Expired-export payloads are purged (JSONB nulled/row removed after TTL) | backend/unit | DPA minimization: PII snapshot does not persist past the 7-day link | New test alongside a new purge job in `handlers/person/jobs/` (test it like `deletionProcessor.test.ts`) |
| FIX-010 | Deletion-grace banner is visible on the dashboard during grace, with a cancel CTA | E2E/Playwright | Banner renders app-wide off `getPerson('me').deletionScheduledAt`, not only in Settings | New case in `apps/memberry/tests/e2e/settings.spec.ts` or a layout-level e2e (request deletion → dashboard shows banner) |
| FIX-011 | ID card renders for a selected org for a multi-org member (not just `memberships[0]`) | E2E/Playwright | Org selector drives `/persons/me/id-card/:orgId`; second org's card is reachable | Extend `apps/memberry/tests/e2e/member/digital-id-card.spec.ts` with a 2-org fixture |
| FIX-012 | `createPerson` logs `hasEmail` boolean only — no raw email | backend/unit (log-shape, optional) | No PII in logs | Extend `handlers/person/createPerson.test.ts` (or assert log shape) |
| FIX-013 | `updateMyNotificationPreferences` with no org context (header absent) behaves correctly (global or membership-derived) without violating the notNull index | backend/unit | The fail-open insert no longer risks a notNull/index error when org context is missing | Extend `handlers/person/updateMyNotificationPreferences`-area test (gap plan §20) |
| FIX-014 | (doc-only) no automated test | n/a | EVENT_CONTRACTS delivery-guarantee text matches the in-process bus; API_CONTRACTS paths read `/persons/me/*` | n/a — doc edits to `EVENT_CONTRACTS.md` §0.1-0.3 and `m02 API_CONTRACTS.md` §2 |

Reserve E2E/Playwright for the core journeys only: privacy-toggle persistence (FIX-001), grace banner (FIX-010), and multi-org ID card (FIX-011). All other fixes are proven at the backend/unit + contract layer.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `handlers/person/updateMyPrivacySettings.ts:26` (read `orgId` from validated body, or alias both); tests `updateMyPrivacySettings.test.ts`, `persons-extended-flow.hurl` §11, `settings.spec.ts` | module-local | Small; one read-key change + tests |
| FIX-002 | `handlers/person/jobs/deletionProcessor.ts:73-91` (add `bio`, decide `gender`); `person.schema.ts:40` (reference) | module-local | Small |
| FIX-003 | NEW shared `anonymizePerson()` helper used by `deletionProcessor.ts`; remove/gut `handlers/person/executeAccountDeletion.ts` (+ its test) | module-local | Small (delete dead code); pairs with FIX-002 |
| FIX-004 | `handlers/person/utils/id-card-data.ts:77`; `core/config.ts` (new `ID_CARD_HMAC_SECRET` typed config, or fail-closed read of `AUTH_SECRET`) | module-local (+ config touch) | Small; config addition only |
| FIX-005 | `handlers/person/updateMyProfile.ts:32-45` (map `phone`, delete dead `contactInfo`/`primaryAddress`/`languagesSpoken`/`licenseNumber`/`prcId`/`avatar` mappings) | module-local | Small |
| FIX-006 | `handlers/person/updateMyPrivacySettings.test.ts`, `updateMyProfile.test.ts`, `id-card-data.test.ts`, `deletionProcessor.test.ts`; `specs/api/tests/contract/persons-extended-flow.hurl` | module-local (tests) | Small (test-only) |
| FIX-007 | `core/domain-event-consumers.ts` (new `person.deletion.requested`/`.cancelled` consumers); possibly drop the unused `person.anonymized`/`data-export.ready` emits or add their consumers | module-local (+ shared consumers file) | Medium; additive consumers in a shared file — reuse existing pattern, do not change event names/payloads |
| FIX-008 | `handlers/person/exportMyData.ts:56-91` (align to `MyDataExport`); `requestDataExport.ts`; `specs/api/src/modules/person-custom.tsp:52-72` (only if the model is the thing to fix); regen pipeline if the model changes | module-local (+ regen if `.tsp` changes) | Medium; if `.tsp` changes, requires `bun run build` + `bun run generate` |
| FIX-009 | NEW purge job in `handlers/person/jobs/` + registry in `person/jobs/index.ts` | module-local | Small; new scheduled job |
| FIX-010 | `apps/memberry/src/routes/_authenticated.tsx` (layout banner off `getPerson('me').deletionScheduledAt`); cancel CTA | module-local (frontend) | Small-Medium; layout-level component |
| FIX-011 | `apps/memberry/src/routes/_authenticated/my/id-card.tsx:57,80` (org dropdown → `/persons/me/id-card/:orgId`) | module-local (frontend) | Small |
| FIX-012 | `handlers/person/createPerson.ts:101` (log `hasEmail` boolean) | module-local | Trivial |
| FIX-013 | `handlers/person/updateMyNotificationPreferences.ts:22,56`; reference `notification-preferences.schema.ts`, `app.ts:437-441` | module-local | Small (depends on global-vs-per-org decision) |
| FIX-014 | `docs/product/EVENT_CONTRACTS.md` §0.1-0.3; `docs/product/modules/m02-member-profile/API_CONTRACTS.md` §2 | shared/platform (docs) | None (doc-only) |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001 | shared/platform | Generated Zod validator marks required `orgId: UUID` as `.optional()` (`validators.ts:9524` vs `person-custom.tsp:202`) | Even the correct handler won't get required-field enforcement; this is a generator bug class, not the privacy fix itself | No — fix G-01 with the read-key change now; route the generator bug to prompt 05 (cross-cutting). Do not change the generator in this batch. |
| FIX-004 | shared/platform | `core/config.ts` typed env (new `ID_CARD_HMAC_SECRET` or fail-closed `AUTH_SECRET`) | Config is shared; the fix must add a typed key, not read `process.env` ad hoc | During fix — additive config key only |
| FIX-007 | shared/platform | `core/domain-event-consumers.ts` + `domain-events.registry.ts` | New consumers live in the shared consumers file; must reuse the existing subscriber pattern and not alter event names/payloads | During fix — additive only |
| FIX-008 | shared/platform | TypeSpec→OpenAPI→SDK regen pipeline (only if `person-custom.tsp` `MyDataExport` model changes) | SDK types are generated; a model change requires `bun run build` + `bun run generate`, and SDK consumers see the new shape | During fix — prefer aligning the handler to the existing model to avoid a regen + SDK ripple |
| FIX-013 | cross-module / product decision | Org-context fail-open middleware on `/persons/*` (`app.ts:437-441`); membership-derived org | Whether notification prefs are global or per-org changes the fix shape and the schema's notNull semantics | Confirm first (Q-7-adjacent; gap plan §13 `[NEEDS CONFIRMATION]`) |
| FIX-014 | shared/platform | `core/domain-events.ts` delivery semantics (doc target) | The doc correction is in scope; the *bus reliability change* (retry/aggregation) is core-platform scope | Doc fix now; reliability change OUT of this module |
| (G-02, not active) | cross-module + product decision | chapters-directory module privacy model (Q-1) | Privacy toggles are enforced (or not) in the directory module; ADR-0005 PII-duplication tension | Blocked — see §8/§9 |
| (G-06, not active) | cross-module | chapters-directory `searchDirectory` 403 + missing `(orgId, personId)` uniqueness | Publish-to-directory duplicate creation originates in the directory module | Blocked — coordinate with chapters-directory audit; see §9 |
| (G-15 reliability, not active) | shared/platform | `core/domain-events.ts` per-subscriber retry/outcome record | Cascade reliability affects every event consumer | Deferred to core-platform audit; see §10 |
| (BR-01 status, not active) | cross-module | `membership.status` stored field used on the ID card (M05-owned) | BR-01 says compute from `dues_expiry_date`; ownership is M05's | Note only — for membership-lifecycle audit; see §10 |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| ~~Q-1: Which privacy model wins — M02 per-field toggles or directory-profile curation + 3-level visibility?~~ **DECIDED (Step 46): ENFORCE the M02 toggles.** | ✅ DECIDED | G-02 | Directory read/projection must honor `emailVisible`/`phoneVisible`/`photoVisible`/`addressVisible` | Enforcement is **CROSS-MODULE** (chapters-directory owns `searchDirectory`/`directory.repo.ts`/`directory.schema.ts`). No person-module slice. → coordinated chapters-directory `04`. See §9. |
| ~~Q-4: Should `gender` be scrubbed at anonymization alongside `bio`?~~ **DECIDED (Step 46): YES — scrub.** | ✅ DECIDED / SHIPPED | FIX-002 | DPA field-level erasure policy | DONE — `gender: null` added to `anonymizePersonFields` (`anonymize-person.ts`), RED→GREEN regression in `deletionProcessor.test.ts`. See fix-report §E. |
| Q-7: Are notification prefs global or per-org (and are legacy `updatePrivacySettings.ts`/`updateNotificationPreferences.ts` still routed)? | `[NEEDS CONFIRMATION]` | FIX-013 | Decides whether to derive org from membership or make prefs explicitly global; also whether the non-`My` handlers are dead duplicates | Eng confirms route wiring (grep `routes.ts`/`app.ts`) at the start of the FIX-013 fix; pick global-vs-per-org with product |
| Q-2: Is changing `person.contactInfo.email` without OTP acceptable, given the Better-Auth login email is separate? | `[NEEDS CONFIRMATION]` | G-11 (deferred) | M2-R1 scope; dues/election email may route to contact email | Confirm with product + auth-rbac audit before building any email-change/OTP UI; deferred for now |
| Q-3: Does the "pending payments" deletion guard include unpaid/overdue invoices or only in-flight payment records? | `[NEEDS PRODUCT DECISION]` | (guard-scope refinement, deferred) | M2-R5 guard scope; a member with an overdue invoice but no payment record can currently delete | Product decides; not blocking the active P0/P1 work |
| Q-6: Must chat/DM content, `notifications` rows, email-queue rows, survey responses, bookings, and S3 objects be cleaned on person deletion? | `[NEEDS PRODUCT DECISION]` | G-16 (deferred) | Cascade completeness vs intentional retention | Product/compliance enumerates retention intent per table before extending subscribers |
| G-10 license-regex source | `[NEEDS PRODUCT DECISION]` | G-10 (deferred) | License-format validation needs a per-association regex source | Defer until association config exposes the regex; document deferral |
| Q-5: Are `subSpecialization`/`yearsOfPractice`/`affiliation` still wanted, or amend m02 §7 to match the schema (incl. `bio`)? | `[BLOCKED BY MISSING SPEC]` (spec/schema conflict) | (spec reconciliation, deferred) | Spec-truth for future audits | Product decides; spec edit only, no code |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| G-02: enforce the 4 privacy toggles (`emailVisible`/`phoneVisible`/`photoVisible`/`addressVisible`) in the directory projection | `[CROSS-MODULE RISK]` (Q-1 **DECIDED**: enforce) | Q-1 resolved (Step 46) → enforce. But the directory read path (`searchDirectory`/`directory.repo.ts`/`directory.schema.ts`) lives in **chapters-directory/association:member**, gating only on its own 3-level `directoryVisibilityEnum`; it reads none of the 4 toggles. No person-module slice exists. | Coordinated **chapters-directory `04`**: directory projection reads `person_privacy_setting` and gates `contactEmail`/`contactPhone`/`photoUrl` per the member's per-org toggles (reuse the `trust-signals.ts`/`lookupCredentialPublic.ts` read precedent). Do NOT touch `directory_profiles` from person. |
| G-06: publish-to-directory creates duplicate profiles (search 403 → null → POST each click; no `(orgId, personId)` uniqueness) | `[CROSS-MODULE RISK]` | Root cause is in the chapters-directory module (`searchDirectory` 403 public-prefix bypass + missing uniqueness), not person/profile | Coordinate with chapters-directory audit/fix-plan; the uniqueness constraint belongs to that module's DB plan |
| G-15 reliability upgrade: per-subscriber retry / cascade-outcome aggregation in `core/domain-events.ts` | `[SHARED DEPENDENCY]` | Changing bus delivery semantics affects every domain-event consumer platform-wide | core-platform audit; only the EVENT_CONTRACTS *doc* correction (FIX-014) and a smallest failure-audit step are in V1 scope here |
| Generated Zod marks required props `.optional()` (`validators.ts:9524`) | `[SHARED DEPENDENCY]` | This is a TypeSpec→Zod generator bug; the same class may exist across modules | prompt 05 cross-cutting audit |
| `directory_profiles` duplicates person PII (`contactEmail`/`contactPhone`/`photoUrl`) vs ADR-0005 | `[CROSS-MODULE RISK]` | Schema-level duplication owned by the directory module / database-schema audit | chapters-directory + prompt 06 database-schema audit |
| ID card reads stored `membership.status` (BR-01 says compute from `dues_expiry_date`) | `[CROSS-MODULE RISK]` | M05 owns membership-status semantics; not a person/profile fix | membership-lifecycle audit |

## 10. Deferred Items

Items not included in the active fix sequence.

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Email-change-with-OTP UI + gating contact-email mutation | G-11 / M2-R1 | `[NEEDS CONFIRMATION]` | Blocked on Q-2 (auth-email vs contact-email intent); no UI exists yet — build only after the product/auth-rbac decision |
| License-format regex validation (server + client) | G-10 / BR-23 | `[NEEDS PRODUCT DECISION]` | Needs a per-association regex source that doesn't exist yet |
| Avatar upload on the profile edit form (reuse `PersonalInfoForm` avatar section) | G-13 | V2 DEFERRED (low-risk UX) | WF-010 step-3 friction only; photo upload already exists in onboarding/settings-account — not a reliability gap; reuse, don't rebuild, when capacity allows |
| Per-subscriber retry / pg-boss-backed event bus for the cascade | G-15 / §15 | V2 DEFERRED `[DO NOT OVERBUILD]` | Core-platform scope; smallest V1 step is failure-audit events, not a queue migration |
| Cascade scope extension (chat/DMs, `notifications`, email queue, survey responses, bookings, S3 objects) | G-16 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | Blocked on Q-6 retention enumeration |
| `subSpecialization`/`yearsOfPractice`/`affiliation` person fields | Q-5 / spec §7 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | Specced but never built; no UI demand evidence |
| Server-side `confirmation: "DELETE"` body validation | G-18 | V2 DEFERRED | Frontend gate adequate; auth + guards still apply — no safety hole |
| ZIP packaging + signed S3 URL for data export | §23 / EM-M02-9f0a1b2c | V2 DEFERRED | Already tracked in-code as P3; JSON attachment works today |
| "Pending payments" deletion-guard scope refinement (unpaid/overdue invoices) | Q-3 | `[NEEDS PRODUCT DECISION]` | Guard works for in-flight payments; broadening scope needs a product call |
| `dunningEvents` hard-delete retention intent in cascade | §15 | V2 DEFERRED `[NEEDS CONFIRMATION]` | Likely fine (communications history); confirm retention intent later |
| Admin "update any profile" path in the person module | §14 / spec §6 | DO NOT ADD (here) `[NEEDS PRODUCT DECISION]` | platformadmin is the privileged surface; confirm before adding (see §11) |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Consent-management fields on Person | §23 | Explicitly out of scope per CLAUDE.md + m02 §20.2 |
| Real-time (websocket) propagation of privacy changes to open directory views | §23 | Spec only requires ≤1-minute cache invalidation — `[DO NOT OVERBUILD]` |
| New `person.*` events beyond the existing registry | §23 / G-07 | Wire the existing dead emits first (FIX-007); don't invent new events |
| Distributed / pg-boss-backed domain event bus with retries + DLQ | §23 / G-15 | Core-platform scope; `[DO NOT OVERBUILD]` for the person module — smallest V1 step is failure-audit events |
| Admin "update any profile" endpoint duplicated inside the person module | §14 | platformadmin module is the privileged write surface; duplicating write paths violates the ADR-0005 spirit |
| `profile_idcard_share_link` feature-flag plumbing | §23 | The verify link already exists; flag defaults false — don't build flag machinery for it now |
| A generic state-machine / preference-framework abstraction for prefs and privacy | §12 / §13 | Premature abstraction; fix the two concrete handlers, don't build a framework — `[DO NOT OVERBUILD]` |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Single source: handler reads the wrong body key (`organizationId` vs contract `orgId`). One-line read fix is the true root cause; the fake-green tests are why it survived. |
| FIX-002 | Root cause | The scrub field list never included `bio`; root fix is adding the field to the authoritative scrub list (paired with FIX-003 consolidation so it can't be missed again). |
| FIX-003 | Root cause | Two duplicated scrub lists are the structural cause of drift; consolidating to one `anonymizePerson()` removes the root cause, not just the symptom. |
| FIX-004 | Root cause | Insecure default (`?? 'fallback-secret'`) is the root cause; fail-closed + dedicated config key fixes it at the source. |
| FIX-005 | Root cause | Handler maps fields the validator strips and never maps `phone`; deleting dead mappings + adding the `phone` map fixes the real contract mismatch. |
| FIX-006 | Root cause (testability) | The validator-bypassing test pattern is the root cause of invisible contract bugs; adding validator-inclusive tests closes the class, not a single instance. |
| FIX-007 | Root cause | Events were registered/emitted but never consumed — wiring the consumers (or removing the emits) resolves the dead contract surface at the source. |
| FIX-008 | Root cause | Handler response was hand-shaped and diverged from the model; aligning to `MyDataExport` (or fixing the model) removes the drift source. |
| FIX-009 | Symptom-adjacent / root | No purge job exists; adding one addresses the retention root cause (data-minimization), not a one-off cleanup. |
| FIX-010 | Symptom (UX surfacing) | Backend state exists; the gap is purely surfacing it app-wide — a layout banner is the correct minimal fix. |
| FIX-011 | Symptom (UX) | Backend is already per-org; the fix is exposing org selection in the UI. |
| FIX-012 | Root cause | Logging the raw email is the source of the PII-log violation; log a boolean instead. |
| FIX-013 | Unclear | Whether prefs should be global or per-org is undecided (Q-7); the fail-open insert is a symptom of that ambiguity — confirm intent before fixing. |
| FIX-014 | Root cause (docs) | The doc claims a delivery guarantee the bus does not provide; correcting the doc removes the misleading source of truth. |

## 13. Recommended First Fix Batch

**Batch name:** Batch A (P0 privacy) + the Batch D RED slice that drives it, then Batch B (P1 module-local) in the same `04` pass if capacity allows.

**Included Fix IDs:** FIX-001 (P0), FIX-006 (test hardening that proves FIX-001 and protects Batch B). Immediately after, FIX-002 + FIX-003 (paired scrub consolidation), FIX-004, FIX-005.

**Why this batch comes first:** FIX-001 is the only P0 — it makes the entire m02 Privacy Settings workflow non-functional in the PII hub, and it is masked by fake-green tests, so it must lead with a RED validator-inclusive test (FIX-006) before the one-key fix. FIX-002/003/004/005 are all module-local, low-risk, root-cause P1s with no shared/db/product blockers, so they belong in the same early pass. None of them depend on an unanswered product decision (only `gender` in FIX-002 is gated by Q-4 — `bio` proceeds regardless).

**Tests to write first (RED):**
1. `updateMyPrivacySettings` through the generated Zod validator asserting 2xx + persisted readback (reproduces the 400) — `updateMyPrivacySettings.test.ts`.
2. Hurl privacy PATCH expecting 200 + GET readback — tighten `persons-extended-flow.hurl` §11 (from `< 500`).
3. Anonymization asserts the explicit scrub field set incl. `bio` — `deletionProcessor.test.ts`.
4. `updateMyProfile` `phone` round-trip (validator-inclusive) — `updateMyProfile.test.ts` + Hurl.
5. `id-card-data` throws when the HMAC secret is missing — `id-card-data.test.ts`.

**Explicit out-of-scope for this batch:**
- G-02 (4 unenforced privacy toggles) — blocked on Q-1.
- G-06 (directory publish duplicates) and `directory_profiles` PII duplication — cross-module (chapters-directory).
- `gender` scrub — only if Q-4 answered (the consolidated fn makes adding it trivial later).
- The generated-Zod required→optional generator bug — prompt 05.
- The `core/domain-events.ts` reliability change — core-platform audit.
- All Batch C items (FIX-007 through FIX-014) — later pass.
- Everything in §10 (Deferred) and §11 (Do Not Build).

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Person & Profile (+ deletion cascade)
- **Exact module slug:** `person-profile`
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/person-profile-fix-ready-plan.md`
- **Raw gap plan (context only):** `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/person-profile-gap-plan.md`
- **Exact batch to execute first:** Batch A (FIX-001) plus its driving Batch D RED slice (FIX-006). If capacity allows in the same pass, continue into Batch B (FIX-002, FIX-003, FIX-004, FIX-005) — all module-local, no blockers. Do NOT start Batch C, G-02, or G-06.
- **Tests to prioritize (write RED first):**
  1. `handlers/person/updateMyPrivacySettings.test.ts` — route-level, validator-inclusive, asserts 2xx + persisted readback (reproduces the 400).
  2. `specs/api/tests/contract/persons-extended-flow.hurl` §11 — tighten from `status < 500` to 200 + GET readback.
  3. `handlers/person/jobs/deletionProcessor.test.ts` — assert the explicit scrub field set incl. `bio`.
  4. `handlers/person/updateMyProfile.test.ts` + Hurl — `phone` round-trips (validator-inclusive).
  5. `handlers/person/utils/id-card-data.test.ts` — throws when the HMAC secret is missing.
  - Reserve E2E (`apps/memberry/tests/e2e/settings.spec.ts`) for the privacy-toggle persistence journey only.
- **Files likely to touch:** `handlers/person/updateMyPrivacySettings.ts:26`; `handlers/person/jobs/deletionProcessor.ts:73-91`; remove/gut `handlers/person/executeAccountDeletion.ts`; NEW shared `anonymizePerson()` helper; `handlers/person/utils/id-card-data.ts:77` + `core/config.ts` (typed HMAC secret); `handlers/person/updateMyProfile.ts:32-45`. Tests as listed above.
- **Shared / database cautions:**
  - Do NOT change the TypeSpec→Zod generator for FIX-001 — fix the handler read-key; the `validators.ts:9524` required→optional bug is routed to prompt 05.
  - FIX-004 must add a typed key in `core/config.ts` (e.g. `ID_CARD_HMAC_SECRET`), not read `process.env` ad hoc; fail closed when unset.
  - No schema/migration change is required for Batch A/B. Do not touch `directory_profiles` or any directory schema (cross-module).
  - If FIX-008 (later) changes `person-custom.tsp`, run the full regen pipeline (`cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`); prefer aligning the handler to the existing `MyDataExport` model to avoid an SDK ripple.
  - Beware the fake-green pattern: any handler unit test that hand-builds `_body` bypasses the generated validator — add at least one validator-inclusive test per touched handler.
- **Items NOT to implement (this pass or at all):**
  - G-02 (4 unenforced privacy toggles) — blocked on Q-1 product decision.
  - G-06 (directory publish duplicates) + `directory_profiles` PII duplication — cross-module (chapters-directory).
  - `gender` scrub — only if Q-4 is answered.
  - The `core/domain-events.ts` per-subscriber retry / bus reliability change — core-platform audit (only the EVENT_CONTRACTS doc correction is in scope, in Batch C).
  - The generated-Zod required→optional generator fix — prompt 05.
  - Everything in §10 (Deferred) and §11 (Do Not Build): consent fields, websocket privacy propagation, new `person.*` events, pg-boss/DLQ bus, admin update-any in the person module, ZIP export, share-link flag plumbing, email-change OTP UI, license regex, cascade-scope extension, `subSpecialization`/`yearsOfPractice`/`affiliation` fields, server-side DELETE-confirmation body.

---

Next recommended step:
Module/group: Person & Profile (+ deletion cascade)
Module slug: person-profile
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/person-profile-fix-ready-plan.md
Recommended batch: Batch A (FIX-001) + Batch D RED slice (FIX-006), then Batch B (FIX-002/003/004/005) if capacity allows
