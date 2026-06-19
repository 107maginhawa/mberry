# Plan 014: Add an app-level README and ARCHITECTURE doc for apps/admin

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat e4bb901a..HEAD -- apps/admin`
> If the route/role structure changed materially since this plan was written,
> re-derive it from the live tree before documenting.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `e4bb901a`, 2026-06-19

## Why this matters

`apps/admin/` is the platform-ops dashboard (62 TS/TSX source files, ~23 routes,
a role-based access matrix, and an impersonation tool) yet has **no `README.md`
and no `ARCHITECTURE.md`** — `ls apps/admin/*.md` returns nothing. A developer
or executor opening this app has no documented answer to: how do I run it, how
do I test it, how does the role gate work, why is there no login screen. The
role/auth model in particular (no auth UI; redirects to the memberry app;
three-tier role gate driven by `ROUTE_ROLES`) is non-obvious and easy to get
wrong. This is a pure-docs, zero-runtime-risk improvement. It mirrors plan 010
(which documents `apps/memberry`); keep the two consistent in tone and shape.

## Current state

Re-confirm each fact below from the live repo before writing (do not trust this
list blindly if the drift check flagged changes):

- **No app docs**: `ls apps/admin/*.md` → none. Create the two new files.
- **Stack** (from `apps/admin/package.json`): React + Vite, TanStack Router
  (file-based, `src/routes/`), TanStack Query, UI from `@monobase/ui`
  (shadcn/radix), data via `@monobase/sdk-ts` generated react-query hooks,
  `sonner` for toasts, `lucide-react` icons. Read `package.json` for exact
  versions — do not invent them.
- **Dev server**: port **3003** (`apps/admin/vite.config.ts:8`). Vite proxies
  `/api` → `http://localhost:7213` and strips the `/api` prefix
  (`vite.config.ts:9-13`, `rewrite: (path) => path.replace(/^\/api/, '')`).
- **Scripts** (from `apps/admin/package.json`): `dev` (vite), `build`,
  `preview`, `typecheck` (`tsc --noEmit`), `test` (`cd ../.. && bun test
  apps/admin/src`), `test:watch`, `test:e2e` (`bunx playwright test`), `lint`
  (`eslint src`). Copy the exact names; do not paraphrase.
- **Environment** (`apps/admin/.env.example`): the only var is
  `VITE_MEMBERRY_URL=http://localhost:3004` — the memberry app URL the admin
  redirects to for login. Document it; do NOT copy any secret values (there are
  none here, but confirm).
- **Auth model** (the load-bearing, non-obvious part — read
  `apps/admin/src/main.tsx`, `src/router.ts`, `src/routes/__root.tsx`,
  `src/lib/role-gate.tsx`):
  - There is **no in-app login UI**. `__root.tsx` `beforeLoad` redirects
    unauthenticated users to `${VITE_MEMBERRY_URL}/auth/sign-in?redirect=admin`
    (fallback `http://localhost:3004/...`).
  - The admin user is fetched at startup in `main.tsx` (admin role lookup) and
    provided via `AdminUserContext` (`src/lib/role-gate.tsx`).
    `AdminUser.role` is one of `'super' | 'support' | 'analyst'`
    (`src/router.ts:1-5`).
  - **Role gate**: `RequireRole({ allowed, children })` in
    `src/lib/role-gate.tsx` renders children only if `user.role` is in
    `allowed`, else shows an "Access Denied" panel (fails closed). Each
    role-restricted route wraps its component in `<RequireRole allowed={[...]}>`.
  - **`ROUTE_ROLES`** (same file) is the access matrix the sidebar uses to
    filter which nav items are visible per role. The FIX-007 comment notes the
    nav filter must stay in sync with each route's `RequireRole`. Document this
    coupling — it is the #1 thing a contributor gets wrong.
- **Route layout**: `src/routes/` file-based; route groups include
  `associations`, `organizations`, `operators`, `members`, `verifications`,
  `compliance`, `events`, `training`, `committees`, `national-dashboard`,
  `communications/{index,moderation,templates,email}`, `surveys`, `audit`,
  `feature-flags`, `impersonate`. Generate the live list with
  `ls -d apps/admin/src/routes/*/` and the top-level files with
  `ls apps/admin/src/routes/*.tsx`.
- **Mobile**: `__root.tsx` shows a "Desktop Required" gate below 1024px — note it.
- **Testing**: unit tests are `bun:test` under `src/test/routes/*.test.tsx`;
  harness in `src/test/utils.tsx` (`renderWithProviders`, `MOCK_SUPER_ADMIN` /
  `MOCK_SUPPORT_ADMIN` / `MOCK_ANALYST_ADMIN`); the generated react-query module
  is auto-mocked via `test-setup-root.ts` (repo root, wired through
  `apps/admin/bunfig.toml` `preload`). E2E specs live in `apps/admin/tests/e2e/`.
  The deep test exemplar is `src/test/routes/impersonate.test.tsx`.

### Style to match

Match plan 010's output (`apps/memberry/README.md` / `ARCHITECTURE.md`) and the
repo's top-level `README.md` / `CONTRIBUTING.md` for tone and Markdown
conventions (heading levels, command tables). Concise and factual; no marketing.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| List app docs | `ls apps/admin/*.md` | shows the files you create |
| List route groups | `ls -d apps/admin/src/routes/*/` | route dir list |
| Read env example | `cat apps/admin/.env.example` | env var names |
| Confirm scripts/port | `cat apps/admin/package.json && grep -n port apps/admin/vite.config.ts` | scripts block + `port: 3003` |

(No build/test needed — Markdown only.)

## Scope

**In scope** (create these files only):
- `apps/admin/README.md` (create)
- `apps/admin/ARCHITECTURE.md` (create)

**Out of scope** (do NOT modify):
- Any source file, config, or `.env.example` — docs only. If `.env.example` is
  missing a var the app needs, NOTE it in the README as "verify against
  deployment" rather than editing it.
- The root monorepo `README.md` / `CLAUDE.md` / `CONTRIBUTING.md` — link to
  them, do not edit.
- `apps/memberry/*.md` — leave plan 010's output alone.

## Git workflow

- Branch: `advisor/014-admin-app-docs`.
- One commit, conventional style, e.g.
  `docs(admin): add app README and ARCHITECTURE`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Re-derive the facts from the live repo

Run the four "Commands you will need". Read `main.tsx`, `src/router.ts`,
`src/routes/__root.tsx`, and `src/lib/role-gate.tsx` to confirm the auth/role
facts. Correct anything in "Current state" that has drifted.

**Verify**: you have the exact script names, port (3003), proxy target (7213),
route-group list, the three role names, and the `ROUTE_ROLES`/`RequireRole`
coupling clear in hand.

### Step 2: Write `apps/admin/README.md`

Sections, in order:
1. **Overview** — one paragraph: admin is the platform-ops dashboard for the
   Monobase-based healthcare AMS (manage associations, organizations, operators,
   members, verifications, compliance, communications, audit, feature flags,
   impersonation). Link to root `README.md` and `CLAUDE.md`.
2. **Prerequisites** — Bun; the API running on port 7213
   (link to `services/api-ts`); the memberry app running for login redirect
   (link to `apps/memberry`); reference `.env.example`.
3. **Getting started** — `bun install` (repo root), then
   `cd apps/admin && bun dev` (note port **3003** and the `/api` proxy to 7213).
   Call out: **there is no login screen** — unauthenticated users are redirected
   to the memberry sign-in (`VITE_MEMBERRY_URL`).
4. **Available scripts** — a table of every script in `package.json` with a
   one-line description each. Exact names.
5. **Environment** — document `VITE_MEMBERRY_URL`; note the `/api` proxy means
   no API base-URL rewrite is needed locally.
6. **Roles & access** — the three roles (`super`, `support`, `analyst`); that
   routes are gated by `RequireRole` and the sidebar filters by `ROUTE_ROLES`;
   point at `ARCHITECTURE.md` for detail.
7. **Testing** — `bun run test` (unit) and `bun run test:e2e` (Playwright);
   point at `ARCHITECTURE.md` for the harness and at the exemplar
   `src/test/routes/impersonate.test.tsx`.
8. **Project layout** — short pointer to `ARCHITECTURE.md`.

### Step 3: Write `apps/admin/ARCHITECTURE.md`

Sections, in order:
1. **Tech stack** — bullet list (React, Vite, TanStack Router/Query,
   `@monobase/ui`, `@monobase/sdk-ts`, sonner, lucide).
2. **Directory layout** — `src/routes` (file-based; generate the group list
   from `ls -d src/routes/*/`), `src/components` (`patterns`), `src/lib`
   (`role-gate.tsx`, `utils.ts`), `src/test`, `src/styles`.
3. **Auth & roles** — the no-login-UI model: `__root.tsx` `beforeLoad`
   redirects to `${VITE_MEMBERRY_URL}/auth/sign-in?redirect=admin`; the admin
   user is fetched at startup in `main.tsx` and exposed via `AdminUserContext`;
   `useAdminUser()` reads it. `RequireRole` fails closed. **`ROUTE_ROLES` must
   stay in sync with each route's `RequireRole`** — explain this coupling and
   cite the FIX-007 comment. List the three roles and what each can see (derive
   from the `ROUTE_ROLES` matrix in `role-gate.tsx` — quote it).
4. **Data fetching** — generated react-query hooks from
   `@monobase/sdk-ts/generated/react-query`; the `/api` Vite proxy to the
   backend on 7213.
5. **Testing conventions** — `bun:test`; tests under `src/test/routes/`; harness
   `renderWithProviders` + `MOCK_*_ADMIN` from `src/test/utils.tsx`; the
   generated react-query module is auto-mocked by `test-setup-root.ts` and
   primed per-test via `.mockImplementation`; the deep exemplar is
   `src/test/routes/impersonate.test.tsx`. Note the desktop-only gate (≥1024px).

### Step 4: Sanity check links and facts

Re-read both files. Every command, port (3003), proxy target (7213), path,
script name, and role name must match the repo. Internal links must resolve.

**Verify**: `ls apps/admin/README.md apps/admin/ARCHITECTURE.md` → both exist;
cross-check every script name against `package.json`.

## Test plan

No automated tests (docs only). Manual verification:
- Every script named in README exists in `apps/admin/package.json`.
- The dev port (3003) and proxy target (7213) match `vite.config.ts`.
- The role names match `AdminUser['role']` in `src/router.ts`.
- The `ROUTE_ROLES` summary matches `src/lib/role-gate.tsx`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `apps/admin/README.md` and `apps/admin/ARCHITECTURE.md` exist.
- [ ] Every script name in README appears in `apps/admin/package.json`.
- [ ] `grep -c 3003 apps/admin/README.md` returns ≥1 and the port matches
      `vite.config.ts`.
- [ ] `git status` shows only the two new docs added — no source/config edits.
- [ ] `plans/README.md` status row for 014 updated.

## STOP conditions

Stop and report back if:

- The drift check shows the route/role structure changed substantially since
  `e4bb901a` and you cannot confidently re-derive it.
- `.env.example` references a credential/secret value inline (it should only
  name variables) — report it as a security finding; do NOT copy the value.

## Maintenance notes

- When an admin route is added/removed, update the layout section here and the
  `ROUTE_ROLES` summary; the matrix is the doc most likely to rot.
- A reviewer should verify the scripts table, ports, and role matrix against the
  live `package.json` / `vite.config.ts` / `role-gate.tsx`.
- Deliberately not documented (out of scope): per-route deep dives — keep
  ARCHITECTURE.md a high-level orientation, not a mirror of the code.
