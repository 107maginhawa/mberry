import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@tanstack/react-router', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  Link: ({ to: _to, params: _p, children, ...rest }: any) => <a {...rest}>{children}</a>,
}))
vi.mock('@/features/org/use-org', () => ({ useSelectedOrg: () => ({ orgId: 'o1' }) }))
vi.mock('@/features/events/use-org-events', () => ({
  useOrgEvents: () => ({
    status: 'ready',
    events: [{ id: 'd1', title: 'Spring Assembly', status: 'draft', startDate: '2026-03-01T06:00:00Z' }],
  }),
}))
vi.mock('@/features/events/use-publish-event', () => ({
  usePublishEvent: () => ({ publish: vi.fn(), publishingId: null }),
}))
import { EventsPage } from './events'

function wrapper(ui: React.ReactNode) {
  const qc = new QueryClient()
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('EventsPage', () => {
  it('renders the events list above the create form', () => {
    wrapper(<EventsPage />)
    const list = screen.getByText('Spring Assembly')
    const create = screen.getByRole('heading', { name: /create a new event/i })
    expect(list).toBeInTheDocument()
    expect(create).toBeInTheDocument()
    // list precedes the create form in document order
    expect(list.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
