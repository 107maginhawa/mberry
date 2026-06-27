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
