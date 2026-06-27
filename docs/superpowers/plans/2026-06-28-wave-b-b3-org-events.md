# B3 Org Minimal Events — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add officer "create event (optional fee)" and "post announcement" forms to apps/org, over frozen engine handlers.

**Architecture:** Two single-task authed routes (`/events`, `/announcements`), each a form backed by a `useMutation` hook calling the generated SDK (`createEvent`, `createAnnouncement`). Request bodies bind to the typed SDK request types (they match the handler validators — wrong field = compile error). Entry links on the dashboard.

**Tech Stack:** React + TanStack Router + TanStack Query, `@monobase/sdk-ts/generated`, `@monobase/ui`, `sonner`, vitest + Playwright, bun.

## Global Constraints

- **Engine FROZEN:** no changes to `services/api-ts/src`, `specs/`, `packages/sdk-ts/src/generated`. `git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated` empty at PR.
- **registrationFee: the generated `EventCreateRequest` type is `bigint`** (the wire validator is `z.number().int()`; the SDK bodySerializer converts bigint→number). So at the typed seam send `BigInt(Math.round(php*100))` — mirror the shipped house pattern `apps/org/src/features/paylink/use-send-link.ts` (`amount: BigInt(amount)`). Omit when blank.
- **startDate/endDate: the generated `EventCreateRequest` types them as `Date`** (not string). Pass `new Date(isoString)`; JSON-serializes to ISO which the validator accepts.
- **creditBearing is REQUIRED** in the event validator → always send `creditBearing: false`.
- **endDate**: the handler non-null-asserts it (`body.endDate!`) → make endDate a required form field.
- **2FA-in-prod — BOTH forms.** `requirePositionMiddleware` sets `requestingPrivileged = allowedTitles.some(privileged)`; events allow `['Society Officer','President']` and President IS privileged → **the whole event route enforces 2FA in prod**, same as announcements (`['President','Secretary']`). So in prod a pilot officer without 2FA gets 403 on BOTH create-event and post-announcement (dev/e2e skip via `NODE_ENV!=='production'`). A 403 (`Officer access required` / `Two-factor authentication required`) must surface as a friendly `role="alert"`, never a crash. **Both forms show an up-front 2FA note.** This is a founder-facing prod gate — flag it for the Wave C checklist (Dr. Olive must enable 2FA before first-peso event creation).
- **Typed-bind requests:** bodies are typed `EventCreateRequest` / `AnnouncementCreateRequest`. **Confirm the exact import names + the SDK fn option shape (body vs path) in `packages/sdk-ts/src/generated`** before coding — do NOT invent field names.
- **No-throw SDK:** read `{ data, error }`; `if (!data) throw new Error(serverError(error) ?? '<fallback>')`. Mirror `apps/org/src/features/roster-import/use-import-roster.ts`.
- **a11y (DESIGN.md):** 18px base, ≥48px tap, every input `<label htmlFor>`, errors `role="alert"`, native `<select>`/`<input type=datetime-local>`, one primary task per route, submit disabled while pending or orgId null.
- **Scope: CREATE-only.** No list/manage views (no clean officer list endpoint).
- **Version:** bump apps/org chain at ship → v0.1.11.0.

---

### Task 1: `use-create-event` hook

**Files:**
- Create: `apps/org/src/features/events/use-create-event.ts`
- Test: `apps/org/src/features/events/use-create-event.test.ts`

**Interfaces:**
- Produces: `export interface CreateEventInput { title; eventType; startDate: string /*ISO*/; endDate: string /*ISO*/; location?: string; capacity?: number; feePhp?: number; description?: string }` and `export function useCreateEvent(orgId: string | null): UseMutationResult<Event, Error, CreateEventInput>`.
- Consumes: `createEvent`, `type EventCreateRequest`, `type Event` from `@monobase/sdk-ts/generated`.

- [ ] **Step 1: Confirm SDK shapes.** Read `packages/sdk-ts/src/generated` for `createEvent` — its `Options` body type (`EventCreateRequest` / `CreateEventData['body']`) and the `Event` response type. Confirm fields: `organizationId, title, eventType, startDate, endDate, creditBearing, registrationFee?, currency?, capacity?, location?, description?`. Note the exact field/type names; adjust code below if names differ.

- [ ] **Step 2: Write the failing test** — `use-create-event.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { ok, err } from '@/test-utils/mock-sdk'
import { useCreateEvent } from './use-create-event'

vi.mock('@monobase/sdk-ts/generated', () => ({ createEvent: vi.fn() }))
import { createEvent } from '@monobase/sdk-ts/generated'
const mockCreate = createEvent as unknown as ReturnType<typeof vi.fn>

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

const BASE = { title: 'AGM', eventType: 'assembly', startDate: '2026-09-01T01:00:00.000Z', endDate: '2026-09-01T05:00:00.000Z' }

describe('useCreateEvent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends a typed body with fee as bigint centavos, Date objects + creditBearing false', async () => {
    mockCreate.mockResolvedValue(ok({ id: 'e1' }, 201))
    const { result } = renderHook(() => useCreateEvent('org-1'), { wrapper })
    result.current.mutate({ ...BASE, feePhp: 250 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const body = mockCreate.mock.calls[0]![0].body
    expect(body.organizationId).toBe('org-1')
    expect(body.title).toBe('AGM')
    expect(body.eventType).toBe('assembly')
    expect(body.creditBearing).toBe(false)
    expect(body.registrationFee).toBe(25000n) // bigint at the typed seam
    expect(body.currency).toBe('PHP')
    expect(body.startDate).toBeInstanceOf(Date)
    expect(body.startDate.toISOString()).toBe(BASE.startDate)
    expect(body.endDate.toISOString()).toBe(BASE.endDate)
  })

  it('omits registrationFee when feePhp is blank/zero', async () => {
    mockCreate.mockResolvedValue(ok({ id: 'e2' }, 201))
    const { result } = renderHook(() => useCreateEvent('org-1'), { wrapper })
    result.current.mutate({ ...BASE })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockCreate.mock.calls[0]![0].body.registrationFee).toBeUndefined()
  })

  it('throws the server error message on 403', async () => {
    mockCreate.mockResolvedValue(err(403, { error: 'Two-factor authentication required' }))
    const { result } = renderHook(() => useCreateEvent('org-1'), { wrapper })
    result.current.mutate({ ...BASE })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/two-factor/i)
  })
})
```

- [ ] **Step 3: Run — expect fail.** `cd apps/org && bun run test -- use-create-event` → FAIL.

- [ ] **Step 4: Implement** — `use-create-event.ts`

```ts
import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { createEvent, type EventCreateRequest, type Event } from '@monobase/sdk-ts/generated'

export interface CreateEventInput {
  title: string
  eventType: string
  startDate: string // ISO
  endDate: string   // ISO
  location?: string
  capacity?: number
  feePhp?: number
  description?: string
}

function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
  }
  return undefined
}

export function useCreateEvent(orgId: string | null): UseMutationResult<Event, Error, CreateEventInput> {
  return useMutation<Event, Error, CreateEventInput>({
    mutationFn: async (input) => {
      if (!orgId) throw new Error('No organization selected.')
      // EventCreateRequest types registrationFee as bigint + dates as Date (see use-send-link.ts house pattern).
      const fee = input.feePhp && input.feePhp > 0 ? BigInt(Math.round(input.feePhp * 100)) : undefined
      const body: EventCreateRequest = {
        organizationId: orgId,
        title: input.title,
        eventType: input.eventType as EventCreateRequest['eventType'],
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        creditBearing: false,
        ...(fee !== undefined ? { registrationFee: fee, currency: 'PHP' } : {}),
        ...(input.capacity ? { capacity: input.capacity } : {}),
        ...(input.location ? { location: input.location } : {}),
        ...(input.description ? { description: input.description } : {}),
      }
      const { data, error } = await createEvent({ body })
      if (!data) throw new Error(serverError(error) ?? 'Could not create the event.')
      return data as Event
    },
  })
}
```

> Verified in Step 1: `EventCreateRequest` types `registrationFee` as `bigint` and `startDate`/`endDate` as `Date` — the code above already handles both (`BigInt(...)`, `new Date(...)`). JSON serialization sends number + ISO, which the wire validator (`z.number().int()` / `z.string().datetime()`) accepts. If Step 1 shows a field name differs, adjust — do not weaken the typed bind.

- [ ] **Step 5: Run — expect pass.** `cd apps/org && bun run test -- use-create-event`.
- [ ] **Step 6: Typecheck.** `cd apps/org && bun run typecheck` → exit 0. (A wrong field on `EventCreateRequest` fails here.)
- [ ] **Step 7: Commit.** `git add apps/org/src/features/events && git commit -m "feat(org): useCreateEvent hook (B3)"`

---

### Task 2: `CreateEventForm` + `/events` route

**Files:**
- Create: `apps/org/src/features/events/CreateEventForm.tsx`
- Create: `apps/org/src/routes/events.tsx`
- Modify: `apps/org/src/routeTree.gen.ts` (regenerated)
- Test: `apps/org/src/features/events/CreateEventForm.test.tsx`

**Interfaces:**
- Consumes: `useCreateEvent`, `CreateEventInput`; `useSelectedOrg` from `@/features/org/use-org`; UI from `@monobase/ui`; `toast` from `sonner`.

- [ ] **Step 1: Write the failing test** — `CreateEventForm.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateEventForm } from './CreateEventForm'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/features/org/use-org', () => ({ useSelectedOrg: vi.fn(() => ({ orgId: 'org-1', setOrgId: vi.fn() })) }))
const mutate = vi.fn()
let state = { mutate, isPending: false, isError: false, error: null as Error | null }
vi.mock('./use-create-event', () => ({ useCreateEvent: () => state }))
import { useSelectedOrg } from '@/features/org/use-org'

describe('CreateEventForm', () => {
  beforeEach(() => { vi.clearAllMocks(); state = { mutate, isPending: false, isError: false, error: null } })

  it('renders labeled fields and submits a typed input', async () => {
    render(<CreateEventForm />)
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'AGM' } })
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'assembly' } })
    fireEvent.change(screen.getByLabelText(/start/i), { target: { value: '2026-09-01T09:00' } })
    fireEvent.change(screen.getByLabelText(/end/i), { target: { value: '2026-09-01T13:00' } })
    fireEvent.click(screen.getByRole('button', { name: /create event/i }))
    await waitFor(() => expect(mutate).toHaveBeenCalled())
    const arg = mutate.mock.calls[0][0]
    expect(arg.title).toBe('AGM')
    expect(typeof arg.startDate).toBe('string')
  })

  it('disables submit when no org selected', () => {
    ;(useSelectedOrg as ReturnType<typeof vi.fn>).mockReturnValueOnce({ orgId: null, setOrgId: vi.fn() })
    render(<CreateEventForm />)
    expect(screen.getByRole('button', { name: /create event/i })).toBeDisabled()
  })

  it('rejects endDate before startDate (client-side) without calling mutate', async () => {
    render(<CreateEventForm />)
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'AGM' } })
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'assembly' } })
    fireEvent.change(screen.getByLabelText(/start/i), { target: { value: '2026-09-01T13:00' } })
    fireEvent.change(screen.getByLabelText(/end/i), { target: { value: '2026-09-01T09:00' } })
    fireEvent.click(screen.getByRole('button', { name: /create event/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(mutate).not.toHaveBeenCalled()
  })

  it('shows a friendly alert on a 403 error', () => {
    state = { mutate, isPending: false, isError: true, error: new Error('Two-factor authentication required') }
    render(<CreateEventForm />)
    expect(screen.getByRole('alert')).toHaveTextContent(/two-factor/i)
  })
})
```

- [ ] **Step 2: Run — expect fail.** `cd apps/org && bun run test -- CreateEventForm`.

- [ ] **Step 3: Implement** — `CreateEventForm.tsx`

```tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Textarea } from '@monobase/ui'
import { useSelectedOrg } from '@/features/org/use-org'
import { useCreateEvent } from './use-create-event'

const EVENT_TYPES = ['assembly', 'seminar', 'social', 'networking', 'fundraiser', 'governance', 'custom'] as const

export function CreateEventForm() {
  const { orgId } = useSelectedOrg()
  const create = useCreateEvent(orgId)
  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState<string>('assembly')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [location, setLocation] = useState('')
  const [capacity, setCapacity] = useState('')
  const [feePhp, setFeePhp] = useState('')
  const [description, setDescription] = useState('')
  const [clientError, setClientError] = useState<string | null>(null)

  const serverMessage = create.isError ? (create.error?.message ?? 'Could not create the event.') : null
  const alertMessage = clientError ?? serverMessage

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setClientError(null)
    if (!orgId) return
    if (!title || !start || !end) { setClientError('Title, start, and end are required.'); return }
    if (new Date(end) < new Date(start)) { setClientError('End time must be after the start time.'); return }
    const fee = feePhp ? Number(feePhp) : undefined
    if (fee !== undefined && (Number.isNaN(fee) || fee < 0)) { setClientError('Fee must be a non-negative amount.'); return }
    create.mutate(
      {
        title, eventType,
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString(),
        ...(location ? { location } : {}),
        ...(capacity ? { capacity: Number(capacity) } : {}),
        ...(fee !== undefined ? { feePhp: fee } : {}),
        ...(description ? { description } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Event created')
          setTitle(''); setStart(''); setEnd(''); setLocation(''); setCapacity(''); setFeePhp(''); setDescription('')
        },
        onError: () => toast.error('Could not create the event'),
      },
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>Create event</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-body text-muted-foreground">
          Creating events requires a Society Officer or President; the President/Treasurer/Secretary roles also
          require two-factor authentication in production.
        </p>
        {!orgId && <p className="text-body text-muted-foreground">Select an organization first.</p>}
        {alertMessage && <p role="alert" className="mb-3 text-body text-destructive">{alertMessage}</p>}
        <form onSubmit={onSubmit} className="space-y-4">
          <div><Label htmlFor="ev-title">Title</Label><Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div>
            <Label htmlFor="ev-type">Type</Label>
            {/* ponytail: native <select> on purpose — @monobase/ui Select is Radix (36px trigger < 48px a11y floor,
                and not drivable via getByLabelText+fireEvent.change in tests). Native is taller + keyboard/label native. */}
            <select id="ev-type" value={eventType} onChange={(e) => setEventType(e.target.value)}
              className="min-h-[48px] w-full rounded-md border bg-background px-3 text-body">
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><Label htmlFor="ev-start">Start</Label><Input id="ev-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
          <div><Label htmlFor="ev-end">End</Label><Input id="ev-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required /></div>
          <div><Label htmlFor="ev-loc">Location (optional)</Label><Input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div><Label htmlFor="ev-cap">Capacity (optional)</Label><Input id="ev-cap" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
          <div><Label htmlFor="ev-fee">Registration fee in PHP (optional)</Label><Input id="ev-fee" type="number" min={0} step="0.01" value={feePhp} onChange={(e) => setFeePhp(e.target.value)} /></div>
          <div><Label htmlFor="ev-desc">Description (optional)</Label><Textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <Button type="submit" disabled={!orgId || create.isPending} className="min-h-[48px]">
            {create.isPending ? 'Creating…' : 'Create event'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

> `Input`, `Label`, `Button`, `Textarea` all exist in `@monobase/ui` (verified) — the roster/dues forms use them. Mirror those forms' structure (useState per field + onSubmit + `role="alert"`). Keep the native `<select>` (justified in the comment above) rather than the Radix `Select`.

- [ ] **Step 4: Create the route** — `apps/org/src/routes/events.tsx`

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { CreateEventForm } from '@/features/events/CreateEventForm'

export const Route = createFileRoute('/events')({ component: EventsPage })

function EventsPage() {
  return (
    <main className="mx-auto max-w-xl p-4">
      <Link to="/" className="mb-4 inline-flex min-h-[48px] items-center text-body font-medium text-primary underline">← Back to dashboard</Link>
      <CreateEventForm />
    </main>
  )
}
```

- [ ] **Step 5: Regenerate route tree.** `cd apps/org && bun run build 2>&1 | tail -10`. Confirm `routeTree.gen.ts` contains `/events`. COMMIT the regenerated file. (Do this before relying on a typed `Link to="/events"`.)
- [ ] **Step 6: Run tests + typecheck.** `cd apps/org && bun run test -- CreateEventForm && bun run typecheck`.
- [ ] **Step 7: Commit.** `git add -A apps/org && git commit -m "feat(org): CreateEventForm + /events route (B3)"`

---

### Task 3: `use-create-announcement` hook + `CreateAnnouncementForm` + `/announcements` route

**Files:**
- Create: `apps/org/src/features/announcements/use-create-announcement.ts`
- Create: `apps/org/src/features/announcements/CreateAnnouncementForm.tsx`
- Create: `apps/org/src/routes/announcements.tsx`
- Modify: `apps/org/src/routeTree.gen.ts`
- Test: `apps/org/src/features/announcements/use-create-announcement.test.ts`, `CreateAnnouncementForm.test.tsx`

**Interfaces:**
- Produces: `export function useCreateAnnouncement(orgId: string|null): UseMutationResult<Announcement, Error, { title: string; content: string }>`.
- Consumes: `createAnnouncement`, `type Announcement` from `@monobase/sdk-ts/generated`.

- [ ] **Step 1: Confirm SDK shape.** Read `createAnnouncement` in `packages/sdk-ts/src/generated`: is orgId a `path: { organizationId }` option, and the body `{ title, content, ... }`? Confirm before coding.

- [ ] **Step 2: Write failing hook test** — `use-create-announcement.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { ok, err } from '@/test-utils/mock-sdk'
import { useCreateAnnouncement } from './use-create-announcement'

vi.mock('@monobase/sdk-ts/generated', () => ({ createAnnouncement: vi.fn() }))
import { createAnnouncement } from '@monobase/sdk-ts/generated'
const mockCreate = createAnnouncement as unknown as ReturnType<typeof vi.fn>

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useCreateAnnouncement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends path orgId + typed body', async () => {
    mockCreate.mockResolvedValue(ok({ id: 'a1' }, 201))
    const { result } = renderHook(() => useCreateAnnouncement('org-1'), { wrapper })
    result.current.mutate({ title: 'Dues due', content: 'Pay by Friday' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const opts = mockCreate.mock.calls[0]![0]
    expect(opts.path).toEqual({ organizationId: 'org-1' })
    expect(opts.body).toMatchObject({ title: 'Dues due', content: 'Pay by Friday' })
  })

  it('throws server error on 403', async () => {
    mockCreate.mockResolvedValue(err(403, { error: 'Two-factor authentication required' }))
    const { result } = renderHook(() => useCreateAnnouncement('org-1'), { wrapper })
    result.current.mutate({ title: 't', content: 'c' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/two-factor/i)
  })
})
```

- [ ] **Step 3: Run — expect fail.**

- [ ] **Step 4: Implement** — `use-create-announcement.ts`

```ts
import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { createAnnouncement, type Announcement } from '@monobase/sdk-ts/generated'

function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
  }
  return undefined
}

export function useCreateAnnouncement(orgId: string | null): UseMutationResult<Announcement, Error, { title: string; content: string }> {
  return useMutation<Announcement, Error, { title: string; content: string }>({
    mutationFn: async ({ title, content }) => {
      if (!orgId) throw new Error('No organization selected.')
      const { data, error } = await createAnnouncement({ path: { organizationId: orgId }, body: { title, content } })
      if (!data) throw new Error(serverError(error) ?? 'Could not post the announcement.')
      return data as Announcement
    },
  })
}
```

> If the generated `createAnnouncement` body type requires more than `{ title, content }`, the optional fields are `.optional()` in the validator — confirm and only add a field if the type makes it required (it should not).

- [ ] **Step 5: Run hook test — expect pass.** Then typecheck.

- [ ] **Step 6: Write CreateAnnouncementForm test** — `CreateAnnouncementForm.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateAnnouncementForm } from './CreateAnnouncementForm'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/features/org/use-org', () => ({ useSelectedOrg: vi.fn(() => ({ orgId: 'org-1', setOrgId: vi.fn() })) }))
const mutate = vi.fn()
let state = { mutate, isPending: false, isError: false, error: null as Error | null }
vi.mock('./use-create-announcement', () => ({ useCreateAnnouncement: () => state }))

describe('CreateAnnouncementForm', () => {
  beforeEach(() => { vi.clearAllMocks(); state = { mutate, isPending: false, isError: false, error: null } })

  it('shows the 2FA note and submits title+content', async () => {
    render(<CreateAnnouncementForm />)
    expect(screen.getByText(/two-factor/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Hi' } })
    fireEvent.change(screen.getByLabelText(/content|message/i), { target: { value: 'Body' } })
    fireEvent.click(screen.getByRole('button', { name: /post announcement/i }))
    await waitFor(() => expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Hi', content: 'Body' }),
      expect.anything(),
    ))
  })

  it('surfaces a 403 as a friendly alert', () => {
    state = { mutate, isPending: false, isError: true, error: new Error('Two-factor authentication required') }
    render(<CreateAnnouncementForm />)
    expect(screen.getByRole('alert')).toHaveTextContent(/two-factor/i)
  })
})
```

- [ ] **Step 7: Implement** — `CreateAnnouncementForm.tsx`

```tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Textarea } from '@monobase/ui'
import { useSelectedOrg } from '@/features/org/use-org'
import { useCreateAnnouncement } from './use-create-announcement'

export function CreateAnnouncementForm() {
  const { orgId } = useSelectedOrg()
  const create = useCreateAnnouncement(orgId)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const serverMessage = create.isError ? (create.error?.message ?? 'Could not post the announcement.') : null

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId || !title || !content) return
    create.mutate({ title, content }, {
      onSuccess: () => { toast.success('Announcement posted'); setTitle(''); setContent('') },
      onError: () => toast.error('Could not post the announcement'),
    })
  }

  return (
    <Card>
      <CardHeader><CardTitle>Post announcement</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-body text-muted-foreground">
          Posting announcements requires a President or Secretary with two-factor authentication enabled.
        </p>
        {!orgId && <p className="text-body text-muted-foreground">Select an organization first.</p>}
        {serverMessage && <p role="alert" className="mb-3 text-body text-destructive">{serverMessage}</p>}
        <form onSubmit={onSubmit} className="space-y-4">
          <div><Label htmlFor="an-title">Title</Label><Input id="an-title" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div><Label htmlFor="an-content">Message</Label><Textarea id="an-content" value={content} onChange={(e) => setContent(e.target.value)} required /></div>
          <Button type="submit" disabled={!orgId || create.isPending} className="min-h-[48px]">
            {create.isPending ? 'Posting…' : 'Post announcement'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 8: Create the route** — `apps/org/src/routes/announcements.tsx`

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { CreateAnnouncementForm } from '@/features/announcements/CreateAnnouncementForm'

export const Route = createFileRoute('/announcements')({ component: AnnouncementsPage })

function AnnouncementsPage() {
  return (
    <main className="mx-auto max-w-xl p-4">
      <Link to="/" className="mb-4 inline-flex min-h-[48px] items-center text-body font-medium text-primary underline">← Back to dashboard</Link>
      <CreateAnnouncementForm />
    </main>
  )
}
```

- [ ] **Step 9: Regenerate route tree.** `cd apps/org && bun run build 2>&1 | tail -10`. Confirm `/announcements` present; COMMIT `routeTree.gen.ts`.
- [ ] **Step 10: Run tests + typecheck.** `cd apps/org && bun run test -- announcement && bun run typecheck`.
- [ ] **Step 11: Commit.** `git add -A apps/org && git commit -m "feat(org): post-announcement form + /announcements route (B3)"`

---

### Task 4: dashboard links + e2e + FROZEN verify

**Files:**
- Modify: `apps/org/src/routes/index.tsx` (add "Create event" + "Post announcement" links)
- Create: `apps/org/src/e2e/events-flow.spec.ts`

- [ ] **Step 1: Add dashboard links.** In `apps/org/src/routes/index.tsx`, add `import { Link } from '@tanstack/react-router'` (if not present) and, near the existing dashboard actions, add:

```tsx
      <Link to="/events" className="inline-flex min-h-[48px] items-center text-body font-medium text-primary underline">Create event</Link>
      <Link to="/announcements" className="inline-flex min-h-[48px] items-center text-body font-medium text-primary underline">Post announcement</Link>
```

- [ ] **Step 2: e2e spec** — `apps/org/src/e2e/events-flow.spec.ts`

```ts
import { test, expect } from '@playwright/test'

// Auth + officer gated. Run against a seeded signed-in officer stack. Self-skips otherwise.
test('officer can open the create-event form', async ({ page }) => {
  await page.goto('/events')
  // __root redirect is an async effect — wait for the app to settle before asserting.
  await page.waitForLoadState('networkidle')
  if (page.url().includes('/sign-in')) test.skip(true, 'no authed session in this environment')
  await expect(page.getByText(/create event/i).first()).toBeVisible()
  await expect(page.getByLabel(/^title/i)).toBeVisible()
})
```

- [ ] **Step 3: Full app verification.** `cd apps/org && bun run typecheck && bun run test && bun run build 2>&1 | tail -5`. Typecheck (incl tests) exit 0; all unit tests pass; build green.

- [ ] **Step 4: Engine FROZEN check.** `git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated | head` → EMPTY.

- [ ] **Step 5: Commit.** `git add -A apps/org && git commit -m "feat(org): dashboard links to events/announcements + e2e (B3)"`

---

## Self-Review

- **Spec coverage:** create-event hook+form+route (T1/T2), announcement hook+form+route (T3), dashboard links + e2e + FROZEN (T4). Listing intentionally out of scope (spec §Scope). ✓
- **Placeholder scan:** none — full code in every step. SDK-shape confirmation steps are explicit "read + adjust" instructions, not placeholders.
- **Type consistency:** `CreateEventInput`/`useCreateEvent` (T1) consumed by T2; `useCreateAnnouncement` (T3) consumed by its form; `EventCreateRequest`/`Announcement` are the generated types (confirm names in Step 1 of T1/T3).
- **Verified facts (from adversarial review — do not re-litigate):** `EventCreateRequest.registrationFee` is `bigint` (use `BigInt(...)`), `startDate`/`endDate` are `Date` (use `new Date(...)`); the event route enforces 2FA in prod (President is privileged) so BOTH forms 403 without 2FA — friendly alert + up-front note on both; `Input`/`Label`/`Button`/`Textarea` all exist in `@monobase/ui`; keep native `<select>`.
- **Still confirm at Step 1:** exact generated names for `createEvent`/`createAnnouncement` and the `createAnnouncement` option shape (`path:{organizationId}` vs body-embedded) — adjust calls if they differ, never weaken the typed bind.
- **Founder-facing:** event creation + announcements are 2FA-gated in prod → carry to the Wave C checklist (Dr. Olive enables 2FA before first-peso event creation).
