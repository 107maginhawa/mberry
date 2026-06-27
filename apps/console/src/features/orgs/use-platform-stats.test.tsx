import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { GetPlatformSummaryResponse } from '@monobase/sdk-ts/generated'
vi.mock('@monobase/sdk-ts/generated', () => ({ getPlatformSummary: vi.fn() }))
import { getPlatformSummary } from '@monobase/sdk-ts/generated'
import { usePlatformStats } from './use-platform-stats'
import { ok } from '../../test-utils/mock-sdk'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('usePlatformStats', () => {
  it('non-empty data: aggregates sums, avg collectionRate, hasSnapshot true', async () => {
    vi.mocked(getPlatformSummary).mockResolvedValue(
      ok<GetPlatformSummaryResponse>({
        data: [
          { associationId: 'a1', chapterCount: 1, totalMembers: 10, activeMembers: 8, collectionRate: 50, creditCompliance: 0, totalRevenueCents: 150000 },
          { associationId: 'a2', chapterCount: 2, totalMembers: 20, activeMembers: 15, collectionRate: 70, creditCompliance: 0, totalRevenueCents: 50000 },
        ],
        meta: { cursor: null, hasMore: false, total: 2 },
      }),
    )
    const { result } = renderHook(() => usePlatformStats(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.hasSnapshot).toBe(true)
    expect(result.current.stats.totalMembers).toBe(30)
    expect(result.current.stats.activeMembers).toBe(23)
    expect(result.current.stats.totalRevenueCents).toBe(200000)
    expect(result.current.stats.avgCollectionRate).toBe(60)
  })

  it('empty data: hasSnapshot false, status ready, stats all zero (I1 — not a confident zero)', async () => {
    vi.mocked(getPlatformSummary).mockResolvedValue(
      ok<GetPlatformSummaryResponse>({ data: [], meta: { cursor: null, hasMore: false, total: 0 } }),
    )
    const { result } = renderHook(() => usePlatformStats(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    // hasSnapshot drives the empty-state rendering — never render confident 0/₱0.00 when false
    expect(result.current.hasSnapshot).toBe(false)
    expect(result.current.stats.totalMembers).toBe(0)
    expect(result.current.stats.totalRevenueCents).toBe(0)
    expect(result.current.stats.avgCollectionRate).toBe(0)
  })
})
