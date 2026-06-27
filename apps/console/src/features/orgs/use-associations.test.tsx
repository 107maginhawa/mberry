import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ listAssociations: vi.fn() }))
import { listAssociations } from '@monobase/sdk-ts/generated'
import { useAssociations } from './use-associations'
import { ok, err } from '../../test-utils/mock-sdk'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useAssociations', () => {
  it('maps associations to {id, name}[]', async () => {
    // DRIFT: handler sends pagination {offset,limit,total}; SDK type declares count → cast.
    vi.mocked(listAssociations).mockResolvedValue(
      ok({
        data: [{ id: 'a1', name: 'PDA National', orgType: 'association', status: 'active' }],
        pagination: { offset: 0, limit: 20, total: 1 },
      } as any),
    )
    const { result } = renderHook(() => useAssociations(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.associations).toHaveLength(1)
    expect(result.current.associations[0]).toEqual({ id: 'a1', name: 'PDA National' })
  })

  it('empty list → ready with []', async () => {
    vi.mocked(listAssociations).mockResolvedValue(
      ok({ data: [], pagination: { offset: 0, limit: 20, total: 0 } } as any),
    )
    const { result } = renderHook(() => useAssociations(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.associations).toHaveLength(0)
  })

  it('SDK error → status error', async () => {
    vi.mocked(listAssociations).mockResolvedValue(err(500) as any)
    const { result } = renderHook(() => useAssociations(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.associations).toHaveLength(0)
  })
})
