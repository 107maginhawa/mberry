# Post-merge backlog — after PR #1 (e2e remediation) merged to main

Date: 2026-06-21 · main HEAD `58e2443a` (PR #1 FF-merged) · branch for new work: cut from main.
Prior context: [[merge-pr1-e2e]], ledger `docs/superpowers/specs/2026-06-21-e2e-remediation.md`.

## Execution standards (apply to every item)
- **Verify every claim against source + LIVE behavior.** Codebase notes + subagents have been wrong repeatedly — confirm, don't trust.
- **Env-sensitive work (CI, e2e, prod env): fix + verify with the thing actually RUNNING**, never blind static edits.
- **Workflows**: implementer + reviewer per item/cluster, serial. Keep STATEFUL steps in the main loop (test runs, app/API restarts, push, watch CI, merge) so they're watchable.
- **Classify real-bug vs test-fragility / infra-gap; fix the right layer.**
- **Atomic conventional commits** + `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer. Per-commit pre-commit hook runs cross-workspace typecheck — keep green.
- **On main: branch first.** Don't force-merge red. Land via PR / FF when green.
- Progress ledger per effort in `docs/superpowers/specs/`.

---

## A. Fix `gates`/Quality-Gates (no-DB coverage) — make main truly green  [HIGH]
**Problem:** Quality Gates workflow runs `test:coverage:gate` → `scripts/coverage-gate.ts` → `bun test` with **no DB** ("Skipping: no DB connection / no DATABASE_URL" → "Coverage gate: bun test had failing tests"). Red on main's own HEAD f0b1fd84 too. The coverage gate is a **dead signal** today (always fails).
**Approach (verify each step):**
- Read `.github/workflows/` for the Quality Gates job + how `e2e`/`contract` jobs provision Postgres (services: postgres + DATABASE_URL + migrations).
- Add a postgres service + `DATABASE_URL` to the gates job; ensure migrations run before the gate (API runs migrations on start, or run the migrate step).
- Confirm `coverage-gate.ts` threshold logic + what it counts.
**Verify:** the gates job goes green in CI on a test branch; coverage threshold actually enforced (DB tests run). Don't just silence — make the tests run.
**Acceptance:** `gates` check passes on main; coverage gate gives real signal.

## B. Prod-readiness env gate — pre-deploy verification  [HIGH if deploying]
**Problem:** API fail-fasts in prod on missing/default secrets ([[prod-env-gate]], PR #11): INVITE_SECRET, UNSUBSCRIBE secret, storage, CORS — **plus** real Stripe keys ([[stripe-happy-path]]), officer 2FA (privileged titles in prod; [[d1-roster-import]] roster import 403s without it), and `STORAGE_PUBLIC_ENDPOINT` must differ from the internal endpoint in containerized prod ([[storage-upload]]).
**Approach:** enumerate every fail-fast/`requireEnv` in `services/api-ts/src/core/config.ts` + officer-check 2FA gates; produce a prod env checklist; verify the deploy env has each. Do NOT deploy until verified.
**Verify:** boot API with the prod env profile (or a prod-like profile) → no fail-fast crash; Stripe/storage smoke against prod-config values.
**Acceptance:** documented, verified prod env checklist; green prod boot.

## C. Real bugs / UX polish (batch)  [MEDIUM]
- **C1 — Officer roster table unreachable.** Content container capped ~720px (PageShell default width) even at 1600px viewport → officers only ever see the card layout, never the 9-col table (globals.css `.cq-roster-*` breakpoint 960px). Decide: widen the roster page (`PageShell maxWidth`) so the table renders, or accept cards-only. If widening, re-verify roster.spec still passes (it now asserts cards) and consider re-adding a table-columns assertion at the wider width.
- **C2 — NPS prompt overlaps form Save buttons.** Fixed bottom-right NpsProvider card intercepts clicks on bottom-right controls (caught on profile Save). Reposition / add bottom padding / suppress on form pages.
- **C3 — Document upload is metadata-only.** `features/documents/components/document-library.tsx` builds a `storageKey` but never uploads bytes (no `useFileUpload`). Wire the 4-step presigned flow ([[storage-upload]] has the working pattern). Real feature gap.
**Verify each:** live browse + the relevant e2e green.

## Stack/creds (reusable)
API :7213 (NO watch — restart after backend change: `kill "$(lsof -ti tcp:7213)"; cd services/api-ts && SESSION_LIMIT=100000 nohup bun src/index.ts >/tmp/api.log 2>&1 &`; warm `curl :7213/auth/ok`=200). memberry :3004, admin :3003. stripe-mock :12111, MinIO :9000. ORG pda-metro-manila `ed8e3a96-8126-4341-be42-e6eb7940c562`. officer test@memberry.ph / member member@memberry.ph / pw TestPass123!. e2e: `cd apps/<app> && bun run test:e2e <spec> --max-failures=0`. Playwright pinned 1.58.2. CI: `gh pr checks <n>` / `gh run view <id> --log-failed`.
