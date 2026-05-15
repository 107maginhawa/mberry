import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { NotificationInbox } from './notification-inbox'

// Mock @/lib/api
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

// Mock motion/glass-card
vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => (
    <div data-testid="glass-card" className={className}>{children}</div>
  ),
}))

// Mock patterns/empty-state
vi.mock('@/components/patterns/empty-state', () => ({
  EmptyState: ({ headline, description }: any) => (
    <div>
      <span>{headline}</span>
      <span>{description}</span>
    </div>
  ),
}))

// Mock patterns/skeleton-loader
vi.mock('@/components/patterns/skeleton-loader', () => ({
  ListSkeleton: ({ rows }: any) => <div data-testid="list-skeleton">Loading {rows} rows</div>,
}))

import { api } from '@/lib/api'

const mockApiGet = api.get as ReturnType<typeof vi.fn>
const mockApiPost = api.post as ReturnType<typeof vi.fn>

describe('NotificationInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('shows loading skeleton while fetching', () => {
    mockApiGet.mockReturnValue(new Promise(() => {})) // never resolves

    renderWithProviders(<NotificationInbox />)

    expect(screen.getByTestId('list-skeleton')).toBeInTheDocument()
  })

  test('shows error message when query fails', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'))

    renderWithProviders(<NotificationInbox />)

    await waitFor(() => {
      expect(screen.getByText('Could not load notifications')).toBeInTheDocument()
    })
  })

  test('shows empty state when no notifications', async () => {
    mockApiGet.mockResolvedValue({ data: [] })

    renderWithProviders(<NotificationInbox />)

    await waitFor(() => {
      expect(screen.getByText('No notifications yet')).toBeInTheDocument()
    })
  })

  test('renders notification items grouped by date', async () => {
    const now = new Date()
    mockApiGet.mockResolvedValue({
      data: [
        {
          id: 'n-1',
          title: 'Dues Payment Received',
          message: 'Your payment of P2,500 was confirmed',
          type: 'billing',
          status: 'unread',
          createdAt: now.toISOString(),
        },
        {
          id: 'n-2',
          title: 'Event Reminder',
          message: 'Annual convention starts tomorrow',
          type: 'booking.reminder',
          status: 'read',
          createdAt: now.toISOString(),
        },
      ],
    })

    renderWithProviders(<NotificationInbox />)

    await waitFor(() => {
      expect(screen.getByText('Dues Payment Received')).toBeInTheDocument()
      expect(screen.getByText('Event Reminder')).toBeInTheDocument()
    })

    // Bodies displayed
    expect(screen.getByText('Your payment of P2,500 was confirmed')).toBeInTheDocument()
    expect(screen.getByText('Annual convention starts tomorrow')).toBeInTheDocument()
  })

  test('shows unread count badge', async () => {
    mockApiGet.mockResolvedValue({
      data: [
        {
          id: 'n-1',
          title: 'Unread One',
          message: 'body',
          type: 'system',
          status: 'unread',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'n-2',
          title: 'Read One',
          message: 'body',
          type: 'system',
          status: 'read',
          createdAt: new Date().toISOString(),
        },
      ],
    })

    renderWithProviders(<NotificationInbox />)

    await waitFor(() => {
      expect(screen.getByText('1 unread')).toBeInTheDocument()
      expect(screen.getByText('Mark all as read')).toBeInTheDocument()
    })
  })

  test('renders category filter chips', async () => {
    mockApiGet.mockResolvedValue({ data: [] })

    renderWithProviders(<NotificationInbox />)

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('Announcements')).toBeInTheDocument()
      expect(screen.getByText('Payments')).toBeInTheDocument()
      expect(screen.getByText('Events')).toBeInTheDocument()
      expect(screen.getByText('Training')).toBeInTheDocument()
      expect(screen.getByText('System')).toBeInTheDocument()
    })
  })

  test('filters notifications by category', async () => {
    const user = userEvent.setup()
    mockApiGet.mockResolvedValue({
      data: [
        {
          id: 'n-1',
          title: 'Payment Alert',
          message: 'body',
          type: 'billing',
          status: 'read',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'n-2',
          title: 'System Update',
          message: 'body',
          type: 'system',
          status: 'read',
          createdAt: new Date().toISOString(),
        },
      ],
    })

    renderWithProviders(<NotificationInbox />)

    await waitFor(() => {
      expect(screen.getByText('Payment Alert')).toBeInTheDocument()
      expect(screen.getByText('System Update')).toBeInTheDocument()
    })

    // Click Payments filter
    await user.click(screen.getByText('Payments'))

    expect(screen.getByText('Payment Alert')).toBeInTheDocument()
    expect(screen.queryByText('System Update')).not.toBeInTheDocument()
  })

  test('mark all read calls API and hides unread badge', async () => {
    const user = userEvent.setup()
    mockApiPost.mockResolvedValue({})
    mockApiGet.mockResolvedValue({
      data: [
        {
          id: 'n-1',
          title: 'Unread',
          message: 'body',
          type: 'system',
          status: 'unread',
          createdAt: new Date().toISOString(),
        },
      ],
    })

    renderWithProviders(<NotificationInbox />)

    await waitFor(() => {
      expect(screen.getByText('1 unread')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Mark all as read'))

    await waitFor(() => {
      expect(screen.queryByText('1 unread')).not.toBeInTheDocument()
    })
  })
})
