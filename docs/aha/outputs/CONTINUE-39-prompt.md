# Continuation prompt — AHA Step 39 (DECISION-FREE — certificates Batch F migration → Batch C)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-39-prompt.md`.

> **Decision-free.** Step 38 ruled Q8 (cert-schema backfill) = **Option A: nullable + lazy-link**. That unblocked the last gated certificates work. This session EXECUTES the migration + handler/contract fixes via TDD. No new product decisions required. One minor edge (Q6 zero-credit certs) has an engineering default baked in below — flag it, don't block on it.

---

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`. No autorun. No commit unless asked. Working tree intentionally dirty (recovery-2025 + AHA Steps 31–38) — PRESERVE. FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md`.
2. `docs/aha/prompts/04-module-or-group-fix-tdd.md` (the TDD fix-prompt protocol — follow it).
3. `docs/aha/module-fix-plans/documents-credentials-fix-ready-plan.md` — **§Decisions Step 38** (Q8 = Option A, full migration shape), **§4 Fix Batches** (Batch F + Batch C rows), **§6 Likely Files To Touch** (FIX-005/006/015 rows), **§12 Root-Cause Notes** (FIX-005/006/015).
4. `docs/aha/module-fix-plans/documents-credentials-fix-report.md` §Step 38.

## Step 2 — Batch F: certificate uniqueness migration (Option A)

Per Q8 = Option A. In `services/api-ts/src/handlers/member/certificates/repos/certificates.schema.ts`:
- Drop `notNull()` on `certificate.trainingId` (make nullable).
- Replace `unique('certificate_training_person_unique').on(trainingId, personId)` with a **partial unique** index `(trainingId, personId) WHERE training_id IS NOT NULL`.
- Generate migration (`cd services/api-ts && bun run db:generate`). The migration must ALSO `UPDATE certificate SET training_id = NULL WHERE training_id = organization_id` (NULL out the bogus self-ref rows — pre-launch pilot, seed/test data only). Review generated SQL; Drizzle may not emit the partial index or the UPDATE — hand-author the data step + partial index in the generated migration file if needed (this is one of the explicitly-editable generated dirs per the migration workflow).

RED first: a schema/repo test proving (a) two distinct real `trainingId`s for the same person both insert, (b) duplicate `(real trainingId, personId)` rejects, (c) multiple NULL-`trainingId` rows for the same person coexist.

## Step 3 — Batch C: FIX-006 → FIX-005 → FIX-015

- **FIX-006** (real trainingId linkage): add `trainingId` to the bulk-issue TypeSpec body (`specs/api/src/association/member/certificates.tsp`), regenerate (`cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`). Stop `bulkIssueCertificates.ts:46` setting `trainingId: body.organizationId` — use the real `body.trainingId`. Update the `certificate.bulk_generate` job payload (`association:member/jobs/index.ts`). RED: bulk-issue with real trainingId persists it + uniqueness holds on real training.
- **FIX-005** (server-resolved cert PDF + embedded HMAC QR): `generateCertificatePdf.ts` / `certificate-template.ts` resolve cert data server-side, embed the existing `certificate-qr` (reuse the Q1-resolved credential/cert token scheme — do NOT mint a new HMAC surface), and the GET route (`app.ts:520`) drops client-supplied identity body overrides (forgery surface). RED: PDF carries QR + server-resolved identity; client override ignored.
- **FIX-015** (branding): `certificate-template.ts` + `handlers/person/getMyIdCardPdf.ts:199` — "Powered by" → "Verified by Memberry".

**Q6 edge (eng default, FLAG don't block):** zero-credit trainings (attendance/speaker certs, `creditHours = 0/null`) → **DO generate a certificate** (cert existence is independent of CPD credit). Bake this default into the test design; note it in the fix-report for ratification.

## Step 4 — m09 seam

FIX-006's real `trainingId` must reference an actual training row. Confirm the officer-facing bulk-issue flow supplies a valid `trainingId` (training selection). If the caller has no training source yet, the contract addition still lands (nullable-tolerant) but flag the seam in the report.

## Stop condition

After Batch F + Batch C land GREEN (typecheck + bun test for touched handlers/schema), append a Batch F/C section to `documents-credentials-fix-report.md` (scope, changes, tests, files, completion decision), update `documents-credentials-fix-ready-plan.md` §9 Blocked Items (Batch C/F → resolved), then STOP. Do NOT auto-chain into the remaining ratification pile (documents Q1, elections FIX-002/004, realtime/surveys/platform-admin/notifs) — those are separate decision sessions.

execute systematically
