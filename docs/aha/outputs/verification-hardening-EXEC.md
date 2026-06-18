# Verification Hardening — Execution Prompts

Run ONE phase per session (incremental, never batch). Paste KICKOFF first; after
each phase lands + you approve, paste CONTINUE with the next phase letter.

Reference files (agent must read before acting):
- `docs/aha/outputs/verification-hardening-PLAN.md` — phases + Done-when gates
- `docs/aha/outputs/verification-hardening-FINDINGS.md` — stack + gaps (Phase 0 done)
- `docs/aha/outputs/verification-hardening-prompt.md` — methodology + 4-clause DoD

---

## KICKOFF (paste once, starts Phase A)

```
Read these three files in full before doing anything:
- docs/aha/outputs/verification-hardening-PLAN.md
- docs/aha/outputs/verification-hardening-FINDINGS.md
- docs/aha/outputs/verification-hardening-prompt.md

Phase 0 is already complete (see FINDINGS) — do NOT re-discover the stack.
Execute ONLY Phase A from the PLAN: curate 3–8 must-never-break journeys from the
existing specs and produce the 4-clause coverage matrix (journey × clause) at
docs/aha/outputs/journey-dod-matrix.md.

Rules:
- Reuse existing specs; invent a new journey only if a critical flow has zero coverage.
- Verify each claim against the live repo — FINDINGS facts are starting points, flag any stale.
- Do NOT start Phase B. Stop at Phase A's "Done when" gate and report the matrix + named gaps.
- Commit the matrix (conventional message). No push, no PR.
- Anything needing my decision: mark ⚠ HUMAN and pause.
```

---

## CONTINUE (paste per later phase — fill {LETTER} and {GOAL})

```
Context: docs/aha/outputs/verification-hardening-PLAN.md (+ FINDINGS, prompt).
Prior phases are committed. Execute ONLY Phase {LETTER}: {GOAL}.

Rules:
- TDD where you add code: write the failing test/assertion first, prove it RED, then GREEN.
- Verify against the live repo; don't trust stale notes.
- Stop at Phase {LETTER}'s "Done when" gate. Report evidence (test output, RED→GREEN logs).
- Commit per phase (conventional message). No push/PR unless I ask.
- ⚠ HUMAN + pause on any decision.
```

Phase GOALs (copy into {GOAL}):
- **B** — shared Playwright fixture enforcing clause 1 (console.error/pageerror/4xx
  listener + expected-error allow-list) and clause 4 (independent-session read);
  wire the Phase-A journeys to assert all 4 clauses.
- **C** — extend audit-e2e-depth.ts + gate to enforce clause 1 & 4 presence on
  must-never-break journeys and harden the gameable clause-2/3 heuristic.
- **D** — verify shard health, then break one journey → RED → fix → GREEN; document it.
- **E** — disposition each gap from the Phase-A matrix: enforce | accept-risk + reason.
- **F** — add 4-clause DoD to CONTRIBUTING; reference it from the gate's failure message.
- **G** *(optional/defer)* — refresh the 341-commit-stale UA graph, re-scope per-domain,
  un-gitignore + commit per-domain graphs.
- **H** *(optional/defer)* — freshness check + PR-diff→flow→journey review radar (advisory only).

---

## LEAN path (≈1 day — closes the actual gap)

Run KICKOFF (A), then CONTINUE B, then CONTINUE C. Stop. Skip D-ceremony + Track 2.
Clause-1 fixture (in B) is the single biggest lever — do it even if nothing else.
```

---

## Phase B execution findings (live-stack run, 2026-06-18)

All 6 must-never-break journeys assert 4/4 and pass GREEN on the live stack
(19 passed / 1 pre-existing directory fixme). The new clause-1/4 fixtures
immediately earned their keep by catching green-but-broken defects the old
`< 500` asserts had masked. Disposition for Phase E / follow-up:

### FIXED
- **PAY-EXT-409 (P1, money path).** `recordDuesPayment` persisted membership-
  extension dates via `updatePaymentStatus('completed' → 'completed')`, which the
  dues state-machine rejects → 409 → the whole payment rolled back. **No manual
  dues payment that extends a membership could ever be recorded in production.**
  Shipped green because every unit test stubbed `updatePaymentStatus`. Fixed via
  `DuesRepository.updatePaymentFields` (commit 5ad954f4); locked by
  `recordDuesPayment.test.ts [PAY-EXT-409]`.
- **J1 dead routes.** Old spec POSTed `/dues/payments` (404) + read
  `/persons/me/dues` (404) — verified nothing. Rewired to the real ops.
- **J6 dead route.** Old spec POSTed `/organizations/{id}/members` (404).
  Reshaped to the durable-person-record goal (membership is J5's domain).

### OPEN — needs app team (allow-listed in journeys so they don't block; ⚠ investigate)
- **Swallowed dashboard 403s.** At least two role-gated calls fire on dashboards
  and 403 silently (UI swallows them):
  - `GET /association/event-lifecycle/my → 403` (member/treasurer/officer/idor dashboards)
  - `GET /credit-compliance/{organizationId} → 403` (treasurer dashboard)
  Decision: investigate as app bugs (likely missing org context or wrong authz /
  over-fetch). This is exactly the green-but-broken class the firewall targets.
- **Product gap — no member-facing dues/receipt read model.** `/persons/me/dues`
  does not exist; the only payment read is the officer-scoped payment-by-id. The
  "member sees receipt" journey verifies via the membership row + the authorized
  payment read. A member receipt view would close the loop.

### Notes for Phase C
- `e2e-depth` gate is RED at HEAD on 3 pre-existing selector-only specs
  (member/dues, officer/officer-settings, journeys/dues-lifecycle) — unrelated
  debt, predates this work.
- Mailpit IS up in local infra (J4's email path runs); CI does not boot Mailpit,
  hence J4's de-Mailpit durable-account test (gap G5).
