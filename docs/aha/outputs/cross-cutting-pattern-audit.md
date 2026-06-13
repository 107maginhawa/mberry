# AHA Cross-Cutting Pattern Audit

Date: 2026-06-11
Prompt: `docs/aha/prompts/05-cross-cutting-pattern-audit.md`
Scope: cross-cutting platform patterns only (no module re-audit, no source/test/schema edits, no commit).
Codebase root: `/Users/elad-mini/Desktop/memberry`

> Method note: per-module recurrence was confirmed from the 14 `*-fix-report.md` files and the prompt-03/04 run logs (authoritative), cross-checked against the 14 `*-gap-plan.md` files and direct code inspection of `specs/api/src/main.tsp`, `services/api-ts/src/generated/openapi/{routes,validators}.ts`, `services/api-ts/src/app.ts`, and the platform-admin handler set. Broad keyword sweeps over gap plans were used only as directional signal, not as proof that a defect exists in every matched plan.

---

## 1. Inputs Reviewed

| Input | Details |
| --- | --- |
| Module audit index | `docs/aha/outputs/module-audit-index.md` (reviewed) |
| Gap plans reviewed | All 14: auth-rbac, billing-stripe, communications, documents-credentials, dues-payments, elections-governance, marketplace-advertising, membership-lifecycle, notifications-email, person-profile, platform-admin, realtime-comms, surveys-polls, training-credits (`docs/aha/module-gap-plans/*-gap-plan.md`) |
| Fix-ready plans reviewed | All 14 (`docs/aha/module-fix-plans/*-fix-ready-plan.md`) — context only; not treated as completion proof |
| Completed fix reports reviewed | All 14 (`docs/aha/module-fix-plans/*-fix-report.md`) — authoritative completion evidence, plus prompt-04 post-run adversarial-verification addendum |
| KG used | Yes (secondary) — `.understand-anything/knowledge-graph.json` (3,474 nodes / 8,259 edges, generated 2026-06-06, commit `0178b7c`) per `docs/aha/kg/knowledge-graph-status.md` |
| KG refreshed | No — partially stale (5 days old, doc-restructure commits not represented); blast-radius questions answerable via direct code inspection, so refresh not triggered |
| `/understand-domain` used | Yes (secondary) — `.understand-anything/domain-graph.json` per `docs/aha/kg/domain-knowledge-status.md` |
| `/understand-domain` refreshed | No — product docs (WORKFLOW_MAP, STATE_MACHINES, br-registry) richer/newer; sufficient |
| Webwright used | No — cross-cutting findings are backend/generator/test-infra; no UI-journey question required browser automation |
| Playwright/E2E inspected | Yes (coverage inventory only, not run) — `apps/admin/tests/e2e` (8 spec files) vs `apps/memberry` (~142 E2E specs). Admin app is thinly covered. |
| Shared/platform files inspected | `specs/api/src/main.tsp`; `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts`; `services/api-ts/src/app.ts`; `services/api-ts/src/scripts/generate.ts`; `services/api-ts/src/core/{billing,email}.ts`, `core/auth/officer-checks.ts`, `core/domain-event-consumers.ts`, `core/domain-events.ts`; `services/api-ts/src/middleware/{platform-admin-auth,org-context}.ts`; platform-admin handler set; `route-registry-rbac.test.ts`, `admin-route-walk.test.ts`, `marketplace-advertising-route-prefix.test.ts` |
| Limitations | (1) `[BLOCKED BY ENVIRONMENT]` — no booted/seeded DB: migrations `0062`/`0063`, Hurl contract suites, Playwright E2E unrunnable platform-wide. (2) KG 5 days stale; KG-derived claims marked `[NEEDS CONFIRMATION]` where recent code may differ. (3) Ungated-platform-mutation tier policy (tickets/breaches/subscriptions) is a product question, not a confirmed defect. |

---

## 2. Fix Status Interpretation

| Module/Group | Gap Plan Exists? | Fix-Ready Plan Exists? | Fix Report Exists? | Interpreted Status | Notes |
| --- | --- | --- | --- | --- | --- |
| auth-rbac | Yes | Yes | Yes | Partially Fixed | First batch COMPLETE; FIX-001 5-handler super-gate closed (incl. security follow-up); later enforcement batches deferred |
| billing-stripe | Yes | Yes | Yes | Partially Fixed | Batch A (redaction + webhook pagination) done; B/C/F deferred; stripe-mock CI env-blocked |
| communications | Yes | Yes | Yes | Partially Fixed | Batch A delivery spine done (`registerCommunicationJobs` wired in `app.ts`); feed + later batches deferred |
| documents-credentials | Yes | Yes | Yes | Partially Fixed | B1 done + isolated TypeSpec regen; 1 fake-green suite removed; A/C/F decision/env-gated |
| dues-payments | Yes | Yes | Yes | Partially Fixed | Batch A 3×P0 done + migration `0062`; B/C deferred |
| elections-governance | Yes | Yes | Yes | Partially Fixed | FIX-001 close-voting op done; G2 position-identity decision-gated |
| marketplace-advertising | Yes | Yes | Yes | Fixed (selected batch) | Batch A COMPLETE — dropped `/association` prefix root-caused + fixed; B+ deferred |
| membership-lifecycle | Yes | Yes | Yes | Partially Fixed | A/B done (P0 cron column bug, read-consistency, cross-org guard); state-machine cluster deferred |
| notifications-email | Yes | Yes | Yes | Partially Fixed | BR baseline + BR-57 reason-aware suppression done; contract/e2e layers deferred |
| person-profile | Yes | Yes | Yes | Partially Fixed | P0 privacy-key fix + Batch B done; generated-Zod bug routed here (prompt 05) |
| platform-admin | Yes | Yes | Yes | Partially Fixed | Batch D test-hardening COMPLETE (+ 3 super-gates landed, see `[SCOPE DEVIATION]`); enforcement P1s deferred |
| realtime-comms | Yes | Yes | Yes | Partially Fixed | Batch A real-time delivery + admin-upsert security done; WS flag (Batch E) + org_id migration (Batch F) deferred |
| surveys-polls | Yes | Yes | Yes | Fixed (selected batch) | Batch A read-auth COMPLETE; targetAudience union routed to 06 |
| training-credits | Yes | Yes | Yes | Partially Fixed | Batch A credit-award journey done (premise disproved, real bug fixed); paid-training policy decision-gated |

---

## 3. Recurring Patterns

| Pattern | Affected Modules/Groups | Severity | Scope Label | Evidence | Root Cause | Recommended Platform Fix |
| --- | --- | --- | --- | --- | --- | --- |
| **P-1 Dropped `/association` route-prefix on re-exports** (generated route emitted at root → bypasses `orgContextMiddleware` → `organization_id` NOT NULL → 500) | marketplace-advertising (**Fixed**), **jobs (Still Open)** | P0 | V1 REQUIRED | `specs/api/src/main.tsp:723-727` — `JobsJobPostingManagement`/`JobsJobApplicationManagement` carry only `@tag("Jobs")`, **no `@route`**; `generated/openapi/routes.ts:3329-3358` emit `app.post('/postings'`, `app.get('/postings'`, `/postings/:postingId` etc. **at root**, outside the `app.use('/association/*', … orgContextMiddleware())` mount (`app.ts:419-432`). Marketplace fixed by adding 7 `@route` decorators (`marketplace-advertising-fix-report.md` §4 FIX-001). Regression net exists: `__tests__/marketplace-advertising-route-prefix.test.ts`. | Re-export interfaces in `main.tsp` that omit `@route` cause TypeSpec to drop the source namespace's `@route` prefix and emit ops at root. No generator-level guard catches an unprefixed re-export. | (a) Add `@route("/association/jobs")` to both Jobs re-export interfaces (1-line-class fix, mirrors marketplace) + a regression test. (b) Add a generator/CI invariant: every re-export interface under `MonobaseAPI` whose source namespace declares an `@route("/association/…")` prefix must itself carry a matching `@route` (fail the build otherwise). Handle as a jobs `04` batch + the platform invariant. |
| **P-2 Generated Zod marks required path/body `organizationId`/`orgId` as `.optional()`** | person-profile (explicitly routed here), and any handler relying on the validator for org presence | P1 | V1 RECOMMENDED | `generated/openapi/validators.ts` — 30+ `organizationId: z.string().optional()` / `.uuid().optional()` lines (98, 193, 354, 409, 445, 569, 671, 715…). `person-profile-fix-report.md` §10 Blocked Items: "Generated Zod marks required `orgId` `.optional()` — TypeSpec→Zod generator bug, cross-cutting → Prompt 05". Generator at `services/api-ts/src/scripts/generate.ts` builds zod from OpenAPI schema. | TypeSpec→OpenAPI→Zod emission treats org id fields as optional even when the operation requires org context. Handlers must defensively re-check; if any handler trusts the validator, org scoping is silently skippable. | Trace which ops legitimately require `organizationId` and make the generator emit `.uuid()` (non-optional) for those; OR document that `orgContextMiddleware` is the sole org-presence authority and the validator field is advisory. Do NOT hand-edit generated files. One generator change + regen covers all modules. `[NEEDS CONFIRMATION]` on exact required-vs-optional set. |
| **P-3 Fake-green / low-assertion test suites** (suites pass without exercising real production code or assert tautologies) | platform-admin (**Fixed** — AC suite rewritten + 9 handlers backfilled), documents-credentials (**Fixed** — 1 fake-green suite removed), notifications-email (**Partially Fixed** — honest BR baseline, no fake registration), auth-rbac (**Fixed** — non-fake-green gate proof), dues-payments / billing-stripe / training-credits / realtime-comms / person-profile (flagged in gap plans) | P1 | V1 RECOMMENDED | `platform-admin-fix-report.md` §14 (FIX-001 fake-green AC suite rewritten to assert real code; FIX-002 9 untested handlers backfilled). `documents-credentials-fix-report.md` (fake-green removed). `notifications-email-fix-report.md` §14 (explicitly refused fake-green registration of unimplemented BRs). prompt-03/04 run logs name fake-green as the safest first-batch work. | No shared convention/CI gate forbidding assertion-free or mock-only "green" suites; modules independently accumulated suites that pass without touching prod code. | The 4 worst offenders are now repaired per-module. Platform-level: add a lint/CI check for assertion-free `test()` bodies and a convention doc. This is a convention gap, not a framework — keep it lightweight. Remaining flagged-but-unfixed suites belong to each module's later `04` batch. |
| **P-4 Generated-route middleware-chain integrity depends on a single un-guarded seam** (lost `@route`/`@extension` during regen silently de-protects routes) | marketplace-advertising, jobs, auth-rbac (officer/position gates), platform-admin (`/admin/*` mount) | P1 | V1 RECOMMENDED | `route-registry-rbac.test.ts` asserts `x-require-officer`/`x-require-position` spec-extension count == middleware mounts in `routes.ts` (FIX-005/G6). `admin-route-walk.test.ts` proves `/admin/*` 403 invariant. `marketplace-advertising-route-prefix.test.ts` proves org-context reachability. These three nets exist but cover only their own module's seam; there is no single "regeneration did not drop any auth/org gate" suite. | The TypeSpec→`routes.ts` generator is the chokepoint for org-context, officer/position, and audit middleware. A silent extension/decorator drop is a privilege-escalation or 500 class with no global guard. | Generalize the three existing regression nets into one platform "generated-route invariant" suite (prefix coverage + gate coverage + audit coverage), run in CI on every regen. Reuses existing patterns; low risk. |
| **P-5 Ungated platform-admin tier mutations** (handler checks session + reads `platformAdmin` but no `role !== 'super'` tier gate) | platform-admin | P1 / `[NEEDS PRODUCT DECISION]` | V1 RECOMMENDED (pending decision) | auth-rbac closed the 5 confirmed super-only handlers (`createOrganization`, `setFeatureFlag`, `transitionOrgStatus`, `deleteFeatureFlag`, `updateOrganization` — `auth-rbac-fix-report.md` §2/§12). Direct inspection finds 7 more mutations with only session + `platformAdmin` read and **no** `role !== 'super'` gate: `addTicketComment`, `createTicket`, `updateTicketStatus`, `reportBreach`, `updateBreachStatus`, `cancelSubscription`, `updateAssociation`. (`createPricingTier`/`updatePricingTier` DO gate super — false positives excluded.) The `/admin/*` mount enforces any-admin via `platformAdminAuthMiddleware`, not tier. | The matrix distinguishes super vs analyst/support, but tier enforcement is per-handler and inconsistently applied; tickets/breaches/subscriptions may be intentionally support-tier. | Product must decide which of the 7 are super-only vs support-accessible, then either add `role !== 'super'` gates or document them as support-tier with a test that pins the intended tier. Do NOT blanket-gate without the decision. |
| **P-6 `[BLOCKED BY ENVIRONMENT]` validation gap** (no booted/seeded DB → migrations, Hurl, E2E unrunnable) | ALL 14 modules | P1 (process) | V1 REQUIRED (env, not code) | Every fix report's §10/§14 cites `[BLOCKED BY ENVIRONMENT]`: migrations `0062`/`0063` not applied live (`DATABASE_URL` unset); Hurl contract suites and Playwright E2E un-run. prompt-04 run log "Environment pass" item. | No CI/local booted+seeded stack available during the audit/fix run; deterministic unit/regression nets substituted but contract+E2E layers unverified. | Not a code fix — stand up a booted+seeded test stack (apply `0062`/`0063`, run `bun test` + `scripts/run-contract-tests.ts` + E2E) to clear the blocker before the 2nd `04` pass. Cross-cutting blocker, owns its own pass. |
| **P-7 Cross-org / org-scoping read & write guards applied per-handler, not via a shared assertion** | membership-lifecycle (**Fixed** via new `utils/assert-record-org.ts`), realtime-comms (G4 fixed module-local), and the org-presence dependency in every `/association/*` module | P2 | V1 RECOMMENDED | `membership-lifecycle-fix-report.md` §12 added `utils/assert-record-org.ts` + cross-org 403 matrix across approve/deny/resign/terminate/decease/reinstate/renew/delete. realtime-comms relies on shared `orgContextOptionalMiddleware` across 9 prefixes (prompt-03 log). Pattern recurs but each module wrote its own guard. | `orgContextMiddleware` resolves `organizationId` but does not assert that a fetched record actually belongs to the caller's org — handlers must hand-roll the "record.orgId === ctx.orgId" check. | The membership `assert-record-org.ts` helper is a good candidate to promote to a shared `core/` helper IF 2+ more modules need the identical record-org assertion. Evidence is currently 1 strong + 1 partial — `[DO NOT OVERBUILD]` for now; revisit during 2nd `04` pass. |
| **P-8 Domain-event cascade reliability is fire-and-forget with no retry/aggregation** | person-profile (routed to core-platform audit), and the 9 `person.deleted` subscribers | P2 | V2 DEFERRED | `person-profile-fix-report.md` §10: "`core/domain-events.ts` per-subscriber retry / aggregation — changing bus delivery semantics affects every consumer → Core-platform audit". `core/domain-event-consumers.ts` holds 9 fire-and-forget subscribers (CLAUDE.md P1.6). | Bus delivery is best-effort; a failed subscriber silently drops a cleanup step (e.g. partial person-deletion cascade). | Changing delivery semantics is high blast-radius across all 9 consumers. Defer to a dedicated core-platform audit; only the EVENT_CONTRACTS doc correction is in-scope now. `V2 DEFERRED`. |
| **P-9 `check:sdk-compat` flags additive ops as breaking** | documents-credentials, elections-governance (`closeElectionVoting`), any module adding a TypeSpec op | P3 | V1 RECOMMENDED (DX) | prompt-04 log + `documents-credentials-fix-report.md` §10: the baseline gate (`docs/quality/SDK_BASELINE_OPS.json`, 1366 entries; `package.json:29` `check:sdk-compat`) trips on newly-added ops like `closeElectionVoting` even though they are purely additive. | The SDK-compat baseline is a frozen snapshot; additive ops require a manual baseline re-capture, which is easy to forget and produces false "breaking" signals. | Make the check distinguish additive (new op) from breaking (changed/removed op) and only fail on the latter; or document a one-line "re-capture baseline after additive ops" step. Low risk, removes recurring DX friction. |

---

## 4. Shared Files / Services With High Blast Radius

| File/Service/Component | Main Consumers | Risk | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| `specs/api/src/main.tsp` (`MonobaseAPI` re-exports) | Every module's OpenAPI emission flows through it → `generated/openapi/{routes,validators,registry}.ts` → Hono app | A missing/wrong `@route` on any re-export silently mis-mounts or de-org-scopes a whole module's routes (P-1) | marketplace fix touched only 7 decorators here; jobs defect lives at lines 723-727 | Treat as the single most load-bearing spec file. Add the generator prefix-coverage invariant (P-1/P-4). |
| `services/api-ts/src/scripts/generate.ts` (TypeSpec→routes/validators/zod) | All generated routes, validators, middleware chains, zod schemas | Generator quirks become platform-wide bugs: P-2 (optional org id), P-4 (gate drop on regen) | `generate.ts:507-531` emits role/auth middleware; zod emission at 420-455, 867-923 | Any change here needs the P-4 generated-route invariant suite as a regression net before/after. |
| `services/api-ts/src/app.ts` (`initializeApp`, mounts) | Boots all jobs + the `/association/*`, `/admin/*`, `/email/*`, `/invite` middleware mounts; 9 domain-event subscribers | Single line removal de-protects an entire surface (`/admin/*` guard; `/association/*` org-context) | `app.ts:419-449` mounts; communications added 1 line `registerCommunicationJobs`; `admin-route-walk.test.ts` pins the `/admin/*` invariant | Keep edits minimal & test-pinned (Batch E discipline already observed). `admin-route-walk.test.ts` is the right guard pattern. |
| `services/api-ts/src/core/email.ts` (Guard pipeline + `getSuppressionStatus`) | Every email producer: Better-Auth verify/reset/2FA, announcement jobs, dues dunning, notification-repo bridge | A guard regression suppresses or wrongly sends transactional/auth mail platform-wide | `notifications-email-fix-report.md` §8 — additive Guard-1 reason-aware change; full Guard 1-4 suite re-run green | Additive-only edits; existing `core/email.test.ts` is the guard. Low residual risk. |
| `services/api-ts/src/core/billing.ts` (Stripe client + redaction) | billing, dues online-payment, platformadmin, booking | Secret-key leak / webhook pagination affects financial integrity across modules | `billing-stripe-fix-report.md` (Batch A redaction-only); prompt-03 log notes blast radius into platformadmin/booking | Redaction fix landed; webhook/pagination + B/C/F deferred. Regression-test any future edit across all 4 consumers. |
| `services/api-ts/src/core/auth/officer-checks.ts` (`requireOfficerTerm`/`requirePosition`) | Inline-checked handlers + 2FA enforcement branch | A weakened check is a privilege escalation on every inline-gated route | `auth-rbac-fix-report.md` FIX-002 added 2FA branch; `route-registry-rbac.test.ts` guards the generated path | Inline path covered by handler tests; generated path covered by the RBAC regression net. Keep both. |
| `services/api-ts/src/core/domain-event-consumers.ts` + `core/domain-events.ts` | 9 `person.deleted` subscribers + `announcement.published` etc. | Fire-and-forget bus: a silent subscriber failure drops a cleanup step (P-8) | `person-profile-fix-report.md` §10; CLAUDE.md P1.6 | Delivery-semantics change is V2 / core-platform audit. Do not touch in module batches. |
| `services/api-ts/src/middleware/platform-admin-auth.ts` + `org-context.ts` | `/admin/*` (any-admin) and `/association/*` (org resolution) | The two boundary guards for the privileged + org-scoped surfaces; tier enforcement is NOT here (P-5) | `admin-route-walk.test.ts`; `org-context.ts` fails closed with 403 | `/admin/*` any-admin guard is solid + tested. Per-handler tier gating is the open question (P-5). |

---

## 5. Platform-Level Fix Candidates

| Fix | Why Platform-Level | Modules Helped | Severity Addressed | Test Requirements | Risk |
| --- | --- | --- | --- | --- | --- |
| **F-1 Generator invariant: every `/association/*` re-export carries a matching `@route`** (plus apply the jobs `@route("/association/jobs")` fix) | Prevents the P-1 dropped-prefix 500/org-bypass class for ALL future re-exports, not just jobs | jobs (immediate), all future association re-exports | P0 (jobs route) + P1 (invariant) | Extend `marketplace-advertising-route-prefix.test.ts` into a generic prefix-coverage assertion; regen after the jobs `@route` add | Low — additive decorator + read-only spec assertion |
| **F-2 Unified generated-route integrity suite** (prefix + officer/position gate + audit-extension coverage in one CI net) | The generator is the single chokepoint for org-context, RBAC, and audit middleware (P-4) | marketplace, jobs, auth-rbac, platform-admin, every audited module | P1 | Merge `route-registry-rbac.test.ts` + `admin-route-walk.test.ts` + prefix net into one suite; run on every `bun run generate` | Low — read-only assertions over generated files |
| **F-3 Generator: emit non-optional `organizationId` for org-required ops** | Fixes P-2 once at the generator instead of defensive re-checks in every handler | person-profile + any handler trusting the validator for org presence | P1 | Generator unit test on the required-org op set; regen; `[NEEDS CONFIRMATION]` on the exact set | Medium — must not flip genuinely-optional ops to required; needs the required-op list first |
| **F-4 CI gate against assertion-free / mock-only "green" tests** + a one-page test-honesty convention | Removes the P-3 fake-green class platform-wide; 4 modules already repaired, gate prevents recurrence | platform-admin, documents, notifications-email, auth-rbac (done) + the rest | P1 | Lint rule for empty/tautological `test()` bodies; convention doc | Low — additive lint, no behavior change |
| **F-5 `check:sdk-compat` additive-vs-breaking discrimination** | Removes recurring false "breaking" DX friction (P-9) on every additive op | documents, elections, every module adding ops | P3 | Update `scripts/check-sdk-compat.ts` to classify additive vs changed/removed; test both paths | Low |

---

## 6. Issues That Should Stay Module-Local

| Issue | Module/Group | Why Not Platform-Level | Recommendation |
| --- | --- | --- | --- |
| Webhook→ledger seam + per-org receipt counter | dues-payments | Domain-specific payment lifecycle; migration `0062` is dues-only | Keep module-local (already Fixed in Batch A) |
| Nightly status-recompute cron column bug + keyset pagination | membership-lifecycle | Membership status logic is module-owned | Keep module-local (Fixed) |
| Election close-voting state transition op | elections-governance | Governance state machine is module-specific | Keep module-local (Fixed) |
| Real-time WS broadcast on `sendChatMessage` + admin-upsert security | realtime-comms | Comms-specific delivery path | Keep module-local (Batch A Fixed) |
| BR-57 reason-aware transactional suppression | notifications-email | Email suppression semantics are email-domain rules (additive `core/email.ts` change already minimal) | Keep module-local (Fixed) |
| Privacy PATCH `orgId`/`organizationId` key mismatch | person-profile | Handler-local key bug, not a shared contract | Keep module-local (Fixed); the generated-Zod root cause is the only cross-cutting slice (P-2) |

---

## 7. Do Not Centralize Yet

| Candidate | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Promote `membership/utils/assert-record-org.ts` to a shared `core/` record-org guard | `[DO NOT OVERBUILD]` | Only 1 strong + 1 partial consumer today; centralizing now risks a premature abstraction. Revisit if the 2nd `04` pass shows 2+ more modules need the identical assertion (P-7). |
| Domain-event bus retry / aggregation / delivery-guarantee layer | `V2 DEFERRED` | High blast radius across 9 subscribers; needs a dedicated core-platform audit, not a module batch (P-8). |
| Generic per-module pagination primitive | `[DO NOT OVERBUILD]` | Pagination shows up across plans but the implementations differ by domain (keyset vs offset vs cursor); membership already keyset-paginated locally. No shared bug, just shared topic. |
| Blanket super-only gate on all 7 ungated platform mutations | `[NEEDS PRODUCT DECISION]` | Tickets/breaches/subscriptions may be intentionally support-tier; gating without the policy decision could break legitimate analyst/support flows (P-5). |
| New RBAC framework/engine | `DO NOT ADD` | The `@extension`-driven officer/position + `role !== 'super'` + `platformAdminAuthMiddleware` stack is adequate; the gap is enforcement coverage + a regression net, not a new abstraction. |

---

## 8. Test Infrastructure Findings

| Finding | Evidence | Affected Modules | Recommended Fix | Priority |
| --- | --- | --- | --- | --- |
| Fake-green / assertion-free suites accumulated with no CI guard | `platform-admin-fix-report.md` §14 (AC suite rewritten, 9 backfilled); `documents-credentials-fix-report.md` (suite removed); `notifications-email-fix-report.md` §14 | platform-admin, documents, notifications-email, auth-rbac (repaired); dues/billing/training/realtime/person (flagged) | F-4: lint gate for empty/tautological tests + convention doc | P1 |
| Generated-route gates only protected by per-module nets, no unified suite | `route-registry-rbac.test.ts`, `admin-route-walk.test.ts`, `marketplace-advertising-route-prefix.test.ts` each cover one seam | marketplace, jobs, auth-rbac, platform-admin | F-2: unify into one generated-route integrity suite run on every regen | P1 |
| No booted/seeded stack → Hurl contract + Playwright E2E + live migration apply unrunnable | every fix report §10/§14 `[BLOCKED BY ENVIRONMENT]`; prompt-04 run log | ALL 14 | P-6: stand up booted+seeded test stack; apply `0062`/`0063`; run contract + E2E | P1 |
| Admin app E2E coverage is thin (8 specs) vs memberry (~142) | `apps/admin/tests/e2e/` = 8 files (organizations, admin-smoke, wave7-role-gate, helpers); memberry ~142 | platform-admin / admin app | Expand admin role-gate + critical-flow E2E once the stack is booted (defer until P-6 cleared) | P2 |
| `check:sdk-compat` baseline produces false "breaking" on additive ops | `documents-credentials-fix-report.md` §10; `SDK_BASELINE_OPS.json` (1366 ops) | documents, elections, any additive module | F-5: additive-vs-breaking discrimination | P3 |

---

## 9. Domain / Workflow Pattern Findings

| Finding | Affected Modules/Groups | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Org-context is the sole org-presence authority but record-org *ownership* is asserted ad hoc per handler `[INFERRED]` | membership-lifecycle, realtime-comms, all `/association/*` modules | `membership-lifecycle-fix-report.md` §12 new `assert-record-org.ts`; `org-context.ts` resolves orgId but does not assert record ownership | Medium — a missing per-handler check is a cross-org data-leak vector | Standardize the "record.orgId === ctx.orgId or 403" pattern as a documented convention; promote to shared helper only on repeated evidence (see P-7 / §7). |
| Person-deletion cascade correctness depends on best-effort bus delivery `[NEEDS CONFIRMATION]` | person-profile + 8 modules | `person-profile-fix-report.md` §10; CLAUDE.md P1.6 (9 subscribers) | High if a subscriber silently fails mid-cascade | Core-platform audit for delivery guarantees (P-8 / V2 DEFERRED); EVENT_CONTRACTS doc correction in scope now. |

---

## 10. Webwright / Playwright Findings

| Finding | Tool | Evidence Location | Affected Modules/Groups | Recommendation |
| --- | --- | --- | --- | --- |
| Admin app E2E coverage thin (8 specs) vs memberry (~142); role-gate journeys lightly covered at browser level | Playwright (inventory only, not run) | `apps/admin/tests/e2e/{organizations,admin-smoke,wave7-role-gate}.spec.ts` | platform-admin / admin app | Expand admin role-gate + privileged-flow E2E after the booted stack lands (P-6). Not run this pass (env-blocked). |
| Live contract/E2E validation of every fixed module is outstanding | Playwright + Hurl (not run) | every fix report §14 `[BLOCKED BY ENVIRONMENT]` | ALL 14 | Run full E2E + Hurl post-P-6; no browser automation executed this pass (no evidence captured, no screenshots saved). |

---

## 11. Database / Schema-Related Cross-Cutting Findings

Do not perform a full schema audit here. Items below are routed to `06-database-schema-audit.md`.

| Finding | Affected Modules/Groups | Evidence | Should Go To `06-database-schema-audit.md`? | Recommendation |
| --- | --- | --- | --- | --- |
| `targetAudience` union representation | surveys-polls | prompt-03/04 logs; surveys gap plan | Yes | Route to 06 |
| Person-deletion FK cascades | person-profile + cascade subscribers | `person-profile-fix-report.md`; prompt-04 log | Yes | Route to 06 (delivery semantics → core-platform; FK design → 06) |
| Certificate schema backfill | documents-credentials | `documents-credentials-fix-report.md` §10 (Q8) | Yes | Route to 06 |
| Additive `resigned_at` column | membership-lifecycle | membership fix report Batch F (deferred) | Yes | Route to 06 |
| `org_id` NOT NULL migration | realtime-comms | prompt-03 log (Batch F) | Yes | Route to 06 |
| Per-org receipt counter (`0062`) + webhook metadata indexes (`0063`) — added but not applied live | dues-payments, billing-stripe | migrations present in working tree; `[BLOCKED BY ENVIRONMENT]` | Apply/verify under 06 + the env pass | Route migration-apply verification to 06 + P-6 env pass |

---

## 12. Recommended Platform Fix Order

| Order | Fix | Why Now | Modules Helped | Tests Needed First | Risk | Recommended Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **F-1** jobs `@route("/association/jobs")` + re-export prefix invariant (closes P-1) | Open P0: `/postings` ops emit at root, bypass org-context → 500 / cross-org write | jobs + all future association re-exports | Extend the marketplace prefix net to cover jobs + generic invariant | Low | `04-module-or-group-fix-tdd.md` (jobs batch) + platform invariant |
| 2 | **F-2** unified generated-route integrity suite (closes P-4) | Locks in the prefix/RBAC/audit guards before any further regen | marketplace, jobs, auth-rbac, platform-admin, all | Merge the 3 existing nets | Low | future specialized platform fix prompt |
| 3 | **F-4** fake-green CI gate + convention (closes P-3 recurrence) | 4 modules repaired; gate stops regrowth | platform-admin, documents, notifications-email + rest | Lint rule + doc | Low | future specialized platform fix prompt |
| 4 | **P-6** booted+seeded stack env pass (unblocks contract/E2E/migration verify) | Clears `[BLOCKED BY ENVIRONMENT]` for all 14 | ALL | n/a (infra) | Medium | resolve environment/tooling blocker, then 2nd `04` pass |
| 5 | **F-3** generator non-optional org id for required ops (closes P-2) | Removes defensive-recheck burden across modules | person-profile + all org-scoped | Required-org op list + generator unit test | Medium | future specialized platform fix prompt |
| 6 | **P-5** product decision on 7 ungated platform mutations, then gate/document | Privilege-tier clarity before enforcement | platform-admin | Tier-pinning tests after decision | Low (post-decision) | request product decision → `04` (platform-admin batch) |
| 7 | **F-5** `check:sdk-compat` additive-vs-breaking | Removes recurring DX false alarms | documents, elections, all | Both-path test | Low | future specialized platform fix prompt |
| — | Schema items (targetAudience, FK cascades, cert schema, `resigned_at`, `org_id` NOT NULL, `0062`/`0063` apply) | Data-layer review | membership, dues, billing, surveys, documents, realtime, person | n/a | n/a | `06-database-schema-audit.md` |

---

## 13. Dependencies / Blockers

| Blocker | Label | Why It Matters | Suggested Next Step |
| --- | --- | --- | --- |
| No booted/seeded DB stack | `[BLOCKED BY ENVIRONMENT]` | Migrations `0062`/`0063`, Hurl contract suites, Playwright E2E all unrunnable → fixed modules contract/E2E-unverified | Stand up stack; apply migrations; run `bun test` + `scripts/run-contract-tests.ts` + E2E (P-6) |
| 7 ungated platform mutations tier policy | `[NEEDS PRODUCT DECISION]` | Determines whether tickets/breaches/subscriptions are super-only or support-tier (P-5) | Product decides per-handler tier, then gate or document |
| Required-vs-optional `organizationId` op set (P-2 / F-3) | `[NEEDS CONFIRMATION]` | Must know which ops legitimately require org id before flipping generator output | Trace org-required ops; confirm against `orgContextMiddleware` coverage |
| Domain-event delivery semantics change | `[CROSS-MODULE RISK]` | Touches all 9 `person.deleted` subscribers (P-8) | Dedicated core-platform audit, not a module batch |
| KG 5 days stale | `[NEEDS CONFIRMATION]` | Doc-restructure + post-Jun-6 changes not represented; blast-radius claims from KG flagged | Refresh `/understand-anything` before any KG-dependent platform fix |

---

## 14. Deferred / Do Not Build

| Item | Label | Why Not Active |
| --- | --- | --- |
| Domain-event bus retry/aggregation/delivery-guarantee layer | `V2 DEFERRED` | High blast radius; needs dedicated core-platform audit (P-8) |
| Shared `core/` record-org guard from `assert-record-org.ts` | `[DO NOT OVERBUILD]` | Only 1 strong consumer today; revisit on repeated evidence (P-7) |
| Generic platform pagination primitive | `[DO NOT OVERBUILD]` | Implementations differ by domain; no shared bug |
| New RBAC framework/engine | `DO NOT ADD` | Existing `@extension` + `role`/`platformAdminAuthMiddleware` stack is adequate; gap is coverage + regression net |
| Blanket super-gate on all platform mutations | `DO NOT ADD` (pending P-5 decision) | Could break legitimate support-tier flows |

---

## 15. Recommended Next Step

**Run `06-database-schema-audit.md`** next.

Rationale: the cross-cutting code-level patterns are now triaged with a clear fix order (§12), and the largest remaining *unaudited* surface is the data layer. Multiple modules independently routed schema items here (§11): `targetAudience` union (surveys-polls), person-deletion FK cascades (person-profile + 8 cascade modules), certificate schema backfill (documents-credentials), additive `resigned_at` (membership-lifecycle), `org_id` NOT NULL (realtime-comms), and verification that migrations `0062_dues_receipt_counter` / `0063_billing_webhook_metadata_indexes` apply cleanly. Prompt 06 is the correct owner for all of these and must precede the consolidated roadmap (07).

In parallel (not blocking 06), the highest-value code fix surfaced here is the **jobs `/postings` dropped-`/association`-prefix P0** — handle via:

```txt
Module/group: Jobs
Module slug: jobs
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Fix: add @route("/association/jobs") to JobsJobPostingManagement + JobsJobApplicationManagement
     in specs/api/src/main.tsp:723-727 (mirrors marketplace FIX-001); rebuild + regen; add a
     route-prefix regression test (clone __tests__/marketplace-advertising-route-prefix.test.ts).
Then generalize into the platform generated-route integrity suite (F-2) + the re-export
prefix-coverage invariant (F-1).
```

Then resolve the environment blocker (P-6 booted+seeded stack) so the contract/E2E/migration layers can be validated before the consolidated remediation roadmap (`07-consolidate-roadmap.md`).
