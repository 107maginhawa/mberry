# Slice-2c — apps/org Roster CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a chapter officer upload a roster CSV in apps/org; the frozen engine match-or-creates membership rows; the officer sees an imported/skipped/failed summary.

**Architecture:** New `apps/org/src/features/roster-import/` feature: a pure client-side CSV parser (ported RFC-4180, no new dep) → header auto-map → preview → single JSON POST to the frozen `importRosterMembers` endpoint → result summary. Tier dropdown from `listMembershipTiers`. Presentational view (prop-driven, all states deterministic) + container (wires hooks + FileReader). New `/import` route, linked from the roster screen.

**Tech Stack:** React 19, TanStack Router/Query 5, Vitest + RTL + jsdom, `@monobase/sdk-ts/generated`, `@monobase/ui` tokens. Engine = Hono + Drizzle (FROZEN, not touched).

## Global Constraints

- **Engine FROZEN — additive-only.** `git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated` MUST be EMPTY. Only `apps/org/**` changes this slice.
- **No new dependencies.** Port the engine's RFC-4180 CSV parser; do not add papaparse or any package.
- SDK client import: `@monobase/sdk-ts/generated/client.gen`; functions/types from `@monobase/sdk-ts/generated`. No root export.
- SDK does NOT throw on non-2xx; `data: undefined` on transport error → read `response`/`error`. mutationFn/queryFn must throw when `!data`.
- **Anchor mocks to the real HANDLER shape (read handler source), not types.gen.ts.** Use existing `apps/org/src/test-utils/mock-sdk.ts` `ok()/err()` helpers. `importRosterMembers` body is FLAT (`{imported,skipped,failed,errors}` — NOT `{data:...}`); `listMembershipTiers` is NESTED (`{data: tiers[], pagination}`).
- Test mocking = `vi.mock('@monobase/sdk-ts/generated', () => ({...vi.fn()}))` factory (NOT `vi.spyOn` on generated ESM). vitest include only `src/**/*.test.ts(x)` (`.spec` E2E excluded).
- Test files ARE typechecked (`tsconfig.test.json` exists; CI `org` job `typecheck` covers them). Keep them typed.
- `routeTree.gen.ts` is regenerated on build (tsr plugin) and MUST be committed before typecheck. Port 3005.
- Playwright pin 1.58.2, portable `../../node_modules/.bin/playwright`. CI `org` job already exists — no new CI job.
- All UI on `@monobase/ui` Friendly-Clarity tokens; a11y: ≥18px text, ≥48px tap (`min-h-tap`), `role=alert` for errors, every input labeled, one primary task per screen. `sonner` for toasts. No `/api` prefix (Vite proxy strips).
- No money/bigint at any request seam this slice (tier `annualFee` is bigint but is NOT sent).

## Engine contract (verified by reading handler source — do not re-derive from types)

`importRosterMembers` — `POST /association/member/roster/import`, SDK `importRosterMembers`, JSON body:
- Request `ImportMembersRequest`: `{ organizationId: string; tierId: string; members: ImportMemberRow[] }`.
- `ImportMemberRow`: `{ firstName?; lastName?; email?; licenseNumber?; memberNumber? }`. Row needs email OR licenseNumber; firstName required only to CREATE a new person.
- Response (FLAT) `{ imported: number; skipped: number; failed: number; errors: Array<{ index: number; error: string }> }`.
- Auth `requirePosition(Secretary|President)` — **no 2FA**. Org from `x-org-id` header (interceptor injects). 500-row cap (engine 400s above).

`listMembershipTiers` — `GET /association/member/tiers`, SDK `listMembershipTiers`, x-org-id scoped, any authed user:
- Response (NESTED) `{ data: MembershipTier[]; pagination }`; `MembershipTier`: `{ id; name; code; description?; annualFee: bigint; currency; benefits[]; status }`. `tierId = tier.id`.

## File structure

```
apps/org/src/features/roster-import/
  csv.ts                 parseCsv · mapRows · summarizeRows  (pure, no SDK)   [T1]
  csv.test.ts            parser + mapper + summarize edge cases               [T1]
  use-tiers.ts           useTiers(orgId)                                       [T2]
  use-import-roster.ts   useImportRoster(orgId)                               [T2]
  use-import-roster.test.tsx  hook tests (mocked SDK, ok()/err())            [T2]
  ImportRoster.tsx       ImportRosterView (presentational) + ImportRoster (container) [T3]
  ImportRoster.test.tsx  view render/interaction tests                        [T3]
apps/org/src/routes/import.tsx     thin route → ImportRoster                  [T4]
apps/org/src/features/roster/Roster.tsx   add "Import roster" links           [T4]
apps/org/src/e2e/import-flow.spec.ts   officer import flow (page.route stubs)  [T5]
                                       (note: playwright testDir = ./src/e2e)
```

---

### Task 1: CSV parser + header auto-map (pure logic)

**Files:**
- Create: `apps/org/src/features/roster-import/csv.ts`
- Test: `apps/org/src/features/roster-import/csv.test.ts`

**Interfaces:**
- Consumes: type-only `ImportMemberRow` from `@monobase/sdk-ts/generated`.
- Produces: `parseCsv(text: string): string[][]`; `mapRows(grid: string[][]): { rows: ImportMemberRow[]; headerError?: string }`; `summarizeRows(rows: ImportMemberRow[]): { total: number; missingIdentifier: number; missingName: number }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/org/src/features/roster-import/csv.test.ts
import { describe, it, expect } from 'vitest'
import { parseCsv, mapRows, summarizeRows } from './csv'

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('handles quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('name,note\n"Dela Cruz, Jr.","said ""hi"""')).toEqual([
      ['name', 'note'],
      ['Dela Cruz, Jr.', 'said "hi"'],
    ])
  })
  it('handles newlines inside quotes and CRLF line endings', () => {
    expect(parseCsv('a,b\r\n"line1\nline2",x')).toEqual([['a', 'b'], ['line1\nline2', 'x']])
  })
  it('keeps a trailing field with no terminating newline', () => {
    expect(parseCsv('a,b')).toEqual([['a', 'b']])
  })
})

describe('mapRows', () => {
  it('auto-maps known headers (case/space-insensitive) and trims cells', () => {
    const grid = [
      ['First Name', 'Last Name', 'Email', 'PRC Number', 'Member No'],
      [' Olive ', 'Reyes', 'olive@x.ph', 'PRC-1', 'M-1'],
    ]
    expect(mapRows(grid)).toEqual({
      rows: [{ firstName: 'Olive', lastName: 'Reyes', email: 'olive@x.ph', licenseNumber: 'PRC-1', memberNumber: 'M-1' }],
    })
  })
  it('errors when neither email nor licenseNumber column is present', () => {
    expect(mapRows([['first name', 'last name'], ['A', 'B']]).headerError).toMatch(/email or licenseNumber/i)
  })
  it('accepts a licenseNumber-only header set', () => {
    expect(mapRows([['license'], ['PRC-9']])).toEqual({ rows: [{ licenseNumber: 'PRC-9' }] })
  })
  it('drops fully-empty rows and omits empty optional fields', () => {
    expect(mapRows([['email'], ['a@x.ph'], ['']])).toEqual({ rows: [{ email: 'a@x.ph' }] })
  })
  it('returns empty rows for a header-only file', () => {
    expect(mapRows([['email']])).toEqual({ rows: [] })
  })
})

describe('summarizeRows', () => {
  it('counts rows missing an identifier and missing a name', () => {
    expect(
      summarizeRows([
        { email: 'a@x.ph', firstName: 'A' }, // ok
        { firstName: 'NoId' },               // has name, no email/license → missingIdentifier
        { email: 'c@x.ph' },                 // has id, no firstName → missingName
      ]),
    ).toEqual({ total: 3, missingIdentifier: 1, missingName: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/org && ../../node_modules/.bin/vitest run src/features/roster-import/csv.test.ts`
Expected: FAIL — `csv.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/org/src/features/roster-import/csv.ts
import type { ImportMemberRow } from '@monobase/sdk-ts/generated'

/** Minimal RFC-4180 parser — ported from the engine's invite/bulkImportMembers.ts. */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else { field += ch }
    } else if (ch === '"') { inQuotes = true }
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && content[i + 1] === '\n') i++
      row.push(field); rows.push(row); field = ''; row = []
    } else { field += ch }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

const HEADER_ALIASES: Record<keyof ImportMemberRow, string[]> = {
  firstName: ['firstname', 'first name', 'first'],
  lastName: ['lastname', 'last name', 'last'],
  email: ['email', 'e-mail'],
  licenseNumber: ['licensenumber', 'license', 'license number', 'prc', 'prc number'],
  memberNumber: ['membernumber', 'member number', 'member no', 'member #'],
}

export function mapRows(grid: string[][]): { rows: ImportMemberRow[]; headerError?: string } {
  if (grid.length === 0) return { rows: [] }
  const header = grid[0]!.map((h) => h.trim().toLowerCase())
  const colOf = (field: keyof ImportMemberRow): number =>
    header.findIndex((h) => HEADER_ALIASES[field].includes(h))
  const idx = {
    firstName: colOf('firstName'),
    lastName: colOf('lastName'),
    email: colOf('email'),
    licenseNumber: colOf('licenseNumber'),
    memberNumber: colOf('memberNumber'),
  }
  if (idx.email === -1 && idx.licenseNumber === -1) {
    return { rows: [], headerError: 'CSV must include an email or licenseNumber column.' }
  }
  const rows: ImportMemberRow[] = []
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r]!
    const cell = (c: number) => (c === -1 ? '' : (cells[c] ?? '').trim())
    const row: ImportMemberRow = {}
    const fn = cell(idx.firstName); if (fn) row.firstName = fn
    const ln = cell(idx.lastName); if (ln) row.lastName = ln
    const em = cell(idx.email); if (em) row.email = em
    const lic = cell(idx.licenseNumber); if (lic) row.licenseNumber = lic
    const mn = cell(idx.memberNumber); if (mn) row.memberNumber = mn
    if (Object.keys(row).length > 0) rows.push(row)
  }
  return { rows }
}

export function summarizeRows(rows: ImportMemberRow[]): {
  total: number; missingIdentifier: number; missingName: number
} {
  let missingIdentifier = 0
  let missingName = 0
  for (const r of rows) {
    if (!r.email && !r.licenseNumber) missingIdentifier++
    if (!r.firstName) missingName++
  }
  return { total: rows.length, missingIdentifier, missingName }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/org && ../../node_modules/.bin/vitest run src/features/roster-import/csv.test.ts`
Expected: PASS (all 10 tests). Then `cd apps/org && bun run typecheck` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/org/src/features/roster-import/csv.ts apps/org/src/features/roster-import/csv.test.ts
git commit -m "feat(org): client-side roster CSV parser + header auto-map (slice-2c T1)"
```

---

### Task 2: Tier + import hooks

**Files:**
- Create: `apps/org/src/features/roster-import/use-tiers.ts`
- Create: `apps/org/src/features/roster-import/use-import-roster.ts`
- Test: `apps/org/src/features/roster-import/use-import-roster.test.tsx`

**Interfaces:**
- Consumes: `importRosterMembers`, `listMembershipTiers`, types `ImportMemberRow`, `ImportResult` from `@monobase/sdk-ts/generated`; `ok`/`err` from `../../test-utils/mock-sdk`.
- Produces: `useTiers(orgId: string | null): { tiers: Tier[]; loading: boolean }` where `Tier = { id; name; code }`; `useImportRoster(orgId: string | null)` → a TanStack `useMutation` whose `mutate({ tierId, members })` returns `ImportResult` and invalidates `['roster', orgId]` on success.

- [ ] **Step 1: Write the failing test** (hook test; tiers hook is exercised via the component test in T3, so unit-test the mutation hook here)

```tsx
// apps/org/src/features/roster-import/use-import-roster.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { ok, err } from '../../test-utils/mock-sdk'

vi.mock('@monobase/sdk-ts/generated', () => ({
  importRosterMembers: vi.fn(),
  listMembershipTiers: vi.fn(),
}))
import { importRosterMembers } from '@monobase/sdk-ts/generated'
import { useImportRoster } from './use-import-roster'

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useImportRoster', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts organizationId+tierId+members and returns the flat ImportResult', async () => {
    // Handler returns a FLAT body: { imported, skipped, failed, errors }
    vi.mocked(importRosterMembers).mockResolvedValue(
      ok({ imported: 2, skipped: 1, failed: 0, errors: [] }) as any,
    )
    const qc = new QueryClient()
    const { result } = renderHook(() => useImportRoster('org-1'), { wrapper: wrapper(qc) })
    result.current.mutate({ tierId: 'tier-1', members: [{ email: 'a@x.ph', firstName: 'A' }] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ imported: 2, skipped: 1, failed: 0, errors: [] })
    expect(vi.mocked(importRosterMembers)).toHaveBeenCalledWith({
      body: { organizationId: 'org-1', tierId: 'tier-1', members: [{ email: 'a@x.ph', firstName: 'A' }] },
    })
  })

  it('invalidates the roster query on success', async () => {
    vi.mocked(importRosterMembers).mockResolvedValue(ok({ imported: 1, skipped: 0, failed: 0, errors: [] }) as any)
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useImportRoster('org-1'), { wrapper: wrapper(qc) })
    result.current.mutate({ tierId: 't', members: [] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['roster', 'org-1'] })
  })

  it('surfaces the server error message on non-2xx', async () => {
    vi.mocked(importRosterMembers).mockResolvedValue(err(400, { error: 'tierId is required' }) as any)
    const qc = new QueryClient()
    const { result } = renderHook(() => useImportRoster('org-1'), { wrapper: wrapper(qc) })
    result.current.mutate({ tierId: '', members: [] })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('tierId is required')
  })

  it('errors when no org is selected without calling the SDK', async () => {
    const qc = new QueryClient()
    const { result } = renderHook(() => useImportRoster(null), { wrapper: wrapper(qc) })
    result.current.mutate({ tierId: 't', members: [] })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(vi.mocked(importRosterMembers)).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/org && ../../node_modules/.bin/vitest run src/features/roster-import/use-import-roster.test.tsx`
Expected: FAIL — `use-import-roster.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/org/src/features/roster-import/use-import-roster.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { importRosterMembers, type ImportMemberRow, type ImportResult } from '@monobase/sdk-ts/generated'

function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
  }
  return undefined
}

export function useImportRoster(orgId: string | null) {
  const qc = useQueryClient()
  return useMutation<ImportResult, Error, { tierId: string; members: ImportMemberRow[] }>({
    mutationFn: async ({ tierId, members }) => {
      if (!orgId) throw new Error('No organization selected.')
      // importRosterMembers returns a FLAT body ({imported,skipped,failed,errors}) — no {data} wrapper.
      const { data, error } = await importRosterMembers({
        body: { organizationId: orgId, tierId, members },
      })
      if (!data) throw new Error(serverError(error) ?? 'Roster import failed.')
      return data as ImportResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster', orgId] })
    },
  })
}
```

```ts
// apps/org/src/features/roster-import/use-tiers.ts
import { useQuery } from '@tanstack/react-query'
import { listMembershipTiers } from '@monobase/sdk-ts/generated'

export type Tier = { id: string; name: string; code: string }

export function useTiers(orgId: string | null): { tiers: Tier[]; loading: boolean } {
  const q = useQuery({
    queryKey: ['tiers', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      // listMembershipTiers returns a NESTED body: { data: tiers[], pagination }.
      const { data } = await listMembershipTiers()
      if (!data) throw new Error('tiers failed')
      return (data.data as Array<{ id: string; name: string; code: string }>).map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
      }))
    },
  })
  return { tiers: q.data ?? [], loading: !!orgId && q.isLoading }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/org && ../../node_modules/.bin/vitest run src/features/roster-import/use-import-roster.test.tsx` → 4 PASS.
Run: `cd apps/org && bun run typecheck` → 0 errors (incl. test files).

Note: if `ImportResult` is not exported from the SDK, reference the response type the SDK actually exports (`ImportRosterMembersResponse`) — read `packages/sdk-ts/src/generated/types.gen.ts` and use the exact exported name; the flat shape `{imported,skipped,failed,errors}` is the contract either way.

- [ ] **Step 5: Commit**

```bash
git add apps/org/src/features/roster-import/use-tiers.ts apps/org/src/features/roster-import/use-import-roster.ts apps/org/src/features/roster-import/use-import-roster.test.tsx
git commit -m "feat(org): useTiers + useImportRoster hooks (slice-2c T2)"
```

---

### Task 3: Import screen (view + container)

**Files:**
- Create: `apps/org/src/features/roster-import/ImportRoster.tsx`
- Test: `apps/org/src/features/roster-import/ImportRoster.test.tsx`

**Interfaces:**
- Consumes: `useTiers`, `useImportRoster` (T2); `parseCsv`, `mapRows`, `summarizeRows` (T1); `useSelectedOrg`, `useOrgs` from `../org/use-org`; `EmptyState`/`ErrorState` from `@monobase/ui`; type-only `ImportMemberRow`, `ImportResult` from SDK.
- Produces: default-export `ImportRoster` (container); named `ImportRosterView` (presentational, prop-driven). `ImportRosterViewProps` (below).

`ImportRosterView` is a pure state-driven view. Props:
```ts
export interface Parsed {
  rows: ImportMemberRow[]
  stats: { total: number; missingIdentifier: number; missingName: number }
}
export interface ImportRosterViewProps {
  tiers: { id: string; name: string; code: string }[]
  tiersLoading: boolean
  tierId: string
  onTierChange: (id: string) => void
  onFile: (file: File) => void
  fileError: string | null
  parsed: Parsed | null
  onImport: () => void
  importing: boolean
  result: ImportResult | null
  importError: string | null
}
```

- [ ] **Step 1: Write the failing test**

```tsx
// apps/org/src/features/roster-import/ImportRoster.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportRosterView, type ImportRosterViewProps } from './ImportRoster'

const base: ImportRosterViewProps = {
  tiers: [{ id: 't1', name: 'Regular', code: 'REGULAR' }],
  tiersLoading: false,
  tierId: '',
  onTierChange: () => {},
  onFile: () => {},
  fileError: null,
  parsed: null,
  onImport: () => {},
  importing: false,
  result: null,
  importError: null,
}

describe('ImportRosterView', () => {
  it('disables Import until a tier and a parsed file with rows exist', () => {
    render(<ImportRosterView {...base} />)
    expect(screen.getByRole('button', { name: /import/i })).toBeDisabled()
  })

  it('enables Import and shows preview counts when tier + rows are present', () => {
    render(
      <ImportRosterView
        {...base}
        tierId="t1"
        parsed={{ rows: [{ email: 'a@x.ph', firstName: 'A' }], stats: { total: 1, missingIdentifier: 0, missingName: 0 } }}
      />,
    )
    expect(screen.getByText(/1 member/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /import 1 member/i })).toBeEnabled()
  })

  it('blocks import and warns when over the 500-row cap', () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ email: `m${i}@x.ph` }))
    render(
      <ImportRosterView
        {...base}
        tierId="t1"
        parsed={{ rows, stats: { total: 501, missingIdentifier: 0, missingName: 0 } }}
      />,
    )
    expect(screen.getByRole('button', { name: /import/i })).toBeDisabled()
    expect(screen.getByText(/500/)).toBeInTheDocument()
  })

  it('renders a file error with role=alert', () => {
    render(<ImportRosterView {...base} fileError="CSV must include an email or licenseNumber column." />)
    expect(screen.getByRole('alert')).toHaveTextContent(/email or licenseNumber/i)
  })

  it('shows advisories for rows missing an identifier', () => {
    render(
      <ImportRosterView
        {...base}
        tierId="t1"
        parsed={{ rows: [{ firstName: 'NoId' }], stats: { total: 1, missingIdentifier: 1, missingName: 0 } }}
      />,
    )
    expect(screen.getByText(/1.*no email or license/i)).toBeInTheDocument()
  })

  it('renders the result summary with imported/skipped/failed and row errors', () => {
    render(
      <ImportRosterView
        {...base}
        tierId="t1"
        result={{ imported: 3, skipped: 1, failed: 1, errors: [{ index: 4, error: 'firstName is required to create a new member' }] }}
      />,
    )
    expect(screen.getByText(/3 new members added/i)).toBeInTheDocument()
    expect(screen.getByText(/1 already a member/i)).toBeInTheDocument()
    expect(screen.getByText(/1 row failed/i)).toBeInTheDocument()
    expect(screen.getByText(/row 5/i)).toBeInTheDocument() // index 4 → "Row 5"
  })

  it('surfaces a server import error with role=alert', () => {
    render(<ImportRosterView {...base} tierId="t1" importError="Importing the roster needs a Secretary or President position." />)
    expect(screen.getByRole('alert')).toHaveTextContent(/Secretary or President/i)
  })

  it('calls onImport when the enabled button is clicked', async () => {
    const onImport = vi.fn()
    render(
      <ImportRosterView
        {...base}
        tierId="t1"
        onImport={onImport}
        parsed={{ rows: [{ email: 'a@x.ph' }], stats: { total: 1, missingIdentifier: 0, missingName: 0 } }}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /import/i }))
    expect(onImport).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/org && ../../node_modules/.bin/vitest run src/features/roster-import/ImportRoster.test.tsx`
Expected: FAIL — `ImportRoster.tsx` does not exist.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/org/src/features/roster-import/ImportRoster.tsx
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { EmptyState } from '@monobase/ui'
import type { ImportMemberRow, ImportResult } from '@monobase/sdk-ts/generated'
import { useOrgs, useSelectedOrg } from '../org/use-org'
import { OrgPicker } from '../org/OrgPicker'
import { useTiers } from './use-tiers'
import { useImportRoster } from './use-import-roster'
import { parseCsv, mapRows, summarizeRows } from './csv'

const MAX_ROWS = 500

export interface Parsed {
  rows: ImportMemberRow[]
  stats: { total: number; missingIdentifier: number; missingName: number }
}

export interface ImportRosterViewProps {
  tiers: { id: string; name: string; code: string }[]
  tiersLoading: boolean
  tierId: string
  onTierChange: (id: string) => void
  onFile: (file: File) => void
  fileError: string | null
  parsed: Parsed | null
  onImport: () => void
  importing: boolean
  result: ImportResult | null
  importError: string | null
}

// ─── Presentational ─────────────────────────────────────────────────────────

export function ImportRosterView({
  tiers, tiersLoading, tierId, onTierChange, onFile, fileError,
  parsed, onImport, importing, result, importError,
}: ImportRosterViewProps) {
  if (result) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-title font-semibold text-foreground">Import complete</h1>
        <ul className="flex flex-col gap-2 text-body">
          <li className="text-plum-900">✓ {result.imported} new member{result.imported === 1 ? '' : 's'} added</li>
          <li className="text-plum-700">
            ↺ {result.skipped} {result.skipped === 1 ? 'already a member' : 'already members'} (skipped)
          </li>
          <li className={result.failed > 0 ? 'text-[var(--color-error)]' : 'text-plum-500'}>
            ✗ {result.failed} row{result.failed === 1 ? '' : 's'} failed
          </li>
        </ul>
        {result.errors.length > 0 && (
          <ul className="flex flex-col gap-1 text-caption text-[var(--color-error)]">
            {result.errors.map((e) => (
              <li key={e.index}>Row {e.index + 1}: {e.error}</li>
            ))}
          </ul>
        )}
        <Link
          to="/"
          className="min-h-tap inline-flex items-center justify-center rounded-md bg-plum-600 px-4 text-sm font-semibold text-white hover:bg-plum-700 focus-visible:outline focus-visible:outline-2 self-start"
        >
          View roster
        </Link>
      </div>
    )
  }

  const rowCount = parsed?.rows.length ?? 0
  const tooMany = rowCount > MAX_ROWS
  const canImport = !!tierId && rowCount > 0 && !tooMany && !importing

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-title font-semibold text-foreground">Import roster</h1>

      <label className="flex flex-col gap-1">
        <span className="text-body font-medium text-plum-900">Membership tier</span>
        <select
          className="min-h-tap rounded-md border border-plum-200 bg-white px-3 text-body"
          value={tierId}
          onChange={(e) => onTierChange(e.target.value)}
          disabled={tiersLoading}
        >
          <option value="">{tiersLoading ? 'Loading tiers…' : 'Select a tier…'}</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor="roster-file" className="text-body font-medium text-plum-900">Roster CSV file</label>
        <input
          id="roster-file"
          type="file"
          accept=".csv,text/csv"
          className="text-body"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
        />
        {/* help text is a sibling, NOT inside <label>, so it isn't folded into the input's accessible name */}
        <span className="text-caption text-plum-500">
          Expected columns: firstName, lastName, email, licenseNumber, memberNumber. Email or licenseNumber is required.
        </span>
      </div>

      {fileError && (
        <p role="alert" className="text-body text-[var(--color-error)]">{fileError}</p>
      )}

      {parsed && (
        <div className="flex flex-col gap-2 rounded-lg border border-plum-100 bg-white p-4">
          <p className="text-body text-plum-900">
            {parsed.stats.total} member{parsed.stats.total === 1 ? '' : 's'} found
          </p>
          {parsed.stats.missingIdentifier > 0 && (
            <p className="text-caption text-amber-700">
              {parsed.stats.missingIdentifier} with no email or license — these rows will fail.
            </p>
          )}
          {parsed.stats.missingName > 0 && (
            <p className="text-caption text-amber-700">
              {parsed.stats.missingName} with no first name — will fail if not already a member.
            </p>
          )}
          {tooMany && (
            <p role="alert" className="text-caption text-[var(--color-error)]">
              This file has more than {MAX_ROWS} rows. Split it into smaller files.
            </p>
          )}
        </div>
      )}

      {importError && (
        <p role="alert" className="text-body text-[var(--color-error)]">{importError}</p>
      )}

      <button
        type="button"
        onClick={onImport}
        disabled={!canImport}
        className="min-h-tap inline-flex items-center justify-center rounded-md bg-plum-600 px-4 text-sm font-semibold text-white hover:bg-plum-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 self-start"
      >
        {importing ? 'Importing…' : `Import ${rowCount || ''} ${rowCount === 1 ? 'member' : 'members'}`.replace(/\s+/g, ' ').trim()}
      </button>
    </div>
  )
}

// ─── Container ───────────────────────────────────────────────────────────────

export default function ImportRoster() {
  const { orgs } = useOrgs()
  const { orgId } = useSelectedOrg()
  const { tiers, loading: tiersLoading } = useTiers(orgId)
  const importMut = useImportRoster(orgId)

  const [tierId, setTierId] = useState('')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const { rows, headerError } = mapRows(parseCsv(text))
      if (headerError) { setFileError(headerError); setParsed(null); return }
      if (rows.length === 0) { setFileError('No member rows found in this file.'); setParsed(null); return }
      setFileError(null)
      setParsed({ rows, stats: summarizeRows(rows) })
    }
    reader.readAsText(file)
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <div className="max-w-lg mx-auto pt-4">
        <div className="px-4 pb-2 flex justify-end">
          <Link to="/" className="text-sm font-medium text-plum-500 hover:text-plum-700">← Roster</Link>
        </div>
        {orgs.length > 1 && <div className="px-4 pb-2"><OrgPicker /></div>}
        {!orgId ? (
          <div className="p-4">
            <EmptyState headline="No organization selected" description="Pick a chapter to import its roster." />
          </div>
        ) : (
          <ImportRosterView
            tiers={tiers}
            tiersLoading={tiersLoading}
            tierId={tierId}
            onTierChange={setTierId}
            onFile={handleFile}
            fileError={fileError}
            parsed={parsed}
            onImport={() => parsed && importMut.mutate({ tierId, members: parsed.rows })}
            importing={importMut.isPending}
            result={importMut.data ?? null}
            importError={importMut.isError ? importMut.error.message : null}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/org && ../../node_modules/.bin/vitest run src/features/roster-import/ImportRoster.test.tsx` → 8 PASS.
Run: `cd apps/org && bun run typecheck` → 0 errors.

If `text-amber-700`/`text-red-700` are not in the preset, use the DESIGN.md token classes the slice-2b dues view uses for warn/error (check `apps/org/src/features/dues/`); match existing convention rather than introducing raw colors.

- [ ] **Step 5: Commit**

```bash
git add apps/org/src/features/roster-import/ImportRoster.tsx apps/org/src/features/roster-import/ImportRoster.test.tsx
git commit -m "feat(org): roster import screen — tier select, CSV preview, summary (slice-2c T3)"
```

---

### Task 4: Route + roster wiring

**Files:**
- Create: `apps/org/src/routes/import.tsx`
- Modify: `apps/org/src/features/roster/Roster.tsx` (add "Import roster" links — header link + empty-state CTA)
- Regenerate + commit: `apps/org/src/routeTree.gen.ts`

**Interfaces:**
- Consumes: default-export `ImportRoster` from `../features/roster-import/ImportRoster`.
- Produces: route `/import`.

- [ ] **Step 1: Create the route**

```tsx
// apps/org/src/routes/import.tsx
import { createFileRoute } from '@tanstack/react-router'
import ImportRoster from '../features/roster-import/ImportRoster'

export const Route = createFileRoute('/import')({
  component: ImportRoster,
})
```

- [ ] **Step 2: Add roster links** — in `apps/org/src/features/roster/Roster.tsx`:

In the header row next to the `Dues →` link, add an Import link:
```tsx
        <div className="px-4 pb-2 flex justify-between">
          <Link to="/import" className="text-sm font-medium text-plum-500 hover:text-plum-700">
            + Import roster
          </Link>
          <Link to="/dues" className="text-sm font-medium text-plum-500 hover:text-plum-700">
            Dues →
          </Link>
        </div>
```
And make the empty-state actionable — replace the `EmptyState` in `RosterView`'s empty branch with one that links to import (keep the existing headline/description; add a CTA link below it):
```tsx
      <div className="flex flex-col gap-4 p-4">
        {orgName && <h1 className="text-title font-semibold text-foreground">{orgName}</h1>}
        <EmptyState headline="No members yet" description="Import your roster to get started." />
        <Link
          to="/import"
          className="min-h-tap inline-flex items-center justify-center rounded-md bg-plum-600 px-4 text-sm font-semibold text-white hover:bg-plum-700 focus-visible:outline focus-visible:outline-2 self-start"
        >
          Import roster
        </Link>
      </div>
```
(Keep the `errored` branch untouched. `Link` is already imported in Roster.tsx.)

- [ ] **Step 3: Regenerate the route tree + build**

Run: `cd apps/org && bun run build`
Expected: build succeeds; `routeTree.gen.ts` now includes the `/import` route. Confirm with `git diff --stat apps/org/src/routeTree.gen.ts` (it changed).

- [ ] **Step 4: Verify typecheck + full unit suite + existing roster tests still pass**

Run: `cd apps/org && bun run typecheck` → 0 errors.
Run: `cd apps/org && ../../node_modules/.bin/vitest run` → all green (T1–T3 + pre-existing).

- [ ] **Step 5: Commit**

```bash
git add apps/org/src/routes/import.tsx apps/org/src/features/roster/Roster.tsx apps/org/src/routeTree.gen.ts
git commit -m "feat(org): /import route + roster import links (slice-2c T4)"
```

---

### Task 5: E2E stub + CI green

**Files:**
- Create: `apps/org/src/e2e/import-flow.spec.ts`  ← playwright `testDir` is `./src/e2e` (NOT a top-level `e2e/`). A spec outside testDir is silently not discovered → vacuous green.

**Interfaces:** Consumes nothing from prior tasks at the code level; drives the built app with `page.route` stubs whose bodies match the real handler shapes.

- [ ] **Step 1: Write the E2E spec** (mirror the existing `apps/org/src/e2e/officer-flow.spec.ts`: self-contained `page.route` stubs, no live API/seed. Copy its EXACT auth/session bootstrap — it stubs `**/csrf-token` and `**/persons/me/memberships` to get past RootGate; replicate both.)

```ts
// apps/org/src/e2e/import-flow.spec.ts
import { test, expect } from '@playwright/test'

// Stub bodies MUST match real handler shapes:
//  - getMyMemberships: { data: [{ organizationId, orgName }], ... }
//  - listMembershipTiers: { data: [{ id, name, code, annualFee, ... }], pagination }  (annualFee REQUIRED — the
//      listMembershipTiers responseTransformer calls annualFee.toString(); omit it and the transformer throws)
//  - importRosterMembers: FLAT { imported, skipped, failed, errors }
test('officer imports a roster CSV and sees the summary', async ({ page }) => {
  // CRITICAL: the import POST is a non-exempt mutation → the SDK client fetches /csrf-token FIRST.
  // Without this stub that fetch rejects, the interceptor throws, and the import never fires.
  await page.route('**/csrf-token', (r) => r.fulfill({ json: { token: 't' } }))
  await page.route('**/persons/me/memberships', (r) =>
    r.fulfill({ json: { data: [{ organizationId: 'org-1', orgName: 'Dental Chapter' }] } }),
  )
  await page.route('**/association/member/tiers**', (r) =>
    r.fulfill({ json: { data: [{ id: 't1', name: 'Regular', code: 'REGULAR', annualFee: '300000', currency: 'PHP', benefits: [], status: 'active' }], pagination: {} } }),
  )
  await page.route('**/association/member/roster/import', (r) =>
    r.fulfill({ json: { imported: 2, skipped: 1, failed: 0, errors: [] } }),
  )
  await page.addInitScript(() => localStorage.setItem('org.selectedOrgId', 'org-1'))

  await page.goto('/import')
  await page.getByLabel(/membership tier/i).selectOption('t1')
  await page.getByLabel(/roster csv/i).setInputFiles({
    name: 'roster.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('firstName,email\nOlive,olive@x.ph\nMaria,maria@x.ph\nJose,jose@x.ph'),
  })
  await expect(page.getByText(/3 members found/i)).toBeVisible()
  await page.getByRole('button', { name: /import 3 members/i }).click()
  await expect(page.getByText(/2 new members added/i)).toBeVisible()
  await expect(page.getByText(/1 already a member/i)).toBeVisible()
})
```

- [ ] **Step 2: Run the E2E spec**

Run: `cd apps/org && bun run test:e2e import-flow` (or the project's e2e invocation — match slice-2b's `package.json` `test:e2e` script).
Expected: 1 PASS. If the route guard requires an auth cookie/session probe, replicate exactly what the existing slice-2b e2e spec does to get past the RootGate.

- [ ] **Step 3: Full local hard gate**

Run from repo root:
```bash
bun run typecheck                 # all 5 workspaces incl. apps/org tests → 0 errors
cd apps/org && ../../node_modules/.bin/vitest run   # all unit tests green
cd apps/org && bun run build      # build green
git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated   # MUST be EMPTY (engine frozen)
```

- [ ] **Step 4: Confirm CI org job needs nothing new** — the `org` job (`--filter @monobase/org`: build → typecheck → test) already exists in `.github/workflows/ci.yml` and is wired into `ci-gate`. No CI edits. (E2E is NOTE-deferred like slice-2a/2b — do not add an e2e CI job this slice.)

- [ ] **Step 5: Commit**

```bash
git add apps/org/e2e/import-flow.spec.ts
git commit -m "test(org): roster import E2E stub (slice-2c T5)"
```

---

## Self-review

**Spec coverage:** tier dropdown (T2/T3 ✓), CSV parse + header auto-map (T1 ✓), client preview + validation advisories (T1 summarize + T3 ✓), single JSON POST flat-response (T2 ✓), summary imported/skipped/failed+errors (T3 ✓), 500-cap client block (T3 ✓), 403/400 server-error surfacing (T2 serverError + T3 importError ✓), roster invalidation (T2 ✓), route + links + empty-state CTA (T4 ✓), E2E (T5 ✓), engine-frozen gate (T5 ✓). No multipart, no 2FA, no money/bigint — consistent with spec.

**Placeholder scan:** none — every step has runnable code/commands. Two explicit "match existing convention" notes (warn/error token classes in T3; e2e auth bootstrap + `test:e2e` invocation in T5) point the implementer at the slice-2b files to copy rather than guessing — these are real lookups, not TODOs.

**Type consistency:** `ImportMemberRow`/`ImportResult` are SDK type-only imports used identically in T1/T2/T3; `Parsed`/`ImportRosterViewProps` defined in T3 and consumed by its own test; `useImportRoster(orgId)` signature and `mutate({tierId,members})` call shape match across T2/T3; queryKey `['roster', orgId]` matches `useRoster`'s key in `roster/use-roster.ts`. T2 flags the one real risk: confirm the exact exported response type name in `types.gen.ts` (`ImportResult` vs `ImportRosterMembersResponse`) — flat shape is the contract regardless.
