# Continuation prompt — AHA Step 36 (documents-credentials Batch D — FIX-008 credentials per-handler unit suites, P1 `[TEST GAP]`; decision-free)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-36-prompt.md`.

> **Decision-free.** Batch D is pure test-hardening — no product decision, no schema/migration, no handler behavior change. It is the FIX-008 prerequisite that MUST land before any future credentials handler fix (Batch C). Why now: the credentials surface is trust-critical (issue / revoke / verify / public-lookup / license lifecycle) and has only 2 test files for 21 handlers. **Strictly test-only.** If a test reveals a real handler bug, STOP and record it as a finding — do NOT fix handler logic in this pass (that would leave Batch C scope and risk un-gated changes).

---

Continue the AHA remediation. CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`. Fix-only, TDD, manual, no autorun, no commit unless asked.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md` and `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. `docs/aha/module-fix-plans/documents-credentials-fix-ready-plan.md` — **FIX-008 / Batch D** (§3 row FIX-008, §4 Batch D, §5 Test-First row FIX-008). Batch D = "per-handler credentials unit suites (issue / revoke / verify authenticated+public / public-lookup PII projection / license CRUD / alert acknowledge)".
3. `docs/aha/module-gap-plans/documents-credentials-gap-plan.md` — G8 raw evidence only (context).
4. Prior fix-report `docs/aha/module-fix-plans/documents-credentials-fix-report.md` — **APPEND a new Batch D section, do NOT overwrite.** (B1 + Batch A + A2 + B2 already landed; verify-chain is done. Batch C/F gated on Q8 + cert migration.)

Invoke `/using-superpowers` → `superpowers:test-driven-development` before writing tests (mandatory per 04 §3).

## Step 2 — Execute FIX-008 (Batch D) — per-handler credentials unit suites

**Scope: `services/api-ts/src/handlers/member/credentials/`** — 21 handlers, only 2 existing test files (`credentials.test.ts`, `lookupCredentialPublic.test.ts`). Add focused unit suites for the trust-critical ops, extending existing files where one fits, new `*.test.ts` per handler otherwise.

Priority handlers to cover (trust-critical first):
- `issueDigitalCredential.ts`, `revokeDigitalCredential.ts`
- `verifyDigitalCredentialAuthenticated.ts`, `verifyCredentialPublic.ts`, `lookupCredentialPublic.ts` (assert public surfaces project NO extra PII — voter/PII secrecy parity with elections FIX-003)
- `createProfessionalLicense.ts` / `updateProfessionalLicense.ts` / `deleteProfessionalLicense.ts` / `getProfessionalLicense.ts` / `listProfessionalLicenses.ts`
- `acknowledgeLicenseRenewalAlert.ts`, `listLicenseRenewalAlerts.ts`
- credential template CRUD (`create/update/delete/get/listCredentialTemplate(s).ts`) — lighter coverage

Prove real behavior, not mocks-of-mocks: auth/401, not-found/404, RBAC/officer gates, status transitions (issue→active, revoke→revoked), public-lookup PII projection, duplicate/invalid guards. Follow the existing governance test patterns (`stubRepo`/`restoreRepo`/`makeCtx` from `@/test-utils/make-ctx`, factories from `@/test-utils/factories`). RED-first where a test exposes a missing assertion; otherwise it is GREEN regression coverage of correct code — label honestly in the report (same framing as elections Step 35).

**Hard constraints:**
- **No handler/source/schema/seed/FE/TypeSpec change.** Test files only. If a test reveals a real bug → record in the report's Remaining Gaps as a finding for a later Batch C pass; do NOT fix it here.
- No regen pipeline (no TypeSpec change). Do NOT touch generated files or the SDK baseline.
- Prefer extending existing suites over new files where a suitable file exists.

## ENV / discipline

- Working tree intentionally dirty (recovery-2025 + AHA Steps 31–35). PRESERVE. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.**
- Known-good baselines (do NOT regress; establish at session start): api-ts `bun test` ≈ **6220 pass / 1 fail** (the 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs` interval flake 30000-vs-1000; a 2nd `getNextBookableTime` wall-clock flake is intermittent). `tsc` monorepo **5/5 workspaces exit 0**. memberry `bun run test` ≈ **669–679 pass / 0 fail**. DB through **0068** (this pass adds NO migration). `check:sdk-compat` exits 1 from pre-existing path-move drift — do NOT `--update`.
- Validation to run (don't claim a command passed unless it ran): new credentials suites (RED where applicable → GREEN) → `bun test src/handlers/member/credentials/` → full api-ts `bun test` (confirm only the known pre-existing fail) → api-ts `tsc --noEmit`. memberry test/typecheck only if a FE file were touched (it should NOT be).
- Append a FIX-008 / Batch D section to `documents-credentials-fix-report.md` (04 §12 structure).

## Stop condition

After Batch D lands + its fix-report section saved, STOP. Do NOT auto-chain to Batch C (gated on Q8 + cert migration).

## ⚠️ Outstanding product decisions (engineering blocked — surface to user, do NOT bake unilaterally)

The decision-free backlog is nearly drained; remaining high-value work is gated. After Batch D, the real blocker is **product-decision throughput**. Pending ratifications / decisions to put to the user:
- **elections position-identity** (FIX-002) — implemented as engineering-default (honor `position` FK), **ratification-pending**.
- **documents Q1** (card-verify token) — implemented as engineering-default (reuse credential public-verify token, lazy member-card credential), **ratification-pending**; **Q8** cert-schema backfill still undecided (blocks Batch C/F).
- **elections FIX-004** cancelled-election vote retention (soft-void vs hard-delete).
- **realtime PD-1/PD-2**, **surveys PD-1/2/3**, **platform-admin enforcement Q1–Q4/Q8**, **notifs Q1/Q2/Q3**.

execute systematically
