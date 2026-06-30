import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ listRosterMembers: vi.fn() }))
import { listRosterMembers } from '@monobase/sdk-ts/generated'
import { useRenewals } from './use-renewals'
import { ok, err } from '../../test-utils/mock-sdk'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

beforeEach(() => vi.clearAllMocks())

describe('useRenewals', () => {
  it('buckets members by urgency, sorts due-soon ascending, ignores far/undated', async () => {
    vi.mocked(listRosterMembers).mockResolvedValue(ok({
      data: [
        { id: 'm1', personId: 'p1', name: 'Soon 10', status: 'active', duesExpiryDate: inDays(10) },
        { id: 'm2', personId: 'p2', name: 'Soon 3', status: 'active', duesExpiryDate: inDays(3) },
        { id: 'm3', personId: 'p3', name: 'Far', status: 'active', duesExpiryDate: inDays(200) },
        { id: 'm4', personId: 'p4', name: 'Grace', status: 'gracePeriod' },
        { id: 'm5', personId: 'p5', name: 'Lapsed', status: 'lapsed' },
        { id: 'm6', personId: 'p6', name: 'No Date', status: 'active', duesExpiryDate: null }, // epoch → ignored
      ],
      totalCount: 6,
    } as any))
    const { result } = renderHook(() => useRenewals('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const { dueSoon, grace, lapsed } = result.current.buckets
    expect(dueSoon.map((m) => m.name)).toEqual(['Soon 3', 'Soon 10']) // soonest first; Far + No Date excluded
    expect(grace.map((m) => m.name)).toEqual(['Grace'])
    expect(lapsed.map((m) => m.name)).toEqual(['Lapsed'])
  })

  it('handles due-soon boundaries (0 and 30 in, 31 and negative out) and the epoch-coerced null date', async () => {
    vi.mocked(listRosterMembers).mockResolvedValue(ok({
      data: [
        { id: 't', personId: 'p', name: 'Today', status: 'active', duesExpiryDate: inDays(0) },     // in
        { id: 'a', personId: 'p', name: 'Edge30', status: 'active', duesExpiryDate: inDays(30) },    // in
        { id: 'b', personId: 'p', name: 'Edge31', status: 'active', duesExpiryDate: inDays(31) },    // out
        { id: 'c', personId: 'p', name: 'Expired', status: 'active', duesExpiryDate: inDays(-1) },   // out (active but past)
        { id: 'e', personId: 'p', name: 'Epoch', status: 'active', duesExpiryDate: new Date(0).toISOString() }, // out (null→1970)
      ],
      totalCount: 5,
    } as any))
    const { result } = renderHook(() => useRenewals('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.buckets.dueSoon.map((m) => m.name)).toEqual(['Today', 'Edge30'])
  })

  it('is empty when nobody is due/grace/lapsed', async () => {
    vi.mocked(listRosterMembers).mockResolvedValue(ok({
      data: [{ id: 'm1', personId: 'p1', name: 'Fine', status: 'active', duesExpiryDate: inDays(300) }],
      totalCount: 1,
    } as any))
    const { result } = renderHook(() => useRenewals('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('empty'))
  })

  it('errors on a 403', async () => {
    vi.mocked(listRosterMembers).mockResolvedValue(err(403, { error: 'forbidden' }) as any)
    const { result } = renderHook(() => useRenewals('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('is idle with no org', () => {
    const { result } = renderHook(() => useRenewals(null), { wrapper })
    expect(result.current.status).toBe('idle')
  })
})
