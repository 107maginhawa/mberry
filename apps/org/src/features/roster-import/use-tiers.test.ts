import { createElement, type ReactNode } from 'react'
import { it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ listMembershipTiers: vi.fn() }))
import { listMembershipTiers } from '@monobase/sdk-ts/generated'
import { useTiers } from './use-tiers'
import { ok } from '../../test-utils/mock-sdk'

// .ts file (no JSX) — build the provider tree with createElement.
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

// Reset call counts so the disabled-when-null case sees a clean mock.
beforeEach(() => { vi.clearAllMocks() })

// Shared pagination stub — hook reads data.data only; pagination shape is ignored at runtime.
const PAGE1 = { offset: 0, limit: 50, count: 1, totalCount: 1, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false }

it('useTiers maps the NESTED { data: { data: tiers[] } } envelope to {id,name,code}', async () => {
  // listMembershipTiers returns a NESTED body: { data: tiers[], pagination }.
  vi.mocked(listMembershipTiers).mockResolvedValue(
    ok({ data: [
      { id: 't1', name: 'Regular', code: 'REG' },
      { id: 't2', name: 'Student', code: 'STU' },
    ], pagination: { ...PAGE1, count: 2, totalCount: 2 } } as any)
  )
  const { result } = renderHook(() => useTiers('o1'), { wrapper })
  await waitFor(() => expect(result.current.tiers.length).toBe(2))
  expect(result.current.tiers).toEqual([
    { id: 't1', name: 'Regular', code: 'REG' },
    { id: 't2', name: 'Student', code: 'STU' },
  ])
  expect(result.current.loading).toBe(false)
})

it('useTiers is disabled when orgId is null — does not call the SDK and returns []', async () => {
  const { result } = renderHook(() => useTiers(null), { wrapper })
  // enabled: !!orgId — the query never runs.
  expect(listMembershipTiers).not.toHaveBeenCalled()
  expect(result.current.tiers).toEqual([])
  expect(result.current.loading).toBe(false)
})

it('useTiers strips extra fields, keeping only id/name/code', async () => {
  vi.mocked(listMembershipTiers).mockResolvedValue(
    ok({ data: [
      { id: 't1', name: 'Regular', code: 'REG', description: 'extra', amountDue: 100000n },
    ], pagination: PAGE1 } as any)
  )
  const { result } = renderHook(() => useTiers('o1'), { wrapper })
  await waitFor(() => expect(result.current.tiers.length).toBe(1))
  expect(result.current.tiers[0]).toEqual({ id: 't1', name: 'Regular', code: 'REG' })
  expect(Object.keys(result.current.tiers[0]!)).toEqual(['id', 'name', 'code'])
})
