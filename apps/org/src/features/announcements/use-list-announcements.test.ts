import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
vi.mock('@monobase/sdk-ts/generated', () => ({ listAnnouncements: vi.fn() }))
import { listAnnouncements } from '@monobase/sdk-ts/generated'
import type { Announcement, ListAnnouncementsResponse } from '@monobase/sdk-ts/generated'
import { useListAnnouncements } from './use-list-announcements'
import { ok, err } from '../../test-utils/mock-sdk'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

// A full Announcement anchored to the real SDK type — proves field names exist.
function announcement(over: Partial<Announcement> = {}): Announcement {
  return {
    id: 'a1',
    version: 1,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
    organizationId: 'o1',
    authorId: 'p1',
    title: 'Welcome',
    content: 'Hello members',
    audienceType: 'all',
    channelPush: false,
    channelEmail: false,
    visibility: 'internal',
    status: 'sent',
    ...over,
  }
}

const pagination = { offset: 0, limit: 50, count: 1, totalCount: 1, totalPages: 1, currentPage: 1, hasNextPage: false, hasPreviousPage: false }

describe('useListAnnouncements', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps announcements to the view shape (happy path)', async () => {
    vi.mocked(listAnnouncements).mockResolvedValue(
      ok<ListAnnouncementsResponse>({
        data: [announcement({ id: 'a1', title: 'Welcome', content: 'Hello members', status: 'sent', publishedAt: new Date('2026-06-02T00:00:00Z') })],
        pagination,
      }),
    )
    const { result } = renderHook(() => useListAnnouncements('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.announcements).toEqual([
      { id: 'a1', title: 'Welcome', content: 'Hello members', status: 'sent', date: new Date('2026-06-02T00:00:00Z') },
    ])
  })

  it('falls back to createdAt when publishedAt is absent', async () => {
    vi.mocked(listAnnouncements).mockResolvedValue(
      ok<ListAnnouncementsResponse>({
        data: [announcement({ id: 'a2', status: 'draft', publishedAt: undefined, createdAt: new Date('2026-06-01T00:00:00Z') })],
        pagination,
      }),
    )
    const { result } = renderHook(() => useListAnnouncements('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.announcements[0]?.date).toEqual(new Date('2026-06-01T00:00:00Z'))
  })

  it('reports empty when the list is empty', async () => {
    vi.mocked(listAnnouncements).mockResolvedValue(
      ok<ListAnnouncementsResponse>({ data: [], pagination: { ...pagination, count: 0, totalCount: 0, totalPages: 0 } }),
    )
    const { result } = renderHook(() => useListAnnouncements('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('empty'))
    expect(result.current.announcements).toEqual([])
  })

  it('idle (no query fired) when no org selected', () => {
    const { result } = renderHook(() => useListAnnouncements(null), { wrapper })
    expect(result.current.status).toBe('idle')
    expect(listAnnouncements).not.toHaveBeenCalled()
  })

  it('reports error when the request fails', async () => {
    vi.mocked(listAnnouncements).mockResolvedValue(err(403, { error: 'forbidden' }) as any)
    const { result } = renderHook(() => useListAnnouncements('o1'), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('error'))
  })
})
