# Bulk send-pay-link + back-link cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an officer select N roster members and mint one oldest-dues pay-link each (sequential, with live progress), then remove now-redundant per-page back-links.

**Architecture:** Pure new `apps/org` UI over two FROZEN engine endpoints (`listDuesInvoices`, `sendPaymentLink`), reusing the SDK seams already proven in `use-send-link.ts`. A `useBulkSend` hook drives a sequential loop; `BulkResults` renders the replace-screen panel; `RosterView` gains a Browse/Select mode toggle.

**Tech Stack:** React + TanStack Router/Query, `@monobase/sdk-ts/generated`, `@monobase/ui` (Button, ConfirmDialog, StatusBadge, EmptyState, centavosToPhp), `sonner` toast, Vitest + Testing Library.

## Global Constraints

- Engine `services/api-ts` is FROZEN — additive-only, no handler/spec/SDK edits.
- DESIGN.md is law: 18px base, ≥48px tap targets (`min-h-tap`), tokens from `@monobase/ui` only (no raw palette / no `plum-*`), labeled controls (no icon/color-only), one primary task per screen, touch-first.
- Money safety: confirm at every money step (`ConfirmDialog`); double-tap must never double-mint.
- Currency PHP. `DuesInvoice.totalAmount` is `bigint` at runtime; `sendPaymentLink` body `amount` is `bigint?` → coerce `BigInt(Number(x))` at the SDK seam.
- "Oldest outstanding" = min `periodStart` among status ∈ `[generated, sent, overdue]`; tie-break `createdAt`.
- Verify before done: `bun run typecheck` (all workspaces) + `cd apps/org && bunx vitest run`.

---

### Task 1: `useBulkSend` orchestrator hook

**Files:**
- Create: `apps/org/src/features/roster/use-bulk-send.ts`
- Test: `apps/org/src/features/roster/use-bulk-send.test.tsx`

**Interfaces:**
- Consumes: `listDuesInvoices`, `sendPaymentLink` from `@monobase/sdk-ts/generated`.
- Produces:
  - `type BulkMember = { membershipId: string; personId: string; name: string }`
  - `type BulkResult = { status: 'pending' } | { status: 'minting' } | { status: 'sent'; url: string } | { status: 'no-dues' } | { status: 'error'; message: string }`
  - `useBulkSend(orgId: string, members: BulkMember[]): { results: Record<string, BulkResult>; progress: { done: number; total: number }; running: boolean; start: () => void }`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/org/src/features/roster/use-bulk-send.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBulkSend } from './use-bulk-send'

vi.mock('@monobase/sdk-ts/generated', () => ({
  listDuesInvoices: vi.fn(),
  sendPaymentLink: vi.fn(),
}))
import { listDuesInvoices, sendPaymentLink } from '@monobase/sdk-ts/generated'

const ok201 = (paymentUrl: string) => ({
  data: { paymentUrl, token: 't', expiresAt: '2026-07-01T00:00:00Z' },
  error: undefined,
  response: { status: 201 } as Response,
})

beforeEach(() => {
  vi.clearAllMocks()
  // @ts-expect-error jsdom origin
  delete window.location
  // @ts-expect-error minimal stub
  window.location = { origin: 'https://app.test' }
})

describe('useBulkSend', () => {
  it('picks the oldest-periodStart outstanding invoice and mints once per member', async () => {
    ;(listDuesInvoices as any).mockResolvedValue({
      data: {
        data: [
          { id: 'newer', status: 'generated', periodStart: '2026-03-01', createdAt: '2026-03-01', totalAmount: 200n },
          { id: 'older', status: 'overdue', periodStart: '2026-01-01', createdAt: '2026-01-01', totalAmount: 500n },
          { id: 'paid', status: 'paid', periodStart: '2025-01-01', createdAt: '2025-01-01', totalAmount: 999n },
        ],
      },
    })
    ;(sendPaymentLink as any).mockResolvedValue(ok201('/pay/abc'))

    const members = [{ membershipId: 'm1', personId: 'p1', name: 'Olive' }]
    const { result } = renderHook(() => useBulkSend('org1', members))
    act(() => result.current.start())

    await waitFor(() => expect(result.current.results['m1'].status).toBe('sent'))
    expect(sendPaymentLink).toHaveBeenCalledTimes(1)
    expect(sendPaymentLink).toHaveBeenCalledWith({
      path: { organizationId: 'org1' },
      body: { personId: 'p1', amount: 500n, invoiceId: 'older' },
    })
    expect(result.current.results['m1']).toEqual({ status: 'sent', url: 'https://app.test/pay/abc' })
    expect(result.current.progress).toEqual({ done: 1, total: 1 })
  })

  it('skips members with no outstanding invoice (no-dues), never mints for them', async () => {
    ;(listDuesInvoices as any).mockResolvedValue({ data: { data: [{ id: 'p', status: 'paid', periodStart: '2026-01-01', totalAmount: 1n }] } })
    const members = [{ membershipId: 'm1', personId: 'p1', name: 'Ben' }]
    const { result } = renderHook(() => useBulkSend('org1', members))
    act(() => result.current.start())
    await waitFor(() => expect(result.current.results['m1'].status).toBe('no-dues'))
    expect(sendPaymentLink).not.toHaveBeenCalled()
  })

  it('records an error on non-201 and keeps going to the next member', async () => {
    ;(listDuesInvoices as any).mockResolvedValue({ data: { data: [{ id: 'i1', status: 'generated', periodStart: '2026-01-01', totalAmount: 100n }] } })
    ;(sendPaymentLink as any)
      .mockResolvedValueOnce({ data: undefined, error: { error: 'nope' }, response: { status: 403 } as Response })
      .mockResolvedValueOnce(ok201('/pay/two'))
    const members = [
      { membershipId: 'm1', personId: 'p1', name: 'A' },
      { membershipId: 'm2', personId: 'p2', name: 'B' },
    ]
    const { result } = renderHook(() => useBulkSend('org1', members))
    act(() => result.current.start())
    await waitFor(() => expect(result.current.progress.done).toBe(2))
    expect(result.current.results['m1'].status).toBe('error')
    expect(result.current.results['m2'].status).toBe('sent')
  })

  it('start() is idempotent — a second call does not double-mint', async () => {
    ;(listDuesInvoices as any).mockResolvedValue({ data: { data: [{ id: 'i1', status: 'generated', periodStart: '2026-01-01', totalAmount: 100n }] } })
    ;(sendPaymentLink as any).mockResolvedValue(ok201('/pay/x'))
    const members = [{ membershipId: 'm1', personId: 'p1', name: 'A' }]
    const { result } = renderHook(() => useBulkSend('org1', members))
    act(() => { result.current.start(); result.current.start() })
    await waitFor(() => expect(result.current.progress.done).toBe(1))
    expect(sendPaymentLink).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/org && bunx vitest run src/features/roster/use-bulk-send.test.tsx`
Expected: FAIL — `useBulkSend` is not exported / file missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/org/src/features/roster/use-bulk-send.ts
import { useRef, useState } from 'react'
import { listDuesInvoices, sendPaymentLink } from '@monobase/sdk-ts/generated'

export type BulkMember = { membershipId: string; personId: string; name: string }

export type BulkResult =
  | { status: 'pending' }
  | { status: 'minting' }
  | { status: 'sent'; url: string }
  | { status: 'no-dues' }
  | { status: 'error'; message: string }

const OUTSTANDING = new Set(['generated', 'sent', 'overdue'])
const ms = (d: unknown) => new Date(d as string).getTime()

// Oldest by periodStart, tie-break createdAt. Mirrors the single-send seam.
function pickOldest<T extends { periodStart: unknown; createdAt?: unknown }>(invoices: T[]): T {
  return invoices.reduce((a, b) => {
    const d = ms(a.periodStart) - ms(b.periodStart)
    if (d !== 0) return d < 0 ? a : b
    return ms(a.createdAt) <= ms(b.createdAt) ? a : b
  })
}

function errMessage(response: Response): string {
  return response.status === 403
    ? 'You are not an officer of this organization.'
    : 'Could not create the pay-link.'
}

export function useBulkSend(
  orgId: string,
  members: BulkMember[],
): { results: Record<string, BulkResult>; progress: { done: number; total: number }; running: boolean; start: () => void } {
  const [results, setResults] = useState<Record<string, BulkResult>>({})
  const [done, setDone] = useState(0)
  const [running, setRunning] = useState(false)
  // Synchronous guard so a double-tap (or a re-render before state flips) can't start twice.
  const startedRef = useRef(false)

  const set = (id: string, r: BulkResult) => setResults((prev) => ({ ...prev, [id]: r }))

  async function start() {
    if (startedRef.current) return
    startedRef.current = true
    setRunning(true)
    setResults(Object.fromEntries(members.map((m) => [m.membershipId, { status: 'pending' as const }])))

    for (const m of members) {
      set(m.membershipId, { status: 'minting' })
      try {
        const { data } = await listDuesInvoices({ query: { membershipId: m.membershipId, pageSize: 50 } })
        const outstanding = (data?.data ?? []).filter((inv: any) => OUTSTANDING.has(inv.status))
        if (outstanding.length === 0) {
          set(m.membershipId, { status: 'no-dues' })
        } else {
          const inv = pickOldest(outstanding as any[])
          const { data: link, response } = await sendPaymentLink({
            path: { organizationId: orgId },
            body: { personId: m.personId, amount: BigInt(Number(inv.totalAmount)), invoiceId: inv.id },
          })
          const res = response as Response
          if (res.status === 201 && link) {
            set(m.membershipId, { status: 'sent', url: `${window.location.origin}${link.paymentUrl}` })
          } else {
            set(m.membershipId, { status: 'error', message: errMessage(res) })
          }
        }
      } catch {
        set(m.membershipId, { status: 'error', message: 'Could not create the pay-link.' })
      }
      setDone((d) => d + 1)
    }
    setRunning(false)
  }

  return { results, progress: { done, total: members.length }, running, start }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/org && bunx vitest run src/features/roster/use-bulk-send.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/org/src/features/roster/use-bulk-send.ts apps/org/src/features/roster/use-bulk-send.test.tsx
git commit -m "feat(org): useBulkSend orchestrator — sequential oldest-dues pay-link mint"
```

---

### Task 2: `BulkResults` replace-screen panel

**Files:**
- Create: `apps/org/src/features/roster/BulkResults.tsx`
- Test: `apps/org/src/features/roster/BulkResults.test.tsx`

**Interfaces:**
- Consumes: `BulkMember`, `BulkResult` from `./use-bulk-send`; `Button`, `StatusBadge` from `@monobase/ui`; `toast` from `sonner`.
- Produces: `BulkResults({ members, results, progress, onBack }: { members: BulkMember[]; results: Record<string, BulkResult>; progress: { done: number; total: number }; onBack: () => void })`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/org/src/features/roster/BulkResults.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BulkResults } from './BulkResults'

const members = [
  { membershipId: 'm1', personId: 'p1', name: 'Olive' },
  { membershipId: 'm2', personId: 'p2', name: 'Ben' },
  { membershipId: 'm3', personId: 'p3', name: 'Ana' },
]

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('BulkResults', () => {
  it('renders a labeled status for each member and the running progress', () => {
    render(
      <BulkResults
        members={members}
        progress={{ done: 1, total: 3 }}
        results={{
          m1: { status: 'sent', url: 'https://app.test/pay/a' },
          m2: { status: 'no-dues' },
          m3: { status: 'minting' },
        }}
        onBack={() => {}}
      />,
    )
    expect(screen.getByText(/Minting 1 of 3/i)).toBeInTheDocument()
    expect(screen.getByText('Olive')).toBeInTheDocument()
    expect(screen.getByText(/no dues/i)).toBeInTheDocument()
    expect(screen.getByText('https://app.test/pay/a')).toBeInTheDocument()
  })

  it('Copy copies a single link; Copy all copies every sent link', () => {
    render(
      <BulkResults
        members={members}
        progress={{ done: 3, total: 3 }}
        results={{
          m1: { status: 'sent', url: 'https://app.test/pay/a' },
          m2: { status: 'sent', url: 'https://app.test/pay/b' },
          m3: { status: 'no-dues' },
        }}
        onBack={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /copy link for olive/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://app.test/pay/a')
    fireEvent.click(screen.getByRole('button', { name: /copy all sent links/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('https://app.test/pay/b'))
  })

  it('shows a tally and fires onBack', () => {
    const onBack = vi.fn()
    render(
      <BulkResults
        members={members}
        progress={{ done: 3, total: 3 }}
        results={{ m1: { status: 'sent', url: 'u' }, m2: { status: 'error', message: 'x' }, m3: { status: 'no-dues' } }}
        onBack={onBack}
      />,
    )
    expect(screen.getByText(/1 sent/i)).toBeInTheDocument()
    expect(screen.getByText(/1 failed/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /back to roster/i }))
    expect(onBack).toHaveBeenCalled()
  })

  it('shows an explicit message when nothing was sent', () => {
    render(
      <BulkResults
        members={[members[0]]}
        progress={{ done: 1, total: 1 }}
        results={{ m1: { status: 'no-dues' } }}
        onBack={() => {}}
      />,
    )
    expect(screen.getByText(/no links sent/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/org && bunx vitest run src/features/roster/BulkResults.test.tsx`
Expected: FAIL — `BulkResults` missing.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/org/src/features/roster/BulkResults.tsx
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button, StatusBadge } from '@monobase/ui'
import type { BulkMember, BulkResult } from './use-bulk-send'

const STATUS_LABEL: Record<BulkResult['status'], string> = {
  pending: 'Waiting',
  minting: 'Minting…',
  sent: 'Sent',
  'no-dues': 'No dues',
  error: 'Failed',
}

export function BulkResults({
  members,
  results,
  progress,
  onBack,
}: {
  members: BulkMember[]
  results: Record<string, BulkResult>
  progress: { done: number; total: number }
  onBack: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])

  const done = progress.done >= progress.total
  const sentUrls = members
    .map((m) => results[m.membershipId])
    .filter((r): r is { status: 'sent'; url: string } => r?.status === 'sent')
    .map((r) => r.url)
  const counts = {
    sent: sentUrls.length,
    failed: members.filter((m) => results[m.membershipId]?.status === 'error').length,
    noDues: members.filter((m) => results[m.membershipId]?.status === 'no-dues').length,
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h1 ref={headingRef} tabIndex={-1} className="text-title font-semibold text-foreground outline-none">
        {done ? `Sent ${progress.total} link${progress.total === 1 ? '' : 's'}` : `Sending ${progress.total} links`}
      </h1>
      <p role="status" aria-live="polite" className="text-body text-muted-foreground">
        {done
          ? `${counts.sent} sent · ${counts.failed} failed · ${counts.noDues} no dues`
          : `Minting ${progress.done} of ${progress.total}…`}
      </p>
      {done && counts.sent === 0 && (
        <div role="alert" className="rounded-md bg-warning-bg border border-warning p-3 text-body text-warning">
          No links sent — no outstanding dues.
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {members.map((m) => {
          const r = results[m.membershipId] ?? { status: 'pending' as const }
          return (
            <li
              key={m.membershipId}
              className="flex flex-col gap-2 rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-body font-medium text-foreground truncate">{m.name}</span>
                <StatusBadge variant={r.status === 'sent' ? 'success' : r.status === 'error' ? 'error' : 'muted'}>
                  {STATUS_LABEL[r.status]}
                </StatusBadge>
              </div>
              {r.status === 'sent' && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-caption text-muted-foreground break-all">{r.url}</span>
                  <Button
                    className="min-h-tap shrink-0"
                    onClick={() => { navigator.clipboard.writeText(r.url); toast.success('Link copied') }}
                    aria-label={`Copy link for ${m.name}`}
                  >
                    Copy
                  </Button>
                </div>
              )}
              {r.status === 'error' && <span className="text-caption text-error">{r.message}</span>}
            </li>
          )
        })}
      </ul>

      <p className="text-caption text-muted-foreground">
        Links are distributed manually until SMS sending is available.
      </p>
      <div className="flex flex-wrap gap-3">
        {sentUrls.length > 0 && (
          <Button
            variant="outline"
            className="min-h-tap"
            onClick={() => { navigator.clipboard.writeText(sentUrls.join('\n')); toast.success('All links copied') }}
            aria-label="Copy all sent links"
          >
            Copy all sent links
          </Button>
        )}
        <Button className="min-h-tap" onClick={onBack} disabled={!done} aria-label="Back to roster">
          Back to roster
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/org && bunx vitest run src/features/roster/BulkResults.test.tsx`
Expected: PASS (4 tests).

> If `StatusBadge` rejects `variant="success"`, check its prop union in `packages/ui` and use the nearest token variant — do NOT add raw colour classes.

- [ ] **Step 5: Commit**

```bash
git add apps/org/src/features/roster/BulkResults.tsx apps/org/src/features/roster/BulkResults.test.tsx
git commit -m "feat(org): BulkResults replace-screen panel (StatusBadge, copy-all, tally, a11y)"
```

---

### Task 3: Roster select mode + sticky bar + confirm + wire results

**Files:**
- Modify: `apps/org/src/features/roster/Roster.tsx`
- Test: `apps/org/src/features/roster/Roster.test.tsx` (extend)

**Interfaces:**
- Consumes: `useBulkSend`, `BulkMember` from `./use-bulk-send`; `BulkResults` from `./BulkResults`; `ConfirmDialog`, `Button` from `@monobase/ui`.
- Produces: `RosterView` gains optional `orgId?: string` prop (enables bulk). When absent, select UI still renders but send is inert — keeps the pure presentational tests valid.

- [ ] **Step 1: Write the failing test (extend the existing file)**

Add these tests to `apps/org/src/features/roster/Roster.test.tsx`. Mock the bulk hook so the UI is tested in isolation:

```tsx
import { vi } from 'vitest'
const startSpy = vi.fn()
vi.mock('./use-bulk-send', async (orig) => ({
  ...(await orig() as any),
  useBulkSend: () => ({ results: {}, progress: { done: 0, total: 0 }, running: false, start: startSpy }),
}))

// ...existing imports: render, screen, fireEvent, RosterView, a `members` fixture...

describe('RosterView — select mode', () => {
  const members = [
    { membershipId: 'm1', personId: 'p1', name: 'Olive', status: 'active' },
    { membershipId: 'm2', personId: 'p2', name: 'Ben', status: 'active' },
  ]

  it('Select toggle reveals checkboxes and hides the per-row send link', () => {
    render(<RosterView orgName="Org" members={members} orgId="o1" />)
    expect(screen.queryByRole('checkbox', { name: /select olive/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    expect(screen.getByRole('checkbox', { name: /select olive/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /send pay-link to olive/i })).not.toBeInTheDocument()
  })

  it('sticky bar reflects the selected count and opens a confirm before minting', () => {
    render(<RosterView orgName="Org" members={members} orgId="o1" />)
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /select olive/i }))
    fireEvent.click(screen.getByRole('button', { name: /send links to 1 selected/i }))
    // ConfirmDialog open, loop NOT started yet
    expect(startSpy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /send pay-links/i }))
    expect(startSpy).toHaveBeenCalled()
  })

  it('Select all picks only the currently-filtered rows', () => {
    render(<RosterView orgName="Org" members={members} orgId="o1" />)
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    fireEvent.change(screen.getByRole('searchbox', { name: /search members/i }), { target: { value: 'olive' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }))
    expect(screen.getByRole('button', { name: /send links to 1 selected/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/org && bunx vitest run src/features/roster/Roster.test.tsx`
Expected: FAIL — no `Select` button / `orgId` prop / confirm flow.

- [ ] **Step 3: Implement select mode in `Roster.tsx`**

Replace the `RosterView` component (keep the container `Roster` below it, adding `orgId` to the rendered `RosterView`). Full new `RosterView`:

```tsx
import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, ConfirmDialog, EmptyState, Input, StatusBadge } from '@monobase/ui'
import { useOrgs, useSelectedOrg } from '../org/use-org'
import { OrgPicker } from '../org/OrgPicker'
import { useRoster, type RosterMember } from './use-roster'
import { useBulkSend, type BulkMember } from './use-bulk-send'
import { BulkResults } from './BulkResults'

const KNOWN_STATUSES = new Set(['active', 'grace', 'lapsed', 'pending', 'suspended'])
type KnownStatus = 'active' | 'grace' | 'lapsed' | 'pending' | 'suspended'

export interface RosterViewProps {
  orgName: string
  members: RosterMember[]
  errored?: boolean
  linkFor?: (member: RosterMember) => string
  /** When present, enables bulk select-and-send. */
  orgId?: string
}

export function RosterView({ orgName, members, errored, linkFor, orgId }: RosterViewProps) {
  const href = linkFor ?? ((m: RosterMember) => `/members/${m.membershipId}/send`)
  const [query, setQuery] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sendMembers, setSendMembers] = useState<BulkMember[] | null>(null)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      q
        ? members.filter(
            (m) =>
              m.name.toLowerCase().includes(q) ||
              (m.memberNumber ?? '').toLowerCase().includes(q) ||
              m.status.toLowerCase().includes(q),
          )
        : members,
    [members, q],
  )

  // Drop filtered-out rows from the selection (select-all = currently-filtered only).
  const filteredIds = useMemo(() => new Set(filtered.map((m) => m.membershipId)), [filtered])
  const visibleSelected = filtered.filter((m) => selected.has(m.membershipId))
  const selectedCount = visibleSelected.length
  const allFilteredSelected = filtered.length > 0 && selectedCount === filtered.length

  const bulk = useBulkSend(orgId ?? '', sendMembers ?? [])

  if (errored) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {orgName && <h1 className="text-title font-semibold text-foreground">{orgName}</h1>}
        <EmptyState headline="Roster unavailable" description="You need officer or admin access to view this chapter's roster." />
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {orgName && <h1 className="text-title font-semibold text-foreground">{orgName}</h1>}
        <EmptyState headline="No members yet" description="Import your roster to get started." />
        <Button asChild className="min-h-tap self-start"><Link to="/import">Import roster</Link></Button>
      </div>
    )
  }

  // Once a send has started, take over the screen with the results panel.
  if (sendMembers) {
    return (
      <BulkResults
        members={sendMembers}
        results={bulk.results}
        progress={bulk.progress}
        onBack={() => { setSendMembers(null); setSelecting(false); setSelected(new Set()) }}
      />
    )
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => !filteredIds.has(id)))
      if (!allFilteredSelected) filtered.forEach((m) => next.add(m.membershipId))
      return next
    })

  function startSend() {
    const list: BulkMember[] = members
      .filter((m) => selected.has(m.membershipId))
      .map((m) => ({ membershipId: m.membershipId, personId: m.personId, name: m.name }))
    setSendMembers(list)
    setConfirmOpen(false)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <div className="flex items-center justify-between gap-3">
        {orgName && <h1 className="text-title font-semibold text-foreground">{orgName}</h1>}
        {orgId && (
          <Button
            variant="outline"
            className="min-h-tap shrink-0"
            onClick={() => { setSelecting((s) => !s); setSelected(new Set()) }}
          >
            {selecting ? 'Cancel' : 'Select'}
          </Button>
        )}
      </div>

      <Input
        type="search"
        value={query}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
        placeholder="Search members by name, number, or status"
        aria-label="Search members"
        className="min-h-tap"
      />

      {selecting && (
        <label className="flex items-center gap-3 text-body text-foreground">
          <input
            type="checkbox"
            className="size-5"
            aria-label="Select all"
            checked={allFilteredSelected}
            ref={(el) => { if (el) el.indeterminate = selectedCount > 0 && !allFilteredSelected }}
            onChange={toggleAll}
          />
          Select all ({selectedCount} selected)
        </label>
      )}

      {filtered.length === 0 ? (
        <p className="text-body text-muted-foreground">No members match “{query}”.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((m) => {
            const checked = selected.has(m.membershipId)
            return (
              <li
                key={m.membershipId}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
                onClick={selecting ? () => toggle(m.membershipId) : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {selecting && (
                    <input
                      type="checkbox"
                      className="size-5 shrink-0"
                      aria-label={`Select ${m.name}`}
                      checked={checked}
                      onChange={() => toggle(m.membershipId)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-body font-medium text-foreground truncate">{m.name}</span>
                    {m.memberNumber && <span className="text-caption text-muted-foreground">{m.memberNumber}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {KNOWN_STATUSES.has(m.status) ? (
                    <StatusBadge status={m.status as KnownStatus} />
                  ) : (
                    <StatusBadge variant="muted">{m.status}</StatusBadge>
                  )}
                  {!selecting && (
                    <Button asChild className="min-h-tap">
                      <a href={href(m)} aria-label={`Send pay-link to ${m.name}`}>Send pay-link</a>
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {selecting && selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--color-border-light)] bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto">
            <Button className="min-h-tap w-full" onClick={() => setConfirmOpen(true)}>
              Send links to {selectedCount} selected
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Send ${selectedCount} pay-link${selectedCount === 1 ? '' : 's'}?`}
        description="Each selected member gets a pay-link for their oldest outstanding dues. Members with no dues are skipped."
        confirmLabel="Send pay-links"
        onConfirm={startSend}
      />
    </div>
  )
}
```

- [ ] **Step 4: Pass `orgId` from the container**

In the `Roster` default export, add `orgId={orgId ?? undefined}` to the `<RosterView ... />` render (alongside the existing `linkFor`).

```tsx
<RosterView
  orgName={orgName}
  members={members}
  errored={rosterStatus === 'error'}
  orgId={orgId ?? undefined}
  linkFor={(m) =>
    `/members/${m.membershipId}/send?personId=${encodeURIComponent(m.personId)}&name=${encodeURIComponent(m.name)}`
  }
/>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/org && bunx vitest run src/features/roster/Roster.test.tsx`
Expected: PASS — existing browse-mode tests + 3 new select-mode tests. If an existing test asserted the per-row link is always present, it still is (browse mode is default; new tests opt into select mode).

- [ ] **Step 6: Commit**

```bash
git add apps/org/src/features/roster/Roster.tsx apps/org/src/features/roster/Roster.test.tsx
git commit -m "feat(org): roster select-mode bulk send (sticky bar, money-confirm, results swap)"
```

---

### Task 4: Remove redundant back-links (Goal B)

**Files:**
- Modify: `apps/org/src/routes/events.tsx`, `apps/org/src/routes/announcements.tsx`, `apps/org/src/routes/payment-settings.tsx`, `apps/org/src/features/roster-import/ImportRoster.tsx`
- Test: adjust any test asserting these links (search first).

- [ ] **Step 1: Find tests that assert the removed links**

Run: `cd apps/org && grep -rn "Back to dashboard\|name: /roster/i\|View roster" src --include=*.test.tsx`
Note which tests reference the back-links so Step 3 can update them.

- [ ] **Step 2: Delete the back-link from each route**

In `routes/events.tsx` and `routes/announcements.tsx`, delete the line:
```tsx
<Link to="/" className="mb-4 inline-flex min-h-[48px] items-center text-body font-medium text-primary underline">Back to dashboard</Link>
```
In `routes/payment-settings.tsx`, delete the multi-line `<Link to="/" …>Back to dashboard</Link>` block.
In `features/roster-import/ImportRoster.tsx`, delete only the line-176 back-link:
```tsx
<Link to="/" className="inline-flex min-h-tap items-center text-body font-medium text-primary underline">Roster</Link>
```
**Keep** the line-60 `<Link to="/">View roster</Link>` (post-import success CTA).

In each file, if `Link` is now unused, remove it from the import (`import { createFileRoute } from '@tanstack/react-router'`). `ImportRoster.tsx` still uses `Link` for "View roster" — keep its import.

- [ ] **Step 3: Update any tests found in Step 1**

Remove assertions for the deleted links. If a test only checked the back-link, delete that test case. Keep "View roster" assertions intact.

- [ ] **Step 4: Verify nav still reachable + typecheck**

Run: `cd apps/org && bunx vitest run && cd /Users/elad-mini/Desktop/memberry && bun run typecheck`
Expected: PASS; no unused-import or type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/org/src/routes/events.tsx apps/org/src/routes/announcements.tsx apps/org/src/routes/payment-settings.tsx apps/org/src/features/roster-import/ImportRoster.tsx
git add apps/org/src/**/*.test.tsx
git commit -m "refactor(org): drop redundant per-page back-links (AppHeader nav covers them)"
```

---

### Task 5: Full verification + ship

- [ ] **Step 1: Typecheck all workspaces**

Run: `cd /Users/elad-mini/Desktop/memberry && bun run typecheck`
Expected: every workspace exits 0.

- [ ] **Step 2: Run the full org suite**

Run: `cd apps/org && bunx vitest run`
Expected: all green (new + existing).

- [ ] **Step 3: Ship**

Invoke `/ship` → third-digit bump to **v0.1.18.0**, push branch `feat/org-bulk-send-paylink`, open PR (repo squash-merges).

---

## Self-Review

- **Spec coverage:** Goal A select/browse modes (Task 3) · sticky safe-area bar (Task 3) · money ConfirmDialog (Task 3) · sequential oldest-dues mint (Task 1) · StatusBadge results + aria-live + focus + tally + copy-all + all-no-dues (Task 2) · Goal B back-links (Task 4) · verify/ship (Task 5). All covered.
- **Placeholders:** none — all steps carry real code/commands.
- **Type consistency:** `BulkMember`/`BulkResult` defined Task 1, consumed identically in Tasks 2–3; `useBulkSend(orgId, members)` signature matches the Task 3 call and the Task 1 def; `RosterView` `orgId?` prop added in Task 3 and passed in Step 4.
- **Risk note:** `StatusBadge` variant names (`success`/`error`/`muted`) are assumed from existing usage; Task 2 includes a fallback instruction if the prop union differs. `listDuesInvoices` may apply a response transformer that returns `Date` objects for `periodStart` — `ms()` uses `new Date(x)` which handles both `Date` and ISO string.
