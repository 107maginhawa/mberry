# AHA Module/Group Gap Plan: Jobs (Job Board)

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Jobs (Job Board — m15) |
| Module slug | jobs |
| Type | Business Module |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/jobs-gap-plan.md` |
| Primary PRD/spec used | `specs/api/src/modules/jobs.tsp` (TypeSpec contract — the authoritative source of intended routes) |
| Supporting PRDs/specs used | `docs/aha/outputs/cross-cutting-pattern-audit.md` (P-1/F-1); `docs/aha/outputs/consolidated-remediation-roadmap.md` (§1, §8 order 1, §19); `services/api-ts/src/handlers/jobs/repos/jobs.schema.ts` |
| PRD/spec coverage quality | Partial — no standalone product PRD for the job board surfaced (m15 entry in audit index notes the requirement may have no dedicated product doc); the TypeSpec contract + schema + handlers are treated as the authoritative spec for this targeted audit. `[INFERRED]` where product intent is read from the contract. |
| Paths inspected | `specs/api/src/main.tsp:707-739` (Wave G3 re-exports); `specs/api/src/modules/jobs.tsp:247-341`; `services/api-ts/src/generated/openapi/routes.ts:266-278, 3328-3361`; `specs/api/dist/openapi/openapi.json` (paths); `services/api-ts/src/handlers/jobs/*.ts` (7 handlers); `services/api-ts/src/handlers/jobs/repos/jobs.repo.ts`, `jobs.schema.ts`; `services/api-ts/src/app.ts:401-432`; `services/api-ts/src/handlers/__tests__/marketplace-advertising-route-prefix.test.ts` |
| PRDs/specs inspected | jobs.tsp; cross-cutting audit; consolidated roadmap; module-audit-index |
| KG used | No — direct code inspection was sufficient for a targeted single-defect audit; KG status doc not consulted this pass |
| KG refreshed | No |
| `/understand-domain` used | No |
| `/understand-domain` refreshed | No |
| Webwright used | No — defect is in generated route registration; deterministic static evidence (OpenAPI JSON + routes.ts + TypeSpec) is stronger than a browser trace, and no booted/seeded stack is available `[BLOCKED BY ENVIRONMENT]` |
| Playwright/E2E inspected | No |
| Existing tests inspected | `jobs/createJobPosting.test.ts`, `createJobApplication.test.ts`, `searchJobPostings.test.ts`, `getJobPosting.test.ts`, `updateJobPosting.test.ts`, `deleteJobPosting.test.ts`, `updateJobApplication.test.ts` (handler-level, mock-context); `__tests__/marketplace-advertising-route-prefix.test.ts` (the twin-defect regression net, as the clone template) |
| Cross-cutting audit reviewed | Yes |
| Database/schema audit reviewed | Yes (06 §24 — data layer healthy on balance; jobs schema org-scoped + indexed) |
| Limitations | No booted+seeded API/DB stack → cannot reproduce the 500 / cross-org write at runtime against live Postgres `[BLOCKED BY ENVIRONMENT]`. Defect is instead proven deterministically from the generated artifacts. This is a **targeted audit anchored on the known P0** (per roadmap §19) — it is not a full module-completeness audit; broader job-board product gaps are intentionally out of scope and only noted where the P0 surfaces them. |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| Jobs TypeSpec contract | `specs/api/src/modules/jobs.tsp` | API contract | Current | Declares the authoritative route intent: `@route("/association/jobs")` on `namespace JobsModule`, with `/postings*` and `/applications*` sub-routes. The single source of truth this audit measures the generated output against. |
| main.tsp service entrypoint | `specs/api/src/main.tsp:707-739` | API contract (re-export layer) | Current (already partially fixed) | Re-exports module interfaces into `MonobaseAPI`. Advertising (4) + Marketplace (3) re-exports already carry `@route("/association/...")` (prior AHA FIX-001). Jobs (2) re-exports at `:723-727` do **not** — the defect. |
| Cross-cutting pattern audit | `docs/aha/outputs/cross-cutting-pattern-audit.md` | Audit (P-1/F-1) | Current | Names jobs as the one **Still Open** instance of pattern P-1 (dropped `/association` prefix on re-exports). |
| Consolidated roadmap | `docs/aha/outputs/consolidated-remediation-roadmap.md` | Roadmap | Current | §1 lists jobs `/postings` prefix P0 as the #1 still-open risk; §8 order 1 + §19 prescribe exactly this 02→03→04 chain, Batch A. |
| Jobs schema | `services/api-ts/src/handlers/jobs/repos/jobs.schema.ts` | Data model | Current | `job_posting.organization_id` is `NOT NULL` with index `idx_job_posting_org` → confirms the resource is org-scoped and a missing org on insert is a hard DB failure. |
| Module audit index (m15) | `docs/aha/outputs/module-audit-index.md` | Discovery index | Current but contains a stale note | Notes "`handlers/jobs/` = background-job registry, not job board". **Correction (this audit):** `handlers/jobs/` IS the job board — postings + applications CRUD. The stale note does not change the P0. |

## 3. Expected vs Actual

**Expected** `[INFERRED from jobs.tsp]`: every job-board operation is reachable under the org-context boundary `/association/jobs/*`, identical to how marketplace lives under `/association/marketplace/*` and advertising under `/association/advertising/*`. `namespace JobsModule` carries `@route("/association/jobs")`; its operations carry sub-routes `/postings`, `/postings/{postingId}`, `/applications`, `/applications/{applicationId}`. The intended full paths are therefore `/association/jobs/postings*` and `/association/jobs/applications*`. `app.ts` mounts `orgContextMiddleware()` on `/association/*` (`app.ts:419-432`), so these ops are expected to pass through the tenant-context boundary.

**Actual**: the two jobs interfaces are re-exported into `MonobaseAPI` at `main.tsp:723-727` with only `@tag("Jobs")` and **no `@route` decorator**. TypeSpec therefore drops the `JobsModule` namespace's `@route("/association/jobs")` prefix, and all 7 operations are emitted at **ROOT** paths in both the OpenAPI document and `routes.ts`:

| Op | Method | Intended path (jobs.tsp) | Actual emitted path (broken) | routes.ts line |
| --- | --- | --- | --- | --- |
| createJobPosting | POST | `/association/jobs/postings` | `/postings` | 3329 |
| searchJobPostings | GET | `/association/jobs/postings` | `/postings` | 3336 |
| getJobPosting | GET | `/association/jobs/postings/{postingId}` | `/postings/:postingId` | 3342 |
| updateJobPosting | PATCH | `/association/jobs/postings/{postingId}` | `/postings/:postingId` | 3349 |
| deleteJobPosting | DELETE | `/association/jobs/postings/{postingId}` | `/postings/:postingId` | 3357 |
| createJobApplication | POST | `/association/jobs/applications` | `/applications` | 267 |
| updateJobApplication | PATCH | `/association/jobs/applications/{applicationId}` | `/applications/:applicationId` | 274 |

Because these are root paths, the `/association/*` `orgContextMiddleware` never runs for them. This is byte-for-byte the same defect already fixed for marketplace/advertising — same root cause (D-11), same fix shape.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `JobsModule` ops reachable under `/association/jobs/*` (jobs.tsp:247 `@route`) | All 7 ops emitted under the org-context boundary | Ops emitted at ROOT (`/postings`, `/applications`) | n/a (no frontend consumer found this pass `[NEEDS CONFIRMATION]`) | `routes.ts:266-278, 3328-3361` register at root; `openapi.json` paths at root | `job_posting.organization_id NOT NULL` (`jobs.schema.ts:48`) | No prefix/route test for jobs | **Missing** (prefix dropped) | **Yes — P0** |
| Org-scoped job posting create (`organization_id NOT NULL`) | Insert always carries a valid org id resolved within the tenant boundary | `createJobPosting` reads org from `body.organizationId ?? ctx.req.param('organizationId')` (`createJobPosting.ts:17`); no `:organizationId` path param exists on the route; orgContextMiddleware bypassed at root | n/a | `createJobPosting.ts:17` | `jobs.schema.ts:48` | `createJobPosting.test.ts` passes `organizationId` in mock body | **Partially Implemented** (works only if body supplies org; no boundary guard) | **Yes — see Critical Gaps / adjacent** |
| Job application lifecycle (create/update) | Applicant creates, officer/staff updates status | `createJobApplication` (roles `["user"]`), `updateJobApplication` (roles `["association:admin","association:staff"]`) | n/a | `routes.ts:266-278` | `job_application` org-derived via posting `[INFERRED]` | handler tests present | Implemented (but at root) | Inherits the P0 prefix gap |
| Search/list job postings filtered by org | Listing scoped to caller's org | `searchJobPostings` filters by `ctx.req.query('organizationId')` only when the query param is present (`searchJobPostings.ts:9`; `jobs.repo.ts:30-31`) — org filter is **optional**, not enforced | n/a | `searchJobPostings.ts:9`, `jobs.repo.ts:30-31` | `idx_job_posting_org` | `searchJobPostings.test.ts` | **Partially Implemented** (unscoped listing possible) | adjacent (out of Batch A) |
| Regression protection for the route-prefix invariant | A test fails if the `/association` prefix is ever dropped (as marketplace has) | No equivalent test for jobs | n/a | only marketplace/advertising covered by `marketplace-advertising-route-prefix.test.ts` | n/a | **missing** | **Missing** | **Yes — P1 test gap** |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| Ops under `/association/jobs/*` | `@route` missing on both jobs re-exports → ops at root → orgContextMiddleware bypassed | **P0** | `V1 REQUIRED` | `main.tsp:723-727`; `routes.ts:3329,3336,3342,3349,3357,267,274` | Add `@route("/association/jobs")` to `JobsJobPostingManagement` + `JobsJobApplicationManagement` (mirror advertising/marketplace), rebuild + regen |
| Route-prefix regression net | No test guards the jobs prefix invariant | **P1** | `V1 REQUIRED` | absence of a jobs analog to `marketplace-advertising-route-prefix.test.ts` | Clone the marketplace net for jobs (7 ops, OpenAPI + routes.ts + no-root-leak) |
| Handler trusts `body.organizationId` over the tenant-resolved org | Even under `/association/jobs/*`, `createJobPosting` inserts `body.organizationId` directly; the middleware-resolved org is not asserted to match | **P1** | `V1 RECOMMENDED` | `createJobPosting.ts:17` | Resolve org from the org-context boundary and reject mismatched/absent body org — **separate batch (Batch B), `[NEEDS CONFIRMATION]` on what `orgContextMiddleware` sets on ctx** |
| Listing org-scope not enforced | `searchJobPostings` only filters by org when the query param is present | **P2** | `V1 RECOMMENDED` | `searchJobPostings.ts:9`, `jobs.repo.ts:30-31` | Default the list filter to the tenant org — Batch B/C |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| (none material) | — | — | — | No overbuild detected in the 7-handler surface; the surface is a minimal job-board CRUD that matches the contract. |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Post a job | Association admin/staff | Create posting | create → (draft/active) → update/delete | Implemented but at root path | Yes — P0 prefix | `createJobPosting.ts`, `routes.ts:3329` |
| Browse/search jobs | Member/user | Search | list/filter postings | Implemented but at root + org filter optional | P0 prefix + P2 scope | `searchJobPostings.ts` |
| Apply to a job | Member/user | Submit application | create application → staff updates status | Implemented but at root path | Yes — P0 prefix | `createJobApplication.ts`, `updateJobApplication.ts` |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Route reaches org boundary | Op served under `/association/jobs/*` | Missing | `main.tsp:723-727` | `V1 REQUIRED` | The P0 |
| Org resolved for insert | org from tenant context | Partially Implemented | `createJobPosting.ts:17` (body/param only) | `V1 RECOMMENDED` | adjacent, Batch B |
| Org-scoped list | list filtered to tenant org | Partially Implemented | `searchJobPostings.ts:9` | `V1 RECOMMENDED` | adjacent, Batch B/C |
| Application status transition | staff-only update | Implemented | `routes.ts:274` roles gate | — | works once prefix fixed |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Create posting reachable + org-safe | admin/staff | reachable under org boundary, org-bound insert | Partially Implemented | Yes (P0 reachability) | `V1 REQUIRED` | `routes.ts:3329` |
| Read/search postings | user | scoped, reachable | Partially Implemented | Yes (P0 + P2 scope) | `V1 REQUIRED` (reachability) | `searchJobPostings.ts` |
| Update/delete posting | admin/staff | reachable, org-safe | Partially Implemented | Yes (P0) | `V1 REQUIRED` | `routes.ts:3349,3357` |
| Create/update application | user/staff | reachable, org-safe | Partially Implemented | Yes (P0) | `V1 REQUIRED` | `routes.ts:267,274` |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| Jobs re-exports drop `@route("/association/jobs")` → all 7 ops emitted at ROOT | API contract / generated routing | **P0** | `V1 REQUIRED` | `main.tsp:723-727` (no `@route`); `routes.ts:267,274,3329,3336,3342,3349,3357` (root paths); `openapi.json` root paths | Root ops bypass `orgContextMiddleware` (`app.ts:419-432`, mounted on `/association/*` only). `createJobPosting` then has no tenant boundary: omit `body.organizationId` → `organization_id NOT NULL` violation → **500**; supply an arbitrary org id → **cross-org write** with no membership check. Twin of the fixed marketplace defect (P-1). | Add `@route("/association/jobs")` to both jobs re-exports; rebuild + regen |
| No regression net for the jobs prefix invariant | Test infrastructure | **P1** | `V1 REQUIRED` `[TEST GAP]` | only marketplace/advertising have `marketplace-advertising-route-prefix.test.ts` | Without a test, a future regen/spec edit silently re-drops the prefix; the P0 reappears undetected. The fix must ship with its guard. | Clone the marketplace net for jobs |
| Handler trusts `body.organizationId` rather than the tenant-resolved org | Backend/handler permission | **P1** | `V1 RECOMMENDED` | `createJobPosting.ts:17` | The prefix fix re-engages the boundary, but a handler that still writes `body.organizationId` may permit cross-org writes from an authenticated member of org A targeting org B. **Necessary-but-maybe-not-sufficient**: prefix fix is required first; handler hardening is the follow-up. `[NEEDS CONFIRMATION]` on what `orgContextMiddleware` sets on ctx and whether other modules read it. | Separate batch (Batch B) — out of Batch A scope |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| `POST /association/jobs/postings` | Admin posts a job within their org | Endpoint does not exist at that path; only `POST /postings` exists at root (no org boundary) | `routes.ts:3329`; `openapi.json` | P0 | Route-prefix invariant test (OpenAPI + routes.ts) |
| `POST /association/jobs/applications` | Member applies within org | Only `POST /applications` at root | `routes.ts:267` | P0 | Same regression net |
| Cross-org write attempt | Rejected by tenant boundary | At root, no boundary; insert proceeds with body-supplied org | `createJobPosting.ts:17`; `app.ts:419-432` | P0/P1 | Boundary test deferred to Batch B `[BLOCKED BY ENVIRONMENT]` for full runtime proof |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Jobs ops at root, no confirmed frontend consumer | dead/unreachable-as-intended route | no `apps/*` reference to `/association/jobs/*` found this pass `[NEEDS CONFIRMATION]` | Low (audit-scope) | Out of scope; the P0 fix is correct regardless of current consumers. Note for future product audit. |
| `ctx.req.param('organizationId')` fallback in `createJobPosting` | dead branch | no `:organizationId` path param on any jobs route | Low | Leave as-is in Batch A; revisit in Batch B handler hardening `[DO NOT OVERBUILD]` |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `job_posting.organization_id` `NOT NULL`, indexed | schema/model | `jobs.schema.ts:48,61` | (healthy) | Confirms org-scoping intent; reinforces that missing-org inserts are hard failures (the 500). No schema change needed for Batch A. |
| Root-path emission for org-scoped resource | API/generated routing | `routes.ts` + `openapi.json` | **P0** | The route-prefix fix (Batch A). |
| List org filter optional | backend/service | `jobs.repo.ts:30-31` | P2 | Default to tenant org — Batch B/C. |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Root ops bypass `orgContextMiddleware` tenant boundary | org/tenant isolation | `app.ts:419-432`; `routes.ts` root paths | **P0** | Batch A prefix fix |
| `createJobPosting` writes `body.organizationId` directly | cross-org write | `createJobPosting.ts:17` | **P1** | Batch B handler hardening `[NEEDS CONFIRMATION]` |
| Role gates present per-op (`user`, `association:admin/staff`) | RBAC | `routes.ts:267,274` | (healthy) | No change; role gates run after the prefix fix re-mounts the ops under `/association/*`. |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| n/a | — | Job board is operational data, not clinical/financial/legal records | — | No record-safety obligation triggered by this targeted audit. |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| KG not consulted this pass | — | Direct static evidence (OpenAPI JSON + routes.ts + TypeSpec + schema) is authoritative for a generated-routing defect | None — KG would add no certainty here. |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Jobs = a job board (postings + applications), org-scoped | `jobs.tsp`, `jobs.schema.ts` | Corrects the stale audit-index note ("background-job registry") | Doc-sync only; no action in Batch A. |

## 18. Webwright / Playwright Findings

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| Not used | n/a | n/a | Browser proof requires a booted+seeded stack (unavailable). Static proof is stronger for codegen defects. | Defer any live reproduction to the env pass (roadmap order 6). `[BLOCKED BY ENVIRONMENT]` |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `jobs/createJobPosting.test.ts` | backend/unit | handler create logic (mock ctx, org in body) | Medium |
| `jobs/searchJobPostings.test.ts` | backend/unit | search/list filters | Medium |
| `jobs/getJobPosting.test.ts` | backend/unit | read by id | Medium |
| `jobs/updateJobPosting.test.ts` | backend/unit | update | Medium |
| `jobs/deleteJobPosting.test.ts` | backend/unit | delete | Medium |
| `jobs/createJobApplication.test.ts` | backend/unit | application create | Medium |
| `jobs/updateJobApplication.test.ts` | backend/unit | application status update | Medium |
| `__tests__/marketplace-advertising-route-prefix.test.ts` | regression | the twin-defect prefix invariant (clone template) | High |

None of the handler tests exercise route registration / the `/association` prefix — they invoke handlers directly with a mock context. They cannot catch the P0.

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Jobs route-prefix invariant (7 ops: OpenAPI path + routes.ts registration + no-root-leak) | regression | Proves all jobs ops live under `/association/jobs/*` and none leak to root; goes RED today, GREEN after the fix; guards against future re-drop | **Before** (RED first), as the Batch A regression net |
| Cross-org write rejection (boundary) | integration/permission | Proves a member of org A cannot post a job to org B | During Batch B (handler hardening) — `[BLOCKED BY ENVIRONMENT]` for full live proof |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| `specs/api/src/main.tsp` | shared/platform | the service entrypoint re-export layer | Edited by the fix; already dirty from prior AHA work (marketplace/advertising). Touch only lines 723-727. | `[SHARED DEPENDENCY]` — minimal additive edit |
| Generated `routes.ts` / `validators.ts` / `registry.ts` | shared/platform (generated) | regenerated by the pipeline | Must be regenerated, never hand-edited | Run `cd specs/api && bun run build` then `cd ../../services/api-ts && bun run generate` |
| `orgContextMiddleware` (`app.ts:419-432`, `middleware/org-context.ts`) | shared/platform | the boundary the fix re-engages | No code change needed in Batch A — the mount already exists; the fix just routes jobs into it | No edit |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Add `@route("/association/jobs")` to both jobs re-exports + regen | P0 prefix | P0 | `V1 REQUIRED` | route-prefix regression | The Batch A fix; mirror marketplace exactly |
| Clone `marketplace-advertising-route-prefix.test.ts` → jobs analog | P1 test gap | P1 | `V1 REQUIRED` | (is the test) | RED before fix, GREEN after |
| Resolve org from tenant context in `createJobPosting`; reject mismatched body org | P1 handler trust | P1 | `V1 RECOMMENDED` | integration/permission | Batch B — `[NEEDS CONFIRMATION]` on ctx org source |
| Default `searchJobPostings` list filter to tenant org | P2 list scope | P2 | `V1 RECOMMENDED` | backend/unit | Batch B/C |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Broader job-board product features (saved searches, alerts, employer dashboards, etc.) | `V2 DEFERRED` | Outside the targeted P0 scope; no evidence they are V1-required `[DO NOT OVERBUILD]` |
| Refactor jobs handlers to a shared org-resolution helper across all modules | `[DO NOT OVERBUILD]` | A platform-wide refactor; the cross-cutting F-2 integrity-suite work (roadmap order 2) is the right venue, not this module pass |

## 24. Audit Decision

**FAIL** — the module has an open **P0**: all 7 job-board operations are emitted at root paths, bypassing the `/association/*` org-context boundary. This produces a 500 on org-less inserts (`organization_id NOT NULL`) and a cross-org write risk, and it ships without a regression net. The defect blocks reliable, tenant-safe V1 use of the job board. It is the single still-open P0 named in the consolidated roadmap §1/§8/§19.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| What does `orgContextMiddleware` set on ctx, and do jobs handlers (or any module) read it instead of `body.organizationId`? | `[NEEDS CONFIRMATION]` | Determines whether the prefix fix alone closes the cross-org write or whether Batch B handler hardening is required | Eng (Batch B) |
| Is there a frontend consumer of the job board today? | `[NEEDS CONFIRMATION]` | Affects priority of Batch B/C product completeness, not the P0 | Product |
| Live reproduction of the 500 / cross-org write | `[BLOCKED BY ENVIRONMENT]` | Needs a booted+seeded stack (roadmap order 6) | Platform (env pass) |

## 26. Notes for Gap Plan Organizer

For `03-organize-gap-plan-for-fixing.md`:

- **Batch A (run now, the only batch this 04 pass should touch):** the P0 route-prefix fix (`@route("/association/jobs")` on both jobs re-exports in `main.tsp:723-727`) + its RED-first regression net (clone `marketplace-advertising-route-prefix.test.ts`). Root cause is proven and identical to the already-fixed marketplace defect; the fix is one-line-per-interface and additive.
- **Test-first:** the jobs route-prefix test must be written and confirmed RED (ops at root) before the decorator is added; GREEN after regen.
- **Defer to Batch B (do NOT fix in this pass):** handler-org-trust hardening (`createJobPosting` writing `body.organizationId`), `searchJobPostings` org-scope defaulting — both `V1 RECOMMENDED`, both depend on `[NEEDS CONFIRMATION]` about `orgContextMiddleware`'s ctx contract.
- **Shared-dependency caution:** `main.tsp` + the three generated files are shared/platform; the edit is additive and scoped to the 2 jobs interfaces. Never hand-edit generated files — regenerate. Preserve the already-dirty working tree from the 13 prior AHA module passes.
- **Cross-cutting tie-in:** this same defect class is the subject of platform fix F-2 (unified generated-route integrity suite, roadmap order 2). Landing the jobs `@route` first is the prerequisite; the per-module net cloned here can later be merged into F-2.
- **Do not** turn this into a job-board product-completeness audit or a platform-wide org-resolution refactor.

---

```txt
Next recommended step:
Module/group: Jobs
Module slug: jobs
Primary PRD/spec: specs/api/src/modules/jobs.tsp
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/jobs-gap-plan.md
```
