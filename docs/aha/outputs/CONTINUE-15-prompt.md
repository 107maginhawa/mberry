# Continuation prompt — AHA Step 15 (next `04`: Person & Profile — Batch C **frontend** slice = FIX-010 grace banner + FIX-011 id-card org selector) = pass **A8b**

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-15-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (TDD fix, ONE module, decision-free subset) — but unlike A1–A8 it is **frontend + E2E**, so it needs the **memberry app (port 3004) + API (port 7213) running + a browser** (Playwright / `/browse`). Source = TanStack-Router pages in `apps/memberry/`. No backend handler change (the backends already exist), no TypeSpec change, no DB migration, no regen. Follow the fix-ready plan as the primary guide. Do NOT expand scope, do NOT touch backend handlers/specs, do NOT run another batch/module after this one. Stop after saving the fix report.
>
> **ENV GATE:** if the memberry app + a browser are NOT available in this session, do NOT fake it. Either (a) bring the stack up first, or (b) skip A8b and run the next **backend** decision-free pass **A9 (Marketplace Batch B)** instead, and come back to A8b when a browser is available. File-existence ≠ feature works — a real click-through + reload is mandatory (do not mark done from selectors alone).

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **Person & Profile (+ deletion cascade), Batch C frontend slice (FIX-010 deletion-grace banner + FIX-011 id-card org selector)**, using TDD (RED→GREEN per fix, E2E for the two core journeys). Then STOP after saving the fix report.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## The canonical AHA prompt sequence (do not forget this)

```txt
00-aha-shared-rules.md            # rules (always loaded)
01-platform-discovery-audit-index.md   # DONE
02-module-or-group-audit-gap-plan.md   # DONE
03-organize-gap-plan-for-fixing.md     # DONE
04-module-or-group-fix-tdd.md          # RUN ONCE PER MODULE/BATCH — repeats (THIS PASS)
05-cross-cutting-pattern-audit.md      # DONE
06-database-schema-audit.md            # DONE (through migration 0066)
07-consolidate-roadmap.md              # DONE + RE-RUN later (Track C)
```

Rules: never run `04` without a `03` fix-ready plan; execute only the SELECTED subset; stop after the fix report.

## What just completed (do NOT redo)

- **`04` Person & Profile — Batch C **backend** decision-free slice (FIX-007 + FIX-008 + FIX-009 + FIX-012 + FIX-014), 2026-06-12 — COMPLETE (A8).** FIX-007 wired 3 dead emits as additive consumers in `core/domain-event-consumers.ts` (`person.deletion.requested`/`.cancelled` → active officers, self excluded; `data-export.ready` → requester) + dropped the dead `person.anonymized` registry entry. FIX-008 added `certificates` + `prcId?` to the `MyDataExport` `.tsp` model (confined regen, **no new operationId**) + a shared `handlers/person/utils/build-data-export.ts` builder used by `exportMyData` + `requestDataExport`. FIX-009 added the `person.dataExportPurge` cron (`0 3 * * *`). FIX-012 logs `hasEmail` not raw email. FIX-014 corrected EVENT_CONTRACTS §0.1–0.3 (in-process bus, not pg-boss) + m02 API_CONTRACTS `/my/*`→`/persons/me/*`. See `docs/aha/module-fix-plans/person-profile-fix-report.md` § "Batch C backend slice". Full `bun test` (api-ts) = **6120 pass / 1 fail (pre-existing `registerEmailJobs`) / 4 todo**; monorepo typecheck **0 errors / 5 workspaces**.
- **Prior Person passes (Batch A/B/D, FIX-001..006) — DONE (2026-06-11).** Do not redo.

> **Carry-forward from A8 FIX-014 (READ THIS for FIX-011):** the A8 route recon found **no `id-card` route in `generated/openapi/routes.ts`**. The per-org id-card backend (`getMyIdCard` / `getMyIdCardPdf` / `getIdCardData`, touched in Batch B FIX-004) is therefore almost certainly **hand-wired in `services/api-ts/src/app.ts`**, not TypeSpec-generated. **Pre-flight for FIX-011:** confirm the real id-card route + its per-org path param (grep `app.ts` + `apps/memberry` SDK calls). If the per-org route genuinely does not exist, FIX-011 is **backend-blocked** → document it `[BLOCKED BY ...]` and ship **FIX-010 only** this pass.

## This pass — execute `04` for Person & Profile, Batch C frontend slice

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/person-profile-fix-ready-plan.md` (§3 rows FIX-010/011, §4 Batch C, §5 Test-First rows, §6 files, §10/§11 do-not-build).
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/person-profile-gap-plan.md`
   - Prior fix report (what's done — APPEND to it, do NOT rewrite): `docs/aha/module-fix-plans/person-profile-fix-report.md` (Batch A/B/D + Batch C backend all complete).
   - Module slug = `person-profile`. Readable name = "Person & Profile (+ deletion cascade)".
3. Invoke `superpowers:test-driven-development` (RED-first; E2E proves the journey).
4. **Selected subset — frontend (the two browser-proof journeys):**
   - **FIX-010 — persistent deletion-grace banner (P2, V1 RECOMMENDED, Batch C, G-09 / AC-M02-003).** `deletionScheduledAt` surfaces only inside Settings → General (grep `deletionScheduledAt` → only `apps/memberry/src/routes/_authenticated/my/settings.tsx` + `settings/account.tsx`; nothing in the `_authenticated.tsx` layout). A member with a pending deletion sees no app-wide warning → surprise data loss. Fix: render a persistent banner in the `_authenticated` layout (`apps/memberry/src/routes/_authenticated.tsx`) off `getPerson('me').deletionScheduledAt`, with a **Cancel deletion** CTA wired to the existing `cancelMyAccountDeletion` hook (`POST /persons/me/cancel-delete`). RED-first E2E: request deletion → navigate to the dashboard → banner is visible → click Cancel → reload → banner gone. Use the generated SDK hooks (`useGetPerson` / `useCancelMyAccountDeletion`-equivalent); do NOT hand-roll fetch.
   - **FIX-011 — id-card org selector for multi-org members (P2, V1 RECOMMENDED, Batch C, G-12 / WF-012).** `apps/memberry/src/routes/_authenticated/my/id-card.tsx:57,80` hardcodes `memberships[0]` → multi-org members cannot view cards for their other orgs, despite a per-org backend. Fix: add an org `<select>` that drives the id-card data fetch by `:orgId` (use shadcn `Select`; the value must select among the member's active memberships). **Pre-flight the route first (see carry-forward note above).** RED-first E2E: a 2-org member sees a selector → switching org renders the second org's card. If backend-blocked, document and skip.
5. **Do NOT implement in this pass (out of subset / blocked / later):**
   - FIX-001..009 / FIX-012 / FIX-014 — already DONE (Batch A/B/C-backend/D). Do not redo.
   - **FIX-013** (`notification_preference` orgId scoping) — **Excluded** (`[NEEDS CONFIRMATION]` Q-7). Pass A8c, after Q-7 eng+product confirmation.
   - `gender` scrub (Q-4), G-02 4 unenforced privacy toggles (Q-1, cross-module directory), G-06 directory-publish duplicates (cross-module), the generated-Zod required→optional generator bug (prompt 05), the `core/domain-events.ts` reliability upgrade (core-platform) — all excluded.
   - Everything in fix-ready §10 (Deferred) and §11 (Do Not Build): consent fields, websocket privacy propagation, new `person.*` events, pg-boss/DLQ bus, admin update-any, ZIP export, share-link flag, email-change OTP UI, license regex, cascade-scope extension, `subSpecialization`/`yearsOfPractice`/`affiliation` fields, server-side DELETE-confirmation body, avatar upload on profile edit (G-13, V2).
6. TDD / E2E discipline: write the failing E2E/component test FIRST for each fix (watch it fail for the right reason — FIX-010: no banner on the dashboard during grace; FIX-011: only `memberships[0]`'s card is reachable). Implement the smallest correct UI change, re-run. **Real user flows, not selector-existence** — the E2E must drive the actual request-deletion → see-banner → cancel → reload-gone journey (FIX-010) and the org-switch → second-card-renders journey (FIX-011). After GREEN, **browse the pages yourself** (`/browse` or Playwright) and confirm with eyes + a reload, not just a passing assertion. Reserve E2E for exactly these two journeys (per fix-ready §5: privacy-toggle/grace/id-card are the only browser-proof journeys).
7. **Pre-flight reads BEFORE touching code (do not skip):** the Vite proxy + `/api`-strip behaviour, the toast system (`sonner`, NOT shadcn `useToast`), the auth flow (`/auth/sign-in`), the `_authenticated` route/layout pattern, how existing pages call SDK hooks, and the existing E2E setup (`apps/memberry/tests/e2e/` — `settings.spec.ts`, `member/digital-id-card.spec.ts`, the auth/login fixture). Playwright is pinned to **1.58.2** (1.59 breaks `test.describe` — do not bump). Use `bun run test:e2e` from `apps/memberry`.
8. Validate: focused component/E2E per fix → `apps/memberry` typecheck (`bun run typecheck` in the app, or `bun run --filter '*' typecheck`) → the relevant E2E spec(s) green against the live stack → a manual browse of both pages. Save the fix report (APPEND a "Batch C frontend slice — FIX-010 + FIX-011" section to `person-profile-fix-report.md`; do not rewrite prior sections). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes:**
- A1 Membership · A2 Elections · A3 Auth/RBAC · A4 Billing · A5 Communications · A6 Documents · A7 Notifications — ✅ DONE.
- A8 Person Batch C **backend** (FIX-007/008/009/012/014) — ✅ DONE (2026-06-12).
- **A8b Person Batch C **frontend** (FIX-010 + FIX-011) — THIS PASS.** (needs memberry app + Playwright)
- A8c Person FIX-013 (`notification_preference` orgId) — after Q-7 eng+product confirmation.
- A9 Marketplace Batch B (FIX-003/004/005/006/007; exclude reviewCreative/verifyVendor re-gate → G-06). **← run this next if A8b's browser env is unavailable.**
- A10 Platform-admin Batch B subset (FIX-003 invite, FIX-006 sort, FIX-007 impersonate UI).
- A11 Realtime Batch B subset (FIX-007 OR-shim, FIX-009 ws:true verify-then-fix).
- A12 Dues Batch B subset (FIX-004 position-gate, FIX-005 fund-splits, FIX-006 self-scope).
- A13 Training Batch E (FIX-014 real E2E proof of P0 credit journey).

**Carry-forward loose ends (small, eng-confirm — slot anytime):**
- **Auth/RBAC `officerAuthMiddleware` dead-triplet** — decide delete-vs-amend (`/codex`). Context in `auth-rbac-fix-report.md`.
- **Notifications stripe-webhook silent-fail** — `handlers/billing/handleStripeWebhook.ts` omits `organizationId` on 5 `createNotification` calls → those payment notifications never fire (A7 orgId guard made it explicit; thread orgId in a billing/notifications pass). `[CROSS-MODULE RISK]`.
- **A8-surfaced (FIX-014):** verify whether `POST /persons/me/data-export` (`requestDataExport`) + the id-card routes should exist in the generated registry or are hand-wired; wire or remove. (Directly relevant to FIX-011 pre-flight.)

**Track B — decision-gated (the bottleneck):**
- B1. Resolve 3 P0 product decisions: elections G2 position-identity → documents Q1 card-verify token → realtime PD-1 channel-membership. Then headline P1s incl. person Q-1 (privacy model) + Q-4 (gender) + Q-7 (pref store/org). Full agenda in roadmap §13.

**Track C — consolidate + ship (after A + B land):**
- C1. Re-run `07-consolidate-roadmap.md`.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state (after Person Batch C backend, 2026-06-12)

- Docker up (postgres + mailpit + minio + stripe-mock). DB `localhost:5432/monobase` migrated through **0066** + seeded. **A8b needs the live frontend stack:** start the API (`cd services/api-ts && bun dev` → :7213) and the memberry app (`cd apps/memberry && bun dev` → **:3004**), then run E2E / `/browse` against `http://localhost:3004`. The Vite proxy strips `/api`. To avoid disturbing a running :7213, you may boot a throwaway API (`cd services/api-ts && SERVER_PORT=7299 bun src/index.ts`) and point the app's proxy at it.
- Known-good baselines (AFTER A8): full `bun test` (api-ts) = **6120 pass / 1 fail / 4 todo** (the 1 fail PRE-EXISTING + UNRELATED: `registerEmailJobs`). Monorepo `tsc` (`bun run --filter '*' typecheck`) = **0 errors** (5/5). This pass should add E2E + (if any) component tests; the api-ts unit count should not change (no backend edit). `apps/memberry` typecheck must stay green.
- `check:sdk-compat` exits 1 **by design** (frozen baseline carries prior pending ops incl. A8's `MyDataExport` field add — which is model-only, no new operationId). Do NOT `--update` the baseline until milestone Step 6. **This pass touches NO `.tsp` and runs NO regen.**
- Playwright pinned **1.58.2** (1.59 breaks `test.describe`). Do not bump.

## Tree / commit rules

- NOTHING committed; working tree dirty (~290 files across all prior AHA passes + A8: `person-custom.tsp`, the confined regen, `build-data-export.ts`, `dataExportPurge.ts`/`.test.ts`, consumer/registry/handler edits, 2 docs, the fix report). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. This pass is frontend source + E2E ADDs/edits only — no backend/spec/regen changes, no unrelated file deletes. Do not commit unless asked.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY Person & Profile Batch C frontend slice (FIX-010 + FIX-011). Do NOT touch backend handlers/specs, do NOT continue to another batch or module. Save the fix report and stop. If the browser/app env is unavailable, switch to A9 (Marketplace Batch B, backend) per the ENV GATE.

execute systematically