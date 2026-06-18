# Phase D — Proof of Teeth (Verification Hardening)

Date: 2026-06-18 · branch `main`. The firewall's teeth were proven both at the
**gate level** (a journey dropping a clause fails CI) and — more importantly —
at the **runtime level** (a real app bug a green suite had missed was caught,
fixed, and went green). No manufactured ceremony: the cycles below happened
during Phases B–C.

## 0. Shard / suite health (prerequisite)

The 6 must-never-break journeys run GREEN on the live stack (postgres + minio +
API :7213 + app :3004, seeded):

```
19 passed, 1 skipped (pre-existing directory `test.fixme`) — workers=1
```

Unit suites green: `error-surface.test.ts` 13/13, `recordDuesPayment.test.ts`
17/17, `audit-e2e-depth.test.ts` 7/7. Typecheck clean. So a RED below is
attributable to the induced break, not background noise.

## 1. Gate-level teeth (Phase C) — a journey dropping a clause fails the gate

Transiently renamed `independentRead` in `billing.spec.ts` (dropping clause 4),
ran the existing `lint:e2e-depth` gate:

**RED:**
```
E2E depth gate: 1 must-never-break journey(s) drop a DoD clause:
  • billing.spec.ts: missing clause 4 (independent-session durable read — independentRead)
A `// @journey-firewall` spec must assert all 4 clauses of the journey DoD.
gate exit=1
```

**GREEN** (restored / compliant suite):
```
E2E depth gate: PASS (137 real-flow, 12 exempt, 6 journeys 4/4)
gate exit=0
```

A regression that silently weakens a must-never-break journey now turns CI red
in the existing `quality-gates.yml` step — no new workflow.

## 2. Runtime-level teeth (Phase B) — the real payoff

This is the failure class the whole effort targets: **app broken for a real
user while the suite is green.** The clause-1 fixture caught it for real.

- **PAY-EXT-409 (P1 money path).** Before the fixture, the treasurer-dues
  journey asserted `< 500` and passed against a 404/409 — it had **never
  recorded a payment**. With clause-1 + a tightened assertion, the journey went
  RED on the real bug: `recordDuesPayment` 409'd on every membership-extending
  payment (no manual dues payment could be recorded in production). Backend fix
  (`updatePaymentFields`) → journey GREEN. Locked by
  `recordDuesPayment.test.ts [PAY-EXT-409]` (RED→GREEN at unit level too).
- **Swallowed dashboard 403s.** Clause-1 surfaced `GET event-lifecycle/my → 403`
  and `GET credit-compliance/{org} → 403` firing + being swallowed on real
  dashboards — invisible to the old suite. Declared expected (allow-listed) and
  filed for app investigation.
- **Dead routes.** Clause-3 tightening (no more `< 500`) turned RED on
  `/dues/payments` (404) and `/organizations/{id}/members` (404) — routes the
  old journeys POSTed to that never existed. Rewired to real ops → GREEN.

Each is a documented RED (real breakage caught) → fix → GREEN cycle, evidenced
in commits 3bd21c2f, d71b13a6, 5ad954f4.

## Done-when ✅

RED→GREEN cycles documented at gate + runtime level; suite health verified.
