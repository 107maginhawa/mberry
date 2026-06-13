# AHA Fix-Ready Plan: Jobs (Job Board)

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Jobs (Job Board — m15) |
| Module slug | jobs |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/jobs-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/jobs-fix-ready-plan.md` |
| Audit decision | FAIL (one open P0) |
| Superpowers used | No (organize step) — `superpowers:using-superpowers` will be invoked in the 04 fix step per the prompt |
| Organizer decision | PARTIALLY READY — Batch A is fully fix-ready now; Batch B is valid but gated on `[NEEDS CONFIRMATION]` and is explicitly excluded from the first 04 pass |
| Reason | The P0 root cause is proven and identical to the already-fixed marketplace/advertising defect; the fix is a one-decorator-per-interface additive change + a cloned regression test. Adjacent handler-trust items lack the ctx-contract confirmation needed to fix safely and are deferred. |
| Limitations | No booted+seeded stack → full runtime (live-DB) proof of the 500 / cross-org write is `[BLOCKED BY ENVIRONMENT]`; the fix is validated deterministically via the generated artifacts (OpenAPI + routes.ts), focused jobs tests, and `tsc --noEmit`. |

## 2. Fix Strategy Summary

- **Fix first (Batch A, now):** add `@route("/association/jobs")` to the two jobs interface re-exports in `specs/api/src/main.tsp` (`JobsJobPostingManagement`, `JobsJobApplicationManagement`, lines 723-727), mirroring the advertising/marketplace re-exports immediately above/below them. Then rebuild the OpenAPI (`cd specs/api && bun run build`) and regenerate routes/validators/registry (`cd services/api-ts && bun run generate`). Ship it with a **RED-first** regression test cloned from `marketplace-advertising-route-prefix.test.ts`, covering all 7 jobs ops (OpenAPI path + routes.ts registration + no-root-leak).
- **Do not fix now:** handler-org-trust hardening (`createJobPosting` writing `body.organizationId`) and `searchJobPostings` org-scope defaulting. Both are real (`V1 RECOMMENDED`) but depend on a `[NEEDS CONFIRMATION]` about what `orgContextMiddleware` sets on ctx; fixing blind risks breaking the contract or faking the guard. They form **Batch B**, deferred.
- **Major risk:** the only shared/platform file edited is `main.tsp` (additive, 2 decorators) plus the 3 regenerated files. The working tree is already dirty from 13 prior AHA module passes — the edit must be surgical (only lines 723-727) and the regen diff must be scoped to the jobs ops. Never hand-edit generated files.
- **One pass or multiple?** One pass for Batch A. Batch B is a separate future 04 pass after the ctx-contract confirmation.
- **Shared/platform/database work required?** Shared (`main.tsp` + generated). No database/schema change. No product decision blocks Batch A.

## 3. Active Fix Scope

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | Jobs re-exports drop `@route("/association/jobs")` → all 7 ops at ROOT → bypass `orgContextMiddleware` → 500 / cross-org write | **P0** | `V1 REQUIRED` | Batch A | Single still-open P0 (roadmap §1/§8/§19); proven twin of fixed marketplace defect | `main.tsp:723-727`; `routes.ts:267,274,3329,3336,3342,3349,3357`; `jobs.schema.ts:48` |
| FIX-002 | No regression net for the jobs route-prefix invariant | **P1** | `V1 REQUIRED` `[TEST GAP]` | Batch A | Without it the prefix can silently re-drop on a future regen; the fix must ship with its guard. RED-first proves FIX-001 fails today for the right reason. | absence of a jobs analog to `__tests__/marketplace-advertising-route-prefix.test.ts` |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| **Batch A** | P0 route-prefix fix + its RED-first regression net | FIX-001, FIX-002 | Low — additive decorators + cloned test; proven pattern | **run in current `04` pass** |
| Batch B | Handler org-trust hardening (`createJobPosting` body-org; `searchJobPostings` org-scope default) | (FIX-003/FIX-004 — not yet promoted) | Medium — touches handler authz logic | **only after product/eng confirms the `orgContextMiddleware` ctx contract** (`[NEEDS CONFIRMATION]`); separate `04` pass |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | Jobs route-prefix invariant test (must be RED before the decorator is added) | regression | All 7 jobs ops are emitted under `/association/jobs/*` in BOTH `openapi.json` AND `routes.ts`, and none leak to root paths (`/postings`, `/applications`) | NEW: `services/api-ts/src/handlers/__tests__/jobs-route-prefix.test.ts` (clone of `marketplace-advertising-route-prefix.test.ts`) |
| FIX-002 | (same file — the test IS the deliverable) | regression | Goes RED today (ops at root), GREEN after regen | same |

Baseline expectation: with the test written but BEFORE the `main.tsp` edit + regen, the "OpenAPI emits prefix" and "routes.ts registers under prefix" assertions FAIL and the "no root leak" assertions FAIL (because `/postings`, `/applications` still exist at root) — i.e. RED for the correct reason. After the decorator + regen, all assertions pass.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `specs/api/src/main.tsp` (lines 723-727, +2 `@route` decorators) | shared/platform | Low — additive; mirrors existing advertising/marketplace re-exports; affects only the 7 jobs ops' paths |
| FIX-001 (generated) | `services/api-ts/src/generated/openapi/routes.ts`, `validators.ts`, `registry.ts` (regenerated, NOT hand-edited) | shared/platform (generated) | Scoped — jobs ops move from root → `/association/jobs/*`; no other module's ops should change |
| FIX-002 | `services/api-ts/src/handlers/__tests__/jobs-route-prefix.test.ts` (NEW) | module-local (test) | None (test-only) |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001 | shared/platform | `specs/api/src/main.tsp` re-export layer | The edit site | No prerequisite — additive |
| FIX-001 | shared/platform | codegen pipeline (`specs/api: bun run build`; `api-ts: bun run generate`) | Regenerates routes/validators/registry from the edited spec | Must run AFTER the edit; never hand-edit generated output |
| FIX-001 | shared/platform | `orgContextMiddleware` mount `app.ts:419-432` | The boundary the fix re-engages | Already exists; no edit needed |
| FIX-001 | environment/tooling | drizzle-kit / live DB | NOT needed — no schema change in Batch A | No |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| What `orgContextMiddleware` sets on ctx; whether handlers should read it instead of `body.organizationId` | `[NEEDS CONFIRMATION]` | Batch B (FIX-003/004) | Determines whether the prefix fix alone closes the cross-org write, and how to harden the handler without breaking the contract | Confirm before any Batch B pass — **does not block Batch A** |
| Live reproduction of the 500 / cross-org write | `[BLOCKED BY ENVIRONMENT]` | FIX-001 (validation only) | Full runtime proof needs a booted+seeded stack | Deterministic generated-artifact + unit proof is sufficient for Batch A; live proof deferred to roadmap order 6 (env pass) |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Batch B handler-org-trust hardening | `[NEEDS CONFIRMATION]` | Safe fix depends on the `orgContextMiddleware` ctx contract | Eng confirms the ctx org source + cross-module read pattern |
| Live (Hurl/E2E) reproduction & verification | `[BLOCKED BY ENVIRONMENT]` | No booted+seeded API/Postgres | Stand up the seeded test stack (roadmap order 6) |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| `createJobPosting` resolve org from tenant context, reject mismatched body org | Critical Gaps row 3 / §5 | `V1 RECOMMENDED` | Batch B — gated on `[NEEDS CONFIRMATION]` |
| `searchJobPostings` default list filter to tenant org | §5 / §13 | `V1 RECOMMENDED` | Batch B/C — gated on same confirmation |
| Broader job-board product features | §23 | `V2 DEFERRED` | Outside targeted P0 scope |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Platform-wide shared org-resolution helper refactor across all modules | §23 | Belongs to cross-cutting F-2 (generated-route integrity suite, roadmap order 2), not this module pass `[DO NOT OVERBUILD]` |
| Job-board UI / employer dashboards / alerts | §23 | No V1 evidence; speculative `[DO NOT OVERBUILD]` |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | **Root cause** | TypeSpec drops a source-namespace `@route` when a re-exported interface does not redeclare it. Adding `@route("/association/jobs")` to the re-exports is the root-cause fix, not a symptom patch. Identical to the marketplace/advertising resolution. |
| FIX-002 | **Root cause (prevention)** | A deterministic generated-artifact invariant test prevents silent regression of the same root cause. |

## 13. Recommended First Fix Batch

**Batch A** — P0 route-prefix fix + regression net.

- **Included Fix IDs:** FIX-001, FIX-002
- **Why first:** it is the single still-open P0 (roadmap §1/§8 order 1/§19); the root cause and fix shape are already proven by the marketplace twin; the change is low-risk and additive.
- **Tests to write first:** `services/api-ts/src/handlers/__tests__/jobs-route-prefix.test.ts` (clone of the marketplace net), confirmed RED before the decorator edit.
- **Explicit out-of-scope:** Batch B handler-org-trust hardening; `searchJobPostings` org-scope default; any job-board product features; any platform-wide refactor; any hand-edit of generated files; any change to `app.ts` or the schema.

## 14. Instructions for 04 Fix Prompt

- **Module/group:** Jobs (Job Board)
- **Module slug:** jobs
- **Fix-ready plan path:** `docs/aha/module-fix-plans/jobs-fix-ready-plan.md`
- **Batch to execute first:** Batch A (FIX-001 + FIX-002) — and ONLY Batch A.
- **Invoke `superpowers:using-superpowers` before implementing** (per 04 §3).
- **Tests to prioritize:** write `services/api-ts/src/handlers/__tests__/jobs-route-prefix.test.ts` first (clone `marketplace-advertising-route-prefix.test.ts`); run it; confirm RED for the right reason (jobs ops at root) BEFORE editing the spec.
- **The fix:** add `@route("/association/jobs")` to `JobsJobPostingManagement` and `JobsJobApplicationManagement` in `specs/api/src/main.tsp` (lines 723-727), mirroring the advertising/marketplace re-exports. Then `cd specs/api && bun run build` and `cd ../../services/api-ts && bun run generate`. Confirm the regen diff is scoped to the jobs ops (do NOT revert prior modules' generated changes already in the tree).
- **GREEN:** the new test passes; run focused jobs module tests (`bun test src/handlers/jobs/ src/handlers/__tests__/jobs-route-prefix.test.ts`) + `bunx tsc --noEmit`. Do not run the whole repo suite.
- **Git safety:** `git status --short` first; preserve all existing working-tree changes; FORBIDDEN: `git reset --hard`, `git checkout .`, `git clean -fd`, `git restore .`, `rm -rf`. Do NOT commit.
- **Do not implement:** Batch B, deferred items, do-not-build items, or any change beyond the 2 decorators + 1 test + regen.

---

```txt
Next recommended step:
Module/group: Jobs
Module slug: jobs
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/jobs-fix-ready-plan.md
Recommended batch: Batch A (FIX-001 + FIX-002)
```
