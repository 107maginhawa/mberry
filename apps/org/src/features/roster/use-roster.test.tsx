import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ listOrgMembers: vi.fn() }))
import { listOrgMembers } from '@monobase/sdk-ts/generated'
import type { ListOrgMembersResponse } from '@monobase/sdk-ts/generated'
import { useRoster } from './use-roster'
import { ok } from '../../test-utils/mock-sdk'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useRoster', () => {
  it('maps members with composed name', async () => {
    vi.mocked(listOrgMembers).mockResolvedValue(
      ok<ListOrgMembersResponse>({
        data: [{ id: 'm1', personId: 'p1', firstName: 'Olive', lastName: 'Cruz', status: 'active', memberNumber: 'A-1' }],
      })
    )
    const { result } = renderHook(() => useRoster('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.members).toEqual([{ membershipId: 'm1', personId: 'p1', name: 'Olive Cruz', memberNumber: 'A-1', status: 'active' }])
  })

  it('idle when no org selected', () => {
    const { result } = renderHook(() => useRoster(null), { wrapper })
    expect(result.current.status).toBe('idle')
  })
})
