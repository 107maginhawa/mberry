# Journey × 4-Clause DoD Coverage Matrix (Phase A)

Date: 2026-06-18 · HEAD `c47af2c9` · branch `main`
Source: verification-hardening-PLAN.md Phase A. Read-only audit of existing
specs against the 4-clause Definition of Done. No code changed.
Journey set CONFIRMED by Elad 2026-06-18 (see Decisions).

## The 4-clause DoD (target every must-never-break journey must meet)

1. **No silent error surface** — no unexpected error toast / `console.error` /
   `pageerror` / unhandled 4xx-5xx during a success path (expected errors declared explicitly).
2. **Goal state, not existence** — assert the meaningful END state, never "a row exists".
3. **Every step** — in a multi-step flow assert EACH network call returned success.
4. **Independent read** — confirm the goal via a SEPARATE session reading durable
   state, not the UI just driven.

Legend: ✅ full · ◑ partial / weak · ❌ none

---

## Curated must-never-break journeys (6) — CONFIRMED

All reuse existing specs — none invented. Selection optimizes for business
criticality AND firewall-anchor quality (real multi-actor, durable state,
non-skippable). Set confirmed by Elad: dropped `password-reset` (self-skips
without Mailpit, duplicates auth) and added `officer-approves-member-application`
(membership-lifecycle core, 2-actor, no Mailpit dependency). Governance/election
flow declined for now (episodic, not daily-critical — revisit in Phase E).

| # | Journey | Spec | Business reason |
|---|---------|------|-----------------|
| J1 | Treasurer records dues → member sees receipt | `cross-persona/treasurer-records-dues-member-sees-receipt.spec.ts` | Money + cross-actor read model |
| J2 | Cross-org isolation (IDOR prevention) | `cross-org-isolation.spec.ts` | Security — tenant data leak is catastrophic |
| J3 | Billing / Stripe Connect onboarding | `billing.spec.ts` | Money — officer payment setup must not stick on skeleton |
| J4 | New-user OTP registration | `auth/otp-registration.spec.ts` | Entry point — broken signup = zero new users. **Phase B: make non-email core Mailpit-independent.** |
| J5 | Officer approves member application | `cross-persona/officer-approves-member-application.spec.ts` | Membership lifecycle core, real 2-actor propagation |
| J6 | Directory onboarding: signup → join org → directory profile | `directory-onboarding.spec.ts` | Cross-module M01→M05→M10 |

---

## Coverage matrix (journey × clause)

| Journey | C1 silent-error | C2 goal-state | C3 every-step | C4 independent-read |
|---------|:---:|:---:|:---:|:---:|
| J1 Treasurer dues → receipt | ❌ | ❌ | ◑ | ✅ |
| J2 Cross-org isolation | ◑ | ✅ | ✅ | ◑ |
| J3 Billing onboarding | ◑ | ◑ | ◑ | ❌ |
| J4 OTP registration | ◑ | ◑ | ◑ | ❌ |
| J5 Officer approves application | ❌ | ✅ | ◑ | ✅ |
| J6 Directory onboarding | ◑ | ◑ | ◑ | ◑ |

Aggregate: **C1 0/6 full (4 partial) · C2 2/6 full · C3 1/6 full · C4 2/6 full.**
No journey is 4/4. Clause 1 (no full coverage anywhere) and clause 4 (3 journeys
at ❌/◑) are the real holes — matches FINDINGS G1 thesis, with the correction below.

### Per-cell evidence

**C1 — silent error surface.** Enforced ONLY through `helpers/test-fixture.ts`,
which fails the test on `pageerror` and on API **5xx** (`expect(pageErrors)` /
`expect(apiFailures)` `.toEqual([])`). Limits: `console.error` is **warn-only**
(commented "don't fail for now"), and the response handler does `if (res.status() <
500) return` so **4xx is never caught**. J1 and J5 import `@playwright/test`
directly → **zero** error-surface enforcement. J2/J3/J4/J6 use the fixture → ◑.

**C2 — goal-state.**
- J1 ❌: asserts `dues.status < 500` and comments it does NOT match the recorded
  payment ("exact row count varies"). Canonical proxy failure.
- J2 ✅: asserts `status >= 400` (access denied) — the meaningful security end state.
- J5 ✅: asserts the applicant's membership row exists AND `status` matches
  `/^(active|pendingPayment|grace|gracePeriod)$/` — a real post-approval goal state.
- J3/J4/J6 ◑: OR / conditional assertions (`[200,404]`, `isRedirected ||
  hasVerification`, headings+URL) — a reachable state, not a single committed goal.

**C3 — every-step.**
- J2 ✅: `beforeEach` asserts hydration `200`, each probe asserts its status.
- J1/J5/J6 ◑: loose thresholds — `toBeLessThan(500)` / `(400)` accept client errors
  as pass; J6 has a `test.skip(true, …)` mid-flow.
- J3/J4 ◑: primary GET asserted; later steps conditional/mocked.

**C4 — independent read.**
- J1 ✅: second browser context signed in as the member re-reads `/persons/me/dues`
  (true separate session) — assertion loose.
- J5 ✅: applicant fresh context re-reads `/persons/me/memberships` after the officer
  context approves — true separate-session durable read.
- J2 ◑: same session probes another org's endpoints — independent read of durable
  authz state, but not a separate session.
- J6 ◑: cross-actor "officer creates member → directory shows them" is `test.fixme`
  (disabled); active path reads durable directory state as the same actor.
- J3/J4 ❌: single session, no independent re-read.

---

## Named per-clause gaps (Phase B/C input)

**Clause 1 (highest value):**
- G1a — J1 + J5 bypass the fixture (`import … '@playwright/test'`) → migrate to `test-fixture`.
- G1b — fixture catches only 5xx; **4xx unhandled errors pass silently** (`status() < 500` early-return).
- G1c — `console.error` is warn-only, not a failure → clause 1 unmet even where the fixture is used.

**Clause 2:**
- G2a — J1 asserts `< 500` instead of the recorded payment appearing in the member read model.
- G2b — J3/J4/J6 lean on OR/conditional assertions that pass on a non-goal state.

**Clause 3:**
- G3a — `toBeLessThan(500)` / `(400)` thresholds (J1, J5, J6) treat 4xx as success.
- G3b — conditional `test.skip(true, …)` inside J6 lets a step vanish from coverage.

**Clause 4:**
- G4a — J3, J4 have no independent-session read → need the Phase-B independent-read helper.
- G4b — J6's only cross-actor independent read is `test.fixme` (disabled).
- G4c — J1/J2/J5 have the read but with loose/`<500`/`<400` assertions.

**Cross-cutting (Phase B):**
- G5 — J4 (OTP) gates its goal-state step on Mailpit (`test.skip(!mailpitUp)`), which
  CI does not boot → de-couple the non-email core (page loads, form submit, account
  created) from Mailpit so the journey can't self-skip.

---

## FINDINGS claims verified — and what is STALE

| FINDINGS claim | Verdict |
|---|---|
| HEAD `c47af2c9` | ✅ matches |
| branch `fix/audit-remediation-2026-06` | ⚠ **STALE** — live branch is `main` (PRs #10/#11 merged) |
| ~144 memberry + admin E2E specs | ✅ 144 memberry + 8 admin |
| candidate spec files exist | ✅ all present (auth/ has 5 specs; cross-persona/ has 5) |
| `lint:no-skips` wired in ci.yml ("No silent test skips") | ✅ present (`package.json` → `scripts/lint-no-skips.ts`) |
| ci.yml boots postgres + minio + `bun dev` + 6-shard Playwright | ✅ confirmed (no Mailpit — see G5) |
| `lint:e2e-depth` gate exists, `data >= 2` heuristic (G2) | ✅ confirmed — gate in `quality-gates.yml:48`, verdict `data >= 2 ? real-flow` |
| **G1: "Clause 1 enforced NOWHERE"** | ⚠ **STALE / WRONG** — `test-fixture.ts` partially enforces clause 1 (pageerror + 5xx fail) for specs that import it (J2/J3/J4/J6). Only J1/J5 have zero. Phase B is therefore **tighten + adopt the existing fixture** (add 4xx + console.error; migrate J1, J5), not build from scratch. |
| G2 heuristic gameable | ✅ confirmed — pure regex, two matching `expect()` → `real-flow` |

**New flag (not in FINDINGS):** `test.fixme` (directory-onboarding:129) and
conditional `test.skip(true, …)` exist inside a curated journey. The "no silent
skips" firewall claim should be re-checked against these forms — possible escape
hatch. Defer to Phase C / G3 verification; not changed here.

---

## Decisions (Elad, 2026-06-18)

- Journey set = **Swap** option: keep J1/J2/J3/J6, keep OTP (J4, de-Mailpit core in
  Phase B), drop password-reset, add officer-approves-member-application (J5).
- Governance/election flow (`president-election-tally`) **not** added now; revisit in
  Phase E disposition.

## Phase A "Done when" — gate status

- ✅ Matrix committed at `docs/aha/outputs/journey-dod-matrix.md` (6 journeys × 4 clauses).
- ✅ Per-clause gaps named (G1a–c, G2a–b, G3a–b, G4a–c, G5).
- ✅ Every FINDINGS claim verified; staleness flagged (branch, G1).
- ✅ ⚠ HUMAN resolved — journey set confirmed.

Phase A gate GREEN. Do not advance to Phase B without approval.
