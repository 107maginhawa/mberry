# Workflow Audit Campaign — Master Sequence

Goal: every user workflow across modules is provably exercised, and the gate
stays green (no regression) while the gap closes. Ordering principle:
**cheapest-highest-leverage first** (kill false positives before writing specs),
**P0 → P1 → P2** within each phase. Baseline ratchets down after every phase.

Status legend: ✅ done · ▶ in progress · ⬜ pending

Baseline trail: A=1/B=76/C=85 → **current A=0 / B=71 / C=45**.

---

## Phase 0 — Enforcement machinery ✅
One command (`bun run audit:workflows`), baseline-ratchet gate
(`scripts/audit/ratchet.ts`), CI-enforced (`ci.yml`), `deferredReason` honored.
Shipped to PR #12.

## Phase 1 — Matrix-C detector fix ✅
Broadened route matcher (`scripts/audit/route-match.ts`) to count nav-helpers,
`path:` arrays, trailing-slash routes. **C 85→45** (40 false positives), zero
specs written.

## Phase 2 — P0 flow triage (Matrix B) ✅
Verified 13 P0 flows; tagged 5 covered-but-untagged (WF-041/042/076/079/128).
**B 76→71.** 8 genuinely-missing P0 flows recorded.

## Phase 3 — P1 flow triage (Matrix B) ▶
Same verify→tag pattern on the 38 P1 flows. Tag covered-but-untagged; list
truly-missing. Expect another sizeable B drop. **Cheap, no live stack.**

## Phase 4 — P2 + residual flow triage (Matrix B) ⬜
Finish B false-positive sweep on the remaining flows. After this, B = the true
flow gap.

## Phase 5 — Matrix-C residual verification ⬜
The 45 remaining "MISSING" routes may still include link-click navigations the
static matcher can't see. Spot-verify; exempt or note any that are genuinely
exercised without a URL literal. After this, C = the true route gap.

## Phase 6 — Write new specs (the long pole) ⬜
Live-stack E2E authoring for the genuinely-uncovered remainder. Order:
1. **P0 money/auth/security** — finance/dues routes, manage-suppressions UI,
   create/view-invoice, cast-ballot, bylaw ratification.
2. **P1** — membership/credits/events/governance/comms.
3. **P2** — the rest.
Webhook/trigger flows (WF-124/132) close via **backend integration tests**, not
e2e — decide whether to exempt them from Matrix B or add an e2e-equivalent.
Each spec: real auth → navigate → assert real data (4-clause DoD for anything
promoted to `@journey-firewall`). Ratchet baseline down per spec.

## Phase 7 — Harden gates ⬜
Once depth backfilled: flip `lint:e2e-depth` off `continue-on-error`; confirm
matrix ratchet at its floor; final green.

---

## Working cadence (every batch)
1. Pull the next slice (by priority) from `docs/audits/WORKFLOW_AUDIT_BACKLOG.md`.
2. **Verify** each item against real specs/routes — never tag/skip on grep alone.
3. Tag covered-but-untagged, OR write the missing spec.
4. `bun run audit:workflows` → ratchet baseline → commit → push to PR #12.
5. Record truly-missing items back into the backlog.
