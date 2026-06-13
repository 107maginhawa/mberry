import { describe, test, expect, afterEach } from 'bun:test'
import { render, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ChatView } from './chat-view'
import { getChatMessagesOptions } from '@monobase/sdk-ts/generated/react-query'

function renderWithQuery(node: ReactNode, qc: QueryClient) {
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>)
}

function buildClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  })
}

describe('ChatView', () => {
  afterEach(() => {
    cleanup()
  })

  // FIX-008 FE activation: message reads on a non-DM room must carry x-org-id
  // so the Step-33 getChatMessages cross-org guard is enforced.
  test('passes orgId as x-org-id header to getChatMessages options when orgId provided', async () => {
    const qc = buildClient()
    renderWithQuery(
      <ChatView roomId="room-1" myPersonId="me-1" orgId="org-55" />,
      qc,
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(getChatMessagesOptions).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { 'x-org-id': 'org-55' } }),
    )
  })
})
