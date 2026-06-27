# Wave A — apps/console (T10): Founder/Platform-Operator App

**Date:** 2026-06-27
**Base:** main `09d493d7` v0.1.8.0 (after slice-3 apps/member dashboard)
**Branch:** `feat/wave-a-console`
**Slice:** the LAST of the 3 locked lean apps (`apps/org` ✅, `apps/member` ✅, **`apps/console`** ← this).

## 1. What this is

A deliberately thin founder/platform-operator PWA. One operator (the founder, Dr. Olive's
onboarder) signs in and can: **see all organizations + basic platform stats**, and
**create a new organization**. It earns no money and is the trio-completer — keep it thin,
one primary task per screen.

Built on `@monobase/ui` (Friendly-Clarity tokens), mirroring the proven authed spine of
`apps/org` / `apps/member`. **The engine stays byte-FROZEN this slice** (no
`services/api-ts/src`, `specs/`, or `packages/sdk-ts/src/generated` changes).

## 2. Scope decision (LOCKED 2026-06-27, user-approved)

The locked T10 line names create-org as "org + officer account + the org's PayMongo
connect-onboarding link." Engine recon (4 handler-source readers) found:

- **list orgs** — ✅ `GET /admin/organizations` → `listOrganizations` (SDK).
- **stats** — ✅ `GET /admin/national/platform` → `getPlatformSummary` (SDK).
- **create org** — ⚠️ `POST /admin/organizations` → `createOrganization` creates the **org row only**.
- **officer account** — ❌ `initialOfficerEmail` is in the TypeSpec body but the handler **ignores it**; no officer is seeded.
- **PayMongo connect-onboarding link** — ❌ **does not exist.** Only Stripe has merchant onboarding (`onboardMerchantAccount`). The engine models per-org PayMongo as *stored credentials* (`getDuesGatewayConfig`), not an OAuth Connect onboarding flow. A real onboarding endpoint needs **G2** (PayMongo platform account — the founder's external long pole, not done) plus a net-new money-rail integration.

**Decision: console v1 is THIN — org row only.** Defer officer-seed and PayMongo-onboarding
as flagged additive-engine follow-ups (§9). Rationale: PayMongo onboarding is G2-blocked +
net-new money rails (not lean, not unblockable now); officer onboarding is already served by
shipped **roster-import (slice-2c)** + **email-OTP account-claim (slice-3)**.

## 3. Architecture

New workspace `@monobase/console`, **port 3006** (member=3004, org=3005). Vite 7 + React 19 +
TanStack Router (file routes) + React Query 5 + `@monobase/sdk-ts` + `@monobase/ui` preset.
Vite proxy `/api → :7213` (rewrite strips `/api`). Mirrors `apps/org` config exactly.

**Ported authed spine + anti-false-green machinery (apps/console has NONE — port as Task 1):**
- CSRF-aware SDK client (`src/lib/api.ts`): `configureApiClient` sets `credentials:'include'` +
  baseUrl; request interceptor injects `x-csrf-token` on mutating non-allowlisted paths
  (create-org is a mutation under `/admin/*` → **needs CSRF**), `/auth` allowlisted; response
  interceptor clears token on 403; in-flight dedupe. (No `x-org-id` — console is not org-scoped.)
- Session probe (`src/hooks/use-session.ts`): probe a `/admin/*` endpoint to detect authed +
  authorized; 401/403 → unauthed/forbidden.
- `__root` guard: render protected tree only when authed; `/sign-in` is public (no probe).
- `tsconfig.test.json` + `typecheck = tsc -b && tsc -p tsconfig.test.json` so `*.test.tsx` ARE
  typechecked (the durable false-green guard — CI `console` job runs it).
- `src/test-utils/mock-sdk.ts`: typed `ok<T>()` / `err()` envelope helpers (byte-port from apps/org).
- New CI `console` job (build → typecheck-incl-tests → test, bun 1.2.21, frozen-lockfile),
  wired into `ci-gate` `needs` + the bash hard-fail check.

## 4. Auth model

Unified Better-Auth — **no console-specific sign-in.** The operator signs in with
**email + password** via `POST /auth/sign-in/email` (allowlisted, sets httpOnly cookie),
mirroring `apps/org` Task-3 sign-in. Authorization is the **`platform_admin` table** lookup:
`/admin/*` is gated by `authMiddleware()` + `platformAdminAuthMiddleware()` (sets
`ctx.platformAdmin`, role super/support/analyst; 403 if the user has no table row).
`createOrganization` additionally requires `requireAdminTier(SUPER_ONLY)` (role `super`).

- **Guard probe:** `listOrganizations` (any platform-admin role can read). 200 → authed+authorized;
  401 → signed out (→ `/sign-in`); 403 → signed in but not a platform admin (→ "Platform operator
  access required" screen). This anchors authz to **engine enforcement** (the slice-2b lesson —
  no redundant client role gate that can drift/lock out).
- **Comma-role gotcha:** the known bug lives only in `exportDashboardReport` (exact-equality role
  check) which console does **not** call. Our 3 endpoints gate via the table middleware
  (`list/createOrganization`) or the correct comma-split `isPlatformAdmin` util (`getPlatformSummary`).
- **Bootstrap:** the founder must exist as a Better-Auth user **and** have a `platform_admin`
  row (role `super`) **and** there must be ≥1 association to attach orgs to. A dev seed script
  (`services/api-ts/scripts/seed-console.ts`, the ONLY new `services/` file, additive — like
  `seed-paylink.ts`) seeds: a super platform_admin user + one association. **2FA is NOT required**
  for platform-admin endpoints (the `requirePosition` 2FA gate is officer-only, not `/admin/*`).

## 5. Screens (one primary task each)

1. **Sign-in** — `/sign-in` (public). Email + password → `POST /auth/sign-in/email`,
   `credentials:'include'`, no CSRF (`/auth` allowlisted). On success: invalidate `['session']`,
   navigate to `/`. `role=alert` on error. Mirror `apps/org` sign-in.
2. **Orgs + stats** — `/` (index, guarded). **Stats strip** (from `getPlatformSummary` aggregated
   across associations: org count, total members, collection rate, total revenue PHP) + **org table**
   (`listOrganizations`: name, region, orgType, status, created). Primary button "Create organization".
   Empty/forbidden states handled.
3. **Create org** — `/orgs/new` (guarded). Form: **association** (required `<select>` populated from
   `listAssociations`), **name** (required), **orgType** (required `<select>`: chapter / society /
   national / clinic), **region** (optional), **contactEmail** (optional). Submit → `POST /admin/organizations`.
   On 201 → `sonner` success toast + navigate back to `/`. Surface engine errors as `role=alert`:
   403 (not super) → "Super-admin access required"; 409 → "An organization with this name already
   exists in this association"; 404 → "Association not found". If `listAssociations` is empty → notice
   that an association must be seeded first (create-association is a flagged follow-up §9).

## 6. Data shapes (anchor mocks to HANDLER source, NOT types.gen.ts)

| SDK fn | Method/path | REAL handler shape | Transformer | Drift / notes |
|---|---|---|---|---|
| `listOrganizations` | GET `/admin/organizations` | `{data: Organization[], pagination:{offset,limit,total}}` | YES (string→Date on date fields; no crash) | SDK type declares richer pagination (`count,totalPages,…`) the handler never sends → consume only `offset/limit/total`; mock the real shape with cast+comment |
| `getPlatformSummary` | GET `/admin/national/platform` | `{data: AssocRow[], meta:{cursor,hasMore,total}}` | NO | `AssocRow={associationId, associationName?, chapterCount, totalMembers, activeMembers, collectionRate(%), creditCompliance(%), totalRevenueCents(number)}`. Aggregates per-association from `chapter_snapshot` for `snapshotMonth` → **may be empty** on a fresh platform → render zeros/em-dash gracefully |
| `listAssociations` | GET `/admin/associations` | `{data: PlatformAdminModuleAssociation[], pagination}` | (verify at impl) | drives the create-org association dropdown |
| `createOrganization` | POST `/admin/organizations` | request `{associationId(req), name(req), orgType(req), region?, contactEmail?, trialDurationDays?}` → flat `Organization`, 201 | NO | super-only; `initialOfficerEmail` accepted-but-IGNORED (do not surface it); errors 404/409/400 |

**Money:** `getPlatformSummary.totalRevenueCents` is a plain `number` (centavos) → display via
`centavosToPhp` (already in `@monobase/ui`) wrapped in `Number()`. **No request-seam money**
(create-org carries no amount), so no `BigInt()` boundary this slice.

## 7. Testing

- **Unit** (vitest + RTL, mocks anchored to handler shapes via `ok()/err()`, `vi.mock` factory on
  `@monobase/sdk-ts/generated`): sign-in state machine; `use-session` guard (200/401/403 branches);
  orgs+stats hooks (empty-stats tolerance, money render no `NaN`, drift-anchored pagination); create-org
  form (validation, 201 path, 403/409/404 error surfacing, association dropdown).
- **E2E** (Playwright, pinned 1.58.2, `testDir=src/e2e`, self-contained `page.route` stubs of
  `/csrf-token` + `/admin/*` + `/auth/sign-in/email` matching **real handler shapes**): sign-in →
  orgs list renders → create-org → success toast → back to list. Controller runs it to confirm non-vacuous.
- **CI** `console` job (build → typecheck-incl-tests → test) wired into `ci-gate`. CI = ground truth.

## 8. Hard gate (definition of done)

- All workspaces typecheck **including** `apps/console` tests (`tsc -p tsconfig.test.json`).
- `apps/console` unit tests + stubbed E2E pass; `apps/console` builds (`routeTree.gen.ts` regenerated + committed).
- **Engine FROZEN:** `git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated`
  is **EMPTY** — except the single additive new file `services/api-ts/scripts/seed-console.ts`
  (no handler/spec/migration/generated change; verify the generated paths show 0 diff).
- New CI `console` job green on the PR; whole-branch opus review = Ready-to-merge.

## 9. Flagged follow-ups (NOT in this slice)

1. **Officer-seed (additive engine):** wire `initialOfficerEmail` into `createOrganization`
   (seed first officer person + officer term + `association:officer`), bypassing the president-caller
   requirement for a platform super-admin. Slice-3-style additive change; deferred.
2. **PayMongo Connect onboarding endpoint:** net-new money-rail integration; **G2-blocked**.
   Until then, per-org PayMongo = stored credentials via the org app / `getDuesGatewayConfig`.
3. **`createAssociation` in console:** trivial follow-up if the founder needs >1 association
   (beachhead = single seeded association).
4. **Richer stats:** `/admin/analytics/revenue` (MRR/ARR) + `/admin/analytics/health` exist in the
   engine but are NOT in the OpenAPI spec / SDK — expose additively later for a fuller stats strip.
5. **Engine-contract drift (additive fixes, deferred):** `listOrganizations` pagination
   (handler sends `{offset,limit,total}`, type declares more); the `exportDashboardReport`
   comma-role exact-equality bug (pre-existing, not touched here).
6. **Live click-through:** real platform-admin seed + create-org against a running stack — deferred
   like prior slices (no live API/seed in CI). Create-org itself is **not** G2-gated (no money path).

## 10. Carry-forward gotchas (bake into every task brief)

- Anchor mocks to the REAL handler shape (read handler source), not `types.gen.ts`. Drift endpoints
  get a cast + comment; trustworthy ones bind to the generated `XResponse` so a wrong field fails compile.
- SDK client import `@monobase/sdk-ts/generated/client.gen`; fns from `@monobase/sdk-ts/generated`
  (no root export). SDK does NOT throw on non-2xx → read `response.status` / `error` field.
- `vi.mock('@monobase/sdk-ts/generated', () => ({...}))` factory (NOT `vi.spyOn` on generated ESM).
- `routeTree.gen.ts` regenerate (build) + **COMMIT** before typecheck.
- Port 3006. Playwright pin 1.58.2, `testDir=src/e2e`, portable bin `../../node_modules/.bin/playwright`.
  vitest `include:['src/**/*.test.ts','src/**/*.test.tsx']` (exclude `.spec` E2E).
- No `/api` prefix in calls (Vite proxy strips). `sonner` toasts. a11y: ≥18px base / ≥48px tap targets /
  `role=alert` on errors / labeled inputs (no icon-only) / one primary task per screen.
- Engine FROZEN gate per §8.
