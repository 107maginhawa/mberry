# Publish-event UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Add an events list + publish action to `apps/org` so officer-created draft events become member-visible.

**Architecture:** New `apps/org` UI over FROZEN engine endpoints `searchEvents` (list, returns drafts) and `publishEvent` (draft→published). React-query for list+mutation, same seams as `use-create-event.ts` / `use-roster.ts`.

## Global Constraints

- Engine `services/api-ts` FROZEN — additive-only, no handler/spec/SDK edits.
- DESIGN.md: 18px base, ≥48px tap (`min-h-tap`), tokens from `@monobase/ui` only, labeled controls, one primary task per screen, touch-first, older-dentist a11y.
- **StatusBadge `variant` API for event statuses** (membership `status` prop does NOT know event statuses): draft→`muted`, published→`success`, cancelled→`error`, completed→`muted`, else→`muted`+raw. Labels Draft/Published/Cancelled/Completed.
- `Event`: `{ id, title, status, startDate: Date, endDate: Date, registrationFee?: bigint }`. `status` SDK union is wide (`draft|published|registration_open|registration_closed|in_progress|completed|cancelled`) — only the 4 DB values occur; render others as muted.
- `publishEvent({ path: { eventId } })` POST no-body → 200 `Event`. `searchEvents({ query: { organizationId, pageSize } })` → `{ data: Event[], pagination }`.
- Dates render `toLocaleString('en-PH', { dateStyle:'medium', timeStyle:'short' })`, never ISO.
- Verify: `bun run typecheck` + `cd apps/org && bunx vitest run`.

---

### Task 1: `useOrgEvents` list hook

**Files:** Create `apps/org/src/features/events/use-org-events.ts` + `.test.tsx`

**Produces:**
- `type OrgEvent = { id: string; title: string; status: string; startDate: string | Date; registrationFee?: number }`
- `useOrgEvents(orgId: string | null): { status: 'idle'|'loading'|'ready'|'empty'|'error'; events: OrgEvent[] }`
- Query key `['org-events', orgId]`. Drafts sorted first.

- [ ] **Step 1: Failing test**

```tsx
// use-org-events.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ searchEvents: vi.fn() }))
import { searchEvents } from '@monobase/sdk-ts/generated'
import { ok, err } from '../../test-utils/mock-sdk'
import { useOrgEvents } from './use-org-events'

beforeEach(() => vi.clearAllMocks())
function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useOrgEvents', () => {
  it('maps events and sorts drafts first', async () => {
    vi.mocked(searchEvents).mockResolvedValue(ok({
      data: [
        { id: 'p1', title: 'Pub', status: 'published', startDate: '2026-02-01', registrationFee: 5000n },
        { id: 'd1', title: 'Draft', status: 'draft', startDate: '2026-03-01' },
      ],
      pagination: {},
    } as any))
    const { result } = renderHook(() => useOrgEvents('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.events.map((e) => e.id)).toEqual(['d1', 'p1'])
    expect(result.current.events[1]!.registrationFee).toBe(5000)
  })

  it('empty when no events', async () => {
    vi.mocked(searchEvents).mockResolvedValue(ok({ data: [], pagination: {} } as any))
    const { result } = renderHook(() => useOrgEvents('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('empty'))
  })

  it('error on failure', async () => {
    vi.mocked(searchEvents).mockResolvedValue(err(403, { error: 'nope' }) as any)
    const { result } = renderHook(() => useOrgEvents('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('idle when no org', () => {
    const { result } = renderHook(() => useOrgEvents(null), { wrapper })
    expect(result.current.status).toBe('idle')
  })
})
```

- [ ] **Step 2:** Run → FAIL (missing). `cd apps/org && bunx vitest run src/features/events/use-org-events.test.tsx`

- [ ] **Step 3: Implement**

```ts
// use-org-events.ts
import { useQuery } from '@tanstack/react-query'
import { searchEvents } from '@monobase/sdk-ts/generated'

export type OrgEvent = {
  id: string
  title: string
  status: string
  startDate: string | Date
  registrationFee?: number
}

export function useOrgEvents(
  orgId: string | null,
): { status: 'idle' | 'loading' | 'ready' | 'empty' | 'error'; events: OrgEvent[] } {
  const q = useQuery({
    queryKey: ['org-events', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await searchEvents({ query: { organizationId: orgId!, pageSize: 50 } })
      if (!data) throw new Error((error as any)?.error ?? 'events failed')
      const rows = (data.data ?? []) as Array<{ id: string; title: string; status: string; startDate: string | Date; registrationFee?: bigint }>
      return rows.map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        startDate: e.startDate,
        // registrationFee is bigint at runtime — coerce for display.
        ...(e.registrationFee != null ? { registrationFee: Number(e.registrationFee) } : {}),
      }))
    },
  })
  if (!orgId) return { status: 'idle', events: [] }
  if (q.isLoading) return { status: 'loading', events: [] }
  if (q.isError) return { status: 'error', events: [] }
  const all = q.data ?? []
  // Drafts first (only actionable rows), otherwise preserve server order.
  const events = [...all].sort((a, b) => (a.status === 'draft' ? 0 : 1) - (b.status === 'draft' ? 0 : 1))
  return { status: events.length === 0 ? 'empty' : 'ready', events }
}
```

- [ ] **Step 4:** Run → PASS (4 tests).
- [ ] **Step 5:** Commit `feat(org): useOrgEvents list hook (drafts-first)`.

---

### Task 2: `usePublishEvent` mutation hook

**Files:** Create `apps/org/src/features/events/use-publish-event.ts` + `.test.tsx`

**Produces:** `usePublishEvent(orgId: string | null): { publish: (eventId: string) => void; publishingId: string | null }`. On success invalidates `['org-events', orgId]`.

- [ ] **Step 1: Failing test**

```tsx
// use-publish-event.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ publishEvent: vi.fn() }))
import { publishEvent } from '@monobase/sdk-ts/generated'
import { ok, err } from '../../test-utils/mock-sdk'
import { usePublishEvent } from './use-publish-event'

beforeEach(() => vi.clearAllMocks())
function mk() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const spy = vi.spyOn(qc, 'invalidateQueries')
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, spy, wrapper }
}

describe('usePublishEvent', () => {
  it('publishes by id and invalidates the list on success', async () => {
    vi.mocked(publishEvent).mockResolvedValue(ok({ id: 'd1', status: 'published' } as any))
    const { spy, wrapper } = mk()
    const { result } = renderHook(() => usePublishEvent('o1'), { wrapper })
    act(() => result.current.publish('d1'))
    await waitFor(() => expect(publishEvent).toHaveBeenCalledWith({ path: { eventId: 'd1' } }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['org-events', 'o1'] }))
  })

  it('tracks publishingId while in-flight, clears after', async () => {
    let resolve!: (v: any) => void
    vi.mocked(publishEvent).mockReturnValue(new Promise((r) => { resolve = r }) as any)
    const { wrapper } = mk()
    const { result } = renderHook(() => usePublishEvent('o1'), { wrapper })
    act(() => result.current.publish('d1'))
    await waitFor(() => expect(result.current.publishingId).toBe('d1'))
    act(() => resolve(ok({ id: 'd1' } as any)))
    await waitFor(() => expect(result.current.publishingId).toBeNull())
  })

  it('surfaces error without invalidating', async () => {
    vi.mocked(publishEvent).mockResolvedValue(err(409, { error: 'INVALID_STATUS' }) as any)
    const { spy, wrapper } = mk()
    const { result } = renderHook(() => usePublishEvent('o1'), { wrapper })
    act(() => result.current.publish('d1'))
    await waitFor(() => expect(publishEvent).toHaveBeenCalled())
    expect(spy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3: Implement**

```ts
// use-publish-event.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { publishEvent } from '@monobase/sdk-ts/generated'

export function usePublishEvent(
  orgId: string | null,
): { publish: (eventId: string) => void; publishingId: string | null } {
  const qc = useQueryClient()
  const [publishingId, setPublishingId] = useState<string | null>(null)

  const m = useMutation<void, Error, string>({
    mutationFn: async (eventId) => {
      const { data, error } = await publishEvent({ path: { eventId } })
      if (!data) throw new Error((error as any)?.error ?? 'Could not publish the event.')
    },
    onMutate: (eventId) => { setPublishingId(eventId) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-events', orgId] }) },
    onSettled: () => { setPublishingId(null) },
  })

  return { publish: (id) => { if (!m.isPending) m.mutate(id) }, publishingId }
}
```

- [ ] **Step 4:** Run → PASS (3 tests).
- [ ] **Step 5:** Commit `feat(org): usePublishEvent mutation (invalidate list, track in-flight)`.

---

### Task 3: `EventsList` presentational

**Files:** Create `apps/org/src/features/events/EventsList.tsx` + `.test.tsx`

**Consumes:** `OrgEvent` from `./use-org-events`; `Button, StatusBadge, ConfirmDialog, EmptyState` from `@monobase/ui`.
**Produces:** `EventsList({ events, status, onPublish, publishingId }: { events: OrgEvent[]; status: 'idle'|'loading'|'ready'|'empty'|'error'; onPublish: (id: string) => void; publishingId: string | null })`.

- [ ] **Step 1: Failing test**

```tsx
// EventsList.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventsList } from './EventsList'

const ev = (over: Partial<any> = {}) => ({ id: 'd1', title: 'Spring Assembly', status: 'draft', startDate: '2026-03-01T06:00:00Z', ...over })

describe('EventsList', () => {
  it('shows Publish only on draft rows, with a labeled button', () => {
    render(<EventsList status="ready" publishingId={null} onPublish={() => {}}
      events={[ev(), ev({ id: 'p1', title: 'Gala', status: 'published' })]} />)
    expect(screen.getByRole('button', { name: /publish spring assembly/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /publish gala/i })).not.toBeInTheDocument()
    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('does not render an ISO date string', () => {
    render(<EventsList status="ready" publishingId={null} onPublish={() => {}} events={[ev()]} />)
    expect(screen.queryByText(/2026-03-01T06:00:00Z/)).not.toBeInTheDocument()
  })

  it('Publish opens a confirm; onPublish fires only after confirming', () => {
    const onPublish = vi.fn()
    render(<EventsList status="ready" publishingId={null} onPublish={onPublish} events={[ev()]} />)
    fireEvent.click(screen.getByRole('button', { name: /publish spring assembly/i }))
    expect(onPublish).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))
    expect(onPublish).toHaveBeenCalledWith('d1')
  })

  it('renders loading, error, and empty states', () => {
    const { rerender } = render(<EventsList status="loading" publishingId={null} onPublish={() => {}} events={[]} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    rerender(<EventsList status="error" publishingId={null} onPublish={() => {}} events={[]} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(<EventsList status="empty" publishingId={null} onPublish={() => {}} events={[]} />)
    expect(screen.getByText(/no events yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3: Implement**

```tsx
// EventsList.tsx
import { useState } from 'react'
import { Button, ConfirmDialog, EmptyState, StatusBadge } from '@monobase/ui'
import type { OrgEvent } from './use-org-events'

const STATUS: Record<string, { label: string; variant: 'muted' | 'success' | 'error' }> = {
  draft: { label: 'Draft', variant: 'muted' },
  published: { label: 'Published', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'error' },
  completed: { label: 'Completed', variant: 'muted' },
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

export function EventsList({
  events,
  status,
  onPublish,
  publishingId,
}: {
  events: OrgEvent[]
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error'
  onPublish: (id: string) => void
  publishingId: string | null
}) {
  const [ask, setAsk] = useState<OrgEvent | null>(null)

  if (status === 'loading') {
    return <p role="status" aria-live="polite" className="text-body text-muted-foreground">Loading events…</p>
  }
  if (status === 'error') {
    return (
      <div role="alert" className="rounded-md bg-error-bg border border-error p-3 text-body text-error">
        Could not load events. You may need officer or admin access.
      </div>
    )
  }
  if (status === 'empty' || status === 'idle') {
    return <EmptyState headline="No events yet" description="Create one below and publish it when you’re ready." />
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {events.map((e) => {
          const s = STATUS[e.status] ?? { label: e.status, variant: 'muted' as const }
          return (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-body font-medium text-foreground truncate">{e.title}</span>
                <span className="text-caption text-muted-foreground">{fmtDate(e.startDate)}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge variant={s.variant}>{s.label}</StatusBadge>
                {e.status === 'draft' && (
                  <Button
                    className="min-h-tap"
                    disabled={publishingId === e.id}
                    onClick={() => setAsk(e)}
                    aria-label={`Publish ${e.title}`}
                  >
                    {publishingId === e.id ? 'Publishing…' : 'Publish'}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {ask && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setAsk(null) }}
          title={`Publish ${ask.title}?`}
          description="Members will see this event and can register. You can’t unpublish it here."
          confirmLabel="Publish"
          onConfirm={() => { onPublish(ask.id); setAsk(null) }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4:** Run → PASS (4 tests). If `StatusBadge variant` rejects a value, check its union in `packages/ui` (known: `success|warning|error|info|muted`).
- [ ] **Step 5:** Commit `feat(org): EventsList — status badges + per-row publish + confirm + states`.

---

### Task 4: Wire `events.tsx` + `CreateEventForm onCreated`

**Files:** Modify `apps/org/src/routes/events.tsx`, `apps/org/src/features/events/CreateEventForm.tsx`. Test: `apps/org/src/routes/events.test.tsx` (new).

- [ ] **Step 1: Failing test**

```tsx
// events.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@/features/org/use-org', () => ({ useSelectedOrg: () => ({ orgId: 'o1' }) }))
vi.mock('../features/events/use-org-events', () => ({ useOrgEvents: () => ({ status: 'ready', events: [
  { id: 'd1', title: 'Spring Assembly', status: 'draft', startDate: '2026-03-01T06:00:00Z' },
] }) }))
vi.mock('../features/events/use-publish-event', () => ({ usePublishEvent: () => ({ publish: vi.fn(), publishingId: null }) }))
import { EventsPage } from './events'

function wrapper(ui: React.ReactNode) {
  const qc = new QueryClient()
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('EventsPage', () => {
  it('renders the events list above the create form', () => {
    wrapper(<EventsPage />)
    const list = screen.getByText('Spring Assembly')
    const create = screen.getByText(/create event/i)
    expect(list).toBeInTheDocument()
    expect(create).toBeInTheDocument()
    // list heading precedes the create form in document order
    expect(list.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
```

> Note: export `EventsPage` from `events.tsx` (currently a private function) so it is testable. Keep the `createFileRoute` registration intact.

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3: Implement** — `CreateEventForm` gains `onCreated`:

In `CreateEventForm.tsx`, change the signature and the success handler:
```tsx
export function CreateEventForm({ onCreated }: { onCreated?: () => void } = {}) {
  // ...unchanged...
        onSuccess: () => {
          toast.success('Event created')
          setTitle(''); setStart(''); setEnd(''); setLocation(''); setCapacity(''); setFeePhp(''); setDescription('')
          onCreated?.()
        },
  // ...
}
```

Rewrite `events.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CreateEventForm } from '@/features/events/CreateEventForm'
import { EventsList } from '@/features/events/EventsList'
import { useOrgEvents } from '@/features/events/use-org-events'
import { usePublishEvent } from '@/features/events/use-publish-event'
import { useSelectedOrg } from '@/features/org/use-org'

export const Route = createFileRoute('/events')({ component: EventsPage })

export function EventsPage() {
  const { orgId } = useSelectedOrg()
  const qc = useQueryClient()
  const { status, events } = useOrgEvents(orgId)
  const { publish, publishingId } = usePublishEvent(orgId)

  return (
    <main className="mx-auto max-w-xl p-4 flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h1 className="text-title font-semibold text-foreground">Events</h1>
        <EventsList status={status} events={events} onPublish={publish} publishingId={publishingId} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">Create a new event</h2>
        <CreateEventForm onCreated={() => qc.invalidateQueries({ queryKey: ['org-events', orgId] })} />
      </section>
    </main>
  )
}
```

> `text-lg` is a real token in this project (`text-subtitle` is not). StatusBadge variants verified: `success|warning|error|info|muted|accent`.

- [ ] **Step 4:** Run → PASS. Then full org suite `bunx vitest run` + `bun run typecheck` at repo root.
- [ ] **Step 5:** Commit `feat(org): events page — list above create, refetch on create`.

---

### Task 5: Verify + ship

- [ ] `bun run typecheck` (all workspaces exit 0).
- [ ] `cd apps/org && bunx vitest run` (all green).
- [ ] `/ship` → bump to **v0.1.19.0**, PR to main (squash-merge).

---

## Self-Review

- **Coverage:** list (T1) · publish + invalidate + in-flight (T2) · badges/publish/confirm/states/date (T3) · page order + create-refetch (T4) · verify (T5). All spec sections mapped.
- **Placeholders:** none — real code throughout.
- **Type consistency:** `OrgEvent` defined T1, consumed T3/T4; `useOrgEvents`/`usePublishEvent` signatures match call sites; `EventsList` props match T4 wiring; `onCreated?` additive prop matches the T4 caller.
- **Risk notes:** `StatusBadge` variant union assumed `success|warning|error|info|muted` (verified earlier in `status-badge.tsx`). `text-subtitle` token unverified — T4 step 3 says fall back if absent. `searchEvents` query may need `page/pageSize` vs `offset/limit` — both exist in `SearchEventsData.query`; `pageSize:50` is valid.
