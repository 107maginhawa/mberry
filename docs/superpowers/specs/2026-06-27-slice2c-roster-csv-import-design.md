# Slice-2c — apps/org Roster CSV Import (design)

Date: 2026-06-27 · Branch: `feat/slice2c-roster-csv-import` · Base: main `70d5d35c` v0.1.6.0

## What & why

The chapter roster is the **funnel asset** — the contact list that feeds dues
(slice-2b lists it and sends pay-links against it) and future health apps. Slice-2c
lets an officer populate that roster by uploading a CSV. An officer uploads a CSV of
members; the **frozen** engine match-or-creates membership rows; the officer sees a
result summary (imported / matched-skipped / errors).

This is **greenfield UI in apps/org over two frozen, already-correct engine endpoints**.
No engine, spec, or generated-SDK changes. Additive-only.

## Engine endpoints used (FROZEN — verified by reading handler source)

### `importRosterMembers` — the import
- `POST /association/member/roster/import`
- SDK: `importRosterMembers` (`@monobase/sdk-ts/generated`), JSON body (`Content-Type: application/json`).
- Request `ImportMembersRequest`: `{ organizationId: string; tierId: string; members: ImportMemberRow[] }`.
- `ImportMemberRow`: `{ firstName?; lastName?; email?; licenseNumber?; memberNumber? }`.
  - Match/create needs **email OR licenseNumber** per row.
  - `firstName` is **required to CREATE** a new person (matched persons don't need it).
- Response `ImportResult` (handler `importRosterMembers.ts:151` → `ctx.json({ imported, skipped, failed, errors }, 200)`):
  `{ imported: number; skipped: number; failed: number; errors: Array<{ index: number; error: string }> }`.
  - `imported` = new memberships created · `skipped` = person already a member (matched) ·
    `failed` = row failed validation/insert (each has an `errors[]` entry).
- Auth: `requirePosition(Secretary | President)`. **No 2FA** on this handler.
- Org scope: `ctx.get('organizationId')` from `x-org-id` header (Task-2 SDK interceptor injects it).
  Body also carries `organizationId` + `tierId` (both required by the type).
- Cap: **500 rows max** per request (handler 400s above that).

### `listMembershipTiers` — the tier dropdown
- `GET /association/member/tiers` · SDK `listMembershipTiers` · x-org-id scoped · any authed user.
- Response `MembershipTierListResponse`: `{ data: MembershipTier[]; pagination }`.
- `MembershipTier`: `{ id; name; code; description?; annualFee: bigint; currency; benefits[]; status }`.
  `tierId` for import = `tier.id`. Has a response transformer (annualFee is bigint) — only `id`/`name`/`code`
  are consumed for the dropdown, so no money coercion is required, but treat `annualFee` as bigint if ever shown.
- Tiers are auto-seeded per org (Regular / Associate), so the dropdown is never empty for a real org.

## Architecture (units, each independently testable)

```
apps/org/src/features/roster-import/
  csv.ts              parseCsv(text) → string[][]  (ported RFC-4180, no new dep)
                      mapRows(grid) → { rows: ImportMemberRow[]; headerError?: string }
  csv.test.ts         parser + header-map edge cases (RED-first)
  use-tiers.ts        useTiers() → listMembershipTiers (idle until org selected)
  use-import-roster.ts useImportRoster() mutation → importRosterMembers; on success invalidates ['roster']
  ImportRoster.tsx    presentational steps (tier select · file pick · preview · summary) + container
  ImportRoster.test.tsx  hook + render tests (mocks anchored to HANDLER shapes via ok()/err())
apps/org/src/routes/import.tsx   thin route → ImportRoster container
apps/org/e2e/import-flow.spec.ts officer → import → preview → summary (handler-shape page.route stubs)
```

### CSV parsing (client-side, the only non-trivial logic)
- Port the engine's proven minimal RFC-4180 parser (`invite/bulkImportMembers.ts:26-66`) into
  `csv.ts` — handles quoted fields, escaped `""`, commas/newlines inside quotes, CRLF, trailing field.
  **No new dependency** (ladder: a correct parse is ~40 lines; the engine already proves it).
- `mapRows`: header row lowercased+trimmed; auto-map columns by name (accept common aliases):
  - `firstname` / `first name` / `first` → firstName
  - `lastname` / `last name` / `last` → lastName
  - `email` / `e-mail` → email
  - `licensenumber` / `license` / `license number` / `prc` / `prc number` → licenseNumber
  - `membernumber` / `member number` / `member no` / `member #` → memberNumber
  - Require at least one of email/licenseNumber columns present, else `headerError`
    ("CSV must include an email or licenseNumber column").
- Trim cell values; drop fully-empty rows.

### Client-side preview + validation (no server preview — importRosterMembers has none)
Before POSTing, show a preview table of parsed rows with per-row client validation flags:
- row has neither email nor licenseNumber → **will fail** (engine rejects).
- row has no firstName and looks like a new person → **may create-fail** (we can't know match status
  client-side; surface as an advisory "needs first name if new", not a hard block — the engine decides).
Show counts: total parsed, ready, advisory. "Import N members" button posts the full array
(client does not pre-filter — the engine is the authority; client validation is guidance only).

### Result summary
After the POST resolves, render `ImportResult`:
- "✓ N new members added" (imported)
- "↺ N already members (skipped)" (skipped)
- "✗ N rows failed" (failed) with an expandable list of `errors[]` (row index + message;
  index maps to the submitted array, surface as "Row {index+1}").
- Primary action: "View roster" → navigate `/` and the roster query is fresh (invalidated on success).

## Error / edge handling
- 403 (not Secretary/President) → `role=alert` "Importing the roster needs a Secretary or President
  officer position." No client-side role pre-gate (anchor to engine enforcement — slice-2b lesson).
- 400 from engine (e.g. tierId invalid / >500 rows) → surface the real server `error` message
  (read SDK `error` field, not `data`).
- >500 rows detected client-side → block the Import button with a clear message before POSTing.
- Empty file / no data rows / header-only → friendly "No member rows found in this file."
- SDK no-throw on non-2xx + `data: undefined` on transport error → read `response.status` /
  `error`; mutationFn throws on non-2xx so React Query surfaces it.
- No money, no bigint at any request seam in this slice (tiers `annualFee` not sent).

## Carry-forward gotchas (from slice-2a/2b — baked into every task brief)
- SDK client import `@monobase/sdk-ts/generated/client.gen`; fns from `@monobase/sdk-ts/generated`. No root export.
- SDK does NOT throw on non-2xx; `data: undefined` on transport err → read `response.status` / `error` field.
- **Anchor mocks to the real HANDLER shape (read handler source), not types.gen.ts.** Use the existing
  `src/test-utils/mock-sdk.ts` `ok()/err()` helper: trustworthy endpoints → `ok<XResponse>()`; any drift →
  mock real handler shape w/ cast+comment. `importRosterMembers`/`listMembershipTiers` showed no drift, but still
  bind via the typed helper so a wrong field fails compile.
- Test mocking = `vi.mock('@monobase/sdk-ts/generated', () => ({ fn: vi.fn() }))` factory (NOT vi.spyOn on
  generated ESM). Real vitest + RTL + jsdom. vitest include only `src/**/*.test.ts(x)` (exclude `.spec` E2E).
- `tsconfig.test.json` exists → test files ARE typechecked by the CI `org` job `typecheck`. Keep them typed.
- `routeTree.gen.ts` regen (tsr/build) + **COMMIT** before typecheck. Port 3005. Playwright pin 1.58.2,
  portable `../../node_modules/.bin/playwright`.
- CI `org` job already exists (build → typecheck-incl-tests → test, `--filter @monobase/org`). No new CI job.
- All UI on `packages/ui` Friendly-Clarity tokens; a11y (≥18px, ≥48px tap, `role=alert`, labeled inputs,
  one primary task/screen). `sonner` toasts. No `/api` prefix (Vite proxy strips).

## Engine-FROZEN invariant (hard gate)
`git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated` MUST be EMPTY. apps/org adds
nothing under services/. Only `apps/org/**` (and `packages/ui` only if a genuinely shared primitive is needed —
not expected this slice).

## Out of scope (v1 — flagged future)
- Manual CSV column-mapper UI (auto-detect by header only).
- Chunked import of >500-row files (reject with message v1).
- Server-side preview / dry-run (use bulkImportMembers' preview mode) — different endpoint/asset (invites).
- Editing parsed rows inline before import (re-upload a corrected CSV instead).
- Per-row tier assignment (one tier per import v1).
- Within-file duplicate-email advisory (the engine match-or-create skips dupes; not worth client code v1).

## Definition of done
- Every workspace typechecks incl. apps/org tests (`bun run typecheck`); apps/org unit tests pass; apps/org builds.
- Engine byte-untouched (frozen diff EMPTY).
- E2E stub green; CI `org` job green on PR.
- Final opus whole-branch review: 0 Critical / 0 Important (or all applied).
- Live officer click-through + real import wait on G2 (founder long pole) — documented, not blocking merge.
