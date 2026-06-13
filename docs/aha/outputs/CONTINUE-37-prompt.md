# Continuation prompt — AHA Step 37 (documents-credentials FIX-012 follow-up — fail-close `verifyDigitalCredentialAuthenticated`, P2/security; decision-free)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-37-prompt.md`.

> **Decision-free.** This is a 1-line security hardening + regression test. No product decision, no schema/migration, no TypeSpec/generator regen, no FE change. It closes the finding recorded in the Batch D fix-report (§D.9): `verifyDigitalCredentialAuthenticated` is the last credential-verify surface that is NOT fail-closed. Batch D (FIX-008) just landed the credentials per-handler unit suites, so this handler is now protected before the change — the FIX-008 prerequisite is satisfied.

---

Continue the AHA remediation. CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`. Fix-only, TDD, manual, no autorun, no commit unless asked.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md` and `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. `docs/aha/module-fix-plans/documents-credentials-fix-ready-plan.md` — **FIX-012** (§3 row FIX-012, §5 Test-First row FIX-012, §12 root-cause). Note FIX-012 was marked Fixed in **Batch A** but only for `issueDigitalCredential` + `verifyCredentialPublic`; the authenticated verify surface was missed.
3. `docs/aha/module-fix-plans/documents-credentials-fix-report.md` — read the **Batch A §A.4** (the `resolveCredentialVerifySecret()` pattern) and **Batch D §D.9** (the recorded finding this pass closes). **APPEND a new Batch D2 (or "FIX-012 follow-up") section, do NOT overwrite.**

Invoke `/using-superpowers` → `superpowers:test-driven-development` before changing code (mandatory per 04 §3).

## Step 2 — Execute the FIX-012 follow-up

**Scope: `services/api-ts/src/handlers/member/credentials/verifyDigitalCredentialAuthenticated.ts` only.**

Current (line ~24):
```ts
const secret = process.env['CREDENTIAL_VERIFY_SECRET'] || 'dev-credential-verify-secret';
```
This falls back to a guessable literal — forgeable tokens in a misconfigured production env.

**Fix (mirror `verifyCredentialPublic.ts` exactly):** import `resolveCredentialVerifySecret` from `@/handlers/association:member/utils/credential-token`, resolve inside a `try/catch`, and on throw return the same `notFound` shape the public handler uses:
```ts
let secret: string;
try {
  secret = resolveCredentialVerifySecret();
} catch {
  return ctx.json({ result: 'notFound', credential: null }, 200);
}
```
`resolveCredentialVerifySecret()` already exists (added Batch A): env secret outside prod returns the dev literal; in `NODE_ENV=production` with the secret unset it THROWS rather than fall back. Do NOT invent a new secret scheme. Do NOT touch any other handler.

**Test-first (RED → GREEN):** extend `verifyDigitalCredential.test.ts` (created in Batch D):
- RED: prod-mode (`NODE_ENV=production`) with the verify secret unset → handler returns `{ result: 'notFound' }` and does NOT validate a token minted with the guessable literal. (Today it would validate it → assertion fails RED before the fix.)
- GREEN after fix. Keep the existing non-prod mapping tests passing (dev fallback still works outside prod).
- Restore `process.env.NODE_ENV` / the secret env var in a `finally` or `afterEach` so the change is test-local and does not leak into other suites.

**Hard constraints:**
- Only `verifyDigitalCredentialAuthenticated.ts` + its test change. No schema/seed/FE/TypeSpec change, no generator regen, no SDK touch.
- Do NOT alter `verifyCredentialPublic.ts` / `issueDigitalCredential.ts` (already fail-closed) or `verifyCertificatePublic.ts` (already `|| ''`-guarded).

## ENV / discipline

- Working tree intentionally dirty (recovery-2025 + AHA Steps 31–36). PRESERVE. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.**
- Known-good baselines (do NOT regress): api-ts `bun test` ≈ **6273 pass / 1 fail** (the 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs` interval flake 30000-vs-1000). `tsc` api-ts exits 0. DB through **0068** (this pass adds NO migration). `check:sdk-compat` exits 1 from pre-existing path-move drift — do NOT `--update` and do NOT run it (0 op change).
- Validation (don't claim a command passed unless it ran): RED → fix → GREEN on the extended `verifyDigitalCredential.test.ts` → `bun test src/handlers/member/credentials/` (expect 83+ pass, 0 fail) → full api-ts `bun test` (confirm only the known pre-existing fail) → api-ts `tsc --noEmit`. No memberry run (no FE file touched).
- Append a "FIX-012 follow-up" section to `documents-credentials-fix-report.md` (04 §12 structure). Update the §D.9 finding row to reference it as closed.

## Stop condition

After the fix + test land and the report section is saved, STOP. Do NOT auto-chain.

## ⚠️ After this: the decision-free backlog is empty

Once this lands, **every remaining AHA item is gated on a product decision** — there is no further decision-free engineering pass. Surface these to the user for ratification/decision rather than baking unilaterally:
- **Q8** cert-schema backfill — blocks documents-credentials Batch C/F (FIX-005/006/015, certificates PDF + real `trainingId` migration).
- **elections position-identity** (FIX-002) + **documents Q1** (card-verify token) — shipped as engineering-defaults, ratification-pending.
- **elections FIX-004** cancelled-election vote retention (soft-void vs hard-delete).
- **realtime PD-1/PD-2**, **surveys PD-1/2/3**, **platform-admin enforcement Q1–Q4/Q8**, **notifs Q1/Q2/Q3**.

execute systematically
