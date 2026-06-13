# Continuation prompt — AHA Step 40 (DECISION-FREE — close documents-credentials Batch A: id-card scannable QR + verify-chain E2E)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-40-prompt.md`.

> **Decision-free.** Batch A (verification chain) is ~90% shipped across Steps 29–38: FIX-002 route shadowing collapsed to a single `/verify/$id` dispatch, FIX-014 staleness helper, FIX-012 fail-closed secrets. Q1 was RESOLVED Step 29 (reuse the existing credential token + `verify/$id` route — do NOT mint a new HMAC surface). This session closes the LAST technical gap: the member ID-card PDF prints the verify URL as **plain text, not a scannable QR image** (the `getMyIdCardPdf.ts` comment calls the QR image a "follow-up"). Reuse the `drawQrCode` helper that Step 39 added for certificates. Then browser-verify the full scan→verify chain end-to-end (this also resolves Q2 — which `/verify` shape wins — now moot since routes collapsed to `$id`, but confirm the dispatch live). No new product decisions required.

---

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`. No autorun. No commit unless asked. Working tree intentionally dirty (recovery-2025 + AHA Steps 31–39) — PRESERVE. FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md`.
2. `docs/aha/prompts/04-module-or-group-fix-tdd.md` (TDD fix protocol — follow it).
3. `docs/aha/module-fix-plans/documents-credentials-fix-ready-plan.md` — **§Decisions Step 29** (Q1 = reuse credential token + verify route), **§3/§4** (FIX-001/002/012/014 = Batch A rows), **§Step 39 fix-report** (the `drawQrCode` helper + verify-QR pattern just shipped for certs).
4. `docs/aha/module-fix-plans/documents-credentials-fix-report.md` §Step 39 (Batch F/C — the cert QR you will mirror).

## Step 2 — FIX-001 closeout: scannable QR on the ID-card PDF

Currently `services/api-ts/src/handlers/person/getMyIdCardPdf.ts:188-197` prints `memberry.app/verify/<credentialNumber>` as **text only**. Reuse the Step-39 cert QR:
- The vector-matrix QR drawer is `member/certificates/utils/certificate-template.ts` → `drawQrCode(page, {x,y,size,data})` (uses the `qrcode-svg` dep + ambient decl `src/types/qrcode-svg.d.ts`). Either export/lift it to a shared util (e.g. `core/pdf/qr.ts`) and import from both, OR mirror the small helper — pick the lower-churn option; do not duplicate logic if a 1-line lift suffices.
- Draw a scannable QR of the canonical verify URL when `card.verifyCredentialNumber` is present (active membership with a member-card credential). When absent, keep the text-only "memberry.app/verify" entry point (no broken QR).
- The QR content is the SAME canonical `/verify/<credentialNumber>` URL the text already prints (Q1: reuse the credential token/number scheme — do NOT mint a new id-card HMAC URL).

RED first: a `getMyIdCardPdf` unit/template test proving (a) an active card with `verifyCredentialNumber` produces a larger PDF than one without (QR adds content — mirror the cert `certificate-template.test.ts` size-delta assertion), and (b) the no-credential card still renders. PDF text is not greppable (binary) — assert on byte-size delta + `%PDF` magic, as the cert tests do.

## Step 3 — Verify-chain E2E (resolves Q2)

Use the `/browse` skill (gstack) to confirm the live chain end-to-end (Q2 — route dispatch winner):
- Hit `/verify/<a real credential number>` and `/verify/<a real certificate number>` and `/verify/<token-with-a-dot>` on the running memberry app; confirm each resolves to the CORRECT verifier body via `verify-dispatch.ts` `resolveVerifyKind` (credential vs certificate vs token) — no "not found" shadowing.
- Confirm the backend public-verify endpoint the page calls actually returns a valid/invalid result (credential public verify + `verifyCertificatePublic`).
- Save evidence under `docs/aha/evidence/playwright-findings/` (or `screenshots/`).
- If the dev stack is not running, start it (`cd services/api-ts && bun dev` on 7213; `cd apps/memberry && bun dev` on 3004) — or mark `[BLOCKED BY ENVIRONMENT]` and assert the dispatch via the existing `verify-dispatch.test.ts` unit coverage instead.

## Step 4 — Validation

- `bunx tsc --noEmit` (clean).
- `bun test` for touched files: `getMyIdCardPdf` + any lifted QR util + `verify-dispatch.test.ts`.
- Do NOT run `check:sdk-compat` unless a TypeSpec change is made (none expected) — note the pre-existing 25-op path-rename drift is unrelated baseline noise (see Step 39 §F/C.6).

## Stop condition

After FIX-001 QR lands GREEN + the verify chain is confirmed (live or unit-proven), append a Batch A closeout section to `documents-credentials-fix-report.md` (scope, RED→GREEN, E2E evidence, completion decision) and update `documents-credentials-fix-ready-plan.md` §9 (Batch A → resolved). Then STOP.

Do NOT auto-chain into the ratification pile — these are separate decision sessions, each its own `/clear`:
- **Ratifications pending user sign-off** (engineering-defaults already shipped): documents Q1 (Step 29), elections FIX-002 position-identity (Step 35), **m09 training-selector seam** (Step 39 §F/C.8 — officer bulk-issue form sends no real `trainingId` → certs land NULL), **Q6 zero-credit certs DO generate** (Step 39 §F/C.9).
- **Genuinely undecided** `[NEEDS PRODUCT DECISION]`: elections FIX-004 (cancelled-election vote retention: soft-void vs hard-delete), realtime PD-1/2, surveys PD-1/2/3, platform-admin Q1–Q4/Q8, notifs Q1/2/3.

execute systematically
