import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ publishEvent: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
import { publishEvent } from '@monobase/sdk-ts/generated'
import { toast } from 'sonner'
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

  it('on error: toasts and still reconciles the list (refetch on settle)', async () => {
    vi.mocked(publishEvent).mockResolvedValue(err(409, { error: 'INVALID_STATUS' }) as any)
    const { spy, wrapper } = mk()
    const { result } = renderHook(() => usePublishEvent('o1'), { wrapper })
    act(() => result.current.publish('d1'))
    // toast.error fires; the list invalidates on settle so a stale 409 draft row reconciles.
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('INVALID_STATUS'))
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['org-events', 'o1'] }))
  })
})
