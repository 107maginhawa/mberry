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
