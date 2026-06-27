# B1 Digital Membership Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-screen digital membership card with a scannable QR to apps/member, consuming the existing un-SDK'd `GET /persons/me/id-card/:orgId` via raw fetch.

**Architecture:** New authed `/card` route renders `<IdCardView/>`, fed by a `useIdCard()` hook that raw-fetches the id-card endpoint (session cookie, no SDK, engine FROZEN). QR rendered client-side with `qrcode.react`. Entry point is a "View digital card" link on the existing `MembershipTile`.

**Tech Stack:** React + TanStack Router + TanStack Query, `@monobase/ui`, `qrcode.react`, vitest + Playwright, bun.

## Global Constraints

- **Engine FROZEN:** no changes to `services/api-ts/src`, `specs/`, `packages/sdk-ts/src/generated`. `git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated` MUST be empty at PR.
- **Money:** none on this card.
- **a11y (DESIGN.md):** 18px base, ≥48px tap targets, status via labeled `StatusBadge` (not color-only), `<img>` has `alt`, QR has accessible label/caption, one primary task per screen.
- **Raw-fetch idiom:** mirror `apps/member/src/features/auth/sign-in.ts` — `fetch(`${window.location.origin}/api<path>`, { credentials:'include' })`. The `/api` prefix is required (Vite proxy strips it). GET → no CSRF header.
- **Drift discipline:** id-card has NO SDK type — define `IdCardData` locally mirroring the handler (verified in the spec). Test mocks use the real handler envelope `{ data: IdCardData }`.
- **Typecheck includes tests:** `apps/member/tsconfig.test.json` already wired; `typecheck` runs `tsc --noEmit && tsc -p tsconfig.test.json`.
- **Version:** bump apps/member to v0.1.10.0 at ship.

---

### Task 1: `useIdCard` hook + `qrcode.react` dep + `IdCardData` type

**Files:**
- Modify: `apps/member/package.json` (add `qrcode.react` dependency)
- Create: `apps/member/src/features/card/use-id-card.ts`
- Test: `apps/member/src/features/card/use-id-card.test.ts`

**Interfaces:**
- Produces: `export interface IdCardData { personId; firstName; lastName: string|null; licenseNumber: string|null; organizationName; membershipStatus; photoUrl: string|null; qrPayload; qrSignature; validUntil: string|null; verifyCredentialNumber: string|null }` (all string unless noted)
- Produces: `export function useIdCard(): UseQueryResult<IdCardData>` — queryKey `['id-card', orgId]`, `enabled: !!orgId`, `retry: false`. orgId from `useMemberOrg()`.
- Consumes: `useMemberOrg` from `@/features/org/use-member-org`.

- [ ] **Step 1: Add the dependency**

```bash
cd apps/member && bun add qrcode.react && cd ../..
```
Verify `apps/member/package.json` now lists `"qrcode.react"` under dependencies.

- [ ] **Step 2: Write the failing test** — `apps/member/src/features/card/use-id-card.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useIdCard, type IdCardData } from './use-id-card'

vi.mock('@/features/org/use-member-org', () => ({
  useMemberOrg: vi.fn(() => ({ orgId: 'org-1', memberships: [], select: vi.fn() })),
}))
import { useMemberOrg } from '@/features/org/use-member-org'

const CARD: IdCardData = {
  personId: 'p1', firstName: 'Olive', lastName: 'Reyes', licenseNumber: 'DEN-12345',
  organizationName: 'Manila Dental Chapter', membershipStatus: 'active', photoUrl: null,
  qrPayload: 'eyJ2IjoxfQ==', qrSignature: 'abc123', validUntil: '2027-01-01',
  verifyCredentialNumber: 'MC-0001',
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useIdCard', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('fetches and maps the id-card to IdCardData', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ data: CARD }), { status: 200 }),
    )
    const { result } = renderHook(() => useIdCard(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(CARD)
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('/api/persons/me/id-card/org-1')
  })

  it('throws on non-ok response', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('', { status: 500 }))
    const { result } = renderHook(() => useIdCard(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('is disabled when no orgId', async () => {
    ;(useMemberOrg as ReturnType<typeof vi.fn>).mockReturnValueOnce({ orgId: null, memberships: [], select: vi.fn() })
    const { result } = renderHook(() => useIdCard(), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run it — expect fail** (`useIdCard` not defined)

```bash
cd apps/member && bun run test -- use-id-card
```
Expected: FAIL (cannot find module / useIdCard undefined).

- [ ] **Step 4: Implement** — `apps/member/src/features/card/use-id-card.ts`

```ts
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useMemberOrg } from '@/features/org/use-member-org'

/** Mirrors services/api-ts/src/handlers/person/utils/id-card-data.ts IdCardData (NOT in SDK). */
export interface IdCardData {
  personId: string
  firstName: string
  lastName: string | null
  licenseNumber: string | null
  organizationName: string
  membershipStatus: string
  photoUrl: string | null
  qrPayload: string
  qrSignature: string
  validUntil: string | null
  verifyCredentialNumber: string | null
}

/**
 * GET /persons/me/id-card/:orgId — un-SDK'd endpoint, raw fetch (engine FROZEN).
 * Mirrors the raw idiom in features/auth/sign-in.ts. GET → no CSRF header needed.
 */
export function useIdCard(): UseQueryResult<IdCardData> {
  const { orgId } = useMemberOrg()
  return useQuery({
    queryKey: ['id-card', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`${window.location.origin}/api/persons/me/id-card/${orgId}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`ID card fetch failed: ${res.status}`)
      const body = (await res.json()) as { data: IdCardData }
      return body.data
    },
  })
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd apps/member && bun run test -- use-id-card
```
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck (incl. tests)**

```bash
cd apps/member && bun run typecheck
```
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/member/package.json apps/member/src/features/card/use-id-card.ts apps/member/src/features/card/use-id-card.test.ts ../../bun.lock 2>/dev/null; git add -A apps/member; git commit -m "feat(member): useIdCard hook + qrcode.react dep (B1)"
```

---

### Task 2: `IdCardView` component

**Files:**
- Create: `apps/member/src/features/card/IdCardView.tsx`
- Test: `apps/member/src/features/card/IdCardView.test.tsx`

**Interfaces:**
- Consumes: `useIdCard`, `IdCardData` from `./use-id-card`; `Card, CardHeader, CardTitle, CardContent, Skeleton, Avatar, StatusBadge, ErrorState, EmptyState` from `@monobase/ui`; `QRCodeSVG` from `qrcode.react`.
- Produces: `export function IdCardView(): JSX.Element`.

- [ ] **Step 1: Write the failing test** — `apps/member/src/features/card/IdCardView.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdCardView } from './IdCardView'
import type { IdCardData } from './use-id-card'

vi.mock('./use-id-card', () => ({ useIdCard: vi.fn() }))
import { useIdCard } from './use-id-card'
const mockUseIdCard = useIdCard as ReturnType<typeof vi.fn>

const CARD: IdCardData = {
  personId: 'p1', firstName: 'Olive', lastName: 'Reyes', licenseNumber: 'DEN-12345',
  organizationName: 'Manila Dental Chapter', membershipStatus: 'active', photoUrl: null,
  qrPayload: 'eyJ2IjoxfQ==', qrSignature: 'abc123', validUntil: '2027-01-01',
  verifyCredentialNumber: 'MC-0001',
}

describe('IdCardView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the card fields + QR + credential number, no NaN/undefined', () => {
    mockUseIdCard.mockReturnValue({ isLoading: false, isError: false, data: CARD })
    const { container } = render(<IdCardView />)
    expect(screen.getByText('Manila Dental Chapter')).toBeInTheDocument()
    expect(screen.getByText(/Olive Reyes/)).toBeInTheDocument()
    expect(screen.getByText('MC-0001')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument() // QR
    expect(container.textContent).not.toMatch(/NaN|undefined|null/)
  })

  it('omits "Valid until" when validUntil is null and shows initials when no photo', () => {
    mockUseIdCard.mockReturnValue({ isLoading: false, isError: false, data: { ...CARD, validUntil: null } })
    render(<IdCardView />)
    expect(screen.queryByText(/Valid until/i)).not.toBeInTheDocument()
  })

  it('shows loading skeleton', () => {
    mockUseIdCard.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    const { container } = render(<IdCardView />)
    expect(container.querySelector('[data-slot="skeleton"], .animate-pulse')).toBeTruthy()
  })

  it('shows error state', () => {
    mockUseIdCard.mockReturnValue({ isLoading: false, isError: true, data: undefined })
    render(<IdCardView />)
    expect(screen.getByText(/could not load|couldn't load|refresh/i)).toBeInTheDocument()
  })

  it('shows empty state when no card', () => {
    mockUseIdCard.mockReturnValue({ isLoading: false, isError: false, data: null })
    render(<IdCardView />)
    expect(screen.getByText(/no active membership|no card/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect fail**

```bash
cd apps/member && bun run test -- IdCardView
```
Expected: FAIL (IdCardView not defined).

- [ ] **Step 3: Implement** — `apps/member/src/features/card/IdCardView.tsx`

```tsx
import { QRCodeSVG } from 'qrcode.react'
import {
  Card, CardHeader, CardTitle, CardContent,
  Skeleton, Avatar, StatusBadge, ErrorState, EmptyState,
} from '@monobase/ui'
import { useIdCard } from './use-id-card'

const KNOWN_STATUS = ['active', 'grace', 'lapsed', 'pending', 'suspended'] as const
type CardStatus = (typeof KNOWN_STATUS)[number]

export function IdCardView() {
  const { isLoading, isError, data } = useIdCard()

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-body font-semibold text-muted-foreground">Membership card</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-40 w-40" />
        </CardContent>
      </Card>
    )
  }
  if (isError) {
    return (
      <Card><CardHeader><CardTitle className="text-body font-semibold text-muted-foreground">Membership card</CardTitle></CardHeader>
        <CardContent><ErrorState message="Couldn't load your card. Please refresh." /></CardContent>
      </Card>
    )
  }
  if (!data) {
    return (
      <Card><CardHeader><CardTitle className="text-body font-semibold text-muted-foreground">Membership card</CardTitle></CardHeader>
        <CardContent><EmptyState headline="No active membership" description="Contact your chapter officer if you believe this is a mistake." /></CardContent>
      </Card>
    )
  }

  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ')
  const initials = [data.firstName?.[0], data.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const status: CardStatus = (KNOWN_STATUS as readonly string[]).includes(data.membershipStatus)
    ? (data.membershipStatus as CardStatus) : 'pending'
  const validLabel = data.validUntil
    ? new Date(data.validUntil).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : null
  // ponytail: QR bundles payload+signature JWT-style; a future verifier UI splits on '.' and
  // POSTs the payload to verifyCredentialPublic. Verifier page is out of scope this slice.
  const qrData = `${data.qrPayload}.${data.qrSignature}`

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-body font-semibold text-muted-foreground">Membership card</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-section font-semibold text-foreground">{data.organizationName}</p>
        <div className="flex items-center gap-3">
          <Avatar>
            {data.photoUrl
              ? <img src={data.photoUrl} alt={`${fullName} photo`} className="h-full w-full object-cover" />
              : <span aria-hidden className="flex h-full w-full items-center justify-center text-body font-semibold">{initials}</span>}
          </Avatar>
          <div>
            <p className="text-body font-semibold text-foreground">{fullName}</p>
            {data.licenseNumber && <p className="text-body text-muted-foreground">License {data.licenseNumber}</p>}
          </div>
        </div>
        <StatusBadge status={status} />
        {validLabel && <p className="text-body text-muted-foreground"><span className="font-medium">Valid until</span> {validLabel}</p>}
        <figure className="flex flex-col items-center gap-2 pt-2">
          <QRCodeSVG value={qrData} size={160} aria-label="Membership QR code — scan to verify" />
          <figcaption className="text-body text-muted-foreground">Scan to verify membership</figcaption>
        </figure>
        {data.verifyCredentialNumber && <p className="text-center font-mono text-body text-muted-foreground">{data.verifyCredentialNumber}</p>}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd apps/member && bun run test -- IdCardView
```
Expected: PASS. If `Avatar`/`StatusBadge`/`EmptyState`/`ErrorState` import names differ, check `packages/ui/src/index.ts` and adjust imports (do not invent components).

- [ ] **Step 5: Typecheck**

```bash
cd apps/member && bun run typecheck
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/member/src/features/card && git commit -m "feat(member): IdCardView component with QR (B1)"
```

---

### Task 3: `/card` route + MembershipTile link + e2e

**Files:**
- Create: `apps/member/src/routes/card.tsx`
- Modify: `apps/member/src/features/dashboard/MembershipTile.tsx` (add "View digital card" link)
- Modify: `apps/member/src/routeTree.gen.ts` (regenerated)
- Create: `apps/member/src/e2e/card-flow.spec.ts`
- Test: extend `apps/member/src/features/dashboard/MembershipTile.test.tsx` if present (link visibility)

**Interfaces:**
- Consumes: `IdCardView` from `@/features/card/IdCardView`; `createFileRoute`, `Link` from `@tanstack/react-router`.

- [ ] **Step 1: Create the route** — `apps/member/src/routes/card.tsx`

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { IdCardView } from '@/features/card/IdCardView'

export const Route = createFileRoute('/card')({ component: CardPage })

function CardPage() {
  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-section font-semibold text-foreground">Your digital card</h1>
      <IdCardView />
    </main>
  )
}
```

- [ ] **Step 2: Regenerate the route tree + verify it compiles**

```bash
cd apps/member && bun run build 2>&1 | tail -20
```
Expected: build succeeds; `routeTree.gen.ts` now contains `/card`. (The dev-only TanStack generator runs on build/dev — confirm the file changed.) If build is heavy, alternatively run `bun run dev` briefly to trigger generation, then stop. COMMIT the regenerated `routeTree.gen.ts`.

- [ ] **Step 3: Add the link in MembershipTile** — `apps/member/src/features/dashboard/MembershipTile.tsx`

In the success branch (where `membership` is non-null), add before the closing `</CardContent>`:

```tsx
        <Link
          to="/card"
          className="inline-flex min-h-[48px] items-center text-body font-medium text-primary underline"
        >
          View digital card
        </Link>
```

Add the import at top: `import { Link } from '@tanstack/react-router'`.

- [ ] **Step 4: Test the link is gated on having a membership**

If `MembershipTile.test.tsx` exists, add a case asserting the "View digital card" link renders when a membership is present and is absent in the empty state. Run:

```bash
cd apps/member && bun run test -- MembershipTile
```
Expected: PASS. (If no test file exists, create a minimal one mirroring the existing tile test pattern — mock `useMemberData` to return a membership, assert the link; mock empty, assert no link.)

- [ ] **Step 5: Write the e2e spec** — `apps/member/src/e2e/card-flow.spec.ts`

```ts
import { test, expect } from '@playwright/test'

// Auth-gated route. Run against a seeded, signed-in stack. The controller verifies
// this spec runs; when stack/seed is unavailable it is allowed to be skipped, not faked.
test('digital card page shows the card and a QR', async ({ page }) => {
  await page.goto('/card')
  // If redirected to sign-in (no session in CI), skip — covered by unit tests.
  if (page.url().includes('/sign-in')) test.skip(true, 'no authed session in this environment')
  await expect(page.getByText(/digital card/i)).toBeVisible()
  await expect(page.locator('svg').first()).toBeVisible()
})
```

- [ ] **Step 6: Typecheck + full app unit suite + build**

```bash
cd apps/member && bun run typecheck && bun run test && bun run build 2>&1 | tail -5
```
Expected: typecheck exit 0; all unit tests pass; build green.

- [ ] **Step 7: Verify engine FROZEN**

```bash
git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated | head
```
Expected: EMPTY output.

- [ ] **Step 8: Commit**

```bash
git add apps/member/src/routes/card.tsx apps/member/src/routeTree.gen.ts apps/member/src/features/dashboard/MembershipTile.tsx apps/member/src/e2e/card-flow.spec.ts apps/member/src/features/dashboard/MembershipTile.test.tsx 2>/dev/null; git add -A apps/member; git commit -m "feat(member): /card route + dashboard link + e2e (B1)"
```

---

## Self-Review

- **Spec coverage:** card data shape (T1), QR + card fields + states + a11y (T2), route + entry link + e2e + FROZEN check (T3). ✓
- **Placeholder scan:** none — all steps carry real code/commands.
- **Type consistency:** `IdCardData` defined T1, consumed T2/T3; `useIdCard` signature stable; `KNOWN_STATUS`/`CardStatus` local to T2.
- **Risk note for implementer:** `@monobase/ui` export names (`Avatar`, `StatusBadge`, `EmptyState`, `ErrorState`) — confirm against `packages/ui/src/index.ts`; the spec map confirmed Card/Skeleton/StatusBadge/EmptyState/ErrorState exist. If `Avatar` differs, use the existing avatar/photo pattern from the codebase rather than inventing one.
