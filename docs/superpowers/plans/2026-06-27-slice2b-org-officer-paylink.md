# Slice-2b — apps/org Officer UI (send pay-link + dues) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/org`, an authed officer PWA where Dr. Olive signs in, picks a member, mints + shares a pay-link, and sees who has paid — closing the first-peso loop slice-2a opened.

**Architecture:** New Vite/React/TanStack workspace scaffolded by copying `apps/member`. Unlike the public member app, it is cookie-session authed and CSRF-protected, so a configured SDK client (`credentials:'include'` + `x-csrf-token` injection) is the spine. All data over the FROZEN engine's existing routes; UI on `@monobase/ui` Friendly-Clarity tokens.

**Tech Stack:** Vite 7, React 19, TanStack Router ^1.131 + plugin ^1.132, React Query ^5.85, `@monobase/sdk-ts` (hey-api generated client), `@monobase/ui`, vitest 4 + RTL + jsdom, Playwright 1.58.2, sonner.

## Global Constraints

- Engine FROZEN: NO changes under `services/api-ts/`, `specs/`, or `packages/sdk-ts/src/generated/`. apps/org adds NOTHING under `services/`. Verify with `git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated` (must be EMPTY).
- NO `/api` prefix in engine route strings — SDK baseUrl is `/api`, Vite proxy strips it.
- Dev port **3005** (member uses 3004).
- SDK client import: `@monobase/sdk-ts/generated/client.gen` (the `client`); endpoint fns from `@monobase/sdk-ts/generated`. NO root export.
- SDK does NOT throw on non-2xx; returns `data: undefined` on transport error. Every queryFn/mutationFn reads `response.status` and throws/branches explicitly.
- SDK transforms money `amount` → **bigint** at runtime — coerce `Number(...)` at every math/format/**display** boundary AND, the reverse, `BigInt(...)` at every **request-body** boundary (e.g. `sendPaymentLink` body `amount` is typed `bigint?` — passing a `number` is a typecheck error). UI state keeps `number`; convert only at the SDK seam.
- **Org scoping (x-org-id):** the `/association/member/dues-*` list endpoints (`listDuesInvoices`, `listDuesPayments`) read org context from the **`x-org-id` request header** (engine `org-context.ts`), NOT from a query param — a call with no header 403s. `configureApiClient` (Task 2) injects `x-org-id` from `localStorage['org.selectedOrgId']` on every request, so these calls work by default. `getDuesDashboard` is path-scoped (`{path:{organizationId}}`) and needs no header.
- **Test mocking (MANDATORY pattern):** mock the SDK with a hoisted module factory, mirroring the shipped `apps/member/src/features/pay/use-pay-link.test.tsx`. Do NOT use `vi.spyOn(sdk, 'fn')` on generated ESM named exports — it is unreliable here (the generated package resolves to source TS). Pattern: at the top of each test file `vi.mock('@monobase/sdk-ts/generated', () => ({ fnA: vi.fn(), fnB: vi.fn() }))`, then `import { fnA } from '@monobase/sdk-ts/generated'`, then in each test `(fnA as any).mockResolvedValue(...)`. Where the test code blocks below show `vi.spyOn(sdk, 'fn').mockResolvedValue(x)`, convert it to this factory form (`(fn as any).mockResolvedValue(x)`). (Spying on `client.interceptors.request.use` in `api.test.ts` is fine — that is an object method, not an ESM binding.)
- NO `@monobase/vitest-test-shim`. Real vitest + RTL + jsdom; `test-setup.ts` imports `@testing-library/jest-dom`.
- vitest `include:['src/**/*.test.ts','src/**/*.test.tsx']` so `.spec` E2E files are excluded.
- `test:e2e` uses portable `../../node_modules/.bin/playwright test`. Playwright pinned `1.58.2`.
- routeTree.gen.ts generated (`tsr/build` via the router plugin on build/dev) and COMMITTED before typecheck.
- Use `sonner` for toasts. All UI on `@monobase/ui`: ≥18px base, ≥48px tap targets (`min-h-tap`), WCAG AA, `role="alert"` on errors, labeled controls, one primary task per screen.
- Auth: sign-in `POST /auth/sign-in/email` `{email,password}` (CSRF-allowlisted, sets httpOnly session cookie). CSRF token from `GET /csrf-token` → body `{ token }`, mirror into `x-csrf-token` header on every non-allowlisted mutating request.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Scaffold apps/org

**Files:**
- Create: `apps/org/package.json`, `apps/org/vite.config.ts`, `apps/org/vitest.config.ts`, `apps/org/tsconfig.json`, `apps/org/playwright.config.ts`, `apps/org/postcss.config.ts`, `apps/org/tailwind.config.ts`, `apps/org/index.html`, `apps/org/src/main.tsx`, `apps/org/src/styles.css`, `apps/org/src/test-setup.ts`, `apps/org/src/vite-env.d.ts`, `apps/org/src/routes/__root.tsx`, `apps/org/src/routes/index.tsx`, `apps/org/src/routeTree.gen.ts`

**Interfaces:**
- Produces: a buildable/typecheckable workspace `@monobase/org` on port 3005, mirroring `apps/member`.

- [ ] **Step 1: Copy the member scaffold config files**, changing only port + name. `apps/org/package.json` — identical deps to `apps/member/package.json`, but:

```json
{
  "name": "@monobase/org",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 3005",
    "build": "tsc -b && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "../../node_modules/.bin/playwright test"
  },
  "dependencies": {
    "@monobase/sdk-ts": "workspace:*",
    "@monobase/ui": "workspace:*",
    "@tanstack/react-query": "^5.85.9",
    "@tanstack/react-router": "^1.131.31",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "sonner": "^2.0.3"
  },
  "devDependencies": {
    "@monobase/typescript-config": "workspace:*",
    "@tanstack/router-plugin": "^1.132.0",
    "@types/react": "^19.1.12",
    "@types/react-dom": "^19.1.9",
    "@vitejs/plugin-react": "^5.0.2",
    "@testing-library/react": "^16.3.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/user-event": "^14.5.2",
    "@playwright/test": "1.58.2",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.6",
    "tailwindcss": "^3",
    "jsdom": "^29",
    "bun-types": "^1.2.21",
    "typescript": "^5.9.2",
    "vite": "^7.1.4",
    "vite-tsconfig-paths": "^5.1.4",
    "vitest": "^4.1.5"
  }
}
```

Note: `sonner` and `@testing-library/user-event` are added vs member (member had neither; org needs toasts + form interaction tests). Verify `sonner` version against repo: run `grep -r '"sonner"' apps/ packages/ services/` and pin to whatever version already exists in the monorepo; if none, use `^2.0.3`.

- [ ] **Step 2: Copy `vite.config.ts`** verbatim from `apps/member/vite.config.ts` but change both `port: 3004` → `port: 3005` (server + preview).

- [ ] **Step 3: Copy verbatim** from member (no changes needed): `vitest.config.ts`, `tsconfig.json`, `postcss.config.ts`, `tailwind.config.ts`, `src/styles.css`, `src/test-setup.ts`, `src/vite-env.d.ts`, `src/routes/__root.tsx`. For `playwright.config.ts`, copy and change `baseURL: 'http://localhost:3004'` → `3005`.

- [ ] **Step 4: `apps/org/index.html`** — copy member's, change `<title>` to `Memberry — Officer`.

- [ ] **Step 5: `apps/org/src/main.tsx`** — copy member's main.tsx (Task 2 will add the `configureApiClient()` call; for now keep the `client.setConfig({ baseUrl: ... })` line as in member). Add the sonner `<Toaster />`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { client } from '@monobase/sdk-ts/generated/client.gen'
import { routeTree } from './routeTree.gen'
import './styles.css'

client.setConfig({ baseUrl: import.meta.env.VITE_API_URL ?? `${window.location.origin}/api` })

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  </StrictMode>,
)
```

- [ ] **Step 6: `apps/org/src/routes/index.tsx`** — placeholder home (Task 5 replaces it):

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-title font-semibold text-foreground">Memberry — Officer</h1>
    </div>
  ),
})
```

- [ ] **Step 7: Install + generate routeTree + build.**

Run: `cd /Users/elad-mini/Desktop/memberry && bun install && cd apps/org && bun run build`
Expected: install succeeds; build generates `src/routeTree.gen.ts` and compiles with no errors.

- [ ] **Step 8: Typecheck.**

Run: `cd apps/org && bun run typecheck`
Expected: 0 errors.

- [ ] **Step 9: Commit** (include the generated routeTree).

```bash
git add apps/org
git commit -m "feat(org): scaffold apps/org officer app (port 3005)"
```

---

### Task 2: CSRF-aware authed SDK client

**Files:**
- Create: `apps/org/src/lib/api.ts`
- Test: `apps/org/src/lib/api.test.ts`
- Modify: `apps/org/src/main.tsx` (call `configureApiClient()`)

**Interfaces:**
- Consumes: `client` from `@monobase/sdk-ts/generated/client.gen` (hey-api client with `setConfig(config)` and `interceptors.request.use(fn)`; request interceptor receives the Fetch `Request` and returns it; `request.headers` is a mutable `Headers`).
- Produces: `configureApiClient(baseUrl?: string): void` — sets `credentials:'include'` + baseUrl, and registers a request interceptor that adds `x-csrf-token` to mutating requests. `resetCsrfCacheForTest(): void` — clears the module-level token cache (test-only).

- [ ] **Step 1: Write the failing test.** `apps/org/src/lib/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { client } from '@monobase/sdk-ts/generated/client.gen'
import { configureApiClient, resetCsrfCacheForTest } from './api'

function makeReq(method: string, url: string): Request {
  return new Request(url, { method })
}

describe('configureApiClient CSRF interceptor', () => {
  let interceptor: (req: Request) => Promise<Request> | Request
  const fetchMock = vi.fn()

  beforeEach(() => {
    resetCsrfCacheForTest()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: 'csrf-abc' }), { status: 200 }))
    // Capture the registered interceptor by spying on the client's use().
    const useSpy = vi.spyOn(client.interceptors.request, 'use')
    configureApiClient('http://localhost/api')
    interceptor = useSpy.mock.calls.at(-1)![0] as typeof interceptor
    useSpy.mockRestore()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('injects x-csrf-token on POST to a protected path', async () => {
    const out = await interceptor(makeReq('POST', 'http://localhost/api/org/o1/payments/send-link'))
    expect(out.headers.get('x-csrf-token')).toBe('csrf-abc')
    expect(fetchMock).toHaveBeenCalledWith('http://localhost/api/csrf-token', expect.objectContaining({ credentials: 'include' }))
  })

  it('does NOT inject on GET', async () => {
    const out = await interceptor(makeReq('GET', 'http://localhost/api/membership/members/o1'))
    expect(out.headers.get('x-csrf-token')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does NOT inject on /auth or /pay mutating paths (engine allowlist)', async () => {
    await interceptor(makeReq('POST', 'http://localhost/api/auth/sign-in/email'))
    await interceptor(makeReq('POST', 'http://localhost/api/pay/tok/checkout'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('caches the token across calls (one fetch)', async () => {
    await interceptor(makeReq('POST', 'http://localhost/api/org/o1/payments/send-link'))
    await interceptor(makeReq('POST', 'http://localhost/api/org/o1/payments/t1/revoke'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('injects x-org-id from localStorage on a dues GET', async () => {
    localStorage.setItem('org.selectedOrgId', 'o9')
    const out = await interceptor(makeReq('GET', 'http://localhost/api/association/member/dues-payments'))
    expect(out.headers.get('x-org-id')).toBe('o9')
    localStorage.removeItem('org.selectedOrgId')
  })
})
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd apps/org && bun run test src/lib/api.test.ts`
Expected: FAIL — `./api` has no `configureApiClient`/`resetCsrfCacheForTest`.

- [ ] **Step 3: Write the implementation.** `apps/org/src/lib/api.ts`:

```ts
import { client } from '@monobase/sdk-ts/generated/client.gen'

// Engine CSRF allowlist (services/api-ts/src/app.ts): these prefixes skip the
// double-submit check, so we must NOT attach a token (and must not block on
// fetching one) for them.
const CSRF_EXEMPT_PREFIXES = ['/auth/', '/pay/', '/webhooks/', '/billing/webhooks/', '/email/unsubscribe', '/test/', '/csrf-token']
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

let csrfToken: string | null = null
let inflight: Promise<string> | null = null

/** Test-only: clear the module-level CSRF cache between tests. */
export function resetCsrfCacheForTest(): void {
  csrfToken = null
  inflight = null
}

async function getCsrfToken(baseUrl: string): Promise<string> {
  if (csrfToken) return csrfToken
  if (!inflight) {
    inflight = fetch(`${baseUrl}/csrf-token`, { credentials: 'include' })
      .then((r) => r.json())
      .then((b: { token: string }) => { csrfToken = b.token; return b.token })
      .finally(() => { inflight = null })
  }
  return inflight
}

function needsCsrf(method: string, pathname: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false
  return !CSRF_EXEMPT_PREFIXES.some((p) => pathname.includes(p))
}

/**
 * Configure the shared SDK client for the authed officer app:
 *  - send the session cookie on every request (credentials:'include')
 *  - mirror the CSRF cookie token into the x-csrf-token header on mutating,
 *    non-allowlisted requests (engine double-submit, csrf-token.ts).
 * On a 403 we clear the cached token so the next attempt refetches it.
 * ponytail: clear-on-403, no auto-retry — token is long-lived; a single re-tap
 *           recovers the rare mid-session expiry. Add retry only if it bites.
 */
export function configureApiClient(baseUrl = `${window.location.origin}/api`): void {
  client.setConfig({ baseUrl, credentials: 'include' })

  client.interceptors.request.use(async (request: Request) => {
    const { pathname } = new URL(request.url)
    // Org-scoped read endpoints (dues-*) gate on the x-org-id header (org-context.ts).
    // Inject the selected org by default so callers don't each thread it.
    const orgId = localStorage.getItem('org.selectedOrgId')
    if (orgId && !request.headers.has('x-org-id')) request.headers.set('x-org-id', orgId)
    if (needsCsrf(request.method, pathname)) {
      request.headers.set('x-csrf-token', await getCsrfToken(baseUrl))
    }
    return request
  })

  client.interceptors.response.use((response: Response) => {
    if (response.status === 403) csrfToken = null
    return response
  })
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd apps/org && bun run test src/lib/api.test.ts`
Expected: PASS (4 tests). If `client.interceptors.response.use` does not exist in this generated client version, drop the response interceptor and the clear-on-403 line (keep clear-on-403 out of scope) — verify the available interceptor surface first with `grep -n "interceptors" node_modules/@monobase/sdk-ts/src/generated/client/client.gen.ts` or the source at `packages/sdk-ts/src/generated/client/client.gen.ts`.

- [ ] **Step 5: Wire it in `main.tsx`.** Replace the bare `client.setConfig({ baseUrl: ... })` line with:

```tsx
import { configureApiClient } from './lib/api'
configureApiClient(import.meta.env.VITE_API_URL ?? `${window.location.origin}/api`)
```

Remove the now-redundant direct `client.setConfig` import/call.

- [ ] **Step 6: Typecheck + commit.**

Run: `cd apps/org && bun run typecheck`
```bash
git add apps/org/src/lib/api.ts apps/org/src/lib/api.test.ts apps/org/src/main.tsx
git commit -m "feat(org): CSRF-aware authed SDK client (credentials + x-csrf-token)"
```

---

### Task 3: Session probe + sign-in

**Files:**
- Create: `apps/org/src/features/auth/use-session.ts`, `apps/org/src/features/auth/sign-in.ts`, `apps/org/src/routes/sign-in.tsx`
- Modify: `apps/org/src/routes/__root.tsx` (redirect guard)
- Test: `apps/org/src/features/auth/use-session.test.tsx`, `apps/org/src/features/auth/sign-in.test.ts`

**Interfaces:**
- Consumes: `getMyMemberships` from `@monobase/sdk-ts/generated`; the configured `client`.
- Produces:
  - `useSession(): { status: 'loading' | 'authed' | 'unauthed' }` — probes `getMyMemberships`; 401/transport-undefined → `unauthed`.
  - `signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }>` — raw fetch POST `/auth/sign-in/email`.

- [ ] **Step 1: Write the failing test for `signIn`.** `apps/org/src/features/auth/sign-in.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { signIn } from './sign-in'

afterEach(() => vi.unstubAllGlobals())

describe('signIn', () => {
  it('posts credentials and returns ok on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await signIn('a@b.com', 'pw', 'http://localhost/api')
    expect(res).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/api/auth/sign-in/email',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'pw' }),
      }),
    )
  })

  it('returns an error on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid email or password' }), { status: 401 })))
    const res = await signIn('a@b.com', 'bad', 'http://localhost/api')
    expect(res).toEqual({ ok: false, error: 'Invalid email or password' })
  })
})
```

- [ ] **Step 2: Run to verify it fails.**

Run: `cd apps/org && bun run test src/features/auth/sign-in.test.ts`
Expected: FAIL — no `signIn`.

- [ ] **Step 3: Implement `sign-in.ts`.**

```ts
// Sign-in goes straight to better-auth's catch-all (CSRF-allowlisted, sets the
// httpOnly session cookie). Not an SDK fn — better-auth routes aren't in the
// generated OpenAPI client.
export async function signIn(
  email: string,
  password: string,
  baseUrl = `${window.location.origin}/api`,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${baseUrl}/auth/sign-in/email`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (res.ok) return { ok: true }
  const body = await res.json().catch(() => ({}))
  return { ok: false, error: (body as { message?: string }).message ?? 'Sign-in failed' }
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `cd apps/org && bun run test src/features/auth/sign-in.test.ts`
Expected: PASS (2).

- [ ] **Step 5: Write the failing test for `useSession`.** `apps/org/src/features/auth/use-session.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ getMyMemberships: vi.fn() }))
import { getMyMemberships } from '@monobase/sdk-ts/generated'
import { useSession } from './use-session'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSession', () => {
  it('authed when memberships resolve', async () => {
    (getMyMemberships as any).mockResolvedValue({ data: { data: [], total: 0 }, response: new Response('', { status: 200 }) } as any)
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('authed'))
  })

  it('unauthed on 401', async () => {
    (getMyMemberships as any).mockResolvedValue({ data: undefined, response: new Response('', { status: 401 }) } as any)
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('unauthed'))
  })
})
```

- [ ] **Step 6: Run to verify it fails.** Run: `cd apps/org && bun run test src/features/auth/use-session.test.tsx` → FAIL (no `useSession`).

- [ ] **Step 7: Implement `use-session.ts`.**

```ts
import { useQuery } from '@tanstack/react-query'
import { getMyMemberships } from '@monobase/sdk-ts/generated'

export type SessionStatus = 'loading' | 'authed' | 'unauthed'

// /persons/me/memberships doubles as the auth probe: a 401 (or transport-undef)
// means no session. Officer-term gating happens later, per selected org.
export function useSession(): { status: SessionStatus } {
  const q = useQuery({
    queryKey: ['session'],
    retry: false,
    queryFn: async () => {
      const { data, response } = await getMyMemberships()
      if (response.status === 401) return { authed: false as const }
      if (!data) throw new Error('session probe failed')
      return { authed: true as const, memberships: data.data }
    },
  })
  if (q.isLoading) return { status: 'loading' }
  if (q.data?.authed) return { status: 'authed' }
  return { status: 'unauthed' }
}
```

- [ ] **Step 8: Run to verify it passes.** Expected: PASS (2).

- [ ] **Step 9: Sign-in route `apps/org/src/routes/sign-in.tsx`.** A single-task screen: email + password inputs (`type="email"`, `type="password"`, labeled), one primary `Sign in` button (`min-h-tap`), `role="alert"` error region. On submit call `signIn`; on `ok` invalidate the `['session']` query and `navigate({ to: '/' })`; on failure set the error string. Use `@monobase/ui` `Button`, `Card`, and native labeled `<input>`s styled with tokens. Disable the button while submitting (double-submit guard). Example handler:

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Card } from '@monobase/ui'
import { signIn } from '@/features/auth/sign-in'

export const Route = createFileRoute('/sign-in')({ component: SignInPage })

function SignInPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    const res = await signIn(email, password)
    setBusy(false)
    if (res.ok) { await qc.invalidateQueries({ queryKey: ['session'] }); navigate({ to: '/' }) }
    else setError(res.error)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <h1 className="text-section font-semibold text-foreground">Officer sign in</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-body">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-tap rounded-md border px-3 text-body" />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-body">Password</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-tap rounded-md border px-3 text-body" />
          </div>
          {error && <p role="alert" className="text-body text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full min-h-tap">{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
      </Card>
    </div>
  )
}
```

(Verify `Button`/`Card` are exported from `@monobase/ui`; if class names differ, match existing usage in `apps/member`.)

- [ ] **Step 10: Add the redirect guard in `__root.tsx`.** The root renders a gate: while `useSession()` is loading, show a full-screen `role="status"` spinner; if `unauthed` and the current route is not `/sign-in`, redirect to `/sign-in`; otherwise render `<Outlet/>`. Keep the sign-in route reachable when unauthed.

```tsx
import { createRootRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useSession } from '@/features/auth/use-session'

export const Route = createRootRoute({ component: RootGate })

function RootGate() {
  const { status } = useSession()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (status === 'unauthed' && pathname !== '/sign-in') navigate({ to: '/sign-in' })
  }, [status, pathname, navigate])

  // Only render the route tree when authed, or when on the public sign-in page.
  // Otherwise show the spinner — never render a protected route (and fire its
  // 401/403 queries) for an unauthed user even for a single frame before the
  // redirect effect lands.
  if (status === 'authed' || pathname === '/sign-in') return <Outlet />
  return <div role="status" aria-label="Loading" className="min-h-screen flex items-center justify-center">…</div>
}
```

- [ ] **Step 11: Build (regenerate routeTree), typecheck, run full app tests.**

Run: `cd apps/org && bun run build && bun run typecheck && bun run test`
Expected: build green (routeTree includes `/sign-in`), typecheck 0, all tests pass.

- [ ] **Step 12: Commit** (include regenerated routeTree).

```bash
git add apps/org/src apps/org/src/routeTree.gen.ts
git commit -m "feat(org): officer sign-in + session probe + route guard"
```

---

### Task 4: Org context (memberships → picker + officer gate)

**Files:**
- Create: `apps/org/src/features/org/use-org.ts`, `apps/org/src/features/org/OrgPicker.tsx`
- Test: `apps/org/src/features/org/use-org.test.tsx`

**Interfaces:**
- Consumes: `getMyMemberships`, `getMyOfficerRole` from `@monobase/sdk-ts/generated`.
- Produces:
  - `useOrgs(): { status: 'loading'|'ready'|'empty'; orgs: { id: string; name: string }[] }` — distinct orgs from memberships (dedupe by `organizationId`, name from `orgName`).
  - `useSelectedOrg(): { orgId: string | null; setOrgId(id: string): void }` — selection persisted in `localStorage['org.selectedOrgId']`; auto-selects when exactly one org.
  - `useIsOfficer(orgId: string | null): { status: 'loading'|'officer'|'notOfficer' }` — calls `getMyOfficerRole({ path: { orgId } })`; non-empty terms → officer.

- [ ] **Step 1: Write failing test.** `apps/org/src/features/org/use-org.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ getMyMemberships: vi.fn(), getMyOfficerRole: vi.fn() }))
import { getMyMemberships, getMyOfficerRole } from '@monobase/sdk-ts/generated'
import { useOrgs, useSelectedOrg, useIsOfficer } from './use-org'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => localStorage.clear())

describe('useOrgs', () => {
  it('dedupes memberships into distinct orgs', async () => {
    (getMyMemberships as any).mockResolvedValue({
      data: { data: [
        { organizationId: 'o1', orgName: 'Chapter A' },
        { organizationId: 'o1', orgName: 'Chapter A' },
        { organizationId: 'o2', orgName: 'Chapter B' },
      ], total: 3 }, response: new Response('', { status: 200 }),
    } as any)
    const { result } = renderHook(() => useOrgs(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.orgs).toEqual([{ id: 'o1', name: 'Chapter A' }, { id: 'o2', name: 'Chapter B' }])
  })

  it('empty when no memberships', async () => {
    (getMyMemberships as any).mockResolvedValue({ data: { data: [], total: 0 }, response: new Response('', { status: 200 }) } as any)
    const { result } = renderHook(() => useOrgs(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('empty'))
  })
})

describe('useSelectedOrg', () => {
  it('auto-selects the only org', async () => {
    (getMyMemberships as any).mockResolvedValue({ data: { data: [{ organizationId: 'o1', orgName: 'A' }], total: 1 }, response: new Response('', { status: 200 }) } as any)
    const { result } = renderHook(() => useSelectedOrg(), { wrapper })
    await waitFor(() => expect(result.current.orgId).toBe('o1'))
  })

  it('persists an explicit selection', async () => {
    (getMyMemberships as any).mockResolvedValue({ data: { data: [{ organizationId: 'o1', orgName: 'A' }, { organizationId: 'o2', orgName: 'B' }], total: 2 }, response: new Response('', { status: 200 }) } as any)
    const { result } = renderHook(() => useSelectedOrg(), { wrapper })
    await waitFor(() => expect(result.current.orgId).toBeNull()) // >1 org, no auto-select
    act(() => result.current.setOrgId('o2'))
    expect(result.current.orgId).toBe('o2')
    expect(localStorage.getItem('org.selectedOrgId')).toBe('o2')
  })
})

describe('useIsOfficer', () => {
  it('officer when isOfficer true', async () => {
    ;(getMyOfficerRole as any).mockResolvedValue({ data: { data: { isOfficer: true, positions: [] } }, response: new Response('', { status: 200 }) })
    const { result } = renderHook(() => useIsOfficer('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('officer'))
  })
  it('notOfficer when isOfficer false', async () => {
    ;(getMyOfficerRole as any).mockResolvedValue({ data: { data: { isOfficer: false, positions: [] } }, response: new Response('', { status: 200 }) })
    const { result } = renderHook(() => useIsOfficer('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('notOfficer'))
  })
})
```

(Note: where any `(fn as any).mockResolvedValue(` line is the first statement in a block, the leading `(` is safe; in this file the lines that needed a leading semicolon already have one — keep ASI-safe.)

- [ ] **Step 2: Run to verify it fails.** Run: `cd apps/org && bun run test src/features/org/use-org.test.tsx` → FAIL.

- [ ] **Step 3: Implement `use-org.ts`.**

```ts
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getMyMemberships, getMyOfficerRole } from '@monobase/sdk-ts/generated'

const STORAGE_KEY = 'org.selectedOrgId'

type Org = { id: string; name: string }

function useMembershipOrgs() {
  return useQuery({
    queryKey: ['org', 'memberships'],
    retry: false,
    queryFn: async () => {
      const { data } = await getMyMemberships()
      if (!data) throw new Error('memberships failed')
      const seen = new Map<string, Org>()
      for (const m of data.data as Array<{ organizationId: string; orgName: string }>) {
        if (!seen.has(m.organizationId)) seen.set(m.organizationId, { id: m.organizationId, name: m.orgName })
      }
      return [...seen.values()]
    },
  })
}

export function useOrgs(): { status: 'loading' | 'ready' | 'empty'; orgs: Org[] } {
  const q = useMembershipOrgs()
  if (q.isLoading) return { status: 'loading', orgs: [] }
  const orgs = q.data ?? []
  return { status: orgs.length === 0 ? 'empty' : 'ready', orgs }
}

export function useSelectedOrg(): { orgId: string | null; setOrgId: (id: string) => void } {
  const { orgs } = useOrgs()
  const [orgId, setOrgIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))

  // Auto-select when there's exactly one org and nothing chosen yet.
  useEffect(() => {
    if (!orgId && orgs.length === 1) {
      setOrgIdState(orgs[0].id)
      localStorage.setItem(STORAGE_KEY, orgs[0].id)
    }
  }, [orgId, orgs])

  const setOrgId = (id: string) => { localStorage.setItem(STORAGE_KEY, id); setOrgIdState(id) }
  return { orgId, setOrgId }
}

export function useIsOfficer(orgId: string | null): { status: 'loading' | 'officer' | 'notOfficer' } {
  const q = useQuery({
    queryKey: ['org', 'officer-role', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      // VERIFIED: path key is `organizationId`, url /persons/me/officer-role/{organizationId}.
      const { data } = await getMyOfficerRole({ path: { organizationId: orgId! } })
      if (!data) throw new Error('officer-role failed')
      return data
    },
  })
  if (!orgId || q.isLoading) return { status: 'loading' }
  // VERIFIED: OfficerRoleResponse = { data: { isOfficer: boolean; positions: [] } }.
  // Read the boolean directly — `q.data.data` is always a non-null object, so a
  // truthiness/array check would make the gate a no-op (always "officer").
  const isOfficer = q.data?.data?.isOfficer === true
  return { status: isOfficer ? 'officer' : 'notOfficer' }
}
```

- [ ] **Step 4: Run to verify it passes.** Expected: PASS (4).

- [ ] **Step 5: `OrgPicker.tsx`** — a labeled `<select>` (or `@monobase/ui` select if present) listing `orgs`, value = selected, onChange = `setOrgId`. Only rendered by the roster when `orgs.length > 1`. Labeled, `min-h-tap`. No test required (thin presentational; covered by roster test).

- [ ] **Step 6: Typecheck + commit.**

```bash
cd apps/org && bun run typecheck
git add apps/org/src/features/org
git commit -m "feat(org): org context — membership orgs, selection, officer gate"
```

---

### Task 5: Roster screen

**Files:**
- Create: `apps/org/src/features/roster/use-roster.ts`, `apps/org/src/features/roster/Roster.tsx`
- Modify: `apps/org/src/routes/index.tsx` (render Roster)
- Test: `apps/org/src/features/roster/use-roster.test.tsx`, `apps/org/src/features/roster/Roster.test.tsx`

**Interfaces:**
- Consumes: `listOrgMembers` from `@monobase/sdk-ts/generated`; `useSelectedOrg`, `useOrgs`, `useIsOfficer` (Task 4).
- Produces: `useRoster(orgId: string | null): { status; members: RosterMember[] }` where `RosterMember = { membershipId: string; personId: string; name: string; memberNumber?: string; status: string }`.

- [ ] **Step 1: Write failing test for `useRoster`.** `apps/org/src/features/roster/use-roster.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ listOrgMembers: vi.fn() }))
import { listOrgMembers } from '@monobase/sdk-ts/generated'
import { useRoster } from './use-roster'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useRoster', () => {
  it('maps members with composed name', async () => {
    ;(listOrgMembers as any).mockResolvedValue({
      data: { data: [{ id: 'm1', personId: 'p1', firstName: 'Olive', lastName: 'Cruz', status: 'active', memberNumber: 'A-1' }] },
      response: new Response('', { status: 200 }),
    } as any)
    const { result } = renderHook(() => useRoster('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.members).toEqual([{ membershipId: 'm1', personId: 'p1', name: 'Olive Cruz', memberNumber: 'A-1', status: 'active' }])
  })

  it('idle when no org selected', () => {
    const { result } = renderHook(() => useRoster(null), { wrapper })
    expect(result.current.status).toBe('idle')
  })
})
```

- [ ] **Step 2: Run → FAIL.** `cd apps/org && bun run test src/features/roster/use-roster.test.tsx`

- [ ] **Step 3: Implement `use-roster.ts`.**

```ts
import { useQuery } from '@tanstack/react-query'
import { listOrgMembers } from '@monobase/sdk-ts/generated'

export type RosterMember = { membershipId: string; personId: string; name: string; memberNumber?: string; status: string }

export function useRoster(orgId: string | null): { status: 'idle' | 'loading' | 'ready' | 'empty'; members: RosterMember[] } {
  const q = useQuery({
    queryKey: ['roster', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data } = await listOrgMembers({ path: { organizationId: orgId! } })
      if (!data) throw new Error('roster failed')
      return (data.data as Array<{ id: string; personId: string; firstName?: string | null; lastName?: string | null; status: string; memberNumber?: string }>).map((m) => ({
        membershipId: m.id,
        personId: m.personId,
        name: [m.firstName, m.lastName].filter(Boolean).join(' ') || '(no name)',
        memberNumber: m.memberNumber,
        status: m.status,
      }))
    },
  })
  if (!orgId) return { status: 'idle', members: [] }
  if (q.isLoading) return { status: 'loading', members: [] }
  const members = q.data ?? []
  return { status: members.length === 0 ? 'empty' : 'ready', members }
}
```

Verify `listOrgMembers` param is `{ path: { organizationId } }` against `sdk.gen.ts`.

- [ ] **Step 4: Run → PASS (2).**

- [ ] **Step 5: Write failing test for `Roster.tsx`.** `apps/org/src/features/roster/Roster.test.tsx` — render with mocked hooks (mock `./use-roster`, `../org/use-org`) and assert: org name header shows; each member row shows name + `StatusBadge`; a "Send pay-link" link per member points at `/members/$membershipId/send`; empty state when no members; "not an officer" message when `useIsOfficer` → notOfficer. Use RTL `render` inside a `createMemoryRouter`/`RouterProvider` OR (simpler) extract a presentational `RosterView({ orgName, members, isOfficer })` that takes props and test that directly (no router needed). Prefer the presentational-split approach:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RosterView } from './Roster'

describe('RosterView', () => {
  const members = [{ membershipId: 'm1', personId: 'p1', name: 'Olive Cruz', memberNumber: 'A-1', status: 'active' }]
  it('lists members with a send link', () => {
    render(<RosterView orgName="Chapter A" members={members} isOfficer />)
    expect(screen.getByText('Chapter A')).toBeInTheDocument()
    expect(screen.getByText('Olive Cruz')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /send pay-link/i })).toHaveAttribute('href', expect.stringContaining('m1'))
  })
  it('shows not-officer message', () => {
    render(<RosterView orgName="Chapter A" members={[]} isOfficer={false} />)
    expect(screen.getByText(/not an officer/i)).toBeInTheDocument()
  })
  it('shows empty state', () => {
    render(<RosterView orgName="Chapter A" members={[]} isOfficer />)
    expect(screen.getByText(/no members yet/i)).toBeInTheDocument()
  })
})
```

NOTE: the `<Link>` from TanStack Router renders an `<a href>`; if testing `RosterView` in isolation without a router, replace the `<Link>` with a plain `<a href={...}>` inside RosterView OR wrap the test render in a minimal router. Simplest: RosterView takes a `linkFor(membershipId): string` and renders `<a>`; the route container wires `linkFor` to `/members/${id}/send`. Keep tests router-free.

- [ ] **Step 6: Run → FAIL.**

- [ ] **Step 7: Implement `Roster.tsx`** — exports `RosterView` (presentational, props `{ orgName, members, isOfficer, linkFor? }`) and a default container `Roster` that wires `useOrgs`/`useSelectedOrg`/`useIsOfficer`/`useRoster` + `OrgPicker` (when >1 org) and passes `linkFor={(id) => '/members/' + id + '/send'}`. Use `@monobase/ui` `StatusBadge` for member status, `EmptyState` for empty/not-officer. Each row: name, member number, status badge, and a TanStack `<Link to="/members/$membershipId/send" params={{ membershipId }}>` styled as a `min-h-tap` button labeled "Send pay-link". Mobile-first single column.

- [ ] **Step 8: Wire `index.tsx`** to render `<Roster />` (replace placeholder). Keep `createFileRoute('/')`.

- [ ] **Step 9: Build + typecheck + test.**

Run: `cd apps/org && bun run build && bun run typecheck && bun run test`
Expected: all green; routeTree unchanged (no new route files yet — `/members/$membershipId/send` is added in Task 6).

- [ ] **Step 10: Commit.**

```bash
git add apps/org/src
git commit -m "feat(org): roster screen — list members + send-link entry"
```

---

### Task 6: Send pay-link screen (+ shared money util + revoke)

**Files:**
- Create: `packages/ui/src/money.ts` (shared `centavosToPhp`) + export from `packages/ui` index
- Create: `apps/org/src/features/paylink/use-send-link.ts`, `apps/org/src/features/paylink/SendLink.tsx`, `apps/org/src/routes/members/$membershipId/send.tsx`
- Test: `apps/org/src/features/paylink/money.test.ts` (tests the shared util via `@monobase/ui`), `apps/org/src/features/paylink/use-send-link.test.tsx`, `apps/org/src/features/paylink/SendLink.test.tsx`

**Interfaces:**
- Consumes: `sendPaymentLink`, `revokePaymentLink`, `listDuesInvoices` from `@monobase/sdk-ts/generated`; `centavosToPhp` from `@monobase/ui`.
- Produces:
  - `centavosToPhp(amount: number): string` in `@monobase/ui` (e.g. `250000 → '₱2,500.00'`).
  - `useSendLink(orgId, personId)`: `{ mint(args: { amount: number; invoiceId?: string }): void; revoke(): void; state: SendState }` where
    `SendState = { kind: 'idle' } | { kind: 'minting' } | { kind: 'sent'; url: string; tokenId: string; expiresAt: string } | { kind: 'error'; message: string } | { kind: 'revoked' }`.

- [ ] **Step 1: Shared money util — write failing test IN apps/org** (NOT in packages/ui — that package has no test runner and no CI test job, so a test there is never executed = false coverage; and a `*.test.ts` under `packages/ui/src` would be compiled by the ui `tsc --noEmit` job and need a vitest devDep just to typecheck). Put it where the `org` CI job runs it: `apps/org/src/features/paylink/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { centavosToPhp } from '@monobase/ui'

describe('centavosToPhp', () => {
  it('formats centavos as PHP', () => {
    expect(centavosToPhp(250000)).toBe('₱2,500.00')
    expect(centavosToPhp(0)).toBe('₱0.00')
    expect(centavosToPhp(99)).toBe('₱0.99')
  })
})
```

- [ ] **Step 2: Run → FAIL.** Run: `cd apps/org && bun run test src/features/paylink/money.test.ts` (FAIL — `centavosToPhp` not yet exported from `@monobase/ui`).

- [ ] **Step 3: Implement `packages/ui/src/money.ts`** (lifted from `apps/member/src/features/pay/money.ts`):

```ts
export function centavosToPhp(amount: number): string {
  return '₱' + (amount / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
```

Export it from `packages/ui`'s entry (add `export * from './money'` or `export { centavosToPhp } from './money'` to `packages/ui/src/index.ts` — match the existing export style). `// ponytail: apps/member keeps its own 1-line copy; not worth churning a shipped app.`

- [ ] **Step 4: Run → PASS.** Then verify the export resolves: `cd apps/org && bun run typecheck` after writing a throwaway import, or rely on Task 6 consumers.

- [ ] **Step 5: Write failing test for `useSendLink`.** `apps/org/src/features/paylink/use-send-link.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ sendPaymentLink: vi.fn(), revokePaymentLink: vi.fn() }))
import { sendPaymentLink, revokePaymentLink } from '@monobase/sdk-ts/generated'
import { useSendLink } from './use-send-link'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSendLink', () => {
  it('mint success → sent state, with amount coerced to bigint at the request boundary', async () => {
    ;(sendPaymentLink as any).mockResolvedValue({
      data: { token: 'TOK', paymentUrl: '/pay/TOK', expiresAt: '2026-09-01T00:00:00Z' },
      response: new Response('', { status: 201 }),
    })
    const { result } = renderHook(() => useSendLink('o1', 'p1'), { wrapper })
    act(() => result.current.mint({ amount: 250000, invoiceId: 'inv1' }))
    await waitFor(() => expect(result.current.state.kind).toBe('sent'))
    const s = result.current.state as Extract<typeof result.current.state, { kind: 'sent' }>
    expect(s.tokenId).toBe('TOK')
    expect(s.url).toMatch(/\/pay\/TOK$/)
    // amount MUST be bigint (SendPaymentLinkRequest.amount is bigint?) — a number would not typecheck.
    expect(sendPaymentLink).toHaveBeenCalledWith(expect.objectContaining({
      path: { organizationId: 'o1' },
      body: { personId: 'p1', amount: 250000n, invoiceId: 'inv1' },
    }))
  })

  it('mint 400 → error state', async () => {
    ;(sendPaymentLink as any).mockResolvedValue({ data: undefined, response: new Response(JSON.stringify({ error: 'Gateway not configured' }), { status: 400 }) })
    const { result } = renderHook(() => useSendLink('o1', 'p1'), { wrapper })
    act(() => result.current.mint({ amount: 1000 }))
    await waitFor(() => expect(result.current.state.kind).toBe('error'))
  })

  it('double-mint is guarded (one call while pending)', async () => {
    let resolve!: (v: unknown) => void
    ;(sendPaymentLink as any).mockReturnValue(new Promise((r) => { resolve = r }))
    const { result } = renderHook(() => useSendLink('o1', 'p1'), { wrapper })
    act(() => { result.current.mint({ amount: 1000 }); result.current.mint({ amount: 1000 }) })
    await waitFor(() => expect(result.current.state.kind).toBe('minting'))
    expect(sendPaymentLink).toHaveBeenCalledTimes(1)
    resolve({ data: { token: 'T', paymentUrl: '/pay/T', expiresAt: 'x' }, response: new Response('', { status: 201 }) })
  })

  it('revoke success → revoked state', async () => {
    ;(sendPaymentLink as any).mockResolvedValue({ data: { token: 'T', paymentUrl: '/pay/T', expiresAt: 'x' }, response: new Response('', { status: 201 }) })
    ;(revokePaymentLink as any).mockResolvedValue({ data: { revoked: true }, response: new Response('', { status: 200 }) })
    const { result } = renderHook(() => useSendLink('o1', 'p1'), { wrapper })
    act(() => result.current.mint({ amount: 1000 }))
    await waitFor(() => expect(result.current.state.kind).toBe('sent'))
    act(() => result.current.revoke())
    await waitFor(() => expect(result.current.state.kind).toBe('revoked'))
    expect(revokePaymentLink).toHaveBeenCalledWith(expect.objectContaining({ path: { organizationId: 'o1', tokenId: 'T' } }))
  })
})
```

- [ ] **Step 6: Run → FAIL.**

- [ ] **Step 7: Implement `use-send-link.ts`.**

```ts
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { sendPaymentLink, revokePaymentLink } from '@monobase/sdk-ts/generated'

export type SendState =
  | { kind: 'idle' }
  | { kind: 'minting' }
  | { kind: 'sent'; url: string; tokenId: string; expiresAt: string }
  | { kind: 'error'; message: string }
  | { kind: 'revoked' }

export function useSendLink(orgId: string, personId: string): {
  state: SendState
  mint: (args: { amount: number; invoiceId?: string }) => void
  revoke: () => void
} {
  const [tokenId, setTokenId] = useState<string | null>(null)

  const mintM = useMutation<SendState, Error, { amount: number; invoiceId?: string }>({
    mutationFn: async ({ amount, invoiceId }) => {
      const { data, response } = await sendPaymentLink({
        path: { organizationId: orgId },
        // SendPaymentLinkRequest.amount is typed `bigint?` — coerce at the SDK seam.
        body: { personId, amount: BigInt(amount), ...(invoiceId ? { invoiceId } : {}) },
      })
      if (response.status === 201 && data) {
        return { kind: 'sent', url: `${window.location.origin}${data.paymentUrl}`, tokenId: data.token, expiresAt: data.expiresAt }
      }
      const msg = typeof (data as any)?.error === 'string' ? (data as any).error
        : response.status === 403 ? 'You are not an officer of this organization.'
        : 'Could not create the pay-link.'
      throw new Error(msg)
    },
    onSuccess: (s) => { if (s.kind === 'sent') setTokenId(s.tokenId) },
  })

  const revokeM = useMutation<SendState, Error>({
    mutationFn: async () => {
      const { data, response } = await revokePaymentLink({ path: { organizationId: orgId, tokenId: tokenId! } })
      // 404 = already used/revoked → treat as revoked (idempotent UX).
      if (response.status === 200 || response.status === 404) return { kind: 'revoked' }
      throw new Error((data as any)?.error ?? 'Could not revoke the link.')
    },
  })

  let state: SendState = { kind: 'idle' }
  if (revokeM.isSuccess) state = { kind: 'revoked' }
  else if (mintM.isPending) state = { kind: 'minting' }
  else if (mintM.isError) state = { kind: 'error', message: mintM.error.message }
  else if (mintM.isSuccess) state = mintM.data

  return {
    state,
    mint: (args) => { if (mintM.isPending) return; mintM.mutate(args) },
    revoke: () => { if (!tokenId || revokeM.isPending) return; revokeM.mutate() },
  }
}
```

Verify `sendPaymentLink`/`revokePaymentLink` param shapes against `sdk.gen.ts` (path keys `organizationId`/`tokenId`, body keys). Adjust if the generated names differ.

- [ ] **Step 8: Run → PASS (4).**

- [ ] **Step 9: Write failing test for `SendLink.tsx` (presentational split).** Test a `SendLinkView` that takes props: member name, outstanding invoices `{ id; amount; status }[]`, a custom-amount form, and a `state`. Assert: outstanding invoices render with `centavosToPhp` amounts + a "Send link" button each; custom-amount input rejects ≤0 (button disabled); on `state.kind==='sent'` the URL text, a Copy button, an `sms:` link, expiry, and a Revoke button appear; on `error` a `role="alert"` shows. Keep router-free (presentational props + callbacks).

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SendLinkView } from './SendLink'

const invoices = [{ id: 'inv1', amount: 250000, status: 'sent' }]

it('renders outstanding invoices with peso amounts and a send action', async () => {
  const onSendInvoice = vi.fn()
  render(<SendLinkView memberName="Olive Cruz" invoices={invoices} state={{ kind: 'idle' }} onSendInvoice={onSendInvoice} onSendCustom={vi.fn()} onRevoke={vi.fn()} />)
  expect(screen.getByText('₱2,500.00')).toBeInTheDocument()
  await userEvent.click(screen.getAllByRole('button', { name: /send link/i })[0])
  expect(onSendInvoice).toHaveBeenCalledWith('inv1', 250000)
})

it('shows the link + copy + revoke when sent', () => {
  render(<SendLinkView memberName="Olive Cruz" invoices={[]} state={{ kind: 'sent', url: 'http://x/pay/TOK', tokenId: 'TOK', expiresAt: '2026-09-01T00:00:00Z' }} onSendInvoice={vi.fn()} onSendCustom={vi.fn()} onRevoke={vi.fn()} />)
  expect(screen.getByText('http://x/pay/TOK')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument()
})
```

- [ ] **Step 10: Run → FAIL.**

- [ ] **Step 11: Implement `SendLink.tsx`** — `SendLinkView` (presentational) + `SendLink` container. Container reads `Route.useParams().membershipId`, resolves `personId` + member name + outstanding invoices via `listDuesInvoices({ query: { membershipId, status } })` (call once per relevant status or fetch all and filter to generated/sent/overdue; coerce `Number(amount)`), and `useSelectedOrg().orgId`; wires `useSendLink`. Copy button uses `navigator.clipboard.writeText(url)` + `toast.success('Link copied')` (sonner). `sms:` link: `<a href={\`sms:?body=\${encodeURIComponent(url)}\`}>Share via SMS</a>`. Custom-amount: a peso input (parse to centavos = `Math.round(value*100)`, reject ≤0). All `min-h-tap`, labeled, error `role="alert"`. Use `@monobase/ui` `Button`/`Card`/`StatusBadge`/`ErrorState`.

NOTE: to get `personId` + member name in the container, either pass them via router search/state from the Roster row, or refetch roster and find by `membershipId`. Simplest + robust: the Roster `<Link>` passes `personId` and `name` via `search`; the send route declares a `validateSearch` reading them. Fallback: re-query roster. Pick the search-param approach to avoid a second roster fetch.

- [ ] **Step 12: Create the route `apps/org/src/routes/members/$membershipId/send.tsx`** — `createFileRoute('/members/$membershipId/send')` with `validateSearch` for `{ personId?: string; name?: string }`, component renders `<SendLink />`. (Update the Roster `<Link>` in Task 5's file to pass `search={{ personId, name }}` — do this edit here.)

- [ ] **Step 13: Build (regen routeTree) + typecheck + full test.**

Run: `cd apps/org && bun run build && bun run typecheck && bun run test`
Expected: green; routeTree now includes `/members/$membershipId/send`.

- [ ] **Step 14: Commit** (include packages/ui money util + regenerated routeTree).

```bash
git add packages/ui/src apps/org/src apps/org/src/routeTree.gen.ts
git commit -m "feat(org): send pay-link screen + shared centavosToPhp + revoke"
```

---

### Task 7: Dues / who-paid view

**Files:**
- Create: `apps/org/src/features/dues/use-dues.ts`, `apps/org/src/features/dues/DuesView.tsx`, `apps/org/src/routes/dues.tsx`
- Modify: roster/root nav to link to `/dues`
- Test: `apps/org/src/features/dues/use-dues.test.tsx`, `apps/org/src/features/dues/DuesView.test.tsx`

**Interfaces:**
- Consumes: `getDuesDashboard`, `listDuesPayments`, `listDuesInvoices` from `@monobase/sdk-ts/generated`; `centavosToPhp` from `@monobase/ui`.
- Produces: `useDuesDashboard(orgId)`, `useRecentPayments(orgId)`, `useOutstandingInvoices(orgId)` query hooks returning typed, `Number`-coerced data.

- [ ] **Step 1: Write failing test for `useDuesDashboard`.** `apps/org/src/features/dues/use-dues.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ getDuesDashboard: vi.fn(), listDuesPayments: vi.fn(), listDuesInvoices: vi.fn() }))
import { getDuesDashboard } from '@monobase/sdk-ts/generated'
import { useDuesDashboard } from './use-dues'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

it('coerces bigint money fields to number', async () => {
  ;(getDuesDashboard as any).mockResolvedValue({
    data: { data: { totalCollected: 250000n, totalOutstanding: 500000n, paidCount: 1, unpaidCount: 2, overdueCount: 0, collectionRate: 33, memberCount: 3 } },
    response: new Response('', { status: 200 }),
  } as any)
  const { result } = renderHook(() => useDuesDashboard('o1'), { wrapper })
  await waitFor(() => expect(result.current.data).toBeTruthy())
  expect(result.current.data!.totalCollected).toBe(250000)
  expect(typeof result.current.data!.totalCollected).toBe('number')
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `use-dues.ts`.**

```ts
import { useQuery } from '@tanstack/react-query'
import { getDuesDashboard, listDuesPayments, listDuesInvoices } from '@monobase/sdk-ts/generated'

export type DuesStats = { totalCollected: number; totalOutstanding: number; paidCount: number; unpaidCount: number; overdueCount: number; collectionRate: number; memberCount: number }

export function useDuesDashboard(orgId: string | null): { data?: DuesStats; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['dues', 'dashboard', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data } = await getDuesDashboard({ path: { organizationId: orgId! } })
      if (!data) throw new Error('dashboard failed')
      const d = (data as any).data ?? data
      return {
        totalCollected: Number(d.totalCollected), totalOutstanding: Number(d.totalOutstanding),
        paidCount: Number(d.paidCount), unpaidCount: Number(d.unpaidCount), overdueCount: Number(d.overdueCount),
        collectionRate: Number(d.collectionRate), memberCount: Number(d.memberCount),
      } as DuesStats
    },
  })
  return { data: q.data, isLoading: q.isLoading }
}

export function useRecentPayments(orgId: string | null) {
  return useQuery({
    queryKey: ['dues', 'payments', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data } = await listDuesPayments({ query: { pageSize: 20 } })
      if (!data) throw new Error('payments failed')
      return (data.data as any[]).map((p) => ({ ...p, amount: Number(p.amount) }))
    },
  })
}

export function useOutstandingInvoices(orgId: string | null) {
  return useQuery({
    queryKey: ['dues', 'outstanding', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data } = await listDuesInvoices({ query: { status: 'sent', limit: 50 } })
      if (!data) throw new Error('invoices failed')
      return (data.data as any[]).map((i) => ({ ...i, amount: Number(i.amount) }))
    },
  })
}
```

**Org scoping (C3 — VERIFIED):** `listDuesPayments`/`listDuesInvoices` gate on the `x-org-id` request header (engine `org-context.ts` reads `x-org-id` header or `orgId` query param — NOT the `organizationId` query key). The Task-2 `configureApiClient` interceptor injects `x-org-id` from `localStorage['org.selectedOrgId']` on every request, so these hooks need no per-call header and work at runtime. `getDuesDashboard` is path-scoped (`{path:{organizationId}}`) and needs no header. (Belt-and-suspenders alternative if the central interceptor is ever removed: pass `headers: { 'x-org-id': orgId! }` explicitly on each call.) Verify the `listDuesPayments`/`listDuesInvoices` query keys + valid `status` enum values against `types.gen.ts` (`DuesInvoiceStatus` includes `'sent'`).

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Write failing test for `DuesView` (presentational).** `DuesView({ stats, payments, invoices })` renders: tiles (Collected `centavosToPhp(totalCollected)`, Collection rate `${collectionRate}%`, Paid/Unpaid/Overdue counts, Members), a recent-payments list with `StatusBadge` + peso amounts, an outstanding-invoices list. Assert peso formatting + rate %.

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DuesView } from './DuesView'

it('renders dashboard tiles with formatted money + rate', () => {
  render(<DuesView
    stats={{ totalCollected: 250000, totalOutstanding: 500000, paidCount: 1, unpaidCount: 2, overdueCount: 0, collectionRate: 33, memberCount: 3 }}
    payments={[{ id: 'pay1', amount: 250000, status: 'completed' }]}
    invoices={[{ id: 'inv1', amount: 500000, status: 'sent', memberName: 'Olive Cruz' }]} />)
  expect(screen.getByText('₱2,500.00')).toBeInTheDocument()
  expect(screen.getByText(/33%/)).toBeInTheDocument()
  expect(screen.getByText('Olive Cruz')).toBeInTheDocument()
})
```

- [ ] **Step 6: Run → FAIL. Step 7: Implement `DuesView.tsx`** (`DuesView` presentational + `Dues` container wiring the hooks + `useSelectedOrg`). Tiles as `@monobase/ui` `Card`s, `.tabular-amount` on peso figures, `StatusBadge` for statuses, `EmptyState` when no payments. Read-only.

- [ ] **Step 8: Route `apps/org/src/routes/dues.tsx`** — `createFileRoute('/dues')` rendering `<Dues />`. Add a nav link to `/dues` from the Roster header (and a link back to `/`). Keep nav minimal (two links).

- [ ] **Step 9: Build + typecheck + test.**

Run: `cd apps/org && bun run build && bun run typecheck && bun run test`
Expected: green; routeTree includes `/dues`.

- [ ] **Step 10: Commit.**

```bash
git add apps/org/src apps/org/src/routeTree.gen.ts
git commit -m "feat(org): dues / who-paid view (dashboard + payments + outstanding)"
```

---

### Task 8: E2E (stubbed) + CI org job + final gate

**Files:**
- Create: `apps/org/src/e2e/officer-flow.spec.ts`
- Modify: `.github/workflows/ci.yml` (add `org` job mirroring `member`; wire into `ci-gate` needs)
- Verify: full local gate

**Interfaces:**
- Consumes: nothing new — drives the built app with `page.route` stubs (no live API/seed), mirroring slice-2a's `apps/member/src/e2e/pay-flow.spec.ts`.

- [ ] **Step 1: Write the E2E spec.** `apps/org/src/e2e/officer-flow.spec.ts` — stub `**/auth/sign-in/email` (200), `**/csrf-token` (`{token:'t'}`), `**/persons/me/memberships` (one org), `**/officer-role/**` (active term), `**/membership/members/**` (one member), `**/org/*/payments/send-link` (201 `{token:'TOK',paymentUrl:'/pay/TOK',expiresAt}`). Flow: visit `/sign-in` → fill + submit → land on roster (member visible) → click "Send pay-link" → enter custom amount (or click an invoice) → assert the result panel shows `/pay/TOK` and a Copy button. Use the member spec as the structural template (`page.route(...).fulfill(...)`, `expect(page.getByText(...))`).

```ts
import { test, expect } from '@playwright/test'

test('officer signs in, sends a pay-link', async ({ page }) => {
  await page.route('**/csrf-token', (r) => r.fulfill({ json: { token: 't' } }))
  await page.route('**/auth/sign-in/email', (r) => r.fulfill({ status: 200, json: {} }))
  await page.route('**/persons/me/memberships', (r) => r.fulfill({ json: { data: [{ organizationId: 'o1', orgName: 'Chapter A' }], total: 1 } }))
  await page.route('**/officer-role/**', (r) => r.fulfill({ json: { data: { isOfficer: true, positions: [] } } }))
  await page.route('**/membership/members/**', (r) => r.fulfill({ json: { data: [{ id: 'm1', personId: 'p1', firstName: 'Olive', lastName: 'Cruz', status: 'active', memberNumber: 'A-1' }] } }))
  await page.route('**/dues-invoices**', (r) => r.fulfill({ json: { data: [], totalCount: 0, totalPages: 0, currentPage: 1 } }))
  await page.route('**/payments/send-link', (r) => r.fulfill({ status: 201, json: { token: 'TOK', paymentUrl: '/pay/TOK', expiresAt: '2026-09-01T00:00:00Z' } }))

  await page.goto('/sign-in')
  await page.getByLabel('Email').fill('olive@chapter.ph')
  await page.getByLabel('Password').fill('pw')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByText('Olive Cruz')).toBeVisible()
  await page.getByRole('link', { name: /send pay-link/i }).click()
  await page.getByLabel(/amount/i).fill('2500')
  await page.getByRole('button', { name: /send (custom )?link/i }).click()
  await expect(page.getByText('/pay/TOK')).toBeVisible()
  await expect(page.getByRole('button', { name: /copy/i })).toBeVisible()
})
```

- [ ] **Step 2: Run the E2E locally.**

Run: `cd apps/org && bun run build && (bun run preview --port 3005 &) && sleep 2 && bun run test:e2e; kill %1`
Expected: 1 passed. (Adjust selectors to match the real components; iterate until green.) If `preview` needs the dev server instead, use `bun run dev` — match how slice-2a's e2e was run (it ran against a built/preview or dev server). Confirm the spec is excluded from vitest (`include` restricts to `*.test.*`).

- [ ] **Step 3: Add the CI `org` job.** The `member` job (`.github/workflows/ci.yml`) uses `bun run --filter @monobase/member <step>` — it has NO `working-directory` and NO `needs:`. Mirror it exactly:
  - Copy the `member` job block, rename the job key `member` → `org`.
  - Keep `oven-sh/setup-bun@v2` with `bun-version: 1.2.21`, `bun install --frozen-lockfile`.
  - Change the three step commands to `bun run --filter @monobase/org build`, `… typecheck`, `… test` (filter target = the package name from Task 1, `@monobase/org` — NOT a working-directory).
  - In the `ci-gate` job: add `org` to its `needs:` array, add `[[ "${{ needs.org.result }}" != "success" ]] && exit 1` to the hard-fail check (mirroring the existing `needs.member.result` line), and add an `echo "  org: ${{ needs.org.result }}"` status line.
  - Confirm the exact shapes first: `grep -n "member" .github/workflows/ci.yml` and read the member job + ci-gate `needs`/check blocks.

- [ ] **Step 4: Verify the engine-frozen invariant.**

Run: `git diff main --stat -- services/api-ts/src specs/ packages/sdk-ts/src/generated`
Expected: EMPTY output. (`packages/ui/src/money.ts` + `.github/workflows/ci.yml` are allowed — not under those paths.)

- [ ] **Step 5: Full local hard gate.**

Run: `cd /Users/elad-mini/Desktop/memberry && bun run --filter '*' typecheck && cd apps/org && bun run test && bun run build`
Expected: typecheck 0 errors across all workspaces; apps/org tests all pass; build green.

- [ ] **Step 6: Commit.**

```bash
git add apps/org/src/e2e .github/workflows/ci.yml
git commit -m "test(org): stubbed E2E officer flow + CI org job"
```

---

## Self-Review

**Spec coverage:**
- Sign-in (cookie) → Task 3. ✓
- CSRF + credentials SDK client → Task 2. ✓
- Org context + officer gate (GAP-2 workaround) → Task 4. ✓
- Roster list → Task 5. ✓
- Send pay-link (invoice-linked + custom) + share + revoke (GAP-1: just-minted only) → Task 6. ✓
- Dues / who-paid → Task 7. ✓
- Shared money util in packages/ui → Task 6. ✓
- New CI org job + frozen-engine verify + portable test:e2e + vitest include → Tasks 1, 8. ✓
- a11y baseline (18px/48px/role=alert/labeled) → enforced per screen, Global Constraints. ✓

**Placeholder scan:** No TBD/TODO; every code step shows code; every test step shows assertions. Implementer-verify NOTES are explicit (SDK param-shape confirmation), not placeholders.

**Type consistency:** `SendState`, `SessionStatus`, `RosterMember`, `DuesStats`, `centavosToPhp(number):string`, hook return shapes are consistent across tasks. SDK fn names match the generated exports verified during brainstorm (`sendPaymentLink`, `revokePaymentLink`, `listOrgMembers`, `listDuesInvoices`, `listDuesPayments`, `getDuesDashboard`, `getMyMemberships`, `getMyOfficerRole`).

**Carry-forward risk flags for implementers (every task brief):**
- SDK fn param/response shapes MUST be verified against `packages/sdk-ts/src/generated/sdk.gen.ts` + `types.gen.ts` before relying on them — the plan's shapes are best-effort from the route audit.
- Money `amount` is bigint at runtime → `Number()` at every boundary.
- routeTree.gen.ts regenerate + commit before typecheck.
- CI is ground truth — the new `org` job is novel wiring; watch it to green after /ship.
