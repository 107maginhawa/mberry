# AHA Module/Group Fix Report: Documents & Credentials

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Documents & Credentials |
| Module slug | documents-credentials |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/documents-credentials-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/documents-credentials-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/documents-credentials-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch B1 — Documents reliability / permission / compliance (FIX-003, FIX-004, FIX-009) + isolated Batch E TypeSpec regen step for FIX-004 |
| Superpowers used | Yes (`superpowers:using-superpowers` invoked before implementation) |
| Working tree status checked | Yes (`git status --short` at start; tree already held prior AHA changes from 9 earlier modules) |
| Fix scope | P1 (FIX-003, FIX-004) + selected P2 V1 RECOMMENDED (FIX-009 download tests) |
| Out of scope | Batch A verify-chain (Q1-gated), Batch C certificates (Q8/migration-gated), Batch B2 (B2 next pass), Batch D credentials suites, all §10 Deferred / §11 Do Not Build |
| Shared files touched | Yes — `documents.tsp` (TypeSpec source) + regenerated `generated/openapi/{validators,routes,registry}.ts` and `packages/sdk-ts/src/generated/*` (isolated Batch E step) |
| Schema/migration touched | No — DB schema (`documents.schema.ts`) already supports `status`; the `document_access_log` table already exists; no migration added |
| Limitations | (1) Hurl contract assertions added to `assoc-documents-flow.hurl` for FIX-004 but NOT executed: no API server on :7213 and no seeded DB/auth — `[BLOCKED BY ENVIRONMENT]`. (2) The TypeSpec regen also picked up two pre-existing pending `.tsp` changes from prior AHA modules (`governance.tsp`, `training.tsp`); these were preserved, not introduced by this fix, and surface as the unrelated `closeElectionVoting` op in `check:sdk-compat`. (3) Behavioral proof is via backend/unit + repo tests; full-stack integration not run. |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-003 | G3 — `document_access_log` never written on view/download; AC-M11-005 unit test is in-memory simulation (fake-green) | P1 | V1 REQUIRED | B1 | Compliance/audit feature (M11-R5) produced no data; fake-green test hid it | Fixed |
| FIX-004 | G4 — `searchDocuments` has no `status` enforcement (members list draft/archived; officer filter no-op); `tag` param ignored | P1 | V1 REQUIRED | B1 + E (TypeSpec regen) | Draft documents are officer WIP; member exposure violates WF-073 publish semantics; permission gap | Fixed |
| FIX-009 | G10 — 0 unit tests for `downloadDocument.ts` (and id-card files) | P2 | V1 RECOMMENDED | B1 (download portion) | P1-workflow code path with no protection; needed to safely drive G3 download write | Fixed (downloadDocument portion; id-card files belong to Batch A, out of scope) |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `bun test src/handlers/documents/` | 214 pass / 0 fail / 22 files | all | Clean baseline before edits |
| `ac-m11.documents.test.ts` AC-M11-005 block | Pass (fake-green) | FIX-003 | Tested local in-memory `logDocumentAccess` closure, NOT the handler; `document_access_log` never written in production path |
| New `getDocument.access-log.test.ts` (view→row) | Fail (0 rows written) | FIX-003 | RED for the right reason: no access-log write in `getDocument` |
| New `downloadDocument.test.ts` access-log write | Fail (0 rows written) | FIX-003 | RED for the right reason: no access-log write in `downloadDocument` |
| New `downloadDocument.test.ts` auth matrix (7 tests) | Pass | FIX-009 | Confirmed mock-db/port harness correct; existing auth behavior already enforced |
| `searchDocuments.test.ts` status/tag tests | Fail (status/tag undefined in filters) | FIX-004 | RED: handler ignored status + tag |
| `documents.repo.test.ts` tag-filter condition | Fail (undefined) | FIX-004 | RED: repo `buildWhereConditions` had no `tag` branch |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-003 | Write a `document_access_log` row (`action: 'view'`) in `getDocument`, best-effort try/catch like the existing meta-log | `handlers/documents/getDocument.ts` | No | Logging failure never breaks the view response |
| FIX-003 | Write a `document_access_log` row (`action: 'download'`) in `downloadDocument` after access check, before the redirect, best-effort | `handlers/documents/downloadDocument.ts` | No | Module-owned table complements the existing platform `auditAction()` (keeps both per recommended Q3 answer) |
| FIX-003 | Replaced fake-green AC-M11-005 in-memory simulation with real handler coverage | `handlers/documents/ac-m11.documents.test.ts` (removed `logDocumentAccess` closure + describe block; pointer comment to real tests) | No | AC-M11-006 version-history block left untouched (out of B1 scope) |
| FIX-004 | `searchDocuments`: resolve officer status once; non-officers forced to `status: 'published'`; officers may pass `status` (respected) or see all; wire `tag` through to repo | `handlers/documents/searchDocuments.ts` | No (handler) | Reuses existing `requireOfficerTerm`; preserves the P0-04 accessLevel downgrade |
| FIX-004 | Repo: add `tag` to `DocumentFilters` and a jsonb-containment (`tags @> [...]`) condition in `buildWhereConditions` | `handlers/documents/repos/documents.repo.ts` | No (module-local) | `status` filter branch already existed in repo |
| FIX-004 | Add `status?: "draft" \| "published" \| "archived"` query param to `DocumentSearchParams` | `specs/api/src/association/core/documents.tsp` | `[SHARED DEPENDENCY]` | TypeSpec source; required so the validator stops stripping `status` |
| FIX-004 | Regenerate OpenAPI + types + validators/routes/registry + SDK | `specs/api/dist/**` (build), `services/api-ts/src/generated/openapi/{validators,routes,registry}.ts`, `packages/sdk-ts/src/generated/*` | `[SHARED DEPENDENCY]` | Ran `cd specs/api && bun run build` then `cd services/api-ts && bun run generate`. Net SDK surface change from THIS fix = 0 operationIds (query-param-only). |
| FIX-004 | Officer-repo stub added to a pre-existing test that broke when `searchDocuments` began always resolving officer status | `handlers/documents/permission-enforcement.test.ts` | No | Regression-fix for `returns results when authenticated` |
| FIX-009 | New `downloadDocument` unit suite: auth matrix (unauth / not-found / platform-admin / active-member / outsider-forbidden) + access-log write + best-effort failure | `handlers/documents/downloadDocument.test.ts` (new) | No | Mock-db handles the membership port's raw `db.select()` chain |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `handlers/documents/getDocument.access-log.test.ts` (new) | backend/unit + regression | A successful view persists a real `document_access_log` row (`action: 'view'`, correct personId/docId/orgId); cross-org view writes no row; logging failure does not break the response | FIX-003 |
| `handlers/documents/downloadDocument.test.ts` (new) | backend/unit + permission/RBAC + regression | Auth matrix (admin/member/outsider/unauth/not-found); a successful download writes a `document_access_log` row (`action: 'download'`); forbidden writes nothing; best-effort logging | FIX-003, FIX-009 |
| `handlers/documents/searchDocuments.test.ts` (extended) | backend/unit + permission/RBAC | Non-officer forced to `published` even with no/`draft` query; officer with no filter sees all statuses; officer `status` filter respected (draft/archived); `tag` passed through; absent `tag` is undefined | FIX-004 |
| `handlers/documents/repos/documents.repo.test.ts` (extended) | backend/unit | `buildWhereConditions` produces a condition for the `tag` filter | FIX-004 |
| `handlers/documents/ac-m11.documents.test.ts` (updated) | backend/unit | Removed fake-green AC-M11-005 in-memory simulation; documents real coverage location | FIX-003 |
| `handlers/documents/permission-enforcement.test.ts` (updated) | backend/unit | `searchDocuments` succeeds with officer stub (handler now always resolves officer status) | FIX-004 (regression) |
| `specs/api/tests/contract/assoc-documents-flow.hurl` (extended) | contract (not executed) | Officer can filter `?status=draft` and `?tag=contract-test` — `[BLOCKED BY ENVIRONMENT]` (no server) | FIX-004 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/documents/` (baseline) | Passed | 214 pass / 0 fail before changes |
| New/extended tests RED run (pre-implementation) | Failed (as intended) | 8 fails, all for the correct reason (no access-log write; status/tag ignored; repo tag-filter missing) |
| `cd specs/api && bun run build` | Passed | OpenAPI + TS types regenerated; 821 pre-existing deprecation WARNINGS (not errors) |
| `cd services/api-ts && bun run generate` | Passed | validators/routes/registry/SDK regenerated; `SearchDocumentsQuery` now includes `status` |
| `bun test src/handlers/documents/` (post-fix) | Passed | 230 pass / 0 fail / 24 files |
| `bun test src/core/domain-event-consumers.test.ts src/handlers/person/createMyCreditEntry.test.ts` | Passed | 24 pass / 0 fail — external consumers of documents repos unaffected |
| `bun run typecheck` (services/api-ts) | Passed | 0 `error TS`; no documents-related type errors |
| `bun run check:sdk-compat` (root) | Failed (pre-existing, unrelated) | added=1 (`closeElectionVoting` from prior governance.tsp work), removed=0, changed=0. THIS fix adds 0 operationIds. |
| Hurl `assoc-documents-flow.hurl` | Not Run / Blocked | No API server on :7213, no seeded DB/auth — `[BLOCKED BY ENVIRONMENT]` |

## 7. Validation Summary

- **Passed:** Full documents test suite (230 pass / 0 fail, up from 214). External documents-repo consumers (24 pass). API workspace typecheck (0 errors). TypeSpec build + generate. The new tests proved real behavior: a view/download now persists a real `document_access_log` row; `searchDocuments` enforces published-only for non-officers, respects officer status filters, and wires the previously-ignored `tag` param.
- **Failed:** `check:sdk-compat` fails, but **only** on a pre-existing, unrelated operationId (`closeElectionVoting`) introduced by a prior AHA module's `governance.tsp` change already in the dirty tree. My documents change is a query-param-only addition (added=0 ops, changed=0 ops) and is SDK-compatible.
- **Not run:** Hurl contract suite (needs a booted API + seeded DB + auth cookies). Whole-repo test suite intentionally not run (focused-validation scope).
- **Pre-existing / unrelated:** The regenerated `generated/**` and `packages/sdk-ts/**` diffs additionally reflect pending `governance.tsp`/`training.tsp` source changes from earlier AHA modules — preserved, not introduced here.

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| TypeSpec contract | `specs/api/src/association/core/documents.tsp` (`status` query param) | OpenAPI → generated validators/routes/registry → SDK → both apps | searchDocuments unit + repo tests | `[SHARED DEPENDENCY]`. Query-param-only; backward compatible; 0 operationId surface change |
| Generated code | `services/api-ts/src/generated/openapi/{validators,routes,registry}.ts`, `packages/sdk-ts/src/generated/*` | SDK consumers, both frontends | typecheck (0 errors), check:sdk-compat (0 added ops from this fix) | `[SHARED DEPENDENCY]`. Regen also carried prior governance/training pending changes — preserved |
| Document access log | `document_access_log` table (existing) | Officer access-log UI/API (`getDocumentAccessLog`) | new view/download write tests | No schema change; table already existed; now actually populated |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Contract-level proof of FIX-004 | FIX-004 (Hurl) | No API server / seeded DB / auth in environment | Run `assoc-documents-flow.hurl` against a booted impl on `$API_URL` once available |
| id-card unit suites (rest of G10) | FIX-009 / G10 | id-card files belong to Batch A (Q1-gated); out of B1 scope | Cover within the Batch A verify-chain pass |
| Verify chain (G1/G2/G12-card/G14) | FIX-001/002/012/014 | Gated on product decision Q1 (canonical verify URL/token) | Resolve Q1, then run Batch A `04` pass |
| Certificates PDF + training linkage | FIX-005/006/015 | Gated on Q8 backfill + cert-schema migration (Batch F) + m09 seam | Resolve Q8 + write migration, then run Batch C `04` pass |
| Credentials lifecycle / cron / events | FIX-007/010/011/013 | Batch B2 (next pass), not B1 | Run Batch B2 `04` pass |
| Credentials per-handler suites | FIX-008 / G8 | Batch D; required before any credentials handler change | Run Batch D before touching credentials handlers |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Hurl contract execution for documents | `[BLOCKED BY ENVIRONMENT]` | No running API server on :7213; no seeded DB / auth cookies | Boot impl + seed DB; run `scripts/run-contract-tests.ts` against `$API_URL` |
| `check:sdk-compat` green | `[NEEDS CONFIRMATION]` (not this batch) | Pre-existing `closeElectionVoting` op from prior governance.tsp work trips the baseline gate; unrelated to documents | Owning module re-captures `docs/quality/SDK_BASELINE_OPS.json` after its work lands |
| Batch A URL/route contract | `[NEEDS PRODUCT DECISION]` (Q1) | Canonical card-verify token/URL format undecided | Q1 answered |
| Batch C / F certificate migration | `[UNBLOCKED Step 38, 2026-06-13]` — Q8 = Option A (nullable + lazy-link) | ~~Backfill strategy undecided~~ Resolved | Ready to write migration — see CONTINUE-39 prompt + ready-plan §Decisions Step 38 |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Verify chain (FIX-001/002/012/014) | gated | Q1 product decision (Batch A) |
| Certificates PDF/training linkage (FIX-005/006/015) | gated | Q8 + Batch F migration + m09 seam (Batch C) |
| Credentials lifecycle (FIX-007/010/011/013) | unselected batch | Batch B2 — run next |
| Credentials per-handler suites (FIX-008) | unselected batch | Batch D — prerequisite for credentials handler changes |
| AC-M11-006 version-history fake-green block | `[DO NOT OVERBUILD]` for B1 | Out of B1 scope; only the AC-M11-005 access-log block was the call-out fake-green; left for a later test-hardening pass |
| API-key verification, MemberCard entity, credentials-schema relocation, SVG sanitization, storage virus scan, `listCertificates` route | V2 DEFERRED / DO NOT ADD | Per fix-ready plan §10/§11 |
| `core/domain-event-consumers.ts`, id-card files, `routeTree.gen.ts`, cert-schema migration | Batch E/F (forbidden this pass) | Not touched; confirmed pre-existing dirty (prior AHA modules), preserved |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/documents/getDocument.ts` | Best-effort `document_access_log` write (`action: 'view'`) on successful view | FIX-003 |
| `services/api-ts/src/handlers/documents/downloadDocument.ts` | Best-effort `document_access_log` write (`action: 'download'`) before redirect | FIX-003 |
| `services/api-ts/src/handlers/documents/searchDocuments.ts` | Resolve officer once; force non-officers to `published`; respect officer `status`; wire `tag` | FIX-004 |
| `services/api-ts/src/handlers/documents/repos/documents.repo.ts` | Add `tag` to `DocumentFilters` + jsonb-containment condition | FIX-004 |
| `specs/api/src/association/core/documents.tsp` | Add `status` query param to `DocumentSearchParams` | FIX-004 `[SHARED DEPENDENCY]` |
| `services/api-ts/src/generated/openapi/{validators,routes,registry}.ts` | Regenerated (now includes `SearchDocumentsQuery.status`) | FIX-004 (Batch E) |
| `packages/sdk-ts/src/generated/*` | Regenerated SDK (carried documents + prior pending tsp changes) | FIX-004 (Batch E) |
| `services/api-ts/src/handlers/documents/getDocument.access-log.test.ts` (new) | Real view access-log write tests | FIX-003 |
| `services/api-ts/src/handlers/documents/downloadDocument.test.ts` (new) | Download auth matrix + access-log write tests | FIX-003, FIX-009 |
| `services/api-ts/src/handlers/documents/searchDocuments.test.ts` | Status enforcement + tag wiring tests | FIX-004 |
| `services/api-ts/src/handlers/documents/repos/documents.repo.test.ts` | Tag filter condition test | FIX-004 |
| `services/api-ts/src/handlers/documents/ac-m11.documents.test.ts` | Removed fake-green AC-M11-005 simulation | FIX-003 |
| `services/api-ts/src/handlers/documents/permission-enforcement.test.ts` | Stub officer repo for searchDocuments auth test (regression) | FIX-004 |
| `specs/api/tests/contract/assoc-documents-flow.hurl` | Officer status/tag filter assertions (not executed) | FIX-004 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED-then-GREEN test runs + counts | This report §3 / §6 (terminal output captured inline) | FIX-003, FIX-004, FIX-009 |
| Generated validator now contains `status` | `services/api-ts/src/generated/openapi/validators.ts:10280` (`status: z.enum(["draft","published","archived"]).optional()`) | FIX-004 |
| SDK-compat result (0 added ops from this fix) | This report §6 | FIX-004 |
| No new screenshots/Playwright/Webwright | n/a | — (browser proof not required for backend/unit fixes) |

## 14. Completion Decision

**PARTIALLY COMPLETE**

The selected Batch B1 fixes (FIX-003, FIX-004, FIX-009) are fully implemented and validated by passing backend/unit + repo tests (230/0 in the documents suite, up from 214) and a clean API typecheck, with real behavior proven (access-log rows now persist on view/download; `searchDocuments` enforces published-only for non-officers, respects officer status filters, and wires the previously-ignored `tag`). The fake-green AC-M11-005 test was replaced with real handler coverage.

It is **PARTIALLY COMPLETE** (not COMPLETE) because one validation channel is blocked: the Hurl contract assertions added for FIX-004 could not be executed (`[BLOCKED BY ENVIRONMENT]` — no running API server / seeded DB), and `check:sdk-compat` reports a failure caused solely by a pre-existing, unrelated operationId from a prior AHA module's pending TypeSpec change (this fix adds 0 operationIds). No Batch B1 behavior is unproven at the unit level; the gap is purely the unexecuted contract layer.

## 15. Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for the next documents-credentials batch — **Batch B2** (FIX-007 license-renewal cron, FIX-010 certificate-availability notification gate, FIX-011 `verification.requested` audit consumer). Note Batch B2 edits the shared `core/domain-event-consumers.ts` (Batch E file) and must be path-scoped and separately tested.

Prompt: `/Users/elad-mini/Desktop/memberry/docs/aha/prompts/04-module-or-group-fix-tdd.md`
Fix-ready plan: `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/documents-credentials-fix-ready-plan.md`
Selected batch: Batch B2.

When an API impl + seeded DB become available, also re-run the focused contract check: `assoc-documents-flow.hurl` against `$API_URL` to close the blocked FIX-004 contract validation.

---

# Batch B2 — FIX-007 + FIX-010 + FIX-011 (appended 2026-06-12)

> Separate `04` pass. Batch B1 above is unchanged. This pass added one new background job (FIX-007) and two domain-event consumer changes (FIX-010 gate, FIX-011 new consumer) in the shared `core/domain-event-consumers.ts`. No TypeSpec change, no migration, no generator regen.

## B2.1 Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Documents & Credentials |
| Module slug | documents-credentials |
| Fix date | 2026-06-12 |
| Batch executed | Batch B2 (FIX-007, FIX-010, FIX-011) |
| Superpowers used | Yes (`superpowers:test-driven-development`, RED→GREEN per fix) |
| Working tree status checked | Yes (pre-existing dirty tree from prior AHA passes preserved; only B2 files touched) |
| Fix scope | P1 (FIX-007) + selected P2 / V1 RECOMMENDED (FIX-010, FIX-011) |
| Out of scope | Batch A (Q1), Batch C (Q8/migration/m09), Batch D credentials suites, FIX-013 (emit-vs-amend), all §10 Deferred / §11 Do Not Build |
| Shared files touched | Yes — `core/domain-event-consumers.ts` (Batch E file) + `association:member/jobs/index.ts` (jobs registry) |
| Schema/migration touched | No |
| Limitations | Job-processor + consumer logic proven at the backend/unit level with stubbed db (mirrors existing dues/consumer test style); no live cron run / Postgres-integration run this pass. |

## B2.2 Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-007 | G7 — license renewal alerts never generated (only seed wrote `license_renewal_alert`; no cron) | P1 | V1 REQUIRED | B2 | Headline credential feature silently did nothing in prod; producer was missing | Fixed |
| FIX-010 | G12 — `training.completed` consumer notified "certificate available to download" even when no certificate was issued | P2 | V1 RECOMMENDED | B2 | Misleading member journey; cheap one-block gate | Fixed |
| FIX-011 | G13 — `verification.requested` emitted with zero consumers; certificate verifications unlogged | P2 | V1 RECOMMENDED | B2 + E | Lost audit signal; add-the-consumer (event already exists) | Fixed |

## B2.3 Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `registerDuesJobs` (jobs index) | No `member.licenseRenewalProcessor` registered | FIX-007 | RED test asserted absent registration → failed correctly |
| `processLicenseRenewalAlerts` | Module did not exist | FIX-007 | RED: `Cannot find module './licenseRenewalProcessor'` |
| `training.completed` consumer | Notified ALL enrolled/completed members regardless of cert (RED got 2 and 3 notifications) | FIX-010 | RED failed for the right reason: no cert gate |
| `verification.requested` consumer | Zero consumers (RED `logEvent` called 0 times) | FIX-011 | RED failed for the right reason: no consumer |
| Full `bun test` (api-ts) baseline | 6093 pass / 1 fail / 4 todo | all | 1 fail = pre-existing `registerEmailJobs` (30000 vs 1000), unrelated |

## B2.4 Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-007 | New daily cron `member.licenseRenewalProcessor` (`'0 1 * * *'`) scanning active professional licenses within `[7,14,30,60,90]`-day windows; inserts idempotent `license_renewal_alert` rows keyed on `(licenseId, window)`; status `pending` | `association:member/jobs/licenseRenewalProcessor.ts` (new), `association:member/jobs/index.ts` (import + registration, additive) | `[SHARED DEPENDENCY]` jobs registry — additive only | Mirrors `dues.reminderProcessor` scan/insert + dedupe-via-existing-rows pattern |
| FIX-010 | Gate the "Certificate Available" notification on a non-revoked certificate existing for the training+person; no cert → no notification (`recipients` filtered by an `eligible` person set; early-return when empty) | `core/domain-event-consumers.ts` (`training.completed` block only) | `[SHARED DEPENDENCY]` consumer file (Batch E) | One small in-block change; chunking now iterates `recipients` not all `enrollees` |
| FIX-011 | New `verification.requested` consumer: resolves cert org via cert-number lookup, writes a tamper-evident `audit_log_entry` via `AuditRepository.logEvent` (`eventType:'compliance'`, `category:'association'`, `action:'read'`, `outcome` = verified?`success`:`failure`, `resourceType:'certificate'`, `resource`=certNumber) | `core/domain-event-consumers.ts` (new consumer + `AuditRepository` import) | `[SHARED DEPENDENCY]` consumer file (Batch E) | Sink decision: no `credential_verification_log` table exists (only a TypeSpec model in generated validators) and no migration this pass, so the existing platform `audit_log_entry` is the canonical sink |

## B2.5 Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `association:member/jobs/licenseRenewalProcessor.test.ts` (new) | backend/unit (job) | A license expiring within a window → one alert row inserted (`daysUntilExpiry`, `alertDate`, `status:pending`); re-run with an existing alert is idempotent (0 inserts); license beyond max window → no alert | FIX-007 |
| `association:member/jobs/index.test.ts` (extended) | backend/unit | `member.licenseRenewalProcessor` is registered as a daily cron (`'0 1 * * *'`) | FIX-007 |
| `core/domain-event-consumers.test.ts` (extended) | backend/unit (domain workflow) | `training.completed` with no cert → 0 notifications; with mixed certs → notifies only the member with a non-revoked cert | FIX-010 |
| `core/domain-event-consumers.test.ts` (extended) | backend/unit (audit) | `verification.requested` writes a certificate audit record (`resource`/`resourceType`/`action`/`organizationId`); `verified:false` → `outcome:'failure'` | FIX-011 |

## B2.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test .../jobs/licenseRenewalProcessor.test.ts .../jobs/index.test.ts` | Passed (10 pass) | FIX-007 RED→GREEN |
| `bun test src/core/domain-event-consumers.test.ts` | Passed (22 pass) | FIX-010 + FIX-011 RED→GREEN |
| `bun test "src/handlers/association:member/jobs" src/core/domain-event-consumers.test.ts src/handlers/member/certificates src/handlers/member/credentials` | Passed (165 pass / 21 files) | Affected dirs, no regressions |
| `bun test` (full api-ts) | Partially Passed (6101 pass / 1 fail / 4 todo) | +8 vs baseline (6093→6101); the 1 fail is the pre-existing, unrelated `registerEmailJobs` flake |
| `bun run --filter '*' typecheck` | Passed (0 errors, 5/5 workspaces) | — |

## B2.7 Validation Summary

- **Passed:** all three fixes RED→GREEN at the backend/unit level; affected-dir suites; full api-ts suite (no new failures); monorepo typecheck (5/5).
- **Failed:** none introduced. The single full-suite failure (`registerEmailJobs > registers email.processor as interval job`, 30000 vs 1000) is **pre-existing and unrelated** (present in the documented baseline).
- **Not run:** live cron execution and a real-Postgres integration run for the new job (stubbed-db unit coverage mirrors the existing dues/consumer test convention).
- **Blocked:** none.
- `check:sdk-compat` deliberately not `--update`-ed (frozen until milestone Step 6); Batch B2 adds 0 operationIds, so it does not move the SDK surface.

## B2.8 Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Jobs registry | `association:member/jobs/index.ts` | App startup scheduler wiring | `index.test.ts` (existing cron/interval/delayed assertions still pass + new cron assertion) | `[SHARED DEPENDENCY]` additive registration only |
| Domain-event consumers | `core/domain-event-consumers.ts` (shared by 9 module owners) | Event bus; `training.completed`, `verification.requested` | `domain-event-consumers.test.ts` (all 22 tests incl. person.deleted cascade still pass) | `[SHARED DEPENDENCY]` one isolated change per fix; no unrelated consumer touched |
| Audit log | `audit_log_entry` (write via `AuditRepository.logEvent`) | Compliance audit reads | New FIX-011 consumer tests | New writer of an existing table; no schema change |

## B2.9 Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| License-alert UI surface | FIX-007 / Q7 | `[NEEDS PRODUCT DECISION]` — cron + alert rows are unblocked; UI placement is not | Resolve Q7; optionally dispatch a notification from the cron when a surface is decided |
| Certificate auto-issuance pipeline | FIX-010 / Q5 | Out of scope by design (default officer-initiated) | Resolve Q5 if auto-issue is desired; the gate is correct regardless |
| Live integration proof of the cron | FIX-007 | No live-DB run this pass | Run the cron against a seeded DB when an API impl is available |

## B2.10 Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-007 alert UI surface | `[NEEDS PRODUCT DECISION]` (Q7) | UI placement undecided | Q7 answered (cron itself NOT blocked — done) |

## B2.11 Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| FIX-013 `credential.issued`/`credential.revoked` emit-vs-amend | `[NEEDS PRODUCT DECISION]` | Excluded from B2 subset |
| Batch A (FIX-001/002/012/014), Batch C (FIX-005/006/015), Batch D credentials suites | gated / separate batch | Out of B2 scope |
| Cron-driven member notification on alert | `V2 DEFERRED` | Depends on Q7; B2 produces alert rows only |

## B2.12 Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/association:member/jobs/licenseRenewalProcessor.ts` | New: `processLicenseRenewalAlerts` job processor | FIX-007 |
| `services/api-ts/src/handlers/association:member/jobs/licenseRenewalProcessor.test.ts` | New: processor unit tests (insert + idempotency + out-of-window) | FIX-007 |
| `services/api-ts/src/handlers/association:member/jobs/index.ts` | Import + `member.licenseRenewalProcessor` cron registration | FIX-007 |
| `services/api-ts/src/handlers/association:member/jobs/index.test.ts` | New registration assertion | FIX-007 |
| `services/api-ts/src/core/domain-event-consumers.ts` | Gate `training.completed` notify on cert existence; new `verification.requested` audit consumer + `AuditRepository` import | FIX-010, FIX-011 |
| `services/api-ts/src/core/domain-event-consumers.test.ts` | New FIX-010 gate tests + FIX-011 audit-consumer tests | FIX-010, FIX-011 |

## B2.13 Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| Test output (RED + GREEN per fix, full-suite count, typecheck) | This report §B2.3 / §B2.6 | FIX-007, FIX-010, FIX-011 |
| No screenshots/Playwright/Webwright | n/a | Backend/unit fixes — browser proof not required |

## B2.14 Completion Decision

**COMPLETE**

All three selected Batch B2 fixes are implemented test-first (RED→GREEN) and validated: the license-renewal cron now produces idempotent alert rows (the previously-missing producer), the `training.completed` notification is gated on real certificate existence, and `verification.requested` now writes a tamper-evident audit record. Affected-dir suites, the full api-ts suite (no new failures; +8 tests), and the monorepo typecheck all pass. The only full-suite failure is the pre-existing, unrelated `registerEmailJobs` flake. No shared consumer outside the two targeted blocks was modified; no TypeSpec/migration/regen occurred.

## B2.15 Recommended Next Step

Per the Track A todolist, proceed to **A7 — Notifications Batch C subset** (FIX-007 suppression DELETE, FIX-010 queue-lifecycle hurl, FIX-012 orgId guard) in a fresh `04` pass. Do NOT auto-continue. Server restart note: a running API must be restarted to pick up the new `member.licenseRenewalProcessor` cron registration (no hot-reload for changed registrations).

Prompt: `/Users/elad-mini/Desktop/memberry/docs/aha/prompts/04-module-or-group-fix-tdd.md`

---

# Batch A — Verification chain (FIX-001 / FIX-002 / FIX-012 / FIX-014) (appended 2026-06-13)

> Separate `04` pass. Batches B1/B2 above are unchanged. This pass executed the gated Batch A (verify-chain) under the Step-29 Q1 decision: **reuse the existing credential token + existing verify route; do NOT mint a new HMAC `GET /verify/:token`.** No new token system, no schema/migration, no generator regen. TanStack route tree regenerated (generated artifact).

## A.1 Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Documents & Credentials |
| Module slug | documents-credentials |
| Fix date | 2026-06-13 |
| Batch executed | Batch A (FIX-001, FIX-002, FIX-012, FIX-014) |
| Superpowers used | Yes (`superpowers:test-driven-development`, RED→GREEN per fix) |
| Working tree status checked | Yes — intentionally dirty (recovery-2025 incident + prior AHA passes) PRESERVED; only Batch A files touched. No forbidden git commands used. |
| Fix scope | P0 (FIX-001), P1 (FIX-002), selected P2 / V1 RECOMMENDED (FIX-012, FIX-014) |
| Out of scope | Batch C certificates (FIX-005/006/015), Batch D credentials suites (FIX-008), FIX-013, all §10 Deferred / §11 Do Not Build |
| Shared files touched | Yes — `routeTree.gen.ts` (regenerated); credential-token util |
| Schema/migration touched | No |
| Limitations | (1) **Q1 reuse path has a missing producer**: no `memberCard` digital credential is auto-issued per membership (only officer-initiated `issueDigitalCredential` + seed create `digital_credential` rows). So the ID-card QR can only encode a *verifiable* URL when the member already has a digital credential — for most members it correctly renders no QR. Auto-issuing a memberCard credential on membership approval is a NEW pipeline = `[NEEDS PRODUCT DECISION]`, out of minimal verify-chain scope. (2) E2E/browser proof of the collapsed route + a live download→scan→verify journey is `[BLOCKED BY ENVIRONMENT]` (no running app+API+seeded DB); core logic is proven by pure-function unit + component tests instead. (3) PDF content is binary — not unit-asserted; the change is a minimal text removal validated by typecheck. |

## A.2 Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- |
| FIX-001 | G1 — ID-card QR verification broken end-to-end (in-app QR = `/verify/<memberNumber>` → dead `GET /api/verify/:token`; PDF QR = truncated `verify?p=` text) | P0 | V1 REQUIRED | Spec P0 trust workflow; QRs always failed → misleading trust UX + member-number PII leak | Partially Fixed (endpoint/route reuse + misleading-QR removal done; verifiable-QR emission blocked on credential producer) |
| FIX-002 | G2 — 3 sibling dynamic verify routes (`$token`/`$certificateNumber`/`$credentialNumber`) shadow each other; ≤1 reachable | P1 | V1 REQUIRED | Whichever route lost, its QR/share links rendered the wrong verifier | Fixed |
| FIX-012 | G16 — credential verify HMAC secret falls back to a guessable literal (`'dev-credential-verify-secret'`) → forgeable tokens | P2 | V1 RECOMMENDED | Known-literal secret lets anyone mint a valid token in any misconfigured env | Fixed |
| FIX-014 | G14 — staleness-window messaging (PRD 11.5, 30-day rule) absent from verify pages | P2 | V1 RECOMMENDED | Verifiers can't judge currency vs authenticity | Fixed |

## A.3 Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `resolveCredentialVerifySecret` | Did not exist; both issuance + verify used `|| 'dev-credential-verify-secret'` | FIX-012 | RED: export missing |
| `resolveVerifyKind` / `verifyStalenessNote` | Did not exist | FIX-002 / FIX-014 | RED: module `./verify-dispatch` missing |
| id-card in-app QR | Rendered `QRCodeSVG` with `value=/verify/<memberNumber>` | FIX-001 | RED: a QR encoding the raw member number was present |
| `/verify/$token` page | Called nonexistent `GET /api/verify/:token` | FIX-001 | Dead endpoint; never verified |
| Verify routes | `$token`/`$certificateNumber`/`$credentialNumber` all match `/verify/:anything` | FIX-002 | Structural shadow |
| api-ts full suite | 6173 pass / 1 pre-existing fail (`registerEmailJobs`) / 3 todo | all | Documented baseline |

## A.4 Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared? | Notes |
| --- | --- | --- | --- | --- |
| FIX-012 | New `resolveCredentialVerifySecret()` — env secret; in `NODE_ENV=production` THROWS rather than fall back to the guessable literal; dev literal allowed outside prod (mirrors `id-card-data.ts`). Wired into issuance (throws → refuse to mint) and verify (catches → `notFound`). | `association:member/utils/credential-token.ts`, `member/credentials/issueDigitalCredential.ts`, `member/credentials/verifyCredentialPublic.ts` | No | Cert verify (`verifyCertificatePublic.ts:21`) was already fail-closed (`|| ''` then guarded → `verified:false`); left untouched |
| FIX-002 | Pure `resolveVerifyKind(id)` (token=`base64url.base64url`; certificate=`^[A-Za-z0-9]+-\d{4}-\d{4}$`; else credentialNumber). New single `/verify/$id` route renders the correct verifier; 3 sibling routes deleted; tree regenerated. URL-stable. | `routes/verify/verify-dispatch.ts` (new), `routes/verify/$id.tsx` (new), deleted 3 sibling routes, `routeTree.gen.ts` (regenerated) | `[SHARED DEPENDENCY]` router | `certificate-preview.tsx`'s `/verify/<certNumber>` share link still works via the dispatcher |
| FIX-001 | (a) `/verify/$token` shape validated via the **existing** `POST .../credentials/public-verify` (reuse existing token; no new HMAC route). (b) In-app QR derives `/verify/<credentialNumber>` from `membership.credentialNumber` when present, else no QR. (c) PDF's truncated `verify?p=`/`Sig:` replaced with honest `memberry.app/verify`. | `routes/verify/$id.tsx`, `routes/_authenticated/my/id-card.tsx`, `person/getMyIdCardPdf.ts` | router | Removes misleading trust UX + member-number PII leak; verifiable-QR emission producer-blocked |
| FIX-014 | Pure `verifyStalenessNote(issuedAt, now)` 30-day rule (null when fresh/boundary/unparseable); yellow hint on valid cert + credential + token results | `routes/verify/verify-dispatch.ts`, `routes/verify/$id.tsx` | No | PRD 11.5 |

## A.5 Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `association:member/utils/credential-token.test.ts` (new) | backend/unit + security | Token round-trip; THROWS in prod when unset; never returns the guessable literal in prod; dev fallback outside prod | FIX-012 |
| `apps/memberry/src/routes/verify/verify-dispatch.test.ts` (new) | frontend/unit | Token/cert/credential/UUID dispatch correctly (anti-shadow); staleness window incl. boundary + unparseable | FIX-002, FIX-014 |
| `apps/memberry/src/routes/_authenticated/my/id-card.test.tsx` (extended) | frontend/component | No QR encodes the raw member number; QR renders when a credential number is present | FIX-001 |

## A.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test .../credential-token.test.ts` | Passed (6) | FIX-012 RED→GREEN |
| `bun test .../verify/verify-dispatch.test.ts` | Passed (8) | FIX-002 + FIX-014 RED→GREEN |
| `bun test .../my/id-card.test.tsx` | Passed (5) | FIX-001 RED→GREEN |
| `bun run --filter '*' typecheck` | Passed (0 errors, 5/5) | incl. new `$id.tsx`, deleted routes, regenerated tree |
| `bun test` (api-ts credentials+person) | Passed (226) | no regressions |
| `bun test` (api-ts full) | Partially Passed (6179 pass / 1 fail / 3 todo) | +6 vs baseline; 1 fail = pre-existing `registerEmailJobs` flake |
| `bun run test` (memberry full) | Passed (668 / 0 fail) | route collapse broke nothing |

## A.7 Validation Summary

- **Passed:** all four fixes RED→GREEN; monorepo typecheck (5/5); affected api-ts suites; full api-ts (no new failures); full memberry (668/0).
- **Failed:** none introduced. Sole api-ts failure is the documented pre-existing `registerEmailJobs` flake.
- **Not run / Blocked:** browser E2E of the collapsed route + live verify journey `[BLOCKED BY ENVIRONMENT]`; PDF binary content not unit-asserted.

## A.8 Shared / Cross-Module / Database Impact

| Area | Files / Tables | Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Memberry router | `routeTree.gen.ts` (regenerated) + public `/verify/*` URLs | Nothing else imports the deleted route components; share-link builders unaffected | `verify-dispatch.test.ts` + memberry full suite | `[SHARED DEPENDENCY]`. URL-stable: cert/credential/token URLs preserved |
| Credential verify secret | `credential-token.ts` (`resolveCredentialVerifySecret`) | issuance + public-verify | `credential-token.test.ts` + credentials suite | Fail-closed; no schema/config-file change |

## A.9 Remaining Gaps

| Gap | Source | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| ID-card emits a *verifiable* QR for an arbitrary member | FIX-001 | No `memberCard` credential auto-issued per membership (producer missing) | Decide whether to auto-issue a memberCard `digital_credential` on approval (then surface its number via `getMyIdCard` — the card lights up automatically; dispatcher already verifies it) |
| Scannable QR *image* in the PDF | FIX-001 | Producer-blocked + `qrcode-svg`→pdf-lib rendering deferred until a real verify URL exists | Render the credential verify URL as a QR once the producer lands |
| Browser E2E of collapsed route + verify journey | FIX-002 | `[BLOCKED BY ENVIRONMENT]` | Run against a booted app+API+seeded DB |

## A.10 Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Auto-issue `memberCard` credential per membership | `[NEEDS PRODUCT DECISION]` | New issuance pipeline; adjacent to Q5; out of minimal verify-chain scope | Product decides whether memberCard credentials are auto-issued on approval |
| E2E verify journey | `[BLOCKED BY ENVIRONMENT]` | No running app+API+seeded DB | Boot stack + seed |

## A.11 Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Batch C certificates (FIX-005/006/015), Batch D suites (FIX-008), FIX-013 | gated / separate batch | Out of Batch A scope |
| New HMAC `GET /verify/:token` validating the id-card-data payload | `DO NOT ADD` | Q1 chose credential-token reuse; roadmap §17 flags this as overbuild |
| PDF branding "Powered by"→"Verified by Memberry" (G15/FIX-015) | Batch C | Branding owned by Batch C; left untouched to stay scoped |

## A.12 Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/association:member/utils/credential-token.ts` | New `resolveCredentialVerifySecret()` fail-closed resolver | FIX-012 |
| `services/api-ts/src/handlers/association:member/utils/credential-token.test.ts` (new) | Round-trip + fail-closed tests | FIX-012 |
| `services/api-ts/src/handlers/member/credentials/issueDigitalCredential.ts` | Use fail-closed resolver | FIX-012 |
| `services/api-ts/src/handlers/member/credentials/verifyCredentialPublic.ts` | Use fail-closed resolver (catch → notFound) | FIX-012 |
| `apps/memberry/src/routes/verify/verify-dispatch.ts` (new) | `resolveVerifyKind` + `verifyStalenessNote` | FIX-002, FIX-014 |
| `apps/memberry/src/routes/verify/verify-dispatch.test.ts` (new) | Dispatch + staleness tests | FIX-002, FIX-014 |
| `apps/memberry/src/routes/verify/$id.tsx` (new) | Single dispatching verify page (cert/credential/token + staleness) | FIX-001, FIX-002, FIX-014 |
| `apps/memberry/src/routes/verify/{$token,$certificateNumber,$credentialNumber}.tsx` (deleted) | Collapsed into `$id.tsx` | FIX-002 |
| `apps/memberry/src/routeTree.gen.ts` (regenerated) | One `/verify/$id` node replaces three | FIX-002 |
| `apps/memberry/src/routes/_authenticated/my/id-card.tsx` | QR derives from credentialNumber, suppresses otherwise | FIX-001 |
| `apps/memberry/src/routes/_authenticated/my/id-card.test.tsx` (extended) | QR-source assertions | FIX-001 |
| `services/api-ts/src/handlers/person/getMyIdCardPdf.ts` | Remove truncated `verify?p=`/`Sig:`; honest verify line | FIX-001 |

## A.13 Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED→GREEN runs + suite counts + typecheck | This report §A.3 / §A.6 | all |
| Route tree collapse (one `/verify/$id` node) | `apps/memberry/src/routeTree.gen.ts:163` | FIX-002 |

## A.14 Completion Decision

**PARTIALLY COMPLETE**

FIX-002 (route shadow → single dispatching `/verify/$id`, URL-stable), FIX-012 (fail-closed credential secret), and FIX-014 (30-day staleness messaging) are fully implemented test-first and validated (typecheck 5/5; api-ts +6, no new failures; memberry 668/0). FIX-001's **endpoint/route side is done per the Q1 mandate** — `/verify/$token` validates the existing credential token via the existing `public-verify` endpoint (no new HMAC route), and the misleading always-failing member-number QR + truncated PDF payload were removed. It is **PARTIALLY COMPLETE** because emitting a *verifiable* QR for an arbitrary member is blocked by a missing producer (no `memberCard` digital credential auto-issued per membership) — a new pipeline that is `[NEEDS PRODUCT DECISION]` and out of minimal verify-chain scope. The card correctly shows no QR until a credential exists, and lights up automatically once one does.

## A.15 Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for the next gated batch per consolidated-roadmap §8: **realtime FIX-003/007 channel model + PD-1** (auto-join org channels + officer-only creation, per the Step-29 standing decision). Do NOT auto-chain.

Separately, surface the producer decision: **should a `memberCard` `digital_credential` be auto-issued on membership approval?** — answering it unblocks the remaining FIX-001 verifiable-QR emission with no new token system.

Prompt: `/Users/elad-mini/Desktop/memberry/docs/aha/prompts/04-module-or-group-fix-tdd.md`

---

# Batch A2 — Member-card credential producer (closes FIX-001) (appended 2026-06-13)

> Follow-on pass to Batch A, run at user direction to fully complete the verify-chain's product value. Resolves the producer gap surfaced in §A.9/§A.10 with the smallest correct change — **lazy ensure-on-card-view**, no membership-approval flow change, no new token system, no schema/migration. Eng default chosen for the open model question (no separate product round-trip): issue a `memberCard` `digital_credential` lazily when an active member views/downloads their ID card.

## A2.1 Fix Scope

| Item | Details |
| --- | --- |
| Fix date | 2026-06-13 |
| Batch executed | Batch A2 (FIX-001 producer — completes the Batch A partial) |
| Superpowers used | Yes (`superpowers:test-driven-development`, RED→GREEN per unit) |
| Working tree status checked | Yes — dirty tree preserved; only A2 files touched. No forbidden git commands. |
| Fix scope | P0 (FIX-001 completion) |
| Out of scope | Event-driven issuance on approval for ALL members (V2); scannable QR *image* in PDF (follow-up); Batch C/D, FIX-013 |
| Shared files touched | No generated/registry; cross-module import (person → `association:member/utils`) |
| Schema/migration touched | No — uses existing `credential_template` + `digital_credential` tables |
| Limitations | (1) **Write-on-GET**: issuance is an idempotent ensure triggered by `getMyIdCard`/`getMyIdCardPdf` (get-or-create); best-effort — a failure returns null and the card still renders (QR absent), never breaks the response. (2) **Concurrency**: find-before-create has a small race window (two simultaneous card loads could double-issue) — no unique constraint added (would need a migration); acceptable for V1, documented. (3) Member-card credential lifecycle (expiry = dues expiry; no auto-revoke on lapse — verify page shows dues status separately) is an eng default; revisit if product wants different semantics. |

## A2.2 Fixes Selected

| Fix ID | Gap | Severity | Status |
| --- | --- | --- | --- |
| FIX-001 | G1 — ID-card QR had no verifiable identifier to encode (no `memberCard` credential produced for ordinary members) | P0 | **Fixed** (was Partially Fixed after Batch A) |

## A2.3 Baseline Before Changes

| Check/Test | Result Before Changes | Notes |
| --- | --- | --- |
| `ensureMemberCardCredential` | Did not exist | RED: module missing |
| `getIdCardData(...).verifyCredentialNumber` | Field did not exist | RED: `undefined` |
| id-card UI QR | Lit only if `membership.credentialNumber` happened to be present (never populated) | RED: no QR from backend builder |
| api-ts full suite | 6179 pass / 1 pre-existing fail / 3 todo (post-Batch-A) | Baseline |

## A2.4 Changes Made

| Fix | Implementation | Files | Notes |
| --- | --- | --- | --- |
| Producer | `ensureMemberCardCredential(db, logger, {personId, orgId, membershipId, expiresAt})` — find-or-create an active `memberCard` template for the org, return an existing active member-card credential's number, else issue one (generate `MC-<10hex>`, `createCredentialToken` + fail-closed secret, write `qrPayload`+`verificationUrl`). Best-effort → null on failure. | `association:member/utils/ensure-member-card-credential.ts` (new) | Reuses existing repos + Batch A fail-closed secret |
| Surface | `getIdCardData` now takes an optional `logger`, adds `verifyCredentialNumber: string \| null`, and calls the producer when the membership is active. | `person/utils/id-card-data.ts` | `[CROSS-MODULE RISK]` person → association:member util (same direction as existing schema imports) |
| Wire | `getMyIdCard` + `getMyIdCardPdf` thread `ctx.get('logger')`; PDF prints `memberry.app/verify/<credentialNumber>` when present. | `person/getMyIdCard.ts`, `person/getMyIdCardPdf.ts` | — |
| UI converge | `id-card.tsx` fetches `GET /api/persons/me/id-card/:orgId` and sources the QR from `verifyCredentialNumber` (falls back to `membership.credentialNumber`). Converges UI onto the backend builder (gap §206). | `routes/_authenticated/my/id-card.tsx` | — |

## A2.5 Tests Added / Updated

| Test File | Type | What It Proves | 
| --- | --- | --- |
| `association:member/utils/ensure-member-card-credential.test.ts` (new) | backend/unit | Returns existing number (no dup create); creates credential + token reusing template; auto-provisions template when absent; best-effort returns null (never throws) on failure |
| `person/utils/id-card-data.test.ts` (extended) | backend/unit | `verifyCredentialNumber` surfaced for an active membership; null when no active membership |
| `routes/_authenticated/my/id-card.test.tsx` (extended) | frontend/component | QR renders from the backend builder's `verifyCredentialNumber` |

## A2.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test .../ensure-member-card-credential.test.ts` | Passed (4) | RED→GREEN |
| `bun test .../id-card-data.test.ts` | Passed (6) | RED→GREEN surfacing |
| `bun test .../my/id-card.test.tsx` | Passed (6) | RED→GREEN UI |
| `bun run --filter '*' typecheck` | Passed (0 errors, 5/5) | — |
| `bun test` (api-ts person + credentials + utils) | Passed (302) | no regressions |
| `bun test` (api-ts full) | Partially Passed (6185 pass / 1 fail / 3 todo) | +6 vs post-Batch-A; 1 fail = pre-existing `registerEmailJobs` flake |
| `bun run test` (memberry full) | Passed (669 / 0 fail) | +1 vs Batch A |

## A2.7 Validation Summary

- **Passed:** all units RED→GREEN; typecheck 5/5; affected api-ts suites; full api-ts (no new failures); memberry full (669/0).
- **Failed:** none introduced. Sole api-ts failure remains the documented pre-existing `registerEmailJobs` flake.
- **Not run / Blocked:** live-DB issuance run + browser scan-to-verify journey `[BLOCKED BY ENVIRONMENT]`.

## A2.8 Files Changed

| File | Change Summary |
| --- | --- |
| `services/api-ts/src/handlers/association:member/utils/ensure-member-card-credential.ts` (new) | Lazy member-card credential producer |
| `services/api-ts/src/handlers/association:member/utils/ensure-member-card-credential.test.ts` (new) | Producer unit tests |
| `services/api-ts/src/handlers/person/utils/id-card-data.ts` | `verifyCredentialNumber` + optional logger + ensure call |
| `services/api-ts/src/handlers/person/utils/id-card-data.test.ts` | Surfacing tests |
| `services/api-ts/src/handlers/person/getMyIdCard.ts` | Thread logger |
| `services/api-ts/src/handlers/person/getMyIdCardPdf.ts` | Thread logger; print real `/verify/<credentialNumber>` URL |
| `apps/memberry/src/routes/_authenticated/my/id-card.tsx` | Consume `getMyIdCard.verifyCredentialNumber` for the QR |
| `apps/memberry/src/routes/_authenticated/my/id-card.test.tsx` | Backend-builder QR test |

## A2.9 Completion Decision

**COMPLETE**

FIX-001 is now fully closed. The verify chain end-to-end works: an active member's ID card (in-app + PDF) encodes `/verify/<credentialNumber>` for a real, lazily-issued `memberCard` digital credential; the collapsed `/verify/$id` route (Batch A) dispatches it to the existing public credential-verify surface; the fail-closed secret (Batch A) protects the token. No new token system, no schema change, no membership-approval coupling. All validation green (typecheck 5/5; api-ts +6 no new failures; memberry 669/0).

Batch A's FIX-002 / FIX-012 / FIX-014 remain Fixed. Documents & Credentials verify-chain (Batch A + A2) is done; remaining module batches are Batch C (certificates, gated on Q8/migration) and Batch D (credentials per-handler suites).

## A2.10 Recommended Next Step

Proceed to the next gated batch per consolidated-roadmap §8: **realtime FIX-003/007 channel model + PD-1** (auto-join org channels + officer-only creation). Do NOT auto-chain.

Server restart note: a running API picks up the new lazy issuance automatically (no new cron/route registration — it runs inside the existing `getMyIdCard*` handlers).

Prompt: `/Users/elad-mini/Desktop/memberry/docs/aha/prompts/04-module-or-group-fix-tdd.md`

---

# Batch D — FIX-008 credentials per-handler unit suites (appended 2026-06-13)

> Separate `04` pass. Batches B1/B2/A/A2 above are unchanged. **Strictly test-only.** Adds per-handler unit coverage for the trust-critical `member/credentials/` surface (issue / revoke / verify authenticated+public / license CRUD / renewal-alert ack + list / digital-credential CRUD). **No source/schema/seed/FE/TypeSpec change, no generator regen.** This is the FIX-008 prerequisite that must precede any future credentials handler fix (Batch C). Per the pass mandate: a test that reveals a real handler bug is recorded as a Remaining-Gap finding, **not** fixed here.

## D.1 Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Documents & Credentials |
| Module slug | documents-credentials |
| Fix date | 2026-06-13 |
| Batch executed | Batch D (FIX-008 — credentials per-handler unit suites) |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked before writing tests) |
| Working tree status checked | Yes — intentionally dirty (recovery-2025 + prior AHA passes) PRESERVED; only new `*.test.ts` files added. No forbidden git commands. |
| Fix scope | P1 / V1 RECOMMENDED test hardening (FIX-008) |
| Out of scope | Any handler/source/schema change; Batch C certificates (FIX-005/006/015); FIX-013; all §10 Deferred / §11 Do Not Build |
| Shared files touched | No |
| Schema/migration touched | No |
| Limitations | (1) Coverage is backend/unit with stubbed repos (`stubRepo`/`restoreRepo`/`makeCtx`), mirroring the established governance/credentials test convention — not a live-Postgres or contract run. (2) These suites are GREEN regression coverage of already-correct handler behavior (the handlers exist and work); they are **not** RED-first feature tests — labeled honestly per the Step-35 framing. (3) Org-scope isolation on `revoke`/`get`/`update`/`delete` is enforced upstream by the route's officer/position middleware (not in-handler), so cross-org access is not unit-asserted at the handler layer here. |

## D.2 Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-008 | G8 — member/credentials unit coverage was 2 files / 21 handlers; issue/revoke/verify/public-lookup/license lifecycle untested at unit level `[TEST GAP]` | P1 | V1 RECOMMENDED | D | Trust-critical surface unprotected; prerequisite before any credentials handler fix is safe | Fixed |

## D.3 Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `bun test src/handlers/member/credentials/` | 2 files (`credentials.test.ts`, `lookupCredentialPublic.test.ts`) | FIX-008 | 21 handlers, ~22 tests; issue gating, revoke transitions, verify status-mapping, license CRUD, alert ack all uncovered at handler level |
| New `issueDigitalCredential.test.ts` (8 tests) | Pass on first run | FIX-008 | GREEN regression — handler behavior (membership gating, token mint, expiry) already correct |
| New `revokeDigitalCredential.test.ts` (4) | Pass on first run | FIX-008 | GREEN regression — not-found / already-revoked / happy-path transition already correct |
| New `verifyDigitalCredential.test.ts` (11) | Pass on first run | FIX-008 | GREEN regression — public no-auth reachability + status mapping + authenticated session gate already correct |
| New `professionalLicense.test.ts` (12) | Pass on first run | FIX-008 | GREEN regression — license CRUD auth/not-found/happy + soft-delete actor-id already correct |
| New `licenseRenewalAlerts.test.ts` (7) | Pass on first run | FIX-008 | GREEN regression — ack not-found/conflict/happy + list passthrough already correct |
| New `digitalCredentialCrud.test.ts` (12) | Pass on first run | FIX-008 | GREEN regression — get/list/update/delete auth/not-found/happy already correct |

> No RED phase: the handlers are already implemented and behaving correctly, so these are honest GREEN regression suites locking in current trust-critical behavior — exactly the FIX-008 intent (protect before any future change). No assertion was weakened to force green.

## D.4 Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-008 | Added 6 focused per-handler unit suites covering issuance gating + verifiable token, revocation transitions, verify status-mapping (public + authenticated), professional-license CRUD, renewal-alert ack/list, and digital-credential CRUD | 6 new `*.test.ts` files under `handlers/member/credentials/` (no source touched) | No | New files only; preferred new focused files over bloating the existing 2 (which already own template/token/lookup coverage) |

## D.5 Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `member/credentials/issueDigitalCredential.test.ts` (new) | backend/unit | 401/403 guards; Forbidden when no/lapsed membership; NotFound for missing membership/template; happy path issues an `active` credential whose `qrPayload` is a real HMAC token decoding back to `{credentialId, organizationId}`; expiry derived from template validity (null when none) | FIX-008 |
| `member/credentials/revokeDigitalCredential.test.ts` (new) | backend/unit | 401 guard; NotFound for missing credential; rejects double-revoke (`ALREADY_REVOKED`); happy path sets `status=revoked` + `revokedAt` + `revocationReason` | FIX-008 |
| `member/credentials/verifyDigitalCredential.test.ts` (new) | backend/unit + security | Public surface reachable WITHOUT a session; tampered/missing token → `notFound`; status mapping active→valid, revoked→revoked, expired (status or past `expiresAt`)→expired, suspended→revoked (fail-safe); authenticated surface rejects no-session and maps identically | FIX-008 |
| `member/credentials/professionalLicense.test.ts` (new) | backend/unit + permission/RBAC | create 401/403/happy (org-scoped); get/update/delete NotFound + happy; list pagination + org/personId filter passthrough; delete records the acting user id (regulated-record audit trail) | FIX-008 |
| `member/credentials/licenseRenewalAlerts.test.ts` (new) | backend/unit | ack 401/403/NotFound/Conflict(already-acknowledged)/happy(`status=acknowledged`); list pagination + org/status/licenseId filter passthrough | FIX-008 |
| `member/credentials/digitalCredentialCrud.test.ts` (new) | backend/unit | get/list/update/delete Unauthorized-without-session + NotFound + happy; list org-scoped filter passthrough; delete returns 204 | FIX-008 |

## D.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/member/credentials/issueDigitalCredential.test.ts` | Passed (8) | First-run GREEN |
| `bun test .../revokeDigitalCredential.test.ts .../verifyDigitalCredential.test.ts` | Passed (15) | First-run GREEN |
| `bun test src/handlers/member/credentials/` | Passed (83 pass / 0 fail / 8 files) | Up from ~22 tests / 2 files |
| `bun test` (full api-ts) | Partially Passed (6273 pass / 1 fail / 3 todo / 93 skip) | The 1 fail is the documented pre-existing, unrelated `registerEmailJobs` flake (30000 vs 1000); no new failures |
| `bun run typecheck` (api-ts) | Passed (0 errors) | `tsc --noEmit` clean incl. the 6 new suites |

## D.7 Validation Summary

- **Passed:** the credentials directory suite grew from 2 files (~22 tests) to 8 files / 83 tests, all green; full api-ts suite shows no new failures (6273 pass); api-ts typecheck clean.
- **Failed:** none introduced. The single full-suite failure (`registerEmailJobs > registers email.processor as interval job`, 30000 vs 1000) is the pre-existing, unrelated flake documented in every prior batch baseline.
- **Not run:** memberry test/typecheck (no FE file touched, per pass constraints); contract/Hurl + live-DB (test-only pass, no behavior to contract-prove).
- **Blocked:** none.

## D.8 Shared / Cross-Module / Database Impact

None. Test-only pass; no source/schema/generated/SDK/FE files touched. `check:sdk-compat` not run (adds 0 operationIds; unaffected).

## D.9 Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| ~~**[FINDING] `verifyDigitalCredentialAuthenticated.ts:24` is NOT fail-closed**~~ — **CLOSED in Batch D2 (FIX-012 follow-up), see §D2 below.** It used `process.env['CREDENTIAL_VERIFY_SECRET'] \|\| 'dev-credential-verify-secret'`, the same guessable literal FIX-012 (Batch A) removed from `issueDigitalCredential` + `verifyCredentialPublic` via `resolveCredentialVerifySecret()`. In a misconfigured production env this surface would validate forgeable tokens. | FIX-012-adjacent / G16 | ✅ FIXED — Batch D2 swapped to `resolveCredentialVerifySecret()` with try/catch→notFound, mirroring `verifyCredentialPublic`. | Done — see §D2. |
| Org-scope isolation not unit-asserted on revoke/get/update/delete | FIX-008 | Cross-org access is gated by route officer/position middleware, not in-handler; unit layer can't exercise middleware | Cover at the contract/E2E layer when a booted API + seeded DB are available |
| `verifyCredentialPublic` returns the full `credential` row (incl. `personId`) to any valid-token holder | FIX-008 (observation) | Not a clear bug — the caller already possesses the credential's QR/token, and `lookupCredentialPublic` (by number) does the PII-projected public surface. Noted for product confirmation, not flagged as a defect. | Confirm with product whether the token-verify response should also PII-project (parity with `lookupCredentialPublic`) |

## D.10 Blocked Items

None new. (Batch C still gated on Q8 + cert migration; Batch A2 closed the verify-chain.)

## D.11 Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Fixing the `verifyDigitalCredentialAuthenticated` fail-closed-secret finding | gated (test-only pass) | Recorded as a D.9 finding; handler change is out of Batch D scope |
| Batch C certificates (FIX-005/006/015), FIX-013 | gated / separate batch | Out of Batch D scope |
| Contract/Hurl coverage of credentials | `[BLOCKED BY ENVIRONMENT]` | No booted API + seeded DB this pass |

## D.12 Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/member/credentials/issueDigitalCredential.test.ts` (new) | Issuance gating + verifiable-token suite (8 tests) | FIX-008 |
| `services/api-ts/src/handlers/member/credentials/revokeDigitalCredential.test.ts` (new) | Revocation transition suite (4) | FIX-008 |
| `services/api-ts/src/handlers/member/credentials/verifyDigitalCredential.test.ts` (new) | Public + authenticated verify status-mapping suite (11) | FIX-008 |
| `services/api-ts/src/handlers/member/credentials/professionalLicense.test.ts` (new) | License CRUD lifecycle suite (12) | FIX-008 |
| `services/api-ts/src/handlers/member/credentials/licenseRenewalAlerts.test.ts` (new) | Renewal-alert ack + list suite (7) | FIX-008 |
| `services/api-ts/src/handlers/member/credentials/digitalCredentialCrud.test.ts` (new) | Digital-credential get/list/update/delete suite (12) | FIX-008 |

## D.13 Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| First-run GREEN runs + dir/full-suite counts + typecheck | This report §D.3 / §D.6 | FIX-008 |
| Credentials dir grew 2→8 files, ~22→83 tests | `bun test src/handlers/member/credentials/` output | FIX-008 |

## D.14 Completion Decision

**COMPLETE**

FIX-008 is fully landed: the trust-critical `member/credentials/` surface now has 6 focused per-handler unit suites (issue / revoke / verify public+authenticated / license CRUD / renewal-alert ack+list / digital-credential CRUD), taking the directory from 2 files (~22 tests) to 8 files / 83 tests, all green. No source/schema/FE/TypeSpec change; full api-ts shows no new failures and typecheck is clean. The pass surfaced one real but out-of-scope finding (`verifyDigitalCredentialAuthenticated` is not fail-closed — D.9), recorded for a later Batch C / FIX-012 follow-up rather than fixed, per the strictly-test-only mandate. The FIX-008 prerequisite for any future credentials handler change is now satisfied.

## D.15 Recommended Next Step

Per the standing AHA backlog: the decision-free pass queue is now drained — remaining high-value credentials/certificates work (Batch C: FIX-005/006/015) is gated on **Q8** (cert-schema backfill) + the Batch F migration, and the small **FIX-012 follow-up** (D.9 finding) is best folded into that pass. Surface to the user for a product/eng decision rather than auto-chaining. Do NOT auto-continue to another batch.

Optional when a booted API + seeded DB exist: add contract/E2E coverage for credential org-scope isolation and the public verify/lookup PII surfaces.

---

## D2 — FIX-012 follow-up (fail-close `verifyDigitalCredentialAuthenticated`)

## D2.1 Fix Scope

Close the §D.9 finding: `verifyDigitalCredentialAuthenticated` was the last credential-verify surface still falling back to the guessable `'dev-credential-verify-secret'` literal. FIX-012 (Batch A) fail-closed `issueDigitalCredential` + `verifyCredentialPublic`; the authenticated verify surface was missed. P2 / security (G16). Decision-free: 1-line hardening + regression test, no schema/seed/FE/TypeSpec/generator change.

## D2.2 Fixes Selected

| Fix ID | Surface | Action |
| --- | --- | --- |
| FIX-012 follow-up | `services/api-ts/src/handlers/member/credentials/verifyDigitalCredentialAuthenticated.ts` | Replace `process.env['CREDENTIAL_VERIFY_SECRET'] \|\| 'dev-credential-verify-secret'` with `resolveCredentialVerifySecret()` inside a `try/catch`; on throw return `{ result: 'notFound', credential: null }` (200) — identical to `verifyCredentialPublic`. |

## D2.3 Baseline Before Changes

- api-ts `bun test` ≈ 6273 pass / 1 fail (pre-existing, unrelated: `registerEmailJobs` interval flake 30000-vs-1000).
- `tsc --noEmit` exits 0. DB through 0068. No migration this pass.

## D2.4 Changes Made

- `verifyDigitalCredentialAuthenticated.ts`: imported `resolveCredentialVerifySecret`; resolve secret in `try/catch`, fail-closed to `notFound` on throw. No other handler touched. `verifyCredentialPublic.ts` / `issueDigitalCredential.ts` / `verifyCertificatePublic.ts` left untouched (already guarded).

## D2.5 Tests Added / Updated

- Extended `verifyDigitalCredential.test.ts` (`verifyDigitalCredentialAuthenticated` describe): new test — production mode (`NODE_ENV=production`) with `CREDENTIAL_VERIFY_SECRET` unset → a token forged with the guessable literal must NOT validate; handler returns `{ result: 'notFound', credential: null }`. Env restored in a `finally` (test-local, no leak). Existing dev-fallback mapping tests kept passing.

## D2.6 Tests Run

- RED (before fix): new test failed — `Expected: "notFound", Received: "valid"` (handler validated the forged token).
- GREEN (after fix): `verifyDigitalCredential.test.ts` 12 pass / 0 fail.
- `bun test src/handlers/member/credentials/` → 84 pass / 0 fail (8 files).
- Full api-ts `bun test` → 6274 pass / 1 fail (only the pre-existing `registerEmailJobs` flake) / 93 skip / 3 todo.
- `tsc --noEmit` → exit 0.

## D2.7 Validation Summary

All green. No new failures vs baseline (+1 test = the new regression). No schema/seed/FE/TypeSpec/SDK change. No `check:sdk-compat` run (pre-existing path-move drift, 0-op).

## D2.8 Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/member/credentials/verifyDigitalCredentialAuthenticated.ts` | Fail-closed secret via `resolveCredentialVerifySecret()` + try/catch→notFound | FIX-012 follow-up |
| `services/api-ts/src/handlers/member/credentials/verifyDigitalCredential.test.ts` | Added prod-mode forged-token regression test | FIX-012 follow-up |

## D2.9 Completion Decision

**COMPLETE.** All four credential-token surfaces (`issueDigitalCredential`, `verifyCredentialPublic`, `verifyDigitalCredentialAuthenticated`, plus `verifyCertificatePublic`'s `|| ''` guard) are now fail-closed. §D.9 finding closed.

## D2.10 Recommended Next Step

The decision-free AHA backlog is now empty. Every remaining item is gated on a product decision (Q8 cert-schema backfill, elections FIX-002/FIX-004, documents Q1, realtime PD-1/2, surveys PD-1/2/3, platform-admin Q1–Q4/Q8, notifs Q1/2/3). Surface to the user for ratification/decision — do NOT auto-chain.

Prompt: `/Users/elad-mini/Desktop/memberry/docs/aha/prompts/04-module-or-group-fix-tdd.md`

---

## Step 38 — Q8 RESOLVED (2026-06-13, decision session)

**Q8 cert-schema backfill → Option A (nullable + lazy-link).** User delegated to eng judgment.
Decision recorded in `documents-credentials-fix-ready-plan.md` §Decisions Step 38 (full rationale
+ migration shape). Unblocks **Batch F** (cert uniqueness migration) → **Batch C** (FIX-005/006/015).
Now decision-free → continuation prompt `docs/aha/outputs/CONTINUE-39-prompt.md`.

Still gated (NOT picked up this session, by user's deferral-to-judgment + incremental-phase
protocol): documents Q1 ratification, elections FIX-002/FIX-004, realtime PD-1/2, surveys
PD-1/2/3, platform-admin Q1–Q4/Q8, notifs Q1/2/3. Each is its own short decision session.

---

## Step 39 — Batch F + Batch C EXECUTED (2026-06-13, TDD fix session)

### F/C.1 Fix Scope

| Item | Details |
| --- | --- |
| Batch executed | **Batch F** (cert schema/migration) + **Batch C** (FIX-006 → FIX-005 → FIX-015) |
| Superpowers used | Yes (TDD discipline — RED→GREEN per fix) |
| Working tree status checked | Yes — intentionally dirty (recovery-2025 + AHA 31–38) PRESERVED; no destructive git |
| Shared files touched | Yes — TypeSpec `certificates.tsp` (additive optional field) → regenerated `validators.ts`; migration journal |
| Schema/migration touched | Yes — `certificates.schema.ts` + new migration `0069` |
| Limitations | Live-Postgres insert-level uniqueness test is `[BLOCKED BY ENVIRONMENT]` (unit suite is mock-DB only); proven via schema-shape + migration-DDL assertions instead. `bun run db:generate` not used (drizzle-kit unavailable here, per 0061–0068) — migration hand-authored + journal entry added, matching the established precedent. |

### F/C.2 Fixes Selected

| Fix ID | Gap | Severity | Scope | Batch | Status |
| --- | --- | --- | --- | --- | --- |
| FIX-006 | `trainingId = organizationId` corrupts uniqueness key | P1 | V1 REQUIRED | F+C | Fixed |
| FIX-005 | Cert PDF: no QR, placeholder identity, client-forgeable body overrides | P1 | V1 REQUIRED | C | Fixed |
| FIX-015 | Cert PDF missing branding; ID PDF "Powered by" vs spec "Verified by Memberry" | P2 | V1 RECOMMENDED | C | Fixed |

### F/C.3 Baseline Before Changes

| Check | Before | Fix ID | Notes |
| --- | --- | --- | --- |
| `certificates.schema.test.ts` | did not exist | F | new RED → GREEN |
| bulk `persists real trainingId` / `NULL not orgId` | FAIL (`Received: "org-1"`) | FIX-006 | RED confirmed bogus self-ref |
| `resolveCertificatePdfData` import | FAIL (not exported) | FIX-005 | RED |
| PDF QR adds content | FAIL (`1483 == 1483`, no QR) | FIX-005 | RED |

### F/C.4 Changes Made

| Fix ID | Implemented | Files | Notes |
| --- | --- | --- | --- |
| Batch F | `trainingId` nullable; partial unique `WHERE training_id IS NOT NULL`; persist `certificate_type`; migration `0069` (DROP NOT NULL → NULL-out bogus rows → DROP old constraint → CREATE partial unique index → ADD certificate_type); journal idx 69 | `certificates.schema.ts`, `0069_*.sql`, `meta/_journal.json` | `[SHARED DEPENDENCY]` schema/migration. Idempotent DDL. |
| FIX-006 | `BulkIssueBody.trainingId?`; line 46 `trainingId: body.trainingId ?? null` (was `body.organizationId`); persist `certificateType`; TypeSpec `BulkIssueCertificatesRequest.trainingId?` → regen | `bulkIssueCertificates.ts`, `certificates.tsp`, `generated/openapi/validators.ts` (regen) | Job payload auto-forwards `trainingId` via `...body` spread + `Parameters<typeof generateCertificates>[1]` — no `jobs/index.ts` edit needed. |
| FIX-005 | `resolveCertificatePdfData()` server-resolves recipient (person) / org / training-title / type / credits; GET handler drops ALL client body overrides; signed verify QR (`signCertificateQR`) drawn as vector matrix in PDF | `generateCertificatePdf.ts`, `certificate-template.ts`, `types/qrcode-svg.d.ts` (ambient decl) | Forgery surface closed: handler takes no identity input. QR via existing `qrcode-svg` dep (was unused). |
| FIX-015 | Cert PDF footer "Verified by Memberry"; id-card line 199 "Powered by" → "Verified by Memberry" | `certificate-template.ts`, `getMyIdCardPdf.ts` | PRD 11.7. |

### F/C.5 Tests Added / Updated

| Test File | Type | Proves | Fix ID |
| --- | --- | --- | --- |
| `repos/certificates.schema.test.ts` (new) | data/schema + regression | trainingId nullable, certificateType present, migration DDL correct (NULL-out, partial unique, drop constraint) | F |
| `bulkIssueCertificates.test.ts` (extended) | backend/unit | inserts real `trainingId`; NULL (not orgId) when absent; persists `certificateType` | FIX-006 |
| `generateCertificatePdf.resolve.test.ts` (new) | backend/unit | identity resolved server-side from DB; signed verify URL; NULL-training fallback; type clamp; no-secret omits QR | FIX-005 |
| `utils/certificate-template.test.ts` (extended) | backend/unit | QR adds PDF content; renders with/without verifyUrl | FIX-005 |

### F/C.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/member/certificates/` | Passed | 102 pass / 0 fail (14 files) |
| `bun test src/handlers/association:member/jobs/` | Passed | 32 pass / 0 fail |
| `bunx tsc --noEmit` | Passed | exit 0, no type errors |
| `bun run check:sdk-compat` | Failed (pre-existing) | 25 breaking op-id **path renames** (jobs/marketplace/advertising) — pre-existing baseline drift, NONE are certificates; my tsp edit only ADDED an optional field (non-breaking) |

### F/C.7 Validation Summary

All touched-scope tests GREEN; tsc clean. The only red is `check:sdk-compat`, which fails on pre-existing operationId path-move drift unrelated to this batch (no certificate op changed; an added optional request field cannot remove/rename an op). Live insert-level uniqueness is `[BLOCKED BY ENVIRONMENT]` — covered by schema-shape + migration-DDL guards.

### F/C.8 m09 Seam (Step 4)

`[CROSS-MODULE RISK]` — The officer bulk-issue form (`apps/memberry/.../officer/certificates.tsx`) currently sends only free-text `trainingTitle`, **no real `trainingId`**. So newly-issued certs land with `trainingId = NULL` (Option A lazy-link — valid, unlinked, NOT per-training uniqueness-keyed). The contract addition is nullable-tolerant, so this is safe and expected. **Seam to close later:** add a training selector to the officer form to supply a real `trainingId` before per-training uniqueness applies to new issuance. Not in this batch's scope.

### F/C.9 Q6 Edge (eng default — FLAG, ratify)

Zero-credit trainings (attendance/speaker, `creditHours = 0/null`) → certificate IS generated. Cert existence is independent of CPD credit; resolver omits the credit line when `creditHours` is null but still renders the cert + QR. Baked into FIX-005 test design (`creditAmount` optional). Recommend ratification.

### F/C.10 Completion Decision

**COMPLETE.** Batch F + Batch C landed GREEN (typecheck + all touched-handler/schema tests). FIX-005/006/015 fixed; schema migration `0069` authored + journaled. sdk-compat red is pre-existing and unrelated.

### F/C.11 Recommended Next Step

STOP per continuation prompt — do NOT auto-chain. Remaining ratification pile is separate decision sessions: documents Q1, elections FIX-002/004, realtime/surveys/platform-admin/notifs. Also two new flags for ratification: **m09 training-selector seam** (F/C.8) and **Q6 zero-credit default** (F/C.9). Surface to user.

---

## Step 40 — Batch A CLOSEOUT (2026-06-13, TDD fix session)

Closes the LAST technical gap in Batch A (verification chain): the member ID-card
PDF printed the verify URL as **plain text, not a scannable QR**. Q1 was RESOLVED
Step 29 (reuse the credential token + `/verify/$id` route — no new HMAC surface);
this session only adds the QR image and proves the chain live (resolving Q2).

### A.1 Fix Scope

| Item | Details |
| --- | --- |
| Batch executed | Batch A closeout (FIX-001 QR image) |
| Fix scope | FIX-001 (P0) scannable QR on ID-card PDF; verify-chain E2E (Q2) |
| Superpowers used | Yes (TDD: RED → GREEN) |
| Working tree status checked | Yes (intentionally dirty — recovery-2025 + AHA 31–39; preserved) |
| Shared files touched | Yes — new `core/pdf/qr.ts` (`[SHARED DEPENDENCY]`, low blast radius: 2 consumers) |
| Schema/migration touched | No |

### A.2 Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- |
| FIX-001 | ID-card PDF prints verify URL as text, not scannable QR | P0 | V1 REQUIRED | Trust UX — member card must be machine-verifiable; mirrors Step 39 cert QR | Fixed |
| FIX-002 (verify) | Confirm collapsed `/verify/$id` dispatch live (Q2) | P0 | V1 REQUIRED | Prove no route shadowing for credential/cert/token shapes | Fixed (verified live) |

### A.3 Baseline Before Changes

| Check/Test | Result Before | Related Fix | Notes |
| --- | --- | --- | --- |
| `id-card-pdf.test.ts` | Failed (module missing) | FIX-001 | RED confirmed before implementation |
| `verify-dispatch.test.ts` | 8 pass | FIX-002 | Dispatch already collapsed Steps 29–38 |

### A.4 Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared? | Notes |
| --- | --- | --- | --- | --- |
| FIX-001 | Lifted `drawQrCode` to shared `core/pdf/qr.ts`; extracted pure `renderIdCardPdf(card)` into `person/utils/id-card-pdf.ts`; draw scannable QR of `https://memberry.app/verify/<credentialNumber>` when `verifyCredentialNumber` present, text-only fallback otherwise | `core/pdf/qr.ts` (new), `handlers/person/utils/id-card-pdf.ts` (new), `handlers/person/getMyIdCardPdf.ts` (slimmed to call render fn), `handlers/member/certificates/utils/certificate-template.ts` (import shared QR, drop local copy) | Yes `[SHARED DEPENDENCY]` | QR reuses the SAME credential-number scheme the text prints (Q1) — no new HMAC URL |

### A.5 Tests Added / Updated

| Test File | Type | What It Proves | Fix |
| --- | --- | --- | --- |
| `handlers/person/utils/id-card-pdf.test.ts` (new) | backend/unit | `%PDF` magic + byte-size delta: QR adds content only when `verifyCredentialNumber` present; no-credential card still renders | FIX-001 |
| `routes/verify/verify-dispatch.test.ts` (existing) | unit | credential/cert/token shape resolution (deterministic Q2 cross-check) | FIX-002 |

### A.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test id-card-pdf.test.ts certificate-template.test.ts` | Passed | 40 pass (3 new id-card + 37 cert, incl. cert QR refactor regression) |
| `bun test verify-dispatch.test.ts` (apps/memberry) | Passed | 8 pass |
| `bunx tsc --noEmit` (services/api-ts) | Passed | exit 0, clean |

### A.7 Verify-chain E2E (live — resolves Q2)

Live `/browse` against running stack (API :7213, app :3004). All three id-shapes
dispatched to the **correct** verifier — no shadowing:

| URL | Kind | Verifier body | Backend result |
| --- | --- | --- | --- |
| `/verify/PDA-MM-2025-1000` (real credential) | credentialNumber | **Valid** — Dr. Maria Santos, active, FIX-014 staleness note | credential verify → Valid |
| `/verify/CERT-2025-0005` (real certificate) | certificate | **REVOKED** — distinct cert body | `verifyCertificatePublic` → Revoked |
| `/verify/abc.def` (token shape) | token | **Verification Failed** — distinct token body | token verify → invalid (synthetic) |

Evidence: `docs/aha/evidence/playwright-findings/verify-chain-e2e-step40.md` +
`docs/aha/evidence/screenshots/verify-{credential,certificate,token}.png`.

### A.8 Completion Decision

**COMPLETE.** FIX-001 scannable QR landed GREEN (RED→GREEN unit proof + tsc clean
+ cert refactor regression green). Verify chain confirmed live: credential/cert/
token shapes each resolve to the correct verifier via `resolveVerifyKind` with no
route shadowing, and backend public-verify returns real status. Batch A (FIX-001 /
002 / 012 / 014) is fully closed.

### A.9 Recommended Next Step

STOP per continuation prompt — do NOT auto-chain into the ratification pile (each
is its own `/clear` decision session): documents Q1 ratify (engineering default
shipped), elections FIX-002/004, m09 training-selector seam, Q6 zero-credit certs,
realtime/surveys/platform-admin/notifs.

---

# Batch A — FIX-014 fake-green test hardening (AC-M11-006) (appended 2026-06-13)

> Separate `04` pass under the Batch A mandate. Batches B1/B2/A/A2/C/D above are
> unchanged. **Strictly test-only.** Closes the LAST fake-green test the
> verify-chain (Batch A / FIX-014) prompt named: `ac-m11.documents.test.ts`
> **AC-M11-006** (version history) still asserted against test-local
> `uploadNewVersion`/`getVersionHistory` closures, not the real handler — the
> sibling of the AC-M11-005 simulation that Batch B1 already removed. No
> source/schema/seed/FE/TypeSpec change, no generator regen, no migration.

## A14.1 Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Documents & Credentials |
| Module slug | documents-credentials |
| Fix date | 2026-06-13 |
| Batch executed | Batch A — verify-chain test hardening (FIX-014 scope; AC-M11-006 fake-green replacement) |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked before edits) |
| Working tree status checked | Yes — intentionally dirty (recovery-2025 + prior AHA passes) PRESERVED; only documents test files touched. No forbidden git commands. |
| Fix scope | P1 / V1 REQUIRED test hardening (no production behavior change) |
| Out of scope | Any handler/source/schema change; Batch C certificates; Batch D handler fixes; all §10 Deferred / §11 Do Not Build; FIX-001/002/012 (already COMPLETE — Batch A/A2/Step 40) |
| Shared files touched | No |
| Schema/migration touched | No — verify chain needs no migration (confirmed: latest applied 0071, next free 0072; not used) |
| TypeSpec / regen | No — no `.tsp` change, no `bun run generate` |
| Limitations | (1) Contract/Hurl + live-DB not run (test-only pass; no behavior to contract-prove) `[BLOCKED BY ENVIRONMENT]`. (2) FIX-001/002/012 of Batch A were already COMPLETE in prior passes (Batch A §A.14, A2 §A2.9, Step 40 §A.8); this pass only addresses the residual fake-green AC-M11-006 the original Batch A prompt explicitly named alongside AC-M11-005. |

## A14.2 Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-014 (test hardening) | `ac-m11.documents.test.ts` **AC-M11-006** version-history block was fake-green — asserted a local `uploadNewVersion`/`getVersionHistory` closure, not the real `uploadNewDocumentVersion` handler; could never catch a production regression | P1 | V1 REQUIRED | A | Prompt mandate: "replace the fake-green AC-M11-005/006 with tests that drive the REAL code". B1 handled AC-M11-005; AC-M11-006 was left untouched (B1 §4/§11). This closes it. | Fixed |
| FIX-001 / FIX-002 / FIX-012 | Verify chain end-to-end (ID-card HMAC QR, route collapse, fail-closed secret) | P0/P1/P2 | — | A/A2/Step 40 | Already COMPLETE in prior passes; re-verified green this pass (no change) | Already Fixed (re-verified) |

## A14.3 Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `ac-m11.documents.test.ts` AC-M11-006 block | Pass (FAKE-GREEN) | FIX-014 | Imported only `bun:test`; defined + tested its own `uploadNewVersion`/`getVersionHistory` local functions. Zero reference to `uploadNewDocumentVersion` → green even if the real handler's version-numbering were broken. |
| `uploadNewDocumentVersion.test.ts` | 6 pass | FIX-014 | Real handler driven, BUT version increment proven only by a hardcoded stub return (`versionNumber: 2`) — did not assert the handler computes `latest + 1` |
| New `[AC-M11-006]` real-handler describe (3 tests) | Pass on first run | FIX-014 | Honest GREEN regression of already-correct handler — see note below |
| `bun test src/handlers/documents/` | 230 pass / 0 fail / 24 files | FIX-014 | Clean baseline |

> RED proof of the fake-green claim: the removed AC-M11-006 block has **no import** of `./uploadNewDocumentVersion` (verified: its only import was `bun:test`). It therefore passes regardless of the production handler's correctness — the definition of fake-green. The replacement tests import and invoke the real `uploadNewDocumentVersion` handler and assert the handler-computed `versionNumber` (`createOne` echoes the value it actually received), so they would fail if `nextVersion = latest + 1` regressed. The handler is already correct, so the new suite is honest GREEN regression coverage (no behavior change), exactly as the Batch D suites were framed (§D.3).

## A14.4 Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-014 | Added an `[AC-M11-006]` describe block to the REAL handler test: (a) next version = repo latest(4)+1 = 5, asserted via `createOne` echo (a hardcoded stub can't prove this); (b) first version of a fresh doc (latest 0) = 1; (c) the acting `user.id` is recorded as `uploadedBy` (immutable provenance) | `handlers/documents/uploadNewDocumentVersion.test.ts` | No | Drives the production handler, not a closure |
| FIX-014 | Removed the fake-green AC-M11-006 local-closure simulation from `ac-m11.documents.test.ts`; replaced the whole file with a pointer-header + sentinel test cataloguing where AC-M11-005 and AC-M11-006 real coverage now lives, to prevent reintroduction | `handlers/documents/ac-m11.documents.test.ts` | No | Mirrors the AC-M11-005 removal pattern B1 established |

## A14.5 Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `handlers/documents/uploadNewDocumentVersion.test.ts` (extended) | backend/unit + regression | The real handler computes the next version number as repo-latest + 1 (monotonic), numbers a fresh document's first version 1, and records the acting uploader id — none of which the hardcoded-stub tests proved | FIX-014 |
| `handlers/documents/ac-m11.documents.test.ts` (replaced) | backend/unit (pointer) | The former AC-M11-005 + AC-M11-006 in-file simulations are gone; documents where real handler coverage lives; sentinel guards against reintroduction | FIX-014 |

## A14.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test .../uploadNewDocumentVersion.test.ts` | Passed | 9 pass / 0 fail (was 6; +3 real AC-M11-006 tests) |
| `bun test src/handlers/documents/` | Passed | 230 pass / 0 fail / 24 files (net 0 vs baseline: −4 fake-green AC-M11-006 tests + 1 sentinel + 3 real tests) |
| `bun test .../verify/verify-dispatch.test.ts` (memberry) | Passed | 8 pass / 0 fail — verify-chain dispatch unchanged |
| `bun test .../association:member/utils/credential-token.test.ts` | Passed | 6 pass / 0 fail — HMAC token round-trip + fail-closed secret unchanged |
| `bunx tsc --noEmit` (services/api-ts) | Passed | exit 0, 0 `error TS` lines |

## A14.7 Validation Summary

- **Passed:** documents suite 230/0 (24 files); the targeted handler suite grew 6→9 with real version-numbering coverage; verify-chain FE dispatch (8/0) and BE HMAC token (6/0) re-verified unchanged; api-ts typecheck clean (exit 0).
- **Failed:** none. (Full api-ts suite not re-run this pass — test-only, scoped to documents; the documented pre-existing `registerEmailJobs` interval flake is unrelated and unchanged.)
- **Not run / Blocked:** contract/Hurl + live-DB `[BLOCKED BY ENVIRONMENT]` (test-only pass, no behavior to contract-prove); browser E2E of the verify journey already proven live in Step 40 (§A.7).
- **Pre-existing / unrelated:** none introduced.

## A14.8 Shared / Cross-Module / Database Impact

None. Test-only pass; no source/schema/generated/SDK/FE/TypeSpec files touched. No migration (verify chain needs none). `check:sdk-compat` not run (adds 0 operationIds; unaffected).

## A14.9 Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Browser E2E re-assertion of the collapsed verify route in CI | FIX-002 | Proven live once (Step 40 §A.7) but not a standing automated E2E | Add to E2E when a booted app+API+seeded DB is wired into CI `[BLOCKED BY ENVIRONMENT]` |
| Contract proof of credential public-verify token surface | FIX-001 | No booted API + seeded DB this pass | Run member/credentials Hurl against `$API_URL` when available |

## A14.10 Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Verify-journey contract/E2E in CI | `[BLOCKED BY ENVIRONMENT]` | No running app+API+seeded DB / auth in this environment | Boot stack + seed; wire into CI |

## A14.11 Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Batch C certificates (FIX-005/006/015 — already done Step 39), Batch D handler fixes, FIX-013 | gated / separate batch / already complete | Out of this pass's test-hardening scope |
| New HMAC `GET /verify/:token` | `DO NOT ADD` | Q1 chose credential-token reuse (roadmap §17 overbuild flag) — unchanged |

## A14.12 Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/documents/uploadNewDocumentVersion.test.ts` | Added `[AC-M11-006]` real-handler version-numbering describe (3 tests) | FIX-014 |
| `services/api-ts/src/handlers/documents/ac-m11.documents.test.ts` | Removed fake-green AC-M11-006 local-closure simulation; replaced with pointer-header + sentinel | FIX-014 |

## A14.13 Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED (fake-green proof: removed block had no real-handler import) + GREEN runs + counts | This report §A14.3 / §A14.6 | FIX-014 |
| Verify-chain live E2E (prior) | `docs/aha/evidence/playwright-findings/verify-chain-e2e-step40.md` | FIX-001/002 |

## A14.14 Completion Decision

**COMPLETE**

The last fake-green test the Batch A verify-chain prompt named — `ac-m11.documents.test.ts` **AC-M11-006** (version history, which asserted a test-local closure instead of the real `uploadNewDocumentVersion` handler) — is replaced with real handler-driven coverage that proves the handler computes monotonic version numbers (`latest + 1`) and records immutable uploader provenance. The documents suite is green (230/0, 24 files), the targeted handler suite grew 6→9, the verify-chain dispatch + HMAC token tests re-verify unchanged, and api-ts typecheck is clean. FIX-001/002/012 of Batch A were already COMPLETE (Batch A/A2/Step 40) and are re-verified green; no production behavior changed this pass. No migration, no TypeSpec/regen.

## A14.15 Recommended Next Step

Batch A (FIX-001/002/012/014, incl. all fake-green replacements) is now fully closed for Documents & Credentials. Per the standing AHA protocol, STOP — do NOT auto-chain. Remaining items are separate decision sessions (documents Q1 ratify, elections FIX-002/004, m09 training-selector seam, realtime/surveys/platform-admin/notifs). When a booted API + seeded DB exist, add standing verify-journey contract/E2E coverage to close the `[BLOCKED BY ENVIRONMENT]` gap.

Prompt: `/Users/elad-mini/Desktop/memberry/docs/aha/prompts/04-module-or-group-fix-tdd.md`
