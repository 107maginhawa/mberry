import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { ok, err } from '../../test-utils/mock-sdk'
import { useCreateAnnouncement } from './use-create-announcement'

vi.mock('@monobase/sdk-ts/generated', () => ({
  createAnnouncement: vi.fn(),
  publishAnnouncement: vi.fn(),
}))
import { createAnnouncement, publishAnnouncement } from '@monobase/sdk-ts/generated'
const mockCreate = createAnnouncement as unknown as ReturnType<typeof vi.fn>
const mockPublish = publishAnnouncement as unknown as ReturnType<typeof vi.fn>

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useCreateAnnouncement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends path orgId + typed body, then publishes with returned id', async () => {
    const draft = { id: 'a1', title: 'Dues due', content: 'Pay by Friday', status: 'draft' }
    const published = { ...draft, status: 'sent' }
    mockCreate.mockResolvedValue(ok(draft, 201))
    mockPublish.mockResolvedValue(ok(published, 200))
    const { result } = renderHook(() => useCreateAnnouncement('org-1'), { wrapper })
    result.current.mutate({ title: 'Dues due', content: 'Pay by Friday' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const createOpts = mockCreate.mock.calls[0]![0]
    expect(createOpts.path).toEqual({ organizationId: 'org-1' })
    expect(createOpts.body).toMatchObject({ title: 'Dues due', content: 'Pay by Friday' })
    const publishOpts = mockPublish.mock.calls[0]![0]
    expect(publishOpts.path).toEqual({ id: 'a1' })
    expect(result.current.data).toMatchObject({ status: 'sent' })
  })

  it('throws server error on create 403', async () => {
    mockCreate.mockResolvedValue(err(403, { error: 'Two-factor authentication required' }))
    const { result } = renderHook(() => useCreateAnnouncement('org-1'), { wrapper })
    result.current.mutate({ title: 't', content: 'c' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/two-factor/i)
    expect(mockPublish).not.toHaveBeenCalled()
  })

  it('throws error if publish fails', async () => {
    mockCreate.mockResolvedValue(ok({ id: 'a1', title: 't', content: 'c', status: 'draft' }, 201))
    mockPublish.mockResolvedValue(err(403, { error: 'Two-factor authentication required' }))
    const { result } = renderHook(() => useCreateAnnouncement('org-1'), { wrapper })
    result.current.mutate({ title: 't', content: 'c' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toMatch(/two-factor/i)
  })
})
