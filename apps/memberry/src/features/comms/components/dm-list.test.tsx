import { describe, test, expect, afterEach } from 'bun:test'
import { render, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { DmList } from './dm-list'
import { listChatRoomsOptions, listChatRoomsQueryKey } from '@monobase/sdk-ts/generated/react-query'
import type { ChatRoom } from '@monobase/sdk-ts/generated/types.gen'

function buildRoom(overrides: Partial<ChatRoom> = {}): ChatRoom {
  return {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: new Date('2026-05-15T10:00:00Z'),
    updatedAt: new Date('2026-05-15T10:00:00Z'),
    participants: ['me-1', 'other-2'],
    status: 'active',
    ...overrides,
  } as ChatRoom
}

function renderWithQuery(node: ReactNode, qc: QueryClient) {
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>)
}

function buildClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  })
}

describe('DmList', () => {
  afterEach(() => {
    cleanup()
  })

  // FIX-008 FE activation: DM list read must carry x-org-id so the backend
  // (organization_id = caller OR room_type = 'dm') filter is exercised.
  test('passes orgId as x-org-id header to listChatRooms options when orgId provided', async () => {
    const qc = buildClient()
    renderWithQuery(
      <DmList orgId="org-77" myPersonId="me-1" onSelectRoom={() => {}} />,
      qc,
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(listChatRoomsOptions).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { 'x-org-id': 'org-77' } }),
    )
  })

  // PD-2 preserved: DM rooms must keep showing under the org-scoped read.
  test('still renders DM rooms when the org-scoped query returns them', async () => {
    const qc = buildClient()
    const dm = buildRoom({ participants: ['me-1', 'other-2'] })
    qc.setQueryData(
      listChatRoomsQueryKey({ query: { status: 'active' }, headers: { 'x-org-id': 'org-77' } }),
      { data: [dm] },
    )
    renderWithQuery(
      <DmList orgId="org-77" myPersonId="me-1" onSelectRoom={() => {}} />,
      qc,
    )
    await new Promise((r) => setTimeout(r, 0))
    // The other participant's truncated id should appear in the DM row.
    expect(document.body.textContent ?? '').toContain('other-2'.slice(0, 8))
  })
})
