# Verification Hardening — Execution Plan (Memberry)

Living doc. Phase-by-phase; do not advance until each "Done when" gate is green.
⚠ HUMAN = needs Elad. Phase 0 done (see FINDINGS). TDD where adding code:
failing assertion first. Commit per phase, conventional messages. No push/PR
unless asked. Map/radar stay advisory — firewall is the real defense.

Reference files:
- `verification-hardening-prompt.md` — the patched paste-prompt (methodology)
- `verification-hardening-FINDINGS.md` — Phase 0 result (stack + gaps)

---

## Track 1 — FIREWALL (high value, do this)

### Phase A — Curate must-never-break journeys
Map 3–8 critical journeys (FINDINGS candidates) to a 4-clause coverage matrix
(journey × clause). Reuse existing specs; invent only if a critical flow has zero
coverage.
**Done when:** matrix committed at `docs/aha/outputs/journey-dod-matrix.md`; per-clause
gaps named.

### Phase B — Close clauses 1 & 4 (the real gap)
Add a shared Playwright fixture (extend existing test setup, don't fork a harness):
- **Clause 1** — listener fails test on unexpected `console.error` / `pageerror` /
  unhandled 4xx-5xx during a success path. Explicit allow-list API for expected errors.
- **Clause 4** — independent-read helper: re-verify the goal from a SEPARATE auth
  session against durable state (not the UI just driven).
Wire the Phase-A journeys to assert all 4 clauses. TDD: write failing assertion first.
**Done when:** each curated journey asserts 4/4; new assertions fail before fixture, pass after.

### Phase C — Tighten the gate (extend, don't add)
Extend `scripts/audit-e2e-depth.ts` + `audit-e2e-depth-gate.ts`:
- enforce clause 1 & 4 PRESENCE on must-never-break journeys
- harden the gameable clause-2/3 heuristic (G2 — beyond bare `data >= 2`)
Keep inside existing ci.yml / quality-gates.yml gate. No new workflow.
**Done when:** gate goes RED if a must-never-break journey drops any clause; CI green on a compliant suite.

### Phase D — Prove teeth
Verify shard health first (suite green on main 2026-06-18). Transiently break one
journey → confirm RED → fix → GREEN.
**Done when:** RED→GREEN cycle documented (links/screenshots).

### Phase E — Disposition gaps
Each uncovered/known-weak flow: enforce, or accept-risk with written reason.
**Done when:** every gap from Phase A matrix has enforce|accept-risk + rationale.

### Phase F — Institutionalize
Add the 4-clause DoD to CONTRIBUTING; reference it from the gate's failure message
(so a failing dev is pointed at the rule).
**Done when:** DoD documented + linked from gate output.

---

## Track 2 — KNOWLEDGE GRAPH (advisory, lower priority — optional / defer)

### Phase G — Refresh + commit (not rebuild)
KG is 341 commits stale + gitignored. Regenerate via `/understand` +
`/understand-domain`, re-scope per top-level handler module (CLAUDE.md 26-module
map), un-gitignore + commit per-domain graphs; keep derived caches ignored.
**Done when:** committed per-domain graphs at HEAD; freshness recorded.

### Phase H — Freshness + review radar (advisory)
- freshness check: warn when a graph's recorded commit drifts from HEAD
- review radar: PR diff → business flow → journey coverage; flag touched flow with
  no covering journey. Both ADVISORY, never blocking.
**Done when:** both scripts run in CI as warnings only.

---

## Recommended scope (without overdoing it)

**LEAN (≈1 day, closes the actual gap):** Phase A → B (clause 1 fixture + clause 4
on 3–5 journeys) → C (G2 tighten). Skip D-heavy ceremony, skip Track 2.

**FULL:** Track 1 A–F. Track 2 only if the review-radar's "PR touches flow with no
journey" signal is wanted — run it as a separate later pass, not gated to this work.

Clause-1 fixture is the single biggest lever (catches runtime errors the UI swallows
while tests stay green). Do it first regardless of chosen scope.
