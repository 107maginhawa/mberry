# Test-Coverage Remediation — Reference & System

> **Created:** 2026-06-22 · **Source:** 5-dimension coverage audit (2026-06-22)
> **Authoritative backlog:** [`remediation-backlog.json`](./remediation-backlog.json) (machine-readable, AI/codegraph-navigable)
> **BR source of truth:** [`../business/br-registry.json`](../business/br-registry.json) — link by `brIds`, never duplicate rule text here.

This is the live, systematic plan to close our test-coverage **and** test-integrity
gaps. It is built to match the codebase standards so each item can be executed
as a proper slice, not a one-off patch.

---

## Why this exists (the honest state)

A coverage audit on 2026-06-22 found:

| Metric | Value |
|---|---|
| Business rules COMPLETE | **43 / 77 (56%)** |
| INCOMPLETE (backend-only, no contract/e2e) | 28 |
| DEFERRED (product-gated) | 5 |
| UNTESTED | 1 (BR-48) |
| Phase 1 | 35/39 ✅ |
| Phase 2 (billing/booking/email) | **8/35** |

Two things are true at once:
1. **Every test that exists passes** — the suite is green, all CI gates green on main.
2. **Coverage is not complete, and green ≠ correct.** The coverage gate passes by
   *tolerating* a 28-BR allowlist; and this session found **three** cases where the
   suite was green while the live feature was broken (survey `settings.anonymous`
   read flat, response count shape, admin blank-SPA). Test **integrity** is the
   real problem, so it is **Wave R1**.

---

## How items map to the codebase standards

Every backlog item is shaped by the five standards. This is what "set up the
right way" means here.

| Standard | How the backlog enforces it |
|---|---|
| **TDD** (VERTICAL_TDD Rule 1) | Each item lists `redTargets` — the **failing tests to write first**, tagged `[BR-##]`. Implementation only after RED. |
| **Spec-driven** | Contract gaps are closed at **TypeSpec → OpenAPI → Hurl**, not by hand-asserting JSON. Any op change → rebuild + **regenerate SDK** (CI diffs `packages/sdk-ts/src/generated`). |
| **Vertical slice** (VERTICAL_TDD Rule 2) | Each item lists `missingSteps` = which of the **11 steps** remain. A slice is built end-to-end, never as a horizontal "all contract tests first" batch. One slice = one PR. |
| **Domain design** | Items are grouped by **bounded context / module** (M20 booking, M21 billing, M22 email, …). Slices stay inside their domain's repos/schemas; cross-module effects go through the **domain event bus**, not inline orchestration. |
| **Codegraph** | Each item has `codegraphAnchors` (symbol names). An agent resolves them against `.codegraph/codegraph.db` to jump to the code, **prove wiring** (callers), and trace the slice. |

---

## Priority waves (risk-first)

Do them in order. Rationale in the JSON.

- **R1 — Test Integrity.** Make green mean correct *before* backfilling more
  (possibly-blind) tests. FE mock-vs-API shape divergence, `.fixme()` e2e stubs,
  characterization-only pure-fn tests on live modules, e2e-asserts-visibility.
- **R2 — P0 security/data.** Critical rules that are backend-only **and** in two
  cases have an actual behavioral gap: the **bounce/complaint webhook → suppression
  is unwired** (BR-55/56), Stripe webhook signature (BR-62), billing key
  encryption (BR-65), payment guards (BR-60/61/63/64), double-booking (BR-69).
- **R3 — Workflow depth.** Turn the selector-only money/governance journeys (dues
  lifecycle, refund, election, paid-training) into 4-clause **firewall** journeys
  with durable independent-session reads. Plus dues-assessment/credits contract
  backfill.
- **R4 — Axis backfill + module depth.** The long tail: M20/M22 contract/e2e,
  raise the surveys floor (30%), integration depth on comms / association:operations,
  resolve BR-48.
- **DEFERRED — product-gated.** BR-35 (feed), BR-38 (marketplace), and the
  remaining axes of the already-shipped BR-37/39/40. Tied to a product go/no-go;
  **don't autonomously build.**

---

## Using the codegraph (AI navigation)

`.codegraph/codegraph.db` is a queryable SQLite graph (`nodes` + `edges`) of the
whole repo, from the `understand-anything` plugin. Use it to resolve an item's
`codegraphAnchors` and to **mechanically check wiring**.

```bash
# Where is a symbol?
sqlite3 .codegraph/codegraph.db \
  "select id, kind, file_path, start_line from nodes where name='addSuppression';"

# Who calls it? (is the trigger wired?)
sqlite3 .codegraph/codegraph.db \
  "select src.name, src.file_path from edges e \
     join nodes src on e.source=src.id join nodes tgt on e.target=tgt.id \
   where tgt.name='addSuppression' and e.kind='calls';"
```

> **Worked example (R2-1):** the query above shows `addSuppression`'s only callers
> are `*.integration.test.ts` files → the production bounce/complaint webhook is
> **unwired**. That is the difference between a *test* gap and a *behavioral* gap —
> the codegraph tells you which one you're looking at.

Rebuild the graph after large code changes via the `understand-anything:understand`
skill. Domain-flow view: `.understand-anything/domain-graph.json`.

---

## Execute one slice

1. Pick the top `status: "todo"` item in the active wave.
2. Resolve `codegraphAnchors` → open the code, confirm wiring with `findCallers`.
3. Write `redTargets` first → see them fail (RED).
4. Implement only `missingSteps`, inside the item's `domain`.
5. Real-data tests only (persisted rows / SQLSTATE / rendered values); real-PG via
   `createScratch`. No `toBeDefined` / 200-only.
6. TypeSpec changed? `specs build → api-ts generate → sdk-ts generate` → commit all
   generated outputs.
7. Run the gate. Flip the item's `status` here **and** update the BR's
   `br-registry.json` entry (incomplete→complete / corrected deferredReason).
8. One slice per PR. Verify live (browse/HTTP) before "done".

---

## Definition of done for the whole program

- No BR is `UNTESTED`.
- Every BR on a **live** module is exercised by a test that calls the **real
  handler/repo** (not a re-implemented pure function).
- P0 security/data rules have contract coverage; their triggers are **wired**
  (codegraph: a non-test caller exists).
- The money + governance journeys are `@journey-firewall` (durable cross-session).
- FE response types are derived from `@monobase/api-spec`, so a shape change is a
  compile error.
- Deferred items are clearly tagged as product-gated, not masquerading as pending.

When an item lands, mark it here and in `br-registry.json`. This file + the JSON
are the single place to see "what's left and how to do it."
