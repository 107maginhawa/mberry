import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ listOrganizations: vi.fn() }))
import { listOrganizations } from '@monobase/sdk-ts/generated'
import { useSession } from './use-session'
import { ok, err } from '../../test-utils/mock-sdk'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSession', () => {
  it('authed on 200', async () => {
    // DRIFT: handler returns pagination {offset,limit,total} only; SDK type wants more → cast.
    vi.mocked(listOrganizations).mockResolvedValue(
      ok({ data: [], pagination: { offset: 0, limit: 20, total: 0 } } as any),
    )
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('authed'))
  })

  it('unauthed on 401', async () => {
    // err() uses error:unknown; SDK type wants AuthenticationError → cast.
    vi.mocked(listOrganizations).mockResolvedValue(err(401) as any)
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('unauthed'))
  })

  it('forbidden on 403 (signed in, not a platform admin)', async () => {
    // err() uses error:unknown; SDK type wants AuthenticationError → cast.
    vi.mocked(listOrganizations).mockResolvedValue(err(403) as any)
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('forbidden'))
  })
})
