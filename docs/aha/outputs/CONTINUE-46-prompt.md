# Continuation prompt — AHA Step 46 (DECISION + BUILD — Person/Profile privacy: Q-4 gender scrub + Q-1 directory privacy model / G-02 toggle enforcement)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-46-prompt.md`.

> **The PII hub has two unresolved privacy gates — both product decisions, both now the lead P1 for person-profile.**
> (1) **Q-4** — at account anonymization (DPA 2012 right-to-erasure) `bio` is scrubbed but **`gender` is left in place**, pending a field-level-erasure policy call. The consolidated scrub helper makes this a **one-line** change once decided. (2) **Q-1** — the four member-facing privacy toggles (`emailVisible` / `phoneVisible` / `photoVisible` / `addressVisible`) in M02 Settings are **enforced nowhere** (G-02): they flip in the UI and persist, but no read path honors them — the directory keeps its **own** PII copy + visibility enum (`directory.schema.ts:35`, ADR-0005 duplication tension). The privacy model must be decided before G-02 can be built. **Q-1 also unblocks G-02.**
> This is a Steps 40/44/45-style **decision+build** session: capture the 2 decisions, then build ONLY the unblocked slice, TDD. **Q-4 is fully unblocked + module-local (build it).** **G-02 is buildable only if the chosen Q-1 model is module-local** (e.g. "remove the toggles from M02") — if the decision is "enforce in the directory projection," that crosses into the **chapters-directory** module and the build defers to a coordinated pass (capture the decision, mark the cross-module slice, do NOT half-build it).
>
> **Context for the picker:** the 3 standing P0s are all RESOLVED (elections G2 / Step 29, documents Q1 / Step 40, realtime PD-1 / Step 41); Track B CLOSED (Step 44); the **dues member-payment funnel CLOSED** (Step 45, Q-PD7+Q-PD8). person-profile decision-free Batches A/B/C (backend + frontend) are DONE — the only person-profile items left are exactly Q-4 and Q-1/G-02.

---

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`. No autorun. No commit unless asked. Working tree intentionally dirty (recovery-2025 + AHA Steps 31–45) — PRESERVE. FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md`.
2. `docs/aha/prompts/04-module-or-group-fix-tdd.md` (TDD fix protocol — follow it; this IS a build pass).
3. `docs/aha/module-fix-plans/person-profile-fix-ready-plan.md` — **§3 FIX-002** (`bio`/`gender` scrub), **§8 Q-1 / Q-4** (the two decisions), **§9 G-02** (4 unenforced toggles, cross-module), **§3 FIX-006** (the fake-green test class — keep using validator-inclusive tests).
4. `docs/aha/module-fix-plans/person-profile-fix-report.md` — confirm what already shipped (Batch A FIX-001 privacy-PATCH read-key, Batch B FIX-002 `bio` scrub + consolidated `anonymizePersonFields`, FIX-003/004/005, Batch C backend FIX-007/008/009/012/014 + frontend FIX-010/011). Do NOT re-do shipped fixes. `gender` (Q-4) + G-02 (Q-1) were explicitly NOT done — they are this pass.

**Pre-flight reads (BEFORE any edit — per `feedback_subagent_preflight`):** vite proxy + toast (`sonner`) + auth + route patterns; and:
- `services/api-ts/src/handlers/person/utils/anonymize-person.ts` (the consolidated scrub set — Q-4 adds `gender: null` here, one line) + `jobs/deletionProcessor.ts` (consumer) + `jobs/deletionProcessor.test.ts` (assert the explicit canonical field set, not a self-mirror).
- The 4 privacy toggles: `handlers/person/updateMyPrivacySettings.ts` + the privacy-settings schema + `apps/memberry/src/routes/_authenticated/my/settings.tsx` (~L317, where the toggles render/persist).
- The directory read path that SHOULD honor them: `directory.schema.ts:35` (visibility enum), the directory search/projection handler (`searchDirectory`), and any member-facing directory view — to judge whether enforcement is module-local or crosses into **chapters-directory** (G-02 `[CROSS-MODULE RISK]`).
- `person.schema.ts` (`gender` is a real stored column).

## Step 2 — Capture the 2 decisions (Q-4, Q-1)

Use `AskUserQuestion` (one question per decision; default = the engineering recommendation marked "(Recommended)"). Capture answers verbatim. Per `feedback_defer_decisions`, if the user defers ("your call"), apply the recommended option.

| ID | Decision | Options | Eng recommendation |
| --- | --- | --- | --- |
| Q-4 | **Scrub `gender` at anonymization?** Should DPA right-to-erasure null `gender` alongside `bio`? | (a) **Yes — scrub it** (add `gender: null` to `anonymizePersonFields`); vs (b) **No — retain** (keep `gender` for post-deletion aggregate/demographic integrity) | **(a) scrub** — field-level erasure completeness in the PII hub; `bio` already scrubbed; one-line in the consolidated helper, with a regression test asserting the explicit field set. |
| Q-1 | **Which privacy model wins for the 4 toggles?** | (a) **Enforce the M02 toggles** — the directory read/projection honors `emailVisible`/`phoneVisible`/`photoVisible`/`addressVisible` (toggles become real); vs (b) **Directory-curation model** — remove the 4 toggles from M02 UI/API; visibility owned solely by the directory profile's 3-level enum | **(a) enforce the M02 toggles** (members expect Settings to control their PII) **IF** enforcement is achievable in the person/directory read path this module owns; **fall back to scoping the build** — if enforcement lives in `chapters-directory`, capture the decision, build only the module-local part (e.g. expose the toggles to the projection), and defer the cross-module enforcement to a coordinated chapters-directory `04`. Confirm during pre-flight. |

## Step 3 — Build the unblocked slice (TDD, per prompt 04)

- **Q-4 (gender scrub) — always buildable, module-local:**
  - If (a): add `gender: null` to `anonymizePersonFields` (`anonymize-person.ts`); extend `deletionProcessor.test.ts` to assert `gender` is nulled in the canonical scrub set (RED first — current set omits it). Remove the `[NEEDS PRODUCT DECISION Q-4]` note in the helper.
  - If (b): document the retain decision in the helper comment; no code change (note it as a decided no-op).
- **Q-1 / G-02 (toggle enforcement) — build only the module-local slice:**
  - If the chosen model is **module-local** (the person/directory read path this module owns honors the toggles, or the toggles are removed from M02 UI/API): build it TDD — a read/projection test proving a hidden field is omitted for a non-self viewer when its toggle is off, present when on (enforce); or a test proving the toggles are gone from the API/UI surface (remove).
  - If enforcement is **cross-module** (`chapters-directory` owns `searchDirectory` + the visibility enum + the PII copy): **do NOT half-build it.** Capture the decision, build any module-local prerequisite only, and mark the cross-module enforcement `[CROSS-MODULE RISK]` → a coordinated chapters-directory `04` pass. Do NOT touch `directory_profiles` schema here (that is the directory module's DB plan).

Regenerate ONLY if TypeSpec changed: `cd specs/api && bun run build` → `cd services/api-ts && bun run generate` → regenerate SDK. Never hand-edit generated files. (Q-4 needs NO contract change; G-02 may, depending on the model.)

## Step 4 — TDD (RED first)

- **Q-4:** `deletionProcessor.test.ts` asserts the explicit canonical scrub field set INCLUDING `gender: null` (RED: currently omitted) — not a self-mirroring snapshot. Reuse the FIX-002 `anonymizePersonFields` regression pattern.
- **Q-1 / G-02 (if module-local):** validator-inclusive + read-path test (kill the fake-green class per FIX-006) — a non-self viewer does NOT see a field whose toggle is off; the owner always sees their own; assert via the real projection, not a hand-built body.
- **E2E** `[BLOCKED BY ENVIRONMENT]` likely (no seeded auth; `:3004` redirects to `/auth/sign-in` per Steps 42/43/45) — prove via handler + projection nets and mark it. Pin Playwright 1.58.2 per `project_playwright_pin` if you add a spec.

## Step 5 — Validation

- `cd services/api-ts && bun test` (person module + `deletionProcessor` + cascade/`domain-event-consumers` + any directory tests touched) — green; no regressions.
- `cd services/api-ts && bunx tsc --noEmit` and `cd apps/memberry && bunx tsc --noEmit` — clean across touched workspaces.
- Contract suite if TypeSpec changed: `bun run scripts/run-contract-tests.ts` against a booted impl (or mark `[BLOCKED BY ENVIRONMENT]`).
- Live browse only if a real authed settings/directory page is reachable; otherwise `[BLOCKED BY ENVIRONMENT]`. Evidence under `docs/aha/evidence/`.

## Stop condition

- After the unblocked slice is GREEN, append a **Step 46 — Person/Profile privacy (Q-4 + Q-1/G-02)** section to `person-profile-fix-report.md` (decisions captured, RED→GREEN, files, cross-module notes, evidence, completion) and update `person-profile-fix-ready-plan.md` (Q-4 → decided; FIX-002 `gender` → resolved-or-retained; Q-1 → decided; G-02 → built-or-deferred) + roadmap §13/§8 (mark Q-4 closed; mark Q-1/G-02 closed or note the cross-module carry-forward). Then STOP. Do NOT auto-chain to another gated module.

After person-profile: the next P1 gates (roadmap §13) are **training TC-DEC-01/02** (paid trainings + manual-entry verification gate); **platform-admin Q1/Q8** (admin tier taxonomy); **notifications Q3/Q1** (preference store of record + web-push descope); **realtime PD-2/PD-3** (DM org-scoping + video V1) — each its own `[NEEDS PRODUCT DECISION]` session. Re-run `07-consolidate-roadmap.md` once a few land (and to clear the stale §13 P0 table — G2/Q1/PD-1 all resolved).

execute systematically
