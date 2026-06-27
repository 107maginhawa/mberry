# B4 Member Events Tile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a dashboard EventsTile to apps/member showing upcoming org events with one-tap free RSVP (paid deferred), over frozen handlers.

**Architecture:** `useMemberEvents` queries the public `listPublicEvents` and filters client-side to the member's org + upcoming; `useRsvp` calls `registerForCustomEvent` (empty body, eventId path param). `EventsTile` renders the list with RSVP (free) or a fee + deferred note (paid). Wired into `dashboard.tsx`.

**Tech Stack:** React + TanStack Query, `@monobase/sdk-ts/generated`, `@monobase/ui`, `sonner`, vitest + Playwright, bun.

## Global Constraints

- **Engine FROZEN:** no changes to `services/api-ts/src`, `specs/`, `packages/sdk-ts/src/generated`. `git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated` empty at PR.
- **registrationFee is `bigint`** in the response (transformer) → `Number(registrationFee)` before `centavosToPhp`; `0`/undefined → "Free". Never render a raw bigint.
- **Discovery = `listPublicEvents`** (public, network+published, all-orgs) → client-filter `organizationId === orgId` + upcoming (`startDate >= now`) + not cancelled, sort asc, take 5. Read only `data.data` (pagination drifts — ignore it).
- **RSVP = `registerForCustomEvent({ path: { eventId } })`**, empty body. `409` → friendly "already registered"; `200/201` data has `status` confirmed|waitlisted.
- **Paid deferred:** events with `Number(registrationFee) > 0` show the fee + "Paid registration coming soon" — do NOT call `registerAndPayForEvent`.
- **Typed-bind where clean:** import `Event`, `EventRegistration` types; mocks bound via `ok<...>()`/`err()` (relative `../../test-utils/mock-sdk` if the `@/` alias fails at vitest runtime — confirm the convention used by existing apps/member tests).
- **No-throw SDK:** read `{ data, error, response }`.
- **a11y (DESIGN.md):** 18px base, ≥48px tap RSVP, fee/status as text, RSVP `aria-label` includes the event title, toasts via `sonner`.
- **Version:** bump apps/member chain → v0.1.12.0 at ship.

---

### Task 1: `use-member-events` + `use-rsvp` hooks

**Files:**
- Create: `apps/member/src/features/events/use-member-events.ts`
- Create: `apps/member/src/features/events/use-rsvp.ts`
- Test: `apps/member/src/features/events/use-member-events.test.ts`, `use-rsvp.test.ts`

**Interfaces:**
- Produces: `export function useMemberEvents(): UseQueryResult<Event[]>` (queryKey `['member-events', orgId]`).
- Produces: `export function useRsvp(): UseMutationResult<EventRegistration, Error, { eventId: string }>`.
- Consumes: `listPublicEvents`, `registerForCustomEvent`, `type Event`, `type EventRegistration` from `@monobase/sdk-ts/generated`; `useMemberOrg` from `@/features/org/use-member-org`.

- [ ] **Step 1: Confirm SDK shapes.** In `packages/sdk-ts/src/generated`: `listPublicEvents` returns body `{ data: Event[]; pagination }` and accepts `{ query: { limit } }`; `registerForCustomEvent` accepts `{ path: { eventId } }` with `EventRegistration` (201) response; `Event.status` union includes `'cancelled'`; `Event.registrationFee?: bigint`. Adjust names if they differ; do not weaken the typed bind.

- [ ] **Step 2: Write failing test** — `use-member-events.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { ok } from '../../test-utils/mock-sdk'
import { useMemberEvents } from './use-member-events'

vi.mock('@/features/org/use-member-org', () => ({ useMemberOrg: vi.fn(() => ({ orgId: 'org-1', memberships: [], select: vi.fn() })) }))
vi.mock('@monobase/sdk-ts/generated', () => ({ listPublicEvents: vi.fn() }))
import { useMemberOrg } from '@/features/org/use-member-org'
import { listPublicEvents } from '@monobase/sdk-ts/generated'
const mockList = listPublicEvents as unknown as ReturnType<typeof vi.fn>

const future = new Date(Date.now() + 7 * 864e5).toISOString()
const past = new Date(Date.now() - 7 * 864e5).toISOString()
function ev(over: Record<string, unknown>) {
  return { id: 'e', title: 'E', organizationId: 'org-1', eventType: 'assembly', startDate: future, endDate: future,
    registeredCount: 0, status: 'published', registrationFee: 0n, currency: 'PHP', ...over }
}
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useMemberEvents', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('keeps only this org, upcoming, non-cancelled; sorts asc; caps 5', async () => {
    const later = new Date(Date.now() + 14 * 864e5).toISOString()
    mockList.mockResolvedValue(ok({ data: [
      ev({ id: 'keep2', startDate: later }),
      ev({ id: 'keep1', startDate: future }),
      ev({ id: 'otherorg', organizationId: 'org-2' }),
      ev({ id: 'pastone', startDate: past }),
      ev({ id: 'cancelled', status: 'cancelled' }),
    ], pagination: { total: 5, limit: 50, offset: 0 } }))
    const { result } = renderHook(() => useMemberEvents(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.map((e) => e.id)).toEqual(['keep1', 'keep2'])
  })

  it('is disabled when no orgId', () => {
    ;(useMemberOrg as ReturnType<typeof vi.fn>).mockReturnValueOnce({ orgId: null, memberships: [], select: vi.fn() })
    const { result } = renderHook(() => useMemberEvents(), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})
```

- [ ] **Step 3: Run — expect fail.** `cd apps/member && bun run test -- use-member-events`.

- [ ] **Step 4: Implement** — `use-member-events.ts`

```ts
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { listPublicEvents, type Event } from '@monobase/sdk-ts/generated'
import { useMemberOrg } from '@/features/org/use-member-org'

/** Upcoming events in the member's org (listPublicEvents is network-wide → client-filter). */
export function useMemberEvents(): UseQueryResult<Event[]> {
  const { orgId } = useMemberOrg()
  return useQuery({
    queryKey: ['member-events', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data, response } = await listPublicEvents({ query: { limit: 50 } })
      if (!response || !response.ok) throw new Error(`Events fetch failed: ${response?.status ?? 'no response'}`)
      const all = (data?.data ?? []) as Event[]
      const now = Date.now()
      return all
        .filter((e) => e.organizationId === orgId && e.status !== 'cancelled' && new Date(e.startDate).getTime() >= now)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        .slice(0, 5)
    },
  })
}
```

- [ ] **Step 5: Run — pass.** Then write failing `use-rsvp.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { ok, err } from '../../test-utils/mock-sdk'
import { useRsvp } from './use-rsvp'

vi.mock('@/features/org/use-member-org', () => ({ useMemberOrg: vi.fn(() => ({ orgId: 'org-1', memberships: [], select: vi.fn() })) }))
vi.mock('@monobase/sdk-ts/generated', () => ({ registerForCustomEvent: vi.fn() }))
import { registerForCustomEvent } from '@monobase/sdk-ts/generated'
const mockReg = registerForCustomEvent as unknown as ReturnType<typeof vi.fn>

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useRsvp', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts eventId as a path param (empty body) and returns the registration', async () => {
    mockReg.mockResolvedValue(ok({ id: 'r1', status: 'confirmed' }, 201))
    const { result } = renderHook(() => useRsvp(), { wrapper })
    result.current.mutate({ eventId: 'e1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockReg.mock.calls[0]![0]).toEqual({ path: { eventId: 'e1' } })
    expect(result.current.data!.status).toBe('confirmed')
  })

  it('maps a 409 to a friendly already-registered message', async () => {
    mockReg.mockResolvedValue(err(409, { error: 'You are already registered for this event' }))
    const { result } = renderHook(() => useRsvp(), { wrapper })
    result.current.mutate({ eventId: 'e1' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/already registered/i)
  })
})
```

- [ ] **Step 6: Implement** — `use-rsvp.ts`

```ts
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { registerForCustomEvent, type EventRegistration } from '@monobase/sdk-ts/generated'
import { useMemberOrg } from '@/features/org/use-member-org'

function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
  }
  return undefined
}

export function useRsvp(): UseMutationResult<EventRegistration, Error, { eventId: string }> {
  const { orgId } = useMemberOrg()
  const qc = useQueryClient()
  return useMutation<EventRegistration, Error, { eventId: string }>({
    mutationFn: async ({ eventId }) => {
      const { data, error, response } = await registerForCustomEvent({ path: { eventId } })
      if (response?.status === 409) throw new Error('You are already registered for this event.')
      if (!data) throw new Error(serverError(error) ?? 'Could not RSVP. Please try again.')
      return data as EventRegistration
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-events', orgId] }),
  })
}
```

- [ ] **Step 7: Run both hook tests + typecheck.** `cd apps/member && bun run test -- "use-member-events|use-rsvp" && bun run typecheck` → green.
- [ ] **Step 8: Commit.** `git add apps/member/src/features/events && git commit -m "feat(member): useMemberEvents + useRsvp hooks (B4)"`

---

### Task 2: `EventsTile` component

**Files:**
- Create: `apps/member/src/features/events/EventsTile.tsx`
- Test: `apps/member/src/features/events/EventsTile.test.tsx`

**Interfaces:**
- Consumes: `useMemberEvents`, `useRsvp`; UI from `@monobase/ui` (`Card, CardHeader, CardTitle, CardContent, Button, Skeleton, EmptyState, ErrorState`, `centavosToPhp`); `toast` from `sonner`.

- [ ] **Step 1: Write failing test** — `EventsTile.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EventsTile } from './EventsTile'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const rsvp = { mutate: vi.fn(), isPending: false, variables: undefined as { eventId: string } | undefined }
vi.mock('./use-rsvp', () => ({ useRsvp: () => rsvp }))
vi.mock('./use-member-events', () => ({ useMemberEvents: vi.fn() }))
import { useMemberEvents } from './use-member-events'
const mockEvents = useMemberEvents as ReturnType<typeof vi.fn>

const future = new Date(Date.now() + 7 * 864e5).toISOString()
const freeEvent = { id: 'free', title: 'Free Seminar', organizationId: 'org-1', eventType: 'seminar', startDate: future, endDate: future, registeredCount: 2, capacity: 10, status: 'published', registrationFee: 0n, currency: 'PHP' }
const paidEvent = { id: 'paid', title: 'Gala Dinner', organizationId: 'org-1', eventType: 'social', startDate: future, endDate: future, registeredCount: 0, status: 'published', registrationFee: 150000n, currency: 'PHP' }

describe('EventsTile', () => {
  beforeEach(() => { vi.clearAllMocks(); rsvp.isPending = false; rsvp.variables = undefined })

  it('shows a free event with an RSVP button and no raw bigint', () => {
    mockEvents.mockReturnValue({ isLoading: false, isError: false, data: [freeEvent] })
    const { container } = render(<EventsTile />)
    expect(screen.getByText('Free Seminar')).toBeInTheDocument()
    expect(screen.getByText(/free/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rsvp to free seminar/i })).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/NaN|undefined|\d+n/)
  })

  it('shows a paid event with the fee and the deferred note, no RSVP button', () => {
    mockEvents.mockReturnValue({ isLoading: false, isError: false, data: [paidEvent] })
    render(<EventsTile />)
    expect(screen.getByText(/₱1,500\.00/)).toBeInTheDocument()
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rsvp to gala dinner/i })).not.toBeInTheDocument()
  })

  it('loading → skeleton, error → error state, empty → empty state', () => {
    mockEvents.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    const { container, rerender } = render(<EventsTile />)
    expect(container.querySelector('.animate-pulse, [data-slot="skeleton"]')).toBeTruthy()
    mockEvents.mockReturnValue({ isLoading: false, isError: true, data: undefined })
    rerender(<EventsTile />)
    expect(screen.getByText(/could not load|refresh/i)).toBeInTheDocument()
    mockEvents.mockReturnValue({ isLoading: false, isError: false, data: [] })
    rerender(<EventsTile />)
    expect(screen.getByText(/no upcoming events/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect fail.** `cd apps/member && bun run test -- EventsTile`.

- [ ] **Step 3: Implement** — `EventsTile.tsx`

```tsx
import { Card, CardHeader, CardTitle, CardContent, Button, Skeleton, EmptyState, ErrorState, centavosToPhp } from '@monobase/ui'
import { toast } from 'sonner'
import type { Event } from '@monobase/sdk-ts/generated'
import { useMemberEvents } from './use-member-events'
import { useRsvp } from './use-rsvp'

function Title() {
  return <CardTitle className="text-body font-semibold text-muted-foreground">Upcoming events</CardTitle>
}

export function EventsTile() {
  const { isLoading, isError, data } = useMemberEvents()
  const rsvp = useRsvp()

  if (isLoading) {
    return <Card><CardHeader><Title /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardContent></Card>
  }
  if (isError) {
    return <Card><CardHeader><Title /></CardHeader><CardContent><ErrorState message="Could not load events. Please refresh." /></CardContent></Card>
  }
  if (!data || data.length === 0) {
    return <Card><CardHeader><Title /></CardHeader><CardContent><EmptyState headline="No upcoming events" description="Check back later for chapter events." /></CardContent></Card>
  }

  function onRsvp(ev: Event) {
    rsvp.mutate({ eventId: ev.id }, {
      onSuccess: (reg) => toast.success(reg.status === 'waitlisted' ? 'Added to the waitlist' : "You're registered"),
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <Card>
      <CardHeader><Title /></CardHeader>
      <CardContent className="space-y-4">
        {data.map((ev) => {
          const fee = ev.registrationFee ? Number(ev.registrationFee) : 0
          const isPaid = fee > 0
          const spotsLeft = ev.capacity != null ? ev.capacity - (ev.registeredCount ?? 0) : null
          const pendingThis = rsvp.isPending && rsvp.variables?.eventId === ev.id
          return (
            <div key={ev.id} className="space-y-1 border-b pb-3 last:border-b-0 last:pb-0">
              <p className="text-body font-semibold text-foreground">{ev.title}</p>
              <p className="text-body text-muted-foreground">{new Date(ev.startDate).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              {ev.location && <p className="text-body text-muted-foreground">{ev.location}</p>}
              <p className="text-body text-foreground">{isPaid ? centavosToPhp(fee) : 'Free'}{spotsLeft != null && ` · ${spotsLeft} spots left`}</p>
              {isPaid
                ? <p className="text-body text-muted-foreground">Paid registration coming soon.</p>
                : <Button className="min-h-[48px]" disabled={pendingThis} aria-label={`RSVP to ${ev.title}`} onClick={() => onRsvp(ev)}>{pendingThis ? 'RSVPing…' : 'RSVP'}</Button>}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
```

> Confirm `centavosToPhp`, `EmptyState`, `ErrorState`, `Skeleton`, `Button` import names against `packages/ui/src/index.ts` (the other member tiles use them). `Event.id`/`registrationFee`/`capacity`/`registeredCount`/`location`/`startDate` are read from the typed `Event`.

- [ ] **Step 4: Run — pass + typecheck.** `cd apps/member && bun run test -- EventsTile && bun run typecheck`.
- [ ] **Step 5: Commit.** `git add apps/member/src/features/events && git commit -m "feat(member): EventsTile (B4)"`

---

### Task 3: dashboard wire + e2e + FROZEN verify

**Files:**
- Modify: `apps/member/src/routes/dashboard.tsx` (add `<EventsTile/>` after `<ReceiptsTile/>`)
- Create: `apps/member/src/e2e/events-tile.spec.ts`

- [ ] **Step 1: Wire the tile.** In `apps/member/src/routes/dashboard.tsx` add `import { EventsTile } from '@/features/events/EventsTile'` and render `<EventsTile />` after `<ReceiptsTile />` (before the "View digital card" link).

- [ ] **Step 2: e2e** — `apps/member/src/e2e/events-tile.spec.ts`

```ts
import { test, expect } from '@playwright/test'

test('dashboard shows the upcoming events tile', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
  if (page.url().includes('/sign-in')) test.skip(true, 'no authed session in this environment')
  await expect(page.getByText(/upcoming events/i)).toBeVisible()
})
```

- [ ] **Step 3: Full verification.** `cd apps/member && bun run typecheck && bun run test && bun run build 2>&1 | tail -5`. Typecheck (incl tests) exit 0; all unit tests pass; build green.
- [ ] **Step 4: Engine FROZEN.** `git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated | head` → EMPTY.
- [ ] **Step 5: Commit.** `git add -A apps/member && git commit -m "feat(member): wire EventsTile into dashboard + e2e (B4)"`

---

## Self-Review

- **Spec coverage:** discovery+filter hook + RSVP hook (T1), tile with free/paid/states (T2), dashboard wire + e2e + FROZEN (T3). Paid deferred (note only); coherence gap flagged in spec. ✓
- **Placeholder scan:** none — full code in every step; SDK-confirm steps are explicit read+adjust.
- **Type consistency:** `useMemberEvents`/`useRsvp` (T1) consumed by `EventsTile` (T2); `Event`/`EventRegistration` are generated types (confirm in T1 Step 1).
- **Risk notes:** (a) `listPublicEvents`/`registerForCustomEvent` option shapes — confirm in T1 Step 1. (b) `Event.registrationFee` bigint → always `Number()` before `centavosToPhp`; the EventsTile test guards `/\d+n/`. (c) mock-sdk import path: use the convention existing apps/member tests use (B1 used `vi.mock` factories; ok/err from test-utils — confirm relative vs `@/`).
