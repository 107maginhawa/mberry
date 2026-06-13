# AHA Module/Group Fix Report: Cross-Cutting / Platform

> Slug: `cross-cutting-platform` · Pass: post-05 cross-cutting FIXES (04 TDD discipline on platform/generator code)
> Source plan: `docs/aha/outputs/cross-cutting-pattern-audit.md` (§F-3 / P-2), `database-schema-audit.md` (R-6), `consolidated-remediation-roadmap.md` §10/§11.
> Date: 2026-06-12 · Tree: dirty, preserved (no commits).

---

## 1. Fix Scope

Two cross-cutting platform fixes surfaced by the prompt-05 cross-cutting audit:

- **F-3 / P-2 / R-6 (PRIMARY)** — "Generated Zod marks required `organizationId`/`orgId` as `.optional()`". Goal: emit non-optional org id for org-required ops, at the generator (`scripts/generate.ts`), never by hand-editing generated files.
- **F-5 (OPTIONAL, P3 DX)** — `check:sdk-compat` should distinguish additive (new ops) from breaking (removed/changed ops) instead of flagging both.

Out of scope (per CONTINUE-05 prompt): re-running the 05/06 audits; P-7 (`assert-record-org` → `core/`); P-8 (domain-event bus retry); membership Batch E2/F; dues Batch C; any product-decision-gated work. No product decisions were made.

---

## 2. Fixes Selected

| ID | Title | Severity | Class | Outcome |
|----|-------|----------|-------|---------|
| F-3 / P-2 / R-6 | Generator org-id optionality for org-required ops | P1 | V1 RECOMMENDED | **Resolved** — real generator fix (path-param invariant) + documented middleware authority. **No optional→required flip** (would regress contract). |
| F-5 / P-9 | `check:sdk-compat` additive-vs-breaking discrimination | P3 | DX | **Resolved** |

---

## 3. Baseline Before Changes

Known-good baseline after the prior 04+env session (from CONTINUE-05 prompt):

- Full `bun test` (api-ts): **6001 pass / 1 fail / 4 todo**. The 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs > registers email.processor as interval job` (interval 30000 vs 1000).
- Hurl: **153/155** (2 pre-existing: impersonation `403→400`, platformadmin committees `403→200`; `member/governance/position-crud.hurl` flaky/intermittent).
- tsc: **0 errors**.
- `generated/openapi/validators.ts`: **128** optional `organizationId`/`orgId` lines (309 org-id lines total).

---

## 4. Changes Made

### F-3 — engineering trace first (Step A), then the correct fix

**Trace (this is the `[NEEDS CONFIRMATION]` engineering determination of the required-vs-optional org-id op set, NOT a product decision):**

The audit P-2 finding cited validator lines 98, 193, 354, 409, 445, 569, 671, 715 as "ops that require org context." Tracing each line to its enclosing block proved the citation was a **misread**: every cited line is a `*UpdateSchema` block —

| Cited line | Block | Class |
|---|---|---|
| 98 | `AIAgentTaskUpdateSchema` | PATCH partial-update model |
| 193 | `AdCampaignUpdateSchema` | PATCH partial-update model |
| 354 | `AdvertiserUpdateSchema` | PATCH partial-update model |
| 409 | `AffiliationTransferUpdateSchema` | PATCH partial-update model |
| 445 | `AgingBucketUpdateSchema` | PATCH partial-update model |
| 569 | `AnnouncementUpdateSchema` | PATCH partial-update model |
| 671 | `AssociationCoreAssociationBaseEntityUpdateSchema` | PATCH partial-update model |
| 715 | `AssociationCoreBillingInvoiceUpdateSchema` | PATCH partial-update model |

Full decomposition of the **128** optional org-id validator lines:

| Category | Count | Correct? | Why |
|---|---:|---|---|
| `*UpdateSchema` (PATCH partial-update model shapes) | 103 | **Keep optional** | You do not move a record across orgs via PATCH; org-id is genuinely not-required in a partial update. Flipping breaks every update endpoint. |
| `*Schema` (component model shapes, non-validator reuse) | 7 | **Keep optional** | Same model-shape category. |
| `<Op>Query` (list/search filter params) | 18 | **Keep optional** | Org presence enforced by `orgContextMiddleware`; field is advisory/redundant or a genuine optional filter. |

**Operation-request truth from the OpenAPI spec** (`specs/api/dist/openapi/openapi.json`):

- **Path params**: 39 org-id path params, **39 required / 0 optional**. Across the whole spec, **0 of 293** path params are optional. These are the cross-org admin / national / accredited-provider routes (e.g. `GET /admin/organizations/{organizationId}`, `GET /accredited-providers/{organizationId}`) — the only class where org id legitimately MUST be present in the request. Already non-optional in `validators.ts` (e.g. `GetOrganizationParams`, `UpdateOrganizationParams`, `ListOrgAccreditedProvidersParams`).
- **Body**: the 9 optional body org-id occurrences are the PATCH `*UpdateSchema` bodies (same models as above) — correctly optional.
- **Query**: 18 optional, all middleware-derived or genuine optional filters.

**Handler evidence — the 18 query candidates do NOT trust the validator field for org presence:**

| Handler | Source of org id | Verdict |
|---|---|---|
| `member/membership/listMemberships.ts:20` | `ctx.get('organizationId')` | middleware authority; query field ignored |
| `member/duesspecialassessments/listDuesInvoices.ts:21` | `ctx.get('organizationId')` + `if(!orgId) ForbiddenError` | middleware authority |
| `member/governance/listElections.ts:19` | `ctx.get('organizationId')` + `if(!orgId) 403` | middleware authority |
| `member/governance/listPositions.ts:17` | `ctx.get('organizationId')` + `if(!orgId) 403` | middleware authority |
| `member/membership/listMembershipApplications.ts:21` | `ctx.get('organizationId')` | middleware authority |
| `marketplace/listListings.ts:23` | `ctx.get('organizationId')` | middleware authority; query org-id not read |
| `person/getMyCredits.ts:11` | `ctx.get('organizationId')` (optional filter) | genuinely optional |
| `association:operations/searchEvents.ts:19` | `query.organizationId` used only `if(orgId) filter` | genuinely optional filter |
| `person/getMyPrivacySettings.ts:23` | `query['orgId'] ?? null` → null = global settings | genuinely optional |

**Conclusion:** the org-presence authority is `orgContextMiddleware` (app.ts mounts it on `/association/*`; `app.ts:412-425`), exactly as the audit's documented alternative stated. Flipping any of the 18 query fields (or the 103 PATCH bodies) to required would be a **contract regression with zero security gain** — it would force callers to send an org id the handler ignores (middleware cases) or break the genuine optional-filter semantics. The genuinely org-required-on-the-request fields (path params) are **already** non-optional.

**The fix that IS warranted (root cause in the generator):** `convertParameterToZod` appended `.optional()` for ANY parameter with `required !== true`, including path params. A path parameter is structurally always present (the route cannot match without it), so emitting it optional is a latent bug class — a future TypeSpec slip marking a path param `required: false` would silently produce a skippable structurally-present id. Fixed by making the generator never emit `.optional()` for `param.in === 'path'`.

Generator changes (`services/api-ts/scripts/generate.ts`):
1. `convertParameterToZod` — `if (param.in !== 'path' && !param.required)` guards the `.optional()` append (was `if (!param.required)`), with an explanatory comment documenting the invariant and that `orgContextMiddleware` is the org-presence authority for query/body.
2. `export function convertParameterToZod` — exported so the generator unit test can exercise it.
3. `if (import.meta.main) { main().catch(console.error) }` — the script now only runs `main()` when executed directly (`bun scripts/generate.ts`), not when imported by a test. Side-effect-free on import.

### F-5 — `check:sdk-compat` additive-vs-breaking (`scripts/check-sdk-compat.ts`)

Refactored the CLI into pure, exported, testable functions and changed the exit policy:
- `classifyDrift(baselineOps, currentOps)` → `{ added, removed, changed }` (pure).
- `decideExit(classification, { strict })` → `{ code, breakingCount, additiveCount }`. **Breaking = removed + changed** (block, exit 1). **Additive = added** (non-blocking, exit 0) unless `--strict` is passed (restores the original block-on-any-drift behavior).
- CLI body guarded with `if (import.meta.main)`; output labels added/removed/changed as ADDITIVE/BREAKING; header doc + exit-code table updated.

---

## 5. Tests Added / Updated

| File | Type | Tests | Asserts |
|---|---|---|---|
| `services/api-ts/src/handlers/__tests__/generated-validator-org-scope.test.ts` | NEW (F-3) | 8 | UNIT: path-param org-id never optional (even `required:false`); generic path param never optional; genuinely-optional QUERY org-id STAYS optional; required query non-optional. REGEN-LOCK (reads `validators.ts`): path-param org-id ops non-optional (`GetOrganizationParams`/`UpdateOrganizationParams`/`ListOrgAccreditedProvidersParams`); list/search query org-id stays optional (`ListMembershipsQuery`/`ListDuesInvoicesQuery`/`SearchEventsQuery`); PATCH `*UpdateSchema` keeps org-id optional (`AdCampaignUpdateSchema`/`AnnouncementUpdateSchema`). |
| `scripts/check-sdk-compat.test.ts` | NEW (F-5) | 7 | `classifyDrift` add/remove/change classification; `decideExit` exit codes for none / additive-only (non-strict 0, strict 1) / breaking (1). |

RED→GREEN evidence:

- **F-3 RED** (after export+guard scaffolding, before the `param.in` fix): 2 fail —
  `path-param org-id is NEVER optional even when required:false` → `Received: "z.string().uuid().optional()"`; `generic path param never optional` → `Received: "z.string().optional()"`. 6 pass (the genuinely-optional preservation + all 3 regen-lock integration tests already green → proves current generated output was already correct; the audit's P-2 was a misdiagnosis).
- **F-3 GREEN** (after `param.in !== 'path'` fix): **8 pass / 0 fail**.
- **F-5 RED** (functions not yet exported): `SyntaxError: Export named 'classifyDrift' not found`. **F-5 GREEN** (after refactor): **7 pass / 0 fail**.

---

## 6. Tests Run

| Net | Result | vs Baseline |
|---|---|---|
| F-3 test (`generated-validator-org-scope.test.ts`) | 8 pass / 0 fail | new |
| F-5 test (`scripts/check-sdk-compat.test.ts`) | 7 pass / 0 fail | new |
| **F-2 integrity suite** (`generated-route-integrity.test.ts`) | 12 pass (20 pass with F-3 test in same run) | unchanged |
| **Full `bun test`** (api-ts) | **6009 pass / 1 fail / 4 todo** | +8 pass (the new F-3 test), same 1 pre-existing fail |
| The 1 fail | `registerEmailJobs > registers email.processor as interval job` | PRE-EXISTING + UNRELATED (interval 30000 vs 1000) — matches baseline |
| **Full monorepo tsc** (`bun run --filter '*' typecheck`) | **0 errors** — ui / admin / sdk-ts / api-ts / memberry all exit 0 | unchanged |
| **Hurl contract** (`API_URL=:7213`, fresh API boot) | **152/155** (1096 requests) | within baseline |
| Hurl 3 failures | `impersonation-flow.hurl:49` (403→400), `member/governance/position-crud.hurl:71` (flaky), `platformadmin-extended-flow.hurl:49` (403→200) | ALL documented pre-existing/flaky — **no new regression** |
| **Regen byte-diff** | `validators.ts` / `routes.ts` / `registry.ts` / `openapi.json` md5 **byte-identical** before/after regen | generator change is a no-op on output → zero contract risk |
| `check:sdk-compat` CLI | reports **23 breaking** (the prior F-1 route-prefix moves) → exit 1; **1 additive** (`closeElectionVoting`) no longer forces block | behavior verified |

---

## 7. Validation Summary

- **F-3**: PASS. Root-cause generator fix applied (path params can never be `.optional()`); generated artifacts regenerated and proven byte-identical (0 of 293 path params were optional, so zero output change → contract-safe, Hurl-safe). The audit's proposed corrective flip (optional→required for the cited lines) was **refuted by the trace** and intentionally NOT performed — it would have regressed the contract on PATCH/update + list/search endpoints with no security gain, because `orgContextMiddleware` is the sole org-presence authority. Invariant locked by an 8-test RED→GREEN suite (unit + regen-lock).
- **F-5**: PASS. Gate now blocks only on breaking drift (removed/changed), tolerant of additive ops, `--strict` preserves old behavior. 7-test RED→GREEN.
- Full platform regression nets (F-2 integrity, full `bun test`, full monorepo tsc, Hurl) clean vs baseline.

---

## 8. Shared / Cross-Module / Database Impact

`[SHARED DEPENDENCY]` `[CROSS-MODULE RISK]` — `services/api-ts/scripts/generate.ts` is the platform code generator; a change there is platform-wide. Mitigations applied and passing: the F-2 generated-route-integrity suite, full `bun test`, full monorepo tsc, and Hurl were all run as the before/after net, and regen output was proven byte-identical. No database/schema change (R-6 is a generator concern, not a column — `database-schema-audit.md` R-6). No handler changes (the defensive `ctx.get('organizationId')` checks remain the correct authority and are unchanged). `check:sdk-compat` is referenced by CI/process docs (`R0_BASELINE.md`, several `MODULE_SPEC.*` / `SCOPE.*`); the new default is strictly more permissive on additive drift and identical on breaking drift, and `--strict` restores the prior behavior for any caller that needs it.

---

## 9. Remaining Gaps

- None for F-3/F-5 as scoped. The 103 `*UpdateSchema` PATCH partials and 18 list/search query org-id fields **remain optional by design** (documented above) — this is correct, not a gap.

---

## 10. Blocked Items

- None. The trace was conclusive; no environment or spec blocker.

---

## 11. Deferred / Not Implemented

- **Optional→required corrective flip on the audit's cited lines** — intentionally NOT implemented (`[DO NOT OVERBUILD]`): the trace proved it would be a contract regression with no security benefit; org presence is enforced by `orgContextMiddleware`.
- P-7 (`assert-record-org` → `core/`), P-8 (domain-event bus retry), membership Batch E2/F, dues Batch C — out of scope per prompt.

---

## 12. Files Changed

| File | Change | Δ |
|---|---|---|
| `services/api-ts/scripts/generate.ts` | path-param `.optional()` invariant in `convertParameterToZod`; export that fn; guard `main()` with `import.meta.main` | ~25 lines |
| `services/api-ts/src/handlers/__tests__/generated-validator-org-scope.test.ts` | NEW — F-3 unit + regen-lock suite (8 tests) | new file |
| `scripts/check-sdk-compat.ts` | F-5 — extract+export `classifyDrift`/`decideExit`; additive-tolerant exit + `--strict`; guard CLI with `import.meta.main`; updated header/labels | ~135 +/74 − |
| `scripts/check-sdk-compat.test.ts` | NEW — F-5 unit suite (7 tests) | new file |
| `docs/aha/module-fix-plans/cross-cutting-platform-fix-report.md` | NEW — this report | new file |

**Generated files: NOT hand-edited.** `validators.ts` / `routes.ts` / `registry.ts` / `openapi.json` were regenerated via the pipeline and confirmed byte-identical to their pre-regen state.

---

## 13. Evidence Saved

- Trace + RED/GREEN/regen/regression evidence embedded in this report (§4–§6).
- Logs (transient, this session): `/tmp/bun-test-full.log`, `/tmp/hurl-contract.log`, `/tmp/tc-all.log`, `/tmp/gen-before.txt` / `/tmp/gen-after.txt` (regen byte-diff proof).

---

## 14. Completion Decision

**PASS.** F-3 and F-5 both resolved with TDD discipline (RED→GREEN), smallest correct root-cause changes, regenerate-not-hand-edit honored, working tree preserved, no product decisions, full platform regression nets green vs baseline.

Key finding for the roadmap: **the audit's P-2/R-6 corrective premise (flip optional→required) was a misdiagnosis of `*UpdateSchema` PATCH partials; the correct resolution is the generator path-param invariant + documenting `orgContextMiddleware` as the sole org-presence authority.** Update `consolidated-remediation-roadmap.md` §10 (F-3) and §11 (R-6) / `cross-cutting-pattern-audit.md` P-2 / `database-schema-audit.md` R-6 to **Resolved (documented + generator-hardened, not flipped)** when the roadmap is next consolidated (07).

---

## 15. Recommended Next Step

A **product-decision pass** to unblock the remaining gated batches — membership Batch E2/F (the 6 lifecycle decisions are already RESOLVED in `membership-lifecycle-fix-ready-plan.md` §Product Decisions, so E2/F is ready), dues Batch C, documents Batch C/F (Q8), realtime-comms Batch F (R-3 chat retention) — **then a second `04` fix pass** against those recorded decisions. After that, re-run `07-consolidate-roadmap.md` to fold the F-3/F-5 Resolved status and the corrected P-2/R-6 understanding into the roadmap.
