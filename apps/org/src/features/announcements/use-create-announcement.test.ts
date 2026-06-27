import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { ok, err } from '../../test-utils/mock-sdk'
import { useCreateAnnouncement } from './use-create-announcement'

vi.mock('@monobase/sdk-ts/generated', () => ({ createAnnouncement: vi.fn() }))
import { createAnnouncement } from '@monobase/sdk-ts/generated'
const mockCreate = createAnnouncement as unknown as ReturnType<typeof vi.fn>

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useCreateAnnouncement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends path orgId + typed body', async () => {
    mockCreate.mockResolvedValue(ok({ id: 'a1' }, 201))
    const { result } = renderHook(() => useCreateAnnouncement('org-1'), { wrapper })
    result.current.mutate({ title: 'Dues due', content: 'Pay by Friday' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const opts = mockCreate.mock.calls[0]![0]
    expect(opts.path).toEqual({ organizationId: 'org-1' })
    expect(opts.body).toMatchObject({ title: 'Dues due', content: 'Pay by Friday' })
  })

  it('throws server error on 403', async () => {
    mockCreate.mockResolvedValue(err(403, { error: 'Two-factor authentication required' }))
    const { result } = renderHook(() => useCreateAnnouncement('org-1'), { wrapper })
    result.current.mutate({ title: 't', content: 'c' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/two-factor/i)
  })
})
