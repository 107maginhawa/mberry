import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('@monobase/sdk-ts/generated', () => ({ getMyMemberships: vi.fn() }))
import { getMyMemberships } from '@monobase/sdk-ts/generated'
import { useSession } from './use-session'
import { ok, err } from '@/test-utils/mock-sdk'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('authed when memberships resolve', async () => {
    vi.mocked(getMyMemberships).mockResolvedValue(
      ok({ data: [{ organizationId: 'org-1' }], total: 1 } as any),
    )
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('authed'))
    expect(result.current.memberships).toHaveLength(1)
  })

  it('unauthed on 401', async () => {
    // Cast to any: err() returns error:unknown but SDK expects AuthenticationError.
    vi.mocked(getMyMemberships).mockResolvedValue(err(401) as any)
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('unauthed'))
  })

  it('unauthed when response is undefined (transport failure)', async () => {
    // SDK returns {data: undefined, response: undefined} on network errors. Cast to any.
    vi.mocked(getMyMemberships).mockResolvedValue({
      data: undefined,
      error: undefined,
      request: new Request('http://t'),
      response: undefined,
    } as any)
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('unauthed'))
  })

  it('enabled:false → no SDK call, returns status:loading', async () => {
    const { result } = renderHook(() => useSession(false), { wrapper })
    // Query is disabled — probe must never fire
    expect(getMyMemberships).not.toHaveBeenCalled()
    expect(result.current.status).toBe('loading')
  })

  it('memberships array exposed when authed', async () => {
    // Drift field: organizationId returned by handler; SDK MyMembership type may omit it.
    vi.mocked(getMyMemberships).mockResolvedValue(
      ok({ data: [{ organizationId: 'org-2' }, { organizationId: 'org-3' }], total: 2 } as any),
    )
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('authed'))
    expect(result.current.memberships).toEqual([
      { organizationId: 'org-2' },
      { organizationId: 'org-3' },
    ])
  })
})
