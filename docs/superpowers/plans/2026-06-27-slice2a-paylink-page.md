# Slice-2a — First-Peso Pay-Link Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a login-free `/pay/:token` page in a new minimal `apps/member` so a member can open a tokenized dues link, see the amount GCash-style, tap Pay, complete a PayMongo (test-mode) checkout, and land on a clear paid/cancelled result.

**Architecture:** New lean Vite+React app (`apps/member`) — the canonical scaffold later apps copy — consuming the merged slice-1 engine routes (`GET /pay/:token/validate`, `POST /pay/:token/checkout`) through the generated `@monobase/sdk-ts` client, styled on `packages/ui` (Friendly Clarity). All page logic lives in one testable `usePayLink` hook (a discriminated state machine); the route component is a thin renderer. A dev seed helper mints a real openable link; PayMongo's hosted hop is mocked in the E2E (real test-key E2E deferred).

**Tech Stack:** Vite 7, React 19, TypeScript, TanStack Router (file-based) + TanStack React Query, `@monobase/sdk-ts`, `@monobase/ui` (Tailwind preset), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-27-slice2a-paylink-page-design.md`.

## Global Constraints

- **Engine is FROZEN.** No changes to `services/api-ts` handlers/schemas/routes. This slice is additive frontend + a dev-only seed helper. A missing engine field is a flagged follow-up, not silent scope creep. (CLAUDE.md)
- **Design system only.** All UI uses `@monobase/ui` tokens + components (Friendly Clarity). No per-app component forks. Accessibility baseline: base text ≥18px, tap targets ≥48px, WCAG AA contrast, a text label on every icon, `role="alert"` on errors, one primary task per screen. (DESIGN.md)
- **Money is centavos (integer) → display `₱` with 2 decimals, tabular figures** (`.tabular-amount`). Currency PHP.
- **No `/api` prefix in engine calls** — the Vite dev proxy maps `/api/*` → `http://localhost:7213/*` (strips `/api`). The SDK `baseUrl` points at `/api`. (CLAUDE.md)
- **Dev port = 3004** — the engine builds PayMongo return URLs from `PUBLIC_URL` (fallback `http://localhost:3004`); the app MUST run on 3004 so `?status=success|cancelled` returns to the right origin.
- **The page is PUBLIC** — no auth, no `better-auth`, no session/CSRF provider.
- **Use only the wired route** `validatePaymentToken` (`GET /pay/:token/validate`, always HTTP 200). `validatePaymentLink` is a dead orphan — do not import it.
- **Reference (read, don't copy blindly):** `/Users/elad-mini/desktop/memberry-full/apps/memberry` — its `vite.config.ts`, `src/routes/pay/$token.tsx`, tailwind/postcss are the scaffold blueprint, but re-point Tailwind at `@monobase/ui/tailwind-preset` (the reference uses its own bespoke config — do NOT reuse that).

---

## Engine contract (verbatim — what the page consumes)

`GET /pay/:token/validate` (`validatePaymentToken`) — ALWAYS HTTP 200:
- valid: `{ valid: true, invoiceId?: string, amount: number /*centavos*/, currency: string, memberName: string, orgName: string, dueDate: string /*ISO*/ }`
- `{ valid: false, status: 'already_paid', error: string }`
- `{ valid: false, error: string }` (expired → message contains "expired"; invalid/revoked otherwise)

`POST /pay/:token/checkout` (`checkoutPaymentToken`):
- `200 { checkoutUrl: string }` — redirect now
- `202 { checkoutUrl: '' }` — race; retry
- `400 { error }` — bad token OR gateway not configured
- `409 { error }` — already processed
- `410 { error }` — revoked or expired
- `502 { error }` — PayMongo network failure (retryable)

SDK (generated): `import { validatePaymentToken, checkoutPaymentToken } from '@monobase/sdk-ts/generated'` →
`validatePaymentToken({ path: { token } })` → `{ data, error, response }` (does NOT throw on non-2xx; `response.status` IS surfaced; `data` is `undefined` on transport error);
`checkoutPaymentToken({ path: { token } })` → `{ data: { checkoutUrl }, response }` — read `response.status` for the 200/202/400/409/410/502 mapping. React-query helpers exist but this plan uses the raw SDK fns inside one hook for full control of the 202-retry + status mapping. **SDK client config (CORRECTED — `@monobase/sdk-ts` has NO root export; `client` lives in generated):** `import { client } from '@monobase/sdk-ts/generated/client.gen'` → `client.setConfig({ baseUrl })`. (Do NOT use `@monobase/sdk-ts/client`'s `setSdkBaseUrl` — its own doc says use `client.setConfig`.)

---

## File Structure

```
apps/member/
  package.json              # name @monobase/member; deps + scripts (dev/build/typecheck/test/test:e2e)
  vite.config.ts            # viteReact + tanstackRouter + tsconfigPaths + proxy /api→7213 + server.port 3004
  tsconfig.json             # extends @monobase/typescript-config
  tailwind.config.ts        # presets:[@monobase/ui preset]; content: src + packages/ui/src
  postcss.config.ts         # tailwindcss + autoprefixer
  vitest.config.ts          # happy-dom env, globals:true, setupFiles importing @testing-library/jest-dom/vitest. DO NOT add @monobase/vitest-test-shim (it is a `"vitest":"99.99.99"` stub that shadows real vitest — apps/member needs REAL vitest+Testing Library)
  src/test-setup.ts         # import '@testing-library/jest-dom/vitest'
  playwright.config.ts      # baseURL http://localhost:3004
  index.html                # Vite entry + Hanken Grotesk
  src/
    main.tsx                # createRoot + QueryClientProvider + RouterProvider; client.setConfig({baseUrl})
    styles.css              # @import '@monobase/ui/tokens.css'; tailwind directives
    routeTree.gen.ts        # generated by tanstackRouter (do not hand-edit)
    routes/
      __root.tsx            # Outlet
      pay/$token.tsx        # route component — thin renderer over usePayLink
    features/pay/
      use-pay-link.ts       # the state machine hook (validate + checkout + 202-retry + ?status)
      use-pay-link.test.ts  # unit tests (SDK mocked)
      money.ts              # centavosToPhp(amount): string
      money.test.ts
      PayCard.tsx           # presentational: amount + org + member + due + Pay button
      PayResult.tsx         # presentational: succeeded/cancelled/alreadyPaid/expired/invalid/error
      pay-page.test.tsx     # component render tests per state
    e2e/
      pay-flow.spec.ts      # Playwright: open seeded link → Pay → mock checkout → ?status=success
services/api-ts/scripts/
  seed-paylink.ts           # dev helper: ensure org+member+invoice+encrypted gateway + mint token via send-link; print URL
```

---

## Task 1: Scaffold `apps/member` (blank app boots on 3004)

**Files:**
- Create: `apps/member/package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.ts`, `vitest.config.ts`, `src/test-setup.ts`, `index.html`, `src/main.tsx`, `src/styles.css`, `src/routes/__root.tsx`, `src/routes/index.tsx` (temporary placeholder), `src/routeTree.gen.ts` (generated, committed), `src/vite-env.d.ts`
- (Root `package.json` already has `apps/*` in `workspaces` — no change.)

**Interfaces:**
- Produces: a runnable app (`bun run --filter @monobase/member dev` on :3004), `client.setConfig({ baseUrl })` wired, Tailwind resolving `@monobase/ui` tokens. Later tasks add routes/features.

- [ ] **Step 1: Read the reference scaffold**

Read `/Users/elad-mini/desktop/memberry-full/apps/memberry/{package.json,vite.config.ts,postcss.config.ts,index.html,src/main.tsx}` and `packages/ui/tailwind-preset.ts` + `packages/ui/package.json` exports. Note the versions actually present in this repo's root lockfile (React 19, Vite 7, TanStack Router/Query, tailwindcss). Use the SAME versions.

- [ ] **Step 2: Write `apps/member/package.json`**

```jsonc
{
  "name": "@monobase/member",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 3004",
    "build": "tsc -b && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@monobase/sdk-ts": "workspace:*",
    "@monobase/ui": "workspace:*",
    "@tanstack/react-query": "^5 (match sdk-ts peer)",
    "@tanstack/react-router": "<from the REFERENCE app — no current workspace depends on tanstack-router; do NOT 'match root'>",
    "react": "<match root>",
    "react-dom": "<match root>"
  },
  "devDependencies": {
    "@monobase/typescript-config": "workspace:*",
    "@tanstack/router-plugin": "<from the REFERENCE app — not root>",
    "@vitejs/plugin-react": "<match root>",
    "@testing-library/react": "<latest compatible>",
    "@testing-library/jest-dom": "<latest>",
    "@playwright/test": "<match reference / pinned 1.58.2 — see playwright-pin memory>",
    "autoprefixer": "*", "postcss": "*", "tailwindcss": "^3",
    "jsdom": "*", "typescript": "<match root>", "vite": "<match root>",
    "vite-tsconfig-paths": "<match reference>", "vitest": "<match root>"
  }
}
```
Exact versions: copy from the reference app's `package.json` / root lockfile. Pin Playwright to **1.58.2** (see memory `playwright-pin`: 1.59 breaks `test.describe`).

- [ ] **Step 3: Write `vite.config.ts`** — react + tanstackRouter + tsconfigPaths, proxy, port 3004

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tanstackRouter({ routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts',
      routeFileIgnorePattern: '\\.(test|spec)\\.(ts|tsx)$' }),
    react(), tsconfigPaths(),
  ],
  server: {
    port: 3004,
    proxy: { '/api': { target: 'http://localhost:7213', changeOrigin: true, ws: true,
      rewrite: (p) => p.replace(/^\/api/, '') } },
  },
})
```

- [ ] **Step 4: Write Tailwind + postcss + styles + tsconfig**

`tailwind.config.ts`:
```ts
import preset from '@monobase/ui/tailwind-preset'
export default { presets: [preset], content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'] }
```
`postcss.config.ts`: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`
`src/styles.css`:
```css
@import '@monobase/ui/tokens.css';
@tailwind base; @tailwind components; @tailwind utilities;
```
`tsconfig.json`: `{ "extends": "@monobase/typescript-config/react.json" /* or the reference's */, "include": ["src", "*.config.ts"] }` — match what `@monobase/typescript-config` actually exports.

- [ ] **Step 5: Write `index.html`, `src/main.tsx`, `__root.tsx`, placeholder `index.tsx`, `vite-env.d.ts`**

`src/main.tsx` (point SDK at the proxy):
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { client } from '@monobase/sdk-ts/generated/client.gen'
import { routeTree } from './routeTree.gen'
import './styles.css'

client.setConfig({ baseUrl: import.meta.env.VITE_API_URL ?? `${window.location.origin}/api` })
const router = createRouter({ routeTree })
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
createRoot(document.getElementById('root')!).render(
  <StrictMode><QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider></StrictMode>,
)
```
`src/routes/__root.tsx`: `createRootRoute({ component: () => <Outlet /> })`.
`src/routes/index.tsx` (placeholder, replaced/kept minimal): renders `Memberry` heading so dev boot is verifiable.

- [ ] **Step 6: Generate routeTree FIRST, then typecheck/build**

`main.tsx` imports `./routeTree.gen` which only exists after the tanstack-router generator runs — so `tsc --noEmit` on a fresh tree fails "Cannot find module './routeTree.gen'". Generate it before typecheck and COMMIT it (the reference app commits it; do not gitignore it).
Run: `bun install`; generate the route tree (`bun run --filter @monobase/member build` does this, or add a `tsr generate` script and run it); THEN `bun run --filter @monobase/member typecheck` → 0 errors; `bun run --filter @monobase/member build` → succeeds. Optionally `dev` and confirm http://localhost:3004.
Expected: routeTree.gen.ts exists + committed, typecheck 0 errors, build succeeds.

- [ ] **Step 7: Commit** (include the generated routeTree)

```bash
git add apps/member
git commit -m "feat(member): scaffold lean apps/member (vite+tanstack+packages/ui+sdk proxy, :3004)"
```
(Root `package.json` already has `apps/*` in `workspaces` — no edit needed.)

---

## Task 2: `money.ts` + `usePayLink` validate-side state machine

**Files:**
- Create: `apps/member/src/features/pay/money.ts`, `money.test.ts`, `apps/member/src/features/pay/use-pay-link.ts`, `use-pay-link.test.ts`

**Interfaces:**
- Produces:
  - `centavosToPhp(amount: number): string` → e.g. `250000 → "₱2,500.00"`.
  - `type PayState =` discriminated union:
    `{ kind: 'loading' }` | `{ kind: 'payable', amount, currency, orgName, memberName, dueDate }` | `{ kind: 'alreadyPaid' }` | `{ kind: 'expired' }` | `{ kind: 'invalid' }` | `{ kind: 'paying' }` | `{ kind: 'cancelled', ...payable } ` | `{ kind: 'succeeded' }` | `{ kind: 'notConfigured' }` | `{ kind: 'temporaryError' }`
  - `usePayLink(token: string): { state: PayState; pay: () => void }` — this task implements ONLY the validate→{payable,alreadyPaid,expired,invalid} mapping + `loading`. `pay`/checkout states land in Task 3; `cancelled`/`succeeded` in Task 4 (leave `pay` a no-op stub returning here).

- [ ] **Step 1: Write `money.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { centavosToPhp } from './money'
describe('centavosToPhp', () => {
  it('formats centavos as PHP with 2 decimals + grouping', () => {
    expect(centavosToPhp(250000)).toBe('₱2,500.00')
    expect(centavosToPhp(0)).toBe('₱0.00')
    expect(centavosToPhp(199)).toBe('₱1.99')
    expect(centavosToPhp(123456789)).toBe('₱1,234,567.89')
  })
})
```

- [ ] **Step 2: Run → FAIL** (`bun run --filter @monobase/member test money`). Expected: module/function missing.

- [ ] **Step 3: Implement `money.ts`**

```ts
export function centavosToPhp(amount: number): string {
  return '₱' + (amount / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Write `use-pay-link.test.ts` (validate mapping)** — mock the SDK module:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@monobase/sdk-ts/generated', () => ({
  validatePaymentToken: vi.fn(),
  checkoutPaymentToken: vi.fn(),
}))
import { validatePaymentToken } from '@monobase/sdk-ts/generated'
import { usePayLink } from './use-pay-link'

// import type { ReactNode } from 'react'  (don't rely on a global React)
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)
const mockValidate = (data: unknown) => (validatePaymentToken as any).mockResolvedValue({ data })

beforeEach(() => vi.clearAllMocks())

it('maps valid → payable with amount/org/member/due', async () => {
  mockValidate({ valid: true, amount: 250000, currency: 'PHP', memberName: 'Olive Cruz', orgName: 'PDA Manila', dueDate: '2026-07-01T00:00:00.000Z' })
  const { result } = renderHook(() => usePayLink('tok'), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('payable'))
  expect(result.current.state).toMatchObject({ amount: 250000, orgName: 'PDA Manila', memberName: 'Olive Cruz' })
})
it('maps already_paid → alreadyPaid', async () => {
  mockValidate({ valid: false, status: 'already_paid', error: 'x' })
  const { result } = renderHook(() => usePayLink('tok'), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('alreadyPaid'))
})
it('maps expired-message → expired', async () => {
  mockValidate({ valid: false, error: 'This payment link has expired. ...' })
  const { result } = renderHook(() => usePayLink('tok'), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('expired'))
})
it('maps other invalid → invalid', async () => {
  mockValidate({ valid: false, error: 'Payment link is invalid or has been revoked' })
  const { result } = renderHook(() => usePayLink('tok'), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('invalid'))
})
```

- [ ] **Step 6: Run → FAIL** (hook missing).

- [ ] **Step 7: Implement `use-pay-link.ts` (validate side only)**

```ts
import { useQuery } from '@tanstack/react-query'
import { validatePaymentToken } from '@monobase/sdk-ts/generated'

export type PayState =
  | { kind: 'loading' }
  | { kind: 'payable'; amount: number; currency: string; orgName: string; memberName: string; dueDate: string }
  | { kind: 'alreadyPaid' } | { kind: 'expired' } | { kind: 'invalid' }
  | { kind: 'paying' } | { kind: 'succeeded' }
  | { kind: 'cancelled'; amount: number; currency: string; orgName: string; memberName: string; dueDate: string }
  | { kind: 'notConfigured' } | { kind: 'temporaryError' }

export function usePayLink(token: string): { state: PayState; pay: () => void } {
  const q = useQuery({
    queryKey: ['pay-validate', token],
    // SDK does NOT throw on non-2xx and returns data:undefined on transport error.
    // Throw so a network failure surfaces as an error (→ temporaryError) instead of
    // resolving undefined and hanging on `loading` forever (I3).
    queryFn: async () => {
      const { data } = await validatePaymentToken({ path: { token } })
      if (!data) throw new Error('validate failed')
      return data
    },
  })
  let state: PayState = { kind: 'loading' }
  const d = q.data as any
  if (q.isError) state = { kind: 'temporaryError' }
  else if (d) {
    if (d.valid) state = { kind: 'payable', amount: d.amount, currency: d.currency, orgName: d.orgName, memberName: d.memberName, dueDate: d.dueDate }
    else if (d.status === 'already_paid') state = { kind: 'alreadyPaid' }
    else if (typeof d.error === 'string' && /expired/i.test(d.error)) state = { kind: 'expired' }
    else state = { kind: 'invalid' }
  }
  return { state, pay: () => { /* Task 3 */ } }
}
```

- [ ] **Step 8: Run → PASS. Commit**

```bash
git add apps/member/src/features/pay
git commit -m "feat(member): pay-link validate state machine + PHP money fmt"
```

---

## Task 3: checkout mutation + 202 retry + error→state mapping + redirect

**Files:**
- Modify: `apps/member/src/features/pay/use-pay-link.ts`, `use-pay-link.test.ts`

**Interfaces:**
- Consumes: `checkoutPaymentToken` SDK fn (returns `{ data, response }` where `response.status` is the HTTP code), `usePayLink` from Task 2.
- Produces: `pay()` now triggers checkout; new states `paying`, `notConfigured`, `temporaryError`; redirect on 200; bounded 202-retry (3 tries, ~1500ms); status→state map 400→notConfigured, 409→alreadyPaid, 410→expired|invalid, 502→temporaryError. Expose `redirectUrl?: string` on state OR perform `window.location.assign` via an injected navigate (default `window.location.assign`) so it's testable.

- [ ] **Step 1: Add a navigate seam for testability** — `usePayLink(token, { navigate = (url) => window.location.assign(url) } = {})`. Tests pass a spy.

- [ ] **Step 2: Write failing tests** (append):

```ts
import { checkoutPaymentToken } from '@monobase/sdk-ts/generated'
const mockCheckout = (status: number, data: unknown) =>
  (checkoutPaymentToken as any).mockResolvedValue({ data, response: { status } })

it('200 → navigates to checkoutUrl', async () => {
  mockValidate({ valid: true, amount: 1, currency: 'PHP', memberName: 'a', orgName: 'b', dueDate: 'c' })
  mockCheckout(200, { checkoutUrl: 'https://pm.test/cs_1' })
  const navigate = vi.fn()
  const { result } = renderHook(() => usePayLink('tok', { navigate }), { wrapper })
  await waitFor(() => expect(result.current.state.kind).toBe('payable'))
  act(() => result.current.pay())
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('https://pm.test/cs_1'))
})
it('202 then 200 → retries then navigates', async () => { /* first call 202 {checkoutUrl:''}, second 200 — use mockResolvedValueOnce; assert navigate called once with the url; use vi.useFakeTimers for the ~1.5s wait */ })
it('400 → notConfigured', async () => { mockValidate({valid:true,amount:1,currency:'PHP',memberName:'a',orgName:'b',dueDate:'c'}); mockCheckout(400,{error:'x'}); /* pay(); assert state.kind==='notConfigured' */ })
it('409 → alreadyPaid', async () => { /* mockCheckout(409,...) → alreadyPaid */ })
it('410 → expired (message has expired) else invalid', async () => { /* two cases */ })
it('502 → temporaryError', async () => { /* mockCheckout(502,...) → temporaryError */ })
```
(Write the bodies fully when implementing; use `act` from `@testing-library/react` and `vi.useFakeTimers()`/`vi.advanceTimersByTimeAsync(1500)` for the retry test.)

- [ ] **Step 3: Run → FAIL.**

- [ ] **Step 4: Implement** — use `useMutation` for checkout; on success inspect `response.status`; map per the table; for 202 with empty url, re-invoke up to 3× with a 1500ms delay; on exhaustion → `temporaryError`. Set a local `paying` flag while in flight. Keep the validate-side mapping from Task 2 (checkout-side states take precedence once `pay()` is invoked).

- [ ] **Step 5: Run → PASS. Commit** `feat(member): pay-link checkout, 202 retry, status→state mapping, redirect`.

---

## Task 4: `?status` return handling + re-validate on success

**Files:**
- Modify: `apps/member/src/features/pay/use-pay-link.ts`, `use-pay-link.test.ts`

**Interfaces:**
- Consumes: TanStack Router `useSearch` (or the route passes `status` in). To keep the hook router-agnostic + unit-testable, accept `usePayLink(token, { navigate, returnStatus }: { returnStatus?: 'success' | 'cancelled' })`. The route component reads `Route.useSearch()` and passes `returnStatus`.
- Produces: `returnStatus==='cancelled'` → `cancelled` state (still shows Pay, reuses validate's payable fields); `returnStatus==='success'` → `succeeded` (and re-validate; if validate now says `already_paid`/`valid:false` keep `succeeded`; if still `payable`, show `succeeded` optimistic with a "confirming" affordance — keep simple: `succeeded`).

- [ ] **Step 1: Write failing tests** — `returnStatus:'cancelled'` with valid validate → `cancelled` (carries amount); `returnStatus:'success'` → `succeeded` regardless of validate.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — branch on `returnStatus` BEFORE the validate-derived mapping (success/cancelled win). For `cancelled`, merge in payable fields from validate data when present.
- [ ] **Step 4: Run → PASS. Commit** `feat(member): pay-link ?status=success|cancelled return handling`.

---

## Task 5: `PayCard` + `PayResult` + the route component

**Files:**
- Create: `apps/member/src/features/pay/PayCard.tsx`, `PayResult.tsx`, `apps/member/src/routes/pay/$token.tsx`, `apps/member/src/features/pay/pay-page.test.tsx`
- Delete/replace: `apps/member/src/routes/index.tsx` placeholder (optional: keep a minimal landing or redirect)

**Interfaces:**
- Consumes: `usePayLink`, `centavosToPhp`, `@monobase/ui` (`Button`, card/layout, `ErrorState`, `EmptyState`, `StatusBadge`).
- Produces: `pay/$token.tsx` route — reads `token` param + `?status` search, calls `usePayLink`, renders by `state.kind`. `PayCard` (payable/cancelled): org header, big `.tabular-amount` amount, member name + a "link valid until" row (NOTE: validate's `dueDate` is the token's 72h `expiresAt`, NOT the invoice due date — use copy like "Pay by" / "Link valid until", not "Due date"), ≥48px **Pay now** button → `pay()`. `PayResult` (succeeded/alreadyPaid/expired/invalid/notConfigured/temporaryError): icon+label+copy, `role="alert"` for errors, retry button on `temporaryError`.

- [ ] **Step 1: Write `pay-page.test.tsx`** (render route component with `usePayLink` mocked per state):
  - `payable` → amount text `₱2,500.00` visible, "Pay now" button present + ≥enabled, clicking calls `pay`.
  - `loading` → loading affordance.
  - `alreadyPaid`/`succeeded` → success copy; `expired`/`invalid`/`notConfigured` → respective copy with `role="alert"`; `temporaryError` → retry button.
  Mock: `vi.mock('../features/pay/use-pay-link', ...)` returning a controlled `state`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `PayCard`, `PayResult`, `pay/$token.tsx`** using `@monobase/ui`. Define the route search schema to accept `status?: 'success'|'cancelled'` and pass to `usePayLink`. Money via `centavosToPhp`. Ensure base ≥18px (token default), Pay button min-h-tap.
- [ ] **Step 4: Run → PASS. Typecheck + build the app.** `bun run --filter @monobase/member typecheck && bun run --filter @monobase/member build` clean.
- [ ] **Step 5: Commit** `feat(member): pay-link page UI (PayCard/PayResult) on packages/ui`.

---

## Task 6: Dev seed helper — a real openable pay link

**Files:**
- Create: `services/api-ts/scripts/seed-paylink.ts`

**Interfaces:**
- Produces: a script (run with the API's DB env) that ensures Dr. Olive's org + a member (person) + a dues invoice exist, sets a per-org PayMongo gateway config with `encryptCredential(...)`-encrypted **placeholder** `sk_test_...` (NOT raw plaintext — the existing `db:seed` bug), mints a real pay-link, and prints `http://localhost:3004/pay/<token>`.

- [ ] **Step 1: Read the real paths** — `services/api-ts/src/seed/layer-1-foundation.ts`, `layer-5-gap-fill.ts` (gateway insert), `src/core/gateway.ts` (`encryptCredential`), `src/core/config.ts` (`auth.secret = env.AUTH_SECRET`), and **`sendPaymentLink.ts`** (the WIRED mint path). **CRITICAL — there are two token systems; use the right one:** the wired `validatePaymentToken` resolves ONLY slice-1 `payment_token` rows, looked up by `hashPaymentToken(raw, getPaymentTokenSecret())`. So mint via `sendPaymentLink`'s exact path: `const raw = generatePaymentToken(getPaymentTokenSecret()); new PaymentTokenRepository(db).create({ tokenHash: hashPaymentToken(raw, getPaymentTokenSecret()), personId, organizationId, invoiceId, amount, currency, expiresAt, createdByOfficer })`. **Do NOT use `generatePaymentLink`** (legacy, keyed on `PAYMENT_LINK_SECRET`, feeds the dead `validatePaymentLink` orphan). Call the repo DIRECTLY — do not hit the HTTP `send-link` route (it's officer-authed; a script has no session).
- [ ] **Step 2: Implement** — idempotent: upsert org/member/invoice; upsert the per-org gateway config with `encryptCredential('sk_test_placeholder', authSecret)` + an encrypted webhook secret, `connected: true`, where `authSecret = process.env.AUTH_SECRET` (I4 — MUST match the running API's `AUTH_SECRET`, since `checkoutPaymentToken` decrypts with `config.auth.secret = env.AUTH_SECRET`; a mismatch fails checkout decryption). Mint the token via the repo path above. Print `http://localhost:3004/pay/<raw>`.
- [ ] **Step 3: Verify end-to-end (real-PG dev DB)** — start a Postgres + the API (`bun dev`), run `bun run scripts/seed-paylink.ts`, then `curl http://localhost:7213/pay/<token>/validate` → `{ valid: true, amount: ... }`. (Document the exact commands in the script header.)
- [ ] **Step 4: Commit** `chore(dev): seed-paylink helper — real openable test pay link (encrypted gateway)`.

---

## Task 7: E2E — pay flow with PayMongo mocked

**Files:**
- Create: `apps/member/playwright.config.ts`, `apps/member/src/e2e/pay-flow.spec.ts`

**Interfaces:**
- Consumes: the running app (:3004) + API (:7213) + a seeded token (Task 6). Mocks the PayMongo hosted hop.

- [ ] **Step 1: `playwright.config.ts`** — `use.baseURL = 'http://localhost:3004'`, pin `@playwright/test` 1.58.2.
- [ ] **Step 2: Write `pay-flow.spec.ts`** — `page.route('**/api/pay/*/checkout', ...)` to fulfil with `{ checkoutUrl: '<app-origin>/pay/<token>?status=success' }` (so "PayMongo" immediately bounces back with success, no real hosted page); navigate to `/pay/<token>`; assert the amount renders; click **Pay now**; assert it lands on the `succeeded` state ("Payment received"). Also a second test: `page.route` validate → `already_paid` → assert terminal copy.
- [ ] **Step 3: Run** `bun run --filter @monobase/member test:e2e` against the running stack → green. (If the stack isn't up in CI, this is a local/manual gate for now — see Task 8.)
- [ ] **Step 4: Commit** `test(member): e2e pay flow (PayMongo hosted hop mocked)`.

---

## Task 8: Monorepo wiring + gates green

**Files:**
- Modify: root `package.json` (workspace scripts include `@monobase/member` in typecheck/lint/build fan-out), `.github/workflows/ci.yml` (add a member typecheck+unit-test+build job — the lean apps were NOTE-marked for re-add when built), root `tsconfig`/eslint includes if needed, `package.json` lint-staged globs.

**Interfaces:**
- Produces: CI runs `apps/member` typecheck + unit tests + build. (E2E stays local for now — needs the live stack + seed; add a NOTE for a later e2e job once a seed-in-CI exists.)

- [ ] **Step 1: Confirm fan-out** — `bun run --filter '*' typecheck` and `lint` include `@monobase/member`. Fix tsconfig/eslint config so the new app is covered (mirror `packages/ui`'s wiring).
- [ ] **Step 2: Add CI job** — a `member` job in `ci.yml`: setup-bun, `bun install --frozen-lockfile`, then **build FIRST** (or run the `tsr generate` step) so `routeTree.gen.ts` exists, THEN `typecheck`, then `test`. Order: `bun run --filter @monobase/member build` → `... typecheck` → `... test`. (If routeTree is committed per Task 1, typecheck-first is fine — but build-first is robust either way.) Add the job to `ci-gate` `needs`. NOTE-mark a future `e2e-member` job (deferred — needs live API + seed-in-CI).
- [ ] **Step 3: Run the full local gate** — `bun run typecheck` (all workspaces, 0 errors), `bun run --filter @monobase/member test` (green), `bun run --filter @monobase/member build` (green). Engine untouched: `git diff main -- services/api-ts/src` shows ONLY `scripts/seed-paylink.ts` (Task 6) added, no handler/schema changes.
- [ ] **Step 4: Commit** `ci(member): typecheck+unit+build job for apps/member; lean-app fan-out`.

---

## Self-review notes (author)
- Spec coverage: scaffold (T1), state machine incl. 202/error/`?status` (T2–T4), page UI + a11y (T5), real-link seed (T6), mocked-PayMongo E2E (T7), gates/CI + engine-frozen check (T8). All spec sections map to a task.
- Engine-frozen honored: only `services/api-ts/scripts/seed-paylink.ts` is added under services; no handler/schema edits.
- Deferred (flagged, not silently dropped): real-PayMongo-test E2E (needs real `pk_test`/`sk_test`); CI e2e-member job (needs seed-in-CI). Both NOTE-marked.
- Open follow-up for execution: pin exact dependency versions from the root lockfile in Task 1 (the plan says `<match root>` — the implementer resolves them against the live lockfile, since pinning stale versions here would rot).
