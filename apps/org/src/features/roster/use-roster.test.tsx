import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ listRosterMembers: vi.fn() }))
import { listRosterMembers } from '@monobase/sdk-ts/generated'
import { useRoster } from './use-roster'
import { ok, err } from '../../test-utils/mock-sdk'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useRoster', () => {
  it('maps rows from the handler { data, totalCount } shape and derives unpaid/since/tier', async () => {
    vi.mocked(listRosterMembers).mockResolvedValue(
      // DRIFT: handler returns { data, totalCount }; the generated type says { data, pagination }.
      // Anchor the mock to the HANDLER shape (the lean-launch CI gotcha).
      ok({
        data: [
          { id: 'm1', personId: 'p1', name: 'Olive Cruz', status: 'active', memberNumber: 'A-1', joinedAt: '2019-01-01T00:00:00Z', categoryName: 'Gold', duesInvoiceStatus: null },
          { id: 'm2', personId: 'p2', firstName: 'Ben', lastName: 'Santos', status: 'active', memberNumber: 'B-2', joinedAt: null, categoryName: null, duesInvoiceStatus: 'sent' },
        ],
        totalCount: 2,
      } as any),
    )
    const { result } = renderHook(() => useRoster('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.totalCount).toBe(2)
    const [a, b] = result.current.members
    expect(a).toMatchObject({ membershipId: 'm1', name: 'Olive Cruz', status: 'active', tier: 'Gold', unpaid: false })
    // composed name fallback + unpaid derived from an open invoice (duesInvoiceStatus='sent')
    expect(b).toMatchObject({ membershipId: 'm2', name: 'Ben Santos', tier: null, unpaid: true })
  })

  it('maps the unpaid chip to the server status=pendingPayment param', async () => {
    vi.mocked(listRosterMembers).mockResolvedValue(ok({ data: [], totalCount: 0 } as any))
    renderHook(() => useRoster('o1', 'unpaid'), { wrapper })
    await waitFor(() => expect(listRosterMembers).toHaveBeenCalled())
    expect(vi.mocked(listRosterMembers)).toHaveBeenCalledWith({
      query: { organizationId: 'o1', pageSize: 100, status: 'pendingPayment' },
    })
  })

  it('sends no status param for the All filter', async () => {
    vi.mocked(listRosterMembers).mockResolvedValue(ok({ data: [], totalCount: 0 } as any))
    renderHook(() => useRoster('o1', 'all'), { wrapper })
    await waitFor(() => expect(listRosterMembers).toHaveBeenCalled())
    expect(vi.mocked(listRosterMembers)).toHaveBeenCalledWith({
      query: { organizationId: 'o1', pageSize: 100 },
    })
  })

  it('surfaces a 403 (wrong role / no 2FA) as the error state', async () => {
    vi.mocked(listRosterMembers).mockResolvedValue(err(403, { error: 'forbidden' }) as any)
    const { result } = renderHook(() => useRoster('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('is idle when no org is selected', () => {
    const { result } = renderHook(() => useRoster(null), { wrapper })
    expect(result.current.status).toBe('idle')
  })
})
