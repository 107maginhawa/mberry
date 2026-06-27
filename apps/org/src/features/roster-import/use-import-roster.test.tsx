// apps/org/src/features/roster-import/use-import-roster.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { ok, err } from '../../test-utils/mock-sdk'

vi.mock('@monobase/sdk-ts/generated', () => ({
  importRosterMembers: vi.fn(),
  listMembershipTiers: vi.fn(),
}))
import { importRosterMembers } from '@monobase/sdk-ts/generated'
import { useImportRoster } from './use-import-roster'

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useImportRoster', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts organizationId+tierId+members and returns the flat ImportResult', async () => {
    // Handler returns a FLAT body: { imported, skipped, failed, errors }
    vi.mocked(importRosterMembers).mockResolvedValue(
      ok({ imported: 2, skipped: 1, failed: 0, errors: [] }) as any,
    )
    const qc = new QueryClient()
    const { result } = renderHook(() => useImportRoster('org-1'), { wrapper: wrapper(qc) })
    result.current.mutate({ tierId: 'tier-1', members: [{ email: 'a@x.ph', firstName: 'A' }] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ imported: 2, skipped: 1, failed: 0, errors: [] })
    expect(vi.mocked(importRosterMembers)).toHaveBeenCalledWith({
      body: { organizationId: 'org-1', tierId: 'tier-1', members: [{ email: 'a@x.ph', firstName: 'A' }] },
    })
  })

  it('invalidates the roster query on success', async () => {
    vi.mocked(importRosterMembers).mockResolvedValue(ok({ imported: 1, skipped: 0, failed: 0, errors: [] }) as any)
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useImportRoster('org-1'), { wrapper: wrapper(qc) })
    result.current.mutate({ tierId: 't', members: [] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ queryKey: ['roster', 'org-1'] })
  })

  it('surfaces the server error message on non-2xx', async () => {
    vi.mocked(importRosterMembers).mockResolvedValue(err(400, { error: 'tierId is required' }) as any)
    const qc = new QueryClient()
    const { result } = renderHook(() => useImportRoster('org-1'), { wrapper: wrapper(qc) })
    result.current.mutate({ tierId: '', members: [] })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('tierId is required')
  })

  it('errors when no org is selected without calling the SDK', async () => {
    const qc = new QueryClient()
    const { result } = renderHook(() => useImportRoster(null), { wrapper: wrapper(qc) })
    result.current.mutate({ tierId: 't', members: [] })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(vi.mocked(importRosterMembers)).not.toHaveBeenCalled()
  })
})
