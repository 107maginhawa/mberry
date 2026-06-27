import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ getMyMemberships: vi.fn() }))
import { getMyMemberships } from '@monobase/sdk-ts/generated'
import { useSession } from './use-session'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSession', () => {
  it('authed when memberships resolve', async () => {
    ;(getMyMemberships as any).mockResolvedValue({ data: { data: [], total: 0 }, response: new Response('', { status: 200 }) } as any)
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('authed'))
  })

  it('unauthed on 401', async () => {
    ;(getMyMemberships as any).mockResolvedValue({ data: undefined, response: new Response('', { status: 401 }) } as any)
    const { result } = renderHook(() => useSession(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('unauthed'))
  })
})
