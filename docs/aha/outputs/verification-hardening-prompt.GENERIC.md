# Verification-Hardening Prompt (GENERIC — paste into any repo)

> Stack-agnostic. No assumptions about prior context or repo state — the agent
> discovers everything in Phase 0. Use this for repos OTHER than the one it was
> authored in. (Memberry has a patched copy with injected facts; don't reuse that.)

---

You are hardening THIS repository against a specific failure class: **the app is
broken for a real user while CI / tests / audits are all green.** Do not assume
any prior context — discover everything from this repo.

ROOT-CAUSE THESIS (verify it applies here; don't take it on faith):
A test suite can be fully green yet the running app broken, because most layers
verify *proxies authored alongside the code* — that an id is *mentioned* in a
test, hand-written mocks, single-step happy paths, structural import wiring —
while the few layers with an *independent real-world oracle* (real-stack E2E) are
either SKIPPED by default (e.g. when a server/DB isn't up) or were scoped by the
same person who had the blind spot. No layer both (a) derives "correct" from a
source independent of the implementer AND (b) observes the COMPLETE user-visible
outcome of a real multi-step flow.

THE 4-CLAUSE DEFINITION OF DONE (target every must-never-break journey must meet):
  1) No silent error surface — no unexpected error toast / console.error /
     pageerror / unhandled 4xx-5xx (or stderr / nonzero exit, for non-web) during
     a success path. Declare expected errors explicitly.
  2) Goal state, not existence — assert the meaningful END state, never "a row exists".
  3) Every step — in a multi-step flow assert EACH network call / sub-operation succeeded.
  4) Independent read — confirm the goal via a SEPARATE session reading durable
     state, not the UI/output you just drove.

PHASE 0 — ASSESS (read-only; report findings, then STOP for my approval before
changing anything):
1. Discover the stack: test runner, E2E framework (if any), CI config, how the app
   boots (services/DB), API style (REST/tRPC/GraphQL/CLI), front-end framework.
2. Find evidence for/against the thesis HERE:
   - Are there real-stack/E2E tests, and do they SKIP (vs FAIL) when the stack is down?
   - Do "coverage"/audit checks assert execution, or just that a symbol/id is referenced?
   - Are critical flows multi-step (client orchestrates 2+ calls)? Pick the 3–8
     most business-critical end-to-end user journeys ("must never break").
   - Against the 4-clause DoD: for each picked journey, which clauses does its
     current test actually assert? (Most repos cover 1–2 of 4.)
   - Is there a code/architecture map, and is it stale / structural-only /
     backend-anchored (would it model a 2-step UI flow as one backend handler)?
3. Output a short findings report: the stack, a journey × 4-clause coverage matrix,
   which gaps are real vs already closed, and a recommendation on whether (and how
   narrowly) this hardening is warranted.

PHASE 1+ — PROPOSE A PHASED PLAN (write it as a living doc, get my approval, then
execute phase-by-phase; each phase has a "Done when" gate — do not advance until
green; mark any step needing me ⚠ HUMAN and pause). Adapt to THIS repo's stack —
if the firewall partly exists, EXTEND it; don't rebuild what's already there:

  A. Curate the must-never-break journeys; map them to the 4-clause DoD (coverage matrix).
  B. Build/extend a NON-SKIPPABLE real-stack journey harness on this repo's E2E
     tool so every curated journey asserts all 4 clauses. If a clause is enforced
     nowhere (commonly 1 = silent-error-surface and 4 = independent-read), add a
     shared fixture/helper for it. If no E2E framework exists, standing one up is
     the prerequisite — flag it.
  C. Add or tighten a CI gate that BOOTS THE REAL STACK and runs the harness per-PR.
     Strict-by-default: a skipped real-stack proof must FAIL, not pass. If a depth/
     coverage gate already exists, harden it (assert execution + clause presence,
     not symbol mentions) rather than adding a parallel one.
  D. Prove the harness has teeth: verify suite health, then transiently break one
     journey, confirm RED, fix → GREEN.
  E. Disposition known workflow gaps (enforce, or accept-risk with a written reason).
  F. Institutionalize the 4-clause DoD in CONTRIBUTING/docs; reference it from the
     gate's failure message so new flows must meet it.

  KNOWLEDGE-GRAPH track (OPTIONAL — only if the `understand-anything` plugin is
  available: /understand, /understand-domain, /understand-diff. If absent, skip
  G–H or substitute any codebase-mapping, and focus on the firewall):
  G. Build (or refresh, if a stale graph exists) a COMMITTED, per-domain, FLOW-AWARE
     knowledge graph — scope per top-level module, not one whole-repo blob; model
     flows as end-to-end FE↔BE user journeys, not single handlers. Commit the
     graphs; keep derived caches git-ignored.
  H. Add a freshness check (warn when a graph's recorded commit drifts from HEAD)
     and a review radar (PR diff → business flow → journey coverage; flag any
     touched flow with no covering journey). Both ADVISORY, never blocking.

RULES: TDD where you add code (write the failing test/journey first, prove RED,
then GREEN). Commit per phase with conventional messages. Don't push or open PRs
unless I ask. Keep map/radar advisory — the real firewall is the non-skippable
journey harness + the 4-clause gate. Start with Phase 0 now.

---

## Notes for the human pasting this

- **Firewall (A–F)** = high-value half, works on any repo with an E2E tool
  (Playwright/Cypress/Vitest-browser/Detox/RestAssured/…). No E2E = Phase 0 flags it;
  standing one up is the prerequisite.
- **KG (G–H)** needs the understand-anything plugin in that environment. Absent →
  tell the agent to skip G–H or substitute its own mapping.
- **Maturity dial:** greenfield → build from scratch; mature repo → audit-and-extend.
  Phase 0 tells you which. Either way the prompt adapts.
