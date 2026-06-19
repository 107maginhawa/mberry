# Verification-Hardening Prompt (patched for Memberry)

> Paste the block below to an executing agent. It is patched for THIS repo:
> the journey firewall mostly already exists, so the task is **audit + extend +
> close real gaps**, not build-from-scratch. Known facts are injected so the
> agent doesn't waste a discovery pass rediscovering mature infrastructure.

---

You are hardening THIS repository against a specific failure class: **the app is
broken for a real user while CI/tests/audits are all green.** Verify every claim
below against the live repo — these are starting facts, not gospel; if any is
stale, say so.

ROOT-CAUSE THESIS (the failure mode to defend against):
A test suite can be fully green yet the running app broken, because most layers
verify *proxies authored alongside the code* — that an id is *mentioned* in a
test, hand-written mocks, single-step happy paths, structural import wiring —
while the few layers with an *independent real-world oracle* (real-stack E2E)
are either SKIPPED by default or were scoped by the same person who had the
blind spot. No layer both (a) derives "correct" from a source independent of the
implementer AND (b) observes the COMPLETE user-visible outcome of a real
multi-step flow.

KNOWN STARTING STATE (verify, don't rebuild — this repo is NOT greenfield):
- E2E exists: Playwright, ~144 specs under `apps/memberry/tests/e2e` +
  `apps/admin/tests/e2e`. Real user flows already present
  (`cross-persona/`, `billing.spec.ts`, `auth/`, `cross-org-isolation.spec.ts`).
- Real-stack CI gate EXISTS: `.github/workflows/ci.yml` boots postgres + minio +
  `bun dev` (API + app) and runs Playwright across 6 shards. Do not add a second
  gate — extend this one.
- Silent-skip firewall EXISTS: `bun run lint:no-skips`
  (`scripts/lint-no-skips.ts`), wired as ci.yml step "No silent test skips". A
  skipped real-stack test already fails CI. Confirm it has no escape hatches.
- Depth gate EXISTS but is PARTIAL: `bun run lint:e2e-depth`
  (`scripts/audit-e2e-depth.ts` + `audit-e2e-depth-gate.ts`). It classifies
  specs real-flow vs selector-only via a regex heuristic (`dataAssertions >= 2`).
- Contract layer EXISTS: Hurl suite + Schemathesis (`.github/workflows/contract.yml`).
- Knowledge graph EXISTS but is stale + uncommitted: `.understand-anything/`
  (gitignored, line 269) holds `knowledge-graph.json` (3,474 nodes / 8,259 edges /
  11 layers) + `domain-graph.json` (185 nodes / 200 edges / 54 domainMeta / 43
  entryPoints — business flows ARE mapped). Generated at commit `0178b7c`, now
  **341 commits / 12 days behind HEAD** (`c47af2c9`). Status: `docs/aha/kg/
  knowledge-graph-status.md`. The `understand-anything` plugin IS available
  (`/understand`, `/understand-domain`, `/understand-diff`).

THE 4-CLAUSE DEFINITION OF DONE (the target every must-never-break journey must meet):
  1) No silent error surface — no unexpected error toast / console.error /
     pageerror / unhandled 4xx-5xx during a success path (declare expected
     errors explicitly).
  2) Goal state, not existence — assert the meaningful END state, never "a row
     exists".
  3) Every step — in a multi-step flow assert EACH network call returned success.
  4) Independent read — confirm the goal via a SEPARATE session reading durable
     state, not the UI you just drove.

KNOWN GAPS (the real targets — confirm, then close):
- G1. DoD coverage is ~1.25 of 4 clauses. The depth audit covers clause 2 and
  weakly clause 3. **Clauses 1 (silent error surface) and 4 (independent read)
  are enforced NOWHERE.** This is the highest-value work.
- G2. The depth heuristic (`data >= 2` regex match) is gameable — two matching
  expects pass a spec that asserts nothing meaningful. Tighten or replace.
- G3. Suite stability: PRs #10 + #11 merged GREEN to main 2026-06-18 — the older
  "~79 contamination blocking the aggregator" theory was stale. Treat suite as
  healthy by default; just VERIFY current shard health before phase D rather than
  assuming a prerequisite cleanup. `withIsolatedFixture` adoption may still be
  partial — note it, don't block on it.
- G4. Knowledge graph is stale (341 commits) + uncommitted + whole-repo blob, not
  per-domain. Refresh + restructure + commit, don't build from zero.

PHASE 0 — ASSESS (read-only; report findings, then STOP for approval before
changing anything):
1. Confirm the known starting state above against the live repo. Flag anything
   stale or wrong.
2. Quantify G1: run `lint:e2e-depth`, read the output, and for the
   must-never-break journeys note which of the 4 clauses each actually asserts.
3. Quantify G2: find specs that pass the depth gate but assert nothing
   meaningful (gaming the `data >= 2` heuristic).
4. Quantify G3: determine current suite health (failing count, contamination,
   `withIsolatedFixture` adoption). Is the suite green enough to prove RED→GREEN?
5. Pick the 3–8 most business-critical end-to-end user journeys
   ("must never break") from the EXISTING specs — do not invent new ones unless a
   critical flow has zero coverage.
6. Output a short findings report + recommendation: which gaps are real, which
   are already closed, and the phase order.

PHASE 1+ — PROPOSE A PHASED PLAN (living doc, get approval, execute
phase-by-phase; each phase has a "Done when" gate — do not advance until green;
mark any step needing me ⚠ HUMAN and pause). Adapt to what Phase 0 finds:

  A. Map the curated must-never-break journeys to the 4-clause DoD — a coverage
     matrix (journey × clause), reusing existing specs. Done when: matrix exists,
     gaps named.
  B. EXTEND, don't rebuild. Add a shared Playwright fixture/helper that enforces
     the two missing clauses:
       - Clause 1: a console/pageerror/network listener that fails the test on
         unexpected console.error / pageerror / unhandled 4xx-5xx during a
         success path (with an explicit allow-list API for expected errors).
       - Clause 4: an independent-read helper that re-verifies the goal from a
         SEPARATE session against durable state.
     Wire the chosen must-never-break journeys to use them. TDD: write the
     failing assertion first. Done when: journeys assert all 4 clauses.
  C. TIGHTEN the existing gate, don't add one. Make `audit-e2e-depth` (+ gate)
     enforce clauses 1 & 4 presence on must-never-break journeys and harden the
     gameable clause-2/3 heuristic (G2). Keep it inside the existing ci.yml /
     quality-gates.yml gate. Done when: gate goes red if a must-never-break
     journey drops a clause.
  D. Prove teeth: transiently break one journey, confirm RED, fix → GREEN.
     Verify shard health first (G3 — suite is green on main as of 2026-06-18) so
     RED is attributable, not noise. Done when: documented RED→GREEN cycle.
  E. Disposition known workflow gaps (enforce, or accept-risk with a written
     reason).
  F. Institutionalize the 4-clause DoD in CONTRIBUTING/docs so new flows must
     meet it. Done when: documented + referenced from the gate's failure message.

  KNOWLEDGE-GRAPH track (graphs EXIST but are 341 commits stale + gitignored —
  REFRESH, don't rebuild from zero; lower priority than the firewall):
  G. Regenerate the stale graph, re-scope per-domain (scope per top-level handler
     module — see CLAUDE.md's 26-module map — not one whole-repo blob; model flows
     as end-to-end FE↔BE user journeys, not single handlers), then UN-GITIGNORE +
     COMMIT the per-domain graphs. Keep derived caches git-ignored.
  H. Add a freshness check (warn when a graph's recorded commit drifts from HEAD)
     and a review radar that maps a PR diff → business flow → journey coverage,
     flagging any touched flow with no covering journey. Both ADVISORY (never
     blocking).

RULES: TDD where you add code (failing test/journey first). Commit per phase,
conventional messages. Don't push or open PRs unless I ask. The map/radar stay
advisory — the real firewall is the non-skippable journey harness + the 4-clause
gate. Start with Phase 0 now.
