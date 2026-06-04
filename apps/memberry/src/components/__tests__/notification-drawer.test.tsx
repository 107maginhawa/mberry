import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { NotificationDrawer } from '../notification-drawer'

// Mock @tanstack/react-router via global router stub override
const mockNavigate = vi.fn()
;(globalThis as any).__routerNavigate = mockNavigate

// Radix Sheet/Dialog portals don't render inline under happy-dom; stub
// @monobase/ui Sheet primitives to flat divs so SheetContent assertions
// resolve. Per-test isolation keeps mock scoped to this file.
vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, disabled, type, variant, ...props }: any) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
  Sheet: ({ children, open }: any) => (open ? <div data-testid="sheet">{children}</div> : null),
  SheetContent: ({ children }: any) => <div data-testid="sheet-content">{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Bell: () => <span data-testid="icon-bell">Bell</span>,
  CreditCard: () => <span data-testid="icon-credit-card">CreditCard</span>,
  Calendar: () => <span data-testid="icon-calendar">Calendar</span>,
  GraduationCap: () => <span data-testid="icon-graduation">GraduationCap</span>,
  CheckCheck: () => <span data-testid="icon-check">CheckCheck</span>,
  MessageSquare: () => <span data-testid="icon-message">MessageSquare</span>,
  Settings2: () => <span data-testid="icon-settings">Settings</span>,
}))

// Mock useOrgContext
vi.mock('@/hooks/useOrgContext', () => ({
  useOrgContext: () => ({ orgId: 'org-123' }),
}))

// Mock api
const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
}
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockApi.get(...args),
    post: (...args: any[]) => mockApi.post(...args),
  },
}))

// Test data
const mockNotifications = [
  {
    id: 'n1',
    title: 'Dues Payment Due',
    message: 'Your annual dues of P2,500 are due',
    type: 'billing',
    status: 'sent',
    createdAt: new Date(Date.now() - 3600000).toISOString(), // 1hr ago
    relatedEntityType: 'invoice',
    relatedEntityId: 'inv-1',
  },
  {
    id: 'n2',
    title: 'Event Registration Open',
    message: 'PDA Annual Convention registration is now open',
    type: 'event.registration',
    status: 'sent',
    createdAt: new Date(Date.now() - 7200000).toISOString(), // 2hr ago
    relatedEntityType: 'event',
    relatedEntityId: 'evt-1',
  },
  {
    id: 'n3',
    title: 'Training Certificate Ready',
    message: 'Your CPD certificate for Basic Life Support is ready',
    type: 'training.completed',
    status: 'read',
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    relatedEntityType: 'training',
    relatedEntityId: 'trn-1',
  },
  {
    id: 'n4',
    title: 'New Announcement',
    message: 'Important update from your chapter president',
    type: 'system',
    status: 'sent',
    createdAt: new Date(Date.now() - 1800000).toISOString(), // 30min ago
    relatedEntityType: 'announcement',
    relatedEntityId: 'ann-1',
  },
]

describe('NotificationDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: mockNotifications })
    mockApi.post.mockResolvedValue({})
  })

  test('renders category tabs and filters notifications by type', async () => {
    renderWithProviders(
      <NotificationDrawer open={true} onOpenChange={vi.fn()} />,
    )

    // All 5 category tabs visible
    await waitFor(() => {
      expect(screen.getByText('All')).toBeTruthy()
      expect(screen.getByText('Dues')).toBeTruthy()
      expect(screen.getByText('Events')).toBeTruthy()
      expect(screen.getByText('Training')).toBeTruthy()
      expect(screen.getByText('Comms')).toBeTruthy()
    })

    // "All" tab shows all 4 notifications
    await waitFor(() => {
      expect(screen.getByText('Dues Payment Due')).toBeTruthy()
      expect(screen.getByText('Event Registration Open')).toBeTruthy()
      expect(screen.getByText('Training Certificate Ready')).toBeTruthy()
      expect(screen.getByText('New Announcement')).toBeTruthy()
    })

    // Click "Dues" tab — only billing notification visible
    await userEvent.click(screen.getByText('Dues'))
    await waitFor(() => {
      expect(screen.getByText('Dues Payment Due')).toBeTruthy()
      expect(screen.queryByText('Event Registration Open')).toBeNull()
      expect(screen.queryByText('Training Certificate Ready')).toBeNull()
    })

    // Click "Events" tab — only event notification visible
    await userEvent.click(screen.getByText('Events'))
    await waitFor(() => {
      expect(screen.getByText('Event Registration Open')).toBeTruthy()
      expect(screen.queryByText('Dues Payment Due')).toBeNull()
    })

    // Click "All" to reset
    await userEvent.click(screen.getByText('All'))
    await waitFor(() => {
      expect(screen.getByText('Dues Payment Due')).toBeTruthy()
      expect(screen.getByText('Event Registration Open')).toBeTruthy()
    })
  })

  test('marks single notification as read on click', async () => {
    renderWithProviders(
      <NotificationDrawer open={true} onOpenChange={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText('Dues Payment Due')).toBeTruthy()
    })

    // Click an unread notification
    await userEvent.click(screen.getByText('Dues Payment Due'))

    // Verify POST /api/notifs/{id}/read was called
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/notifs/n1/read')
    })
  })

  test('marks all notifications as read', async () => {
    renderWithProviders(
      <NotificationDrawer open={true} onOpenChange={vi.fn()} />,
    )

    // Mark all read button should be visible (3 unread notifications)
    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeTruthy()
    })

    await userEvent.click(screen.getByText('Mark all read'))

    // Verify POST /api/notifs/read-all was called
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/api/notifs/read-all')
    })
  })

  test('routes to correct page based on relatedEntityType', async () => {
    const onOpenChange = vi.fn()
    renderWithProviders(
      <NotificationDrawer open={true} onOpenChange={onOpenChange} />,
    )

    await waitFor(() => {
      expect(screen.getByText('Dues Payment Due')).toBeTruthy()
    })

    // Click invoice notification → routes to /org/{id}/dues
    await userEvent.click(screen.getByText('Dues Payment Due'))
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/org/org-123/dues' })
      expect(onOpenChange).toHaveBeenCalledWith(false) // drawer closes
    })

    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: mockNotifications })

    // Render fresh for announcement click
    const { unmount } = renderWithProviders(
      <NotificationDrawer open={true} onOpenChange={onOpenChange} />,
    )

    await waitFor(() => {
      expect(screen.getAllByText('New Announcement').length).toBeGreaterThan(0)
    })

    // Click announcement → routes to /org/{id}/announcements/{entityId}
    await userEvent.click(screen.getAllByText('New Announcement')[0])
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/org/org-123/announcements/ann-1',
      })
    })

    unmount()
  })

  test('shows empty state when no notifications', async () => {
    mockApi.get.mockResolvedValue({ data: [] })

    renderWithProviders(
      <NotificationDrawer open={true} onOpenChange={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeTruthy()
      expect(screen.getByText("You're all caught up")).toBeTruthy()
    })

    // Switch to specific category — different empty message
    await userEvent.click(screen.getByText('Dues'))
    await waitFor(() => {
      expect(screen.getByText('Nothing in this category')).toBeTruthy()
    })
  })

  test('shows loading skeletons while fetching', async () => {
    // Make query hang indefinitely
    mockApi.get.mockReturnValue(new Promise(() => {}))

    const { container } = renderWithProviders(
      <NotificationDrawer open={true} onOpenChange={vi.fn()} />,
    )

    // Should show 5 skeleton elements with animate-pulse
    await waitFor(() => {
      const pulseElements = container.querySelectorAll('.animate-pulse')
      expect(pulseElements.length).toBe(5)
    })
  })

  test('displays unread dot on unread notifications only', async () => {
    renderWithProviders(
      <NotificationDrawer open={true} onOpenChange={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.getByText('Dues Payment Due')).toBeTruthy()
    })

    // n1 (billing, status=sent) is unread — should have semibold title
    const duesTitle = screen.getByText('Dues Payment Due')
    expect(duesTitle.className).toContain('font-semibold')

    // n3 (training, status=read) is read — should have medium weight
    const trainingTitle = screen.getByText('Training Certificate Ready')
    expect(trainingTitle.className).toContain('font-medium')
    expect(trainingTitle.className).not.toContain('font-semibold')
  })
})
