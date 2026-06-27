# Wave A — apps/console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a thin founder/platform-operator PWA (`@monobase/console`, port 3006) that lists organizations + basic platform stats and creates a new organization (org row only), over the byte-FROZEN engine.

**Architecture:** New Vite+React+TanStack-Router workspace mirroring `apps/org`'s authed spine (CSRF-aware SDK client, Better-Auth cookie session, `__root` guard) and anti-false-green machinery (`tsconfig.test.json` typechecks tests, `ok()/err()` typed mocks anchored to handler shapes). Three screens: sign-in, orgs+stats, create-org. A new CI `console` job gates it.

**Tech Stack:** Vite 7, React 19, `@tanstack/react-router` 1.131 + plugin 1.132, `@tanstack/react-query` 5, `@monobase/sdk-ts`, `@monobase/ui` (Friendly-Clarity tokens), vitest 4 + RTL + jsdom, Playwright 1.58.2, sonner.

## Global Constraints

- **Engine FROZEN:** `git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated` MUST be EMPTY, EXCEPT the single additive new file `services/api-ts/scripts/seed-console.ts` (Task 6). No handler/spec/migration/generated-SDK change.
- **Port 3006** (member=3004, org=3005). No `/api` prefix in calls (Vite proxy strips it).
- **Anchor mocks to the REAL handler shape**, NOT `types.gen.ts`. Trustworthy endpoints bind to the generated `XResponse` (wrong field → compile error); DRIFT endpoints mock the handler shape with `as any` + a one-line comment. Never bind a mock to a lying type.
- SDK client import: `@monobase/sdk-ts/generated/client.gen`; fns from `@monobase/sdk-ts/generated` (no root export). SDK does NOT throw on non-2xx → read `response.status` / `error`.
- Test mocking: `vi.mock('@monobase/sdk-ts/generated', () => ({ fn: vi.fn() }))` factory (NOT `vi.spyOn` on generated ESM).
- `routeTree.gen.ts`: regenerate (via `bun run --filter @monobase/console build`) + **COMMIT** before typecheck.
- Money: `getPlatformSummary.totalRevenueCents` is a plain `number` (centavos) → display via `centavosToPhp` from `@monobase/ui`, wrapped in `Number()`. No request-seam money this slice.
- a11y: ≥18px base / ≥48px tap targets (`min-h-tap`) / `role=alert` on errors / labeled inputs (no icon-only) / one primary task per screen. All UI on `@monobase/ui` tokens (no per-app forks).
- `typecheck` = `tsc --noEmit && tsc -p tsconfig.test.json --noEmit` (tests ARE typechecked). vitest `include:['src/**/*.test.ts','src/**/*.test.tsx']` (excludes `.spec` E2E). Playwright `testDir=src/e2e`, portable bin `./node_modules/.bin/playwright`.
- Branch `feat/wave-a-console` (already created, spec committed). Commit after every task.

---

### Task 1: Scaffold @monobase/console + anti-false-green machinery + CI job

**Files (create, porting from `apps/org` unless noted — read the org file, change port 3005→3006 and titles):**
- Create: `apps/console/package.json` (name `@monobase/console`, `dev: "vite --port 3006"`, identical deps/scripts to `apps/org/package.json` incl `typecheck: "tsc --noEmit && tsc -p tsconfig.test.json --noEmit"`).
- Create: `apps/console/vite.config.ts` (byte-port of `apps/org/vite.config.ts`; **port 3005→3006** in both `server` and `preview`).
- Create: `apps/console/vitest.config.ts` (byte-port).
- Create: `apps/console/tailwind.config.ts`, `apps/console/postcss.config.ts` (byte-port: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`).
- Create: `apps/console/tsconfig.json`, `apps/console/tsconfig.test.json` (byte-port).
- Create: `apps/console/index.html` (port; `<title>Memberry — Console</title>`, description "Memberry platform operator console.").
- Create: `apps/console/playwright.config.ts` (byte-port; **baseURL → `http://localhost:3006`**).
- Create: `apps/console/src/styles.css`, `src/vite-env.d.ts`, `src/test-setup.ts` (byte-ports).
- Create: `apps/console/src/test-utils/mock-sdk.ts` (BYTE-IDENTICAL port of `apps/org/src/test-utils/mock-sdk.ts` — `ok()`/`err()`).
- Create: `apps/console/src/main.tsx` (port; `<Toaster richColors position="top-center" />`, `configureApiClient(API_BASE)`).
- Create: `apps/console/src/lib/__sanity.test.ts` (smoke test so `vitest run` is green from day 1).
- Modify: `.github/workflows/ci.yml` — add a `console` job + wire into `ci-gate`.

**Interfaces:**
- Produces: the workspace `@monobase/console` building on port 3006; `ok<T>()`/`err()` from `@/test-utils/mock-sdk`; `API_BASE`/`configureApiClient` consumed from `@/lib/api` (created Task 2 — `main.tsx` imports them, so Task 1's `main.tsx` will not typecheck/build until Task 2 lands the file; create a minimal stub `src/lib/api.ts` in Task 1, see Step 3).

- [ ] **Step 1: Copy the config + static files from apps/org**

Read each `apps/org` file listed above and create the `apps/console` equivalent. Change ONLY: package `name` → `@monobase/console`; every `3005` → `3006`; `index.html` title/description. Byte-port `mock-sdk.ts`, `tsconfig.json`, `tsconfig.test.json`, `vitest.config.ts`, `tailwind.config.ts`, `postcss.config.ts`, `styles.css`, `vite-env.d.ts`, `test-setup.ts`.

- [ ] **Step 2: Write the sanity smoke test (RED→GREEN trivially)**

```ts
// apps/console/src/lib/__sanity.test.ts
import { describe, it, expect } from 'vitest'
import { ok, err } from '../test-utils/mock-sdk'

describe('console scaffold', () => {
  it('mock-sdk ok() builds a hey-api success envelope', () => {
    const env = ok({ hello: 'world' })
    expect(env.data).toEqual({ hello: 'world' })
    expect(env.error).toBeUndefined()
    expect(env.response.status).toBe(200)
  })
  it('mock-sdk err() builds a failure envelope', () => {
    const env = err(403, { error: 'nope' })
    expect(env.data).toBeUndefined()
    expect(env.response.status).toBe(403)
  })
})
```

- [ ] **Step 3: Minimal `src/lib/api.ts` stub so main.tsx builds (Task 2 replaces it)**

```ts
// apps/console/src/lib/api.ts — STUB, fully implemented in Task 2.
export const API_BASE = import.meta.env.VITE_API_URL ?? `${window.location.origin}/api`
export function configureApiClient(_baseUrl = API_BASE): void {}
```

Also create a minimal `src/routes/__root.tsx` + `src/routes/index.tsx` so the router/build has a route tree:

```tsx
// apps/console/src/routes/__root.tsx — minimal, replaced in Task 2.
import { createRootRoute, Outlet } from '@tanstack/react-router'
export const Route = createRootRoute({ component: () => <Outlet /> })
```
```tsx
// apps/console/src/routes/index.tsx — placeholder, replaced in Task 4.
import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/')({ component: () => <div>Console</div> })
```

- [ ] **Step 4: Add the CI `console` job + wire ci-gate**

In `.github/workflows/ci.yml`, after the `org:` job block, add (mirror `org` exactly):

```yaml
  console:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.2.21
      - run: bun install --frozen-lockfile
      - name: Build (tsc-b + vite; generates routeTree.gen.ts via TanStack plugin)
        run: bun run --filter @monobase/console build
      - name: Typecheck (source + tests via tsconfig.test.json — durable false-green guard)
        run: bun run --filter @monobase/console typecheck
      - name: Unit tests
        run: bun run --filter @monobase/console test
      # NOTE (lean launch): e2e-console job deferred — stubbed spec needs a preview server in CI.
```

Then in the `ci-gate` job: add `- console` to `needs:`, add `echo "  console: ${{ needs.console.result }}"`, and add `[[ "${{ needs.console.result }}" != "success" ]] || \` to the failure `if` (matching the `member`/`org` lines).

- [ ] **Step 5: Generate routeTree + verify build/typecheck/test/frozen**

```bash
bun install
bun run --filter @monobase/console build      # generates src/routeTree.gen.ts
bun run --filter @monobase/console typecheck
bun run --filter @monobase/console test        # sanity test green
git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated   # MUST be empty
```
Expected: build PASS, typecheck 0 errors, 2 tests PASS, frozen diff empty.

- [ ] **Step 6: Commit** (include `bun.lock` — CI uses `--frozen-lockfile`; committing only `apps/console` breaks CI)

```bash
git add apps/console .github/workflows/ci.yml bun.lock
git commit -m "feat(console): scaffold @monobase/console + anti-false-green machinery + CI job"
```

---

### Task 2: CSRF-aware SDK client + session probe + root guard

**Files:**
- Modify (replace Task-1 stub): `apps/console/src/lib/api.ts`
- Test: `apps/console/src/lib/api.test.ts`
- Create: `apps/console/src/features/auth/use-session.ts`
- Test: `apps/console/src/features/auth/use-session.test.tsx`
- Modify (replace Task-1 stub): `apps/console/src/routes/__root.tsx`
- Test: `apps/console/src/routes/__root.test.tsx`

**Interfaces:**
- Produces: `configureApiClient(baseUrl?)`, `API_BASE`, `resetCsrfCacheForTest()` from `@/lib/api`; `useSession(): { status: 'loading'|'authed'|'unauthed'|'forbidden' }` from `@/features/auth/use-session`.
- Consumes: SDK `listOrganizations` from `@monobase/sdk-ts/generated`.

**Key console deltas from apps/org:** (1) `api.ts` has **NO `x-org-id`** injection (console is not org-scoped) — keep the CSRF logic identical. (2) `use-session` probes **`listOrganizations`** (a `/admin/*` endpoint) and adds a **`forbidden`** state (200→authed, 401→unauthed, 403→forbidden = signed in but not a platform admin). (3) `__root` renders an access-required screen on `forbidden`.

- [ ] **Step 1: Write the failing api.test.ts** (port `apps/org/src/lib/api.test.ts`, but change the protected-path example to `/admin/organizations` and assert NO `x-org-id` header is ever set)

```ts
// apps/console/src/lib/api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { client } from '@monobase/sdk-ts/generated/client.gen'
import { configureApiClient, resetCsrfCacheForTest } from './api'

describe('configureApiClient CSRF interceptor', () => {
  let interceptor: (req: Request) => Promise<Request> | Request
  const fetchMock = vi.fn()
  beforeEach(() => {
    resetCsrfCacheForTest()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: 'csrf-abc' }), { status: 200 }))
    const spy = vi.spyOn(client.interceptors.request, 'use')
    configureApiClient('http://localhost/api')
    interceptor = spy.mock.calls.at(-1)![0] as typeof interceptor
    spy.mockRestore()
  })
  afterEach(() => {
    client.interceptors.request.clear(); client.interceptors.response.clear(); vi.unstubAllGlobals()
  })
  it('injects x-csrf-token on POST /admin/organizations (create-org is a protected mutation)', async () => {
    const out = await interceptor(new Request('http://localhost/api/admin/organizations', { method: 'POST' }))
    expect(out.headers.get('x-csrf-token')).toBe('csrf-abc')
  })
  it('does NOT inject x-csrf-token on GET (safe method)', async () => {
    const out = await interceptor(new Request('http://localhost/api/admin/organizations', { method: 'GET' }))
    expect(out.headers.get('x-csrf-token')).toBeNull()
  })
  it('does NOT inject x-csrf-token on /auth (allowlisted)', async () => {
    const out = await interceptor(new Request('http://localhost/api/auth/sign-in/email', { method: 'POST' }))
    expect(out.headers.get('x-csrf-token')).toBeNull()
  })
  it('never sets x-org-id (console is not org-scoped)', async () => {
    const out = await interceptor(new Request('http://localhost/api/admin/organizations', { method: 'GET' }))
    expect(out.headers.get('x-org-id')).toBeNull()
  })
})
```

- [ ] **Step 2: Run → FAIL** (`bun run --filter @monobase/console test src/lib/api.test.ts`). Expected: FAIL (stub api.ts has no interceptor).

- [ ] **Step 3: Implement api.ts** (port `apps/org/src/lib/api.ts` verbatim EXCEPT delete the `x-org-id` block inside the request interceptor — the lines reading `localStorage.getItem('org.selectedOrgId')` and setting `x-org-id`. Keep `CSRF_EXEMPT_PREFIXES`, `needsCsrf`, `getCsrfToken`, `API_BASE`, the 403-clear response interceptor, `resetCsrfCacheForTest`.)

The request interceptor body becomes just:
```ts
client.interceptors.request.use(async (request: Request) => {
  const { pathname } = new URL(request.url)
  if (needsCsrf(request.method, pathname)) {
    request.headers.set('x-csrf-token', await getCsrfToken(baseUrl))
  }
  return request
})
```
(Drop `isExemptPath` if it becomes unused, or keep it — your call; no dead code.)

- [ ] **Step 4: Run → PASS** (api.test.ts green).

- [ ] **Step 5: Write failing use-session.test.tsx**

```tsx
// apps/console/src/features/auth/use-session.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ listOrganizations: vi.fn() }))
import { listOrganizations } from '@monobase/sdk-ts/generated'
import type { ListOrganizationsResponse } from '@monobase/sdk-ts/generated'
import { useSession } from './use-session'
import { ok, err } from '../../test-utils/mock-sdk'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSession', () => {
  it('authed on 200', async () => {
    // DRIFT: handler returns pagination {offset,limit,total} only; SDK type wants more → cast.
    vi.mocked(listOrganizations).mockResolvedValue(ok({ data: [], pagination: { offset: 0, limit: 20, total: 0 } } as any))
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('authed'))
  })
  it('unauthed on 401', async () => {
    vi.mocked(listOrganizations).mockResolvedValue(err(401))
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('unauthed'))
  })
  it('forbidden on 403 (signed in, not a platform admin)', async () => {
    vi.mocked(listOrganizations).mockResolvedValue(err(403))
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('forbidden'))
  })
})
```

- [ ] **Step 6: Run → FAIL**. Then implement use-session.ts:

```ts
// apps/console/src/features/auth/use-session.ts
import { useQuery } from '@tanstack/react-query'
import { listOrganizations } from '@monobase/sdk-ts/generated'

export type SessionStatus = 'loading' | 'authed' | 'unauthed' | 'forbidden'

// listOrganizations (a /admin/* endpoint) doubles as the auth+authz probe:
// 200 = authed platform admin, 401 = signed out, 403 = signed in but not a
// platform admin (no platform_admin table row).
export function useSession(): { status: SessionStatus } {
  const q = useQuery({
    queryKey: ['session'],
    retry: false,
    queryFn: async () => {
      const { response } = await listOrganizations({ query: { limit: 1 } })
      if (!response) throw new Error('session probe failed')
      if (response.status === 401) return { state: 'unauthed' as const }
      if (response.status === 403) return { state: 'forbidden' as const }
      if (response.status >= 200 && response.status < 300) return { state: 'authed' as const }
      throw new Error(`session probe failed: ${response.status}`)
    },
  })
  if (q.isLoading) return { status: 'loading' }
  if (q.data?.state) return { status: q.data.state }
  return { status: 'unauthed' }
}
```

- [ ] **Step 7: Run → PASS**.

- [ ] **Step 8: Write failing __root.test.tsx (PIN it — this is the app's ONLY authz boundary; a vacuous test ships a silent regression).** Mock `useSession` (`vi.mock('@/features/auth/use-session')`) and `@tanstack/react-router`'s `useNavigate` + `useRouterState`. Render `<RootGate/>` and assert THREE branches non-vacuously:
  1. `status:'unauthed'`, pathname `/` → `navigate` called with `{to:'/sign-in'}` AND the protected Outlet content is NOT rendered.
  2. `status:'forbidden'` → "Platform operator access required" heading IS rendered AND `navigate` is NOT called.
  3. `status:'authed'` → Outlet IS rendered (mock `Outlet` to a sentinel `<div>authed-tree</div>` and assert it shows).
  Do NOT extract a "pure helper" — test the real `RootGate` directly with mocked hooks. Implement `__root.tsx`:

```tsx
// apps/console/src/routes/__root.tsx
import { createRootRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Card } from '@monobase/ui'
import { useSession } from '@/features/auth/use-session'

export const Route = createRootRoute({ component: RootGate })

export function RootGate() {
  const { status } = useSession()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (status === 'unauthed' && pathname !== '/sign-in') navigate({ to: '/sign-in' })
  }, [status, pathname, navigate])

  if (status === 'forbidden') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-6 space-y-2">
          <h1 className="text-section font-semibold text-foreground">Platform operator access required</h1>
          <p role="alert" className="text-body text-foreground">
            Your account is signed in but is not a platform operator. Contact the Memberry team if you believe this is an error.
          </p>
        </Card>
      </div>
    )
  }
  if (status === 'authed' || pathname === '/sign-in') return <Outlet />
  return <div role="status" aria-label="Loading" className="min-h-screen flex items-center justify-center">…</div>
}
```

- [ ] **Step 9: Run → PASS. Typecheck (incl tests). Verify frozen. Commit.**

```bash
bun run --filter @monobase/console typecheck
bun run --filter @monobase/console test
git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated   # empty
git add apps/console && git commit -m "feat(console): CSRF SDK client + session probe (authed/unauthed/forbidden) + root guard"
```

---

### Task 3: Operator sign-in screen

**Files:**
- Create: `apps/console/src/features/auth/sign-in.ts`
- Test: `apps/console/src/features/auth/sign-in.test.ts`
- Create: `apps/console/src/routes/sign-in.tsx`
- Test: `apps/console/src/routes/sign-in.test.tsx`

**Interfaces:**
- Produces: `signIn(email, password, baseUrl?): Promise<{ok:true}|{ok:false;error:string}>` from `@/features/auth/sign-in`; the `/sign-in` route.
- Consumes: `useSession` (redirect authed away), `API_BASE` from `@/lib/api`.

- [ ] **Step 1: Write failing sign-in.test.ts** (port `apps/org/src/features/auth/sign-in.test.ts` — same fn). Assert: POSTs `/auth/sign-in/email` with `credentials:'include'` + JSON body; `res.ok` → `{ok:true}`; non-ok → `{ok:false,error}`.

- [ ] **Step 2: Run → FAIL. Implement sign-in.ts** (BYTE-PORT of `apps/org/src/features/auth/sign-in.ts` — identical).

- [ ] **Step 3: Run → PASS.**

- [ ] **Step 4: Write failing sign-in.test.tsx** (mock `signIn` + router `useNavigate` + `useQueryClient` + `useSession`; assert submitting calls `signIn` and on `{ok:true}` invalidates `['session']` and navigates to `/`; on error shows `role=alert`). Mirror the apps/org page-test mock style.

- [ ] **Step 5: Run → FAIL. Implement sign-in.tsx** (port `apps/org/src/routes/sign-in.tsx`; change heading to `Operator sign in`). Keep email+password inputs, `min-h-tap`, `role=alert`, busy state.

- [ ] **Step 6: Run → PASS. Build (regen routeTree) + commit.**

```bash
bun run --filter @monobase/console build   # regenerates routeTree.gen.ts with /sign-in
bun run --filter @monobase/console typecheck
git add apps/console && git commit -m "feat(console): operator email+password sign-in screen"
```

---

### Task 4: Organizations list + platform stats (index screen)

**Files:**
- Create: `apps/console/src/features/orgs/use-orgs.ts`
- Test: `apps/console/src/features/orgs/use-orgs.test.tsx`
- Create: `apps/console/src/features/orgs/use-platform-stats.ts`
- Test: `apps/console/src/features/orgs/use-platform-stats.test.tsx`
- Create: `apps/console/src/features/orgs/OrgsView.tsx`
- Test: `apps/console/src/features/orgs/OrgsView.test.tsx`
- Create: `apps/console/src/features/orgs/Orgs.tsx` (container)
- Modify: `apps/console/src/routes/index.tsx` (render `Orgs`)

**Interfaces:**
- Produces:
  - `useOrgs(): { status:'loading'|'ready'|'error'; orgs: OrgRow[]; total: number }` where `OrgRow = { id:string; name:string; region:string|null; orgType:string; status:string; createdAt: Date|string }`.
  - `usePlatformStats(): { status:'loading'|'ready'|'error'; hasSnapshot: boolean; stats: PlatformStats }` where `PlatformStats = { totalMembers:number; activeMembers:number; totalRevenueCents:number; avgCollectionRate:number }`. **`hasSnapshot` = the summary returned ≥1 association row.**
  - `OrgsView` (presentational, props `{ orgs, total, orgsStatus, associationsCount, stats, statsStatus, hasSnapshot, onCreate }`).
- Consumes: SDK `listOrganizations`, `getPlatformSummary`; the `associationsCount` comes from `useAssociations` (Task 5) — Task 4 may add a tiny `useAssociations` first OR Task 5 lands it and the container wires it; if Task 4 runs first, pass `associationsCount={undefined}` and render the Associations tile em-dash until Task 5 wires it. `centavosToPhp` from `@monobase/ui`.

**Shape facts (verified vs handler source):**
- `listOrganizations({query})` → `{ data: Organization[], pagination: { offset, limit, total } }`. **DRIFT**: SDK type declares richer pagination (`count/totalCount/totalPages`, NO `total`) → mock with `as any`; read only `data` + `pagination.total`. ⚠️ **Do NOT later "fix" this cast to bind the type and read `pagination.count`/`totalCount` — those are `undefined` at runtime (M4).** `Organization` has `{id, name, region, orgType, status, createdAt, ...}`; `createdAt` is a `Date` (response transformer).
- `getPlatformSummary({query})` → `{ data: AssocRow[], meta: { cursor, hasMore, total } }`, NO transformer, NO drift → bind to `GetPlatformSummaryResponse`. `AssocRow = { associationId, associationName?, chapterCount, totalMembers, activeMembers, collectionRate(%), creditCompliance(%), totalRevenueCents(number) }`.
- ⚠️ **I1 — `getPlatformSummary` is SNAPSHOT-derived.** It aggregates from `chapterSnapshots` filtered by `snapshotMonth`, written by a **monthly snapshot cron — NOT by create-org or roster-import.** On a fresh platform / any month before the cron runs, `data` is `[]`. So Members/Active/Revenue/Avg-collection are **unavailable by design** until the cron runs. **Never render confident `0`/`₱0.00` for these** — show an em-dash + "No snapshot for `<month>` yet" empty state (driven by `hasSnapshot===false`). The reliable tiles are **Organizations** (`useOrgs().total`) and **Associations** (`useAssociations().length`), which come from live tables, not snapshots.

- [ ] **Step 1: Write failing use-orgs.test.tsx** (mock `listOrganizations`; assert maps rows + exposes `total` from `pagination.total`; empty list → `ready` with `[]`).

```tsx
vi.mocked(listOrganizations).mockResolvedValue(
  // DRIFT: handler sends pagination {offset,limit,total}; SDK type declares more → cast.
  ok({ data: [{ id: 'o1', name: 'Olive Dental Chapter', region: 'NCR', orgType: 'chapter', status: 'trial', createdAt: new Date('2026-06-01') }], pagination: { offset: 0, limit: 20, total: 1 } } as any)
)
// expect status 'ready', orgs[0].name 'Olive Dental Chapter', total 1
```

- [ ] **Step 2: Run → FAIL. Implement use-orgs.ts:**

```ts
import { useQuery } from '@tanstack/react-query'
import { listOrganizations } from '@monobase/sdk-ts/generated'

export type OrgRow = { id: string; name: string; region: string | null; orgType: string; status: string; createdAt: Date | string }

export function useOrgs(): { status: 'loading' | 'ready' | 'error'; orgs: OrgRow[]; total: number } {
  const q = useQuery({
    queryKey: ['orgs'],
    retry: false,
    queryFn: async () => {
      const { data } = await listOrganizations({ query: { limit: 100 } })
      if (!data) throw new Error('orgs failed')
      // DRIFT: pagination is {offset,limit,total} at runtime; read data + total only.
      const d = data as unknown as { data: OrgRow[]; pagination: { total: number } }
      return { orgs: d.data, total: d.pagination?.total ?? d.data.length }
    },
  })
  if (q.isLoading) return { status: 'loading', orgs: [], total: 0 }
  if (q.isError || !q.data) return { status: 'error', orgs: [], total: 0 }
  return { status: 'ready', orgs: q.data.orgs, total: q.data.total }
}
```

- [ ] **Step 3: Run → PASS.**

- [ ] **Step 4: Write failing use-platform-stats.test.tsx** (mock `getPlatformSummary`). Assert TWO cases: (a) non-empty → aggregates sum members/revenue + avg collectionRate + `hasSnapshot:true`; (b) **empty `data:[]` → `hasSnapshot:false`, status `ready`, stats all 0** (the empty-state signal, NOT presented as real data).

```tsx
// (a) non-empty
vi.mocked(getPlatformSummary).mockResolvedValue(
  ok<GetPlatformSummaryResponse>({
    data: [
      { associationId: 'a1', chapterCount: 1, totalMembers: 10, activeMembers: 8, collectionRate: 50, creditCompliance: 0, totalRevenueCents: 150000 },
      { associationId: 'a2', chapterCount: 2, totalMembers: 20, activeMembers: 15, collectionRate: 70, creditCompliance: 0, totalRevenueCents: 50000 },
    ],
    meta: { cursor: null, hasMore: false, total: 2 },
  })
)
// expect hasSnapshot true, totalMembers 30, totalRevenueCents 200000, avgCollectionRate 60
// (b) empty
vi.mocked(getPlatformSummary).mockResolvedValue(
  ok<GetPlatformSummaryResponse>({ data: [], meta: { cursor: null, hasMore: false, total: 0 } })
)
// expect status 'ready', hasSnapshot false, stats.totalMembers 0 (used only to render the em-dash empty state, never as a confident value)
```

- [ ] **Step 5: Run → FAIL. Implement use-platform-stats.ts:**

```ts
import { useQuery } from '@tanstack/react-query'
import { getPlatformSummary } from '@monobase/sdk-ts/generated'
import type { GetPlatformSummaryResponse } from '@monobase/sdk-ts/generated'

export type PlatformStats = { totalMembers: number; activeMembers: number; totalRevenueCents: number; avgCollectionRate: number }

export function usePlatformStats(): { status: 'loading' | 'ready' | 'error'; hasSnapshot: boolean; stats: PlatformStats } {
  const q = useQuery({
    queryKey: ['platform-stats'],
    retry: false,
    queryFn: async () => {
      const { data } = await getPlatformSummary({ query: {} })
      if (!data) throw new Error('stats failed')
      const rows = (data as GetPlatformSummaryResponse).data
      const n = rows.length
      return {
        hasSnapshot: n > 0, // I1: snapshot-cron data; [] means "no snapshot yet", not zero.
        totalMembers: rows.reduce((s, r) => s + r.totalMembers, 0),
        activeMembers: rows.reduce((s, r) => s + r.activeMembers, 0),
        totalRevenueCents: rows.reduce((s, r) => s + Number(r.totalRevenueCents), 0),
        avgCollectionRate: n ? rows.reduce((s, r) => s + r.collectionRate, 0) / n : 0,
      }
    },
  })
  const zero: PlatformStats = { totalMembers: 0, activeMembers: 0, totalRevenueCents: 0, avgCollectionRate: 0 }
  if (q.isLoading) return { status: 'loading', hasSnapshot: false, stats: zero }
  if (q.isError || !q.data) return { status: 'error', hasSnapshot: false, stats: zero }
  return { status: 'ready', hasSnapshot: q.data.hasSnapshot, stats: q.data }
}
```

- [ ] **Step 6: Run → PASS.**

- [ ] **Step 7: Write failing OrgsView.test.tsx** (presentational; props-driven). Assert: (1) Organizations tile shows `total`; (2) Associations tile shows `associationsCount`; (3) when `hasSnapshot=true`, Revenue shows `centavosToPhp(200000)` (= ₱2,000.00) with NO `NaN`; (4) **when `hasSnapshot=false`, Members/Revenue/Avg tiles show an em-dash + "No snapshot" text, NOT `0`/`₱0.00`**; (5) org table lists org names; (6) "Create organization" button calls `onCreate`. Use `@monobase/ui` `Button`/`Card` primitives; fall back to semantic `<table>` if no Table component is exported.

- [ ] **Step 8: Run → FAIL. Implement OrgsView.tsx** (presentational, no router): a stats strip of `Card`s — **Organizations** = `total` (live) · **Associations** = `associationsCount ?? '—'` (live) · **Members / Active / Revenue / Avg collection** = real values when `hasSnapshot`, else an em-dash with helper text "No snapshot for this month yet" (I1 — never confident zeros). Revenue = `centavosToPhp(Number(stats.totalRevenueCents))`; Avg = `stats.avgCollectionRate.toFixed(0)%`. Below: an orgs table (name, region, type, status, created). Loading/empty/error states. `min-h-tap` primary "Create organization" button → `onCreate`. All `@monobase/ui` tokens, ≥18px text.

- [ ] **Step 9: Run → PASS. Implement container Orgs.tsx + wire index route:**

```tsx
// apps/console/src/features/orgs/Orgs.tsx
import { useNavigate } from '@tanstack/react-router'
import { useOrgs } from './use-orgs'
import { usePlatformStats } from './use-platform-stats'
import { useAssociations } from './use-associations' // from Task 5; if Task 4 runs first, inline a minimal version or pass associationsCount={undefined}
import OrgsView from './OrgsView'

export default function Orgs() {
  const navigate = useNavigate()
  const { orgs, total, status: orgsStatus } = useOrgs()
  const { stats, status: statsStatus, hasSnapshot } = usePlatformStats()
  const { associations } = useAssociations()
  return <OrgsView orgs={orgs} total={total} orgsStatus={orgsStatus} associationsCount={associations.length}
    stats={stats} statsStatus={statsStatus} hasSnapshot={hasSnapshot} onCreate={() => navigate({ to: '/orgs/new' })} />
}
```

> **Task ordering note:** `Orgs.tsx` imports `useAssociations` (Task 5). Implement Task 5's `use-associations.ts` BEFORE wiring `Orgs.tsx` here, or land a 2-line `useAssociations` in Task 4 and let Task 5 keep it. Simplest: move `use-associations.ts` + its test to the TOP of Task 5 and reorder so Task 5's hook exists; or fold `use-associations.ts` into Task 4. Pick one and keep the build green at the task boundary.
```tsx
// apps/console/src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import Orgs from '../features/orgs/Orgs'
export const Route = createFileRoute('/')({ component: Orgs })
```

- [ ] **Step 10: Build (regen routeTree) + typecheck + test + frozen + commit.**

```bash
bun run --filter @monobase/console build
bun run --filter @monobase/console typecheck && bun run --filter @monobase/console test
git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated   # empty
git add apps/console && git commit -m "feat(console): organizations list + platform stats index screen"
```

---

### Task 5: Create-organization form

**Files:**
- Create: `apps/console/src/features/orgs/use-associations.ts`
- Test: `apps/console/src/features/orgs/use-associations.test.tsx`
- Create: `apps/console/src/features/orgs/use-create-org.ts`
- Test: `apps/console/src/features/orgs/use-create-org.test.tsx`
- Create: `apps/console/src/features/orgs/CreateOrgView.tsx`
- Test: `apps/console/src/features/orgs/CreateOrgView.test.tsx`
- Create: `apps/console/src/features/orgs/CreateOrg.tsx` (container)
- Create: `apps/console/src/routes/orgs/new.tsx`

**Interfaces:**
- Produces:
  - `useAssociations(): { status; associations: { id:string; name:string }[] }` (from `listAssociations`).
  - `useCreateOrg(): { submit(input): Promise<...>; pending; error }` where `input = { associationId, name, orgType, region?, contactEmail? }`; on success invalidates `['orgs']`; surfaces engine error string (403/409/404/400) from the SDK `error` field.
  - `CreateOrgView` (presentational form, props for fields + associations + onSubmit + error + pending).
- Consumes: SDK `listAssociations`, `createOrganization`.

**Shape facts:**
- `createOrganization({ body })` body = `{ associationId(req), name(req), orgType(req: 'chapter'|'society'|'national'|'clinic'), region?, contactEmail? }`. Returns flat `Organization`, 201. Errors: 403 (not super), 409 (dup name in association), 404 (association not found), 400 (invalid name/slug). **`initialOfficerEmail` exists in the type but is IGNORED by the handler — do NOT surface it.**
- `listAssociations({query})` → `{ data: PlatformAdminModuleAssociation[], pagination }`. Consume `id`, `name`.

- [ ] **Step 1: Write failing use-associations.test.tsx** (mock `listAssociations`; assert maps `{id,name}`; empty → `ready` empty).

- [ ] **Step 2: Run → FAIL. Implement use-associations.ts:**

```ts
import { useQuery } from '@tanstack/react-query'
import { listAssociations } from '@monobase/sdk-ts/generated'

export function useAssociations(): { status: 'loading' | 'ready' | 'error'; associations: { id: string; name: string }[] } {
  const q = useQuery({
    queryKey: ['associations'],
    retry: false,
    queryFn: async () => {
      const { data } = await listAssociations({ query: { limit: 100 } })
      if (!data) throw new Error('associations failed')
      const rows = (data as unknown as { data: Array<{ id: string; name: string }> }).data
      return rows.map((a) => ({ id: a.id, name: a.name }))
    },
  })
  if (q.isLoading) return { status: 'loading', associations: [] }
  if (q.isError || !q.data) return { status: 'error', associations: [] }
  return { status: 'ready', associations: q.data }
}
```
(If `listAssociations` has a clean generated `ListAssociationsResponse` with no drift, bind the mock to it instead of `as unknown`; verify by reading the type + transformers.gen. Keep the cast only if it genuinely drifts, with a comment.)

- [ ] **Step 3: Run → PASS.**

- [ ] **Step 4: Write failing use-create-org.test.tsx** (mock `createOrganization`):
  - success: `mockResolvedValue(ok<CreateOrganizationResponse>({ ...FULL org shape... }, 201))` → `submit` resolves ok; invalidates `['orgs']` (assert via a spy on `queryClient.invalidateQueries` or a fresh QueryClient + refetch flag). **M5: binding to `CreateOrganizationResponse` (= `PlatformAdminModuleOrganization`) requires EVERY required field (`id, associationId, name, slug?, orgType, status, createdAt, updatedAt`, etc.) — fill the COMPLETE shape (read the type); do NOT reach for `as any`. The compile-error-on-missing-field IS the drift tripwire.**
  - 409: `mockResolvedValue(err(409, { error: 'Organization with this name already exists in this association' }))` → error string surfaced.
  - 403: `err(403, { error: 'Super admin access required' })` → error surfaced.

- [ ] **Step 5: Run → FAIL. Implement use-create-org.ts:**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createOrganization } from '@monobase/sdk-ts/generated'

export type CreateOrgInput = { associationId: string; name: string; orgType: string; region?: string; contactEmail?: string }

export function useCreateOrg() {
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: async (input: CreateOrgInput) => {
      const { data, error, response } = await createOrganization({
        body: {
          associationId: input.associationId,
          name: input.name,
          orgType: input.orgType as 'chapter' | 'society' | 'national' | 'clinic',
          ...(input.region ? { region: input.region } : {}),
          ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
        },
      })
      if (!data) {
        // SDK no-throw on non-2xx: surface the engine error string.
        const msg = (error as { error?: string; message?: string })?.error
          ?? (error as { message?: string })?.message
          ?? `Create failed (${response?.status ?? '?'})`
        throw new Error(msg)
      }
      return data
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['orgs'] }) },
  })
  return { submit: m.mutateAsync, pending: m.isPending, error: m.error?.message ?? '' }
}
```

- [ ] **Step 6: Run → PASS.**

- [ ] **Step 7: Write failing CreateOrgView.test.tsx** (presentational form; assert: association `<select>` lists associations; orgType `<select>` has the 4 enum options; submitting calls `onSubmit` with the field values; `role=alert` renders the `error` prop; submit button disabled while `pending`; empty-associations notice shown when no associations).

- [ ] **Step 8: Run → FAIL. Implement CreateOrgView.tsx** (presentational): labeled `name` (required), association `<select>` (required, from `associations`; if empty → `role=alert` "Seed an association first" notice + disabled submit), orgType `<select>` (chapter/society/national/clinic), region (optional), contactEmail (optional, `type=email`). `min-h-tap` on inputs + submit. `role=alert` for `error`. One primary "Create organization" button.

- [ ] **Step 9: Run → PASS. Implement container + route:**

```tsx
// apps/console/src/features/orgs/CreateOrg.tsx
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAssociations } from './use-associations'
import { useCreateOrg, type CreateOrgInput } from './use-create-org'
import CreateOrgView from './CreateOrgView'

export default function CreateOrg() {
  const navigate = useNavigate()
  const { associations } = useAssociations()
  const { submit, pending, error } = useCreateOrg()
  const [localError, setLocalError] = useState('')
  async function onSubmit(input: CreateOrgInput) {
    setLocalError('')
    try {
      const org = await submit(input)
      toast.success(`Organization "${org.name}" created`)
      navigate({ to: '/' })
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Create failed')
    }
  }
  return <CreateOrgView associations={associations} onSubmit={onSubmit} pending={pending} error={localError || error} />
}
```
```tsx
// apps/console/src/routes/orgs/new.tsx
import { createFileRoute } from '@tanstack/react-router'
import CreateOrg from '../../features/orgs/CreateOrg'
export const Route = createFileRoute('/orgs/new')({ component: CreateOrg })
```

- [ ] **Step 10: Build (regen routeTree → adds /orgs/new) + typecheck + test + frozen + commit.**

```bash
bun run --filter @monobase/console build
bun run --filter @monobase/console typecheck && bun run --filter @monobase/console test
git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated   # empty
git add apps/console && git commit -m "feat(console): create-organization form (org row) over POST /admin/organizations"
```

---

### Task 6: E2E stub + founder seed script + final gate

**Files:**
- Create: `apps/console/src/e2e/console-flow.spec.ts`
- Create: `services/api-ts/scripts/seed-console.ts` (the ONLY new `services/` file — additive, like `seed-paylink.ts`)

**Interfaces:** none produced; this task verifies the whole branch.

- [ ] **Step 1: Write the Playwright E2E stub** (`apps/console/src/e2e/console-flow.spec.ts`), self-contained `page.route` stubs matching REAL handler shapes:
  - `**/csrf-token` → `{ token: 'test' }`
  - `**/auth/sign-in/email` (POST) → 200 `{}` + set-cookie
  - `**/admin/organizations` GET → `{ data: [{ id:'o1', name:'Olive Dental Chapter', region:'NCR', orgType:'chapter', status:'trial', createdAt:'2026-06-01T00:00:00Z' }], pagination:{ offset:0, limit:100, total:1 } }`
  - `**/admin/national/platform` GET → `{ data: [{ associationId:'a1', chapterCount:1, totalMembers:10, activeMembers:8, collectionRate:50, creditCompliance:0, totalRevenueCents:150000 }], meta:{ cursor:null, hasMore:false, total:1 } }`
  - `**/admin/associations` GET → `{ data:[{ id:'a1', name:'PH Dental Association' }], pagination:{ offset:0, limit:100, total:1 } }`
  - `**/admin/organizations` POST → 201 `{ id:'o2', associationId:'a1', name:'New Chapter', orgType:'chapter', status:'trial', createdAt:'2026-06-27T00:00:00Z', updatedAt:'2026-06-27T00:00:00Z' }`

  Flow: goto `/sign-in` → fill email+password → submit → land on `/` → assert "Olive Dental Chapter" + ₱1,500.00 (from 150000) visible → click "Create organization" → fill name + pick association + orgType → submit → assert success toast / redirected to `/` with no `NaN` on the page. Keep assertions non-vacuous (gate on actionability + result text).

- [ ] **Step 2: Controller runs the E2E locally** (`cd apps/console && bun run dev` in one shell on :3006, then `bun run --filter @monobase/console test:e2e` — or use Playwright's `webServer`). Expected: 1 passed. (CI e2e-console deferred per Task 1 NOTE.)

- [ ] **Step 3: Write `services/api-ts/scripts/seed-console.ts`** — a dev bootstrap that seeds: (a) one association (via `AssociationRepository` or direct insert), (b) a Better-Auth user for the founder, (c) a `platform_admin` row (role `super`) for that user. **Before writing, READ the real patterns (the review flagged this step as hand-wavy):** `services/api-ts/scripts/seed-paylink.ts` for the Better-Auth-user-creation mechanism + env handling (`DATABASE_URL`, `AUTH_SECRET`), and `services/api-ts/src/handlers/platformadmin/repos/platform-admin.schema.ts` for the exact `platform_admin` row columns (role enum `super`/`support`/`analyst`). Idempotent upserts. Header comment: run command + that real create-org against a live stack is blocked ONLY by needing this seed (NOT G2 — create-org has no money path). **This file is the sole permitted `services/` change; engine handlers/specs/migrations untouched.**

- [ ] **Step 4: Final hard gate (controller-verified, evidence before done). I2 — TWO separate frozen checks (the seed file lives in `scripts/`, OUTSIDE `src/`, so it never appears in the first diff):**

```bash
bun run --filter '*' typecheck         # all workspaces incl console source+tests = 0 errors
bun run --filter @monobase/console test # all unit tests pass
bun run --filter @monobase/console build
# (a) src/specs/generated frozen — MUST be EMPTY (no exceptions):
git diff --stat main -- services/api-ts/src specs/ packages/sdk-ts/src/generated
# (b) the ONLY new services/ file is the seed script — this MUST print nothing:
git diff --name-only main -- services/api-ts | grep -v '^services/api-ts/scripts/seed-console\.ts$'
```
Expected: typecheck 0, tests PASS, build PASS, check (a) EMPTY, check (b) prints nothing.

- [ ] **Step 5: Commit.**

```bash
git add apps/console services/api-ts/scripts/seed-console.ts
git commit -m "feat(console): stubbed E2E flow + founder seed script + final gate"
```

---

## Self-Review

**Spec coverage:** §3 spine → Task 1+2; §4 auth → Task 2 (probe+guard) + Task 3 (sign-in) + Task 6 (seed); §5 screen 1 → Task 3, screen 2 → Task 4, screen 3 → Task 5; §6 shapes → Tasks 4/5 (drift-anchored); §7 testing → every task + Task 6 E2E; §8 gate → Task 6; §9 follow-ups → documented (no tasks, intentional); §10 gotchas → Global Constraints. No gaps.

**Type consistency:** `useSession` returns `{status}` everywhere; `OrgRow`/`PlatformStats`/`CreateOrgInput` defined once and consumed by their views/containers; `ok()/err()` signatures match the ported helper; `centavosToPhp` from `@monobase/ui` (confirm export at impl). `getPlatformSummary` bound to `GetPlatformSummaryResponse` (trustworthy), `listOrganizations`/`listAssociations` cast (drift) with comments.

**Open verification flags for implementers (resolve by reading source, don't assume):** (a) `@monobase/ui` exports `centavosToPhp` + which layout primitives (Table?) exist; (b) `listAssociations` generated type + transformer (bind vs cast); (c) `createOrganization` SDK fn param name (`body`) + `CreateOrganizationResponse` type name.
