import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { NotificationPreferences } from '../components/notification-preferences'
import { AnnouncementContent } from '../components/announcement-content'

// @monobase/ui rendered as real components against happy-dom.

// Mock api module
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ ok: true }),
  },
}))

import { api } from '@/lib/api'
const mockApi = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> }

describe('NotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue({ data: [] })
    mockApi.post.mockResolvedValue({ ok: true })
  })

  test('renders 5 category rows x 3 channel columns of switches', async () => {
    renderWithProviders(
      <NotificationPreferences orgId="org-1" personId="person-1" />
    )

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByText('Dues')).toBeInTheDocument()
    })

    // 5 category labels
    expect(screen.getByText('Events')).toBeInTheDocument()
    expect(screen.getByText('Training')).toBeInTheDocument()
    expect(screen.getByText('Announcements')).toBeInTheDocument()
    expect(screen.getByText('Comms')).toBeInTheDocument()

    // 3 column headers
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Push')).toBeInTheDocument()
    expect(screen.getByText('In-App')).toBeInTheDocument()

    // 15 switches total (5 rows x 3 columns)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(15)
  })

  test('clicking switch calls update API', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <NotificationPreferences orgId="org-1" personId="person-1" />
    )

    // Wait for loading to finish and switches to appear
    const switches = await waitFor(() => {
      const s = screen.getAllByRole('switch')
      expect(s.length).toBeGreaterThan(0)
      return s
    })

    // Click the first switch to toggle it
    await user.click(switches[0])

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/association/person-subscriptions/bulk-update',
        expect.objectContaining({
          updates: expect.any(Array),
        })
      )
    })
  })
})

describe('AnnouncementContent', () => {
  const baseAnnouncement = {
    id: 'ann-1',
    title: 'Test Announcement',
    content: 'This is the body of the announcement.',
    status: 'sent',
    publishedAt: '2026-01-15T10:00:00Z',
    createdAt: '2026-01-14T09:00:00Z',
    channelPush: true,
    channelEmail: false,
    audienceType: 'all',
  }

  test('renders full content with title, body, date', () => {
    renderWithProviders(
      <AnnouncementContent announcement={baseAnnouncement} />
    )

    expect(screen.getByText('Test Announcement')).toBeInTheDocument()
    expect(screen.getByText('This is the body of the announcement.')).toBeInTheDocument()
    expect(screen.getByText('Push')).toBeInTheDocument()
    // Sent status badge
    expect(screen.getByText('Sent')).toBeInTheDocument()
  })

  test('showStats=true shows delivery stats, showStats=false hides them', () => {
    const statsAnnouncement = {
      ...baseAnnouncement,
      stats: { recipients: 120, emailSent: 45, pushDelivered: 80, inappViews: 95 },
    }

    // With stats
    const { unmount } = renderWithProviders(
      <AnnouncementContent announcement={statsAnnouncement} showStats={true} />
    )
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('Recipients')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('Push Delivered')).toBeInTheDocument()
    unmount()

    // Without stats
    renderWithProviders(
      <AnnouncementContent announcement={statsAnnouncement} showStats={false} />
    )
    expect(screen.queryByText('Recipients')).not.toBeInTheDocument()
    expect(screen.queryByText('Push Delivered')).not.toBeInTheDocument()
  })
})
