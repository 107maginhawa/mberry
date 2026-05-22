import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { EventList } from './event-list'

vi.mock('@monobase/sdk-ts/generated/@tanstack/react-query.gen', () => ({
  searchEventsOptions: vi.fn(),
  searchEventsQueryKey: vi.fn(() => ['events']),
  cancelEventMutation: vi.fn(),
}))

vi.mock('@monobase/ui', () => ({
  Input: (props: any) => <input {...props} />,
  Skeleton: ({ className }: any) => <div className={className} data-testid="skeleton" />,
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
  Select: ({ children, value, onValueChange: _onValueChange }: any) => (
    <div data-testid="select" data-value={value}>{children}</div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

vi.mock('./event-card', () => ({
  EventCard: ({ event }: any) => <div data-testid="event-card">{event.title}</div>,
}))

import {
  searchEventsOptions,
  cancelEventMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

const mockSearchOptions = searchEventsOptions as ReturnType<typeof vi.fn>
const mockCancelMutation = cancelEventMutation as ReturnType<typeof vi.fn>

describe('EventList', () => {
  beforeEach(() => {
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
