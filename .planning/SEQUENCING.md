# Sequencing Plan: Autonomous Phase Execution (Phases 2-8)

## Status: ACTIVE

Phases 0-1 complete. 7 remaining phases. GSD `/gsd-autonomous` handles discuss-plan-execute-verify-gap-fix natively. Additions: dual-AI consensus for high-risk phases, migration safety envelope, hard gates between destructive phases.

## Strategy

| Phase | Risk | Addition |
|-------|------|----------|
| 2 (Audit) | Medium | Revalidate audit triggers after Phase 3 |
| 3 (Data Model Unification) | CRITICAL | Dual-AI + migration safety envelope + escalate on first gap |
| 4 (TypeSpec Reconciliation) | HIGH | Dual-AI (fresh, post-Phase-3) + separate session |
| 5 (App Hardening) | Low | Standard autonomous |
| 6 (CI/CD Pipeline) | Medium | Staging-only deploy, no prod auto-deploy |
| 7 (Shared Components) | Low | Standard autonomous |
| 8 (Frontend Tests) | Low | Standard autonomous |

## Execution Sessions

### Session 1: Phase 2 (Audit Module)
```
/gsd-autonomous --from 2 --to 2
```
Then `/clear`.

### Session 2: Phase 3 (Data Model Unification) — CRITICAL

**HARD GATE: Does NOT auto-advance to Phase 4.**

```
# 1. Dual-AI decisions for Phase 3 ONLY (not Phase 4)
/codex consult "Phase 3 architectural decisions"
# + Claude Plan agent independently
# + Compare → either-flags-risk = STOP

# 2. Migration safety envelope (before execution):
#    - DB snapshot command documented
#    - All migrations must be reversible (DOWN migration exists)
#    - Row-count parity checks in verification
#    - Enum mapping validation in verification

# 3. Execute Phase 3
/gsd-discuss-phase 3   (decisions from dual-AI become CONTEXT.md)
/gsd-plan-phase 3
/gsd-execute-phase 3

# 4. ESCALATE ON FIRST GAP (no autonomous gap iterations for schema work)
#    If verification finds gaps → STOP, surface to human/Codex
```

**MANDATORY STOP after Phase 3.** Do not proceed to Phase 4 in same session.
Then `/clear`.

### Session 3: Phase 4 (TypeSpec Reconciliation) — HIGH

**Phase 4 CONTEXT.md generated FRESH here, based on Phase 3 post-migration reality.**

```
# 1. Dual-AI decisions for Phase 4 (sees Phase 3 results)
/codex consult "Phase 4 decisions — based on actual post-unification schema"
# + Claude Plan agent independently
# + Compare → either-flags-risk = STOP

# 2. Execute Phase 4
/gsd-discuss-phase 4
/gsd-plan-phase 4
/gsd-execute-phase 4

# 3. Revalidate Phase 2 audit triggers still work after schema changes
#    Run Phase 2 tests as regression check
```
Then `/clear`.

### Session 4: Phases 5-8 (Safe, Batch)
```
/gsd-autonomous --from 5 --to 8
```

**Note on Phase 6 (CI/CD):** Deploy to staging only. No production auto-deploy without human approval.

## Dual-AI Protocol

### Trigger
Before planning starts for Phase 3 or Phase 4 (separately, not pre-locked together).

### Process
1. **Codex**: Feed phase goal + codebase state + prior summaries → architectural decisions
2. **Claude Plan agent**: Same inputs, independent analysis → architectural decisions
3. **Compare**:
   - Agree → lock as CONTEXT.md
   - Disagree → conservative (less destructive) wins
   - **EITHER flags data loss → STOP, surface to human** (not both — single credible warning halts)

### Codex Prompt Template
```
Review architectural decisions for Phase {N}: {phase_name}.

PROJECT: Memberry healthcare AMS (Bun, PostgreSQL, Drizzle, Hono, TypeSpec, TanStack)
COMPLETED: Phases 0-{N-1} summaries (include actual results, not assumptions)
PHASE GOAL: {from ROADMAP.md}
AFFECTED FILES: {key schemas, handlers, types}
POST-MIGRATION STATE: {for Phase 4 only: actual schema after Phase 3}

Propose specific decisions. For each:
1. Options available
2. Recommendation + rationale
3. Rollback path if it fails
4. Data loss risk assessment (flag explicitly if any)

Optimize for safety over elegance.
```

### Disagreement Resolution

| Scenario | Resolution |
|----------|-----------|
| Both agree | Lock, proceed |
| Disagree on approach | Conservative wins |
| Disagree on scope | Smaller scope wins |
| **Either** flags data loss | STOP — human decides |

## Migration Safety Envelope (Phase 3)

Required before Phase 3 execution begins:

- [ ] DB snapshot command documented and tested
- [ ] All schema migrations must have DOWN/rollback path
- [ ] Verification includes row-count parity checks (pre vs post)
- [ ] Verification includes enum mapping validation
- [ ] No irreversible DDL (DROP COLUMN, DROP TABLE) without snapshot confirmation
- [ ] Gap-closure: ESCALATE ON FIRST FAILURE (no autonomous retry for schema work)

## Phase 2→3 Cascade Guard

After Phase 3 completes, before Phase 3 is marked fully verified:
- Re-run Phase 2 audit trigger tests to confirm they still fire correctly post-unification
- If audit triggers break → fix as part of Phase 3 verification (not deferred)

## Gap-Closure Rules

| Phase Type | Max Auto Iterations | On Failure |
|-----------|-------------------|-----------|
| Schema/data (Phase 3) | 0 — escalate immediately | Human/Codex review |
| Spec/codegen (Phase 4) | 1 — one retry then escalate | Human/Codex review |
| Standard (2, 5-8) | 3 — GSD default | Continue normally |

## Config

- `workflow.auto_advance: true` — for standard phases
- Phase 3→4 transition: HARD GATE (auto_advance ignored, separate session required)
- Phase 6: staging-only deploy guard

## Completion Criteria

All 9 phases (0-8) verified and marked `[x]` in ROADMAP.md → milestone v1.0 complete.
