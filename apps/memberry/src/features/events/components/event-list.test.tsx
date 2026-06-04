import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { EventList } from './event-list'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
// Router (Link, useParams, useNavigate) provided by global mock in test-setup-root.ts.
// @monobase/ui rendered as real components against happy-dom.

vi.mock('./event-calendar', () => ({
  EventCalendar: () => <div data-testid="event-calendar" />,
}))

vi.mock('@/components/patterns/confirm-dialog', () => ({
  ConfirmDialog: ({ children, onConfirm, title, ...rest }: any) => (
    <div data-testid="confirm-dialog" {...rest}>
      <span>{title}</span>
      <button onClick={onConfirm}>Confirm</button>
      {children}
    </div>
  ),
}))

vi.mock('./event-card', () => ({
  EventCard: ({ event }: any) => <div data-testid="event-card">{event.title}</div>,
}))

import {
  searchEventsOptions,
  cancelEventMutation,
} from '@monobase/sdk-ts/generated/react-query'

const mockSearchOptions = searchEventsOptions as ReturnType<typeof vi.fn>
const mockCancelMutation = cancelEventMutation as ReturnType<typeof vi.fn>

describe('EventList', () => {
  beforeEach(() => {
    ;(globalThis as any).__routerParams = { orgSlug: 'test-org' }
    vi.clearAllMocks()
    mockCancelMutation.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
  })

  test('shows loading skeletons', () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['events', 'org-1'],
      queryFn: () => new Promise(() => {}),
    })

    renderWithProviders(<EventList orgId="org-1" />)

    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  test('shows empty state', async () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['events', 'org-1'],
      queryFn: () => Promise.resolve({ data: [], pagination: { totalCount: 0 } }),
    })

    renderWithProviders(<EventList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText(/No upcoming events/)).toBeInTheDocument()
    })
  })

  test('renders event cards when data exists', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()
    mockSearchOptions.mockReturnValue({
      queryKey: ['events', 'org-1'],
      queryFn: () =>
        Promise.resolve({
          data: [
            {
              id: 'evt-1',
              title: 'Annual Assembly',
              status: 'published',
              startDate: futureDate,
              endDate: futureDate,
            },
          ],
          pagination: { totalCount: 1 },
        }),
    })

    renderWithProviders(<EventList orgId="org-1" />)

    await waitFor(() => {
      expect(screen.getByText('Annual Assembly')).toBeInTheDocument()
    })
  })

  test('renders status tab buttons', () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['events', 'org-1'],
      queryFn: () => Promise.resolve({ data: [], pagination: { totalCount: 0 } }),
    })

    renderWithProviders(<EventList orgId="org-1" />)

    // "Upcoming" and "Drafts" appear in both tab buttons and stat cards
    expect(screen.getAllByText('Upcoming')).toHaveLength(2)
    expect(screen.getByText('Past')).toBeInTheDocument()
    expect(screen.getAllByText('Drafts')).toHaveLength(2)
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  test('renders stat cards', () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['events', 'org-1'],
      queryFn: () => Promise.resolve({ data: [], pagination: { totalCount: 0 } }),
    })

    renderWithProviders(<EventList orgId="org-1" />)

    expect(screen.getAllByText('Upcoming')).toHaveLength(2)
    expect(screen.getAllByText('Drafts')).toHaveLength(2)
    expect(screen.getByText('Showing')).toBeInTheDocument()
  })

  test('renders type filter and search', () => {
    mockSearchOptions.mockReturnValue({
      queryKey: ['events', 'org-1'],
      queryFn: () => Promise.resolve({ data: [], pagination: { totalCount: 0 } }),
    })

    renderWithProviders(<EventList orgId="org-1" />)

    expect(screen.getByPlaceholderText('Search events...')).toBeInTheDocument()
    // "All Types" appears in SelectValue placeholder and SelectItem — use getAllByText
    expect(screen.getAllByText('All Types').length).toBeGreaterThanOrEqual(1)
  })
})
