# Plan 010: Add an app-level README and ARCHITECTURE doc for apps/memberry

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat e4bb901a..HEAD -- apps/memberry`
> If the route/feature structure changed materially since this plan was written,
> re-derive the structure from the live tree before documenting it.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `e4bb901a`, 2026-06-19

## Why this matters

`apps/memberry/` is the product app (466 TS/TSX files, 24 features, ~70 routes)
yet has **no `README.md` and no `ARCHITECTURE.md`**. The only doc at the app
root is `TDD_PROOF.md`, which is a one-time historical audit log, not an
onboarding guide. A developer (or executor model) opening `apps/memberry` has no
documented answer to: how do I run it, how do I test it, where do features live,
how does routing/auth gating work. The root `CLAUDE.md` and `CONTRIBUTING.md`
describe the monorepo and backend in depth but say little app-specific. This is
a pure-docs, zero-runtime-risk improvement that lowers onboarding cost.

## Current state

- `apps/memberry/` root contains `TDD_PROOF.md` only — confirm with
  `ls apps/memberry/*.md`.
- `apps/memberry/.env.example` exists (small — lists the API URL var). Read it
  to see exactly which env vars it documents; do not assume.
- Verified facts to document (re-confirm each before writing — do not trust this
  list blindly if the drift check flagged changes):
  - **Stack**: React 19, Vite 7, TanStack Router (file-based, `src/routes/`),
    TanStack Query, Better-Auth (`@daveyplate/better-auth-tanstack`,
    `better-auth`), react-hook-form + zod, `sonner` for toasts, UI from
    `@monobase/ui` (shadcn/radix), data via `@monobase/sdk-ts` generated hooks.
  - **Dev server**: port 3004 (`apps/memberry/vite.config.ts` line ~24); Vite
    proxies `/api` → `http://localhost:7213` and strips the `/api` prefix
    (vite.config.ts lines ~10–20). WebSocket upgrades are proxied too (`ws: true`).
  - **Scripts** (from `apps/memberry/package.json`): `dev` (vite), `build`,
    `preview`, `typecheck` (`tsc --noEmit`), `lint` (`eslint src`), `test`
    (`bun scripts/test-isolated.ts`), `test:e2e` (playwright). Copy the exact
    script names from package.json — do not paraphrase.
  - **Feature layout**: `src/features/<name>/{components,hooks,lib}` — list the
    feature directories by running `ls src/features`.
  - **Routing**: file-based under `src/routes/`. `_authenticated.tsx` is the auth
    guard layout (its `beforeLoad` enforces auth); `/org/$orgSlug/*` routes are
    org-scoped and wrapped by `OrgProvider` (`src/providers/OrgProvider.tsx`);
    `/org/$orgSlug/officer/*` are officer-gated. Auth route is `/auth/$authView`
    (sign-in path is `/auth/sign-in`, NOT `/login`). Public routes:
    `join/$slug`, `invite/$token`, `pay/$token`, `verify/$id`, `discover/events`.
  - **Guards**: `src/utils/guards.ts` exports composable guards
    (`requireAuth`, `requirePerson`, `requireEmailVerified`, `requireNoPerson`,
    `composeGuards`). Read it to document the real exported names.
  - **Testing**: unit via `bun run test` (isolated runner that auto-isolates
    files which `vi.mock` local siblings); test utils in `src/test/`
    (`renderWithProviders` in `src/test/utils`, shim in `src/test/vitest-shim`,
    setup in `src/test/setup.ts`). E2E via Playwright (`@playwright/test`
    pinned to 1.58.2 — 1.59 breaks `test.describe`, do not bump). Coverage
    config in `vitest.config.ts`.

### Style to match

Look at the repo's existing top-level `README.md` and `CONTRIBUTING.md` for tone
and Markdown conventions (heading levels, code-fence usage, command tables).
Match them. Keep the new docs concise and factual — no marketing copy.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| List app docs | `ls apps/memberry/*.md` | shows the files you create |
| List features | `ls apps/memberry/src/features` | feature dir list |
| Read env example | `cat apps/memberry/.env.example` | env var names |
| Confirm scripts | `cat apps/memberry/package.json` | scripts block |

(No build/test needed — this plan adds Markdown only.)

## Scope

**In scope** (create these files only):
- `apps/memberry/README.md` (create)
- `apps/memberry/ARCHITECTURE.md` (create)

**Out of scope** (do NOT modify):
- `apps/memberry/TDD_PROOF.md` — leave it; optionally add ONE line to README
  noting it is a historical audit log. Do not rename or delete it.
- Any source file, config, or `.env.example` — docs only. If `.env.example` is
  missing a variable the app needs, NOTE it in the README's environment section
  as "verify against deployment" rather than editing `.env.example`.
- The root monorepo `README.md` / `CLAUDE.md` / `CONTRIBUTING.md` — do not edit;
  link to them from the new app README instead.

## Git workflow

- Branch: `advisor/010-app-docs`.
- One commit. Conventional commits style, e.g.
  `docs(memberry): add app README and ARCHITECTURE`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Re-derive the facts from the live repo

Run the four "Commands you will need". Read `vite.config.ts`,
`src/utils/guards.ts`, and `src/providers/OrgProvider.tsx` to confirm the
routing/guard facts above. Correct anything in "Current state" that has drifted.

**Verify**: you have the exact script names, port, proxy target, feature list,
and guard export names in hand.

### Step 2: Write `apps/memberry/README.md`

Sections, in order:
1. **Overview** — one paragraph: memberry is the product app (membership, dues,
   events, training, auth, profile, settings) for the Monobase-based healthcare
   AMS. Link to the root `README.md` and `CLAUDE.md` for the monorepo picture.
2. **Prerequisites** — Bun; the API running on port 7213 (link to
   `services/api-ts`); reference `.env.example`.
3. **Getting started** — `bun install` (from repo root), then
   `cd apps/memberry && bun dev` (note port 3004 and the `/api` proxy to 7213).
4. **Available scripts** — a table of every script in `package.json` with a
   one-line description each (dev, build, preview, typecheck, lint, test,
   test:e2e and variants). Use the exact names.
5. **Environment** — document the vars in `.env.example`; note that the dev
   server proxies `/api` so no API base URL rewrite is needed locally.
6. **Testing** — how to run unit tests (`bun run test`) and E2E
   (`bun run test:e2e`); note Playwright is pinned to 1.58.2 and why; point to
   `ARCHITECTURE.md` for test conventions and to plan-style exemplar tests
   (`src/features/dues/components/arrears-breakdown.test.tsx`).
7. **Project layout** — short pointer to `ARCHITECTURE.md`.
8. One line: "`TDD_PROOF.md` is a historical test-hardening audit log, kept for
   reference."

### Step 3: Write `apps/memberry/ARCHITECTURE.md`

Sections, in order:
1. **Tech stack** — bullet list (React 19, Vite, TanStack Router/Query,
   Better-Auth, react-hook-form+zod, sonner, `@monobase/ui`, `@monobase/sdk-ts`).
2. **Directory layout** — `src/routes` (file-based), `src/features/<name>/
   {components,hooks,lib}`, `src/providers`, `src/components` (`patterns`,
   `motion`, `layout`), `src/lib`, `src/hooks`, `src/utils`, `src/test`. Generate
   the feature list from `ls src/features`.
3. **Routing & auth** — explain `_authenticated.tsx` guard layout, the
   composable guards in `src/utils/guards.ts` (list the exported names),
   `/org/$orgSlug/*` org scoping via `OrgProvider`, officer gating under
   `officer/*`, and the public routes (`join/$slug`, `invite/$token`,
   `pay/$token`, `verify/$id`, `discover/events`). Note the auth path is
   `/auth/sign-in`, not `/login`.
4. **Data fetching** — generated hooks from `@monobase/sdk-ts` (`useGet*`,
   `useList*`, `useCreate*`), the `@/lib/api` thin client for hand-rolled calls,
   and that `OrgProvider` centralizes org+officer-role resolution so child
   routes don't refetch it.
5. **Testing conventions** — unit tests colocated as `*.test.tsx`; import test
   helpers from `@/test/vitest-shim` and `renderWithProviders` from
   `@/test/utils`; the isolated runner auto-isolates files that `vi.mock` local
   siblings; E2E in the Playwright suite. Point at the two exemplar tests
   (`arrears-breakdown.test.tsx`, `record-payment-form.test.tsx`).

### Step 4: Sanity check links and facts

Re-read both files. Every command, port, path, and script name must match the
repo. Internal links (to root docs, to `services/api-ts`) must resolve.

**Verify**: `ls apps/memberry/README.md apps/memberry/ARCHITECTURE.md` → both
exist; manually confirm no invented script names (cross-check against
`package.json`).

## Test plan

No automated tests (docs only). Manual verification:
- Every script named in README exists in `apps/memberry/package.json`.
- The dev port (3004) and proxy target (7213) match `vite.config.ts`.
- The guard names match `src/utils/guards.ts` exports.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `apps/memberry/README.md` and `apps/memberry/ARCHITECTURE.md` exist.
- [ ] Every script name in README appears in `apps/memberry/package.json`
      (spot-check each against the file).
- [ ] `git status` shows only the two new docs added — no source/config edits.
- [ ] `grep -c 3004 apps/memberry/README.md` returns ≥1 and the port matches
      `vite.config.ts`.
- [ ] `plans/README.md` status row for 010 updated.

## STOP conditions

Stop and report back if:

- The drift check shows the route/feature structure changed substantially since
  `e4bb901a` and you cannot confidently re-derive it.
- `.env.example` references a credential/secret value inline (it should only
  name variables) — report it as a security finding; do NOT copy the value into
  any doc.

## Maintenance notes

- When features are added/removed under `src/features/`, update the layout
  section in `ARCHITECTURE.md`.
- A reviewer should verify the scripts table and ports against
  `package.json`/`vite.config.ts` — those are the parts most likely to rot.
- Deliberately not documented here (out of scope): per-feature deep dives and a
  full route map — keep ARCHITECTURE.md a high-level orientation, not a mirror of
  the code.
