import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ listOrganizations: vi.fn() }))
import { listOrganizations } from '@monobase/sdk-ts/generated'
import { useOrgs } from './use-orgs'
import { ok, err } from '../../test-utils/mock-sdk'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useOrgs', () => {
  it('maps orgs + exposes total from pagination.total', async () => {
    // DRIFT: handler sends pagination {offset,limit,total}; SDK type declares totalCount → cast.
    vi.mocked(listOrganizations).mockResolvedValue(
      ok({
        data: [{ id: 'o1', name: 'Olive Dental Chapter', region: 'NCR', orgType: 'chapter', status: 'trial', createdAt: new Date('2026-06-01') }],
        pagination: { offset: 0, limit: 20, total: 1 },
      } as any),
    )
    const { result } = renderHook(() => useOrgs(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.orgs[0]!.name).toBe('Olive Dental Chapter')
    expect(result.current.total).toBe(1)
  })

  it('empty list → ready with [] and total 0', async () => {
    vi.mocked(listOrganizations).mockResolvedValue(
      ok({ data: [], pagination: { offset: 0, limit: 20, total: 0 } } as any),
    )
    const { result } = renderHook(() => useOrgs(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.orgs).toHaveLength(0)
    expect(result.current.total).toBe(0)
  })

  it('SDK error → status error, empty orgs', async () => {
    vi.mocked(listOrganizations).mockResolvedValue(err(500) as any)
    const { result } = renderHook(() => useOrgs(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.orgs).toHaveLength(0)
    expect(result.current.total).toBe(0)
  })
})
