# B4 Member Events Tile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a dashboard EventsTile to apps/member showing upcoming org events with one-tap free RSVP (paid deferred), over frozen handlers.

**Architecture:** `useMemberEvents` queries the public `listPublicEvents` and filters client-side to the member's org + upcoming; `useRsvp` calls `registerForCustomEvent` (empty body, eventId path param). `EventsTile` renders the list with RSVP (free) or a fee + deferred note (paid). Wired into `dashboard.tsx`.

**Tech Stack:** React + TanStack Query, `@monobase/sdk-ts/generated`, `@monobase/ui`, `sonner`, vitest + Playwright, bun.

## Global Constraints

- **Engine FROZEN:** no changes to `services/api-ts/src`, `specs/`, `packages/sdk-ts/src/generated`. `git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated` empty at PR.
- **registrationFee is `bigint`** in the response (transformer) → `Number(registrationFee)` before `centavosToPhp`; `0`/undefined → "Free". Never render a raw bigint.
- **Discovery = `listPublicEvents`** (public, network + published/completed, all-orgs) → client-filter `organizationId === orgId` + **`status === 'published'`** (RSVP only works on published; drops cancelled/completed/draft) + upcoming (`startDate >= now`), sort asc, take 5. Pass `query.dateFrom = now` to narrow before the 50-cap. Read only `data.data` (pagination drifts — ignore it).
- **RSVP = `registerForCustomEvent({ path: { eventId } })`**, empty body. **Verified against the WIRED handler (`handlers/association:operations/registerForCustomEvent.ts`) — do NOT trust the generated type here:**
  - It calls a naive `createOne` with **no already-registered guard**: a duplicate RSVP raises Postgres 23505 with **no 23505→ConflictError catch → the API returns 500, NOT 409.** So there is **no 409 path** — do not branch on `response.status === 409`. Prevent the duplicate in the UI instead: after a successful RSVP, mark that event "Registered" and disable its button.
  - **Waitlist (capacity full) returns `{ ...waitlistEntry, waitlisted: true }` — a WaitlistEntry with NO `status` field.** The confirmed path returns an EventRegistration. So detect waitlist via the **`waitlisted` boolean flag**, never `reg.status`. The hook result is the union `EventRegistration | { waitlisted: true }`.
  - It throws `BusinessLogicError` unless `event.status === 'published'` — another reason the list is filtered to published only.
- **Paid deferred:** events with `Number(registrationFee) > 0` show the fee + "Paid registration coming soon" — do NOT call `registerAndPayForEvent`.
- **Typed-bind where clean:** import `Event` type for the list (organizationId/registrationFee/status/capacity/registeredCount all on it). The RSVP response is drift-prone (union, type lies) → read defensively (`'waitlisted' in reg`), cast with a comment. Mocks bound via `ok<...>()`/`err()` from **`@/test-utils/mock-sdk`** (the apps/member convention — `use-session.test.tsx`/`use-member-data.test.tsx` use the `@/` alias and it works at vitest runtime here, unlike apps/org).
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
import { ok } from '@/test-utils/mock-sdk'
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
      const { data, response } = await listPublicEvents({ query: { limit: 50, dateFrom: new Date().toISOString() } })
      if (!response || !response.ok) throw new Error(`Events fetch failed: ${response?.status ?? 'no response'}`)
      const all = (data?.data ?? []) as Event[]
      const now = Date.now()
      // status==='published' only — the wired RSVP handler rejects non-published; also drops cancelled/completed/draft.
      return all
        .filter((e) => e.organizationId === orgId && e.status === 'published' && new Date(e.startDate).getTime() >= now)
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
import { ok, err } from '@/test-utils/mock-sdk'
import { useRsvp, isWaitlisted } from './use-rsvp'

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

  it('posts eventId as a path param (empty body); confirmed result is not waitlisted', async () => {
    // confirmed path → EventRegistration (real wired handler)
    mockReg.mockResolvedValue(ok({ id: 'r1', status: 'confirmed' }, 201))
    const { result } = renderHook(() => useRsvp(), { wrapper })
    result.current.mutate({ eventId: 'e1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockReg.mock.calls[0]![0]).toEqual({ path: { eventId: 'e1' } })
    expect(isWaitlisted(result.current.data!)).toBe(false)
  })

  it('detects a waitlisted result via the waitlisted flag (real shape has NO status)', async () => {
    // capacity-full path → { ...waitlistEntry, waitlisted: true }, NO status field
    mockReg.mockResolvedValue(ok({ id: 'w1', waitlisted: true }, 201))
    const { result } = renderHook(() => useRsvp(), { wrapper })
    result.current.mutate({ eventId: 'e1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(isWaitlisted(result.current.data!)).toBe(true)
  })

  it('throws a generic error on engine failure (a duplicate RSVP 500s — there is no 409)', async () => {
    mockReg.mockResolvedValue(err(500, { error: 'Internal Server Error' }))
    const { result } = renderHook(() => useRsvp(), { wrapper })
    result.current.mutate({ eventId: 'e1' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/could not rsvp|internal server error/i)
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

// The wired handler returns EventRegistration (confirmed) OR a WaitlistEntry spread with { waitlisted: true }
// (capacity full). The waitlist branch has NO `status` field — detect waitlist via the flag, never status.
export type RsvpResult = EventRegistration | { waitlisted: true }

export function isWaitlisted(reg: RsvpResult): boolean {
  return typeof reg === 'object' && reg !== null && 'waitlisted' in reg && (reg as { waitlisted?: boolean }).waitlisted === true
}

export function useRsvp(): UseMutationResult<RsvpResult, Error, { eventId: string }> {
  const { orgId } = useMemberOrg()
  const qc = useQueryClient()
  return useMutation<RsvpResult, Error, { eventId: string }>({
    mutationFn: async ({ eventId }) => {
      // No 409 from this handler — a duplicate RSVP raises 23505 → 500 (no ConflictError catch).
      // The UI prevents re-submit by disabling the button after a successful RSVP.
      const { data, error } = await registerForCustomEvent({ path: { eventId } })
      if (!data) throw new Error(serverError(error) ?? 'Could not RSVP. Please try again.')
      return data as RsvpResult
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
import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Skeleton, EmptyState, ErrorState, centavosToPhp } from '@monobase/ui'
import { toast } from 'sonner'
import type { Event } from '@monobase/sdk-ts/generated'
import { useMemberEvents } from './use-member-events'
import { useRsvp, isWaitlisted } from './use-rsvp'

function Title() {
  return <CardTitle className="text-body font-semibold text-muted-foreground">Upcoming events</CardTitle>
}

export function EventsTile() {
  const { isLoading, isError, data } = useMemberEvents()
  const rsvp = useRsvp()
  // Track local RSVPs so we disable the button after success — the engine has NO 409, a re-RSVP would 500.
  const [registered, setRegistered] = useState<Set<string>>(new Set())

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
      onSuccess: (reg) => {
        setRegistered((s) => new Set(s).add(ev.id))
        toast.success(isWaitlisted(reg) ? 'Added to the waitlist' : "You're registered")
      },
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
          const isRegistered = registered.has(ev.id)
          return (
            <div key={ev.id} className="space-y-1 border-b pb-3 last:border-b-0 last:pb-0">
              <p className="text-body font-semibold text-foreground">{ev.title}</p>
              <p className="text-body text-muted-foreground">{new Date(ev.startDate).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              {ev.location && <p className="text-body text-muted-foreground">{ev.location}</p>}
              <p className="text-body text-foreground">{isPaid ? centavosToPhp(fee) : 'Free'}{spotsLeft != null && ` · ${spotsLeft} spots left`}</p>
              {isPaid
                ? <p className="text-body text-muted-foreground">Paid registration coming soon.</p>
                : <Button className="min-h-[48px]" disabled={pendingThis || isRegistered} aria-label={`RSVP to ${ev.title}`} onClick={() => onRsvp(ev)}>{isRegistered ? 'Registered' : pendingThis ? 'RSVPing…' : 'RSVP'}</Button>}
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
- **Verified facts (from adversarial review — do not re-litigate):** RSVP handler has **no 409** (dup → 500), waitlist returns `{ ...waitlistEntry, waitlisted: true }` (no `status`) → detect via `isWaitlisted()` flag, disable button after success to prevent the dup-500; RSVP requires `status==='published'` → list filtered to published; `Event.organizationId`/`registrationFee`(bigint)/`status`(incl cancelled)/`capacity`/`registeredCount` are all on the typed `Event`; `centavosToPhp`/`EmptyState`/`ErrorState`/`Skeleton`/`Button`/`Card*` exist; apps/member tests use the `@/test-utils/mock-sdk` alias (works at vitest runtime here, unlike apps/org).
- **Still confirm at T1 Step 1:** exact generated names for `listPublicEvents`/`registerForCustomEvent` and that `listPublicEvents` accepts `query.dateFrom`. Adjust calls if names differ; never weaken the typed bind.
- **Coherence gap (carry to backlog/Wave C):** B3 events are draft + default visibility → invisible to `listPublicEvents` (network+published) until an officer publish/network-visibility UI exists. B4 is correct vs the discovery contract; the tile will read empty for B3 data until then.
