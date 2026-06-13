# Continuation prompt — AHA Step 44 (RATIFICATION + CONDITIONAL BUILD — Track B: Membership E2 state-machine ratification)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-44-prompt.md`.

> **NOT decision-free — the decision-free build track is DRAINED.** Steps 31–43 cleared the last
> decision-free passes (channel model, DM creation, video gate, etc.). Per the consolidated roadmap
> (§13/§18), **every remaining non-deferred item is product-decision gated**, and the roadmap names
> the **Track B — Membership E2 state-machine ratification** as *THE HALT — resolve first*. It is the
> highest-leverage gate: the E2 state-machine cluster (reinstate semantics, suspend/unsuspend,
> re-application, delete-op safety, terminal-state irreversibility) was implemented on
> **engineering-chosen defaults** (migrations 0065/0066 landed) and now needs **user ratification
> before pilot** — wrong terminal-state semantics are costly to reverse after members + dues + voting
> eligibility accrue against them. **TB-4 (expulsion-V1) specifically may reopen build work.**
>
> This pass: (1) present TB-1…TB-5 to the user and capture ratification, (2) if all ratified as-is →
> mark Track B CLOSED (doc-only), (3) if any is overridden → execute ONLY the named reopened `04`
> follow-up (most likely the **TB-4 expulsion-V1 E2.1 build**) test-first. Do not touch any other
> gated module.

---

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`. No autorun. No commit unless asked. Working tree intentionally dirty (recovery-2025 + AHA Steps 31–43) — PRESERVE. FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md`.
2. `docs/aha/prompts/04-module-or-group-fix-tdd.md` (TDD fix protocol — applies only IF a decision reopens build).
3. `docs/aha/outputs/consolidated-remediation-roadmap.md` — **§13 Track B** (TB-1…TB-5 table) and **§18 Roadmap Decision**.
4. `docs/aha/module-fix-plans/membership-lifecycle-fix-ready-plan.md` — **§8 Product Decisions**, **§6 Batches E2/F**, **§3 rows FIX-007/008/009/010/011**, and the §"Product Decisions — RESOLVED" eng-defaults block.
5. `docs/aha/module-fix-plans/membership-lifecycle-fix-report.md` — confirm what E2/F already shipped (do NOT re-do); note the eng defaults actually implemented per migrations 0065/0066.

**Pre-flight reads (BEFORE any edit — per `feedback_subagent_preflight`):** vite proxy + toast (`sonner`) + auth + route patterns; and (only if TB-4 reopens build):
- `services/api-ts/src/handlers/association:member/createDisciplinaryAction.ts` (present but UNROUTED — the expel entry point).
- `services/api-ts/src/handlers/association:member/repos/membership.schema.ts` (the shared `membership` table — `expelled_at` would be an ADDITIVE column only; no renames; `computeMembershipStatus` signature must stay additive).
- `compute-membership-status.ts`, `reinstateMembership.ts`, `status-transitions.ts` (terminal-state inputs + reinstate allowlist).
- `specs/api/src/association/member/membership.tsp` + `docs/product/STATE_MACHINES.md` + m05 §8/§13 (the expel/terminal vocabulary to align).

## Step 2 — Ratify Track B (TB-1…TB-5)

Present the agenda to the user with the eng default for each, and ask them to ratify or override. Use `AskUserQuestion` (one question per TB row, default = "Ratify as-is (Recommended)"). Capture answers verbatim.

| ID | Decision | Eng default implemented | Reopens build if overridden? |
| --- | --- | --- | --- |
| TB-1 | Reinstate semantics | Lapsed-only restorable; REMOVED (resigned/terminated/deceased) terminal + irreversible; SUSPENDED restored via dedicated unsuspend op | Yes — reinstate allowlist + transitions table + TypeSpec doc |
| TB-2 | RESIGNED actor | Officer-recorded only (V1); no member self-resign route/UI | Yes — adds a guarded self-resign route/UI |
| TB-3 | EXPIRED threshold | Dropped from V1 — no state/job; LAPSED covers "past grace" | Yes — adds a distinct EXPIRED state + job |
| TB-4 | Expulsion-V1 ⚠️ | Deferred to V2 — `createDisciplinaryAction` unrouted; no `expelled_at` | **Yes — E2.1 pass: route + `expelled_at` migration + M04 disciplinary integration.** User previously signaled interest ("2?"). |
| TB-5 | Re-application strategy | Reuse existing `(org,person)` row — re-approval flips it back through a proper transition + status-history write | Yes — archive-old + insert-new needs an index change |

Per `feedback_defer_decisions`: if the user defers ("your call"), apply the engineering recommendation = **ratify all as-is** (the eng defaults are the long-term-correct choices already shipped), EXCEPT honor the standing TB-4 signal — confirm explicitly whether expulsion is V1 for the pilot, since it is the one item that adds member-facing capability rather than removing it.

## Step 3 — Branch on the outcome

**(A) All ratified as-is → Track B CLOSED (doc-only, no build).**
- Append a "Track B — RATIFIED" decision block to `membership-lifecycle-fix-ready-plan.md` (record each TB-N = ratified-as-is, date 2026-06-13, ratifier = user/eng-default).
- Reconcile docs per FIX-019: ensure `docs/product/STATE_MACHINES.md` ↔ m05 §8/§20 ↔ `membership.tsp` agree with the ratified terminal/reinstate vocabulary (doc-only; no code).
- Update the roadmap §13/§18 note: Track B HALT resolved → CLOSED. Then STOP.

**(B) TB-4 overridden → expulsion IS V1 → run the E2.1 build (TDD, per prompt 04).** Smallest correct slice:
- **Schema (additive, isolated):** add `expelled_at timestamptz NULL` to `membership.schema.ts`; `cd services/api-ts && bun run db:generate`; review SQL (additive only, NO renames; backfill not needed — new column). Migration runs on boot.
- **Handler/route:** route `createDisciplinaryAction` (it exists, unrouted) via TypeSpec on the association:member surface — declare `@route`, audit (`x-audit`), and officer/position gate via `@extension` per CLAUDE.md P1.5 (do NOT hand-call `auditAction`/`requirePosition`). On expel: set `status='expelled'` terminal + write `expelled_at` + a `membership_status_history` row; make `expelled` terminal+irreversible in `status-transitions.ts` and `compute-membership-status.ts` (mirror the resigned/terminated terminal handling). Regen: `cd specs/api && bun run build` → `cd services/api-ts && bun run generate` → regenerate SDK. Never hand-edit generated files.
- **FE:** add `expelled` to the `MemberStatus` union + badge/label in `apps/memberry/src/features/membership/components/member-detail.tsx` (pairs with FIX-018).

**(C) Any other TB row overridden → run ONLY that row's named follow-up** per the fix-ready §8 mapping (TB-1→FIX-008 allowlist/transitions; TB-2→self-resign route; TB-3→EXPIRED state+job; TB-5→re-application index change). Keep it to the single reopened slice; do not batch.

## Step 4 — TDD (RED first, only on a reopened build)

- **Expel terminal integrity** (backend/unit + data/schema): expel sets `status='expelled'` + persists `expelled_at`; status SURVIVES recompute as `expelled` (not `removed`); `reinstateMembership` of an expelled member → 4xx (terminal-irreversible). Extend `reinstateMembership.test.ts` + a new `createDisciplinaryAction`/expel handler test; assert the real migrated column (FIX-001-style real-schema assertion).
- **Status-history + audit** (backend/unit + integration): expel writes a `membership_status_history` row (fromStatus→`expelled`, changedBy, reason) and emits the `x-audit` event.
- **Cross-org guard** (permission/RBAC): an org-A officer expelling an org-B member id → 403/404 (mirror the FIX-003 guard model).
- **FE badge** (frontend/component): member-detail renders the `expelled` badge/label — extend `member-detail.test.tsx`.
- **E2E** `[BLOCKED BY ENVIRONMENT]` likely (no auth/seed — Steps 42/43 confirmed `/browse` redirects to `/auth/sign-in`). Prove via the handler + component nets and mark it. Pin Playwright 1.58.2 per `project_playwright_pin` if you add a spec.

## Step 5 — Validation

- `cd services/api-ts && bun test` (membership/association:member + the new expel tests) — green; no regressions.
- `cd services/api-ts && bunx tsc --noEmit` and `cd apps/memberry && bunx tsc --noEmit` — clean across touched workspaces.
- Contract suite if TypeSpec changed: `bun run scripts/run-contract-tests.ts` against a booted impl (or mark `[BLOCKED BY ENVIRONMENT]`).
- Live browse only if a real authed member-detail page is reachable; otherwise mark `[BLOCKED BY ENVIRONMENT]`. Evidence under `docs/aha/evidence/`.

## Stop condition

- **Path (A):** after Track B is recorded RATIFIED + docs reconciled, append a **Step 44 — Track B ratification** section to `membership-lifecycle-fix-report.md` (decisions captured, doc reconciliation, no code) and update the roadmap §13/§18 (HALT resolved → CLOSED). Then STOP.
- **Path (B)/(C):** after the reopened slice is GREEN, append a **Step 44 — Track B ratification + E2.1 <slice>** section to `membership-lifecycle-fix-report.md` (decision, RED→GREEN, files, evidence, completion) and update `membership-lifecycle-fix-ready-plan.md` (the reopened FIX → resolved) + roadmap §13. Then STOP. Do NOT auto-chain to other gated modules.

After Track B closes, the next gates are the standing **P0 product decisions** (roadmap §13): elections **G2/FIX-002** (position identity FK vs jsonb), documents **Q1** (card-verify URL contract), and the **P1 cluster** (training TC-DEC-01/02, person-profile Q-1/Q-4, platform-admin Q1/Q8, notifications Q1/Q3, dues Q-PD6/7/8, surveys PD-1/2/3, realtime PD-2/PD-3). Each is its own `[NEEDS PRODUCT DECISION]` session — resolve, then run the unblocked `04`.

execute systematically
